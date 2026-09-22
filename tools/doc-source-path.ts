import path from 'node:path';

/**
 * 문서 소스 해시에 넣는 저장소 기준 경로. 항상 `/`를 쓴다. `path.relative`는 플랫폼 구분자를 쓰므로,
 * 이것이 없으면 macOS나 Linux에서 기록한 해시가 Windows에서 절대 맞지 않는다.
 * @param pathApi - 테스트가 `path.win32`를 쓸 수 있도록 주입할 수 있다
 */
export function docSourceHashPath(root: string, filePath: string, pathApi: typeof path = path): string {
  return pathApi.relative(root, filePath).split(pathApi.sep).join('/');
}
