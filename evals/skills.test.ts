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
    assert.equal(content, renderSkill(content, skill.policies), `${skill.file} is out of date; run node tools/generate-skills.ts`);
  }
});
// Which command belongs in which skill is the agent surface contract, checked
// by evals/agent-surface.test.ts. This file only checks that each list is
// generated from the registry and that the two skills carry their invocation
// policy and their approval rules.

test('the diagnosing skill may start on its own, and the publishing skill only when called by name', () => {
  assert.match(read('skills/agctx/SKILL.md'), /^---\nname: agctx\ndescription: .+\n---\n/);
  assert.doesNotMatch(read('skills/agctx/SKILL.md'), /disable-model-invocation/);
  assert.match(read('skills/agctx-author/SKILL.md'), /^---\nname: agctx-author\ndescription: .+\ndisable-model-invocation: true\n---\n/, 'Claude Code does not start it on its own');
  assert.match(read('skills/agctx-author/agents/openai.yaml'), /^policy:\n {2}allow_implicit_invocation: false$/m, 'Codex does not start it on its own');
});

test('the publishing skill tells agents to show a dry run and wait for approval before --yes', () => {
  const author = read('skills/agctx-author/SKILL.md');
  assert.match(author, /--dry-run/);
  // The skills are written in Korean (ADR 0030); this one English sentence stays
  // so the rule reads the same to an agent working in either language.
  assert.match(author, /Never add `--yes`/);
  assert.match(author, /승인/);
});

test('the diagnosing skill offers nothing that writes', () => {
  const user = read('skills/agctx/SKILL.md');
  for (const command of COMMANDS.filter(entry => entry.changes !== 'none')) {
    const usage = `\`agctx ${command.words.join(' ')}`;
    assert.ok(!user.includes(usage), `${command.id} changes ${command.changes} and must not sit in a skill the model can start`);
  }
  assert.doesNotMatch(user.split('<!-- agctx:commands:start -->')[0], /--dry-run/, 'the prose never sends the agent to a writing command');
});
// `verify --probe --yes` stays: the probe only reads, and the flag is there so
// the run does not start without the user paying for agent CLI calls.
