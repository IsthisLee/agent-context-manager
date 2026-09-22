import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { PACKAGE_ROOT, packageVersion } from '../shared/runtime.ts';

/**
 * `agctx install`은 이 패키지에 든 에이전트 스킬을, 이 컴퓨터에서 찾은 에이전트마다 사용자 수준 스킬
 * 폴더에 복사해서, 스킬이 항상 설치된 CLI와 맞게 한다. 복사한 스킬 폴더마다 버전과 파일 해시 기록을
 * 두고, 그 기록과 아직 맞는 폴더만 바꾸거나 지운다.
 */

/** agctx가 자기가 쓴 스킬 폴더마다 두는 기록. */
export const INSTALL_RECORD = '.agctx-install.json';

export type SkillTargetId = 'claude' | 'codex' | 'antigravity' | 'antigravity-cli';
export type SkillAgent = 'claude' | 'codex' | 'antigravity';

export interface SkillTarget {
  id: SkillTargetId;
  agent: SkillAgent;
  /** 그 에이전트의 사용자 수준 스킬 폴더. 공식 문서를 따른다. */
  dir: string;
  /** 있으면 그 에이전트가 설치됐다고 보는 폴더. */
  marker: string;
  found: boolean;
}

export type SkillItemState = 'create' | 'update' | 'unchanged' | 'blocked' | 'remove' | 'kept';

export interface SkillItem {
  target: SkillTargetId;
  skill: string;
  /** 대상 안의 스킬 폴더. 예: `~/.claude/skills/agctx`. */
  dir: string;
  state: SkillItemState;
  /** 폴더가 막히거나 남는 이유: 기록이 없거나, 이 파일들이 기록과 다르다. */
  reason: string | null;
}

export interface SkillPlan {
  items: SkillItem[];
  /** 에이전트를 찾지 못해 빠진 대상. */
  skipped: SkillTarget[];
  /** 폴더가 설치를 멈추게 하는지. 그러면 아무것도 쓰지 않는다. */
  blocked: boolean;
}

interface InstallRecord {
  schemaVersion: 1;
  version: string;
  files: Record<string, string>;
}

const AGENTS: readonly SkillAgent[] = ['claude', 'codex', 'antigravity'];

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** 스킬이 들어갈 네 곳과 각 에이전트를 찾았는지. 부를 때 HOME과 CODEX_HOME을 읽는다. */
export function skillTargets(): SkillTarget[] {
  const home = os.homedir();
  const target = (id: SkillTargetId, agent: SkillAgent, dir: string, marker: string): SkillTarget => ({
    id,
    agent,
    dir,
    marker,
    found: isDirectory(marker)
  });
  return [
    target('claude', 'claude', path.join(home, '.claude', 'skills'), path.join(home, '.claude')),
    target('codex', 'codex', path.join(home, '.agents', 'skills'), process.env.CODEX_HOME || path.join(home, '.codex')),
    target(
      'antigravity',
      'antigravity',
      path.join(home, '.gemini', 'config', 'skills'),
      path.join(home, '.gemini', 'config')
    ),
    target(
      'antigravity-cli',
      'antigravity',
      path.join(home, '.gemini', 'antigravity-cli', 'skills'),
      path.join(home, '.gemini', 'antigravity-cli')
    )
  ];
}

/** `dir` 아래의 모든 파일. `/`로 나눈 경로이고 설치 기록은 뺀다. */
function filesIn(dir: string, rel = ''): string[] {
  const files: string[] = [];
  for (const entry of fs
    .readdirSync(path.join(dir, rel), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...filesIn(dir, child));
    else if (child !== INSTALL_RECORD) files.push(child);
  }
  return files;
}

const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function hashes(dir: string): Record<string, string> {
  return Object.fromEntries(filesIn(dir).map(rel => [rel, sha256(path.join(dir, ...rel.split('/')))]));
}

/** 이 패키지가 배포하는 스킬. 폴더 이름별. */
export function packagedSkills(): string[] {
  const root = path.join(PACKAGE_ROOT, 'skills');
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

function readRecord(dir: string): InstallRecord | null {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(dir, INSTALL_RECORD), 'utf8')) as Partial<InstallRecord>;
    return record.schemaVersion === 1 &&
      typeof record.version === 'string' &&
      record.files &&
      typeof record.files === 'object'
      ? (record as InstallRecord)
      : null;
  } catch {
    return null;
  }
}

const sameFiles = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([rel, hash]) => b[rel] === hash);

/** 폴더에 있는 것과 기록에 있던 것이 다른 파일. */
function changedFiles(current: Record<string, string>, recorded: Record<string, string>): string[] {
  return [...new Set([...Object.keys(current), ...Object.keys(recorded)])]
    .filter(rel => current[rel] !== recorded[rel])
    .sort();
}

/**
 * 스킬 폴더 `dest`가 agctx가 쓴 그대로의 사본인지. null이면 그렇다: 기록이 있고 파일이 기록과 맞는다.
 * 아니면 그 이유를 돌려주고, 그 이유 때문에 --force 없이는 바꾸거나 지우지 않는다.
 */
function notOurs(dest: string): string | null {
  // lstat은 심볼릭 링크를 따라가지 않으므로, 여기서 링크는 폴더가 아니고 따라서 우리 것이 아니다.
  if (!fs.lstatSync(dest).isDirectory()) return _('install.reason.not-agctx');
  const record = readRecord(dest);
  if (!record) return _('install.reason.not-agctx');
  const changed = changedFiles(hashes(dest), record.files);
  return changed.length ? _('install.reason.changed', { files: changed.join(', ') }) : null;
}

/** 명령이 작용할 대상: --agent로 지정한 것, 또는 에이전트를 찾은 것. */
function chosenTargets(
  agent: string | null | undefined,
  found: boolean
): { chosen: SkillTarget[]; skipped: SkillTarget[] } {
  const targets = skillTargets();
  if (agent && agent !== 'all' && !(AGENTS as readonly string[]).includes(agent)) {
    throw usageError('install.invalid-agent', _('error.install.invalid-agent', { agent }), _('hint.install.agent'));
  }
  if (agent) return { chosen: targets.filter(target => agent === 'all' || target.agent === agent), skipped: [] };
  return found
    ? { chosen: targets.filter(target => target.found), skipped: targets.filter(target => !target.found) }
    : { chosen: targets, skipped: [] };
}

/** `agctx install`이 할 일. 아무것도 쓰지 않는다. */
export function planInstall(options: { agent?: string | null; force?: boolean }): SkillPlan {
  const { chosen, skipped } = chosenTargets(options.agent, true);
  if (!chosen.length) {
    throw usageError(
      'install.none-found',
      _('error.install.none-found', {
        folders: skillTargets()
          .map(target => target.marker)
          .join(', ')
      }),
      _('hint.install.agent')
    );
  }
  const version = packageVersion();
  const items: SkillItem[] = [];
  for (const target of chosen) {
    for (const skill of packagedSkills()) {
      const dir = path.join(target.dir, skill);
      const packaged = hashes(path.join(PACKAGE_ROOT, 'skills', skill));
      let exists = true;
      try {
        fs.lstatSync(dir);
      } catch {
        exists = false;
      }
      if (!exists) {
        items.push({ target: target.id, skill, dir, state: 'create', reason: null });
        continue;
      }
      const reason = notOurs(dir);
      if (reason && !options.force) {
        items.push({ target: target.id, skill, dir, state: 'blocked', reason });
        continue;
      }
      const record = reason ? null : readRecord(dir);
      const current = !reason && record?.version === version && sameFiles(record.files, packaged);
      items.push({ target: target.id, skill, dir, state: current ? 'unchanged' : 'update', reason: null });
    }
  }
  return { items, skipped, blocked: items.some(item => item.state === 'blocked') };
}

/** 만들거나 갱신할 항목마다 패키지의 스킬을 기록과 함께 복사한다. */
export function applyInstall(plan: SkillPlan): void {
  const version = packageVersion();
  for (const item of plan.items) {
    if (item.state !== 'create' && item.state !== 'update') continue;
    const source = path.join(PACKAGE_ROOT, 'skills', item.skill);
    fs.rmSync(item.dir, { recursive: true, force: true });
    const files = hashes(source);
    for (const rel of Object.keys(files)) {
      const target = path.join(item.dir, ...rel.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, ...rel.split('/')), target);
    }
    const record: InstallRecord = { schemaVersion: 1, version, files };
    writeTextAtomic(path.join(item.dir, INSTALL_RECORD), JSON.stringify(record, null, 2) + '\n');
  }
}

/** `agctx uninstall`이 할 일: agctx가 쓴 사본을 지우고, 같은 이름의 다른 폴더는 남긴다. */
export function planUninstall(options: { agent?: string | null }): SkillPlan {
  const { chosen } = chosenTargets(options.agent, false);
  const items: SkillItem[] = [];
  for (const target of chosen) {
    for (const skill of packagedSkills()) {
      const dir = path.join(target.dir, skill);
      try {
        fs.lstatSync(dir);
      } catch {
        continue;
      }
      const reason = notOurs(dir);
      items.push({ target: target.id, skill, dir, state: reason ? 'kept' : 'remove', reason });
    }
  }
  return { items, skipped: [], blocked: false };
}

export function applyUninstall(plan: SkillPlan): void {
  for (const item of plan.items) if (item.state === 'remove') fs.rmSync(item.dir, { recursive: true, force: true });
}

/** agctx가 쓴 스킬 폴더 가운데 기록의 버전이 이 CLI와 다른 것. */
export function outdatedSkills(): { dir: string; version: string }[] {
  const version = packageVersion();
  const outdated: { dir: string; version: string }[] = [];
  for (const target of skillTargets()) {
    for (const skill of packagedSkills()) {
      const dir = path.join(target.dir, skill);
      const record = readRecord(dir);
      if (record && record.version !== version) outdated.push({ dir, version: record.version });
    }
  }
  return outdated;
}

/**
 * 설치된 스킬이 다른 agctx 버전의 것일 때 모든 명령이 출력하는 한 줄. 버전이 같거나 설치된 스킬이
 * 없으면 null. 옛 스킬을 따르는 에이전트는 이 CLI에 더는 없는 명령을 실행할 수 있다.
 */
export function skillNotice(): string | null {
  const [first, ...rest] = outdatedSkills();
  if (!first) return null;
  const vars = { dir: first.dir, version: first.version, current: packageVersion(), more: rest.length };
  return rest.length ? _('install.warn.outdated-many', vars) : _('install.warn.outdated', vars);
}
