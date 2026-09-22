import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLI_REFERENCE,
  commandTable,
  documentedCommands,
  markerPair,
  REFERENCES
} from '../tools/generate-reference.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('CLI 레퍼런스와 종료 코드 레퍼런스의 생성 블록은 명령 등록부와 맞다', () => {
  for (const reference of REFERENCES) {
    const content = read(reference.file);
    assert.equal(
      content,
      reference.render(content),
      `${reference.file}이 최신이 아니다. node tools/generate-reference.ts를 실행하라`
    );
  }
});

test('CLI 레퍼런스에서 모든 명령은 자기 제목 아래에 생성된 사용법 블록이 있다', () => {
  const content = read(CLI_REFERENCE);
  for (const command of documentedCommands()) {
    const heading = content.indexOf(`### \`${command.words.join(' ')}\``);
    const [start] = markerPair(`usage:${command.id}`);
    const block = content.indexOf(start);
    assert.ok(heading >= 0, `${command.id}의 절이 있다`);
    assert.ok(block > heading, `${command.id}의 사용법 블록이 제목 뒤에 온다`);
    const next = content.indexOf('\n### ', heading + 1);
    assert.ok(next < 0 || block < next, `${command.id}의 사용법 블록이 자기 절 안에 있다`);
  }
});

test('명령 표는 명령에 닿을 수 있는 인터페이스를 모두 나열한다', () => {
  const rows = new Map(
    commandTable()
      .split('\n')
      .slice(2)
      .map(row => [row.match(/\[`([^`]+)`\]/)?.[1], row.split(' | ').at(-1)?.replace(/ \|$/, '')])
  );
  for (const command of documentedCommands()) {
    const expected = ['CLI', ...(command.tui ? ['TUI'] : []), ...(command.profileMenu ? ['프로필 메뉴'] : [])].join(
      ' · '
    );
    assert.equal(rows.get(command.words.join(' ')), expected, `${command.id}의 인터페이스`);
  }
});
