import { _ } from '../i18n/index.ts';
import { usageError } from './errors.ts';

/**
 * agctx가 지원하는 에이전트와, 사용자가 고른 에이전트 목록을 해석하는 곳. `explain`·`verify`의
 * `--agent`와 `profile apply --agent`, `agctx.project.json`의 `agents`가 같은 이름과 순서를 쓴다.
 */

export type AgentId = 'codex' | 'claude' | 'antigravity';
export const AGENT_IDS: readonly AgentId[] = ['codex', 'claude', 'antigravity'];

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value);
}

/** 등록 순서로 줄이고 겹친 이름을 뺀다. 기록이 고른 순서에 따라 달라지지 않게 한다. */
export function canonicalAgents(agents: readonly AgentId[]): AgentId[] {
  return AGENT_IDS.filter(agent => agents.includes(agent));
}

/** `--agent` 값: 쉼표로 여러 개, 또는 `all`. 비었거나 모르는 이름이면 사용법 오류다. */
export function parseAgents(value: string | null): AgentId[] {
  if (!value || value === 'all') return [...AGENT_IDS];
  const agents = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const unknown = agents.filter(agent => !isAgentId(agent));
  if (unknown.length || !agents.length) {
    throw usageError(
      'explain.unknown-agent',
      _('error.explain.unknown-agent', { agent: unknown.join(', ') || value }),
      _('hint.explain.agents')
    );
  }
  return agents as AgentId[];
}

/**
 * `agctx.project.json`의 `agents`가 고른 에이전트. 기록이 없으면 지원하는 에이전트 전부다. 기록이
 * 있는데 목록이 아니거나, 비었거나, 모르는 이름이 있으면 추측하지 않고 사용법 오류로 멈춘다.
 */
export function recordedAgents(value: unknown, file: string): AgentId[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || !value.length || !value.every(isAgentId)) {
    throw usageError(
      'project.invalid-agents',
      _('error.project.invalid-agents', { file, value: JSON.stringify(value) }),
      _('hint.project.invalid-agents', { file })
    );
  }
  return canonicalAgents(value);
}
