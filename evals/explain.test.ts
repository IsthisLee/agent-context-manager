import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

interface ExplainedFile {
  path: string;
  status: string;
  scope: string;
  reason: string;
}

interface ExplainedAgent {
  agent: string;
  startDir: string;
  files: ExplainedFile[];
  findings: { kind: string; file: string | null; message: string }[];
}

interface ExplainDocument {
  command: string;
  exitCode: number;
  data: { agents: ExplainedAgent[]; unsupported: { path: string }[] };
}

/**
 * A monorepo with a profile applied at the root, a payments folder with its own
 * AGENTS.md, an Antigravity rule scoped by glob, and an old Cursor rules file.
 * User-level agent folders point into the workspace so the machine's own files never leak in.
 */
function monorepo(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-explain-');
  const me = person('me');
  const userHome = folder('user-home');
  const env = { HOME: userHome, USERPROFILE: userHome, CODEX_HOME: path.join(userHome, '.codex'), CLAUDE_CONFIG_DIR: path.join(userHome, '.claude') };
  const repo = folder('mono');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  me.ok(['profile', 'create', 'company', '--scope', 'company'], env);
  me.ok(['profile', 'apply', 'company', repo, '--yes'], env);
  const payments = path.join(repo, 'services', 'payments');
  fs.mkdirSync(payments, { recursive: true });
  fs.writeFileSync(path.join(payments, 'AGENTS.md'), '# Payments\n\n- Use idempotency keys.\n');
  fs.writeFileSync(path.join(repo, '.agents', 'rules', 'payments.md'), '---\ntrigger: glob\nglobs: services/payments/**\n---\n\n- Payments rule.\n');
  fs.writeFileSync(path.join(repo, '.cursorrules'), 'Old Cursor rules.\n');
  const explain = (args: string[]) => me.run(['explain', ...args], env);
  return { repo, payments, userHome, explain };
}

const parse = (stdout: string): ExplainDocument => JSON.parse(stdout);
const agentOf = (document: ExplainDocument, id: string) => {
  const agent = document.data.agents.find(entry => entry.agent === id);
  assert.ok(agent, `${id} is explained`);
  return agent;
};
const statusOf = (agent: ExplainedAgent, file: string) => agent.files.find(entry => entry.path.replaceAll('\\', '/') === file)?.status;

test('explain shows what each agent reads for a folder and exits 4 when a file never reaches an agent', t => {
  const { payments, explain } = monorepo(t);
  const result = explain([payments, '--json']);
  assert.equal(result.status, 4, result.stderr);
  const document = parse(result.stdout);
  assert.equal(document.command, 'explain');

  const codex = agentOf(document, 'codex');
  assert.equal(statusOf(codex, 'AGENTS.md'), 'read');
  assert.equal(statusOf(codex, 'services/payments/AGENTS.md'), 'read');

  const claude = agentOf(document, 'claude');
  assert.equal(statusOf(claude, 'CLAUDE.md'), 'read');
  assert.equal(statusOf(claude, 'AGENTS.md'), 'conditional', 'the root CLAUDE.md imports AGENTS.md from outside the start folder, which Claude Code loads only after approval');
  assert.ok(claude.findings.some(finding => finding.kind === 'warning' && finding.file === 'AGENTS.md' && /approv/.test(finding.message)));
  assert.equal(statusOf(claude, 'services/payments/AGENTS.md'), 'not-read', 'Claude Code does not read AGENTS.md without a CLAUDE.md that imports it');
  assert.ok(claude.findings.some(finding => finding.kind === 'missing' && finding.file === 'services/payments/AGENTS.md'));

  const antigravity = agentOf(document, 'antigravity');
  assert.equal(statusOf(antigravity, '.agents/rules/agctx.md'), 'read');
  assert.equal(statusOf(antigravity, '.agents/rules/payments.md'), 'not-read', 'a glob rule is not delivered at session start');
  assert.ok(antigravity.findings.some(finding => finding.kind === 'missing' && finding.file === '.agents/rules/payments.md'));
  assert.equal(statusOf(antigravity, 'services/payments/AGENTS.md'), 'conditional');
  assert.ok(antigravity.findings.some(finding => finding.kind === 'warning' && finding.file === 'services/payments/AGENTS.md' && /always_on/.test(finding.message)), 'a subfolder AGENTS.md did not reach Antigravity at session start when measured');

  assert.deepEqual(document.data.unsupported.map(entry => entry.path), ['.cursorrules']);

  const human = explain([payments]);
  assert.equal(human.status, 4);
  assert.match(human.stdout, /Codex · started in services\/payments/);
  assert.match(human.stdout, /Claude Code/);
  assert.match(human.stdout, /Antigravity/);
  assert.match(human.stdout, /not-read\s+services\/payments\/AGENTS\.md/);
  assert.match(human.stdout, /\.cursorrules/);
});

test('explain from the repository root warns that Codex skips AGENTS.md files in subfolders', t => {
  const { repo, explain } = monorepo(t);
  const result = explain([repo, '--agent', 'codex', '--json']);
  assert.equal(result.status, 0, 'a folder file skipped at the root is a warning, not a delivery failure');
  const document = parse(result.stdout);
  assert.deepEqual(document.data.agents.map(agent => agent.agent), ['codex']);
  const [codex] = document.data.agents;
  assert.equal(codex.startDir, '.');
  assert.equal(statusOf(codex, 'services/payments/AGENTS.md'), 'not-read');
  assert.ok(codex.findings.some(finding => finding.kind === 'warning' && finding.file === 'services/payments/AGENTS.md' && /services\/payments/.test(finding.message)));
});

test('explain passes once every instruction file has a path to every agent', t => {
  const { repo, payments, explain } = monorepo(t);
  fs.writeFileSync(path.join(payments, 'CLAUDE.md'), '@AGENTS.md\n');
  fs.writeFileSync(path.join(repo, '.agents', 'rules', 'payments.md'), '---\ntrigger: always_on\n---\n\n- Payments rule.\n');
  fs.rmSync(path.join(repo, '.cursorrules'));

  const result = explain([payments, '--json']);
  assert.equal(result.status, 0, result.stdout);
  const claude = agentOf(parse(result.stdout), 'claude');
  assert.equal(statusOf(claude, 'services/payments/CLAUDE.md'), 'read');
  assert.equal(statusOf(claude, 'services/payments/AGENTS.md'), 'read');
  assert.deepEqual(claude.findings.filter(finding => finding.kind === 'missing'), []);
});

test('explain reports user-level files with their scope and an Antigravity rule without frontmatter as not read', t => {
  const { repo, userHome, explain } = monorepo(t);
  fs.mkdirSync(path.join(userHome, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(userHome, '.codex', 'AGENTS.md'), '- Personal Codex rule.\n');
  fs.mkdirSync(path.join(userHome, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(userHome, '.claude', 'CLAUDE.md'), '- Personal Claude rule.\n@~/.codex/AGENTS.md\n');
  fs.writeFileSync(path.join(repo, '.agents', 'rules', 'notes.md'), '- No frontmatter here.\n');

  const document = parse(explain([repo, '--json']).stdout);
  const codexUser = agentOf(document, 'codex').files.find(file => file.scope === 'user');
  assert.equal(codexUser?.status, 'read');
  assert.match(codexUser?.path ?? '', /\.codex[\\/]AGENTS\.md$/);
  const claude = agentOf(document, 'claude');
  assert.equal(claude.files.find(file => file.scope === 'user')?.status, 'read');
  assert.equal(claude.files.find(file => /\.codex[\\/]AGENTS\.md$/.test(file.path))?.status, 'read', 'imports in the user CLAUDE.md load without approval');
  assert.deepEqual(claude.findings.filter(finding => finding.kind === 'warning'), []);
  assert.equal(statusOf(agentOf(document, 'antigravity'), '.agents/rules/notes.md'), 'not-read');
});

test('explain warns when the same rules reach an agent through two files', t => {
  const { repo, explain } = monorepo(t);
  const rules = '- Every API handler validates its input before touching the database.\n- Money is stored as integer minor units, never as floats.\n- Every refund writes an audit log entry with the operator id.\n';
  fs.appendFileSync(path.join(repo, 'AGENTS.md'), `\n${rules}`);
  fs.mkdirSync(path.join(repo, '.claude', 'rules'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude', 'rules', 'team.md'), `# Team rules\n\n${rules}`);

  const claude = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  const duplicate = claude.findings.find(finding => finding.kind === 'warning' && /team\.md/.test(finding.message) && /AGENTS\.md/.test(finding.message));
  assert.ok(duplicate, JSON.stringify(claude.findings));
  assert.match(duplicate.message, /\b3\b/);

  const clean = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  fs.rmSync(path.join(repo, '.claude', 'rules', 'team.md'));
  const without = agentOf(parse(explain([repo, '--json']).stdout), 'claude');
  assert.ok(clean.findings.length > without.findings.length);
  // APM writes the copy as a path-scoped rule; it still reaches Claude Code once a matching file is read.
  fs.writeFileSync(path.join(repo, '.claude', 'rules', 'team.md'), `---\npaths:\n  - "**"\n---\n\n${rules}`);
  const scoped = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  assert.ok(scoped.findings.some(finding => finding.kind === 'warning' && /team\.md/.test(finding.message) && /AGENTS\.md/.test(finding.message)), JSON.stringify(scoped.findings));
  fs.rmSync(path.join(repo, '.claude', 'rules', 'team.md'));
  for (const agent of parse(explain([repo, '--json']).stdout).data.agents) {
    assert.deepEqual(agent.findings.filter(finding => /share \d+ lines/.test(finding.message)), [], `${agent.agent}: files agctx generates do not repeat each other`);
  }
});

