import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from '../src/commands/registry.ts';
import { renderSkill, SKILLS } from '../tools/generate-skills.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('스킬의 명령 목록은 명령 등록부와 맞다', () => {
  for (const skill of SKILLS) {
    const content = read(skill.file);
    assert.equal(
      content,
      renderSkill(content, skill.policies),
      `${skill.file}이 최신이 아니다. node tools/generate-skills.ts를 실행하라`
    );
  }
});
// 어떤 명령이 어떤 스킬에 들어가는지는 에이전트 표면 계약이고 evals/agent-surface.test.ts가
// 검사한다. 이 파일은 각 목록이 등록부에서 생성되는지와, 두 스킬이 호출 정책과 승인 규칙을
// 갖췄는지만 검사한다.

test('진단 스킬은 스스로 시작할 수 있고, 게시 스킬은 이름으로 부를 때만 시작한다', () => {
  assert.match(read('skills/agctx/SKILL.md'), /^---\nname: agctx\ndescription: .+\n---\n/);
  assert.doesNotMatch(read('skills/agctx/SKILL.md'), /disable-model-invocation/);
  assert.match(
    read('skills/agctx-author/SKILL.md'),
    /^---\nname: agctx-author\ndescription: .+\ndisable-model-invocation: true\n---\n/,
    'Claude Code는 이 스킬을 스스로 시작하지 않는다'
  );
  assert.match(
    read('skills/agctx-author/agents/openai.yaml'),
    /^policy:\n {2}allow_implicit_invocation: false$/m,
    'Codex는 이 스킬을 스스로 시작하지 않는다'
  );
});

test('게시 스킬은 에이전트에게 --yes 전에 dry run을 보여 주고 승인을 기다리라고 한다', () => {
  const author = read('skills/agctx-author/SKILL.md');
  assert.match(author, /--dry-run/);
  // 스킬은 한국어로 쓴다(ADR 0030). 이 영어 문장 하나는 남겨서, 어느 언어로 일하는 에이전트에게도
  // 규칙이 같게 읽히게 한다.
  assert.match(author, /Never add `--yes`/);
  assert.match(author, /승인/);
});

test('진단 스킬은 무언가를 쓰는 명령을 제공하지 않는다', () => {
  const user = read('skills/agctx/SKILL.md');
  for (const command of COMMANDS.filter(entry => entry.changes !== 'none')) {
    const usage = `\`agctx ${command.words.join(' ')}`;
    assert.ok(
      !user.includes(usage),
      `${command.id}는 ${command.changes}를 바꾸므로 모델이 시작할 수 있는 스킬에 있으면 안 된다`
    );
  }
  assert.doesNotMatch(
    user.split('<!-- agctx:commands:start -->')[0],
    /--dry-run/,
    '본문은 에이전트를 쓰기 명령으로 보내지 않는다'
  );
});
// `verify --probe --yes`는 남는다. probe는 읽기만 하고, 이 플래그는 사용자가 에이전트 CLI 호출
// 비용을 치르기로 하지 않으면 실행이 시작되지 않게 하려고 있다.
