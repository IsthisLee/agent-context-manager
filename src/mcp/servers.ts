import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';

/**
 * 프로필이 담는 MCP 서버 목록. 프로필 폴더의 `mcp.json`에 도구 중립 형식으로 적고, 적용할 때
 * 에이전트마다 자기 설정 형식으로 옮겨 쓴다. 에이전트가 이해하지 못할 필드를 조용히 버리지 않도록,
 * 아는 필드만 받고 나머지는 사용법 오류로 멈춘다.
 *
 * ```json
 * { "servers": {
 *   "issues": { "command": "npx", "args": ["-y", "@acme/issues-mcp"], "env": { "ISSUES_TOKEN": "${ISSUES_TOKEN}" } },
 *   "docs": { "url": "https://mcp.acme.dev/docs", "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" } }
 * } }
 * ```
 */

export const PROFILE_MCP_FILE = 'mcp.json';

/** 로컬에서 실행하는 서버(stdio). */
export interface StdioServer {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** 원격 서버(HTTP). */
export interface HttpServer {
  url: string;
  headers: Record<string, string>;
}

export type McpServer = StdioServer | HttpServer;
export type McpServers = Record<string, McpServer>;

const SERVER_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const STDIO_FIELDS = ['command', 'args', 'env'];
const HTTP_FIELDS = ['url', 'headers'];

export function isHttpServer(server: McpServer): server is HttpServer {
  return 'url' in server;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (!entries.every(([key, item]) => key !== '' && typeof item === 'string')) return null;
  return Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) as Record<string, string>;
}

/**
 * `mcp.json`을 읽어 이름 순으로 정리한 서버 목록을 돌려준다. 형식이 틀리면 어디가 틀렸는지 말하는
 * 사용법 오류로 멈춘다.
 * @param source - 오류 문구에 보여 줄 파일 위치
 */
export function parseMcpServers(text: string, source: string): McpServers {
  const fail = (detail: string) =>
    usageError('profile.invalid-mcp', _('error.profile.invalid-mcp', { file: source, detail }), _('hint.profile.mcp'));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw fail(error instanceof Error ? error.message : String(error));
  }
  if (!isRecord(parsed) || !isRecord(parsed.servers)) throw fail('"servers" must be an object');
  const extra = Object.keys(parsed).filter(key => key !== 'servers');
  if (extra.length) throw fail(`unknown field ${extra.map(key => JSON.stringify(key)).join(', ')}`);

  // 짝 없는 서로게이트는 JSON으로는 쓸 수 있어도 TOML 문자열이 될 수 없어 Codex가 파일 전체를 읽지 못한다.
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : isRecord(value)
          ? Object.entries(value).flatMap(([key, item]) => [key, ...strings(item)])
          : [];
  if (strings(parsed).some(text => LONE_SURROGATE.test(text))) throw fail('a string has an unpaired surrogate');
  const servers: McpServers = {};
  for (const name of Object.keys(parsed.servers).sort()) {
    const raw = parsed.servers[name];
    if (!SERVER_NAME.test(name)) throw fail(`server name ${JSON.stringify(name)} must be 1-64 letters, digits, - or _`);
    if (!isRecord(raw)) throw fail(`server ${name} must be an object`);
    const http = 'url' in raw;
    if (http === 'command' in raw) throw fail(`server ${name} needs exactly one of "command" or "url"`);
    const allowed = http ? HTTP_FIELDS : STDIO_FIELDS;
    const unknown = Object.keys(raw).filter(key => !allowed.includes(key));
    if (unknown.length)
      throw fail(`server ${name} has unknown field ${unknown.map(key => JSON.stringify(key)).join(', ')}`);
    if (http) {
      const headers = stringMap(raw.headers);
      if (typeof raw.url !== 'string' || !/^https?:\/\/\S+$/.test(raw.url))
        throw fail(`server ${name}: "url" must be an http or https URL`);
      if (!headers) throw fail(`server ${name}: "headers" must map names to strings`);
      servers[name] = { url: raw.url, headers };
    } else {
      const env = stringMap(raw.env);
      if (typeof raw.command !== 'string' || raw.command.trim() === '')
        throw fail(`server ${name}: "command" must be a non-empty string`);
      if (raw.args !== undefined && !(Array.isArray(raw.args) && raw.args.every(arg => typeof arg === 'string')))
        throw fail(`server ${name}: "args" must be a list of strings`);
      if (!env) throw fail(`server ${name}: "env" must map names to strings`);
      servers[name] = { command: raw.command, args: (raw.args as string[] | undefined) ?? [], env };
    }
  }
  return servers;
}
