import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { _ } from '../i18n/index.ts';
import { CliError, EXIT } from '../shared/errors.ts';
import { toLf } from '../shared/fs-utils.ts';

/** The file name VS Code shows for one merge input, e.g. `current-CLAUDE.md`. */
export function mergeFileName(role: string, name: string): string {
  return `${role}-${name.replaceAll(/[\\/]/g, '__')}`;
}

export interface MergeInput {
  name: string;
  current: string;
  incoming: string;
  base: string;
  result: string;
}

export interface MergeOutcome {
  content: string;
  resultPath: string;
  cleanup: () => void;
}

/**
 * Open VS Code's three-way merge editor (`code --wait --merge`) for one file and
 * return what the user saved. The result pane starts from `result`. The temporary
 * directory is kept until `cleanup()` so a rejected result can still be inspected.
 */
export function mergeInVsCode({ name, current, incoming, base, result }: MergeInput): MergeOutcome {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-merge-'));
  const paths = {
    current: path.join(dir, mergeFileName('current', name)),
    incoming: path.join(dir, mergeFileName('agctx', name)),
    base: path.join(dir, mergeFileName('base', name)),
    result: path.join(dir, mergeFileName('result', name))
  };
  fs.writeFileSync(paths.current, current);
  fs.writeFileSync(paths.incoming, incoming);
  fs.writeFileSync(paths.base, base);
  fs.writeFileSync(paths.result, result);

  const args = ['--wait', '--merge', paths.current, paths.incoming, paths.base, paths.result];
  const outcome =
    process.platform === 'win32'
      ? spawnSync(
          'code.cmd',
          args.map(arg => `"${arg}"`),
          { stdio: 'inherit', shell: true }
        )
      : spawnSync('code', args, { stdio: 'inherit' });
  if (outcome.error || outcome.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new CliError('vscode.unavailable', _('error.vscode.unavailable'), {
      exitCode: EXIT.unavailable,
      hint: _('hint.vscode.install')
    });
  }
  return {
    content: toLf(fs.readFileSync(paths.result, 'utf8')),
    resultPath: paths.result,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}
