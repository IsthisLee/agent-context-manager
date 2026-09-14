import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Open VS Code's three-way merge editor (`code --wait --merge`) for one file and
 * return what the user saved. The temporary directory is kept until `cleanup()`
 * so a rejected result can still be inspected.
 * @param {{ name: string, current: string, incoming: string, base: string }} input
 */
export function mergeInVsCode({ name, current, incoming, base }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-merge-'));
  const safeName = name.replaceAll(/[\\/]/g, '__');
  const paths = {
    current: path.join(dir, `current-${safeName}`),
    incoming: path.join(dir, `agentic-${safeName}`),
    base: path.join(dir, `base-${safeName}`),
    result: path.join(dir, `result-${safeName}`)
  };
  fs.writeFileSync(paths.current, current);
  fs.writeFileSync(paths.incoming, incoming);
  fs.writeFileSync(paths.base, base);
  fs.writeFileSync(paths.result, incoming);

  const args = ['--wait', '--merge', paths.current, paths.incoming, paths.base, paths.result];
  const outcome = process.platform === 'win32'
    ? spawnSync('code.cmd', args.map(arg => `"${arg}"`), { stdio: 'inherit', shell: true })
    : spawnSync('code', args, { stdio: 'inherit' });
  if (outcome.error || outcome.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error('VS Code CLI `code` is not available or exited with an error. In VS Code run "Shell Command: Install \'code\' command in PATH", or resolve without --edit.');
  }
  return {
    content: fs.readFileSync(paths.result, 'utf8'),
    resultPath: paths.result,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}
