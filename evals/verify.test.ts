import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fakeCommands, gitIn, makeWorkspace } from './support/git-workspace.ts';

interface VerifiedAgent {
  agent: string;
  status: string;
  evidence: string;
  exitCode: number;
  expected: string[];
  delivered: string[];
  missing: string[];
  stale: string[];
}

interface VerifyDocument {
  command: string;
  exitCode: number;
  data: { agents: VerifiedAgent[] };
}

/** A monorepo with a profile at the root and a payments folder, plus agent homes inside the workspace. */
function project(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-verify-');
  const me = person('me');
  const userHome = folder('user-home');
  const codexHome = path.join(userHome, '.codex');
  const claudeHome = path.join(userHome, '.claude');
  const env = { HOME: userHome, USERPROFILE: userHome, CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: claudeHome };
  const repo = folder('mono');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  me.ok(['profile', 'create', 'company', '--scope', 'company'], env);
  me.ok(['profile', 'apply', 'company', repo, '--yes'], env);
  const payments = path.join(repo, 'services', 'payments');
  fs.mkdirSync(payments, { recursive: true });
  fs.writeFileSync(path.join(payments, 'AGENTS.md'), '# Payments\n\n- Use idempotency keys.\n');
  const verify = (args: string[], extra: Record<string, string> = {}) => me.run(['verify', ...args], { ...env, ...extra });
  return { repo, payments, codexHome, claudeHome, verify };
}

/** A Codex session log written after the instruction files, recording what Codex injected. */
function codexSession(codexHome: string, cwd: string, instructions: string) {
  const dir = path.join(codexHome, 'sessions', '2026', '09', '15');
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date(Date.now() + 5000).toISOString();
  const file = path.join(dir, `rollout-2026-09-15T10-00-00-${Math.random().toString(16).slice(2)}.jsonl`);
  const records = [
    { timestamp, type: 'session_meta', payload: { id: 'session-1', timestamp, cwd, cli_version: '0.154.0' } },
    { timestamp, type: 'world_state', payload: { full: true, state: { agents_md: { directory: cwd, text: instructions } } } },
    { timestamp, type: 'turn_context', payload: { cwd } }
  ];
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n');
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(file, future, future);
  return file;
}

/** A Claude Code transcript that lists the instruction files loaded at session start. */
function claudeTranscript(claudeHome: string, cwd: string, loaded: string[]) {
  const dir = path.join(claudeHome, 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date(Date.now() + 5000).toISOString();
  const records = [
    { type: 'attachment', cwd, sessionId: 'session-1', timestamp, attachment: { type: 'instructions', files: loaded.map(file => ({ path: file, type: 'Project', content: '' })) } },
    { type: 'user', cwd, sessionId: 'session-1', timestamp, message: { role: 'user', content: 'hello' } }
  ];
  const file = path.join(dir, 'session-1.jsonl');
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n');
  return file;
}

const parse = (stdout: string): VerifyDocument => JSON.parse(stdout);
const agentOf = (document: VerifyDocument, id: string) => {
  const agent = document.data.agents.find(entry => entry.agent === id);
  assert.ok(agent, `${id} is verified`);
  return agent;
};

test('verify reads Codex and Claude Code session logs and exits 4 when an instruction file never arrived', t => {
  const { repo, payments, codexHome, claudeHome, verify } = project(t);
  const start = fs.realpathSync(payments);
  const root = fs.realpathSync(repo);
  const rootAgents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  codexSession(codexHome, start, rootAgents);
  claudeTranscript(claudeHome, start, [path.join(root, 'CLAUDE.md'), path.join(root, 'AGENTS.md')]);

  const result = verify([payments, '--json']);
  assert.equal(result.status, 4, result.stderr);
  const document = parse(result.stdout);
  assert.equal(document.command, 'verify');
  const codex = agentOf(document, 'codex');
  assert.equal(codex.status, 'fail');
  assert.equal(codex.evidence, 'session-log');
  assert.deepEqual(codex.delivered, ['AGENTS.md']);
  assert.deepEqual(codex.missing, ['services/payments/AGENTS.md']);
  const claude = agentOf(document, 'claude');
  assert.equal(claude.status, 'pass');
  assert.deepEqual(claude.expected, ['CLAUDE.md'], 'AGENTS.md imported from outside the start folder is conditional');
  assert.deepEqual(claude.delivered.sort(), ['AGENTS.md', 'CLAUDE.md'], 'a conditional file that arrived is still reported');
  assert.equal(agentOf(document, 'antigravity').status, 'no-evidence');

  const human = verify([payments]);
  assert.match(human.stdout, /codex\s+fail/);
  assert.match(human.stdout, /missing\s+services\/payments\/AGENTS\.md/);
  assert.match(human.stdout, /antigravity\s+no-evidence\s+agctx cannot read Antigravity session logs/);
  assert.match(human.stderr, /--probe/);
  assert.doesNotMatch(human.stderr, /start Antigravity/);

  codexSession(codexHome, start, `${rootAgents}\n\n${fs.readFileSync(path.join(payments, 'AGENTS.md'), 'utf8')}`);
  assert.equal(verify([payments, '--agent', 'codex']).status, 0, 'the newest session decides');
});

test('verify does not trust a session that started before an instruction file changed', t => {
  const { repo, payments, codexHome, verify } = project(t);
  const start = fs.realpathSync(payments);
  const both = `${fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8')}\n\n${fs.readFileSync(path.join(payments, 'AGENTS.md'), 'utf8')}`;
  codexSession(codexHome, start, both);
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(payments, 'AGENTS.md'), later, later);

  const result = verify([payments, '--agent', 'codex', '--json']);
  assert.equal(result.status, 0);
  const codex = agentOf(parse(result.stdout), 'codex');
  assert.equal(codex.status, 'no-evidence');
  assert.deepEqual(codex.stale, ['services/payments/AGENTS.md']);
});

/** Fake agent CLIs that load files the way each agent's documented rules say, then answer with marker lines. */
function fakeAgents(t: TestContext) {
  const markers = `const markers = files => files.filter(file => fs.existsSync(file)).flatMap(file => fs.readFileSync(file, 'utf8').split('\\n').filter(line => line.startsWith('agctx probe marker:')));
const rootOf = start => { for (let dir = start; ; dir = path.dirname(dir)) { if (fs.existsSync(path.join(dir, '.git'))) return dir; if (path.dirname(dir) === dir) return start; } };`;
  return fakeCommands(t, {
    codex: `${markers}
if (process.env.FAKE_AGENT_FAIL === 'codex') { process.stderr.write('Not logged in\\n'); process.exit(1); }
const start = args[args.indexOf('-C') + 1];
const root = rootOf(start);
const parts = path.relative(root, start).split(path.sep).filter(Boolean);
const dirs = [root, ...parts.map((_, i) => path.join(root, ...parts.slice(0, i + 1)))];
process.stdout.write(markers(dirs.map(dir => path.join(dir, 'AGENTS.md'))).join('\\n') + '\\n');`,
    claude: `${markers}
const start = process.cwd();
const root = rootOf(start);
const loaded = [];
for (let dir = start; ; dir = path.dirname(dir)) { loaded.push(path.join(dir, 'CLAUDE.md')); if (dir === root || path.dirname(dir) === dir) break; }
const imports = process.env.FAKE_CLAUDE_NO_IMPORTS ? [] : loaded.filter(file => fs.existsSync(file)).flatMap(file => [...fs.readFileSync(file, 'utf8').matchAll(/(?:^|\\s)@([^\\s]+)/gm)].map(match => path.resolve(path.dirname(file), match[1]))).filter(target => target.startsWith(start + path.sep));
process.stdout.write(markers([...loaded, ...imports]).join('\\n') + '\\n');`,
    agy: `${markers}
const root = args[args.indexOf('--add-dir') + 1];
const rulesDir = path.join(root, '.agents', 'rules');
const rules = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir).map(name => path.join(rulesDir, name)).filter(file => fs.readFileSync(file, 'utf8').startsWith('---\\ntrigger: always_on')) : [];
process.stdout.write(markers([path.join(root, 'AGENTS.md'), ...rules]).join('\\n') + '\\n');`
  });
}

function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[path.relative(dir, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return files;
}

test('verify --probe asks each agent CLI about marker lines in a scratch copy and leaves the repository untouched', t => {
  const { repo, payments, verify } = project(t);
  fs.writeFileSync(path.join(payments, 'CLAUDE.md'), '@AGENTS.md\n');
  const agents = fakeAgents(t);
  const before = snapshot(repo);

  const refused = verify([payments, '--probe'], agents.env);
  assert.equal(refused.status, 64, 'a probe runs agent CLIs, so it needs confirmation');
  assert.match(refused.stderr, /--yes/);
  assert.match(refused.stderr, /plan or API credits/);
  assert.doesNotMatch(refused.stderr, /--dry-run/, 'verify has no --dry-run');
  assert.deepEqual(agents.calls(), []);

  const passed = verify([payments, '--probe', '--yes', '--json'], agents.env);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const document = parse(passed.stdout);
  for (const agent of document.data.agents) {
    assert.equal(agent.evidence, 'probe', agent.agent);
    assert.equal(agent.status, 'pass', `${agent.agent}: ${JSON.stringify(agent)}`);
  }
  assert.deepEqual(agentOf(document, 'codex').delivered.sort(), ['AGENTS.md', 'services/payments/AGENTS.md']);
  assert.ok(!agentOf(document, 'claude').expected.includes('AGENTS.md'), 'an import that needs approval is not required from a probe');

  const calls = agents.calls();
  const codexCall = calls.find(call => call.command === 'codex');
  assert.ok(codexCall?.args.includes('exec') && codexCall.args.includes('read-only'), JSON.stringify(codexCall));
  const claudeCall = calls.find(call => call.command === 'claude');
  assert.ok(claudeCall?.args.includes('-p') && claudeCall.args.includes('--tools'), JSON.stringify(claudeCall));
  const agyCall = calls.find(call => call.command === 'agy');
  assert.ok(agyCall?.args.includes('-p') && agyCall.args.includes('--add-dir'), JSON.stringify(agyCall));
  assert.ok(calls.every(call => !call.cwd.startsWith(fs.realpathSync(repo))), 'agents run in a scratch copy, not the repository');
  assert.deepEqual(snapshot(repo), before, 'markers are added only to the scratch copy');

  const failed = verify([payments, '--probe', '--yes', '--agent', 'claude', '--json'], { ...agents.env, FAKE_CLAUDE_NO_IMPORTS: '1' });
  assert.equal(failed.status, 4);
  const claude = agentOf(parse(failed.stdout), 'claude');
  assert.equal(claude.status, 'fail');
  assert.ok(claude.missing.includes('services/payments/AGENTS.md'), JSON.stringify(claude));
});

test('verify --probe reports an agent CLI that cannot run as unavailable', t => {
  const { payments, verify } = project(t);
  const agents = fakeAgents(t);
  const result = verify([payments, '--probe', '--yes', '--agent', 'codex', '--json'], { ...agents.env, FAKE_AGENT_FAIL: 'codex' });
  assert.equal(result.status, 69);
  const codex = agentOf(parse(result.stdout), 'codex');
  assert.equal(codex.status, 'error');
  assert.equal(codex.exitCode, 69);
});

test('verify judges a long Claude Code session by its latest instruction load, such as the reload after compaction', t => {
  const { repo, payments, claudeHome, verify } = project(t);
  const start = fs.realpathSync(payments);
  const root = fs.realpathSync(repo);
  fs.writeFileSync(path.join(payments, 'CLAUDE.md'), '@AGENTS.md\n');
  const expected = [path.join(root, 'CLAUDE.md'), path.join(root, 'AGENTS.md'), path.join(start, 'CLAUDE.md'), path.join(start, 'AGENTS.md')];
  const dir = path.join(claudeHome, 'projects', start.replace(/[^A-Za-z0-9]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const earlier = new Date(Date.now() - 3_600_000).toISOString();
  const now = new Date(Date.now() + 5000).toISOString();
  const instructions = (timestamp: string, files: string[]) => ({ type: 'attachment', cwd: start, sessionId: 'long', timestamp, attachment: { type: 'instructions', files: files.map(file => ({ path: file, type: 'Project', content: '' })) } });
  fs.writeFileSync(path.join(dir, 'long.jsonl'), [instructions(earlier, expected.slice(0, 2)), instructions(now, expected)].map(record => JSON.stringify(record)).join('\n') + '\n');

  const result = verify([payments, '--agent', 'claude', '--json']);
  assert.equal(result.status, 0, result.stdout);
  const claude = agentOf(parse(result.stdout), 'claude');
  assert.equal(claude.status, 'pass');
  assert.deepEqual(claude.delivered.sort(), ['AGENTS.md', 'CLAUDE.md', 'services/payments/AGENTS.md', 'services/payments/CLAUDE.md']);
});

test('verify without session logs gives one next step for Codex and Claude Code and the probe for Antigravity', t => {
  const { payments, verify } = project(t);
  const result = verify([payments]);
  assert.equal(result.status, 0);
  const next = result.stderr.split('\n').filter(line => line.startsWith('Next:'));
  assert.equal(next.length, 2, result.stderr);
  assert.match(next[0], /Codex, Claude Code/);
  assert.match(next[1], /--probe.*Antigravity/);
});

