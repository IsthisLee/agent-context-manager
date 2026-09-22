import fs from 'node:fs';
import path from 'node:path';

/**
 * `docs/discussion` 아래의 논의 영역. 영역은 `topics/` 폴더를 가진 폴더다. 그래서 패키지 구현 계획과
 * 저장소 운영은 색인을 따로 두면서 같은 상태·요약 검사를 받는다. 오류 순서가 파일 시스템에 따라
 * 달라지지 않도록 영역을 정렬해서 돌려준다.
 */
export function discussionRoots(discussionDir: string): string[] {
  if (!fs.existsSync(discussionDir)) return [];
  return fs
    .readdirSync(discussionDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(discussionDir, entry.name, 'topics')))
    .map(entry => entry.name)
    .sort();
}
