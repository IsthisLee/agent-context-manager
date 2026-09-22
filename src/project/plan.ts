import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  extractAgentsManagedDocument,
  extractManagedDocument,
  formatterNormalized,
  mergeAgentsMd,
  mergeManagedDocument
} from './analyzer.ts';
import { apmRegenerates } from './apm.ts';
import { AGCTX_GITIGNORE, baseFilePath, parseBase, serializeBase } from './conflicts.ts';
import { LINK_TEMPLATE, linksTo, nestedAgentsFiles, personLink } from './links.ts';
import { _ } from '../i18n/index.ts';
import type { AgentId } from '../shared/agents.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { assertSafeTextTarget, toLf, writeTextAtomic } from '../shared/fs-utils.ts';
import type {
  ConflictedFile,
  ManagedKind,
  PlannedChange,
  PlannedFile,
  ProjectConfig,
  ProjectPlan,
  VersionRecord
} from '../shared/types.ts';

/**
 * `profile apply`/`sync`/`resolve`가 프로젝트에 쓸 내용을 계획한다. 마지막 적용 뒤에 고친 관리
 * 영역은 예외를 던지지 않고 충돌로 보고해서, 호출한 쪽이 보여 주거나, 멈추거나, 풀 수 있게 한다.
 */

/** 에이전트마다 쓰는 연결 파일. `AGENTS.md`는 모든 에이전트가 읽는 정본이라 고르는 대상이 아니다. */
export const POINTER_TEMPLATES: ReadonlyArray<readonly [source: string, target: string, agent: AgentId]> = [
  ['templates/CLAUDE.md', 'CLAUDE.md', 'claude'],
  ['templates/antigravity-rules/agctx.md', '.agents/rules/agctx.md', 'antigravity']
];

const MANAGED_BLOCK = /\n*<!-- agctx:managed:start -->[\s\S]*?<!-- agctx:managed:end -->\n*/;
const LEADING_FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/**
 * 고르지 않은 에이전트의 파일에서 관리 블록을 뺀 나머지. 남는 것이 없거나, 파일을 만들 때 agctx가 붙인
 * 템플릿 frontmatter뿐이면 빈 글이며 파일을 지운다는 뜻이다. 블록 밖에 사람이 쓴 내용은 그대로 둔다.
 */
export function withoutManagedBlock(existing: string, template: string): string {
  const rest = existing.replace(MANAGED_BLOCK, '\n\n').replace(/^\n+/, '').trimEnd();
  const frontmatter = template.trim().match(LEADING_FRONTMATTER)?.[0].trim() ?? null;
  if (!rest || rest === frontmatter) return '';
  return `${rest}\n`;
}

/** Claude Code가 지침 파일마다 권하는 줄 수. 이보다 긴 프로젝트 AGENTS.md는 경고한다(ADR 0041). */
export const AGENTS_LINE_WARNING = 200;
/** Codex 기본 한도 32 KiB(`project_doc_max_bytes`)의 75%. 이 크기 이상이면 경고한다(ADR 0041). */
export const AGENTS_BYTE_WARNING = 24 * 1024;

/**
 * 프로젝트 AGENTS.md가 분량 기준을 넘을 때 보여 줄 경고. 파일과 종료 코드는 바꾸지 않는다.
 * @param content - 이번에 쓸 내용. 줄 끝은 LF다.
 * @param crlf - 디스크에 CRLF로 쓰이는지. 그러면 줄마다 한 바이트씩 더 잰다.
 */
export function agentsLengthWarnings(content: string, crlf = false): string[] {
  const breaks = content.split('\n').length - 1;
  const lineCount = content.endsWith('\n') ? breaks : breaks + 1;
  const bytes = Buffer.byteLength(content) + (crlf ? breaks : 0);
  return [
    ...(lineCount > AGENTS_LINE_WARNING
      ? [_('plan.warn.agents-lines', { lines: lineCount, limit: AGENTS_LINE_WARNING })]
      : []),
    ...(bytes >= AGENTS_BYTE_WARNING
      ? [_('plan.warn.agents-bytes', { size: (bytes / 1024).toFixed(1), threshold: AGENTS_BYTE_WARNING / 1024 })]
      : [])
  ];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** writeTextAtomic처럼, 이미 CRLF로 저장된 파일은 CRLF로 다시 쓰인다. */
function writesCrlf(target: string): boolean {
  try {
    return fs.readFileSync(target, 'utf8').includes('\r\n');
  } catch {
    return false;
  }
}

function readIfExists(target: string): string | null {
  return fs.existsSync(target) ? toLf(fs.readFileSync(target, 'utf8')) : null;
}

export function managedRegion(kind: ManagedKind, content: string | null | undefined): string | null {
  if (typeof content !== 'string') return null;
  return (kind === 'agents' ? extractAgentsManagedDocument(content) : extractManagedDocument(content)) || null;
}

export function regionHash(region: string | null): string | null {
  return region ? sha256(region) : null;
}

/**
 * agctx.project.json의 관리 파일 경로가 프로젝트 안의 상대 경로인가. 기록은 커밋된 파일이라 누구나 고칠
 * 수 있으므로, 절대 경로나 `..`로 프로젝트 밖을 가리키는 경로로 파일을 읽거나 지우지 않는다.
 */
export function isProjectRelativePath(relativePath: string): boolean {
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  )
    return false;
  return relativePath.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

export function assertManagedPaths(projectConfig: ProjectConfig, targetDir: string): void {
  const unsafe = Object.keys(projectConfig.managedHashes ?? {}).filter(rel => !isProjectRelativePath(rel));
  if (unsafe.length) {
    throw usageError(
      'project.invalid-managed-path',
      _('error.project.invalid-managed-path', { paths: unsafe.join(', ') }),
      _('hint.project.invalid-managed-path', { file: path.join(targetDir, 'agctx.project.json') })
    );
  }
}

function recordedHashFor(projectConfig: ProjectConfig, relativePath: string): string | null {
  return projectConfig.managedHashes?.[relativePath] ?? null;
}

/**
 * 알 수 있을 때, agctx가 마지막으로 쓴 관리 영역: 기록된 해시와 맞는 base 파일, 또는 다시 만들어도
 * 해시가 같은 영역.
 */
function knownBase(
  targetDir: string,
  relativePath: string,
  recordedHash: string,
  nextRegion: string | null
): string | null {
  const stored = readIfExists(path.join(targetDir, baseFilePath(relativePath)));
  if (stored !== null && sha256(parseBase(stored)) === recordedHash) return parseBase(stored);
  if (nextRegion && sha256(nextRegion) === recordedHash) return nextRegion;
  return null;
}

export interface PlanInput {
  packageRoot: string;
  targetDir: string;
  projectName: string;
  profileName: string;
  /** 이 프로젝트용으로 렌더링한 프로필 AGENTS.md. */
  renderedAgents: string;
  /** 해석한 agctx.project.json. */
  projectConfig: ProjectConfig;
  /** agctx.project.json에 쓴 프로필 버전. */
  record: VersionRecord;
  /** 이번에 연결 파일을 쓸 에이전트. */
  agents: readonly AgentId[];
  /** agctx.project.json의 `agents`에 쓸 목록. null이면 키를 빼서 지원 에이전트 전부를 뜻한다. */
  recordAgents: readonly AgentId[] | null;
}

/**
 * @param overrides - 디스크의 파일 대신 계획에 쓸, 이미 푼 내용
 */
export function planProject(
  {
    packageRoot,
    targetDir,
    projectName,
    profileName,
    renderedAgents,
    projectConfig,
    record,
    agents,
    recordAgents
  }: PlanInput,
  overrides: Map<string, string | null> = new Map()
): ProjectPlan {
  assertManagedPaths(projectConfig, targetDir);
  const files: PlannedFile[] = [];
  const describe = (
    relativePath: string,
    kind: ManagedKind,
    regenerate: (existing: string | null) => string,
    remove = false
  ) => {
    const overridden = overrides.has(relativePath);
    const existing = overridden
      ? (overrides.get(relativePath) ?? null)
      : readIfExists(path.join(targetDir, relativePath));
    // 빼는 파일이 이미 없으면 지울 것도 지킬 것도 없다. 기록만 사라진다.
    if (remove && existing === null) return;
    if (!remove && apmRegenerates(relativePath, existing)) {
      const hint =
        relativePath === 'AGENTS.md' ? 'hint.project.apm-generated.agents' : 'hint.project.apm-generated.claude';
      throw new CliError('project.apm-generated', _('error.project.apm-generated', { file: relativePath }), {
        exitCode: EXIT.conflict,
        hint: _(hint, { file: relativePath })
      });
    }
    const regenerated = regenerate(existing);
    const currentRegion = managedRegion(kind, existing);
    const nextRegion = remove ? null : managedRegion(kind, regenerated);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, relativePath);
    // 해시가 달라도 아무도 관리 영역을 고치지 않았다는 뜻인 경우가 둘 있다. 둘 다 저장할 때 Markdown을
    // 다시 포맷하는 편집기에서 생긴다. 관리 영역에 이번 실행이 쓸 내용이 이미 있거나, agctx가 마지막으로
    // 쓴 것과 포매터가 만드는 방식으로만 다르다. 어느 쪽도 잃을 것이 없다.
    const base = recordedHash ? knownBase(targetDir, relativePath, recordedHash, nextRegion) : null;
    const settled =
      currentRegion !== null &&
      (currentRegion === nextRegion ||
        (base !== null && formatterNormalized(base) === formatterNormalized(currentRegion)));
    // 빼는 파일에서 사람이 이미 블록을 지웠으면 지울 것이 없으므로 충돌이 아니다.
    const conflict =
      recordedHash && !settled && !(remove && currentRegion === null) && regionHash(currentRegion) !== recordedHash
        ? { kind: existing === null ? ('missing' as const) : ('edited' as const), base }
        : null;
    files.push({
      rel: relativePath,
      kind,
      target: path.join(targetDir, relativePath),
      existing,
      regenerated,
      currentRegion,
      nextRegion,
      conflict,
      remove
    });
  };
  // 이 파일을 agctx가 관리해 왔는가. 관리한 적 없는 파일은 에이전트를 빼도 건드리지 않는다.
  const managedBefore = (relativePath: string) =>
    recordedHashFor(projectConfig, relativePath) !== null || overrides.has(relativePath);
  const removeDescribed = (relativePath: string, template: string) =>
    describe(relativePath, 'pointer', existing => withoutManagedBlock(existing ?? '', template), true);

  describe('AGENTS.md', 'agents', existing => mergeAgentsMd(renderedAgents, existing));
  for (const [source, relativePath, agent] of POINTER_TEMPLATES) {
    const template = toLf(fs.readFileSync(path.join(packageRoot, source), 'utf8')).replaceAll(
      '{{PROJECT_NAME}}',
      projectName
    );
    if (agents.includes(agent)) describe(relativePath, 'pointer', existing => mergeManagedDocument(template, existing));
    else if (managedBefore(relativePath)) removeDescribed(relativePath, template);
  }

  // 중첩된 AGENTS.md마다 Claude Code용 연결을 만든다. 사람이 쓴 CLAUDE.md는 건드리지 않는다.
  const warnings: string[] = [];
  const linkTemplate = toLf(fs.readFileSync(path.join(packageRoot, LINK_TEMPLATE), 'utf8'));
  const linked = new Set<string>();
  const nestedLinks = agents.includes('claude') ? nestedAgentsFiles(targetDir) : [];
  if (!agents.includes('claude')) {
    for (const rel of Object.keys(projectConfig.managedHashes ?? {})) {
      if (rel.endsWith('/CLAUDE.md')) {
        removeDescribed(rel, linkTemplate);
        linked.add(rel);
      }
    }
  }
  for (const agentsRel of nestedLinks) {
    const folder = agentsRel.slice(0, -'/AGENTS.md'.length);
    const linkRel = `${folder}/CLAUDE.md`;
    const owned = recordedHashFor(projectConfig, linkRel) !== null || overrides.has(linkRel);
    const person = owned ? null : personLink(targetDir, folder);
    if (!person) {
      describe(linkRel, 'pointer', existing => mergeManagedDocument(linkTemplate, existing));
      linked.add(linkRel);
    } else if (!linksTo(path.join(targetDir, person), path.join(targetDir, agentsRel))) {
      warnings.push(_('plan.warn.link-no-import', { file: person, agents: agentsRel }));
    }
  }
  for (const rel of Object.keys(projectConfig.managedHashes ?? {})) {
    if (rel.endsWith('/CLAUDE.md') && !linked.has(rel)) {
      warnings.push(
        _('plan.warn.link-dropped', { file: rel, agents: `${rel.slice(0, -'CLAUDE.md'.length)}AGENTS.md` })
      );
    }
  }

  const agentsFile = files.find(file => file.rel === 'AGENTS.md');
  if (agentsFile) warnings.push(...agentsLengthWarnings(agentsFile.regenerated, writesCrlf(agentsFile.target)));

  const changes: PlannedChange[] = [];
  const planFile = (relativePath: string, content: string) => {
    const target = path.join(targetDir, relativePath);
    const existing = readIfExists(target);
    changes.push({
      target,
      relativePath,
      content,
      status: existing === null ? 'create' : existing === content ? 'unchanged' : 'update'
    });
  };
  const planRemoval = (relativePath: string) => {
    const target = path.join(targetDir, relativePath);
    if (fs.existsSync(target)) changes.push({ target, relativePath, content: '', status: 'remove' });
  };
  const managedHashes: Record<string, string> = {};
  for (const file of files) {
    if (file.remove && file.regenerated === '') planRemoval(file.rel);
    else planFile(file.rel, file.regenerated);
    if (file.nextRegion) managedHashes[file.rel] = sha256(file.nextRegion);
  }
  for (const file of files) {
    if (file.nextRegion) planFile(baseFilePath(file.rel), serializeBase(file.nextRegion));
    else if (file.remove) planRemoval(baseFilePath(file.rel));
  }
  // 이미 사람이 지운 빼는 파일도 base 사본은 남아 있을 수 있다.
  for (const rel of Object.keys(projectConfig.managedHashes ?? {})) {
    if (!files.some(file => file.rel === rel) && linked.has(rel)) planRemoval(baseFilePath(rel));
  }
  for (const [, relativePath, agent] of POINTER_TEMPLATES) {
    if (!agents.includes(agent) && managedBefore(relativePath) && !files.some(file => file.rel === relativePath))
      planRemoval(baseFilePath(relativePath));
  }
  planFile(AGCTX_GITIGNORE, 'backups/\n');
  const {
    schemaVersion: _schemaVersion,
    profile: _profile,
    projectName: _projectName,
    source: _source,
    pin: _pin,
    uncommitted: _uncommitted,
    managedHashes: _managedHashes,
    agents: _agents,
    ...kept
  } = projectConfig;
  const version = {
    ...(record.source ? { source: record.source } : {}),
    ...(record.pin ? { pin: true } : {}),
    ...(record.uncommitted ? { uncommitted: true } : {})
  };
  planFile(
    'agctx.project.json',
    JSON.stringify(
      {
        ...kept,
        schemaVersion: 2,
        profile: profileName,
        projectName,
        ...(recordAgents ? { agents: recordAgents } : {}),
        ...version,
        managedHashes
      },
      null,
      2
    ) + '\n'
  );

  return {
    files,
    conflicts: files.filter((file): file is ConflictedFile => file.conflict !== null),
    changes,
    warnings
  };
}

/** 바뀐 파일을 모두 쓰고 지울 파일을 지운다. 무엇이든 쓰기 전에 안전하지 않은 대상을 거부한다. */
export function writePlan(changes: readonly PlannedChange[], targetDir: string): PlannedChange[] {
  const changed = changes.filter(change => change.status !== 'unchanged');
  for (const change of changed) assertSafeTextTarget(change.target, targetDir);
  for (const change of changed) {
    if (change.status === 'remove') removeWithEmptyParents(change.target, targetDir);
    else writeTextAtomic(change.target, change.content);
  }
  return changed;
}

/** 파일을 지우고, 그래서 비게 된 폴더를 프로젝트 폴더 바로 아래까지 지운다. 다른 것이 든 폴더는 둔다. */
function removeWithEmptyParents(target: string, targetDir: string): void {
  fs.rmSync(target, { force: true });
  const root = path.resolve(targetDir);
  for (let dir = path.dirname(path.resolve(target)); dir.startsWith(`${root}${path.sep}`); dir = path.dirname(dir)) {
    try {
      if (fs.readdirSync(dir).length) return;
      fs.rmdirSync(dir);
    } catch {
      return;
    }
  }
}
