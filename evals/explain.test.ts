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
 * 루트에 프로필을 적용하고, 자기 AGENTS.md가 있는 payments 폴더, glob으로 범위를 정한
 * Antigravity 규칙, 오래된 Cursor 규칙 파일을 둔 모노레포. 사용자 수준 에이전트 폴더는 작업
 * 공간 안을 가리켜서 이 컴퓨터의 실제 파일이 섞이지 않는다.
 */
function monorepo(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-explain-');
  const me = person('me');
  const userHome = folder('user-home');
  const env = {
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: path.join(userHome, '.codex'),
    CLAUDE_CONFIG_DIR: path.join(userHome, '.claude')
  };
  const repo = folder('mono');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  me.ok(['profile', 'create', 'company', '--scope', 'company'], env);
  me.ok(['profile', 'apply', 'company', repo, '--yes'], env);
  const payments = path.join(repo, 'services', 'payments');
  fs.mkdirSync(payments, { recursive: true });
  fs.writeFileSync(path.join(payments, 'AGENTS.md'), '# Payments\n\n- Use idempotency keys.\n');
  fs.writeFileSync(
    path.join(repo, '.agents', 'rules', 'payments.md'),
    '---\ntrigger: glob\nglobs: services/payments/**\n---\n\n- Payments rule.\n'
  );
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
const statusOf = (agent: ExplainedAgent, file: string) =>
  agent.files.find(entry => entry.path.replaceAll('\\', '/') === file)?.status;

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
  assert.equal(
    statusOf(claude, 'AGENTS.md'),
    'conditional',
    'the root CLAUDE.md imports AGENTS.md from outside the start folder, which Claude Code loads only after approval'
  );
  assert.ok(
    claude.findings.some(
      finding => finding.kind === 'warning' && finding.file === 'AGENTS.md' && /approv/.test(finding.message)
    )
  );
  assert.equal(
    statusOf(claude, 'services/payments/AGENTS.md'),
    'shadowed',
    'a CLAUDE.md above the start folder makes Claude Code read CLAUDE.md files instead of AGENTS.md'
  );
  assert.ok(
    claude.findings.some(finding => finding.kind === 'missing' && finding.file === 'services/payments/AGENTS.md')
  );

  const antigravity = agentOf(document, 'antigravity');
  assert.equal(statusOf(antigravity, '.agents/rules/agctx.md'), 'read');
  assert.equal(
    statusOf(antigravity, '.agents/rules/payments.md'),
    'not-read',
    'a glob rule is not delivered at session start'
  );
  assert.ok(
    antigravity.findings.some(finding => finding.kind === 'missing' && finding.file === '.agents/rules/payments.md')
  );
  assert.equal(statusOf(antigravity, 'services/payments/AGENTS.md'), 'conditional');
  assert.ok(
    antigravity.findings.some(
      finding =>
        finding.kind === 'warning' &&
        finding.file === 'services/payments/AGENTS.md' &&
        /always_on/.test(finding.message)
    ),
    'a subfolder AGENTS.md did not reach Antigravity at session start when measured'
  );

  assert.deepEqual(
    document.data.unsupported.map(entry => entry.path),
    ['.cursorrules']
  );

  const human = explain([payments]);
  assert.equal(human.status, 4);
  assert.match(human.stdout, /Codex · started in services\/payments/);
  assert.match(human.stdout, /Claude Code/);
  assert.match(human.stdout, /Antigravity/);
  assert.match(human.stdout, /shadowed\s+services\/payments\/AGENTS\.md/);
  assert.match(human.stdout, /\.cursorrules/);
});

test('explain from the repository root warns that Codex skips AGENTS.md files in subfolders', t => {
  const { repo, explain } = monorepo(t);
  const result = explain([repo, '--agent', 'codex', '--json']);
  assert.equal(result.status, 0, 'a folder file skipped at the root is a warning, not a delivery failure');
  const document = parse(result.stdout);
  assert.deepEqual(
    document.data.agents.map(agent => agent.agent),
    ['codex']
  );
  const [codex] = document.data.agents;
  assert.equal(codex.startDir, '.');
  assert.equal(statusOf(codex, 'services/payments/AGENTS.md'), 'not-read');
  assert.ok(
    codex.findings.some(
      finding =>
        finding.kind === 'warning' &&
        finding.file === 'services/payments/AGENTS.md' &&
        /services\/payments/.test(finding.message)
    )
  );
});

test('explain passes once every instruction file has a path to every agent', t => {
  const { repo, payments, explain } = monorepo(t);
  fs.writeFileSync(path.join(payments, 'CLAUDE.md'), '@AGENTS.md\n');
  fs.writeFileSync(
    path.join(repo, '.agents', 'rules', 'payments.md'),
    '---\ntrigger: always_on\n---\n\n- Payments rule.\n'
  );
  fs.rmSync(path.join(repo, '.cursorrules'));

  const result = explain([payments, '--json']);
  assert.equal(result.status, 0, result.stdout);
  const claude = agentOf(parse(result.stdout), 'claude');
  assert.equal(statusOf(claude, 'services/payments/CLAUDE.md'), 'read');
  assert.equal(statusOf(claude, 'services/payments/AGENTS.md'), 'read');
  assert.deepEqual(
    claude.findings.filter(finding => finding.kind === 'missing'),
    []
  );
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
  assert.equal(
    claude.files.find(file => /\.codex[\\/]AGENTS\.md$/.test(file.path))?.status,
    'read',
    'imports in the user CLAUDE.md load without approval'
  );
  assert.deepEqual(
    claude.findings.filter(finding => finding.kind === 'warning'),
    []
  );
  assert.equal(statusOf(agentOf(document, 'antigravity'), '.agents/rules/notes.md'), 'not-read');
});

test('explain warns when the same rules reach an agent through two files', t => {
  const { repo, explain } = monorepo(t);
  const rules =
    '- Every API handler validates its input before touching the database.\n- Money is stored as integer minor units, never as floats.\n- Every refund writes an audit log entry with the operator id.\n';
  fs.appendFileSync(path.join(repo, 'AGENTS.md'), `\n${rules}`);
  fs.mkdirSync(path.join(repo, '.claude', 'rules'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude', 'rules', 'team.md'), `# Team rules\n\n${rules}`);

  const claude = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  const duplicate = claude.findings.find(
    finding => finding.kind === 'warning' && /team\.md/.test(finding.message) && /AGENTS\.md/.test(finding.message)
  );
  assert.ok(duplicate, JSON.stringify(claude.findings));
  assert.match(duplicate.message, /\b3\b/);

  const clean = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  fs.rmSync(path.join(repo, '.claude', 'rules', 'team.md'));
  const without = agentOf(parse(explain([repo, '--json']).stdout), 'claude');
  assert.ok(clean.findings.length > without.findings.length);
  // APM은 사본을 경로 범위 규칙으로 쓴다. 맞는 파일을 읽으면 여전히 Claude Code에 닿는다.
  fs.writeFileSync(path.join(repo, '.claude', 'rules', 'team.md'), `---\npaths:\n  - "**"\n---\n\n${rules}`);
  const scoped = agentOf(parse(explain([repo, '--agent', 'claude', '--json']).stdout), 'claude');
  assert.ok(
    scoped.findings.some(
      finding => finding.kind === 'warning' && /team\.md/.test(finding.message) && /AGENTS\.md/.test(finding.message)
    ),
    JSON.stringify(scoped.findings)
  );
  fs.rmSync(path.join(repo, '.claude', 'rules', 'team.md'));
  for (const agent of parse(explain([repo, '--json']).stdout).data.agents) {
    assert.deepEqual(
      agent.findings.filter(finding => /share \d+ lines/.test(finding.message)),
      [],
      `${agent.agent}: files agctx generates do not repeat each other`
    );
  }
});

/**
 * 규칙을 AGENTS.md에만 두는 저장소. Claude Code가 직접 읽는 배치다. 사용자 수준 폴더는
 * 작업 공간 안을 가리켜서 이 컴퓨터의 실제 파일이 섞이지 않는다.
 */
function agentsOnlyRepo(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-explain-agents-');
  const me = person('me');
  const userHome = folder('user-home');
  const configDir = path.join(userHome, '.claude');
  fs.mkdirSync(configDir, { recursive: true });
  const env = {
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: path.join(userHome, '.codex'),
    CLAUDE_CONFIG_DIR: configDir
  };
  const repo = folder('solo');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  fs.writeFileSync(
    path.join(repo, 'AGENTS.md'),
    '# Rules\n\n- Every API handler validates its input before touching the database.\n'
  );
  const claude = (args: string[]) =>
    agentOf(parse(me.run(['explain', ...args, '--agent', 'claude', '--json'], env).stdout), 'claude');
  const run = (args: string[]) => me.run(['explain', ...args, '--agent', 'claude', '--json'], env);
  const setInstructionFiles = (value: string) =>
    fs.writeFileSync(
      path.join(configDir, 'settings.json'),
      JSON.stringify({ pluginConfigs: { 'agents-md@builtin': { options: { instructionFiles: value } } } })
    );
  return { repo, run, claude, setInstructionFiles };
}

test('explain reads AGENTS.md directly when no CLAUDE.md in the start folder or above it hides it', t => {
  const { repo, run } = agentsOnlyRepo(t);
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude', 'AGENTS.md'), '- Claude reads this one at launch too.\n');

  const result = run([repo]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const claude = agentOf(parse(result.stdout), 'claude');
  assert.equal(
    statusOf(claude, 'AGENTS.md'),
    'read',
    'Claude Code v2.1.277 and later read AGENTS.md when no CLAUDE.md hides it'
  );
  assert.equal(
    statusOf(claude, '.claude/AGENTS.md'),
    'read',
    'a .claude/AGENTS.md above the start folder is read at session start as well'
  );
  assert.deepEqual(
    claude.findings.filter(finding => finding.kind === 'missing'),
    []
  );
  assert.ok(
    claude.findings.some(
      finding => finding.kind === 'warning' && finding.file === null && /2\.1\.277/.test(finding.message)
    ),
    `direct reading is not available in every session, and explain cannot tell: ${JSON.stringify(claude.findings)}`
  );
});

test('explain reports AGENTS.md as shadowed when a CLAUDE.local.md sits in the start folder or above it', t => {
  const { repo, run } = agentsOnlyRepo(t);
  fs.writeFileSync(path.join(repo, 'CLAUDE.local.md'), '- My own uncommitted note about this repository.\n');

  const result = run([repo]);
  assert.equal(result.status, 0, 'a personal CLAUDE.local.md is a warning, not a repository defect');
  const claude = agentOf(parse(result.stdout), 'claude');
  assert.equal(statusOf(claude, 'AGENTS.md'), 'shadowed');
  assert.ok(
    claude.findings.some(
      finding => finding.kind === 'warning' && finding.file === 'AGENTS.md' && /CLAUDE\.local\.md/.test(finding.message)
    ),
    JSON.stringify(claude.findings)
  );
  assert.ok(
    !claude.findings.some(finding => finding.file === null && /2\.1\.277/.test(finding.message)),
    'nothing relies on direct reading here'
  );
});

test('explain follows the user setting that decides which instruction files Claude Code loads', t => {
  const { repo, run, claude, setInstructionFiles } = agentsOnlyRepo(t);
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), '- A rule only Claude Code needs, and it is long enough to count.\n');

  const shadowed = claude([repo]);
  assert.equal(statusOf(shadowed, 'AGENTS.md'), 'shadowed', 'by default a CLAUDE.md next to AGENTS.md is read instead');

  setInstructionFiles('claude-md-and-agents-md');
  const both = run([repo]);
  assert.equal(both.status, 0, both.stdout + both.stderr);
  const together = agentOf(parse(both.stdout), 'claude');
  assert.equal(statusOf(together, 'CLAUDE.md'), 'read');
  assert.equal(statusOf(together, 'AGENTS.md'), 'read');
  assert.deepEqual(
    together.findings.filter(finding => finding.kind === 'missing'),
    []
  );

  setInstructionFiles('claude-md');
  const only = run([repo]);
  assert.equal(only.status, 4, 'with claude-md the AGENTS.md never reaches Claude Code');
  const claudeMd = agentOf(parse(only.stdout), 'claude');
  assert.equal(statusOf(claudeMd, 'AGENTS.md'), 'not-read');
  assert.ok(
    claudeMd.findings.some(finding => finding.kind === 'missing' && finding.file === 'AGENTS.md'),
    JSON.stringify(claudeMd.findings)
  );
});
