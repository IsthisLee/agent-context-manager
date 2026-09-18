import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Install this repository's skills into a scratch project with the skills CLI
 * and check where they land. It downloads the skills CLI from npm, so it is not
 * part of `pnpm run check`. Run it before a release: node tools/skills-smoke.ts
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_CLI = 'skills@1.5.26';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-skills-smoke-'));
try {
  const source = path.join(scratch, 'source');
  fs.cpSync(path.join(repoRoot, 'skills'), path.join(source, 'skills'), { recursive: true });
  // Copy the contributor skill too: the skills CLI walks the whole repository, so
  // this is what a user's install actually sees.
  fs.cpSync(path.join(repoRoot, '.agents', 'skills'), path.join(source, '.agents', 'skills'), { recursive: true });
  const project = path.join(scratch, 'project');
  fs.mkdirSync(project);
  const env = { ...process.env, HOME: scratch, USERPROFILE: scratch, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' };
  const run = (args: string[]) => {
    const result = spawnSync(npx, ['-y', SKILLS_CLI, ...args], { cwd: project, env, encoding: 'utf8', shell: process.platform === 'win32' });
    assert.equal(result.status, 0, `npx ${SKILLS_CLI} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result.stdout + result.stderr;
  };

  const listed = run(['add', source, '--list']);
  assert.match(listed, /agctx-author/);
  assert.match(listed, /agctx\b/);
  // repo-docs is marked metadata.internal, so an install must not offer it.
  assert.doesNotMatch(listed, /repo-docs/, 'the contributor skill stays out of a user install');

  run(['add', source, '-a', 'claude-code', '-a', 'codex', '-a', 'antigravity', '-y']);
  for (const name of ['agctx', 'agctx-author']) {
    assert.ok(fs.existsSync(path.join(project, '.agents', 'skills', name, 'SKILL.md')), `.agents/skills/${name} is installed for Codex and Antigravity`);
    assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', name, 'SKILL.md')), `.claude/skills/${name} is installed for Claude Code`);
  }
  assert.match(fs.readFileSync(path.join(project, '.agents', 'skills', 'agctx-author', 'SKILL.md'), 'utf8'), /disable-model-invocation: true/);
  assert.ok(fs.existsSync(path.join(project, '.agents', 'skills', 'agctx-author', 'agents', 'openai.yaml')), 'the Codex invocation policy is installed with the skill');
  assert.ok(!fs.existsSync(path.join(project, '.agents', 'skills', 'repo-docs')), 'the contributor skill is not installed');
  process.stdout.write(`Skills smoke test passed with ${SKILLS_CLI}.\n`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
