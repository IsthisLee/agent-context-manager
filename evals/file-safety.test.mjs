import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeTextTarget, writeTextAtomic } from '../bin/fs-utils.mjs';

test('writeTextAtomic replaces a file without leaving a temporary artifact', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-file-safety-test-'));
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

test('writeTextAtomic refuses to replace a symbolic-link target', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-file-symlink-test-'));
  const target = path.join(directory, 'guidance.md');
  const actual = path.join(directory, 'actual.md');

  try {
    fs.writeFileSync(actual, 'protected\n');
    try {
      fs.symlinkSync(actual, target);
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') return;
      throw error;
    }
    assert.throws(() => writeTextAtomic(target, 'replace\n'), /symbolic link/);
    assert.equal(fs.readFileSync(actual, 'utf8'), 'protected\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('assertSafeTextTarget detects a symbolic link before a write plan starts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-preflight-safety-test-'));
  const target = path.join(directory, 'guidance.md');
  const actual = path.join(directory, 'actual.md');

  try {
    fs.writeFileSync(actual, 'protected\n');
    try {
      fs.symlinkSync(actual, target);
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') return;
      throw error;
    }
    assert.throws(() => assertSafeTextTarget(target), /symbolic link/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('assertSafeTextTarget rejects a directory target', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-directory-target-test-'));
  const target = path.join(directory, 'guidance.md');

  try {
    fs.mkdirSync(target);
    assert.throws(() => assertSafeTextTarget(target), /non-regular file/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
