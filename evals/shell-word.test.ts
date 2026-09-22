import test from 'node:test';
import assert from 'node:assert/strict';
import { shellWord } from '../src/shared/shell.ts';

/**
 * agctx가 사람이 복사하도록 출력하는 명령은 그 사람의 셸이 읽는 방식으로 인자를 인용한다.
 * POSIX 셸은 역슬래시를 이스케이프로 보지만 cmd.exe와 PowerShell은 그렇지 않고, Windows 경로에는
 * 역슬래시가 가득하다.
 */

test('POSIX 셸 단어는 안전하면 그대로 두고, 아니면 이스케이프해서 큰따옴표로 감싼다', () => {
  assert.equal(shellWord('/work/team-rules', 'darwin'), '/work/team-rules');
  assert.equal(shellWord('/work/team rules', 'linux'), '"/work/team rules"');
  assert.equal(shellWord('a"b$c', 'linux'), '"a\\"b\\$c"');
});

test('Windows 경로는 역슬래시와 짧은 이름의 물결표를 유지하고 공백이 있을 때만 인용한다', () => {
  assert.equal(
    shellWord('C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\rules', 'win32'),
    'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\rules'
  );
  assert.equal(shellWord('C:\\Users\\me\\team rules', 'win32'), '"C:\\Users\\me\\team rules"');
  assert.equal(shellWord('say "hi"', 'win32'), '"say ""hi"""');
});
