/**
 * JSON 설정 파일 안에서 agctx가 소유한 서버 항목만 바꾼다. 소유는 파일 안의 표지가 아니라
 * agctx.project.json에 기록한 서버 이름으로 정한다. JSON에는 주석을 둘 수 없기 때문이다.
 * 사람이 넣은 서버와 파일의 다른 키는 순서까지 그대로 둔다.
 */

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 객체 키를 깊이까지 정렬한 값. 같은 값이면 늘 같은 글이 된다. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (isJsonObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sorted(value[key])])
    );
  return value;
}

/** 키를 정렬하고 두 칸 들여쓴 JSON. 소유 영역의 해시와 base 사본에 쓰고, 충돌 diff로도 보여 준다. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sorted(value), null, 2);
}

/** 파일이 쓰던 들여쓰기. 처음 들여쓴 줄에서 읽고, 없으면 2칸. */
export function detectIndent(text: string): string | number {
  const match = text.match(/^[ \t]+(?=\S)/m);
  return match ? match[0] : 2;
}

/**
 * `section` 아래에서 소유한 이름의 항목만 모은 영역. 소유한 항목이 하나도 없으면 null이다.
 * 이 영역이 관리 영역의 해시와 base 사본이 된다.
 */
export function ownedRegion(document: JsonObject | null, section: string, owned: readonly string[]): string | null {
  const entries = isJsonObject(document?.[section]) ? (document[section] as JsonObject) : {};
  const picked = Object.fromEntries(
    owned.filter(name => Object.hasOwn(entries, name)).map(name => [name, entries[name]])
  );
  return Object.keys(picked).length ? canonicalJson(picked) : null;
}

/**
 * 소유했던 항목을 빼고 새 항목을 넣은 문서. 사람이 넣은 항목은 제자리에 두고, 새로 넣는 항목은
 * 원래 있던 자리(소유한 이름)나 끝에 둔다. 섹션이 비고 다른 키도 없으면 null이라 파일을 지운다는 뜻이다.
 */
export function mergeOwned(
  document: JsonObject | null,
  section: string,
  owned: readonly string[],
  next: JsonObject
): JsonObject | null {
  const base: JsonObject = document ? { ...document } : {};
  const current = isJsonObject(base[section]) ? (base[section] as JsonObject) : {};
  const merged: JsonObject = {};
  for (const [name, value] of Object.entries(current)) {
    if (Object.hasOwn(next, name)) merged[name] = next[name];
    else if (!owned.includes(name)) merged[name] = value;
  }
  for (const [name, value] of Object.entries(next)) if (!Object.hasOwn(merged, name)) merged[name] = value;
  if (!Object.keys(merged).length) {
    delete base[section];
    return Object.keys(base).length ? base : null;
  }
  base[section] = merged;
  return base;
}
