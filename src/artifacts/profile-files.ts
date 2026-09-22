import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { toLf } from '../shared/fs-utils.ts';
import { git, isGitRoot } from '../shared/git.ts';

/**
 * 프로필 폴더에서 저장소로 나눠 줄 파일을 읽는다. skills는 `skills/<이름>/` 아래 파일 전부, subagents는
 * `subagents/<이름>.md`, hooks는 `hooks.json`이다. 커밋한 버전은 git에서, 아니면 폴더에서 읽는다.
 * 심볼릭 링크는 이 컴퓨터의 다른 파일을 다른 사람의 저장소로 퍼뜨릴 수 있으므로 받지 않는다.
 */

export const PROFILE_SKILLS_DIR = 'skills';
export const PROFILE_SUBAGENTS_DIR = 'subagents';
export const PROFILE_HOOKS_FILE = 'hooks.json';
/** 프로필 버전을 기록할 때 커밋하지 않은 수정이 있는지 보는 경로. */
export const PROFILE_ARTIFACT_PATHS: readonly string[] = [
  PROFILE_SKILLS_DIR,
  PROFILE_SUBAGENTS_DIR,
  PROFILE_HOOKS_FILE
];

/** 운영체제가 폴더마다 만드는 파일. 프로필 작성자가 둔 것이 아니므로 나눠 주지 않는다. */
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
/**
 * Git이 아닌 프로필에서 건너뛰는 폴더. skill의 스크립트를 한 번 실행하면 생기는 부산물이다. Git 프로필은
 * 이 목록 대신 그 저장소의 `.gitignore`를 따른다.
 */
const IGNORED_FOLDERS = new Set(['.git', 'node_modules', '__pycache__', '.venv', '.pytest_cache', '.mypy_cache']);

export interface ProfileFile {
  /** 프로필 폴더 기준 `/` 경로. */
  path: string;
  /** 줄 끝을 LF로 맞춘 내용. */
  content: string;
  executable: boolean;
}

function symlinkError(file: string): Error {
  return usageError(
    'profile.artifact-symlink',
    _('error.profile.artifact-symlink', { file }),
    _('hint.profile.artifact-symlink')
  );
}

function binaryError(file: string): Error {
  return usageError(
    'profile.artifact-binary',
    _('error.profile.artifact-binary', { file }),
    _('hint.profile.artifact')
  );
}

/** 파일의 글. NUL 바이트가 든 파일은 글이 아니므로 받지 않는다. */
function textOf(file: string, text: string): string {
  if (text.includes('\0')) throw binaryError(file);
  return toLf(text);
}

function walk(root: string, rel: string, found: ProfileFile[]): void {
  const full = path.join(root, ...rel.split('/'));
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) throw symlinkError(rel);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(full).sort())
      if (!IGNORED_NAMES.has(name) && !IGNORED_FOLDERS.has(name)) walk(root, `${rel}/${name}`, found);
    return;
  }
  if (!stat.isFile()) return;
  found.push({ path: rel, content: textOf(rel, fs.readFileSync(full, 'utf8')), executable: (stat.mode & 0o111) !== 0 });
}

/**
 * Git 프로필의 작업 폴더에서 나눠 줄 파일: 추적 중이거나, 추적하지 않지만 `.gitignore`가 가리지 않은 파일.
 * 가린 파일(`.env`, 빌드 부산물)은 커밋되지 않으므로 다른 사람의 저장소로 가면 안 된다.
 */
function gitListedArtifactFiles(dir: string): ProfileFile[] {
  const listed = git(
    [
      '--literal-pathspecs',
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...PROFILE_ARTIFACT_PATHS
    ],
    { cwd: dir }
  );
  const found: ProfileFile[] = [];
  for (const rel of [...new Set(listed.stdout.split('\0').filter(Boolean))].sort()) {
    if (IGNORED_NAMES.has(rel.split('/').pop() ?? '')) continue;
    const full = path.join(dir, ...rel.split('/'));
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(full);
    } catch {
      // 추적 중이지만 작업 폴더에서 지운 파일이다.
      continue;
    }
    if (stat.isSymbolicLink()) throw symlinkError(rel);
    if (!stat.isFile()) continue;
    found.push({
      path: rel,
      content: textOf(rel, fs.readFileSync(full, 'utf8')),
      executable: (stat.mode & 0o111) !== 0
    });
  }
  return found;
}

/** 프로필 폴더에 지금 있는 파일. Git 프로필이면 `.gitignore`를 따른다. */
export function workingArtifactFiles(dir: string): ProfileFile[] {
  if (isGitRoot(dir)) return gitListedArtifactFiles(dir);
  const found: ProfileFile[] = [];
  for (const rel of PROFILE_ARTIFACT_PATHS) {
    try {
      fs.lstatSync(path.join(dir, rel));
    } catch {
      continue;
    }
    walk(dir, rel, found);
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 커밋 `rev`에 있는 파일. */
export function committedArtifactFiles(dir: string, rev: string): ProfileFile[] {
  const listed = git(['--literal-pathspecs', 'ls-tree', '-r', '-z', rev, '--', ...PROFILE_ARTIFACT_PATHS], {
    cwd: dir,
    allowFailure: true
  });
  if (listed.status !== 0) return [];
  const found: ProfileFile[] = [];
  for (const entry of listed.stdout.split('\0').filter(Boolean)) {
    const match = /^(\d{6}) (\w+) ([0-9a-f]+)\t(.*)$/s.exec(entry);
    if (!match) continue;
    const [, mode, type, object, rel] = match;
    if (IGNORED_NAMES.has(rel.split('/').pop() ?? '')) continue;
    if (mode === '120000') throw symlinkError(rel);
    if (type !== 'blob') continue;
    const blob = git(['cat-file', 'blob', object], { cwd: dir });
    found.push({ path: rel, content: textOf(rel, blob.stdout), executable: mode === '100755' });
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
