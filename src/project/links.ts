import fs from 'node:fs';
import path from 'node:path';
import { isSymbolicLink } from '../shared/fs-utils.ts';
import { git } from '../shared/git.ts';
import { filesBelow, SKIPPED_FOLDERS } from '../shared/scan.ts';

/**
 * Claude Code는 AGENTS.md가 아니라 CLAUDE.md를 읽는다. 자기 AGENTS.md가 있는 모노레포 패키지에는
 * 그 파일을 import하는 CLAUDE.md가 옆에 있어야 한다. 사람이 이미 CLAUDE.md를 두지 않았으면 agctx가
 * 그 연결을 만들고 관리한다.
 */

export const LINK_TEMPLATE = 'templates/CLAUDE.link.md';

const toPosix = (rel: string) => rel.split(path.sep).join('/');

/**
 * `dir`을 루트로 하는 Git 작업 트리에서 추적 중이거나, 추적하지 않지만 무시되지 않은 파일. Git 밖이거나
 * git이 없으면 null.
 */
function gitListed(dir: string): string[] | null {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  try {
    const result = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*AGENTS.md'], {
      cwd: dir,
      allowFailure: true
    });
    return result.status === 0
      ? result.stdout.split('\0').filter(rel => rel && fs.existsSync(path.join(dir, rel)))
      : null;
  } catch {
    return null;
  }
}

/** 프로젝트 루트 아래 AGENTS.md 파일의 프로젝트 기준 `/` 경로. 의존성·빌드 폴더는 뺀다. */
export function nestedAgentsFiles(targetDir: string): string[] {
  const listed =
    gitListed(targetDir) ?? filesBelow(targetDir, ['AGENTS.md']).map(file => toPosix(path.relative(targetDir, file)));
  return listed
    .filter(
      rel =>
        rel.endsWith('/AGENTS.md') &&
        !rel
          .split('/')
          .slice(0, -1)
          .some(part => SKIPPED_FOLDERS.has(part))
    )
    .sort();
}

/** 사람이 이미 `folder`에 둔 CLAUDE.md. 없으면 null. */
export function personLink(targetDir: string, folder: string): string | null {
  for (const rel of [`${folder}/CLAUDE.md`, `${folder}/.claude/CLAUDE.md`]) {
    try {
      fs.lstatSync(path.join(targetDir, rel));
      return rel;
    } catch {
      // 그 자리에 없다
    }
  }
  return null;
}

/** CLAUDE.md가 `agentsFile`에 닿는지: 그 파일을 가리키는 심볼릭 링크이거나, 코드 밖의 `@` import. */
export function linksTo(claudeFile: string, agentsFile: string): boolean {
  // 먼저 파일을 열어 읽을 대상을 고정하고, 그다음 경로가 링크인지 본다. 경로로 확인한 뒤 경로로 다시 읽으면
  // 그 사이에 다른 파일로 바뀔 수 있다.
  let fd: number;
  try {
    fd = fs.openSync(claudeFile, 'r');
  } catch (error) {
    // 대상이 없는 링크는 열 수 없지만 여전히 링크다.
    if (isSymbolicLink(claudeFile)) return true;
    throw error;
  }
  try {
    if (isSymbolicLink(claudeFile)) return true;
    const text = fs
      .readFileSync(fd, 'utf8')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]*`/g, '');
    return [...text.matchAll(/(?:^|\s)@([^\s@`)\]]+)/gm)].some(
      match => path.resolve(path.dirname(claudeFile), match[1]) === agentsFile
    );
  } finally {
    fs.closeSync(fd);
  }
}
