import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import {
  hookCommands,
  type HookDefinition,
  type ProfileArtifacts,
  type SkillDefinition
} from '../artifacts/definitions.ts';
import {
  hooksOwnership,
  hooksRegion,
  mergeHooks,
  nextHooksRegion,
  validHooksDocument,
  type HookGroups
} from '../artifacts/hooks-merge.ts';
import {
  HOOK_TARGETS,
  isHooksFile,
  isOwnedArtifactFile,
  SKILL_ROOTS,
  SUBAGENT_TARGETS,
  UNVERIFIED_AGENTS
} from '../artifacts/targets.ts';
import { detectIndent, isJsonObject, type JsonObject } from '../mcp/json-merge.ts';
import type { AgentId, IncludeKind } from '../shared/agents.ts';
import { usageError } from '../shared/errors.ts';
import type { PlannedFile, ProjectConfig } from '../shared/types.ts';
import { knownBase, readIfExists, recordedHashFor, sha256 } from './base.ts';

/**
 * 프로필의 skills·subagents·hooks를 에이전트마다 저장소에 쓰는 계획(ADR 0046).
 *
 * - skills·subagents: agctx가 쓴 파일은 파일째 agctx의 것이다. 파일 내용이 관리 영역이고, 해시와
 *   원문을 지침 파일처럼 기록한다. 사람이 같은 자리에 둔 파일은 덮어쓰지 않고 멈춘다.
 * - hooks: 사람이 둔 hooks와 같은 파일을 나눠 쓴다. 소유 방식은 `src/artifacts/hooks-merge.ts`에 있다.
 */

export interface ArtifactPlanInput {
  targetDir: string;
  projectConfig: ProjectConfig;
  agents: readonly AgentId[];
  include: readonly IncludeKind[];
  artifacts: ProfileArtifacts;
  adopt: boolean;
  overrides: Map<string, string | null>;
}

/** 에이전트마다 쓸 hook 명령. 적용 계획이 쓰기 전에 보여 준다. */
export interface HookCommand {
  hook: string;
  agent: AgentId;
  event: string;
  matcher: string | null;
  command: string;
}

export interface ArtifactPlan {
  files: PlannedFile[];
  /** hooks 파일마다 agctx가 소유한 항목. agctx.project.json의 `managedKeys`가 된다. */
  managedKeys: Record<string, string[]>;
  warnings: string[];
  /** 사람이 이미 같은 자리에 둔 skill·subagent 파일이나 같은 이름의 hook. 덮어쓰지 않고 멈춘다. */
  clashes: { file: string; names: string[] }[];
  skills: string[];
  subagents: string[];
  hooks: string[];
  hookCommands: HookCommand[];
}

/** hooks 파일에서 agctx가 소유한 항목. 기록이 목록이 아니면 추측하지 않고 멈춘다. */
function ownedKeys(projectConfig: ProjectConfig, rel: string, configPath: string): string[] {
  const keys = projectConfig.managedKeys;
  if (keys === undefined) return [];
  const value = isJsonObject(keys) ? keys[rel] : undefined;
  if (
    !isJsonObject(keys) ||
    (value !== undefined && !(Array.isArray(value) && value.every(item => typeof item === 'string')))
  )
    throw usageError(
      'project.invalid-managed-keys',
      _('error.project.invalid-managed-keys', { file: configPath }),
      _('hint.project.invalid-managed-keys', { file: configPath })
    );
  return (value as string[] | undefined) ?? [];
}

/** hooks 설정 파일의 JSON 객체. 객체가 아니거나 `hooks`의 모양이 다르면 고치지 않고 멈춘다. */
function hooksDocument(text: string, rel: string): JsonObject {
  let parsed: unknown = null;
  let detail = 'not an object';
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error);
  }
  if (isJsonObject(parsed) && !validHooksDocument(parsed)) detail = '"hooks" is not an object of arrays';
  else if (isJsonObject(parsed)) return parsed;
  throw usageError(
    'project.invalid-hooks-file',
    _('error.project.invalid-hooks-file', { file: rel, detail }),
    _('hint.project.invalid-hooks-file', { file: rel })
  );
}

/** agctx.project.json에 기록한 hooks 파일의 지금 소유 영역. `check`가 기록한 해시와 비교한다. */
export function hooksFileRegion(rel: string, content: string | null, projectConfig: ProjectConfig): string | null {
  const target = HOOK_TARGETS.find(entry => entry.rel === rel);
  if (!target || content === null) return null;
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return null;
  }
  return hooksRegion(isJsonObject(document) ? document : null, ownedKeys(projectConfig, rel, ''));
}

/** 파일째 소유하는 파일의 소유 영역은 파일 내용 전체다. 빈 파일(`__init__.py` 등)도 빈 글이라는 영역이다. */
export function ownedFileRegion(content: string | null): string | null {
  return content;
}

export function isArtifactFile(rel: string): boolean {
  return isOwnedArtifactFile(rel) || isHooksFile(rel);
}

interface WholeFile {
  rel: string;
  content: string;
  executable: boolean;
}

/** 폴더 아래 파일의 프로젝트 기준 `/` 경로. 폴더가 없으면 빈 목록. 심볼릭 링크는 따라가지 않는다. */
function filesUnder(targetDir: string, rel: string): string[] {
  const full = path.join(targetDir, ...rel.split('/'));
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(full);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [rel];
  return fs
    .readdirSync(full)
    .sort()
    .flatMap(name => filesUnder(targetDir, `${rel}/${name}`));
}

function skillFiles(skills: readonly SkillDefinition[], root: string): WholeFile[] {
  return skills.flatMap(skill =>
    skill.files.map(file => ({
      rel: `${root}/${skill.name}/${file.path}`,
      content: file.content,
      executable: file.executable
    }))
  );
}

/** 에이전트에게 쓸 matcher 묶음을 이벤트마다 모은 것. hook 이름 순이다. */
function hookGroups(hooks: readonly HookDefinition[], agent: AgentId): HookGroups {
  const byEvent: HookGroups = {};
  for (const hook of hooks)
    for (const [event, entries] of Object.entries(hook.agents[agent] ?? {}))
      byEvent[event] = [...(byEvent[event] ?? []), ...entries];
  return byEvent;
}

export function planArtifactFiles({
  targetDir,
  projectConfig,
  agents,
  include,
  artifacts,
  adopt,
  overrides
}: ArtifactPlanInput): ArtifactPlan {
  const plan: ArtifactPlan = {
    files: [],
    managedKeys: {},
    warnings: [],
    clashes: [],
    skills: [],
    subagents: [],
    hooks: [],
    hookCommands: []
  };
  const configPath = path.join(targetDir, 'agctx.project.json');
  const recorded = Object.keys(projectConfig.managedHashes ?? {});

  // 이번에 파일째 쓸 skills·subagents 파일.
  const wanted = new Map<string, WholeFile>();
  if (include.includes('skills'))
    for (const { root, agents: readers } of SKILL_ROOTS)
      if (readers.some(agent => agents.includes(agent)))
        for (const file of skillFiles(artifacts.skills, root)) wanted.set(file.rel, file);
  if (include.includes('subagents')) {
    for (const target of SUBAGENT_TARGETS) {
      if (!agents.includes(target.agent)) continue;
      for (const definition of artifacts.subagents)
        wanted.set(target.rel(definition.name), {
          rel: target.rel(definition.name),
          content: target.render(definition),
          executable: false
        });
    }
    const dropping = SUBAGENT_TARGETS.filter(target => target.dropsExtraFields && agents.includes(target.agent));
    for (const definition of artifacts.subagents)
      if (definition.extraFields.length && dropping.length)
        plan.warnings.push(
          _('plan.warn.subagent-fields', {
            name: definition.name,
            fields: definition.extraFields.join(', '),
            agents: dropping.map(target => _(`explain.agent.${target.agent}`)).join(', ')
          })
        );
  }
  if (include.includes('skills') && SKILL_ROOTS.some(entry => entry.agents.some(agent => agents.includes(agent))))
    plan.skills = artifacts.skills.map(skill => skill.name);
  if (include.includes('subagents') && SUBAGENT_TARGETS.some(target => agents.includes(target.agent)))
    plan.subagents = artifacts.subagents.map(definition => definition.name);

  // 사람이 이미 같은 skill 폴더나 subagent 파일을 두었으면 멈춘다. 내용이 프로필과 똑같은 파일은 잃을 것이 없으므로 맡는다.
  // agctx가 이미 쓰고 있는 skill 폴더에 사람이 더한 다른 파일은 agctx의 것이 아니므로 그대로 두고 멈추지 않는다.
  const owns = (rel: string) => recorded.includes(rel) || overrides.has(rel);
  const clashing = new Map<string, string[]>();
  const claimed = new Set<string>();
  for (const file of wanted.values()) {
    const skillRoot = SKILL_ROOTS.find(({ root }) => file.rel.startsWith(`${root}/`));
    const unit = skillRoot ? file.rel.split('/').slice(0, 3).join('/') : file.rel;
    if (claimed.has(unit)) continue;
    claimed.add(unit);
    const existingFiles = filesUnder(targetDir, unit);
    const agctxFolder = existingFiles.some(owns);
    for (const existing of existingFiles) {
      if (owns(existing)) continue;
      const ours = wanted.get(existing);
      if (agctxFolder && !ours) continue;
      if (ours && readIfExists(path.join(targetDir, ...existing.split('/'))) === ours.content) continue;
      clashing.set(unit, [...(clashing.get(unit) ?? []), existing]);
    }
  }
  for (const [unit, files] of clashing) plan.clashes.push({ file: unit, names: files });

  const describe = (rel: string, next: string | null, executable: boolean | undefined) => {
    const overridden = overrides.has(rel);
    const existing = overridden ? (overrides.get(rel) ?? null) : readIfExists(path.join(targetDir, ...rel.split('/')));
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, rel);
    if (next === null && existing === null) return;
    const currentRegion = ownedFileRegion(existing);
    const nextRegion = next;
    const remove = next === null;
    const base = recordedHash ? knownBase(targetDir, rel, recordedHash, nextRegion) : null;
    const settled =
      currentRegion !== null && (currentRegion === nextRegion || (base !== null && base === currentRegion));
    const conflict =
      recordedHash &&
      !settled &&
      !(remove && currentRegion === null) &&
      (currentRegion === null ? null : sha256(currentRegion)) !== recordedHash
        ? { kind: existing === null ? ('missing' as const) : ('edited' as const), base }
        : null;
    plan.files.push({
      rel,
      kind: 'file',
      target: path.join(targetDir, rel),
      existing,
      regenerated: next ?? '',
      currentRegion,
      nextRegion,
      conflict,
      remove,
      unmanaged: false,
      ...(executable === undefined ? {} : { executable })
    });
  };
  for (const file of wanted.values()) describe(file.rel, file.content, file.executable);
  for (const rel of [...recorded, ...overrides.keys()])
    if (isOwnedArtifactFile(rel) && !wanted.has(rel) && !plan.files.some(file => file.rel === rel))
      describe(rel, null, undefined);

  // hooks
  const hookDefinitions = include.includes('hooks') ? (artifacts.hooks ?? []) : [];
  if (!include.includes('hooks') && artifacts.hooks?.length) plan.warnings.push(_('plan.warn.hooks-not-included'));
  const unverified = UNVERIFIED_AGENTS.filter(
    agent =>
      agents.includes(agent) &&
      ((include.includes('subagents') && artifacts.subagents.length) ||
        hookDefinitions.some(hook => hook.agents[agent]))
  );
  for (const agent of unverified)
    plan.warnings.push(_('plan.warn.artifacts-unverified', { agent: _(`explain.agent.${agent}`) }));
  for (const { rel, agent } of HOOK_TARGETS) {
    const overridden = overrides.has(rel);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, rel);
    const managedBefore = recordedHashFor(projectConfig, rel) !== null || overridden;
    const selected = agents.includes(agent) && hookDefinitions.some(hook => hook.agents[agent]);
    if (!selected && !managedBefore) continue;
    const owned = ownedKeys(projectConfig, rel, configPath);
    const existing = overridden ? (overrides.get(rel) ?? null) : readIfExists(path.join(targetDir, ...rel.split('/')));
    const document = existing !== null && existing.trim() !== '' ? hooksDocument(existing, rel) : null;
    const next = selected ? hookGroups(hookDefinitions, agent) : {};
    if (selected)
      for (const hook of hookDefinitions)
        for (const [event, entries] of Object.entries(hook.agents[agent] ?? {}))
          for (const command of hookCommands(entries))
            plan.hookCommands.push({ hook: hook.name, agent, event, ...command });
    const currentRegion = hooksRegion(document, owned);
    const nextRegion = nextHooksRegion(next);
    if (!managedBefore && nextRegion === null) continue;
    const merged = mergeHooks(document, owned, next);
    const regenerated = merged ? `${JSON.stringify(merged, null, detectIndent(existing ?? ''))}\n` : '';
    if (nextRegion) plan.managedKeys[rel] = hooksOwnership(next);
    const remove = nextRegion === null;
    const base = recordedHash ? knownBase(targetDir, rel, recordedHash, nextRegion) : null;
    const settled =
      currentRegion !== null && (currentRegion === nextRegion || (base !== null && base === currentRegion));
    const conflict =
      recordedHash &&
      !settled &&
      !(remove && currentRegion === null) &&
      (currentRegion === null ? null : sha256(currentRegion)) !== recordedHash
        ? { kind: existing === null ? ('missing' as const) : ('edited' as const), base }
        : null;
    // 사람이 만든 설정 파일에 처음 쓰는 것은 다른 파일과 같이 `--adopt`로만 한다(ADR 0043).
    const unmanaged =
      !adopt &&
      !remove &&
      !overridden &&
      recordedHash === null &&
      existing !== null &&
      existing.trim() !== '' &&
      currentRegion === null;
    plan.files.push({
      rel,
      kind: 'hooks-json',
      target: path.join(targetDir, rel),
      existing,
      regenerated,
      currentRegion,
      nextRegion,
      conflict,
      remove,
      unmanaged
    });
  }
  plan.hooks = [...new Set(plan.hookCommands.map(command => command.hook))].sort();
  return plan;
}
