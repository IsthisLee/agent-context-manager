import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

/**
 * 스크립트, CI 작업, 에이전트가 기대는 명령 계약: 종료 코드, --json일 때 stdout에 JSON 문서 하나,
 * 터미널 밖의 --yes, 모든 오류의 다음 단계. spawnSync는 CLI에 터미널이 아니라 파이프를 준다.
 */
function sandbox(t: TestContext) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      env: { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'en', ...env },
      encoding: 'utf8'
    });
  const ok = (args: string[], env: Record<string, string> = {}) => {
    const result = run(args, env);
    assert.equal(result.status, 0, `agctx ${args.join(' ')} 실패\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  return { root, home, project, run, ok };
}

function jsonDocument(stdout: string) {
  const document = JSON.parse(stdout);
  assert.equal(document.schemaVersion, 1);
  assert.deepEqual(Object.keys(document).sort(), [
    'command',
    'data',
    'errors',
    'exitCode',
    'ok',
    'schemaVersion',
    'warnings'
  ]);
  return document;
}

test('모르는 명령은 64로 끝나고 가장 가까운 명령을 제안한다', t => {
  const { run } = sandbox(t);
  const result = run(['prifile', 'lst']);
  assert.equal(result.status, 64);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Error: Unknown command: prifile lst/);
  assert.match(result.stderr, /Next: Did you mean agctx profile list\?/);
});

test('명령이 받지 않는 옵션은 64로 끝나고 그 명령을 알려 준다', t => {
  const { run } = sandbox(t);
  const result = run(['profile', 'list', '--colour']);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /agctx profile list does not take --colour/);
  assert.match(result.stderr, /Next: /);
});

test('--json이면 stdout에는 결과 문서 하나만 있고 메시지는 stderr로 간다', t => {
  const { ok } = sandbox(t);
  ok(['profile', 'create', 'demo', '--scope', 'team']);
  const result = ok(['profile', 'list', '--json']);
  const document = jsonDocument(result.stdout);
  assert.equal(document.command, 'profile list');
  assert.equal(document.exitCode, 0);
  assert.equal(document.ok, true);
  assert.deepEqual(document.errors, []);
  assert.deepEqual(
    document.data.profiles.map((profile: { name: string }) => profile.name),
    ['demo']
  );
  assert.match(result.stderr, /demo/, '사람이 읽는 목록은 여전히 stderr로 터미널에 닿는다');
});

test('위치 인자 앞의 --json은 그 인자를 제자리에 둔다', t => {
  const { root, project, ok } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  const checked = ok(['check', '--json', project], { AGCTX_HOME: path.join(root, 'ci-home') });
  assert.ok([project, fs.realpathSync(project)].includes(jsonDocument(checked.stdout).data.project));
  const viewed = ok(['profile', 'view', '--json', 'demo']);
  assert.equal(jsonDocument(viewed.stdout).command, 'profile view');
});

test('--json 실패는 오류 코드, 메시지, 다음 단계를 담는다', t => {
  const { run } = sandbox(t);
  const result = run(['profile', 'view', 'missing', '--json']);
  assert.equal(result.status, 64);
  const document = jsonDocument(result.stdout);
  assert.equal(document.command, 'profile view');
  assert.equal(document.exitCode, 64);
  assert.equal(document.ok, false);
  assert.equal(document.errors.length, 1);
  assert.equal(document.errors[0].code, 'profile.not-found');
  assert.match(document.errors[0].message, /Profile not found: missing/);
  assert.ok(document.errors[0].hint, '모든 오류는 다음 단계를 알려 준다');
});

test('저장소를 바꾸는 명령은 터미널 밖에서 --yes가 필요하고, 없으면 프로젝트를 건드리지 않는다', t => {
  const { project, run, ok } = sandbox(t);
  ok(['profile', 'create', 'demo']);

  const refused = run(['profile', 'apply', 'demo', project]);
  assert.equal(refused.status, 64);
  assert.match(refused.stderr, /cannot ask for confirmation here/);
  assert.match(refused.stderr, /--yes/);
  assert.deepEqual(fs.readdirSync(project), []);

  const refusedJson = run(['profile', 'apply', 'demo', project, '--json']);
  assert.equal(refusedJson.status, 64);
  assert.equal(jsonDocument(refusedJson.stdout).errors[0].code, 'confirm.required');
  assert.deepEqual(fs.readdirSync(project), []);

  const preview = ok(['profile', 'apply', 'demo', project, '--dry-run']);
  assert.match(preview.stdout, /create\s+AGENTS\.md/);
  assert.deepEqual(fs.readdirSync(project), [], 'dry run은 묻지도 쓰지도 않는다');

  const applied = ok(['profile', 'apply', 'demo', project, '--yes', '--json']);
  const document = jsonDocument(applied.stdout);
  assert.equal(document.data.written, true);
  assert.equal(document.data.source, null);
  assert.ok(fs.existsSync(path.join(project, 'AGENTS.md')));
});

test('<command> --help는 명령을 실행하지 않고 사용법과 종료 코드를 출력한다', t => {
  const { project, ok } = sandbox(t);
  const result = ok(['profile', 'apply', '--help']);
  assert.match(result.stdout, /Usage: agctx profile apply \[--dry-run\] \[--pin\] \[--yes\] <name> \[<project>\]/);
  assert.match(
    result.stdout,
    /Exit codes: 0 success, 64 usage error, 70 other error, 2 conflict, 3 hidden characters, 69 external tool or network unavailable/
  );
  assert.deepEqual(fs.readdirSync(project), []);
});

test('check는 보관함 없이 CI에서 실행되고 가장 심각한 결과를 보고한다', t => {
  const { root, project, ok, run } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  const ci = { AGCTX_HOME: path.join(root, 'ci-home') };

  const clean = ok(['check', project], ci);
  assert.match(clean.stdout, /matches its recorded profile version/);
  assert.match(clean.stderr, /Profile demo is not in this machine's profile store and has no Git source/);

  const claudePath = path.join(project, 'CLAUDE.md');
  const claude = fs.readFileSync(claudePath, 'utf8');
  fs.writeFileSync(
    claudePath,
    claude.replace('<!-- agctx:managed:start -->\n', '<!-- agctx:managed:start -->\nEdited by hand.\n')
  );
  const conflict = run(['check', project], ci);
  assert.equal(conflict.status, 2);
  assert.match(conflict.stdout, /conflict\s+CLAUDE\.md/);

  // 관리 영역 밖의 오른쪽→왼쪽 재정의 문자: 충돌은 아니지만 에이전트는 여전히 그것을 읽는다.
  fs.appendFileSync(path.join(project, 'AGENTS.md'), '\nRun the tests \u202Ebefore\u202C committing.\n');
  const hidden = run(['check', project, '--json'], ci);
  assert.equal(hidden.status, 3, '숨은 문자가 충돌보다 우선한다');
  const document = jsonDocument(hidden.stdout);
  assert.equal(document.command, 'check');
  assert.deepEqual([...new Set(document.data.findings.map((finding: { kind: string }) => finding.kind))].sort(), [
    'conflict',
    'hidden-characters'
  ]);
  assert.ok(
    document.data.findings.some((finding: { detail: string }) => /AGENTS\.md:\d+:\d+ U\+202E/.test(finding.detail))
  );

  fs.writeFileSync(claudePath, claude);
});

test('check는 프로필보다 뒤처진 프로젝트를 sync할 때까지 1로 보고한다', t => {
  const { project, ok, run } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  ok(['check', project]);

  ok(['profile', 'setup', 'demo', '--tdd', 'on']);
  const behind = run(['check', project]);
  assert.equal(behind.status, 1);
  assert.match(behind.stdout, /behind\s+AGENTS\.md\s+differs from the current profile; run agctx profile sync/);

  ok(['profile', 'sync', project, '--yes']);
  ok(['check', project]);
});

test('한 번도 적용하지 않은 프로젝트의 check는 apply 명령과 함께 64로 끝난다', t => {
  const { project, run } = sandbox(t);
  const result = run(['check', project]);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /Next: .*agctx profile apply/);
});

test('빠진 인자를 물어볼 명령은 물을 수 없으면 대신 그 인자 이름을 알려 준다', t => {
  const { run } = sandbox(t);
  const cases: [string[], RegExp][] = [
    [['profile', 'create'], /Usage: agctx profile create <name>/],
    [['profile', 'setup', '--json'], /Usage: agctx profile setup <name>/]
  ];
  for (const [args, usage] of cases) {
    const result = run(args);
    assert.equal(result.status, 64, args.join(' '));
    assert.match(args.includes('--json') ? JSON.parse(result.stdout).errors[0].message : result.stderr, usage);
  }
});

test('다른 이름의 폴더에 있는 사본도 기록된 프로젝트 이름을 유지해서 check와 sync가 변경을 보지 않는다', t => {
  const { root, project, ok } = sandbox(t);
  ok(['profile', 'create', 'demo']);
  ok(['profile', 'apply', 'demo', project, '--yes']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'agctx.project.json'), 'utf8')).projectName, 'project');

  // 동료가 다른 이름의 폴더에 저장소를 clone한다.
  const copy = path.join(root, 'teammate-copy');
  fs.cpSync(project, copy, { recursive: true });
  ok(['check', copy]);
  assert.match(ok(['profile', 'sync', copy, '--yes']).stdout, /already up to date/);
  assert.match(fs.readFileSync(path.join(copy, 'AGENTS.md'), 'utf8'), /\*\*Project:\*\* project/);
});
