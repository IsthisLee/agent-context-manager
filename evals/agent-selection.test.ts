import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkArguments } from '../src/commands/options.ts';
import { COMMANDS } from '../src/commands/registry.ts';
import { commandTokens } from '../src/tui/commands.ts';
import { agentAnswer, agentPrompt } from '../src/tui/profile.ts';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/**
 * 저장소마다 적용할 에이전트를 고른다. 고른 목록은 agctx.project.json의 `agents`에 남아서, 다른 팀원의
 * sync나 repos sync가 뺀 파일을 다시 만들지 않는다. `AGENTS.md`는 모든 에이전트가 읽는 정본이라
 * 늘 쓴다. 고르는 것은 Claude Code의 `CLAUDE.md`·연결 파일과 Antigravity의 규칙 파일이다.
 */

function project(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-agents-');
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
  const config = () => JSON.parse(read('agctx.project.json'));
  return { me, repo, file, exists, read, write, config };
}

test('--agent로 고른 에이전트의 파일만 만들고 선택을 기록한다', t => {
  const { me, repo, exists, config } = project(t);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude,codex', '--yes', '--json']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(exists('AGENTS.md'));
  assert.ok(exists('CLAUDE.md'));
  assert.ok(!exists('.agents/rules/agctx.md'), 'Antigravity 규칙 파일은 만들지 않는다');
  assert.ok(!exists('.agctx/base/.agents/rules/agctx.md.base'));
  assert.deepEqual(config().agents, ['codex', 'claude'], '등록 순서로 기록한다');
  assert.equal(config().managedHashes['.agents/rules/agctx.md'], undefined);
  assert.deepEqual(JSON.parse(applied.stdout).data.agents, ['codex', 'claude']);

  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 0, synced.stderr);
  assert.ok(!exists('.agents/rules/agctx.md'), 'sync는 기록한 선택을 따른다');
  assert.match(synced.stdout, /already up to date/);
  assert.equal(me.run(['check', repo]).status, 0, 'check도 기록한 파일만 본다');

  const again = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(again.status, 0, again.stderr);
  assert.ok(!exists('.agents/rules/agctx.md'), '--agent 없이 다시 적용해도 기록을 따른다');
  assert.deepEqual(config().agents, ['codex', 'claude']);
});

test('뺀 에이전트는 관리 블록만 지우고, 사람이 쓴 내용이 있으면 파일을 남긴다', t => {
  const { me, repo, exists, read, write, config } = project(t);
  write('CLAUDE.md', '# Notes a person wrote\n\nRun pnpm test before pushing.\n');
  me.ok(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  assert.match(read('CLAUDE.md'), /agctx:managed:start/);

  const preview = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--dry-run']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /update\s+CLAUDE\.md/, '사람이 쓴 내용이 있는 파일은 지우지 않고 고친다');
  assert.match(preview.stdout, /remove\s+\.agents\/rules\/agctx\.md/);
  assert.match(preview.stdout, /remove\s+\.agctx\/base\/CLAUDE\.md\.base/);
  assert.ok(exists('.agents/rules/agctx.md'), 'dry-run은 지우지 않는다');

  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(read('CLAUDE.md'), '# Notes a person wrote\n\nRun pnpm test before pushing.\n');
  assert.ok(!exists('.agents/rules/agctx.md'));
  assert.ok(!exists('.agctx/base/CLAUDE.md.base'));
  assert.ok(!exists('.agctx/base/.agents/rules/agctx.md.base'));
  assert.deepEqual(Object.keys(config().managedHashes), ['AGENTS.md']);
  assert.deepEqual(config().agents, ['codex']);
  assert.equal(me.run(['check', repo]).status, 0);

  const back = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'all', '--adopt', '--yes']);
  assert.equal(back.status, 0, back.stderr);
  assert.equal(config().agents, undefined, 'all은 기록을 지워 지원 에이전트 전부를 뜻하게 한다');
  assert.ok(exists('.agents/rules/agctx.md'));
  assert.match(read('CLAUDE.md'), /Notes a person wrote[\s\S]*agctx:managed:start/);
});

test('관리 블록을 고친 파일을 빼려 하면 멈추고, resolve가 고친 줄을 남기고 블록을 지운다', t => {
  const { me, repo, exists, read, write, config } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--yes']);
  write('CLAUDE.md', read('CLAUDE.md').replace('@AGENTS.md', '@AGENTS.md\n- Always answer in Korean.'));

  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex,antigravity', '--yes']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  assert.match(read('CLAUDE.md'), /Always answer in Korean/);
  assert.equal(config().agents, undefined, '멈추면 선택도 기록하지 않는다');

  // 선택은 apply가 기록해야 하므로, 사용자는 먼저 충돌을 풀고 다시 apply한다.
  me.ok(['profile', 'resolve', repo, '--yes']);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex,antigravity', '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.ok(exists('CLAUDE.md'), '옮긴 줄은 사람이 쓴 내용이라 파일이 남는다');
  assert.equal(read('CLAUDE.md'), '- Always answer in Korean.\n');
  assert.ok(exists('.agents/rules/agctx.md'));
});

test('Claude Code를 빼면 하위 폴더 연결 파일도 지우고, 사람이 둔 CLAUDE.md는 건드리지 않는다', t => {
  const { me, repo, exists, read, write, config } = project(t);
  write('services/payments/AGENTS.md', '# Payments\n');
  write('packages/web/AGENTS.md', '# Web\n');
  write('packages/web/CLAUDE.md', '# Notes a person wrote\n');
  me.ok(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.ok(exists('services/payments/CLAUDE.md'));

  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex,antigravity', '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(!exists('services/payments/CLAUDE.md'));
  assert.ok(!exists('CLAUDE.md'));
  assert.equal(read('packages/web/CLAUDE.md'), '# Notes a person wrote\n');
  assert.doesNotMatch(applied.stderr, /packages\/web\/CLAUDE\.md/, '고르지 않은 에이전트의 연결 경고는 내지 않는다');
  assert.deepEqual(Object.keys(config().managedHashes).sort(), ['.agents/rules/agctx.md', 'AGENTS.md']);
});

test('모르는 에이전트 이름과 잘못 기록된 선택은 사용법 오류다', t => {
  const { me, repo, write } = project(t);
  const unknown = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'cursor', '--yes']);
  assert.equal(unknown.status, 64);
  assert.match(unknown.stderr, /cursor/);
  assert.match(unknown.stderr, /codex, claude, antigravity, or all/);

  write('agctx.project.json', JSON.stringify({ schemaVersion: 2, profile: 'team-backend', agents: ['cursor'] }));
  const broken = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(broken.status, 64, broken.stderr);
  assert.match(broken.stderr, /agents/);
});

test('explain과 verify는 고르지 않은 에이전트를 누락과 구분해 보고한다', t => {
  const { me, repo, config } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  assert.deepEqual(config().agents, ['codex']);

  const explained = me.run(['explain', repo, '--json']);
  assert.notEqual(explained.status, 4, '고르지 않은 에이전트의 누락은 종료 코드 4로 세지 않는다');
  const agents = JSON.parse(explained.stdout).data.agents;
  const antigravity = agents.find((agent: { agent: string }) => agent.agent === 'antigravity');
  assert.equal(antigravity.selected, false);
  assert.ok(antigravity.findings.some((finding: { kind: string }) => finding.kind === 'not-selected'));
  assert.equal(agents.find((agent: { agent: string }) => agent.agent === 'codex').selected, true);

  const text = me.run(['explain', repo]);
  assert.match(text.stdout, /not-selected/);

  const verified = me.run(['verify', repo, '--json']);
  const statuses = Object.fromEntries(
    JSON.parse(verified.stdout).data.agents.map((agent: { agent: string; status: string }) => [
      agent.agent,
      agent.status
    ])
  );
  assert.equal(statuses.antigravity, 'not-selected');
  assert.equal(statuses.claude, 'not-selected');
  assert.notEqual(statuses.codex, 'not-selected');
});

test('repos sync도 기록한 선택을 따른다', t => {
  const { me, repo, exists } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  fs.appendFileSync(path.join(me.profileDir('team-backend'), 'AGENTS.md'), '\n- Keep migrations reversible.\n');
  const synced = me.run(['repos', 'sync', '--yes']);
  assert.equal(synced.status, 0, synced.stdout + synced.stderr);
  assert.match(synced.stdout, /updated/);
  assert.ok(!exists('CLAUDE.md'));
  assert.ok(!exists('.agents/rules/agctx.md'));
});

test('TUI는 기록한 선택을 미리 체크하고, 답을 CLI의 --agent로 넘긴다', t => {
  const { me, repo, write } = project(t);
  assert.deepEqual(agentPrompt(repo), ['codex', 'claude', 'antigravity'], '기록이 없으면 전부 체크한다');
  write('agctx.project.json', JSON.stringify({ schemaVersion: 2, profile: 'team-backend', agents: ['claude'] }));
  assert.deepEqual(agentPrompt(repo), ['claude']);
  assert.equal(agentAnswer(['codex', 'claude', 'antigravity']), 'all');
  assert.equal(agentAnswer(['antigravity', 'codex']), 'codex,antigravity');
  const apply = COMMANDS.find(command => command.id === 'profile.apply');
  assert.ok(apply);
  const parsed = checkArguments(apply, commandTokens('profile.apply', ['team-backend', repo], { agent: 'codex' }));
  assert.deepEqual(parsed.options, { agent: 'codex' });
  assert.ok(me.home);
});

test('agctx.project.json에 프로젝트 밖을 가리키는 경로가 있으면 아무것도 지우지 않고 멈춘다', t => {
  const { person, folder } = makeWorkspace(t, 'agctx-agents-escape-');
  const me = person('me');
  me.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const victim = folder('victim');
  const attacker = folder('attacker');
  me.ok(['profile', 'apply', 'team-backend', victim, '--yes']);
  me.ok(['profile', 'apply', 'team-backend', attacker, '--agent', 'codex', '--yes']);
  const victimHash = JSON.parse(fs.readFileSync(path.join(victim, 'agctx.project.json'), 'utf8')).managedHashes[
    'CLAUDE.md'
  ];
  const configPath = path.join(attacker, 'agctx.project.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const key of ['../victim/CLAUDE.md', `${victim}/CLAUDE.md`, 'a/../../victim/CLAUDE.md']) {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ ...config, managedHashes: { ...config.managedHashes, [key]: victimHash } }, null, 2)
    );
    const synced = me.run(['profile', 'sync', attacker, '--yes']);
    assert.equal(synced.status, 64, `${key}\n${synced.stdout}${synced.stderr}`);
    assert.match(synced.stderr, /managedHashes/);
    assert.ok(fs.existsSync(path.join(victim, 'CLAUDE.md')), `${key}: 프로젝트 밖의 파일은 남는다`);
  }
});

test('explain의 안내는 지금 고른 에이전트를 빼지 않는 명령을 보여 주고, 빈 --agent는 사용법 오류다', t => {
  const { me, repo } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  const explained = JSON.parse(me.run(['explain', repo, '--json']).stdout).data.agents;
  const antigravity = explained.find((agent: { agent: string }) => agent.agent === 'antigravity');
  const hint = antigravity.findings.find((finding: { kind: string }) => finding.kind === 'not-selected').message;
  assert.match(hint, /agctx profile apply team-backend --agent claude,antigravity/);
  const codex = explained.find((agent: { agent: string }) => agent.agent === 'codex');
  assert.match(
    codex.findings.find((finding: { kind: string }) => finding.kind === 'not-selected').message,
    /still writes AGENTS\.md/
  );
  const empty = me.run(['profile', 'apply', 'team-backend', repo, '--agent', '', '--yes']);
  assert.equal(empty.status, 64, empty.stdout + empty.stderr);
});
