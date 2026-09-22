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
    assert.equal(
      content,
      renderSkill(content, skill.policies),
      `${skill.file} is out of date; run node tools/generate-skills.ts`
    );
  }
});
// 어떤 명령이 어떤 스킬에 들어가는지는 에이전트 표면 계약이고 evals/agent-surface.test.ts가
// 검사한다. 이 파일은 각 목록이 등록부에서 생성되는지와, 두 스킬이 호출 정책과 승인 규칙을
// 갖췄는지만 검사한다.

test('the diagnosing skill may start on its own, and the publishing skill only when called by name', () => {
  assert.match(read('skills/agctx/SKILL.md'), /^---\nname: agctx\ndescription: .+\n---\n/);
  assert.doesNotMatch(read('skills/agctx/SKILL.md'), /disable-model-invocation/);
  assert.match(
    read('skills/agctx-author/SKILL.md'),
    /^---\nname: agctx-author\ndescription: .+\ndisable-model-invocation: true\n---\n/,
    'Claude Code does not start it on its own'
  );
  assert.match(
    read('skills/agctx-author/agents/openai.yaml'),
    /^policy:\n {2}allow_implicit_invocation: false$/m,
    'Codex does not start it on its own'
  );
});

test('the publishing skill tells agents to show a dry run and wait for approval before --yes', () => {
  const author = read('skills/agctx-author/SKILL.md');
  assert.match(author, /--dry-run/);
  // 스킬은 한국어로 쓴다(ADR 0030). 이 영어 문장 하나는 남겨서, 어느 언어로 일하는 에이전트에게도
  // 규칙이 같게 읽히게 한다.
  assert.match(author, /Never add `--yes`/);
  assert.match(author, /승인/);
});

test('the diagnosing skill offers nothing that writes', () => {
  const user = read('skills/agctx/SKILL.md');
  for (const command of COMMANDS.filter(entry => entry.changes !== 'none')) {
    const usage = `\`agctx ${command.words.join(' ')}`;
    assert.ok(
      !user.includes(usage),
      `${command.id} changes ${command.changes} and must not sit in a skill the model can start`
    );
  }
  assert.doesNotMatch(
    user.split('<!-- agctx:commands:start -->')[0],
    /--dry-run/,
    'the prose never sends the agent to a writing command'
  );
});
// `verify --probe --yes`는 남는다. probe는 읽기만 하고, 이 플래그는 사용자가 에이전트 CLI 호출
// 비용을 치르기로 하지 않으면 실행이 시작되지 않게 하려고 있다.
