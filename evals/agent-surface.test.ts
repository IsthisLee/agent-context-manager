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
  assert.ok(start >= 0, `${skill}에는 「Pick the command」 절이 있어야 한다`);
  const end = body.indexOf('\n## ', start + 1);
  return body.slice(start, end < 0 ? undefined : end);
}

function commandList(skill: string): string {
  const body = read(skill);
  const start = body.indexOf('<!-- agctx:commands:start -->');
  const end = body.indexOf('<!-- agctx:commands:end -->');
  assert.ok(start >= 0 && end > start, `${skill}에는 생성된 명령 목록이 있어야 한다`);
  return body.slice(start, end);
}

test('모든 명령은 에이전트 정책을 밝힌다', () => {
  for (const command of COMMANDS) {
    const policy = agentPolicy(command);
    assert.ok(['auto', 'ask', 'never'].includes(policy), `${command.id}에 에이전트 정책이 없다`);
  }
});

test('무엇이든 바꾸는 명령은 에이전트가 스스로 시작하도록 두지 않는다', () => {
  for (const command of COMMANDS) {
    if (command.changes === 'none') continue;
    assert.notEqual(
      agentPolicy(command),
      'auto',
      `${command.id}는 ${command.changes}를 바꾸므로 에이전트가 요청 없이 시작하면 안 된다`
    );
  }
});

test('각 명령은 정책이 가리키는 스킬에만 나온다', () => {
  const user = commandList(USER_SKILL);
  const author = commandList(AUTHOR_SKILL);
  for (const command of COMMANDS) {
    const usage = `\`agctx ${command.words.join(' ')}`;
    const inUser = user.includes(usage);
    const inAuthor = author.includes(usage);
    switch (agentPolicy(command)) {
      case 'auto':
        assert.ok(inUser, `${command.id}는 auto이므로 ${USER_SKILL}에 있어야 한다`);
        break;
      case 'ask':
        assert.ok(inAuthor, `${command.id}는 ask이므로 ${AUTHOR_SKILL}에 있어야 한다`);
        break;
      case 'never':
        assert.ok(!inUser && !inAuthor, `${command.id}는 never이므로 어느 스킬도 제공하면 안 된다`);
        break;
    }
  }
});

test('에이전트가 시작해도 되는 명령마다 그 명령으로 이어지는 상황 설명이 있다', () => {
  const missing: string[] = [];
  for (const command of COMMANDS) {
    if (agentPolicy(command) !== 'auto') continue;
    const words = command.words.join(' ');
    if (!scenarios(USER_SKILL).includes(`agctx ${words}`)) missing.push(command.id);
  }
  assert.deepEqual(missing, [], `이 명령들은 ${USER_SKILL}에 상황 설명이 없어서 에이전트가 닿을 이유가 없다`);
});

test('사용자가 요청할 수 있는 명령마다 author 스킬에 상황 설명이 있다', () => {
  const missing: string[] = [];
  for (const command of COMMANDS) {
    if (agentPolicy(command) !== 'ask') continue;
    const words = command.words.join(' ');
    if (!scenarios(AUTHOR_SKILL).includes(`agctx ${words}`)) missing.push(command.id);
  }
  assert.deepEqual(missing, [], `이 명령들은 ${AUTHOR_SKILL}에 상황 설명이 없어서 에이전트가 닿을 이유가 없다`);
});
