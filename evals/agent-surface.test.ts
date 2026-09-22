import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS, agentPolicy } from '../src/commands/registry.ts';

/**
 * The agent is a third surface next to the CLI and the TUI, and it needs the
 * same contract: a command must not exist in a path the agent cannot reach.
 *
 * Exposure is not enough. An agent decides whether to load a skill from its
 * `description` alone, so a command that sits in the command list without a
 * matching scenario has no way in. `profile create` was in the list and no
 * scenario mentioned creating a profile, so "make me a context profile" never
 * reached the skill (ADR 0029).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USER_SKILL = 'skills/agctx/SKILL.md';
const AUTHOR_SKILL = 'skills/agctx-author/SKILL.md';

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** The part of a skill that tells the agent when to run what. */
function scenarios(skill: string): string {
  const body = read(skill);
  const start = body.indexOf('## Pick the command');
  assert.ok(start >= 0, `${skill} needs a "Pick the command" section`);
  const end = body.indexOf('\n## ', start + 1);
  return body.slice(start, end < 0 ? undefined : end);
}

function commandList(skill: string): string {
  const body = read(skill);
  const start = body.indexOf('<!-- agctx:commands:start -->');
  const end = body.indexOf('<!-- agctx:commands:end -->');
  assert.ok(start >= 0 && end > start, `${skill} needs a generated command list`);
  return body.slice(start, end);
}

test('every command declares an agent policy', () => {
  for (const command of COMMANDS) {
    const policy = agentPolicy(command);
    assert.ok(['auto', 'ask', 'never'].includes(policy), `${command.id} has no agent policy`);
  }
});

test('a command that changes anything is never left for the agent to start on its own', () => {
  for (const command of COMMANDS) {
    if (command.changes === 'none') continue;
    assert.notEqual(
      agentPolicy(command),
      'auto',
      `${command.id} changes ${command.changes}, so the agent must not start it unasked`
    );
  }
});

test('each command appears in the skill its policy names, and in no other', () => {
  const user = commandList(USER_SKILL);
  const author = commandList(AUTHOR_SKILL);
  for (const command of COMMANDS) {
    const usage = `\`agctx ${command.words.join(' ')}`;
    const inUser = user.includes(usage);
    const inAuthor = author.includes(usage);
    switch (agentPolicy(command)) {
      case 'auto':
        assert.ok(inUser, `${command.id} is auto, so it belongs in ${USER_SKILL}`);
        break;
      case 'ask':
        assert.ok(inAuthor, `${command.id} is ask, so it belongs in ${AUTHOR_SKILL}`);
        break;
      case 'never':
        assert.ok(!inUser && !inAuthor, `${command.id} is never, so no skill may offer it`);
        break;
    }
  }
});

test('every command an agent may start has a scenario that leads to it', () => {
  const missing: string[] = [];
  for (const command of COMMANDS) {
    if (agentPolicy(command) !== 'auto') continue;
    const words = command.words.join(' ');
    if (!scenarios(USER_SKILL).includes(`agctx ${words}`)) missing.push(command.id);
  }
  assert.deepEqual(
    missing,
    [],
    `these commands have no scenario in ${USER_SKILL}, so an agent has no reason to reach them`
  );
});

test('every command the user may ask for has a scenario in the author skill', () => {
  const missing: string[] = [];
  for (const command of COMMANDS) {
    if (agentPolicy(command) !== 'ask') continue;
    const words = command.words.join(' ');
    if (!scenarios(AUTHOR_SKILL).includes(`agctx ${words}`)) missing.push(command.id);
  }
  assert.deepEqual(
    missing,
    [],
    `these commands have no scenario in ${AUTHOR_SKILL}, so an agent has no reason to reach them`
  );
});
