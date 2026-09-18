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
 * The deployed guidance has a size budget: every user who runs `profile setup`
 * receives it, and a long instruction file makes agents follow fewer of its
 * rules. Claude Code targets under 200 lines per instruction file and Codex
 * stops reading at 32 KiB of combined instructions, so the block stays under a
 * third of the Codex cap and leaves the rest of the file to the user and the
 * project. Minimal is not the same as short: the budget caps the block, it does
 * not ask for fewer words than a rule needs.
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
  assert.ok(block, 'the profile carries a guidance block');
  return block[1].trim();
}

for (const locale of SUPPORTED_LOCALES) {
  test(`the fully on guidance block stays inside its size budget in ${locale}`, () => {
    const block = guidanceBlock(allOnProfile(locale));
    const lines = block.split('\n').length;
    const bytes = Buffer.byteLength(block);
    assert.ok(lines <= LINE_BUDGET, `guidance block is ${lines} lines, over the ${LINE_BUDGET} line budget`);
    assert.ok(bytes <= BYTE_BUDGET, `guidance block is ${bytes} bytes, over the ${BYTE_BUDGET} byte budget`);
  });

  test(`every guidance item reaches the profile in ${locale}`, () => {
    const block = guidanceBlock(allOnProfile(locale));
    const sections = guidanceSections(locale);
    for (const key of GUIDANCE_KEYS) {
      const [title, body] = sections[key];
      assert.ok(block.includes(`## ${title}`), `${locale} guidance block has the ${key} section`);
      assert.ok(block.includes(body), `${locale} guidance block carries the ${key} body`);
    }
  });
}
