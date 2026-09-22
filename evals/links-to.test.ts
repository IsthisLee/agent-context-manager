import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { linksTo } from '../src/project/links.ts';

/** AGENTS.md가 든 임시 폴더. 끝나면 지운다. */
function folder(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-links-to-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const agents = path.join(dir, 'AGENTS.md');
  fs.writeFileSync(agents, '# 규칙\n');
  return { dir, agents, claude: path.join(dir, 'CLAUDE.md') };
}

/** 심볼릭 링크를 만든다. 권한이 없어 만들 수 없으면 그 평가를 건너뛴다. */
function symlinkOrSkip(t: TestContext, target: string, file: string): boolean {
  try {
    fs.symlinkSync(target, file);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EPERM' && code !== 'EACCES') throw error;
    t.skip('이 환경에서는 심볼릭 링크를 만들 수 없다');
    return false;
  }
}

test('linksTo는 코드 밖에서 AGENTS.md를 import하는 CLAUDE.md를 연결로 본다', t => {
  const { agents, claude } = folder(t);
  fs.writeFileSync(claude, '# Claude\n\n@AGENTS.md\n');
  assert.equal(linksTo(claude, agents), true);
});

test('linksTo는 AGENTS.md를 import하지 않는 CLAUDE.md를 연결로 보지 않는다', t => {
  const { agents, claude } = folder(t);
  fs.writeFileSync(claude, '# Claude\n\n@OTHER.md\n');
  assert.equal(linksTo(claude, agents), false);
});

test('linksTo는 코드 블록과 코드 스팬 안의 import를 연결로 보지 않는다', t => {
  const { agents, claude } = folder(t);
  fs.writeFileSync(claude, '# Claude\n\n```\n@AGENTS.md\n```\n\n`@AGENTS.md`\n');
  assert.equal(linksTo(claude, agents), false);
});

test('linksTo는 AGENTS.md를 가리키는 심볼릭 링크를 연결로 본다', t => {
  const { agents, claude } = folder(t);
  if (!symlinkOrSkip(t, agents, claude)) return;
  assert.equal(linksTo(claude, agents), true);
});

test('linksTo는 대상이 없는 심볼릭 링크도 링크로 본다', t => {
  const { dir, agents, claude } = folder(t);
  if (!symlinkOrSkip(t, path.join(dir, 'missing.md'), claude)) return;
  assert.equal(linksTo(claude, agents), true);
});

test('linksTo는 없는 CLAUDE.md에서 오류를 낸다', t => {
  const { agents, claude } = folder(t);
  assert.throws(() => linksTo(claude, agents), { code: 'ENOENT' });
});
