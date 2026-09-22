import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { agentsLengthWarnings, AGENTS_BYTE_WARNING, AGENTS_LINE_WARNING } from '../src/project/plan.ts';
import { gitIn, makeWorkspace } from './support/git-workspace.ts';

/**
 * 프로젝트 AGENTS.md가 길면 에이전트가 규칙을 덜 따르거나 뒷부분을 읽지 않는다. apply·sync는 파일과
 * 종료 코드를 바꾸지 않고 경고만 낸다(ADR 0024). 기준은 Claude Code가 권하는 200줄과 Codex 기본 한도
 * 32 KiB의 75%인 24 KiB다.
 */

const lines = (count: number) => Array.from({ length: count }, (_, index) => `- rule ${index + 1}`).join('\n') + '\n';

test('분량 경고 기준은 200줄 초과와 24 KiB 이상이다', () => {
  assert.equal(AGENTS_LINE_WARNING, 200);
  assert.equal(AGENTS_BYTE_WARNING, 24 * 1024);
  assert.deepEqual(agentsLengthWarnings(lines(200)), [], '200줄은 경고하지 않는다');
  assert.equal(agentsLengthWarnings(lines(201)).length, 1, '201줄은 경고한다');
  assert.equal(agentsLengthWarnings(lines(200).trimEnd()).length, 0, '마지막 줄바꿈이 없어도 200줄이다');
  const justUnder = 'a'.repeat(AGENTS_BYTE_WARNING - 2) + '\n';
  assert.deepEqual(agentsLengthWarnings(justUnder), [], '24 KiB 미만은 경고하지 않는다');
  assert.equal(agentsLengthWarnings('a'.repeat(AGENTS_BYTE_WARNING - 1) + '\n').length, 1, '24 KiB는 경고한다');
  // 한글은 UTF-8에서 한 글자가 3바이트라서 줄 수보다 바이트 한도에 먼저 닿는다.
  const korean = Array.from({ length: 100 }, () => '가'.repeat(90)).join('\n') + '\n';
  const warned = agentsLengthWarnings(korean);
  assert.equal(warned.length, 1, '한국어 100줄도 바이트로 경고한다');
  assert.match(warned[0], /KiB/);
  assert.equal(agentsLengthWarnings(lines(300) + 'x'.repeat(AGENTS_BYTE_WARNING)).length, 2, '둘 다 넘으면 둘 다');
});

function project(t: TestContext) {
  const { person, folder } = makeWorkspace(t, 'agctx-length-');
  const me = person('me');
  me.ok(['profile', 'create', 'team-backend', '--scope', 'team']);
  const repo = folder('payments-api');
  gitIn(repo, 'init', '--quiet', '--initial-branch=main');
  const agents = path.join(repo, 'AGENTS.md');
  return { me, repo, agents };
}

test('apply와 sync는 긴 AGENTS.md를 경고만 하고 파일과 종료 코드는 그대로 둔다', t => {
  const { me, repo, agents } = project(t);
  fs.writeFileSync(agents, `# payments-api\n\n${lines(230)}`);

  const preview = me.run(['profile', 'apply', 'team-backend', repo, '--dry-run']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stderr, /AGENTS\.md is \d+ lines/, 'dry-run도 경고한다');

  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stderr, /AGENTS\.md is (\d+) lines[^\n]*200 lines/);
  const lineCount = fs.readFileSync(agents, 'utf8').trimEnd().split('\n').length;
  assert.match(applied.stderr, new RegExp(`AGENTS\\.md is ${lineCount} lines`), '경고는 쓴 파일의 줄 수를 말한다');
  assert.match(fs.readFileSync(agents, 'utf8'), /- rule 230/, '프로젝트 규칙은 그대로 남는다');

  const synced = me.run(['profile', 'sync', repo, '--json']);
  assert.equal(synced.status, 0, synced.stderr);
  const envelope = JSON.parse(synced.stdout);
  assert.equal(envelope.ok, true);
  assert.ok(
    envelope.warnings.some((message: string) => /AGENTS\.md is \d+ lines/.test(message)),
    'JSON 결과의 warnings에 담는다'
  );

  const repos = me.run(['repos', 'sync', '--dry-run']);
  assert.equal(repos.status, 0, repos.stderr);
  assert.match(
    repos.stderr,
    new RegExp(`${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: Warning: AGENTS\\.md is \\d+ lines`)
  );
});

test('짧은 AGENTS.md에는 분량 경고가 없다', t => {
  const { me, repo, agents } = project(t);
  fs.writeFileSync(agents, '# payments-api\n\n- Use idempotency keys.\n');
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes']);
  assert.equal(applied.status, 0, applied.stderr);
  assert.doesNotMatch(applied.stderr, /lines|KiB/);
});

test('한국어 설정에서는 경고를 한국어로 보여 준다', t => {
  const { me, repo, agents } = project(t);
  fs.writeFileSync(agents, `# payments-api\n\n${Array.from({ length: 120 }, () => '가'.repeat(80)).join('\n')}\n`);
  const applied = me.run(['profile', 'apply', 'team-backend', repo, '--yes'], { AGCTX_LANG: 'ko' });
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stderr, /AGENTS\.md 파일이 \d+(\.\d)? KiB입니다/);
});

test('TUI에서 적용해도 같은 경고가 보인다', async t => {
  const { me, repo, agents } = project(t);
  fs.writeFileSync(agents, `# payments-api\n\n${lines(230)}`);
  const previous = { home: process.env.AGCTX_HOME, lang: process.env.AGCTX_LANG };
  process.env.AGCTX_HOME = me.home;
  process.env.AGCTX_LANG = 'en';
  const written: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  const originalOut = process.stdout.write.bind(process.stdout);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  t.after(() => {
    process.stderr.write = original;
    process.stdout.write = originalOut;
    if (previous.home === undefined) delete process.env.AGCTX_HOME;
    else process.env.AGCTX_HOME = previous.home;
    if (previous.lang === undefined) delete process.env.AGCTX_LANG;
    else process.env.AGCTX_LANG = previous.lang;
  });
  const { runFromTui } = await import('../src/tui/commands.ts');
  const outcome = await runFromTui('profile.apply', ['team-backend', repo], { yes: true });
  process.stderr.write = original;
  process.stdout.write = originalOut;
  assert.equal(outcome.exitCode, 0);
  assert.match(written.join(''), /AGENTS\.md is \d+ lines/);
});
