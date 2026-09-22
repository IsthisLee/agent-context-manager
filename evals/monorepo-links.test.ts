import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/** A monorepo whose packages keep their own AGENTS.md, as most public monorepos with nested guidance do. */
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

test('apply links each nested AGENTS.md for Claude Code and leaves CLAUDE.md files people wrote alone', t => {
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
  assert.match(
    preview.stdout,
    /create\s+services\/payments\/CLAUDE\.md/,
    'an AGENTS.md not yet committed is linked too'
  );
  assert.ok(!fs.existsSync(file('services/payments/CLAUDE.md')));

  const applied = agctx(['profile', 'apply', 'company', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.match(
    read('services/payments/CLAUDE.md'),
    /<!-- agctx:managed:start -->[\s\S]*@AGENTS\.md[\s\S]*<!-- agctx:managed:end -->/
  );
  assert.equal(read('packages/web/CLAUDE.md'), '# Notes a person wrote\n');
  assert.equal(read('packages/api/CLAUDE.md'), 'API notes.\n\n@AGENTS.md\n');
  assert.match(
    applied.stderr,
    /packages\/web\/CLAUDE\.md[^\n]*AGENTS\.md/,
    'a CLAUDE.md without the import gets a warning'
  );
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
  assert.match(
    web?.message ?? '',
    /packages\/web\/CLAUDE\.md/,
    'the missing note points at the CLAUDE.md a person wrote'
  );
  assert.doesNotMatch(web?.message ?? '', /profile sync/, 'sync would not touch that file, so it is not suggested');
  assert.equal(agctx(['check', repo]).status, 0);
});

test('sync links new nested AGENTS.md files, stops on an edited link, and stops managing a link whose AGENTS.md is gone', t => {
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
  assert.ok(fs.existsSync(file('services/orders/CLAUDE.md')), 'agctx never deletes a file');
  assert.equal(config().managedHashes['services/orders/CLAUDE.md'], undefined);
  assert.equal(agctx(['check', repo]).status, 0);
});

test('repos sync treats an uncommitted edit to a link file like one to any managed file', t => {
  const { repo, write, read, agctx } = monorepo(t);
  write('services/payments/AGENTS.md', '# Payments\n');
  assert.equal(agctx(['profile', 'apply', 'company', repo, '--yes']).status, 0);
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '--quiet', '-m', 'Apply the company profile');
  write('services/payments/CLAUDE.md', `${read('services/payments/CLAUDE.md')}\nA note below the managed block.\n`);

  const preview = agctx(['repos', 'sync', '--profile', 'company', '--dry-run']);
  assert.match(preview.stdout, /dirty\s+\S*mono\s+.*services\/payments\/CLAUDE\.md/, preview.stdout + preview.stderr);
});
