import { canonicalJson, isJsonObject, type JsonObject } from '../mcp/json-merge.ts';
import { sha256 } from '../project/base.ts';

/**
 * hooks 설정 파일(Claude Code `.claude/settings.json`, Codex `.codex/hooks.json`) 안에서 agctx가 넣은
 * matcher 묶음만 바꾼다. 사람이 둔 hooks와 파일의 다른 키는 그대로 둔다.
 *
 * matcher 묶음에는 이름이 없다. 그래서 agctx.project.json의 `managedKeys`에 `<이벤트>:<묶음 해시>`를 적고,
 * 그 해시와 같은 묶음을 agctx의 것으로 읽는다. 사람이 그 묶음을 고치면 해시가 달라져 소유 영역에서
 * 빠지므로, 기록한 소유 영역의 해시와 달라져 충돌로 보인다.
 */

/** 이벤트마다 넣을 matcher 묶음. */
export type HookGroups = Record<string, unknown[]>;

/** 묶음 하나의 소유 기록: `<이벤트>:<정렬한 JSON의 SHA-256 앞 16자리>`. */
export function groupKey(event: string, group: unknown): string {
  return `${event}:${sha256(canonicalJson(group)).slice(0, 16)}`;
}

/** 파일의 `hooks`가 없거나, 값이 모두 배열인 객체인가. 아니면 사람이 둔 값을 덮어쓰게 되므로 쓰지 않는다. */
export function validHooksDocument(document: JsonObject): boolean {
  const hooks = document.hooks;
  return hooks === undefined || (isJsonObject(hooks) && Object.values(hooks).every(Array.isArray));
}

/**
 * 이벤트 배열마다 기록한 묶음을 빼고 남은 묶음, 그리고 뺀 묶음. 같은 묶음이 여럿이면 기록한 수만큼만
 * agctx의 것으로 센다.
 */
function splitOwned(hooks: JsonObject, owned: readonly string[]): { kept: JsonObject; picked: HookGroups } {
  const remaining = [...owned];
  const kept: JsonObject = {};
  const picked: HookGroups = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      kept[event] = groups;
      continue;
    }
    const rest = groups.filter(group => {
      const at = remaining.indexOf(groupKey(event, group));
      if (at === -1) return true;
      remaining.splice(at, 1);
      (picked[event] ??= []).push(group);
      return false;
    });
    // agctx가 빼서 빈 배열은 지우고, 사람이 둔 빈 배열은 그대로 둔다.
    if (rest.length || !picked[event]) kept[event] = rest;
  }
  return { kept, picked };
}

/** 소유 영역: agctx가 넣은 묶음을 이벤트별로 모아 정렬한 JSON. 없으면 null. */
export function hooksRegion(document: JsonObject | null, owned: readonly string[]): string | null {
  const hooks = isJsonObject(document?.hooks) ? (document.hooks as JsonObject) : {};
  const { picked } = splitOwned(hooks, owned);
  return Object.keys(picked).length ? canonicalJson(picked) : null;
}

/** 넣을 묶음의 소유 영역. 계획이 기록할 해시와 base 사본이 된다. */
export function nextHooksRegion(next: HookGroups): string | null {
  return Object.keys(next).length ? canonicalJson(next) : null;
}

/** 넣을 묶음의 소유 기록. */
export function hooksOwnership(next: HookGroups): string[] {
  return Object.entries(next)
    .flatMap(([event, groups]) => groups.map(group => groupKey(event, group)))
    .sort();
}

/**
 * agctx가 넣었던 묶음을 빼고 새 묶음을 이벤트 배열의 끝에 넣은 문서. 비게 된 `hooks`는 지우고, 남는
 * 것이 없으면 null이라 파일을 지운다는 뜻이다.
 */
export function mergeHooks(document: JsonObject | null, owned: readonly string[], next: HookGroups): JsonObject | null {
  const base: JsonObject = document ? { ...document } : {};
  const hadHooks = isJsonObject(base.hooks);
  const { kept } = splitOwned(hadHooks ? (base.hooks as JsonObject) : {}, owned);
  for (const [event, groups] of Object.entries(next))
    kept[event] = [...(Array.isArray(kept[event]) ? (kept[event] as unknown[]) : []), ...groups];
  // 사람이 처음부터 비워 둔 `hooks: {}`는 그대로 둔다.
  const emptyByPerson = hadHooks && !Object.keys(base.hooks as JsonObject).length;
  if (Object.keys(kept).length || emptyByPerson) base.hooks = kept;
  else delete base.hooks;
  return Object.keys(base).length ? base : null;
}
