import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { writeTextAtomic } from '../shared/fs-utils.ts';
import { PACKAGE_ROOT, packageVersion } from '../shared/runtime.ts';

/**
 * `agctx install` copies the agent skills shipped in this package into the user-level skill folder of each agent
 * found on this machine, so the skills always match the installed CLI. Each copied skill folder carries a record of
 * the version and file hashes, and only a folder that still matches its record is replaced or removed.
 */

/** The record agctx keeps in each skill folder it wrote. */
export const INSTALL_RECORD = '.agctx-install.json';

export type SkillTargetId = 'claude' | 'codex' | 'antigravity' | 'antigravity-cli';
export type SkillAgent = 'claude' | 'codex' | 'antigravity';

export interface SkillTarget {
  id: SkillTargetId;
  agent: SkillAgent;
  /** The user-level skill folder of that agent, from its official documentation. */
  dir: string;
  /** The folder whose presence says the agent is installed. */
  marker: string;
  found: boolean;
}

export type SkillItemState = 'create' | 'update' | 'unchanged' | 'blocked' | 'remove' | 'kept';

export interface SkillItem {
  target: SkillTargetId;
  skill: string;
  /** The skill folder in the target, for example `~/.claude/skills/agctx`. */
  dir: string;
  state: SkillItemState;
  /** Why a folder is blocked or kept: it has no record, or these files differ from it. */
  reason: string | null;
}

export interface SkillPlan {
  items: SkillItem[];
  /** Targets left out because their agent was not found. */
  skipped: SkillTarget[];
  /** Whether a folder stops the install; nothing is written then. */
  blocked: boolean;
}

interface InstallRecord {
  schemaVersion: 1;
  version: string;
  files: Record<string, string>;
}

const AGENTS: readonly SkillAgent[] = ['claude', 'codex', 'antigravity'];

function isDirectory(target: string): boolean {
  try { return fs.statSync(target).isDirectory(); } catch { return false; }
}

/** The four places skills go, with whether each agent is found. Reads HOME and CODEX_HOME when called. */
export function skillTargets(): SkillTarget[] {
  const home = os.homedir();
  const target = (id: SkillTargetId, agent: SkillAgent, dir: string, marker: string): SkillTarget => ({ id, agent, dir, marker, found: isDirectory(marker) });
  return [
    target('claude', 'claude', path.join(home, '.claude', 'skills'), path.join(home, '.claude')),
    target('codex', 'codex', path.join(home, '.agents', 'skills'), process.env.CODEX_HOME || path.join(home, '.codex')),
    target('antigravity', 'antigravity', path.join(home, '.gemini', 'config', 'skills'), path.join(home, '.gemini', 'config')),
    target('antigravity-cli', 'antigravity', path.join(home, '.gemini', 'antigravity-cli', 'skills'), path.join(home, '.gemini', 'antigravity-cli'))
  ];
}

/** Every file under `dir` as `/`-separated paths, leaving out the install record. */
function filesIn(dir: string, rel = ''): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
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

/** The skills this package ships, by folder name. */
export function packagedSkills(): string[] {
  const root = path.join(PACKAGE_ROOT, 'skills');
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function readRecord(dir: string): InstallRecord | null {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(dir, INSTALL_RECORD), 'utf8')) as Partial<InstallRecord>;
    return record.schemaVersion === 1 && typeof record.version === 'string' && record.files && typeof record.files === 'object' ? record as InstallRecord : null;
  } catch {
    return null;
  }
}

const sameFiles = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([rel, hash]) => b[rel] === hash);

/** Files that differ between what a folder holds and what its record says it held. */
function changedFiles(current: Record<string, string>, recorded: Record<string, string>): string[] {
  return [...new Set([...Object.keys(current), ...Object.keys(recorded)])].filter(rel => current[rel] !== recorded[rel]).sort();
}

/**
 * Whether the skill folder `dest` is agctx's own copy as it wrote it. Null means it is: the record is there and
 * the files match it. Otherwise the reason it is not, which blocks replacing or removing it without --force.
 */
function notOurs(dest: string): string | null {
  // lstat does not follow a symbolic link, so a link is never a directory here and is never ours.
  if (!fs.lstatSync(dest).isDirectory()) return _('install.reason.not-agctx');
  const record = readRecord(dest);
  if (!record) return _('install.reason.not-agctx');
  const changed = changedFiles(hashes(dest), record.files);
  return changed.length ? _('install.reason.changed', { files: changed.join(', ') }) : null;
}

/** The targets a command acts on: those named by --agent, or those whose agent is found. */
function chosenTargets(agent: string | null | undefined, found: boolean): { chosen: SkillTarget[]; skipped: SkillTarget[] } {
  const targets = skillTargets();
  if (agent && agent !== 'all' && !(AGENTS as readonly string[]).includes(agent)) {
    throw usageError('install.invalid-agent', _('error.install.invalid-agent', { agent }), _('hint.install.agent'));
  }
  if (agent) return { chosen: targets.filter(target => agent === 'all' || target.agent === agent), skipped: [] };
  return found ? { chosen: targets.filter(target => target.found), skipped: targets.filter(target => !target.found) } : { chosen: targets, skipped: [] };
}

/** What `agctx install` would do. Nothing is written. */
export function planInstall(options: { agent?: string | null; force?: boolean }): SkillPlan {
  const { chosen, skipped } = chosenTargets(options.agent, true);
  if (!chosen.length) {
    throw usageError('install.none-found', _('error.install.none-found', { folders: skillTargets().map(target => target.marker).join(', ') }), _('hint.install.agent'));
  }
  const version = packageVersion();
  const items: SkillItem[] = [];
  for (const target of chosen) {
    for (const skill of packagedSkills()) {
      const dir = path.join(target.dir, skill);
      const packaged = hashes(path.join(PACKAGE_ROOT, 'skills', skill));
      let exists = true;
      try { fs.lstatSync(dir); } catch { exists = false; }
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

/** Copy the package's skills for every item to create or update, each with its record. */
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

/** What `agctx uninstall` would do: remove agctx's own copies, keep any other folder by those names. */
export function planUninstall(options: { agent?: string | null }): SkillPlan {
  const { chosen } = chosenTargets(options.agent, false);
  const items: SkillItem[] = [];
  for (const target of chosen) {
    for (const skill of packagedSkills()) {
      const dir = path.join(target.dir, skill);
      try { fs.lstatSync(dir); } catch { continue; }
      const reason = notOurs(dir);
      items.push({ target: target.id, skill, dir, state: reason ? 'kept' : 'remove', reason });
    }
  }
  return { items, skipped: [], blocked: false };
}

export function applyUninstall(plan: SkillPlan): void {
  for (const item of plan.items) if (item.state === 'remove') fs.rmSync(item.dir, { recursive: true, force: true });
}

/** Skill folders agctx wrote whose record names another version than this CLI. */
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
 * The one line every command prints when the installed skills are from another agctx version, or null when they
 * match or none is installed. An agent following an older skill may run a command this CLI no longer has.
 */
export function skillNotice(): string | null {
  const [first, ...rest] = outdatedSkills();
  if (!first) return null;
  const vars = { dir: first.dir, version: first.version, current: packageVersion(), more: rest.length };
  return rest.length ? _('install.warn.outdated-many', vars) : _('install.warn.outdated', vars);
}
