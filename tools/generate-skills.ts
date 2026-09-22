import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ko from '../src/i18n/messages-ko.ts';
import { COMMANDS, agentPolicy, usageLine, type AgentPolicy } from '../src/commands/registry.ts';

/**
 * skills/의 명령 목록을 명령 등록부와 맞춰서, 스킬이 없는 옵션을 에이전트에게 알려 주지 않게 한다.
 *
 * 어떤 명령이 어떤 스킬에 들어가는지는 여기서 손으로 관리하는 목록이 아니라 에이전트 정책에서 온다.
 * 그래서 새 명령을 더하는 것을 잊어도 에이전트 표면에서 빠지지 않는다(ADR 0029).
 *
 *   node tools/generate-skills.ts          목록을 다시 쓴다
 *   node tools/generate-skills.ts --check  목록이 최신이 아니면 1로 끝난다
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- agctx:commands:start -->';
const END = '<!-- agctx:commands:end -->';

export interface SkillSpec {
  file: string;
  /** 이 스킬이 나열하는 에이전트 정책. */
  policies: readonly AgentPolicy[];
}

export const SKILLS: readonly SkillSpec[] = [
  // 모델이 이 스킬을 스스로 불러올 수 있으므로, 에이전트가 요청받지 않고 시작해도 되는 것만 나열한다.
  { file: 'skills/agctx/SKILL.md', policies: ['auto'] },
  // 이름으로만 호출하므로(disable-model-invocation), 쓰는 명령과 게시 전에 상태를 확인하는 데 필요한
  // 읽기 명령을 더한다.
  { file: 'skills/agctx-author/SKILL.md', policies: ['auto', 'ask'] }
];

// 스킬은 이 저장소 문서의 언어인 한국어로 쓰므로 명령 요약은 한국어 카탈로그에서 가져온다(ADR 0030).
// CLI 자체의 기본 언어는 여전히 영어다(ADR 0014).
const summaries = ko as Record<string, string>;

export function commandList(policies: readonly AgentPolicy[]): string {
  return COMMANDS.filter(command => policies.includes(agentPolicy(command)))
    .map(command => `- \`${usageLine(command)}\`: ${summaries[`command.${command.id}.summary`]}`)
    .join('\n');
}

export function renderSkill(content: string, policies: readonly AgentPolicy[]): string {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start < 0 || end < start) throw new Error(`A skill needs ${START} and ${END} around its command list.`);
  return `${content.slice(0, start + START.length)}\n${commandList(policies)}\n${content.slice(end)}`;
}

function main(argv: readonly string[]): void {
  const check = argv.includes('--check');
  const stale: string[] = [];
  for (const skill of SKILLS) {
    const file = path.join(repoRoot, skill.file);
    const current = fs.readFileSync(file, 'utf8');
    const next = renderSkill(current, skill.policies);
    if (current === next) continue;
    if (check) stale.push(skill.file);
    else fs.writeFileSync(file, next);
  }
  if (stale.length) {
    process.stderr.write(
      `Skill command lists are out of date: ${stale.join(', ')}. Run node tools/generate-skills.ts.\n`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2));
