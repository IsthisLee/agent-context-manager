import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../src/i18n/messages-en.ts';
import ko from '../src/i18n/messages-ko.ts';
import { COMMANDS } from '../src/commands/registry.ts';
import { MAIN_MENU_ENTRIES } from '../src/tui/main.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

/** CLI가 찾을 수 있는 메시지 키: 리터럴 `_()`·`t()` 키와 등록부에서 만드는 키. */
function usedKeys(): Set<string> {
  const used = new Set<string>();
  for (const file of sourceFiles(path.join(repoRoot, 'src'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\b_\('([a-z][\w.-]*)'/g)) used.add(match[1]);
    for (const match of text.matchAll(/\bt\([^,()]+,\s*'([a-z][\w.-]*)'/g)) used.add(match[1]);
  }
  for (const command of COMMANDS) {
    used.add(`command.${command.id}.summary`);
    for (const code of command.exitCodes) used.add(`exit.${code}`);
    if (command.tui) used.add(command.tui);
    if (command.tui && /^(project|repos)\.menu\./.test(command.tui)) used.add(command.tui.replace(/\.label$/, '.hint'));
    if (command.profileMenu) {
      used.add(command.profileMenu);
      if (command.profileMenu.startsWith('actions.')) used.add(command.profileMenu.replace(/\.label$/, '.hint'));
    }
  }
  for (const entry of MAIN_MENU_ENTRIES) {
    used.add(entry.label);
    if (entry.hint) used.add(entry.hint);
  }
  for (const kind of ['pointer', 'agents']) used.add(`resolve.edit.boundary.${kind}`);
  for (const mode of ['plan', 'will']) {
    for (const action of ['recreate', 'discard', 'move', 'edit']) used.add(`resolve.${mode}.${action}`);
  }
  return used;
}

test('CLI가 찾는 메시지 키는 모두 영어·한국어 카탈로그에 있다', () => {
  const used = [...usedKeys()];
  assert.deepEqual(
    used.filter(key => !(key in en)),
    [],
    'messages-en.ts에 없다'
  );
  assert.deepEqual(
    used.filter(key => !(key in ko)),
    [],
    'messages-ko.ts에 없다'
  );
});

test('영어와 한국어 카탈로그는 같은 키를 정의한다', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
});
