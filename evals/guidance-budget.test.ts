import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GUIDANCE_KEYS } from '../src/profile/setup.ts';
import { guidanceSections, SUPPORTED_LOCALES } from '../src/i18n/index.ts';

/**
 * 배포하는 지침에는 분량 예산이 있다. `profile setup`을 실행하는 모든 사용자가 받고, 지침 파일이
 * 길면 에이전트가 그 규칙을 덜 따른다. Claude Code는 지침 파일당 200줄 미만을 권하고 Codex는
 * 지침을 합쳐 32 KiB에서 읽기를 멈추므로, 블록은 Codex 한도의 3분의 1 아래에 두고 나머지는
 * 사용자와 프로젝트에 남긴다. 최소는 짧다는 뜻이 아니다. 예산은 블록의 크기를 제한할 뿐, 규칙에
 * 필요한 말보다 적게 쓰라는 것이 아니다.
 */
const LINE_BUDGET = 120;
const BYTE_BUDGET = 10 * 1024;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

function allOnProfile(locale: string) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-budget-'));
  const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: locale };
  const allOn = GUIDANCE_KEYS.flatMap(key => [`--${key}`, 'on']);
  execFileSync(process.execPath, [cli, 'profile', 'create', 'budget', '--scope', 'team'], { cwd: repoRoot, env });
  execFileSync(process.execPath, [cli, 'profile', 'setup', 'budget', ...allOn], { cwd: repoRoot, env });
  const instructions = fs.readFileSync(path.join(home, 'profiles', 'budget', 'AGENTS.md'), 'utf8');
  fs.rmSync(home, { recursive: true, force: true });
  return instructions;
}

function guidanceBlock(instructions: string) {
  const block = instructions.match(/<!-- agctx:guidance:start -->([\s\S]*?)<!-- agctx:guidance:end -->/);
  assert.ok(block, '프로필에 지침 블록이 있다');
  return block[1].trim();
}

for (const locale of SUPPORTED_LOCALES) {
  test(`모두 켠 지침 블록은 ${locale}에서 분량 예산 안에 든다`, () => {
    const block = guidanceBlock(allOnProfile(locale));
    const lines = block.split('\n').length;
    const bytes = Buffer.byteLength(block);
    assert.ok(lines <= LINE_BUDGET, `지침 블록이 ${lines}줄로 예산 ${LINE_BUDGET}줄을 넘는다`);
    assert.ok(bytes <= BYTE_BUDGET, `지침 블록이 ${bytes}바이트로 예산 ${BYTE_BUDGET}바이트를 넘는다`);
  });

  test(`모든 지침 항목이 ${locale}에서 프로필에 닿는다`, () => {
    const block = guidanceBlock(allOnProfile(locale));
    const sections = guidanceSections(locale);
    for (const key of GUIDANCE_KEYS) {
      const [title, body] = sections[key];
      assert.ok(block.includes(`## ${title}`), `${locale} 지침 블록에 ${key} 절이 있다`);
      assert.ok(block.includes(body), `${locale} 지침 블록에 ${key} 본문이 있다`);
    }
  });
}
