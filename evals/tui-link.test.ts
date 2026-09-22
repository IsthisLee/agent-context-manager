import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkLinkFolder, MAX_FOLDERS, planLink, ruleFileChoices } from '../src/profile/link.ts';
import {
  brokenLinkNote,
  linkNameDefault,
  linkOutro,
  linkRuleOptions,
  menuFor,
  OTHER_RULES_FILE,
  removeChoices,
  removeNote,
  statusRefreshPrompt
} from '../src/tui/profile.ts';
import { gitIn } from './support/git-workspace.ts';

/**
 * `profile link` 주변에서 TUI가 내리는 판단을, `evals/tui-pin.test.ts`가 고정 질문을 검사하는
 * 방식으로 검사한다. 판단마다 함수라서 터미널 화면을 그리지 않고 실행할 수 있다.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

function workspace(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-tui-link-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  const previousHome = process.env.AGCTX_HOME;
  process.env.AGCTX_HOME = home;
  t.after(() => {
    if (previousHome === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previousHome;
  });
  const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en' };
  const agctx = (...args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
  };
  const folder = (name: string, files: Record<string, string>) => {
    const dir = path.join(root, name);
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), content);
    }
    return dir;
  };
  return { root, agctx, folder };
}

test('TUI는 link가 가져갈 규칙 파일, 다른 AGENTS.md 파일들, 직접 입력하는 경로를 제안한다', t => {
  const { folder } = workspace(t);
  const root = folder('root-rules', { 'AGENTS.md': '# Root\n', 'docs/AGENTS.md': '# Docs\n' });
  const nested = folder('nested-rules', { 'templates/AGENTS.md': '# Nested\n' });
  const many = folder('many-rules', { 'backend/AGENTS.md': '# Backend\n', 'frontend/AGENTS.md': '# Frontend\n' });
  const none = folder('other-rules', { 'rules/CONVENTIONS.md': '# Conventions\n' });

  const values = (dir: string) => linkRuleOptions(dir).options.map(option => option.value);
  assert.deepEqual(values(root), ['AGENTS.md', 'docs/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(root).initial, 'AGENTS.md');
  assert.deepEqual(values(nested), ['templates/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(nested).initial, 'templates/AGENTS.md');
  assert.deepEqual(values(many), ['backend/AGENTS.md', 'frontend/AGENTS.md', OTHER_RULES_FILE]);
  assert.equal(linkRuleOptions(many).initial, undefined, '후보가 여럿이면 선택을 그 사람에게 맡긴다');
  assert.deepEqual(values(none), [OTHER_RULES_FILE], 'AGENTS.md가 없는 폴더도 규칙 파일을 지정할 방법을 받는다');
});

test('TUI는 연결을 일어난 일로 끝낸다: 연결됨, 이미 연결됨, 거절, 실패', () => {
  assert.equal(linkOutro({ exitCode: 0, data: { written: true, link: 'create', metadata: 'create' } }), 'done');
  assert.equal(linkOutro({ exitCode: 0, data: { written: false, link: 'unchanged', metadata: 'keep' } }), 'unchanged');
  assert.equal(linkOutro({ exitCode: 0, data: { written: false, link: 'create', metadata: 'create' } }), 'declined');
  assert.equal(linkOutro({ exitCode: 64 }), 'failed');
});

test('TUI 목록에서 고른 끊긴 링크는 자기 메뉴를 열고, 삭제 목록에는 모든 끊긴 링크가 나온다', t => {
  const { agctx, folder, root } = workspace(t);
  const healthy = folder('healthy-rules', { 'AGENTS.md': '# Healthy\n' });
  const moved = folder('moved-rules', { 'AGENTS.md': '# Moved\n' });
  const emptied = folder('emptied-rules', { 'AGENTS.md': '# Emptied\n' });
  for (const dir of [healthy, moved, emptied]) agctx('profile', 'link', dir, '--yes');
  fs.renameSync(moved, path.join(root, 'elsewhere'));
  fs.rmSync(path.join(emptied, 'profile.json'));

  assert.equal(menuFor('healthy-rules'), 'profile');
  assert.equal(menuFor('moved-rules'), 'broken-link');
  assert.equal(menuFor('emptied-rules'), 'broken-link');
  assert.deepEqual(
    removeChoices()
      .map(choice => choice.value)
      .sort(),
    ['emptied-rules', 'healthy-rules', 'moved-rules']
  );
});

test('TUI는 연결된 프로필의 상태를 보여 주기 전에 fetch를 제안하지 않는다', t => {
  const { agctx, folder } = workspace(t);
  agctx('profile', 'create', 'copied');
  agctx('profile', 'link', folder('linked-rules', { 'AGENTS.md': '# Linked\n' }), '--yes');

  assert.deepEqual(statusRefreshPrompt('linked-rules'), { ask: false });
  assert.deepEqual(statusRefreshPrompt('copied'), { ask: true });
});

test('link는 동작하든 끊겼든 링크를 다른 폴더로 옮기지 않고, 그렇게 하는 방법을 알려 준다', t => {
  const { agctx, folder, root } = workspace(t);
  const first = folder('a/rules', { 'AGENTS.md': '# First\n' });
  const second = folder('b/rules', { 'AGENTS.md': '# Second\n' });
  agctx('profile', 'link', first, '--yes');

  assert.throws(
    () => planLink(second),
    (error: Error) => error.message.includes(first)
  );

  fs.renameSync(first, path.join(root, 'a', 'moved'));
  assert.throws(
    () => planLink(second),
    (error: { hint?: string }) => Boolean(error.hint?.includes('profile remove rules --yes'))
  );
});

test('TUI 규칙 파일 목록은 숨은 폴더, 의존성·빌드 폴더, 아주 깊은 파일을 뺀다', t => {
  const { folder } = workspace(t);
  const dir = folder('busy-rules', {
    'templates/AGENTS.md': '# Rules\n',
    'node_modules/pkg/AGENTS.md': '# Dependency\n',
    '.cache/AGENTS.md': '# Hidden\n',
    'dist/AGENTS.md': '# Build\n',
    'a/b/c/d/e/AGENTS.md': '# Deep\n'
  });

  assert.deepEqual(
    linkRuleOptions(dir).options.map(option => option.value),
    ['templates/AGENTS.md', OTHER_RULES_FILE]
  );
});

test('포인터를 읽을 수 없는 링크는 그 이름을 다시 연결하기 전에 지운다', t => {
  const { agctx, folder, root } = workspace(t);
  const dir = folder('company-rules', { 'AGENTS.md': '# Company\n' });
  agctx('profile', 'link', dir, '--name', 'company', '--yes');
  fs.writeFileSync(path.join(root, 'home', 'profiles', 'company', 'link.json'), 'not json\n');

  assert.throws(
    () => planLink(dir, { name: 'company' }),
    (error: { code?: string; hint?: string }) =>
      error.code === 'link.broken-exists' && Boolean(error.hint?.includes('profile remove company --yes'))
  );
});

test('TUI는 끊긴 링크를 되살리는 명령과 함께 보여 준다', t => {
  const { agctx, folder } = workspace(t);
  const dir = folder('company-rules', { 'AGENTS.md': '# Company\n' });
  agctx('profile', 'link', dir, '--name', 'company', '--scope', 'company', '--yes');
  fs.rmSync(path.join(dir, 'profile.json'));

  const text = brokenLinkNote('company');

  assert.ok(text.includes('agctx profile remove company --yes'), text);
  assert.ok(text.includes(`agctx profile link ${dir} --name company --scope company`), text);
});

test('TUI 목록은 이미 읽은 끊긴 링크로 어떤 메뉴를 열지 정한다', t => {
  workspace(t);

  assert.equal(menuFor('ghost', [{ name: 'ghost', path: '/nowhere', reason: 'missing-folder' }]), 'broken-link');
  assert.equal(menuFor('ghost', []), 'profile');
});

test('규칙 파일 찾기는 정해진 폴더 수를 읽으면 멈추고 일부만 찾은 결과로 추측하지 않는다', t => {
  const { folder } = workspace(t);
  const files: Record<string, string> = { 'zzz/AGENTS.md': '# Rules\n' };
  for (let index = 0; index < MAX_FOLDERS; index++) files[`d${String(index).padStart(4, '0')}/.keep`] = '';
  const dir = folder('huge-rules', files);

  assert.equal(ruleFileChoices(dir).complete, false);
  assert.throws(() => planLink(dir), { code: 'link.search-limit' });
});

test('TUI는 프로필이 아닌 보관함 폴더를 지울 수 있고, 그것이 무엇인지 알려 준다', t => {
  const { root } = workspace(t);
  fs.mkdirSync(path.join(root, 'home', 'profiles', 'leftover'), { recursive: true });
  fs.writeFileSync(path.join(root, 'home', 'profiles', 'leftover', 'AGENTS.md'), '# Old\n');

  assert.ok(removeChoices().some(choice => choice.value === 'leftover'));
  assert.match(removeNote('leftover'), /not a profile/);
});

test('폴더 이름이 이름 규칙에 맞지 않으면 TUI는 맞는 이름을 제안한다', () => {
  assert.equal(linkNameDefault('/work/Team_Rules'), 'team-rules');
  assert.equal(linkNameDefault('/work/team-rules'), 'team-rules');
});

test('TUI는 삭제가 지우는 것을 설명하기 전에 프로필 이름이 아닌 이름을 거부한다', t => {
  workspace(t);

  assert.throws(() => removeNote('../..'), { code: 'profile.invalid-name' });
});

test('TUI는 규칙 파일을 찾기 전에 폴더를 검사한다', t => {
  const { root, folder } = workspace(t);
  const home = path.join(root, 'user-home');
  fs.mkdirSync(home);
  // os.homedir()는 POSIX에서 HOME을, Windows에서 USERPROFILE을 읽는다.
  const previous = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const repo = folder('company-configs', { 'agent-rules/AGENTS.md': '# Rules\n' });
  gitIn(repo, 'init', '--quiet');
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '--quiet', '-m', 'Add rules');

  assert.throws(() => checkLinkFolder(home), { code: 'link.home-folder' });
  assert.throws(() => checkLinkFolder(path.join(repo, 'agent-rules')), { code: 'link.inside-repository' });
  checkLinkFolder(repo);
});

test('TUI 규칙 파일 목록은 agctx가 프로필을 적용하며 쓴 AGENTS.md를 뺀다', t => {
  const { folder } = workspace(t);
  const dir = folder('applied-rules', {
    'AGENTS.md': '# Project\n<!-- agctx:managed:end -->\n',
    'templates/AGENTS.md': '# Rules\n'
  });

  const rules = linkRuleOptions(dir);

  assert.deepEqual(
    rules.options.map(option => option.value),
    ['templates/AGENTS.md', OTHER_RULES_FILE]
  );
  assert.equal(rules.initial, 'templates/AGENTS.md');
});
