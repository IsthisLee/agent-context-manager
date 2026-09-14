import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../bin/i18n.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'bin', 'agentic.mjs');

function hasHangul(text) {
  return /[가-힣]/.test(text);
}

function run(home, args, env = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    env: { ...process.env, AGENTIC_HOME: home, ...env },
    encoding: 'utf8'
  });
}

function buildProject(home, env = {}) {
  run(home, ['profile', 'create', 'demo', '--scope', 'team'], env);
  run(home, ['profile', 'setup', 'demo', '--harness', 'strict', '--tdd', 'strict', '--review', 'strict', '--verification', 'strict', '--documentation', 'strict', '--security', 'strict'], env);
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-proj-'));
  run(home, ['profile', 'apply', 'demo', project], env);
  return fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
}

test('resolveLocale follows the fixed precedence order', () => {
  assert.equal(resolveLocale({ flag: 'en', env: 'ko', saved: 'ko', isTTY: true }), 'en');
  assert.equal(resolveLocale({ env: 'en', saved: 'ko', isTTY: true }), 'en');
  assert.equal(resolveLocale({ saved: 'en', isTTY: true }), 'en');
  assert.equal(resolveLocale({ saved: 'bad', isTTY: false }), 'ko');
  assert.equal(resolveLocale({ isTTY: false }), DEFAULT_LOCALE);
  assert.equal(resolveLocale({ isTTY: true }), null);
});

test('resolveLocale rejects an unsupported flag or env value', () => {
  assert.throws(() => resolveLocale({ flag: 'fr' }), /--lang must be one of: ko, en/);
  assert.throws(() => resolveLocale({ env: 'jp' }), /AGENTIC_LANG must be one of: ko, en/);
});

test('default (non-interactive) locale keeps Korean generated guidance', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-ko-'));
  try {
    const agents = buildProject(home);
    assert.ok(hasHangul(agents), 'ko AGENTS.md should still contain Korean guidance');
    assert.match(agents, /프로젝트 규칙 확장/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AGENTIC_LANG=en generates guidance with no Korean characters', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-en-'));
  try {
    const agents = buildProject(home, { AGENTIC_LANG: 'en' });
    assert.equal(hasHangul(agents), false, 'en AGENTS.md must contain no Korean characters');
    assert.match(agents, /Project rule extensions/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AGENTIC_LANG=en sync preserves domain rules added under the extension section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-en-sync-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-en-sync-proj-'));
  const env = { AGENTIC_LANG: 'en' };
  try {
    run(home, ['profile', 'create', 'demo', '--scope', 'team'], env);
    run(home, ['profile', 'apply', 'demo', project], env);
    const agentsPath = path.join(project, 'AGENTS.md');
    fs.appendFileSync(agentsPath, '\n- Domain rule: use pnpm.\n');

    run(home, ['profile', 'sync', project], env);
    run(home, ['profile', 'sync', project], env);

    const agents = fs.readFileSync(agentsPath, 'utf8');
    assert.match(agents, /Domain rule: use pnpm/);
    assert.equal(agents.split('Add domain rules specific to this project').length - 1, 1);
    assert.doesNotMatch(agents, /Existing project guidance/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a saved config.json locale is honored with no flag or env', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-cfg-'));
  try {
    fs.mkdirSync(path.join(home, '.agentic-profiles'), { recursive: true });
    fs.writeFileSync(path.join(home, '.agentic-profiles', 'config.json'), JSON.stringify({ locale: 'en' }, null, 2) + '\n');
    run(home, ['profile', 'create', 'demo', '--scope', 'team']);
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-cfgproj-'));
    run(home, ['profile', 'apply', 'demo', project]);
    assert.equal(hasHangul(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('config lang persists the selected locale', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-save-'));
  try {
    run(home, ['config', 'lang', 'en']);
    const config = JSON.parse(fs.readFileSync(path.join(home, '.agentic-profiles', 'config.json'), 'utf8'));
    assert.equal(config.locale, 'en');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an unsupported --lang value exits non-zero', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-i18n-bad-'));
  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'list', '--lang', 'fr'], {
      cwd: repoRoot,
      env: { ...process.env, AGENTIC_HOME: home },
      encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--lang must be one of: ko, en/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('SUPPORTED_LOCALES lists ko and en', () => {
  assert.deepEqual([...SUPPORTED_LOCALES].sort(), ['en', 'ko']);
});
