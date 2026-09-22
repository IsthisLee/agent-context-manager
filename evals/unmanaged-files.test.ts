import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkArguments } from '../src/commands/options.ts';
import { COMMANDS } from '../src/commands/registry.ts';
import { CliError } from '../src/shared/errors.ts';
import { commandTokens } from '../src/tui/commands.ts';
import { recoveryFor } from '../src/tui/profile.ts';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/**
 * agctx가 쓴 적 없고 agctx 표지도 없는 파일이 이미 있으면, apply·sync는 그 파일에 손대지 않고 멈춘다.
 * 사람이 `--adopt`로 허락하면 기존 내용을 사용자 영역으로 남긴 채 agctx 관리 영역을 더한다(ADR 0043).
 */

function project(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-unmanaged-');
  const me = person('me');
  me.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const repo = folder('payments-api');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  const file = (rel: string) => path.join(repo, ...rel.split('/'));
  const exists = (rel: string) => fs.existsSync(file(rel));
  const read = (rel: string) => fs.readFileSync(file(rel), 'utf8');
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), content);
  };
  return { me, repo, exists, read, write };
}

const PERSON_CLAUDE = '# Notes a person wrote\n\nRun pnpm test before pushing.\n';

test('사람이 쓴 CLAUDE.md가 있으면 아무것도 쓰지 않고 멈추며 --adopt를 안내한다', t => {
  const { me, repo, exists, read, write } = project(t);
  write('CLAUDE.md', PERSON_CLAUDE);

  const preview = me.run(['profile', 'apply', 'team-backend', repo, '--dry-run']);
  assert.equal(preview.status, 2, preview.stdout + preview.stderr);
  assert.match(preview.stdout, /unmanaged\s+CLAUDE\.md/);

  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  assert.match(stopped.stderr, /CLAUDE\.md/);
  assert.match(stopped.stderr, /--adopt/);
  assert.equal(read('CLAUDE.md'), PERSON_CLAUDE);
  assert.ok(!exists('AGENTS.md'), '다른 파일도 쓰지 않는다');
  assert.ok(!exists('agctx.project.json'));

  const json = me.run(['profile', 'apply', 'team-backend', repo, '--yes', '--json']);
  assert.equal(json.status, 2);
  const envelope = JSON.parse(json.stdout);
  assert.equal(envelope.errors[0].code, 'project.unmanaged');
});

test('--adopt는 기존 내용을 그대로 두고 관리 블록을 더하며, 다음 sync부터는 묻지 않는다', t => {
  const { me, repo, read, write } = project(t);
  write('CLAUDE.md', PERSON_CLAUDE);
  const adopted = me.run(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  const claude = read('CLAUDE.md');
  assert.ok(claude.startsWith(PERSON_CLAUDE), '기존 내용이 맨 앞에 그대로 남는다');
  assert.match(claude, /<!-- agctx:managed:start -->[\s\S]*@AGENTS\.md[\s\S]*<!-- agctx:managed:end -->/);

  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 0, synced.stdout + synced.stderr);
  assert.equal(me.run(['check', repo]).status, 0);
});

test('표지 없는 기존 AGENTS.md도 멈추고, --adopt면 그 내용을 프로젝트 영역에 남긴다', t => {
  const { me, repo, read, write } = project(t);
  write('AGENTS.md', '# payments-api\n\n- Use idempotency keys for every payment request.\n');
  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  assert.match(stopped.stderr, /AGENTS\.md/);

  me.ok(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  const agents = read('AGENTS.md');
  const marker = agents.indexOf('<!-- agctx:managed:end -->');
  assert.ok(marker > 0);
  assert.ok(agents.indexOf('Use idempotency keys') > marker, '기존 규칙은 관리 영역 아래에 남는다');
});

test('빈 파일과 agctx 표지가 있는 파일은 묻지 않고 적용한다', t => {
  const { me, repo, write } = project(t);
  write('AGENTS.md', '\n');
  write(
    'CLAUDE.md',
    '<!-- agctx:managed:start -->\n# Claude Code instructions\n\n@AGENTS.md\n<!-- agctx:managed:end -->\n'
  );
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
});

test('sync도 --adopt를 받고, 없으면 같은 안내로 멈춘다', t => {
  const { me, repo, read, write } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  // 기록에 Claude Code를 더했는데 사람이 쓴 CLAUDE.md가 이미 있는 경우.
  const configPath = path.join(repo, 'agctx.project.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.writeFileSync(configPath, JSON.stringify({ ...config, agents: ['codex', 'claude'] }, null, 2));
  write('CLAUDE.md', PERSON_CLAUDE);

  const stopped = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  assert.match(stopped.stderr, /profile sync [^\n]*--adopt/);

  const repos = me.run(['repos', 'sync', '--dry-run']);
  assert.equal(repos.status, 2, repos.stdout + repos.stderr);
  assert.match(repos.stdout, /conflict\s+\S+\s+[^\n]*CLAUDE\.md/);

  const adopted = me.run(['profile', 'sync', repo, '--adopt', '--yes']);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  assert.ok(read('CLAUDE.md').startsWith(PERSON_CLAUDE));
});

test('TUI는 표지 없는 파일에서 멈추면 편입을 묻고, 답을 CLI의 --adopt로 넘긴다', () => {
  const unmanaged = new CliError('project.unmanaged', 'stop', {});
  const conflict = new CliError('project.conflict', 'stop', {});
  assert.equal(recoveryFor(unmanaged), 'adopt');
  assert.equal(recoveryFor(conflict), 'resolve');
  assert.equal(recoveryFor(new CliError('profile.not-found', 'x', {})), null);
  for (const id of ['profile.apply', 'profile.sync']) {
    const spec = COMMANDS.find(command => command.id === id);
    assert.ok(spec);
    const positional = id === 'profile.apply' ? ['team-backend', '/work/shop'] : ['/work/shop'];
    assert.deepEqual(checkArguments(spec, commandTokens(id, positional, { adopt: true })).options, { adopt: true });
  }
});

test('충돌과 표지 없는 파일이 함께 있으면 resolve도 --adopt 없이 그 파일을 쓰지 않는다', t => {
  const { me, repo, read, write } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  const configPath = path.join(repo, 'agctx.project.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.writeFileSync(configPath, JSON.stringify({ ...config, agents: ['codex', 'claude'] }, null, 2));
  write('CLAUDE.md', PERSON_CLAUDE);
  write('AGENTS.md', read('AGENTS.md').replace('## Project context', '## Project context (edited)'));

  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 2, synced.stdout + synced.stderr);
  assert.match(synced.stderr, /CLAUDE\.md/, '충돌 안내도 표지 없는 파일을 알린다');

  const resolved = me.run(['profile', 'resolve', repo, '--yes', '--json']);
  assert.equal(resolved.status, 2, resolved.stdout + resolved.stderr);
  assert.equal(JSON.parse(resolved.stdout).errors[0].code, 'project.unmanaged');
  assert.equal(read('CLAUDE.md'), PERSON_CLAUDE, 'resolve도 사람이 쓴 파일을 쓰지 않는다');
  assert.match(read('AGENTS.md'), /\(edited\)/, '아무것도 쓰지 않는다');

  const adopted = me.run(['profile', 'resolve', repo, '--adopt', '--yes']);
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr);
  assert.ok(read('CLAUDE.md').startsWith(PERSON_CLAUDE));
  assert.equal(me.run(['check', repo]).status, 0);
});

test('check는 표지 없는 파일을 sync와 같이 충돌(2)로 보고한다', t => {
  const { me, repo, write } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  const configPath = path.join(repo, 'agctx.project.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.writeFileSync(configPath, JSON.stringify({ ...config, agents: ['codex', 'claude'] }, null, 2));
  write('CLAUDE.md', PERSON_CLAUDE);
  const checked = me.run(['check', repo]);
  assert.equal(checked.status, 2, checked.stdout + checked.stderr);
  assert.match(checked.stdout, /CLAUDE\.md[^\n]*--adopt/);
});

test('안내는 멈춘 파일과 명령에 맞는 다음 단계를 말하고, --json 오류는 파일을 담는다', t => {
  const { me, repo, write } = project(t);
  write('AGENTS.md', '# payments-api\n');
  const agentsOnly = me.run(['profile', 'apply', 'team-backend', repo, '--yes', '--json']);
  const error = JSON.parse(agentsOnly.stdout).errors[0];
  assert.doesNotMatch(error.hint, /--agent/, 'AGENTS.md는 --agent로 피할 수 없다');
  assert.deepEqual(error.details, [{ file: 'AGENTS.md', kind: 'unmanaged' }]);

  fs.rmSync(path.join(repo, 'AGENTS.md'));
  write('AGENTS.md', '# payments-api\n');
  fs.symlinkSync('AGENTS.md', path.join(repo, 'CLAUDE.md'));
  const linked = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(linked.status, 2, linked.stdout + linked.stderr);
  assert.match(linked.stderr, /symbolic link/);
  assert.match(linked.stderr, /--agent codex,antigravity/, '심볼릭 링크는 --adopt 대신 Claude Code를 빼라고 안내한다');
  assert.match(
    linked.stderr,
    /agctx profile apply team-backend \S+ --agent codex,antigravity --adopt/,
    '심볼릭 링크는 빼고, 남는 AGENTS.md는 편입하는 명령 하나로 안내한다'
  );
  assert.doesNotMatch(
    linked.stderr,
    /run agctx profile apply team-backend \S+ --adopt/,
    '심볼릭 링크에 편입을 권하지 않는다'
  );
  const followed = me.run([
    'profile',
    'apply',
    'team-backend',
    repo,
    '--agent',
    'codex,antigravity',
    '--adopt',
    '--yes'
  ]);
  assert.equal(followed.status, 0, followed.stdout + followed.stderr);
  assert.ok(fs.lstatSync(path.join(repo, 'CLAUDE.md')).isSymbolicLink(), '심볼릭 링크는 그대로다');
});
