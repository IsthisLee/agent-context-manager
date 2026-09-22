import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { baseFilePath, parseBase } from './conflicts.ts';
import { toLf } from '../shared/fs-utils.ts';
import type { ProjectConfig } from '../shared/types.ts';

/** 관리 영역의 해시와 마지막으로 쓴 원문(base)을 다루는 도우미. 형식마다 계획하는 모듈이 함께 쓴다. */

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function readIfExists(target: string): string | null {
  return fs.existsSync(target) ? toLf(fs.readFileSync(target, 'utf8')) : null;
}

export function recordedHashFor(projectConfig: ProjectConfig, relativePath: string): string | null {
  return projectConfig.managedHashes?.[relativePath] ?? null;
}

/**
 * 알 수 있을 때, agctx가 마지막으로 쓴 관리 영역: 기록된 해시와 맞는 base 파일, 또는 다시 만들어도
 * 해시가 같은 영역.
 */
export function knownBase(
  targetDir: string,
  relativePath: string,
  recordedHash: string,
  nextRegion: string | null
): string | null {
  const stored = readIfExists(path.join(targetDir, baseFilePath(relativePath)));
  if (stored !== null && sha256(parseBase(stored)) === recordedHash) return parseBase(stored);
  if (nextRegion !== null && sha256(nextRegion) === recordedHash) return nextRegion;
  return null;
}
