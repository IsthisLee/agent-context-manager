import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, makeWorkspace, repoRoot } from './support/git-workspace.ts';

/**
 * The command examples in the quick start are real output. Run them again in an
 * isolated home, from a folder that stands in for the doc's `/work`, and compare
 * each command's output line by line with what the doc shows.
 */

const QUICK_START = 'docs/getting-started/quick-start.md';

interface Step {
  command: string;
  expected: string[];
}

/** `$ command` lines in bash blocks, each with the output lines that follow it. */
function exampleSteps(markdown: string): Step[] {
  const steps: Step[] = [];
  for (const block of markdown.matchAll(/```bash\n([\s\S]*?)```/g)) {
    const lines = block[1].replace(/\n$/, '').split('\n');
    let current: Step | null = null;
    for (const line of lines) {
      if (line.startsWith('$ ')) {
        current = { command: line.slice(2), expected: [] };
        steps.push(current);
      } else if (current) {
        current.expected.push(line);
      }
    }
  }
  for (const step of steps) {
    while (step.expected.at(-1) === '') step.expected.pop();
  }
  return steps;
}

/** Output with the scratch folder written as the doc's `/work`, using `/` on every platform. */
function asDocPath(output: string, work: string): string {
  return output
    .split(work)
    .join('/work')
    .replace(/\/work((?:\\[^\s\\]+)+)/g, (_match, rest: string) => `/work${rest.replaceAll('\\', '/')}`);
}

test('every command example in the quick start prints what the doc shows', t => {
  const { root, folder } = makeWorkspace(t, 'agctx-quick-start-');
  const work = folder('work');
  const userHome = folder('user-home');
  const env = {
    ...process.env,
    AGCTX_HOME: path.join(root, 'home'),
    AGCTX_LANG: 'en',
    HOME: userHome,
    USERPROFILE: userHome
  };
  const steps = exampleSteps(fs.readFileSync(path.join(repoRoot, QUICK_START), 'utf8'));
  assert.ok(
    steps.filter(step => step.command.startsWith('agctx ')).length >= 5,
    'the quick start shows its commands with their output'
  );

  for (const step of steps) {
    const [program, ...args] = step.command.split(' ');
    let output = '';
    if (program === 'mkdir') {
      fs.mkdirSync(path.join(work, ...args));
    } else {
      assert.equal(program, 'agctx', `the example runner does not know: ${step.command}`);
      const result = spawnSync(process.execPath, [cli, ...args], { cwd: work, env, encoding: 'utf8' });
      output = result.stdout + result.stderr;
    }
    const actual = asDocPath(output, work).replace(/\n$/, '');
    assert.deepEqual(actual ? actual.split('\n') : [], step.expected, `$ ${step.command}`);
  }
});
