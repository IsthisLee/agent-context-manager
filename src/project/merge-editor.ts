import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { _ } from '../i18n/index.ts';
import { CliError, EXIT } from '../shared/errors.ts';
import { toLf } from '../shared/fs-utils.ts';

/** VS Code가 병합 입력 하나에 보여 주는 파일 이름. 예: `current-CLAUDE.md`. */
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
 * 파일 하나에 VS Code의 3방향 병합 편집기(`code --wait --merge`)를 열고 사용자가 저장한 것을 돌려준다.
 * 결과 창은 `result`에서 시작한다. 거부된 결과도 살펴볼 수 있도록 임시 폴더는 `cleanup()`까지 남긴다.
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
