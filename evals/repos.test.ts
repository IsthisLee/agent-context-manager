import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  commitAndPush,
  fakeGh,
  gitIn,
  makeWorkspace,
  optionValue,
  publishProfile,
  serviceRepo
} from './support/git-workspace.ts';
import { ghFailureReason } from '../src/repos/pr.ts';

interface ListedRepo {
  path: string;
  profile: string;
  pinned: boolean;
  missing: boolean;
}

const names = (repos: { path: string }[]) => repos.map(repo => path.basename(repo.path)).sort();

/** `repos pr`이 결과 상태마다 출력하는 줄: `<state> <target>  <detail>`. */
const resultRow = (stdout: string, state: string) =>
  stdout.split('\n').find(line => line.startsWith(`${state} `)) ?? '';

test('apply는 저장소를 기록하고, repos list는 옮겨진 저장소를 missing으로 표시하며, --prune은 그것을 잊는다', t => {
  const { root, person, folder } = makeWorkspace(t, 'agctx-repos-list-');
  const me = person('me');
  me.ok(['profile', 'create', 'personal']);
  me.ok(['profile', 'create', 'client-a', '--scope', 'company']);
  const blog = folder('blog');
  const api = folder('client-a-api');
  const preview = folder('preview-only');
  me.ok(['profile', 'apply', 'personal', blog, '--yes']);
  me.ok(['profile', 'apply', 'client-a', api, '--yes']);
  me.ok(['profile', 'sync', blog, '--yes']);
  me.ok(['profile', 'apply', 'personal', preview, '--dry-run']);

  const listed: ListedRepo[] = JSON.parse(me.ok(['repos', 'list', '--json']).stdout).data.repos;
  assert.deepEqual(
    listed.map(repo => [path.basename(repo.path), repo.profile, repo.pinned, repo.missing]).sort(),
    [
      ['blog', 'personal', false, false],
      ['client-a-api', 'client-a', false, false]
    ],
    'apply와 sync는 저장소를 한 번만 등록하고, dry run은 아무것도 등록하지 않는다'
  );
  assert.deepEqual(names(JSON.parse(me.ok(['repos', 'list', '--profile', 'client-a', '--json']).stdout).data.repos), [
    'client-a-api'
  ]);

  fs.renameSync(api, path.join(root, 'moved-api'));
  const human = me.ok(['repos', 'list']);
  assert.match(human.stdout, /missing\s+client-a\s+.*client-a-api/);
  assert.match(human.stderr, /agctx repos list --prune/);

  me.ok(['repos', 'list', '--prune']);
  assert.deepEqual(names(JSON.parse(me.ok(['repos', 'list', '--json']).stdout).data.repos), ['blog']);
});

test('repos status는 목록의 모든 저장소를 검사하고 가장 심각한 상태로 끝난다', t => {
  const { person, folder } = makeWorkspace(t, 'agctx-repos-status-');
  const me = person('me');
  me.ok(['profile', 'create', 'personal']);
  me.ok(['profile', 'create', 'client-a', '--scope', 'company']);
  const blog = folder('status-blog');
  const notes = folder('status-notes');
  const api = folder('status-api');
  me.ok(['profile', 'apply', 'personal', blog, '--yes']);
  me.ok(['profile', 'apply', 'personal', notes, '--yes']);
  me.ok(['profile', 'apply', 'client-a', api, '--yes']);
  assert.match(me.ok(['repos', 'status']).stdout, /ok\s+client-a\s+.*status-api/);

  me.ok(['profile', 'setup', 'personal', '--tdd', 'on']);
  const claude = path.join(api, 'CLAUDE.md');
  fs.writeFileSync(
    claude,
    fs
      .readFileSync(claude, 'utf8')
      .replace('<!-- agctx:managed:start -->\n', '<!-- agctx:managed:start -->\nEdited by hand.\n')
  );

  const all = me.run(['repos', 'status']);
  assert.equal(all.status, 2, '충돌이 뒤처진 저장소보다 우선한다');
  assert.match(all.stdout, /behind\s+personal\s+.*status-blog/);
  assert.match(all.stdout, /behind\s+personal\s+.*status-notes/);
  assert.match(all.stdout, /conflict\s+client-a\s+.*status-api/);
  assert.match(all.stderr, /Next: agctx repos sync --profile personal/);
  assert.match(all.stderr, /Next: agctx profile resolve .*status-api/);

  const personal = me.run(['repos', 'status', '--profile', 'personal', '--json']);
  assert.equal(personal.status, 1);
  const document = JSON.parse(personal.stdout);
  assert.equal(document.command, 'repos status');
  assert.deepEqual(
    document.data.repos.map((repo: { state: string; exitCode: number }) => [repo.state, repo.exitCode]),
    [
      ['behind', 1],
      ['behind', 1]
    ]
  );
});

test('repos sync는 모든 저장소를 미리 보여 주고 한 번 묻고, 충돌하거나 더러운 저장소는 건너뛰고 나머지를 갱신한다', t => {
  const { person, folder } = makeWorkspace(t, 'agctx-repos-sync-');
  const me = person('me');
  me.ok(['profile', 'create', 'personal']);
  const one = folder('sync-one');
  const two = folder('sync-two');
  const three = folder('sync-three');
  gitIn(three, 'init', '--quiet', '--initial-branch=main');
  for (const project of [one, two, three]) me.ok(['profile', 'apply', 'personal', project, '--yes']);
  gitIn(three, 'add', '-A');
  gitIn(three, 'commit', '--quiet', '-m', 'Apply personal');

  me.ok(['profile', 'setup', 'personal', '--tdd', 'on']);
  const claudeTwo = path.join(two, 'CLAUDE.md');
  fs.writeFileSync(
    claudeTwo,
    fs
      .readFileSync(claudeTwo, 'utf8')
      .replace('<!-- agctx:managed:start -->\n', '<!-- agctx:managed:start -->\nEdited by hand.\n')
  );
  fs.appendFileSync(path.join(three, 'AGENTS.md'), '\n- A note not committed yet.\n');
  const read = (project: string) => fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
  const before = [read(one), read(two), read(three)];

  const preview = me.run(['repos', 'sync', '--profile', 'personal', '--dry-run']);
  assert.equal(preview.status, 2);
  assert.match(preview.stdout, /update\s+\S*sync-one/);
  assert.match(preview.stdout, /conflict\s+\S*sync-two/);
  assert.match(preview.stdout, /dirty\s+\S*sync-three\s+.*AGENTS\.md/);
  assert.deepEqual([read(one), read(two), read(three)], before, 'dry run은 아무것도 쓰지 않는다');

  const refused = me.run(['repos', 'sync', '--profile', 'personal']);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /agctx repos sync --profile personal --yes/);
  assert.deepEqual([read(one), read(two), read(three)], before);

  const synced = me.run(['repos', 'sync', '--profile', 'personal', '--yes']);
  assert.equal(synced.status, 2, '나머지를 갱신한 뒤에도 충돌이 종료 코드를 정한다');
  assert.match(synced.stdout, /updated\s+\S*sync-one/);
  assert.match(read(one), /## TDD/);
  assert.equal(read(two), before[1]);
  assert.equal(read(three), before[2]);

  const again = JSON.parse(me.run(['repos', 'sync', '--profile', 'personal', '--yes', '--json']).stdout);
  assert.deepEqual(
    again.data.repos.map((repo: { path: string; state: string }) => [path.basename(repo.path), repo.state]).sort(),
    [
      ['sync-one', 'up-to-date'],
      ['sync-three', 'dirty'],
      ['sync-two', 'conflict']
    ]
  );
});

test('repos pr은 프로필이 바뀌었을 때만 별도 worktree에서 pull request를 연다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-repos-pr-');
  const admin = person('admin');
  const member = person('member');
  const profile = publishProfile(root, admin, 'team-backend');
  member.ok(['profile', 'clone', profile.remote]);
  const service = serviceRepo(root, 'orders-api');
  member.ok(['profile', 'apply', 'team-backend', service.work, '--pin', '--yes']);
  commitAndPush(service.work, 'Apply team-backend profile');
  const gh = fakeGh(t);
  const creates = () => gh.calls().filter(call => call.args[0] === 'pr' && call.args[1] === 'create');
  const remoteHeads = () => gitIn(service.work, 'ls-remote', '--heads', 'origin');

  const quiet = member.ok(['repos', 'pr', '--profile', 'team-backend', '--yes'], gh.env);
  assert.match(quiet.stdout, /up-to-date\s+\S*orders-api/);
  assert.deepEqual(creates(), [], '새 프로필 커밋이 없는 예약 실행은 아무것도 열지 않는다');
  assert.doesNotMatch(remoteHeads(), /agctx\//);

  const pinnedSync = member.ok(['repos', 'sync', '--profile', 'team-backend', '--yes']);
  assert.match(pinnedSync.stdout, /pinned\s+\S*orders-api\s+.*agctx repos pr/);

  fs.appendFileSync(path.join(profile.dir, 'AGENTS.md'), '\n- Always add a migration test.\n');
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Require migration tests');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  member.ok(['profile', 'pull', 'team-backend']);
  const newCommit = gitIn(member.profileDir('team-backend'), 'rev-parse', 'HEAD');
  const branch = `agctx/team-backend-${newCommit.slice(0, 7)}`;
  assert.equal(
    member.run(['check', service.work]).status,
    1,
    '보관함에 더 새로운 커밋이 생기면 고정한 저장소는 뒤처진다'
  );

  const preview = member.ok(['repos', 'pr', '--profile', 'team-backend', '--dry-run'], gh.env);
  assert.match(preview.stdout, new RegExp(`would-open\\s+\\S*orders-api\\s+.*${branch}`));
  assert.deepEqual(creates(), []);
  assert.doesNotMatch(remoteHeads(), /agctx\//);

  const refused = member.run(['repos', 'pr', '--profile', 'team-backend'], gh.env);
  assert.equal(refused.status, 64);

  const opened = member.ok(['repos', 'pr', '--profile', 'team-backend', '--yes'], gh.env);
  const openedRow = resultRow(opened.stdout, 'opened');
  assert.match(openedRow, /\S*orders-api\s/, opened.stdout);
  assert.equal(openedRow.split(' ').at(-1), 'https://github.com/acme/orders-api/pull/1');
  assert.match(remoteHeads(), new RegExp(`refs/heads/${branch}`));

  gitIn(service.work, 'fetch', '--quiet', 'origin', branch);
  const recorded = JSON.parse(gitIn(service.work, 'show', 'FETCH_HEAD:agctx.project.json'));
  assert.equal(recorded.source.commit, newCommit);
  assert.equal(recorded.pin, true, '고정한 저장소는 새 커밋으로 다시 고정한다');
  assert.match(gitIn(service.work, 'show', 'FETCH_HEAD:AGENTS.md'), /Always add a migration test/);
  assert.equal(
    gitIn(service.work, 'log', '-1', '--format=%s', 'FETCH_HEAD'),
    `chore(agctx): update team-backend profile to ${newCommit.slice(0, 7)}`
  );

  assert.equal(gitIn(service.work, 'status', '--porcelain'), '', '작업 사본은 깨끗하게 남는다');
  assert.equal(gitIn(service.work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.doesNotMatch(fs.readFileSync(path.join(service.work, 'AGENTS.md'), 'utf8'), /Always add a migration test/);
  assert.equal(gitIn(service.work, 'branch', '--list', 'agctx/*'), '', '로컬 브랜치가 남지 않는다');
  assert.equal(
    gitIn(service.work, 'worktree', 'list', '--porcelain')
      .split('\n')
      .filter(line => line.startsWith('worktree ')).length,
    1,
    '임시 worktree를 지운다'
  );

  const [create] = creates();
  assert.equal(optionValue(create.args, '--base'), 'main');
  assert.equal(optionValue(create.args, '--head'), branch);
  assert.match(optionValue(create.args, '--title') ?? '', /team-backend/);
  assert.match(create.body ?? '', new RegExp(`${newCommit.slice(0, 7)}`));
  assert.match(create.body ?? '', /Require migration tests/);

  gh.setMode('existing');
  const again = member.ok(['repos', 'pr', '--profile', 'team-backend', '--yes'], gh.env);
  const existingRow = resultRow(again.stdout, 'pr-exists');
  assert.match(existingRow, /\S*orders-api\s/, again.stdout);
  assert.equal(existingRow.split(' ').at(-1), 'https://github.com/acme/orders-api/pull/7');
  assert.equal(creates().length, 1);
});

test('repos pr --targets는 예약된 봇이 clone URL로 작업하게 하고, gh가 pull request를 열지 못하면 안내와 함께 push한다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-repos-targets-');
  const admin = person('admin');
  const developer = person('developer');
  const bot = person('bot');
  const profile = publishProfile(root, admin, 'team-backend');
  developer.ok(['profile', 'clone', profile.remote]);
  const service = serviceRepo(root, 'billing-api');
  developer.ok(['profile', 'apply', 'team-backend', service.work, '--yes']);
  commitAndPush(service.work, 'Apply team-backend profile');

  fs.appendFileSync(path.join(profile.dir, 'AGENTS.md'), '\n- Document every public endpoint.\n');
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Document endpoints');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  bot.ok(['profile', 'clone', profile.remote]);
  const newCommit = gitIn(bot.profileDir('team-backend'), 'rev-parse', 'HEAD');
  const branch = `agctx/team-backend-${newCommit.slice(0, 7)}`;

  const targets = path.join(root, 'targets.txt');
  fs.writeFileSync(targets, `# repositories that use team-backend\n\n${service.origin}\n`);
  const gh = fakeGh(t);
  gh.setMode('not-github');

  const result = bot.run(['repos', 'pr', '--targets', targets, '--profile', 'team-backend', '--yes'], gh.env);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /pushed\s+\S*billing-api\.git/);
  assert.match(result.stdout + result.stderr, new RegExp(`Open a pull request from ${branch} into main`));
  assert.match(gitIn(service.work, 'ls-remote', '--heads', 'origin'), new RegExp(`refs/heads/${branch}`));
  gitIn(service.work, 'fetch', '--quiet', 'origin', branch);
  const recorded = JSON.parse(gitIn(service.work, 'show', 'FETCH_HEAD:agctx.project.json'));
  assert.equal(recorded.source.commit, newCommit);
  assert.equal(recorded.pin, undefined, '고정하지 않았던 저장소는 고정하지 않은 채로 남는다');

  assert.deepEqual(
    JSON.parse(bot.ok(['repos', 'list', '--json']).stdout).data.repos,
    [],
    '임시 clone은 등록하지 않는다'
  );
});

test('대상 폴더를 다른 대소문자로 적어도 repos pr은 worktree 안에서 적용한다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-repos-spelling-');
  const admin = person('admin');
  const bot = person('bot');
  const profile = publishProfile(root, admin, 'team-backend');
  bot.ok(['profile', 'clone', profile.remote]);
  const service = serviceRepo(root, 'orders-api');
  // Windows는 한 폴더를 RUNNER~1이나 runneradmin으로 부를 수 있고, git은 디스크의 표기를 보고한다.
  const respelled = path.join(root, 'WORK', 'orders-api');
  if (!fs.existsSync(respelled)) {
    t.skip('this file system tells folder names apart by letter case');
    return;
  }
  bot.ok(['profile', 'apply', 'team-backend', service.work, '--yes']);
  commitAndPush(service.work, 'Apply team-backend profile');
  fs.appendFileSync(path.join(profile.dir, 'AGENTS.md'), '\n- Document every public endpoint.\n');
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Document endpoints');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  bot.ok(['profile', 'pull', 'team-backend']);
  const branch = `agctx/team-backend-${gitIn(bot.profileDir('team-backend'), 'rev-parse', 'HEAD').slice(0, 7)}`;

  const targets = path.join(root, 'targets.txt');
  fs.writeFileSync(targets, `${respelled}\n`);
  const gh = fakeGh(t);
  gh.setMode('not-github');
  const result = bot.run(['repos', 'pr', '--targets', targets, '--profile', 'team-backend', '--yes'], gh.env);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  gitIn(service.work, 'fetch', '--quiet', 'origin', branch);
  assert.match(gitIn(service.work, 'show', 'FETCH_HEAD:AGENTS.md'), /Document every public endpoint/);
});

test('repos pr은 저장소 하위 폴더에 있는 프로젝트를 갱신한다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-repos-subfolder-');
  const admin = person('admin');
  const bot = person('bot');
  const profile = publishProfile(root, admin, 'team-backend');
  bot.ok(['profile', 'clone', profile.remote]);
  const service = serviceRepo(root, 'platform');
  const project = path.join(service.work, 'packages', 'orders-api');
  fs.mkdirSync(project, { recursive: true });
  bot.ok(['profile', 'apply', 'team-backend', project, '--yes']);
  commitAndPush(service.work, 'Apply team-backend profile to orders-api');
  fs.appendFileSync(path.join(profile.dir, 'AGENTS.md'), '\n- Document every public endpoint.\n');
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Document endpoints');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  bot.ok(['profile', 'pull', 'team-backend']);
  const branch = `agctx/team-backend-${gitIn(bot.profileDir('team-backend'), 'rev-parse', 'HEAD').slice(0, 7)}`;

  const gh = fakeGh(t);
  gh.setMode('not-github');
  const result = bot.run(['repos', 'pr', '--profile', 'team-backend', '--yes'], gh.env);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  gitIn(service.work, 'fetch', '--quiet', 'origin', branch);
  assert.match(
    gitIn(service.work, 'show', 'FETCH_HEAD:packages/orders-api/AGENTS.md'),
    /Document every public endpoint/
  );
  assert.equal(
    gitIn(service.work, 'ls-tree', '--name-only', 'FETCH_HEAD', 'AGENTS.md'),
    '',
    '저장소 맨 위에는 아무것도 쓰지 않는다'
  );
});

/** Git for Windows가 설치하는 Git: 파일을 CRLF 줄 끝으로 checkout한다(core.autocrlf). */
const CRLF_CHECKOUT = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'true' };

test('check와 repos pr은 git이 CRLF 줄 끝으로 checkout한 파일을 agctx가 쓴 파일로 읽는다', t => {
  const { root, person } = makeWorkspace(t, 'agctx-repos-crlf-');
  const admin = person('admin');
  const bot = person('bot');
  const profile = publishProfile(root, admin, 'team-backend');
  bot.ok(['profile', 'clone', profile.remote], CRLF_CHECKOUT);
  const service = serviceRepo(root, 'orders-api');
  bot.ok(['profile', 'apply', 'team-backend', service.work, '--pin', '--yes'], CRLF_CHECKOUT);
  commitAndPush(service.work, 'Apply team-backend profile');
  assert.equal(
    bot.run(['check', service.work], CRLF_CHECKOUT).status,
    0,
    'CRLF 줄 끝으로 clone한 프로필은 고정한 커밋의 내용을 렌더링한다'
  );
  const gh = fakeGh(t);
  gh.setMode('not-github');

  const quiet = bot.ok(['repos', 'pr', '--profile', 'team-backend', '--yes'], { ...gh.env, ...CRLF_CHECKOUT });
  assert.match(
    quiet.stdout,
    /up-to-date\s+\S*orders-api/,
    'CRLF 줄 끝으로 checkout한 worktree에는 고친 관리 영역이 없다'
  );

  fs.appendFileSync(path.join(profile.dir, 'AGENTS.md'), '\n- Document every public endpoint.\n');
  gitIn(profile.dir, 'commit', '--quiet', '-am', 'Document endpoints');
  admin.ok(['profile', 'push', 'team-backend', '--yes']);
  bot.ok(['profile', 'pull', 'team-backend'], CRLF_CHECKOUT);
  const branch = `agctx/team-backend-${gitIn(bot.profileDir('team-backend'), 'rev-parse', 'HEAD').slice(0, 7)}`;
  const result = bot.run(['repos', 'pr', '--profile', 'team-backend', '--yes'], { ...gh.env, ...CRLF_CHECKOUT });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  gitIn(service.work, 'fetch', '--quiet', 'origin', branch);
  assert.match(gitIn(service.work, 'show', 'FETCH_HEAD:AGENTS.md'), /Document every public endpoint/);
});

test('repos pr은 GitHub CLI가 없으면 실행 오류 대신 말로 설명한다', () => {
  const missing = Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' });
  assert.equal(
    ghFailureReason(missing),
    'GitHub CLI (gh) is not installed; install it to open pull requests automatically.'
  );
  const other = Object.assign(new Error('spawnSync gh EACCES'), { code: 'EACCES' });
  assert.equal(ghFailureReason(other), 'spawnSync gh EACCES');
});
