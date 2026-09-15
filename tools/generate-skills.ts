import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import en from '../src/i18n/messages-en.ts';
import { COMMANDS, usageLine } from '../src/commands/registry.ts';

/**
 * Keep the command lists in skills/ in step with the command registry, so a
 * skill never tells an agent about an option that does not exist.
 *
 *   node tools/generate-skills.ts          rewrite the lists
 *   node tools/generate-skills.ts --check  exit 1 when a list is out of date
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- agctx:commands:start -->';
const END = '<!-- agctx:commands:end -->';

export interface SkillSpec {
  file: string;
  /** Command ids to list, or null for every command. */
  commands: readonly string[] | null;
}

export const SKILLS: readonly SkillSpec[] = [
  { file: 'skills/agctx/SKILL.md', commands: null },
  { file: 'skills/agctx-author/SKILL.md', commands: ['profile.view', 'profile.setup', 'profile.status', 'profile.pull', 'profile.push', 'check', 'repos.status', 'repos.sync', 'repos.pr'] }
];

const summaries = en as Record<string, string>;

export function commandList(ids: readonly string[] | null): string {
  return COMMANDS
    .filter(command => command.id !== 'help' && (!ids || ids.includes(command.id)))
    .map(command => `- \`${usageLine(command)}\`: ${summaries[`command.${command.id}.summary`]}`)
    .join('\n');
}

export function renderSkill(content: string, ids: readonly string[] | null): string {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start < 0 || end < start) throw new Error(`A skill needs ${START} and ${END} around its command list.`);
  return `${content.slice(0, start + START.length)}\n${commandList(ids)}\n${content.slice(end)}`;
}

function main(argv: readonly string[]): void {
  const check = argv.includes('--check');
  const stale: string[] = [];
  for (const skill of SKILLS) {
    const file = path.join(repoRoot, skill.file);
    const current = fs.readFileSync(file, 'utf8');
    const next = renderSkill(current, skill.commands);
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
