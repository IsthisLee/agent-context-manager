import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeTextTarget, writeTextAtomic } from '../src/shared/fs-utils.ts';

test('writeTextAtomic은 임시 파일을 남기지 않고 파일을 바꾼다', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-safety-test-'));
  const target = path.join(directory, 'guidance.md');

  try {
    fs.writeFileSync(target, 'before\n');
    writeTextAtomic(target, 'after\n');
    assert.equal(fs.readFileSync(target, 'utf8'), 'after\n');
    assert.deepEqual(fs.readdirSync(directory), ['guidance.md']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('writeTextAtomic은 없는 파일을 새로 만든다', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-create-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'nested', 'guidance.md');

  writeTextAtomic(target, 'new\n');
  assert.equal(fs.readFileSync(target, 'utf8'), 'new\n');
});

test('writeTextAtomic은 CRLF 줄 끝인 파일을 다시 쓸 때 CRLF를 유지한다', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-crlf-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'guidance.md');

  fs.writeFileSync(target, 'before\r\n');
  writeTextAtomic(target, 'one\ntwo\n');
  assert.equal(fs.readFileSync(target, 'utf8'), 'one\r\ntwo\r\n');
});

test(
  'writeTextAtomic은 기존 파일의 모드를 유지한다',
  { skip: process.platform === 'win32' ? 'Windows는 POSIX 파일 모드를 저장하지 않는다' : false },
  t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-mode-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'run.sh');

    fs.writeFileSync(target, 'before\n');
    // 0o700은 umask가 022든 077이든 그대로 남아서, 기본 모드(0o644나 0o600)와 구별된다.
    fs.chmodSync(target, 0o700);
    writeTextAtomic(target, 'after\n');
    assert.equal(fs.statSync(target).mode & 0o777, 0o700);
  }
);

test('writeTextAtomic은 심볼릭 링크 대상을 바꾸지 않는다', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-file-symlink-test-'));
  const target = path.join(directory, 'guidance.md');
  const actual = path.join(directory, 'actual.md');

  try {
    fs.writeFileSync(actual, 'protected\n');
    try {
      fs.symlinkSync(actual, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES')
        return;
      throw error;
    }
    assert.throws(() => writeTextAtomic(target, 'replace\n'), /symbolic link/);
    assert.equal(fs.readFileSync(actual, 'utf8'), 'protected\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('assertSafeTextTarget은 쓰기 계획이 시작되기 전에 심볼릭 링크를 찾아낸다', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-preflight-safety-test-'));
  const target = path.join(directory, 'guidance.md');
  const actual = path.join(directory, 'actual.md');

  try {
    fs.writeFileSync(actual, 'protected\n');
    try {
      fs.symlinkSync(actual, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM' || (error as NodeJS.ErrnoException).code === 'EACCES')
        return;
      throw error;
    }
    assert.throws(() => assertSafeTextTarget(target), /symbolic link/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test(
  '부모 경로가 파일이면 assertSafeTextTarget은 파일 시스템 오류를 cause로 남긴다',
  { skip: process.platform === 'win32' ? 'ENOTDIR for a path under a file is POSIX behavior' : false },
  () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-parent-file-test-'));
    const target = path.join(directory, 'profile.json', 'AGENTS.md');

    try {
      fs.writeFileSync(path.join(directory, 'profile.json'), '{}\n');
      assert.throws(
        () => assertSafeTextTarget(target),
        (error: Error) =>
          /Parent path is not a directory/.test(error.message) &&
          (error.cause as NodeJS.ErrnoException | undefined)?.code === 'ENOTDIR'
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
);

test('assertSafeTextTarget은 폴더 대상을 거부한다', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-directory-target-test-'));
  const target = path.join(directory, 'guidance.md');

  try {
    fs.mkdirSync(target);
    assert.throws(() => assertSafeTextTarget(target), /non-regular file/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
