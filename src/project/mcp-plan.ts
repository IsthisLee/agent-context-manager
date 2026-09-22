import os from 'node:os';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import {
  canonicalJson,
  detectIndent,
  isJsonObject,
  mergeOwned,
  ownedRegion,
  type JsonObject
} from '../mcp/json-merge.ts';
import type { McpServers } from '../mcp/servers.ts';
import { claudeEntries, codexTables, MCP_TARGETS, type McpTarget, type SkippedServer } from '../mcp/targets.ts';
import { definedServers } from '../mcp/toml.ts';
import type { AgentId } from '../shared/agents.ts';
import { usageError } from '../shared/errors.ts';
import type { PlannedFile, ProjectConfig } from '../shared/types.ts';
import { knownBase, readIfExists, recordedHashFor, sha256 } from './base.ts';

/**
 * 프로필의 MCP 서버를 에이전트마다 프로젝트 설정 파일에 쓰는 계획. 형식마다 agctx가 소유한 영역만
 * 바꾸고, 그 영역의 해시와 원문을 지침 파일처럼 기록한다.
 *
 * - JSON(`.mcp.json`): JSON에는 주석이 없으므로 agctx.project.json의 `managedKeys`에 적은 서버 이름이
 *   소유 영역이다. 사람이 넣은 서버와 다른 키는 순서까지 그대로 둔다.
 * - TOML(`.codex/config.toml`): `# agctx:managed:start`와 `# agctx:managed:end` 주석 사이의 블록이 소유
 *   영역이다. 블록은 파일 끝에 둔다.
 */

export const TOML_START = '# agctx:managed:start';
export const TOML_END = '# agctx:managed:end';
// 표지는 줄 전체여야 한다. 서버 값 안에 같은 글이 들어 있어도 블록 경계로 읽지 않는다.
const TOML_BLOCK = /^# agctx:managed:start\n[\s\S]*?^# agctx:managed:end$/m;
const TOML_BLOCK_WITH_SPACE = /\n*^# agctx:managed:start\n[\s\S]*?^# agctx:managed:end$\n*/m;

export interface McpPlanInput {
  targetDir: string;
  projectConfig: ProjectConfig;
  agents: readonly AgentId[];
  /** 이번에 쓸 서버. 프로필에 `mcp.json`이 없거나 저장소가 MCP를 고르지 않았으면 null이다. */
  servers: McpServers | null;
  adopt: boolean;
  overrides: Map<string, string | null>;
}

export interface McpPlan {
  files: PlannedFile[];
  /** JSON 파일마다 agctx가 소유한 서버 이름. agctx.project.json의 `managedKeys`가 된다. */
  managedKeys: Record<string, string[]>;
  warnings: string[];
  /** 사람이 이미 같은 이름으로 정의한 서버. 덮어쓰지 않고 멈춘다. */
  clashes: { file: string; names: string[] }[];
}

/** JSON 파일에서 agctx가 소유한 서버 이름. 기록이 목록이 아니면 추측하지 않고 멈춘다. */
function ownedNames(projectConfig: ProjectConfig, rel: string, configPath: string): string[] {
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

/** 설정 파일의 JSON 객체. 객체가 아니면 추측해 고치지 않고 멈춘다. */
function jsonObject(text: string, rel: string): JsonObject {
  let parsed: unknown = null;
  let detail = 'not an object';
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error);
  }
  // mcpServers가 객체가 아니면 사람이 넣은 값을 덮어쓰게 되므로 고치지 않고 멈춘다.
  if (isJsonObject(parsed) && parsed.mcpServers !== undefined && !isJsonObject(parsed.mcpServers))
    detail = '"mcpServers" is not an object';
  else if (isJsonObject(parsed)) return parsed;
  throw usageError(
    'project.invalid-mcp-file',
    _('error.project.invalid-mcp-file', { file: rel, detail }),
    _('hint.project.invalid-mcp-file', { file: rel })
  );
}

/** 이 컴퓨터의 Codex 사용자 설정. Codex는 같은 이름의 서버를 프로젝트 설정과 키 하나씩 합친다. */
function codexUserConfig(): string | null {
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  return readIfExists(path.join(home, 'config.toml'));
}

/** 관리 블록. 사람이 읽을 안내 한 줄과 서버 표를 담는다. */
function tomlBlock(text: string): string {
  return `${TOML_START}\n# MCP servers from the agctx profile. Change them in the profile, not here.\n${text}\n${TOML_END}`;
}

export function tomlRegion(content: string | null): string | null {
  return content?.match(TOML_BLOCK)?.[0] ?? null;
}

/** 관리 블록을 바꾸거나 파일 끝에 붙인 글. 블록이 null이면 블록을 빼고, 남는 것이 없으면 빈 글이다. */
function mergeTomlBlock(existing: string | null, block: string | null): string {
  const text = existing ?? '';
  if (block === null) {
    const rest = text.replace(TOML_BLOCK_WITH_SPACE, '\n\n').replace(/^\n+/, '').trimEnd();
    return rest ? `${rest}\n` : '';
  }
  if (TOML_BLOCK.test(text)) return `${text.replace(TOML_BLOCK, () => block).trimEnd()}\n`;
  return text.trim() ? `${text.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

/** agctx.project.json에 기록한 관리 파일에서, 지금 파일의 관리 영역. `check`가 기록한 해시와 비교한다. */
export function mcpRegion(rel: string, content: string | null, projectConfig: ProjectConfig): string | null {
  const target = MCP_TARGETS.find(entry => entry.rel === rel);
  if (!target || content === null) return null;
  if (target.format === 'toml') return tomlRegion(content);
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return null;
  }
  return ownedRegion(isJsonObject(document) ? document : null, 'mcpServers', ownedNames(projectConfig, rel, ''));
}

/** MCP 설정 파일의 관리 영역에 든 서버 이름. 적용 계획이 더하거나 빼는 서버를 보여 줄 때 쓴다. */
export function regionServers(file: PlannedFile, region: string | null): string[] {
  if (region === null) return [];
  if (file.kind === 'mcp-toml') return definedServers(region, 'mcp_servers');
  if (file.kind !== 'mcp-json') return [];
  try {
    const parsed: unknown = JSON.parse(region);
    return isJsonObject(parsed) ? Object.keys(parsed) : [];
  } catch {
    return [];
  }
}

export function isMcpFile(rel: string): boolean {
  return MCP_TARGETS.some(entry => entry.rel === rel);
}

function skipWarnings(target: McpTarget, skipped: readonly SkippedServer[]): string[] {
  return skipped.map(entry =>
    _(`plan.warn.mcp-skip.${entry.reason}`, {
      name: entry.name,
      file: target.rel,
      agent: _(`explain.agent.${target.agent}`)
    })
  );
}

export function planMcpFiles({ targetDir, projectConfig, agents, servers, adopt, overrides }: McpPlanInput): McpPlan {
  const plan: McpPlan = { files: [], managedKeys: {}, warnings: [], clashes: [] };
  const configPath = path.join(targetDir, 'agctx.project.json');
  for (const target of MCP_TARGETS) {
    const { rel } = target;
    const overridden = overrides.has(rel);
    const recordedHash = overridden ? null : recordedHashFor(projectConfig, rel);
    const owned = target.format === 'json' ? ownedNames(projectConfig, rel, configPath) : [];
    const selected = servers !== null && agents.includes(target.agent);
    const managedBefore = recordedHashFor(projectConfig, rel) !== null || overridden;
    if (!selected && !managedBefore) continue;
    const existing = overridden ? (overrides.get(rel) ?? null) : readIfExists(path.join(targetDir, rel));

    let regenerated: string;
    let currentRegion: string | null;
    let nextRegion: string | null;
    if (target.format === 'json') {
      const document = existing !== null && existing.trim() !== '' ? jsonObject(existing, rel) : null;
      const next = selected && servers ? claudeEntries(servers) : {};
      const current = isJsonObject(document?.mcpServers) ? (document.mcpServers as JsonObject) : {};
      const taken = Object.keys(next).filter(name => Object.hasOwn(current, name) && !owned.includes(name));
      if (taken.length) plan.clashes.push({ file: rel, names: taken });
      currentRegion = ownedRegion(document, 'mcpServers', owned);
      nextRegion = Object.keys(next).length ? canonicalJson(next) : null;
      const merged = mergeOwned(document, 'mcpServers', owned, next);
      regenerated = merged ? `${JSON.stringify(merged, null, detectIndent(existing ?? ''))}\n` : '';
      if (nextRegion) plan.managedKeys[rel] = Object.keys(next).sort();
    } else {
      const tables = selected && servers ? codexTables(servers) : { names: [], text: '', skipped: [] };
      plan.warnings.push(...skipWarnings(target, tables.skipped));
      const outside = (existing ?? '').replace(TOML_BLOCK, '');
      const taken = tables.names.filter(name => definedServers(outside, 'mcp_servers').includes(name));
      if (taken.length) plan.clashes.push({ file: rel, names: taken });
      currentRegion = tomlRegion(existing);
      nextRegion = tables.names.length ? tomlBlock(tables.text) : null;
      regenerated = mergeTomlBlock(existing, nextRegion);
      // 블록 뒤에 표 머리 없이 적은 키는 TOML 규칙상 블록의 마지막 서버 표에 붙는다.
      const after = existing?.match(/^# agctx:managed:end$([\s\S]*)/m)?.[1] ?? '';
      const firstLine = after.split('\n').find(line => line.trim() && !line.trim().startsWith('#'));
      if (firstLine && !firstLine.trim().startsWith('['))
        plan.warnings.push(_('plan.warn.mcp-after-block', { file: rel }));
      const personal = codexUserConfig();
      const shared = personal
        ? tables.names.filter(name => definedServers(personal, 'mcp_servers').includes(name))
        : [];
      if (shared.length) plan.warnings.push(_('plan.warn.mcp-codex-user', { servers: shared.join(', '), file: rel }));
    }
    // 관리한 적 없는 파일에 쓸 것이 없으면 그 파일은 사람의 것이라 건드리지 않는다.
    if (!managedBefore && nextRegion === null) continue;

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
    // 사람이 만든 설정 파일에 처음 쓰는 것은 다른 파일과 같이 `--adopt`로만 한다.
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
      kind: target.format === 'json' ? 'mcp-json' : 'mcp-toml',
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
  return plan;
}
