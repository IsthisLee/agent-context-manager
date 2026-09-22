import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS, agentPolicy } from '../src/commands/registry.ts';

/**
 * 에이전트는 CLI와 TUI 옆의 세 번째 표면이고, 같은 계약이 필요하다. 에이전트가 닿을 수 없는
 * 경로에만 있는 명령이 있어서는 안 된다.
 *
 * 노출만으로는 부족하다. 에이전트는 스킬의 `description`만 보고 그 스킬을 불러올지 정하므로,
 * 명령 목록에만 있고 맞는 상황 설명이 없는 명령은 들어갈 길이 없다. `profile create`는 목록에
 * 있었지만 프로필을 만드는 상황을 말하는 설명이 없어서, 「컨텍스트 프로필을 만들어 줘」가 스킬에
 * 닿지 못했다(ADR 0029).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USER_SKILL = 'skills/agctx/SKILL.md';
const AUTHOR_SKILL = 'skills/agctx-author/SKILL.md';

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** 스킬에서 에이전트에게 언제 무엇을 실행할지 알려 주는 부분. */
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
