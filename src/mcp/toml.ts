/**
 * MCP 서버 표를 TOML 글로 쓰는 최소한의 도우미. agctx가 TOML 파일 전체를 해석하지는 않는다.
 * 관리 블록 안에 쓸 표만 만들고, 블록 밖의 사람이 쓴 표와 이름이 겹치는지만 찾는다.
 */

/** TOML 기본 문자열. JSON 문자열의 이스케이프는 TOML 기본 문자열에서도 같은 뜻이다. */
export function tomlString(value: string): string {
  return JSON.stringify(value).replace(/\u007f/g, '\\u007F');
}

/** 따옴표로 감싼 키. 어떤 이름이든 그대로 키가 된다. */
export function tomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : tomlString(key);
}

export function tomlArray(values: readonly string[]): string {
  return `[${values.map(tomlString).join(', ')}]`;
}

export function tomlInlineTable(values: Readonly<Record<string, string>>): string {
  const entries = Object.entries(values);
  return entries.length
    ? `{ ${entries.map(([key, value]) => `${tomlKey(key)} = ${tomlString(value)}`).join(', ')} }`
    : '{}';
}

/** 점으로 이은 TOML 키를 조각으로 나눈다. 따옴표 안의 점은 나누지 않는다. 읽을 수 없으면 null. */
export function keyPath(text: string): string[] | null {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest) {
    let match: RegExpMatchArray | null;
    if ((match = rest.match(/^"((?:[^"\\]|\\.)*)"/))) {
      try {
        parts.push(JSON.parse(`"${match[1]}"`) as string);
      } catch {
        return null;
      }
    } else if ((match = rest.match(/^'([^']*)'/))) parts.push(match[1]);
    else if ((match = rest.match(/^[A-Za-z0-9_-]+/))) parts.push(match[0]);
    else return null;
    rest = rest.slice(match[0].length).trim();
    if (!rest) break;
    if (!rest.startsWith('.')) return null;
    rest = rest.slice(1).trim();
  }
  return parts.length ? parts : null;
}

/**
 * `=` 앞의 키 글. 따옴표 안의 `=`는 건너뛴다. 정규식 대신 한 번 훑어서, 따옴표가 많이 반복된 줄에서도
 * 시간이 줄 길이에 비례한다. `=`가 없으면 null.
 */
function keyBeforeEquals(line: string): string | null {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote === '"' && char === '\\') index++;
    else if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '=') return line.slice(0, index);
  }
  return null;
}

/**
 * 파일이 `<table>.<이름>` 아래에 무엇이든 정의한 이름들. 표 머리(`[mcp_servers.x]`, `[mcp_servers.x.env]`,
 * 따옴표 이름), 점 표기 키(`mcp_servers.x.command = …`), `[mcp_servers]` 아래의 `x = { … }`와 `x.command = …`를
 * 모두 본다. 관리 블록 밖에 같은 서버가 있으면 TOML이 같은 키를 두 번 정의한 것이 되어 에이전트가 파일
 * 전체를 읽지 못하므로 쓰기 전에 찾는다. agctx가 TOML 파일 전체를 해석하지는 않으므로 줄 단위로 본다.
 */
export function definedServers(text: string, table: string): string[] {
  const names = new Set<string>();
  let current: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = line.match(/^\[(?!\[)(.*)\](?:\s*#.*)?$/);
    if (header) {
      current = keyPath(header[1]) ?? [];
      if (current[0] === table && current.length >= 2) names.add(current[1]);
      continue;
    }
    if (line.startsWith('[[')) {
      current = [];
      continue;
    }
    const left = keyBeforeEquals(line);
    if (left === null) continue;
    const key = keyPath(left);
    if (!key) continue;
    const full = [...current, ...key];
    if (full[0] === table && full.length >= 2) names.add(full[1]);
  }
  return [...names];
}
