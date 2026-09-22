import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 이 저장소의 스킬을 skills CLI로 임시 프로젝트에 설치하고 어디에 놓이는지 확인한다. npm에서 skills
 * CLI를 받으므로 `pnpm run check`에 넣지 않는다. 릴리스 전에 실행한다: node tools/skills-smoke.ts
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_CLI = 'skills@1.5.26';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-skills-smoke-'));
try {
  const source = path.join(scratch, 'source');
  fs.cpSync(path.join(repoRoot, 'skills'), path.join(source, 'skills'), { recursive: true });
  // 기여자 스킬도 복사한다. skills CLI는 저장소 전체를 순회하므로, 이렇게 해야 사용자의 설치가 실제로
  // 보는 것과 같다.
  fs.cpSync(path.join(repoRoot, '.agents', 'skills'), path.join(source, '.agents', 'skills'), { recursive: true });
  const project = path.join(scratch, 'project');
  fs.mkdirSync(project);
  const env = { ...process.env, HOME: scratch, USERPROFILE: scratch, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' };
  const run = (args: string[]) => {
    const result = spawnSync(npx, ['-y', SKILLS_CLI, ...args], {
      cwd: project,
      env,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    assert.equal(result.status, 0, `npx ${SKILLS_CLI} ${args.join(' ')} 실패\n${result.stdout}\n${result.stderr}`);
    return result.stdout + result.stderr;
  };

  const listed = run(['add', source, '--list']);
  assert.match(listed, /agctx-author/);
  assert.match(listed, /agctx\b/);
  // repo-docs는 metadata.internal로 표시돼 있으므로 설치가 그것을 제안하면 안 된다.
  assert.doesNotMatch(listed, /repo-docs/, '기여자 스킬은 사용자 설치에 들어가지 않는다');

  run(['add', source, '-a', 'claude-code', '-a', 'codex', '-a', 'antigravity', '-y']);
  for (const name of ['agctx', 'agctx-author']) {
    assert.ok(
      fs.existsSync(path.join(project, '.agents', 'skills', name, 'SKILL.md')),
      `.agents/skills/${name}이 Codex와 Antigravity용으로 설치된다`
    );
    assert.ok(
      fs.existsSync(path.join(project, '.claude', 'skills', name, 'SKILL.md')),
      `.claude/skills/${name}이 Claude Code용으로 설치된다`
    );
  }
  assert.match(
    fs.readFileSync(path.join(project, '.agents', 'skills', 'agctx-author', 'SKILL.md'), 'utf8'),
    /disable-model-invocation: true/
  );
  assert.ok(
    fs.existsSync(path.join(project, '.agents', 'skills', 'agctx-author', 'agents', 'openai.yaml')),
    'Codex 호출 정책이 스킬과 함께 설치된다'
  );
  assert.ok(!fs.existsSync(path.join(project, '.agents', 'skills', 'repo-docs')), '기여자 스킬은 설치되지 않는다');
  process.stdout.write(`Skills smoke test passed with ${SKILLS_CLI}.\n`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
