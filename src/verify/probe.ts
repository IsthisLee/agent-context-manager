import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import type { AgentExplanation, AgentId } from '../explain.ts';
import { _ } from '../i18n/index.ts';
import { CliError, EXIT } from '../shared/errors.ts';
import { git } from '../shared/git.ts';

/**
 * `agctx verify --probe`: copy the project's instruction files into a scratch
 * repository, append a unique marker line to each copy, run the agent CLI there
 * once with tools disabled, and see which markers it can repeat. The real
 * repository is never modified.
 */

const MARKER = 'agctx probe marker:';
const PROMPT = `Do not use any tools and do not read files. From the instructions already in your context, print every line that starts with '${MARKER}' exactly as written, one per line. Print NONE if there is none.`;
const TIMEOUT_MS = 5 * 60 * 1000;

export interface ProbeResult {
  /** Project-relative paths whose marker the agent repeated. */
  received: Set<string>;
  command: string;
}

function commandFor(agent: AgentId, scratchRoot: string, scratchStart: string): { command: string; args: string[] } {
  if (agent === 'codex') return { command: 'codex', args: ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-C', scratchStart, PROMPT] };
  if (agent === 'claude') return { command: 'claude', args: ['-p', PROMPT, '--tools', '', '--no-session-persistence'] };
  return { command: 'agy', args: ['-p', PROMPT, '--add-dir', scratchRoot] };
}

function run(command: string, args: string[], cwd: string) {
  // Agent CLIs installed with npm are .cmd shims on Windows, which only a shell can start.
  return process.platform === 'win32'
    ? spawnSync(command, args.map(arg => `"${arg.replaceAll('"', '\\"')}"`), { cwd, encoding: 'utf8', timeout: TIMEOUT_MS, shell: true })
    : spawnSync(command, args, { cwd, encoding: 'utf8', timeout: TIMEOUT_MS });
}

export function probeAgent(explanation: AgentExplanation, root: string, startDir: string): ProbeResult {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-probe-'));
  try {
    const scratchRoot = path.join(scratch, path.basename(root) || 'project');
    fs.mkdirSync(scratchRoot, { recursive: true });
    git(['init', '--quiet', scratchRoot]);
    const markers = new Map<string, string>();
    const token = randomUUID().slice(0, 8);
    explanation.files.filter(file => file.scope === 'project').forEach((file, index) => {
      const copy = path.join(scratchRoot, path.relative(root, file.absolutePath));
      fs.mkdirSync(path.dirname(copy), { recursive: true });
      const marker = `AGCTX-PROBE-${token}-${index + 1}`;
      markers.set(marker, file.path);
      fs.writeFileSync(copy, `${fs.readFileSync(file.absolutePath, 'utf8').trimEnd()}\n\n${MARKER} ${marker}\n`);
    });
    const scratchStart = path.join(scratchRoot, path.relative(root, startDir));
    fs.mkdirSync(scratchStart, { recursive: true });

    const { command, args } = commandFor(explanation.agent, scratchRoot, scratchStart);
    const result = run(command, args, scratchStart);
    if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CliError('verify.agent-missing', _('error.verify.agent-missing', { command }), { exitCode: EXIT.unavailable, hint: _('hint.verify.agent-missing', { command }) });
    }
    if (result.error || result.status !== 0) {
      const detail = (result.stderr || result.error?.message || '').trim().split('\n').slice(-2).join(' ');
      throw new CliError('verify.agent-failed', _('error.verify.agent-failed', { command, detail }), { exitCode: EXIT.unavailable, hint: _('hint.verify.agent-failed', { command }) });
    }
    const received = new Set<string>();
    for (const [marker, file] of markers) {
      if (result.stdout.includes(marker)) received.add(file);
    }
    return { received, command };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
