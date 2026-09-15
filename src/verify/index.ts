import fs from 'node:fs';
import { explainPath, type AgentExplanation, type AgentId, type ExplainedFile } from '../explain.ts';
import { EXIT, toCliError, worstExitCode } from '../shared/errors.ts';
import { claudeSessionEvidence, codexReceived, codexSessionEvidence } from './evidence.ts';
import { probeAgent } from './probe.ts';

/**
 * `agctx verify`: did each agent actually receive the project instruction files
 * `explain` expects it to read? Evidence comes from the agents' session logs, or
 * from a probe when `--probe` is given. A file that did not arrive exits with 4.
 */

export type VerifyStatus = 'pass' | 'fail' | 'no-evidence' | 'error';

export interface AgentVerification {
  agent: AgentId;
  status: VerifyStatus;
  evidence: 'session-log' | 'probe' | 'none';
  source: string | null;
  exitCode: number;
  expected: string[];
  /** Expected files that arrived, plus conditional or on-demand files that arrived. */
  delivered: string[];
  missing: string[];
  /** Files changed after the session started, so the log cannot tell. */
  stale: string[];
  error: { code: string; message: string; hint: string | null } | null;
}

export interface Verification {
  path: string;
  root: string;
  agents: AgentVerification[];
  exitCode: number;
}

function judged(base: AgentVerification, expected: ExplainedFile[], optional: ExplainedFile[], received: (file: ExplainedFile) => boolean): AgentVerification {
  const delivered = [...expected, ...optional].filter(received).map(file => file.path);
  const missing = expected.filter(file => !received(file)).map(file => file.path);
  return { ...base, delivered, missing, status: missing.length ? 'fail' : 'pass', exitCode: missing.length ? EXIT.deliveryMissing : EXIT.ok };
}

function fromSessionLog(explanation: AgentExplanation, startDir: string, base: AgentVerification, expected: ExplainedFile[], optional: ExplainedFile[]): AgentVerification {
  const evidence = explanation.agent === 'codex' ? codexSessionEvidence(startDir) : explanation.agent === 'claude' ? claudeSessionEvidence(startDir) : null;
  if (!evidence) return base;
  const stale = expected.filter(file => fs.statSync(file.absolutePath).mtimeMs > evidence.startedAt).map(file => file.path);
  const found = { ...base, evidence: 'session-log' as const, source: evidence.source };
  if (stale.length) return { ...found, stale };
  if ('text' in evidence) return judged(found, expected, optional, file => codexReceived(fs.readFileSync(file.absolutePath, 'utf8'), evidence.text));
  return judged(found, expected, optional, file => evidence.loaded.has(fs.realpathSync(file.absolutePath)));
}

export function verifyPath(requested: string, agents: readonly AgentId[], options: { probe: boolean }): Verification {
  const explanation = explainPath(requested, agents);
  const results = explanation.agents.map((agent): AgentVerification => {
    const expected = agent.files.filter(file => file.status === 'read' && file.scope === 'project');
    const optional = agent.files.filter(file => (file.status === 'conditional' || file.status === 'on-demand') && file.scope === 'project');
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
    if (!options.probe) return fromSessionLog(agent, explanation.path, base, expected, optional);
    try {
      const probe = probeAgent(agent, explanation.root, explanation.path);
      return judged({ ...base, evidence: 'probe', source: probe.command }, expected, optional, file => probe.received.has(file.path));
    } catch (error) {
      const cliError = toCliError(error);
      return { ...base, evidence: 'probe', status: 'error', exitCode: cliError.exitCode, error: { code: cliError.code, message: cliError.message, hint: cliError.hint } };
    }
  });
  return { path: explanation.path, root: explanation.root, agents: results, exitCode: worstExitCode(results.map(result => result.exitCode)) };
}
