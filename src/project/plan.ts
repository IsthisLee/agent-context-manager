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
import { CliError, EXIT } from '../shared/errors.ts';
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

export const POINTER_TEMPLATES: ReadonlyArray<readonly [source: string, target: string]> = [
  ['templates/CLAUDE.md', 'CLAUDE.md'],
  ['templates/antigravity-rules/agctx.md', '.agents/rules/agctx.md']
];

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
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
}

/**
 * @param overrides - 디스크의 파일 대신 계획에 쓸, 이미 푼 내용
 */
export function planProject(
  { packageRoot, targetDir, projectName, profileName, renderedAgents, projectConfig, record }: PlanInput,
  overrides: Map<string, string | null> = new Map()
): ProjectPlan {
  const files: PlannedFile[] = [];
  const describe = (relativePath: string, kind: ManagedKind, regenerate: (existing: string | null) => string) => {
    const overridden = overrides.has(relativePath);
    const existing = overridden
      ? (overrides.get(relativePath) ?? null)
      : readIfExists(path.join(targetDir, relativePath));
    if (apmRegenerates(relativePath, existing)) {
      const hint =
        relativePath === 'AGENTS.md' ? 'hint.project.apm-generated.agents' : 'hint.project.apm-generated.claude';
      throw new CliError('project.apm-generated', _('error.project.apm-generated', { file: relativePath }), {
        exitCode: EXIT.conflict,
        hint: _(hint, { file: relativePath })
      });
    }
    const regenerated = regenerate(existing);
    const currentRegion = managedRegion(kind, existing);
    const nextRegion = managedRegion(kind, regenerated);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, relativePath);
    // 해시가 달라도 아무도 관리 영역을 고치지 않았다는 뜻인 경우가 둘 있다. 둘 다 저장할 때 Markdown을
    // 다시 포맷하는 편집기에서 생긴다. 관리 영역에 이번 실행이 쓸 내용이 이미 있거나, agctx가 마지막으로
    // 쓴 것과 포매터가 만드는 방식으로만 다르다. 어느 쪽도 잃을 것이 없다.
    const base = recordedHash ? knownBase(targetDir, relativePath, recordedHash, nextRegion) : null;
    const settled =
      currentRegion !== null &&
      (currentRegion === nextRegion ||
        (base !== null && formatterNormalized(base) === formatterNormalized(currentRegion)));
    const conflict =
      recordedHash && !settled && regionHash(currentRegion) !== recordedHash
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
      conflict
    });
  };

  describe('AGENTS.md', 'agents', existing => mergeAgentsMd(renderedAgents, existing));
  for (const [source, relativePath] of POINTER_TEMPLATES) {
    const template = toLf(fs.readFileSync(path.join(packageRoot, source), 'utf8')).replaceAll(
      '{{PROJECT_NAME}}',
      projectName
    );
    describe(relativePath, 'pointer', existing => mergeManagedDocument(template, existing));
  }

  // 중첩된 AGENTS.md마다 Claude Code용 연결을 만든다. 사람이 쓴 CLAUDE.md는 건드리지 않는다.
  const warnings: string[] = [];
  const linkTemplate = toLf(fs.readFileSync(path.join(packageRoot, LINK_TEMPLATE), 'utf8'));
  const linked = new Set<string>();
  for (const agentsRel of nestedAgentsFiles(targetDir)) {
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
  const managedHashes: Record<string, string> = {};
  for (const file of files) {
    planFile(file.rel, file.regenerated);
    if (file.nextRegion) managedHashes[file.rel] = sha256(file.nextRegion);
  }
  for (const file of files) {
    if (file.nextRegion) planFile(baseFilePath(file.rel), serializeBase(file.nextRegion));
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
      { ...kept, schemaVersion: 2, profile: profileName, projectName, ...version, managedHashes },
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

/** 바뀐 파일을 모두 쓴다. 무엇이든 쓰기 전에 안전하지 않은 대상을 거부한다. */
export function writePlan(changes: readonly PlannedChange[], targetDir: string): PlannedChange[] {
  const changed = changes.filter(change => change.status !== 'unchanged');
  for (const change of changed) assertSafeTextTarget(change.target, targetDir);
  for (const change of changed) writeTextAtomic(change.target, change.content);
  return changed;
}
