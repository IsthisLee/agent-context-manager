import fs from 'node:fs';
import path from 'node:path';
import { explainPath, projectRoot, type AgentExplanation, type AgentId, type ExplainedFile } from '../explain.ts';
import { PROJECT_CONFIG_FILE, readProjectConfig } from '../profile/apply.ts';
import { recordedAgents } from '../shared/agents.ts';
import { EXIT, toCliError, worstExitCode } from '../shared/errors.ts';
import { claudeSessionEvidence, codexReceived, codexSessionEvidence } from './evidence.ts';
import { probeAgent } from './probe.ts';

/**
 * `agctx verify`: 각 에이전트가 `explain`이 읽으리라 예상한 프로젝트 지침 파일을 실제로 받았는가?
 * 증거는 에이전트의 세션 기록에서, `--probe`를 주면 probe에서 온다. 전달되지 않은 파일이 있으면 4로 끝난다.
 */

/** `not-selected`: 이 저장소가 고르지 않았고 `--agent`로 따로 지정하지도 않아 확인하지 않은 에이전트. */
export type VerifyStatus = 'pass' | 'fail' | 'no-evidence' | 'error' | 'not-selected';

export interface AgentVerification {
  agent: AgentId;
  status: VerifyStatus;
  evidence: 'session-log' | 'probe' | 'none';
  source: string | null;
  exitCode: number;
  expected: string[];
  /** 전달된 예상 파일과, 전달된 조건부·필요 시 파일. */
  delivered: string[];
  missing: string[];
  /** 세션이 시작한 뒤에 바뀌어서 기록으로는 알 수 없는 파일. */
  stale: string[];
  error: { code: string; message: string; hint: string | null } | null;
}

export interface Verification {
  path: string;
  root: string;
  agents: AgentVerification[];
  exitCode: number;
}

function judged(
  base: AgentVerification,
  expected: ExplainedFile[],
  optional: ExplainedFile[],
  received: (file: ExplainedFile) => boolean
): AgentVerification {
  const delivered = [...expected, ...optional].filter(received).map(file => file.path);
  const missing = expected.filter(file => !received(file)).map(file => file.path);
  return {
    ...base,
    delivered,
    missing,
    status: missing.length ? 'fail' : 'pass',
    exitCode: missing.length ? EXIT.deliveryMissing : EXIT.ok
  };
}

function fromSessionLog(
  explanation: AgentExplanation,
  startDir: string,
  base: AgentVerification,
  expected: ExplainedFile[],
  optional: ExplainedFile[]
): AgentVerification {
  const evidence =
    explanation.agent === 'codex'
      ? codexSessionEvidence(startDir)
      : explanation.agent === 'claude'
        ? claudeSessionEvidence(startDir)
        : null;
  if (!evidence) return base;
  const stale = expected
    .filter(file => fs.statSync(file.absolutePath).mtimeMs > evidence.startedAt)
    .map(file => file.path);
  const found = { ...base, evidence: 'session-log' as const, source: evidence.source };
  if (stale.length) return { ...found, stale };
  if ('text' in evidence)
    return judged(found, expected, optional, file =>
      codexReceived(fs.readFileSync(file.absolutePath, 'utf8'), evidence.text)
    );
  return judged(found, expected, optional, file => evidence.loaded.has(fs.realpathSync(file.absolutePath)));
}

/**
 * verify가 실제로 확인할 에이전트. `--agent`로 이름을 대지 않았으면 저장소가 agctx.project.json에서
 * 고른 에이전트만 확인한다. probe 확인 질문이 확인하지 않을 에이전트의 비용까지 말하지 않게 한다.
 */
export function agentsToVerify(requested: string, agents: readonly AgentId[], named: boolean): AgentId[] {
  if (named) return [...agents];
  const target = fs.existsSync(requested) && fs.statSync(requested).isFile() ? path.dirname(requested) : requested;
  if (!fs.existsSync(target)) return [...agents];
  const root = projectRoot(fs.realpathSync(target));
  const configPath = path.join(root, PROJECT_CONFIG_FILE);
  const chosen = recordedAgents(readProjectConfig(configPath).agents, configPath);
  return chosen ? agents.filter(agent => chosen.includes(agent)) : [...agents];
}

/**
 * @param options.named - `--agent`로 에이전트를 직접 지정했는지. 지정하면 고르지 않은 에이전트도 확인한다.
 */
export function verifyPath(
  requested: string,
  agents: readonly AgentId[],
  options: { probe: boolean; named?: boolean }
): Verification {
  const explanation = explainPath(requested, agents);
  const results = explanation.agents.map((agent): AgentVerification => {
    const expected = agent.files.filter(file => file.status === 'read' && file.scope === 'project');
    const optional = agent.files.filter(
      file => (file.status === 'conditional' || file.status === 'on-demand') && file.scope === 'project'
    );
    const base: AgentVerification = {
      agent: agent.agent,
      status: 'no-evidence',
      evidence: 'none',
      source: null,
      exitCode: EXIT.ok,
      expected: expected.map(file => file.path),
      delivered: [],
      missing: [],
      stale: [],
      error: null
    };
    // probe는 에이전트 사용량을 쓰므로, 저장소가 고르지 않은 에이전트는 이름으로 부탁할 때만 확인한다.
    if (!agent.selected && !options.named) return { ...base, status: 'not-selected' };
    if (!options.probe) return fromSessionLog(agent, explanation.path, base, expected, optional);
    try {
      const probe = probeAgent(agent, explanation.root, explanation.path);
      return judged({ ...base, evidence: 'probe', source: probe.command }, expected, optional, file =>
        probe.received.has(file.path)
      );
    } catch (error) {
      const cliError = toCliError(error);
      return {
        ...base,
        evidence: 'probe',
        status: 'error',
        exitCode: cliError.exitCode,
        error: { code: cliError.code, message: cliError.message, hint: cliError.hint }
      };
    }
  });
  return {
    path: explanation.path,
    root: explanation.root,
    agents: results,
    exitCode: worstExitCode(results.map(result => result.exitCode))
  };
}
