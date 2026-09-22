import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { commitAndPush, fakeGh, gitIn, makeWorkspace, publishProfile, serviceRepo } from './support/git-workspace.ts';

/**
 * 프로필의 skills·subagents·hooks를 에이전트마다 저장소에 쓴다(ADR 0046). skills·subagents 파일은 agctx가
 * 파일째 소유하고, hooks는 사람이 둔 hooks 옆에 agctx가 넣은 항목만 소유한다. hooks는 다른 사람의
 * 컴퓨터에서 실행될 명령이라 저장소가 `include`로 고른 때만 쓰고, 쓰기 전에 명령을 보여 준다.
 */

const SKILL = `---
name: review
description: 변경을 리뷰할 때 쓴다.
---

# 리뷰

1. \`scripts/check.sh\`를 실행한다.
`;
const CHECK_SCRIPT = '#!/bin/sh\necho checked\n';
const SUBAGENT = `---
name: reviewer
description: 변경을 읽고 위험을 찾는다.
tools: Read, Grep
model: sonnet
---

변경된 파일을 읽고 위험한 곳을 짚는다.
`;
const HOOKS = {
  hooks: {
    'format-on-edit': {
      claude: {
        PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'pnpm run format' }] }]
      },
      codex: {
        PostToolUse: [{ matcher: 'apply_patch', hooks: [{ type: 'command', command: 'pnpm run format' }] }]
      },
      antigravity: {
        PostToolUse: [{ matcher: 'replace_file_content', hooks: [{ type: 'command', command: 'pnpm run format' }] }]
      }
    }
  }
};

function project(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-artifacts-');
  const me = person('me');
  me.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const profileDir = me.profileDir('team-backend');
  const profileFile = (rel: string) => path.join(profileDir, ...rel.split('/'));
  const setProfile = (rel: string, content: string | null, mode?: number) => {
    const file = profileFile(rel);
    if (content === null) {
      fs.rmSync(file, { recursive: true, force: true });
      return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    if (mode !== undefined) fs.chmodSync(file, mode);
  };
  setProfile('skills/review/SKILL.md', SKILL);
  setProfile('skills/review/scripts/check.sh', CHECK_SCRIPT, 0o755);
  setProfile('subagents/reviewer.md', SUBAGENT);
  setProfile('hooks.json', JSON.stringify(HOOKS, null, 2));
  const repo = folder('payments-api');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  const file = (rel: string) => path.join(repo, ...rel.split('/'));
  const exists = (rel: string) => fs.existsSync(file(rel));
  const read = (rel: string) => fs.readFileSync(file(rel), 'utf8');
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), content);
  };
  const json = (rel: string) => JSON.parse(read(rel));
  const config = () => json('agctx.project.json');
  return { me, repo, file, exists, read, write, json, config, setProfile, profileDir };
}

test('프로필의 skills와 subagents를 에이전트마다 저장소에 쓰고 파일마다 기록한다', t => {
  const { me, repo, file, exists, read, config } = project(t);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes', '--json']);
  assert.equal(applied.status, 0, applied.stderr);
  const result = JSON.parse(applied.stdout);
  const data = result.data;
  const warnings = result.warnings.join('\n');
  assert.deepEqual(data.skills, ['review']);
  assert.deepEqual(data.subagents, ['reviewer']);
  assert.deepEqual(data.hooks, []);
  assert.match(applied.stderr, /Skills from the profile: review/);
  assert.match(applied.stderr, /Subagents from the profile: reviewer/);

  // skills는 Claude Code 위치와, Codex·Antigravity가 함께 읽는 위치에 그대로 복사한다.
  for (const root of ['.claude/skills', '.agents/skills']) {
    assert.equal(read(`${root}/review/SKILL.md`), SKILL);
    assert.equal(read(`${root}/review/scripts/check.sh`), CHECK_SCRIPT);
    if (process.platform !== 'win32')
      assert.equal(fs.statSync(file(`${root}/review/scripts/check.sh`)).mode & 0o111, 0o111, '실행 권한을 지킨다');
  }
  // Claude Code는 프로필 파일 그대로 받는다.
  assert.equal(read('.claude/agents/reviewer.md'), SUBAGENT);
  // Antigravity가 저장소의 subagents를 읽는 것은 확인하지 못해 쓰지 않고 알린다.
  assert.equal(exists('.agents/agents'), false);
  assert.match(warnings, /Antigravity does not get the profile subagents and hooks yet/);
  // Codex는 TOML 파일 하나에 한 subagent를 쓴다.
  assert.equal(
    read('.codex/agents/reviewer.toml'),
    '# Subagent from the agctx profile. Change it in the profile, not here.\nname = "reviewer"\ndescription = "변경을 읽고 위험을 찾는다."\ndeveloper_instructions = """\n변경된 파일을 읽고 위험한 곳을 짚는다.\n"""\n'
  );
  assert.match(warnings, /subagent reviewer: tools, model are not written for Codex;/);

  const hashes = config().managedHashes;
  for (const rel of [
    '.claude/skills/review/SKILL.md',
    '.claude/skills/review/scripts/check.sh',
    '.agents/skills/review/SKILL.md',
    '.agents/skills/review/scripts/check.sh',
    '.claude/agents/reviewer.md',
    '.codex/agents/reviewer.toml'
  ])
    assert.ok(hashes[rel], `${rel}을 기록한다`);
  // hooks는 기록이 없는 저장소에 쓰지 않는다.
  assert.equal(exists('.claude/settings.json'), false);
  assert.equal(exists('.codex/hooks.json'), false);
  assert.equal(exists('.agents/hooks.json'), false);
  assert.match(warnings, /hooks.*--include/);

  me.ok(['check', repo]);
  const again = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /up to date/);
});

test('고른 에이전트의 위치에만 쓰고, 에이전트를 빼면 그 에이전트의 파일을 지운다', t => {
  const { me, repo, exists } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  assert.ok(exists('.claude/skills/review/SKILL.md'));
  assert.ok(exists('.claude/agents/reviewer.md'));
  assert.equal(exists('.agents/skills'), false);
  assert.equal(exists('.codex/agents'), false);

  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  assert.equal(exists('.claude/skills'), false, '빈 폴더까지 지운다');
  assert.equal(exists('.claude/agents'), false);
  assert.ok(exists('.agents/skills/review/SKILL.md'));
  assert.ok(exists('.codex/agents/reviewer.toml'));
});

test('프로필에서 skill을 빼면 그 파일만 지우고 사람이 둔 skill은 남긴다', t => {
  const { me, repo, exists, write, config, setProfile } = project(t);
  write('.claude/skills/mine/SKILL.md', '---\nname: mine\ndescription: 내 것\n---\n');
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  setProfile('skills/review', null);
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 0, synced.stderr);
  assert.equal(exists('.claude/skills/review'), false);
  assert.ok(exists('.claude/skills/mine/SKILL.md'));
  assert.equal(config().managedHashes['.claude/skills/review/SKILL.md'], undefined);
  assert.equal(exists('.agctx/base/.claude/skills/review/SKILL.md.base'), false);
});

test('사람이 같은 이름의 skill을 이미 두었으면 --adopt로도 덮어쓰지 않고 멈춘다', t => {
  const { me, repo, read, write } = project(t);
  write('.claude/skills/review/SKILL.md', '---\nname: review\ndescription: 우리 팀 것\n---\n');
  for (const extra of [[], ['--adopt']]) {
    const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes', ...extra]);
    assert.equal(stopped.status, 2, stopped.stderr);
    assert.match(stopped.stderr, /\.claude\/skills\/review\/SKILL\.md/);
    assert.match(stopped.stderr, /already/);
  }
  assert.match(read('.claude/skills/review/SKILL.md'), /우리 팀 것/);
});

test('사람이 둔 파일이 프로필과 똑같으면 멈추지 않고 agctx가 맡는다', t => {
  const { me, repo, write, config } = project(t);
  write('.claude/skills/review/SKILL.md', SKILL);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(config().managedHashes['.claude/skills/review/SKILL.md']);
});

test('agctx가 쓴 skill 파일을 고치면 충돌로 멈추고, resolve --discard가 백업한 뒤 되돌린다', t => {
  const { me, repo, read, write, exists } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  write('.claude/skills/review/SKILL.md', `${SKILL}\n- 손으로 더한 줄\n`);

  const checked = me.run(['check', repo]);
  assert.equal(checked.status, 2, checked.stdout);
  assert.match(checked.stdout, /\.claude\/skills\/review\/SKILL\.md/);
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 2, synced.stderr);

  const resolved = me.run(['profile', 'resolve', repo, '--discard', '--yes']);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(read('.claude/skills/review/SKILL.md'), SKILL);
  const backups = fs.readdirSync(path.join(repo, '.agctx', 'backups'));
  assert.equal(backups.length, 1);
  assert.ok(exists(`.agctx/backups/${backups[0]}/.claude/skills/review/SKILL.md`));
});

test('hooks는 저장소가 고른 때만 쓰고, 쓰기 전에 실행될 명령을 보여 주고, 사람이 둔 설정과 hooks는 그대로 둔다', t => {
  const { me, repo, write, json, config } = project(t);
  const human = {
    permissions: { allow: ['Bash(pnpm test)'] },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] }
  };
  write('.claude/settings.json', JSON.stringify(human, null, 2));
  write('.agents/hooks.json', JSON.stringify({ mine: { Stop: [{ type: 'command', command: 'echo bye' }] } }));

  // 터미널이 아니면 --yes 없이 쓰지 않는다. 계획에는 에이전트마다 실행될 명령이 나온다.
  const asked = me.run([
    'profile',
    'apply',
    'team-backend',
    repo,
    '--include',
    'rules,mcp,skills,subagents,hooks',
    '--adopt'
  ]);
  assert.equal(asked.status, 64, asked.stderr);
  assert.match(asked.stdout, /Hooks from the profile run these commands/);
  assert.match(asked.stdout, /format-on-edit: Claude Code PostToolUse Edit\|Write: pnpm run format/);
  assert.match(asked.stdout, /format-on-edit: Codex PostToolUse apply_patch: pnpm run format/);
  assert.match(asked.stdout, /Codex runs a new or changed project hook only after/);

  const applied = me.run([
    'profile',
    'apply',
    'team-backend',
    repo,
    '--include',
    'rules,mcp,skills,subagents,hooks',
    '--adopt',
    '--yes',
    '--json'
  ]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout).data.hooks, ['format-on-edit']);
  assert.deepEqual(config().include, ['rules', 'mcp', 'skills', 'subagents', 'hooks']);

  assert.deepEqual(json('.claude/settings.json'), {
    permissions: { allow: ['Bash(pnpm test)'] },
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }],
      PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'pnpm run format' }] }]
    }
  });
  assert.deepEqual(json('.codex/hooks.json'), {
    hooks: { PostToolUse: [{ matcher: 'apply_patch', hooks: [{ type: 'command', command: 'pnpm run format' }] }] }
  });
  // Antigravity의 hooks 파일은 읽는 것을 확인하지 못해 건드리지 않는다.
  assert.deepEqual(json('.agents/hooks.json'), { mine: { Stop: [{ type: 'command', command: 'echo bye' }] } });
  me.ok(['check', repo]);

  // 프로필에서 hooks를 빼면 agctx가 넣은 항목만 지우고, agctx 것만 있던 파일은 지운다.
  me.ok(['profile', 'apply', 'team-backend', repo, '--include', 'rules,skills,subagents', '--yes']);
  assert.deepEqual(json('.claude/settings.json'), human);
  assert.equal(fs.existsSync(path.join(repo, '.codex', 'hooks.json')), false);
});

test('agctx가 넣은 hook을 사람이 고치면 충돌로 멈춘다', t => {
  const { me, repo, read, write } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--include', 'rules,hooks', '--yes']);
  write('.claude/settings.json', read('.claude/settings.json').replace('pnpm run format', 'pnpm run lint'));
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 2, synced.stderr);
  assert.match(synced.stderr, /\.claude\/settings\.json/);
});

test('사람이 둔 hook과 똑같은 묶음이 있어도 사람의 것은 남기고 agctx 것만 뺀다', t => {
  const { me, repo, write, json, setProfile } = project(t);
  const group = { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'pnpm run format' }] };
  write('.claude/settings.json', JSON.stringify({ hooks: { PostToolUse: [group] } }, null, 2));
  me.ok([
    'profile',
    'apply',
    'team-backend',
    repo,
    '--agent',
    'claude',
    '--include',
    'rules,mcp,skills,subagents,hooks',
    '--adopt',
    '--yes'
  ]);
  assert.deepEqual(json('.claude/settings.json'), { hooks: { PostToolUse: [group, group] } });
  setProfile('hooks.json', null);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.deepEqual(json('.claude/settings.json'), { hooks: { PostToolUse: [group] } });
});

test('프로필의 skills·subagents·hooks 형식이 틀리면 어디가 틀렸는지 말하고 멈춘다', t => {
  const cases: [string, string, RegExp][] = [
    ['skills/lint/README.md', '# no SKILL.md', /skills\/lint.*SKILL\.md/],
    ['skills/lint/SKILL.md', '---\nname: other\ndescription: x\n---\n', /skills\/lint\/SKILL\.md.*name/],
    ['skills/Lint/SKILL.md', '---\nname: Lint\ndescription: x\n---\n', /Lint/],
    ['subagents/helper.md', 'no frontmatter\n', /subagents\/helper\.md/],
    ['hooks.json', JSON.stringify({ hooks: { x: { claude: { NotAnEvent: [] } } } }), /NotAnEvent/],
    ['hooks.json', JSON.stringify({ hooks: { x: { cursor: {} } } }), /cursor/]
  ];
  for (const [rel, content, message] of cases) {
    const { me, repo, setProfile } = project(t);
    setProfile(rel, content);
    const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
    assert.equal(stopped.status, 64, `${rel}: ${stopped.stderr}`);
    assert.match(stopped.stderr, message, rel);
  }
});

test('프로필의 skill 파일에 숨은 문자가 있으면 쓰지 않는다', t => {
  const { me, repo, exists, setProfile } = project(t);
  setProfile('skills/review/SKILL.md', SKILL.replace('# 리뷰', '# 리뷰‮'));
  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.notEqual(stopped.status, 0);
  assert.match(stopped.stderr, /skills\/review\/SKILL\.md/);
  assert.equal(exists('.claude/skills'), false);
});

test('skill 안의 AGENTS.md에는 Claude Code 연결 파일을 만들지 않는다', t => {
  const { me, repo, exists, setProfile } = project(t);
  setProfile('skills/review/AGENTS.md', '# 참고\n');
  me.ok(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.ok(exists('.claude/skills/review/AGENTS.md'));
  assert.equal(exists('.claude/skills/review/CLAUDE.md'), false);
  assert.equal(exists('.agents/skills/review/CLAUDE.md'), false);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.equal(exists('.agents/skills/review/CLAUDE.md'), false);
});

test('고정한 저장소는 커밋한 skills를 쓰고, 커밋하지 않은 skill 수정이 있으면 고정하지 않는다', t => {
  const { me, repo, read, setProfile, profileDir } = project(t);
  gitIn(profileDir, 'init', '--quiet', '--initial-branch=main');
  gitIn(profileDir, 'add', '-A');
  gitIn(profileDir, 'commit', '--quiet', '-m', 'init');
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--pin', '--yes']);

  setProfile('skills/review/SKILL.md', SKILL.replace('# 리뷰', '# 바뀐 리뷰'));
  const refused = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--pin', '--yes']);
  assert.equal(refused.status, 64, refused.stderr);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.equal(read('.claude/skills/review/SKILL.md'), SKILL, '고정한 커밋의 내용을 쓴다');
});

test('repos sync는 hooks가 바뀌는 저장소를 쓰지 않고, 명령을 보여 주는 profile sync로 넘긴다', t => {
  const { me, repo, read, setProfile } = project(t);
  const include = ['--include', 'rules,skills,subagents,hooks'];
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', ...include, '--yes']);
  const before = read('.claude/settings.json');
  setProfile(
    'hooks.json',
    JSON.stringify(HOOKS).replace(
      '"Edit|Write","hooks":[{"type":"command","command":"pnpm run format"',
      '"Edit|Write","hooks":[{"type":"command","command":"pnpm run lint"'
    )
  );
  const synced = me.run(['repos', 'sync', '--yes', '--json']);
  assert.equal(synced.status, 1, synced.stderr);
  const [item] = JSON.parse(synced.stdout).data.repos;
  assert.equal(item.state, 'review');
  assert.deepEqual(item.files, ['.claude/settings.json']);
  assert.equal(read('.claude/settings.json'), before, '확인 없이 hooks를 바꾸지 않는다');

  const reviewed = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.match(reviewed.stdout, /format-on-edit: Claude Code PostToolUse Edit\|Write: pnpm run lint/);
  assert.match(read('.claude/settings.json'), /pnpm run lint/);
});

test('profile view는 프로필의 skills·subagents·hooks 이름을 보여 준다', t => {
  const { me } = project(t);
  const viewed = JSON.parse(me.run(['profile', 'view', 'team-backend', '--json']).stdout).data;
  assert.deepEqual(viewed.skills, ['review']);
  assert.deepEqual(viewed.subagents, ['reviewer']);
  assert.deepEqual(viewed.hooks, ['format-on-edit']);
  const text = me.run(['profile', 'view', 'team-backend']).stdout;
  assert.match(text, /Skills: review/);
  assert.match(text, /Subagents: reviewer/);
  assert.match(text, /Hooks: format-on-edit/);
});

test('clone은 skill 파일이 심볼릭 링크인 프로필 저장소를 받지 않는다', t => {
  const { person, folder } = makeWorkspace(t, 'agctx-artifacts-clone-');
  const admin = person('admin');
  admin.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const dir = admin.profileDir('team-backend');
  const secret = path.join(folder('outside'), 'id_rsa');
  fs.writeFileSync(secret, 'secret');
  fs.mkdirSync(path.join(dir, 'skills', 'leak'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', 'leak', 'SKILL.md'), '---\nname: leak\ndescription: x\n---\n');
  fs.symlinkSync(secret, path.join(dir, 'skills', 'leak', 'key'));
  gitIn(dir, 'init', '--quiet', '--initial-branch=main');
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile');
  const dev = person('dev');
  const cloned = dev.run(['profile', 'clone', dir]);
  assert.equal(cloned.status, 64, cloned.stdout + cloned.stderr);
  assert.match(cloned.stderr, /skills\/leak\/key[^\n]*symbolic link/);
  assert.ok(!fs.existsSync(dev.profileDir('team-backend')));
});

test('TUI는 프로필에 있는 종류만 묻고, hooks는 기록이 없으면 고르지 않은 채로 둔다', async t => {
  const { me, repo, setProfile } = project(t);
  const previous = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = me.home;
  t.after(() => {
    if (previous === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previous;
  });
  const { artifactPrompt, includeAnswer } = await import('../src/tui/profile.ts');
  assert.deepEqual(artifactPrompt('team-backend'), [
    { kind: 'skills', count: 1 },
    { kind: 'subagents', count: 1 },
    { kind: 'hooks', count: 1 }
  ]);
  assert.deepEqual(artifactPrompt('team-backend', ['antigravity']), [{ kind: 'skills', count: 1 }]);
  setProfile('hooks.json', null);
  assert.deepEqual(
    artifactPrompt('team-backend').map(entry => entry.kind),
    ['skills', 'subagents']
  );
  const offered = ['skills', 'subagents', 'hooks'] as const;
  assert.equal(includeAnswer(offered, ['skills', 'subagents'], null), 'all');
  assert.equal(includeAnswer(offered, ['skills', 'subagents', 'hooks'], null), 'rules,mcp,skills,subagents,hooks');
  assert.equal(includeAnswer(offered, [], ['rules']), 'rules');
  assert.equal(includeAnswer(['mcp'], [], null), 'rules,skills,subagents');
  assert.ok(repo);
});

test('Git 프로필은 .gitignore가 가린 파일과 로컬 부산물을 나눠 주지 않고, --pin은 커밋한 내용을 쓴다', t => {
  const { me, repo, exists, read, setProfile, profileDir } = project(t);
  setProfile('.gitignore', '.env\n__pycache__/\n');
  gitIn(profileDir, 'init', '--quiet', '--initial-branch=main');
  gitIn(profileDir, 'add', '-A');
  gitIn(profileDir, 'commit', '--quiet', '-m', 'init');
  setProfile('skills/review/.env', 'TOKEN=secret\n');
  setProfile('skills/review/__pycache__/x.pyc', '\u0000binary');
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--pin', '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(exists('.claude/skills/review/.env'), false);
  assert.equal(exists('.claude/skills/review/__pycache__'), false);
  assert.equal(read('.claude/skills/review/SKILL.md'), SKILL);
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 0, synced.stderr);
  assert.match(synced.stdout, /up to date/);
});

test('Git이 아닌 프로필도 __pycache__ 같은 로컬 부산물은 건너뛴다', t => {
  const { me, repo, exists, setProfile } = project(t);
  setProfile('skills/review/__pycache__/x.pyc', '\u0000binary');
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  assert.equal(exists('.claude/skills/review/__pycache__'), false);
});

test('빈 skill 파일도 기록해서, 프로필에서 빼면 지우고 내용이 생겨도 충돌로 보지 않는다', t => {
  const { me, repo, exists, read, config, setProfile } = project(t);
  setProfile('skills/review/scripts/__init__.py', '');
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  assert.ok(config().managedHashes['.claude/skills/review/scripts/__init__.py']);
  me.ok(['check', repo]);
  setProfile('skills/review/scripts/__init__.py', 'x = 1\n');
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.equal(read('.claude/skills/review/scripts/__init__.py'), 'x = 1\n');
  setProfile('skills/review', null);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.equal(exists('.claude/skills/review'), false);
});

test('사람이 agctx의 skill 폴더에 파일을 더해도 동기화를 멈추지 않고 그 파일은 남긴다', t => {
  const { me, repo, exists, write, setProfile } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--yes']);
  write('.claude/skills/review/notes.md', '# my notes\n');
  setProfile('skills/review/SKILL.md', SKILL.replace('# 리뷰', '# 리뷰 v2'));
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 0, synced.stderr);
  me.ok(['check', repo]);
  setProfile('skills/review', null);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.ok(exists('.claude/skills/review/notes.md'));
  assert.equal(exists('.claude/skills/review/SKILL.md'), false);
});

test('resolve --discard는 hook을 두 번 넣지 않고, 쓰기 전에 hook 명령을 보여 주고, 고친 묶음이 남는다고 알린다', t => {
  const { me, repo, read, write, json, setProfile } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--include', 'rules,hooks', '--yes']);
  write('.claude/settings.json', read('.claude/settings.json').replace('pnpm run format', 'pnpm run mine'));
  setProfile('hooks.json', JSON.stringify(HOOKS).replaceAll('pnpm run format', 'pnpm run v2'));
  const resolved = me.run(['profile', 'resolve', repo, '--discard', '--yes']);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.match(resolved.stdout, /format-on-edit: Claude Code PostToolUse Edit\|Write: pnpm run v2/);
  assert.match(resolved.stderr, /\.claude\/settings\.json/);
  const commands = json('.claude/settings.json').hooks.PostToolUse.map(
    (group: { hooks: { command: string }[] }) => group.hooks[0].command
  );
  assert.deepEqual(commands, ['pnpm run mine', 'pnpm run v2']);
  me.ok(['profile', 'sync', repo, '--yes']);
  me.ok(['check', repo]);
});

test('resolve가 지워진 hooks 파일을 다시 만들 때도 명령을 보여 준다', t => {
  const { me, repo, file } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'claude', '--include', 'rules,hooks', '--yes']);
  fs.rmSync(file('.claude/settings.json'));
  const resolved = me.run(['profile', 'resolve', repo, '--yes']);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.match(resolved.stdout, /format-on-edit: Claude Code PostToolUse Edit\|Write: pnpm run format/);
});

test('repos pr은 hooks가 바뀌면 pull request 본문에 실행될 명령을 적는다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-artifacts-pr-');
  const admin = person('admin');
  const member = person('member');
  const profile = publishProfile(root, admin, 'team-backend');
  const hooks = (command: string) =>
    JSON.stringify({
      hooks: {
        'format-on-edit': {
          claude: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command }] }] }
        }
      }
    });
  fs.writeFileSync(path.join(profile.dir, 'hooks.json'), hooks('pnpm run format'));
  gitIn(profile.dir, 'add', '-A');
  gitIn(profile.dir, 'commit', '--quiet', '-m', 'Add hooks');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  member.ok(['profile', 'clone', profile.remote]);
  const service = serviceRepo(root, 'orders-api');
  member.ok([
    'profile',
    'apply',
    'team-backend',
    service.work,
    '--agent',
    'claude',
    '--include',
    'rules,hooks',
    '--pin',
    '--yes'
  ]);
  commitAndPush(service.work, 'Apply team-backend profile');
  const gh = fakeGh(t);

  fs.writeFileSync(path.join(profile.dir, 'hooks.json'), hooks('pnpm run lint'));
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Lint on edit');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  member.ok(['profile', 'pull', 'team-backend']);
  member.ok(['repos', 'pr', '--profile', 'team-backend', '--yes'], gh.env);
  const create = gh.calls().find(call => call.args[0] === 'pr' && call.args[1] === 'create');
  assert.match(create?.body ?? '', /format-on-edit: Claude Code PostToolUse Edit\|Write: `pnpm run lint`/);
});
