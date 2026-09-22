import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/** 패키지마다 자기 AGENTS.md를 두는 모노레포. 지침을 중첩해 두는 공개 모노레포 대부분이 이렇다. */
function monorepo(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-links-');
  const me = person('me');
  const userHome = folder('user-home');
  const env = {
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: path.join(userHome, '.codex'),
    CLAUDE_CONFIG_DIR: path.join(userHome, '.claude')
  };
  me.ok(['profile', 'create', 'company', '--scope', 'company'], env);
  const repo = folder('mono');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  const file = (rel: string) => path.join(repo, ...rel.split('/'));
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), content);
  };
  const read = (rel: string) => fs.readFileSync(file(rel), 'utf8');
  const agctx = (args: string[]) => me.run(args, env);
  const config = () => JSON.parse(read('agctx.project.json'));
  return { repo, file, write, read, agctx, config };
}

test('apply는 중첩된 AGENTS.md마다 Claude Code용 연결을 만들고, 사람이 쓴 CLAUDE.md는 건드리지 않는다', t => {
  const { repo, file, write, read, agctx, config } = monorepo(t);
  write('.gitignore', 'build/\n');
  write('services/payments/AGENTS.md', '# Payments\n\n- Use idempotency keys.\n');
  write('packages/web/AGENTS.md', '# Web\n');
  write('packages/web/CLAUDE.md', '# Notes a person wrote\n');
  write('packages/api/AGENTS.md', '# API\n');
  write('packages/api/CLAUDE.md', 'API notes.\n\n@AGENTS.md\n');
  write('node_modules/lib/AGENTS.md', '# A dependency\n');
  write('build/AGENTS.md', '# Ignored build output\n');
  write('nested-repo/AGENTS.md', '# Another repository\n');
  gitIn(file('nested-repo'), 'init', '--quiet', '--initial-branch=main');
  gitIn(repo, 'add', 'packages', '.gitignore');

  const preview = agctx(['profile', 'apply', 'company', repo, '--dry-run']);
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.match(preview.stdout, /create\s+services\/payments\/CLAUDE\.md/, '아직 커밋하지 않은 AGENTS.md도 연결한다');
  assert.ok(!fs.existsSync(file('services/payments/CLAUDE.md')));

  const applied = agctx(['profile', 'apply', 'company', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.match(
    read('services/payments/CLAUDE.md'),
    /<!-- agctx:managed:start -->[\s\S]*@AGENTS\.md[\s\S]*<!-- agctx:managed:end -->/
  );
  assert.equal(read('packages/web/CLAUDE.md'), '# Notes a person wrote\n');
  assert.equal(read('packages/api/CLAUDE.md'), 'API notes.\n\n@AGENTS.md\n');
  assert.match(applied.stderr, /packages\/web\/CLAUDE\.md[^\n]*AGENTS\.md/, 'import가 없는 CLAUDE.md는 경고를 받는다');
  assert.doesNotMatch(applied.stderr, /packages\/api\/CLAUDE\.md/);
  for (const skipped of ['node_modules/lib/CLAUDE.md', 'build/CLAUDE.md', 'nested-repo/CLAUDE.md'])
    assert.ok(!fs.existsSync(file(skipped)), skipped);
  assert.ok(config().managedHashes['services/payments/CLAUDE.md']);
  assert.equal(config().managedHashes['packages/web/CLAUDE.md'], undefined);

  const explained = JSON.parse(agctx(['explain', file('services/payments'), '--agent', 'claude', '--json']).stdout);
  assert.equal(
    explained.data.agents[0].files.find((entry: { path: string }) => entry.path === 'services/payments/AGENTS.md')
      ?.status,
    'read'
  );
  const fromRoot = JSON.parse(agctx(['explain', repo, '--agent', 'claude', '--json']).stdout);
  const web = fromRoot.data.agents[0].findings.find(
    (finding: { kind: string; file: string }) => finding.kind === 'missing' && finding.file === 'packages/web/AGENTS.md'
  );
  assert.match(web?.message ?? '', /packages\/web\/CLAUDE\.md/, 'missing 안내는 사람이 쓴 CLAUDE.md를 가리킨다');
  assert.doesNotMatch(web?.message ?? '', /profile sync/, 'sync는 그 파일을 건드리지 않으므로 제안하지 않는다');
  assert.equal(agctx(['check', repo]).status, 0);
});

test('sync는 새로 중첩된 AGENTS.md를 연결하고, 고친 연결 파일에서 멈추고, AGENTS.md가 사라진 연결은 관리를 그만둔다', t => {
  const { repo, file, write, read, agctx, config } = monorepo(t);
  write('services/payments/AGENTS.md', '# Payments\n');
  assert.equal(agctx(['profile', 'apply', 'company', repo, '--yes']).status, 0);

  write('services/orders/AGENTS.md', '# Orders\n');
  const linked = agctx(['profile', 'sync', repo, '--yes']);
  assert.equal(linked.status, 0, linked.stdout + linked.stderr);
  assert.ok(fs.existsSync(file('services/orders/CLAUDE.md')));

  const link = read('services/payments/CLAUDE.md');
  write('services/payments/CLAUDE.md', link.replace('@AGENTS.md', '@AGENTS.md\nEdited inside the managed block.'));
  const conflict = agctx(['profile', 'sync', repo, '--yes']);
  assert.equal(conflict.status, 2, conflict.stdout + conflict.stderr);
  assert.match(conflict.stdout + conflict.stderr, /services\/payments\/CLAUDE\.md/);
  write('services/payments/CLAUDE.md', link);

  fs.rmSync(file('services/orders/AGENTS.md'));
  const dropped = agctx(['profile', 'sync', repo, '--yes']);
  assert.equal(dropped.status, 0, dropped.stdout + dropped.stderr);
  assert.match(dropped.stderr, /services\/orders\/CLAUDE\.md/);
  assert.ok(fs.existsSync(file('services/orders/CLAUDE.md')), 'agctx는 파일을 지우지 않는다');
  assert.equal(config().managedHashes['services/orders/CLAUDE.md'], undefined);
  assert.equal(agctx(['check', repo]).status, 0);
});

test('repos sync는 연결 파일의 커밋하지 않은 수정을 다른 관리 파일과 똑같이 다룬다', t => {
  const { repo, write, read, agctx } = monorepo(t);
  write('services/payments/AGENTS.md', '# Payments\n');
  assert.equal(agctx(['profile', 'apply', 'company', repo, '--yes']).status, 0);
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '--quiet', '-m', 'Apply the company profile');
  write('services/payments/CLAUDE.md', `${read('services/payments/CLAUDE.md')}\nA note below the managed block.\n`);

  const preview = agctx(['repos', 'sync', '--profile', 'company', '--dry-run']);
  assert.match(preview.stdout, /dirty\s+\S*mono\s+.*services\/payments\/CLAUDE\.md/, preview.stdout + preview.stderr);
});
