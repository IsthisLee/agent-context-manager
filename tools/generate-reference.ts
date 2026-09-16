import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ko from '../src/i18n/messages-ko.ts';
import { COMMANDS, usageLine, type CommandSpec } from '../src/commands/registry.ts';

/**
 * Keep the generated parts of docs/reference in step with the command registry,
 * so a usage line or an exit code in the reference never drifts from the CLI.
 * Everything outside the generated blocks is written by people.
 *
 *   node tools/generate-reference.ts          rewrite the generated blocks
 *   node tools/generate-reference.ts --check  exit 1 when a block is out of date
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messages = ko as Record<string, string>;

export const CLI_REFERENCE = 'docs/reference/cli.md';
export const EXIT_CODES = 'docs/reference/exit-codes.md';

const CHANGES: Record<CommandSpec['changes'], string> = {
  none: '없음',
  'profile-store': '프로필 보관함',
  repository: '저장소 파일',
  remote: 'Git 원격'
};

/** Where a command runs: always the CLI, plus the TUI and the profile management menu when the registry names an entry there. */
const interfaces = (command: CommandSpec) => ['CLI', ...(command.tui ? ['TUI'] : []), ...(command.profileMenu ? ['프로필 메뉴'] : [])].join(' · ');

export const documentedCommands = (): CommandSpec[] => COMMANDS.filter(command => command.id !== 'help');

const heading = (command: CommandSpec) => command.words.join(' ');
const anchor = (command: CommandSpec) => command.words.join('-');
const sortedCodes = (command: CommandSpec) => [...command.exitCodes].sort((a, b) => a - b);
const codes = (command: CommandSpec) => sortedCodes(command).map(code => `\`${code}\` ${messages[`exit.${code}`]}`).join(' · ');

export function markerPair(name: string): [start: string, end: string] {
  return [`<!-- agctx:generated:${name}:start -->`, `<!-- agctx:generated:${name}:end -->`];
}

function replaceBlock(content: string, name: string, body: string): string {
  const [start, end] = markerPair(name);
  const from = content.indexOf(start);
  const to = content.indexOf(end);
  if (from < 0 || to < from) throw new Error(`Add ${start} and ${end} before generating ${name}.`);
  return `${content.slice(0, from + start.length)}\n${body}\n${content.slice(to)}`;
}

export function commandTable(): string {
  return [
    '| 명령 | 하는 일 | 바꾸는 것 | 쓸 수 있는 곳 |',
    '| --- | --- | --- | --- |',
    ...documentedCommands().map(command => `| [\`${heading(command)}\`](#${anchor(command)}) | ${messages[`command.${command.id}.summary`]} | ${CHANGES[command.changes]} | ${interfaces(command)} |`)
  ].join('\n');
}

export function usageBlock(command: CommandSpec): string {
  return ['```bash', usageLine(command), '```', '', `종료 코드: ${codes(command)}`].join('\n');
}

export function renderCliReference(content: string): string {
  let next = replaceBlock(content, 'commands', commandTable());
  for (const command of documentedCommands()) next = replaceBlock(next, `usage:${command.id}`, usageBlock(command));
  return next;
}

export function exitCodeTable(): string {
  return [
    '| 명령 | 돌려줄 수 있는 종료 코드 |',
    '| --- | --- |',
    ...documentedCommands().map(command => `| \`agctx ${heading(command)}\` | ${sortedCodes(command).map(code => `\`${code}\``).join(' · ')} |`)
  ].join('\n');
}

export function renderExitCodes(content: string): string {
  return replaceBlock(content, 'exit-codes', exitCodeTable());
}

export const REFERENCES: ReadonlyArray<{ file: string; render: (content: string) => string }> = [
  { file: CLI_REFERENCE, render: renderCliReference },
  { file: EXIT_CODES, render: renderExitCodes }
];

function main(argv: readonly string[]): void {
  const check = argv.includes('--check');
  const stale: string[] = [];
  for (const reference of REFERENCES) {
    const file = path.join(repoRoot, reference.file);
    const current = fs.readFileSync(file, 'utf8');
    const next = reference.render(current);
    if (current === next) continue;
    if (check) stale.push(reference.file);
    else fs.writeFileSync(file, next);
  }
  if (stale.length) {
    process.stderr.write(`Generated reference blocks are out of date: ${stale.join(', ')}. Run node tools/generate-reference.ts.\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
