import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/**
 * 프로필의 `mcp.json`을 Claude Code의 `.mcp.json`과 Codex의 `.codex/config.toml`에 쓴다. agctx는 자기가
 * 쓴 서버만 소유하고, 사람이 넣은 서버와 설정은 그대로 둔다(ADR 0044).
 */

const PROFILE_MCP = {
  servers: {
    issues: {
      command: 'npx',
      args: ['-y', '@acme/issues-mcp'],
      env: { ISSUES_TOKEN: '${ISSUES_TOKEN}', REGION: 'eu' }
    },
    docs: { url: 'https://mcp.acme.dev/docs', headers: { Authorization: 'Bearer ${DOCS_TOKEN}' } }
  }
};

function project(t: TestContext, mcp: unknown = PROFILE_MCP) {
  const { person, folder } = makeWorkspace(t, 'agctx-mcp-');
  const me = person('me');
  me.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const profileMcp = path.join(me.profileDir('team-backend'), 'mcp.json');
  const setProfileMcp = (value: unknown) =>
    value === null
      ? fs.rmSync(profileMcp, { force: true })
      : fs.writeFileSync(profileMcp, JSON.stringify(value, null, 2));
  setProfileMcp(mcp);
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
  return { me, repo, exists, read, write, json, config, setProfileMcp, profileMcp };
}

test('프로필의 MCP 서버를 Claude Code와 Codex의 프로젝트 설정 파일에 쓰고 기록한다', t => {
  const { me, repo, read, json, config } = project(t);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes', '--json']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(
    applied.stderr,
    /MCP servers from the profile: docs \(https:\/\/mcp\.acme\.dev\/docs; headers Authorization\), issues \(npx -y @acme\/issues-mcp; env ISSUES_TOKEN, REGION\)/
  );
  assert.deepEqual(JSON.parse(applied.stdout).data.mcpServers, ['docs', 'issues']);

  assert.deepEqual(json('.mcp.json'), {
    mcpServers: {
      docs: { type: 'http', url: 'https://mcp.acme.dev/docs', headers: { Authorization: 'Bearer ${DOCS_TOKEN}' } },
      issues: {
        command: 'npx',
        args: ['-y', '@acme/issues-mcp'],
        env: { ISSUES_TOKEN: '${ISSUES_TOKEN}', REGION: 'eu' }
      }
    }
  });
  const toml = read('.codex/config.toml');
  assert.match(toml, /^# agctx:managed:start\n/);
  assert.match(
    toml,
    /\[mcp_servers\.docs\]\nurl = "https:\/\/mcp\.acme\.dev\/docs"\nbearer_token_env_var = "DOCS_TOKEN"\nhttp_headers = \{\}\nenv_http_headers = \{\}/
  );
  assert.match(
    toml,
    /\[mcp_servers\.issues\]\ncommand = "npx"\nargs = \["-y", "@acme\/issues-mcp"\]\nenv = \{ REGION = "eu" \}\nenv_vars = \["ISSUES_TOKEN"\]/
  );
  assert.match(toml, /# agctx:managed:end\n$/);

  assert.deepEqual(config().managedKeys, { '.mcp.json': ['docs', 'issues'] });
  assert.ok(config().managedHashes['.mcp.json']);
  assert.ok(config().managedHashes['.codex/config.toml']);
  assert.equal(me.run(['check', repo]).status, 0);
  assert.match(me.ok(['profile', 'sync', repo, '--yes']).stdout, /already up to date/);
});

test('사람이 넣은 서버와 설정은 그대로 두고, 프로필에서 뺀 서버만 지운다', t => {
  const { me, repo, exists, read, write, json, setProfileMcp } = project(t);
  write('.mcp.json', JSON.stringify({ mcpServers: { mine: { command: 'my-mcp' } }, other: true }, null, 4));
  write('.codex/config.toml', 'model = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "my-mcp"\n');

  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  assert.match(stopped.stdout, /unmanaged\s+\.mcp\.json/);
  assert.match(stopped.stdout, /unmanaged\s+\.codex\/config\.toml/);

  me.ok(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  assert.deepEqual(Object.keys(json('.mcp.json').mcpServers), ['mine', 'docs', 'issues']);
  assert.equal(json('.mcp.json').other, true);
  assert.match(read('.mcp.json'), /^\{\n {4}"mcpServers"/, '파일이 쓰던 들여쓰기를 지킨다');
  assert.match(
    read('.codex/config.toml'),
    /^model = "gpt-5"\n\n\[mcp_servers\.mine\]\ncommand = "my-mcp"\n\n# agctx:managed:start/
  );

  setProfileMcp({ servers: { issues: PROFILE_MCP.servers.issues } });
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.deepEqual(Object.keys(json('.mcp.json').mcpServers), ['mine', 'issues']);
  assert.doesNotMatch(read('.codex/config.toml'), /mcp_servers\.docs/);

  setProfileMcp(null);
  const removed = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(removed.status, 0, removed.stdout + removed.stderr);
  assert.deepEqual(json('.mcp.json'), { mcpServers: { mine: { command: 'my-mcp' } }, other: true });
  assert.equal(read('.codex/config.toml'), 'model = "gpt-5"\n\n[mcp_servers.mine]\ncommand = "my-mcp"\n');
  assert.ok(!exists('.agctx/base/.mcp.json.base'));
  assert.equal(me.run(['check', repo]).status, 0);
});

test('agctx만 쓴 설정 파일은 프로필에서 MCP를 빼면 지운다', t => {
  const { me, repo, exists, config, setProfileMcp } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--yes']);
  setProfileMcp(null);
  const synced = me.run(['profile', 'sync', repo, '--dry-run']);
  assert.match(synced.stdout, /remove\s+\.mcp\.json/);
  assert.match(synced.stdout, /remove\s+\.codex\/config\.toml/);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.ok(!exists('.mcp.json'));
  assert.ok(!exists('.codex'), '비게 된 폴더도 지운다');
  assert.equal(config().managedKeys, undefined);
});

test('사람이 같은 이름의 서버를 이미 두었으면 덮어쓰지 않고 멈춘다', t => {
  const { me, repo, read, write } = project(t);
  write('.mcp.json', JSON.stringify({ mcpServers: { issues: { command: 'my-issues' } } }));
  const stopped = me.run(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes', '--json']);
  assert.equal(stopped.status, 2, stopped.stdout + stopped.stderr);
  const error = JSON.parse(stopped.stdout).errors[0];
  assert.equal(error.code, 'project.mcp-name-taken');
  assert.match(error.message, /\.mcp\.json: issues/);
  assert.equal(read('.mcp.json'), JSON.stringify({ mcpServers: { issues: { command: 'my-issues' } } }));

  fs.rmSync(path.join(repo, '.mcp.json'));
  write('.codex/config.toml', '[mcp_servers."issues"]\ncommand = "my-issues"\n');
  const toml = me.run(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  assert.equal(toml.status, 2, toml.stdout + toml.stderr);
  assert.match(toml.stderr, /\.codex\/config\.toml: issues/);
});

test('agctx가 쓴 서버를 고치면 충돌로 멈추고, resolve --discard가 백업한 뒤 되돌린다', t => {
  const { me, repo, read, write, json } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--yes']);
  const edited = json('.mcp.json');
  edited.mcpServers.issues.args = ['-y', '@acme/issues-mcp@2'];
  edited.mcpServers.mine = { command: 'my-mcp' };
  write('.mcp.json', JSON.stringify(edited, null, 2));

  const checked = me.run(['check', repo]);
  assert.equal(checked.status, 2, checked.stdout);
  const synced = me.run(['profile', 'sync', repo, '--dry-run']);
  assert.equal(synced.status, 2);
  assert.match(synced.stdout, /conflict\s+\.mcp\.json/);
  assert.match(synced.stdout, /@acme\/issues-mcp@2/, '무엇을 고쳤는지 보여 준다');

  const resolved = me.run(['profile', 'resolve', repo, '--yes']);
  assert.equal(resolved.status, 2, '고친 서버 항목은 옮길 자리가 없으므로 --discard를 요구한다');
  me.ok(['profile', 'resolve', repo, '--discard', '--yes']);
  assert.deepEqual(json('.mcp.json').mcpServers.issues.args, ['-y', '@acme/issues-mcp']);
  assert.deepEqual(json('.mcp.json').mcpServers.mine, { command: 'my-mcp' }, '사람이 넣은 서버는 남는다');
  const backups = path.join(repo, '.agctx', 'backups');
  const [stamp] = fs.readdirSync(backups);
  assert.match(fs.readFileSync(path.join(backups, stamp, '.mcp.json'), 'utf8'), /issues-mcp@2/);
  assert.equal(me.run(['check', repo]).status, 0);
  assert.ok(read('.mcp.json').endsWith('\n'));
});

test('--include rules는 MCP를 빼고 기록하며, --agent는 MCP 파일에도 적용된다', t => {
  const { me, repo, exists, config } = project(t);
  me.ok(['profile', 'apply', 'team-backend', repo, '--include', 'rules', '--yes']);
  assert.ok(!exists('.mcp.json'));
  assert.ok(!exists('.codex/config.toml'));
  assert.deepEqual(config().include, ['rules']);
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.ok(!exists('.mcp.json'), 'sync도 기록을 따른다');

  me.ok(['profile', 'apply', 'team-backend', repo, '--include', 'all', '--agent', 'codex', '--yes']);
  assert.equal(config().include, undefined);
  assert.ok(!exists('.mcp.json'), 'Claude Code를 고르지 않았으면 .mcp.json을 쓰지 않는다');
  assert.ok(exists('.codex/config.toml'));

  const bad = me.run(['profile', 'apply', 'team-backend', repo, '--include', 'mcp', '--yes']);
  assert.equal(bad.status, 64);
  assert.match(bad.stderr, /rules/);
});

test('Codex로 옮길 수 없는 값은 그 서버만 Codex에서 빼고 경고한다', t => {
  const { me, repo, read, json } = project(t, {
    servers: {
      renamed: { command: 'renamed-mcp', env: { API_KEY: '${ACME_API_KEY}' } },
      plain: { command: 'plain-mcp' }
    }
  });
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stderr, /Codex \(\.codex\/config\.toml\) did not get MCP server renamed/);
  assert.deepEqual(
    Object.keys(json('.mcp.json').mcpServers),
    ['plain', 'renamed'],
    'Claude Code는 ${...}를 펼치므로 받는다'
  );
  assert.doesNotMatch(read('.codex/config.toml'), /renamed/);
  assert.match(read('.codex/config.toml'), /\[mcp_servers\.plain\]/);
});

test('프로필의 mcp.json이 잘못됐거나 숨은 문자가 있으면 아무것도 쓰지 않는다', t => {
  const { me, repo, exists, profileMcp } = project(t, { servers: { bad: { command: 'x', cwd: '/tmp' } } });
  const invalid = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(invalid.status, 64, invalid.stderr);
  assert.match(invalid.stderr, /mcp\.json[^\n]*unknown field "cwd"/);
  assert.ok(!exists('AGENTS.md'));

  fs.writeFileSync(profileMcp, JSON.stringify({ servers: { hidden: { command: 'x‮' } } }));
  const hidden = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(hidden.status, 3, hidden.stderr);
  assert.ok(!exists('.mcp.json'));

  const rulesOnly = me.run(['profile', 'apply', 'team-backend', repo, '--include', 'rules', '--yes']);
  assert.equal(rulesOnly.status, 3, '숨은 문자는 MCP를 빼도 막는다');
});

test('고정한 저장소는 기록한 커밋의 mcp.json을 쓴다', t => {
  const { me, repo, json, profileMcp, setProfileMcp } = project(t);
  const dir = path.dirname(profileMcp);
  gitIn(dir, 'init', '--quiet', '--initial-branch=main');
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile');
  me.ok(['profile', 'apply', 'team-backend', repo, '--pin', '--yes']);
  setProfileMcp({ servers: { other: { command: 'other-mcp' } } });
  gitIn(dir, 'commit', '--quiet', '-am', 'Change MCP');
  me.ok(['profile', 'sync', repo, '--yes']);
  assert.deepEqual(Object.keys(json('.mcp.json').mcpServers), ['docs', 'issues'], '고정한 커밋에 머문다');
  me.ok(['profile', 'apply', 'team-backend', repo, '--pin', '--yes']);
  assert.deepEqual(Object.keys(json('.mcp.json').mcpServers), ['other']);
});

test('TUI는 프로필에 MCP가 있을 때만 묻고 기록한 선택을 미리 고르며, profile view는 서버를 보여 준다', async t => {
  const { me, repo, write } = project(t);
  const previous = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = me.home;
  t.after(() => {
    if (previous === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previous;
  });
  const { includePrompt } = await import('../src/tui/profile.ts');
  assert.deepEqual(includePrompt('team-backend', repo), {
    ask: true,
    initial: true,
    servers: 2,
    files: '.mcp.json, .codex/config.toml'
  });
  assert.equal(
    includePrompt('team-backend', repo, ['antigravity']).ask,
    false,
    'MCP를 받을 에이전트가 없으면 묻지 않는다'
  );
  assert.equal(includePrompt('team-backend', repo, ['claude']).files, '.mcp.json');
  write('agctx.project.json', JSON.stringify({ schemaVersion: 2, profile: 'team-backend', include: ['rules'] }));
  assert.equal(includePrompt('team-backend', repo).initial, false);

  const viewed = me.run(['profile', 'view', 'team-backend', '--json']);
  assert.deepEqual(JSON.parse(viewed.stdout).data.mcpServers, ['docs', 'issues']);
  assert.match(
    me.run(['profile', 'view', 'team-backend']).stdout,
    /MCP servers: docs \(https:\/\/mcp\.acme\.dev\/docs; headers Authorization\)/
  );
});

test('clone은 mcp.json이 심볼릭 링크인 프로필 저장소를 받지 않는다', t => {
  const { person, folder, root } = makeWorkspace(t, 'agctx-mcp-clone-');
  const admin = person('admin');
  admin.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const dir = admin.profileDir('team-backend');
  const secret = path.join(folder('outside'), 'secret.json');
  fs.writeFileSync(secret, '{"servers":{}}');
  fs.symlinkSync(secret, path.join(dir, 'mcp.json'));
  gitIn(dir, 'init', '--quiet', '--initial-branch=main');
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '--quiet', '-m', 'Add profile');
  const dev = person('dev');
  const cloned = dev.run(['profile', 'clone', dir]);
  assert.equal(cloned.status, 64, cloned.stdout + cloned.stderr);
  assert.match(cloned.stderr, /mcp\.json[^\n]*symbolic link/);
  assert.ok(!fs.existsSync(dev.profileDir('team-backend')));
  assert.ok(root);
});

test('Codex 설정에서 같은 이름의 서버를 어떤 TOML 표기로 정의해도 찾아서 멈춘다', t => {
  const { me, repo, read, write } = project(t);
  const forms = [
    'mcp_servers.issues.command = "mine"\n',
    '[mcp_servers]\nissues = { command = "mine" }\n',
    '[mcp_servers.\'issues\']\ncommand = "mine"\n',
    '[mcp_servers.issues.env]\nA = "1"\n',
    '[mcp_servers]\nissues.command = "mine"\n'
  ];
  for (const form of forms) {
    write('.codex/config.toml', form);
    const applied = me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--adopt', '--yes']);
    assert.equal(applied.status, 2, `${form}\n${applied.stdout}${applied.stderr}`);
    assert.match(applied.stderr, /\.codex\/config\.toml: issues/, form);
    assert.equal(read('.codex/config.toml'), form, '파일을 바꾸지 않는다');
  }
});

test('Codex로 옮길 수 없는 command·args의 ${...}도 경고하고, 쓸 것이 없으면 사람의 파일을 건드리지 않는다', t => {
  const { me, repo, read, write, exists } = project(t, {
    servers: { local: { command: '${HOME}/bin/srv', args: ['--token', '${API_TOKEN}'] } }
  });
  write('.codex/config.toml', 'model = "gpt-5"\n');
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--adopt', '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.match(applied.stderr, /Codex \(\.codex\/config\.toml\) did not get MCP server local/);
  assert.equal(read('.codex/config.toml'), 'model = "gpt-5"\n', 'Codex에 쓸 서버가 없으면 사람의 파일은 그대로다');

  write('.mcp.json', '{"mcpServers":{}}');
  const { me: other, repo: otherRepo, read: otherRead, write: otherWrite } = project(t, { servers: {} });
  otherWrite('.mcp.json', '{"mcpServers":{}}');
  const empty = other.run(['profile', 'apply', 'team-backend', otherRepo, '--adopt', '--yes']);
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  assert.equal(
    otherRead('.mcp.json'),
    '{"mcpServers":{}}',
    '서버가 없는 프로필은 사람이 만든 .mcp.json을 지우지 않는다'
  );
  assert.ok(exists('.mcp.json'));
});

test('적용 계획의 서버 줄은 제어 문자를 드러내고 env·헤더 이름과 빼는 서버를 보여 준다', t => {
  const { me, repo, setProfileMcp } = project(t, {
    servers: {
      issues: { command: 'npx', args: ['-y', '\u001b[2Kissues'], env: { ISSUES_TOKEN: '${ISSUES_TOKEN}' } },
      docs: { url: 'https://mcp.acme.dev/docs', headers: { Authorization: 'Bearer ${DOCS_TOKEN}' } }
    }
  });
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(!applied.stdout.includes('\u001b'), 'ESC 바이트를 그대로 내보내지 않는다');
  assert.match(applied.stdout, /\\u001b\[2Kissues/);
  assert.match(applied.stdout, /env ISSUES_TOKEN/);
  assert.match(applied.stdout, /headers Authorization/);
  setProfileMcp({ servers: {} });
  const synced = me.run(['profile', 'sync', repo, '--dry-run']);
  assert.match(synced.stdout, /MCP servers removed: docs, issues/);

  const { me: codexOnly, repo: codexRepo } = project(t);
  const antigravity = codexOnly.run([
    'profile',
    'apply',
    'team-backend',
    codexRepo,
    '--agent',
    'antigravity',
    '--dry-run'
  ]);
  assert.doesNotMatch(antigravity.stdout, /MCP servers/, 'MCP를 받을 에이전트가 없으면 서버 줄도 없다');
});

test('MCP 충돌 안내는 프로필 mcp.json에 옮긴 뒤 resolve --discard를 말하고, 이름이 객체 속성과 같아도 된다', t => {
  const { me, repo, write, json } = project(t, {
    servers: { constructor: { command: 'a' }, toString: { command: 'b' } }
  });
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.deepEqual(Object.keys(json('.mcp.json').mcpServers), ['constructor', 'toString']);
  const edited = json('.mcp.json');
  edited.mcpServers.toString.command = 'c';
  write('.mcp.json', JSON.stringify(edited));
  const synced = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(synced.status, 2);
  assert.match(synced.stderr, /mcp\.json[^\n]*profile[^\n]*--discard/);
  const resolved = me.run(['profile', 'resolve', repo, '--yes']);
  assert.equal(resolved.status, 2);
  assert.match(resolved.stderr, /MCP/);
  assert.doesNotMatch(resolved.stderr, /cannot tell what was applied last|last applied version is unknown/i);
});

test('관리 블록 안의 값에 표지 문자열이 있어도 블록을 바르게 찾고, 짝 없는 서로게이트는 받지 않는다', t => {
  const { me, repo, setProfileMcp } = project(t, {
    servers: { a: { command: 'x', args: ['# agctx:managed:end'] }, b: { command: 'y' } }
  });
  me.ok(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--yes']);
  assert.equal(me.run(['check', repo]).status, 0);
  me.ok(['profile', 'sync', repo, '--yes']);
  setProfileMcp({ servers: { bad: { command: 'x', args: ['\ud800'] } } });
  const bad = me.run(['profile', 'sync', repo, '--yes']);
  assert.equal(bad.status, 64, bad.stdout + bad.stderr);
});

test('--json의 mcpServers는 이번에 실제로 쓰는 서버만 담는다', t => {
  const { me, repo } = project(t);
  const none = JSON.parse(
    me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'antigravity', '--dry-run', '--json']).stdout
  );
  assert.deepEqual(none.data.mcpServers, [], 'MCP를 받을 에이전트가 없으면 빈 목록이다');
  const codex = JSON.parse(
    me.run(['profile', 'apply', 'team-backend', repo, '--agent', 'codex', '--dry-run', '--json']).stdout
  );
  assert.deepEqual(codex.data.mcpServers, ['docs', 'issues']);
});
