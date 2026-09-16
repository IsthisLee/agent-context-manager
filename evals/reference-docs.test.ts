import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLI_REFERENCE, commandTable, documentedCommands, markerPair, REFERENCES } from '../tools/generate-reference.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('generated blocks in the CLI reference and exit code reference match the command registry', () => {
  for (const reference of REFERENCES) {
    const content = read(reference.file);
    assert.equal(content, reference.render(content), `${reference.file} is out of date; run node tools/generate-reference.ts`);
  }
});

test('every command has a generated usage block under its own heading in the CLI reference', () => {
  const content = read(CLI_REFERENCE);
  for (const command of documentedCommands()) {
    const heading = content.indexOf(`### \`${command.words.join(' ')}\``);
    const [start] = markerPair(`usage:${command.id}`);
    const block = content.indexOf(start);
    assert.ok(heading >= 0, `${command.id} has a section`);
    assert.ok(block > heading, `${command.id} usage block follows its heading`);
    const next = content.indexOf('\n### ', heading + 1);
    assert.ok(next < 0 || block < next, `${command.id} usage block stays inside its section`);
  }
});

test('the command table lists every interface a command is reachable from', () => {
  const rows = new Map(commandTable().split('\n').slice(2).map(row => [row.match(/\[`([^`]+)`\]/)?.[1], row.split(' | ').at(-1)?.replace(/ \|$/, '')]));
  for (const command of documentedCommands()) {
    const expected = ['CLI', ...(command.tui ? ['TUI'] : []), ...(command.profileMenu ? ['프로필 메뉴'] : [])].join(' · ');
    assert.equal(rows.get(command.words.join(' ')), expected, `${command.id} interfaces`);
  }
});
