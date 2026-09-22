import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 패키지 루트. 함께 배포한 템플릿을 읽는 데 쓴다. `src/shared`와 `dist/shared` 모두 두 단계 아래다. */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let version: string | null = null;

/** 설치된 패키지의 버전. package.json에서 한 번만 읽는다. */
export function packageVersion(): string {
  if (version === null)
    version = String(
      (JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version?: unknown }).version ??
        ''
    );
  return version;
}
