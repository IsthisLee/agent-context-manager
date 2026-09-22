import test from 'node:test';
import assert from 'node:assert/strict';
import { shellWord } from '../src/shared/shell.ts';

/**
 * agctx가 사람이 복사하도록 출력하는 명령은 그 사람의 셸이 읽는 방식으로 인자를 인용한다.
 * POSIX 셸은 역슬래시를 이스케이프로 보지만 cmd.exe와 PowerShell은 그렇지 않고, Windows 경로에는
 * 역슬래시가 가득하다.
 */

test('a POSIX shell word is left bare when safe and double-quoted with escapes otherwise', () => {
  assert.equal(shellWord('/work/team-rules', 'darwin'), '/work/team-rules');
  assert.equal(shellWord('/work/team rules', 'linux'), '"/work/team rules"');
  assert.equal(shellWord('a"b$c', 'linux'), '"a\\"b\\$c"');
});

test('a Windows path keeps its backslashes and short-name tildes and is quoted only when it holds a space', () => {
  assert.equal(
    shellWord('C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\rules', 'win32'),
    'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\rules'
  );
  assert.equal(shellWord('C:\\Users\\me\\team rules', 'win32'), '"C:\\Users\\me\\team rules"');
  assert.equal(shellWord('say "hi"', 'win32'), '"say ""hi"""');
});
