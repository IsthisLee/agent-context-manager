import type { AgentId } from '../shared/agents.ts';
import type { JsonObject } from './json-merge.ts';
import { isHttpServer, type McpServer, type McpServers } from './servers.ts';
import { tomlArray, tomlInlineTable, tomlKey, tomlString } from './toml.ts';

/**
 * 프로필의 MCP 서버 목록을 에이전트마다 자기 프로젝트 설정 파일 형식으로 옮긴다. 위치와 필드의 근거는
 * docs/references.md의 「MCP 서버 설정 위치와 형식」 절이다.
 *
 * - Claude Code: 저장소 루트의 `.mcp.json`(`mcpServers`). `${VAR}`를 스스로 펼친다.
 * - Codex: 신뢰한 프로젝트의 `.codex/config.toml`(`[mcp_servers.<이름>]`). `${VAR}`를 펼치지 않으므로
 *   같은 이름의 환경 변수를 넘기는 경우만 변수 이름을 적는 필드로 옮긴다.
 */

export type McpFormat = 'json' | 'toml';

export interface McpTarget {
  agent: AgentId;
  /** 프로젝트 기준 경로. */
  rel: string;
  format: McpFormat;
}

export const MCP_TARGETS: readonly McpTarget[] = [
  { agent: 'claude', rel: '.mcp.json', format: 'json' },
  { agent: 'codex', rel: '.codex/config.toml', format: 'toml' }
];

/** 옮기지 못한 서버와 그 이유. 그 에이전트의 파일에만 빠지고 다른 에이전트는 그대로 받는다. */
export interface SkippedServer {
  name: string;
  reason:
    | 'codex-renamed-env'
    | 'codex-env-reference'
    | 'codex-url-reference'
    | 'codex-header-reference'
    | 'codex-command-reference';
}

const WHOLE_REFERENCE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
const BEARER_REFERENCE = /^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
const HAS_REFERENCE = /\$\{/;

/** Claude Code `.mcp.json`의 `mcpServers` 항목. Claude Code는 이 항목을 통째로 쓴다. */
export function claudeEntry(server: McpServer): JsonObject {
  if (isHttpServer(server))
    return {
      type: 'http',
      url: server.url,
      ...(Object.keys(server.headers).length ? { headers: server.headers } : {})
    };
  return {
    command: server.command,
    ...(server.args.length ? { args: server.args } : {}),
    ...(Object.keys(server.env).length ? { env: server.env } : {})
  };
}

export function claudeEntries(servers: McpServers): JsonObject {
  return Object.fromEntries(Object.entries(servers).map(([name, server]) => [name, claudeEntry(server)]));
}

/**
 * Codex의 `[mcp_servers.<이름>]` 표 한 개. Codex는 사용자 설정과 키 하나씩 합치므로, 사람이 자기
 * 설정에 둔 값이 섞이지 않도록 목록과 표 키는 비어 있어도 적는다.
 */
function codexTable(name: string, server: McpServer): { text: string } | { skipped: SkippedServer } {
  const lines = [`[mcp_servers.${tomlKey(name)}]`];
  if (isHttpServer(server)) {
    if (HAS_REFERENCE.test(server.url)) return { skipped: { name, reason: 'codex-url-reference' } };
    const fixed: Record<string, string> = {};
    const fromEnv: Record<string, string> = {};
    let bearer: string | null = null;
    for (const [header, value] of Object.entries(server.headers)) {
      const whole = value.match(WHOLE_REFERENCE);
      const token = header.toLowerCase() === 'authorization' ? value.match(BEARER_REFERENCE) : null;
      if (token) bearer = token[1];
      else if (whole) fromEnv[header] = whole[1];
      else if (HAS_REFERENCE.test(value)) return { skipped: { name, reason: 'codex-header-reference' } };
      else fixed[header] = value;
    }
    lines.push(`url = ${tomlString(server.url)}`);
    if (bearer) lines.push(`bearer_token_env_var = ${tomlString(bearer)}`);
    lines.push(`http_headers = ${tomlInlineTable(fixed)}`, `env_http_headers = ${tomlInlineTable(fromEnv)}`);
    return { text: lines.join('\n') };
  }
  if ([server.command, ...server.args].some(value => HAS_REFERENCE.test(value)))
    return { skipped: { name, reason: 'codex-command-reference' } };
  const env: Record<string, string> = {};
  const forwarded: string[] = [];
  for (const [key, value] of Object.entries(server.env)) {
    const whole = value.match(WHOLE_REFERENCE);
    if (whole && whole[1] === key) forwarded.push(key);
    else if (whole) return { skipped: { name, reason: 'codex-renamed-env' } };
    else if (HAS_REFERENCE.test(value)) return { skipped: { name, reason: 'codex-env-reference' } };
    else env[key] = value;
  }
  lines.push(
    `command = ${tomlString(server.command)}`,
    `args = ${tomlArray(server.args)}`,
    `env = ${tomlInlineTable(env)}`,
    `env_vars = ${tomlArray(forwarded)}`
  );
  return { text: lines.join('\n') };
}

/** Codex 관리 블록에 넣을 표들과, 옮기지 못해 뺀 서버. */
export function codexTables(servers: McpServers): { names: string[]; text: string; skipped: SkippedServer[] } {
  const tables: string[] = [];
  const names: string[] = [];
  const skipped: SkippedServer[] = [];
  for (const [name, server] of Object.entries(servers)) {
    const table = codexTable(name, server);
    if ('skipped' in table) skipped.push(table.skipped);
    else {
      tables.push(table.text);
      names.push(name);
    }
  }
  return { names, text: tables.join('\n\n'), skipped };
}

/** 터미널을 조작할 수 있는 제어 문자를 `\u001b`처럼 드러낸 글. 검토할 줄을 가리거나 꾸미지 못하게 한다. */
function visible(text: string): string {
  return [...text]
    .map(char => {
      const code = char.charCodeAt(0);
      const control = code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
      return control ? `\\u${code.toString(16).padStart(4, '0')}` : char;
    })
    .join('');
}

/**
 * 서버를 사람이 검토할 한 줄로. 적용 계획에 보여 준다. 다른 사람의 컴퓨터에서 실행될 명령과 주소를 그대로
 * 보여 주고, 값이 비밀일 수 있는 env와 헤더는 이름만 보여 준다.
 */
export function describeServer(name: string, server: McpServer): string {
  const target = isHttpServer(server) ? server.url : [server.command, ...server.args].join(' ');
  const names = isHttpServer(server) ? Object.keys(server.headers) : Object.keys(server.env);
  const extra = names.length ? `; ${isHttpServer(server) ? 'headers' : 'env'} ${names.join(', ')}` : '';
  return visible(`${name} (${target}${extra})`);
}
