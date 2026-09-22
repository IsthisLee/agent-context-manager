import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { _ } from '../i18n/index.ts';
import { CliError, EXIT } from './errors.ts';

export interface GitOutput {
  status: number;
  stdout: string;
  stderr: string;
}

const REMOTE_FAILURE =
  /Authentication failed|could not read (Username|Password)|unable to get password|Permission denied \(publickey\)|Repository not found|does not appear to be a git repository|Could not resolve host|unable to access|Connection (timed out|refused)|Host key verification failed/i;

/**
 * git이 작업 트리가 아니라 원격에 닿거나 로그인하는 데서 실패했는지. 그런 실패는 Git 자격 증명
 * 안내를 다음 단계로 주고 종료 코드 69를 내서, 비밀번호가 없는 상황이 알 수 없는 오류가 아니라 로그인
 * 문제로 읽히게 한다.
 */
export function isRemoteFailure(stderr: string): boolean {
  return REMOTE_FAILURE.test(stderr);
}

/**
 * 셸을 거치지 않고 인자를 나눠 git을 실행한다. 터미널 밖에서는 git이 비밀번호 프롬프트를 기다리면
 * 안 되므로 거기서는 대화형 프롬프트를 끈다.
 */
export function git(args: readonly string[], options: { cwd?: string; allowFailure?: boolean } = {}): GitOutput {
  if (options.cwd && !fs.existsSync(options.cwd)) throw new Error(`Folder not found: ${options.cwd}`);
  const env = process.stdin.isTTY ? process.env : { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  const result = spawnSync('git', args, { cwd: options.cwd, encoding: 'utf8', env });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CliError('git.missing', _('error.git.missing'), {
        exitCode: EXIT.unavailable,
        hint: _('hint.git.install')
      });
    }
    throw result.error;
  }
  const output = { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
  if (output.status !== 0 && !options.allowFailure) {
    const detail = output.stderr.trim().split('\n').slice(-3).join('\n');
    if (isRemoteFailure(output.stderr)) {
      throw new CliError('git.remote', _('error.git.remote', { detail }), {
        exitCode: EXIT.unavailable,
        hint: _('hint.git.remote')
      });
    }
    throw new CliError('git.failed', _('error.git.failed', { command: `git ${args.join(' ')}`, detail }), {
      exitCode: EXIT.software
    });
  }
  return output;
}

/** `dir` 자체가 Git 작업 트리의 맨 위인지(다른 저장소 안의 폴더가 아닌지). */
export function isGitRoot(dir: string): boolean {
  // 작업 트리 맨 위에는 항상 .git(폴더, 또는 worktree이면 파일)이 있으므로, 로컬 프로필에는 Git 설치가 필요 없다.
  if (!fs.existsSync(path.join(dir, '.git'))) return false;
  // 경로를 비교하지 않고 맨 위까지 얼마나 올라가는지 git에 묻는다. macOS의 /var 임시 폴더, RUNNER~1
  // 같은 Windows 짧은 이름, 다른 대소문자 표기는 git이 보고하는 것과 폴더를 다르게 적는다.
  const result = git(['rev-parse', '--show-cdup'], { cwd: dir, allowFailure: true });
  return result.status === 0 && result.stdout.trim() === '';
}

/**
 * 커밋 `rev`의 `file`에 있는 일반 파일의 내용. 커밋에 그런 파일이 없으면 null. 심볼릭 링크는 자기
 * 모드를 가진 blob이고, 연결된 폴더를 거친 경로는 트리 항목이 아예 아니므로, 둘 다 폴더와 마찬가지로
 * 없는 것으로 읽는다.
 */
export function committedFile(dir: string, rev: string, file: string): string | null {
  const entry = git(['--literal-pathspecs', 'ls-tree', '-z', rev, '--', file], { cwd: dir, allowFailure: true });
  const match = entry.status === 0 ? /^(?:100644|100755) blob ([0-9a-f]+)\t([^\0]*)\0$/.exec(entry.stdout) : null;
  if (!match || match[2] !== file) return null;
  const blob = git(['cat-file', 'blob', match[1]], { cwd: dir, allowFailure: true });
  return blob.status === 0 ? blob.stdout : null;
}

/**
 * 명령줄로 준 원격. 이미 있는 로컬 경로는 절대 경로로 바꿔서, git이 자기가 실행되는 프로필 폴더
 * 기준으로 읽지 않게 한다. URL은 입력한 그대로 둔다.
 */
export function resolveRemoteLocation(location: string): string {
  const local = path.resolve(location);
  return fs.existsSync(local) ? local : location;
}

/** 기록해도 안전한 원격 URL. URL 형식 주소에서 사용자 이름, 비밀번호, 토큰을 뺀다. */
export function sanitizeRemoteUrl(url: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}
