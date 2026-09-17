import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../src/i18n/index.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

function hasHangul(text: string) {
  return /[가-힣]/.test(text);
}

function run(home: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    env: { ...process.env, AGCTX_HOME: home, ...env },
    encoding: 'utf8'
  });
}

function buildProject(home: string, env: NodeJS.ProcessEnv = {}) {
  run(home, ['profile', 'create', 'demo', '--scope', 'team'], env);
  run(home, ['profile', 'setup', 'demo', '--workflow', 'strict', '--context', 'strict', '--tdd', 'strict', '--review', 'strict', '--verification', 'strict', '--instructions', 'strict', '--docs', 'strict', '--security', 'strict', '--untrusted', 'strict', '--language', 'strict'], env);
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-proj-'));
  run(home, ['profile', 'apply', 'demo', project, '--yes'], env);
  return fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
}

test('resolveLocale follows the fixed precedence order', () => {
  assert.equal(resolveLocale({ flag: 'en', env: 'ko', saved: 'ko', isTTY: true }), 'en');
  assert.equal(resolveLocale({ env: 'en', saved: 'ko', isTTY: true }), 'en');
  assert.equal(resolveLocale({ saved: 'en', isTTY: true }), 'en');
  assert.equal(resolveLocale({ saved: 'bad', isTTY: false }), 'en');
  assert.equal(resolveLocale({ isTTY: false }), DEFAULT_LOCALE);
  assert.equal(resolveLocale({ isTTY: true }), null);
});

test('resolveLocale rejects an unsupported flag or env value', () => {
  assert.throws(() => resolveLocale({ flag: 'fr' }), /--lang must be one of: en, ko/);
  assert.throws(() => resolveLocale({ env: 'jp' }), /AGCTX_LANG must be one of: en, ko/);
});

test('AGCTX_LANG=ko generates Korean guidance', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-ko-'));
  try {
    const agents = buildProject(home, { AGCTX_LANG: 'ko' });
    assert.ok(hasHangul(agents), 'ko AGENTS.md should contain Korean guidance');
    assert.match(agents, /프로젝트 규칙 확장/);
    assert.match(agents, /^## 변경 검토$/m);
    assert.doesNotMatch(agents, /^## 리뷰$/m);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the default (non-interactive) locale generates English guidance', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-default-'));
  try {
    const agents = buildProject(home);
    assert.equal(hasHangul(agents), false, 'the default AGENTS.md must contain no Korean characters');
    assert.match(agents, /Project rule extensions/);
    assert.match(agents, /^## Change review$/m);
    assert.doesNotMatch(agents, /^## Review$/m);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('AGCTX_LANG=en sync preserves domain rules added under the extension section', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-en-sync-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-en-sync-proj-'));
  const env = { AGCTX_LANG: 'en' };
  try {
    run(home, ['profile', 'create', 'demo', '--scope', 'team'], env);
    run(home, ['profile', 'apply', 'demo', project, '--yes'], env);
    const agentsPath = path.join(project, 'AGENTS.md');
    fs.appendFileSync(agentsPath, '\n- Domain rule: use pnpm.\n');

    run(home, ['profile', 'sync', project, '--yes'], env);
    run(home, ['profile', 'sync', project, '--yes'], env);

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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-cfg-'));
  try {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ locale: 'ko' }, null, 2) + '\n');
    run(home, ['profile', 'create', 'demo', '--scope', 'team']);
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-cfgproj-'));
    run(home, ['profile', 'apply', 'demo', project, '--yes']);
    assert.equal(hasHangul(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8')), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('config lang persists the selected locale', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-save-'));
  try {
    run(home, ['config', 'lang', 'en']);
    const config = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    assert.equal(config.locale, 'en');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an unsupported --lang value exits non-zero', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-i18n-bad-'));
  try {
    const result = spawnSync(process.execPath, [cli, 'profile', 'list', '--lang', 'fr'], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--lang must be one of: en, ko/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('SUPPORTED_LOCALES lists ko and en', () => {
  assert.deepEqual([...SUPPORTED_LOCALES].sort(), ['en', 'ko']);
});
