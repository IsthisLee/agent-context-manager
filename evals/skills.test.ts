import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../src/commands/registry.ts';
import { renderSkill, SKILLS } from '../tools/generate-skills.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('skill command lists match the command registry', () => {
  for (const skill of SKILLS) {
    const content = read(skill.file);
    assert.equal(content, renderSkill(content, skill.commands), `${skill.file} is out of date; run node tools/generate-skills.ts`);
  }
  const listed = read('skills/agctx/SKILL.md');
  for (const command of COMMANDS.filter(entry => entry.id !== 'help')) {
    assert.ok(listed.includes(`agctx ${command.words.join(' ')}`), `skills/agctx lists agctx ${command.words.join(' ')}`);
  }
});

test('the diagnosing skill may start on its own, and the publishing skill only when called by name', () => {
  assert.match(read('skills/agctx/SKILL.md'), /^---\nname: agctx\ndescription: .+\n---\n/);
  assert.doesNotMatch(read('skills/agctx/SKILL.md'), /disable-model-invocation/);
  assert.match(read('skills/agctx-author/SKILL.md'), /^---\nname: agctx-author\ndescription: .+\ndisable-model-invocation: true\n---\n/, 'Claude Code does not start it on its own');
  assert.match(read('skills/agctx-author/agents/openai.yaml'), /^policy:\n {2}allow_implicit_invocation: false$/m, 'Codex does not start it on its own');
});

test('skills tell agents to show a dry run and wait for approval before --yes', () => {
  for (const file of ['skills/agctx/SKILL.md', 'skills/agctx-author/SKILL.md']) {
    const content = read(file);
    assert.match(content, /--dry-run/, file);
    assert.match(content, /Never add `--yes`/, file);
    assert.match(content, /approv/, file);
  }
});
