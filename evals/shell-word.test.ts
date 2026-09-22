import test from 'node:test';
import assert from 'node:assert/strict';
import { shellWord } from '../src/shared/shell.ts';

/**
 * Commands agctx prints for a person to copy quote their arguments the way that person's shell reads them.
 * POSIX shells treat a backslash as an escape; cmd.exe and PowerShell do not, and Windows paths are full of them.
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
