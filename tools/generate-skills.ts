import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import en from '../src/i18n/messages-en.ts';
import { COMMANDS, agentPolicy, usageLine, type AgentPolicy } from '../src/commands/registry.ts';

/**
 * Keep the command lists in skills/ in step with the command registry, so a
 * skill never tells an agent about an option that does not exist.
 *
 * Which command goes in which skill comes from its agent policy, not from a
 * list kept here by hand: a new command then cannot be left out of the agent
 * surface by forgetting to add it (ADR 0029).
 *
 *   node tools/generate-skills.ts          rewrite the lists
 *   node tools/generate-skills.ts --check  exit 1 when a list is out of date
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- agctx:commands:start -->';
const END = '<!-- agctx:commands:end -->';

export interface SkillSpec {
  file: string;
  /** Agent policies this skill lists. */
  policies: readonly AgentPolicy[];
}

export const SKILLS: readonly SkillSpec[] = [
  // The model may load this skill on its own, so it lists only what the agent
  // may start without being asked.
  { file: 'skills/agctx/SKILL.md', policies: ['auto'] },
  // Invoked by name only (disable-model-invocation), so it adds the commands
  // that write, plus the reads it needs to check state before publishing.
  { file: 'skills/agctx-author/SKILL.md', policies: ['auto', 'ask'] }
];

const summaries = en as Record<string, string>;

export function commandList(policies: readonly AgentPolicy[]): string {
  return COMMANDS
    .filter(command => policies.includes(agentPolicy(command)))
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
    process.stderr.write(`Skill command lists are out of date: ${stale.join(', ')}. Run node tools/generate-skills.ts.\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
