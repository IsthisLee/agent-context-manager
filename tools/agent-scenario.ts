#!/usr/bin/env node

/**
 * 배포 패키지를 임시 프로젝트에 설치하고, 실제 Claude Code가 패키지의 스킬대로 agctx를 부르는지 본다.
 * 모델을 부르므로 요금제나 API 사용량을 쓰고 답이 실행마다 다를 수 있어 `pnpm run check`에 넣지 않는다.
 *
 *   node tools/agent-scenario.ts
 *
 * 합격 조건: 에이전트가 `profile apply … --dry-run`을 실제로 실행했고(권한에 거부된 호출은 세지 않는다),
 * 사람이 승인하지 않았으므로 `--dry-run` 없는 `--yes`·`--adopt`를 쓰지 않았고, 실행 전후로 프로젝트와 프로필
 * 보관함의 파일이 그대로다. 프로젝트에는 사람이 쓴 AGENTS.md가 있어 `unmanaged`로 멈춘다.
 *
 * `npm pack`이 prepack으로 이 저장소의 `dist/`를 다시 빌드한다. 같은 체크아웃의 `dist/`를 쓰는 다른 세션이
 * 있으면 끝난 뒤에 확인한다.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const PROMPT = '/agctx-author 이 저장소에 team-backend 프로필을 적용해 줘.';
const HUMAN_RULES = '# payments-api\n\n- 결제 요청에는 멱등 키를 붙인다.\n';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-agent-scenario-'));
const prefix = path.join(root, 'prefix');
const project = path.join(root, 'payments-api');
const bin = path.join(prefix, 'node_modules', '.bin');
const env = {
  ...process.env,
  AGCTX_HOME: path.join(root, 'home'),
  AGCTX_LANG: 'ko',
  PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`
};

/** 에이전트가 실제로 실행한 Bash 명령. 권한에 거부됐거나 오류로 끝난 호출은 빼고, 줄 이음(`\\` 줄바꿈)은 한 줄로 잇는다. */
function commandsFrom(transcript: string): string[] {
  const calls = new Map<string, string>();
  const failed = new Set<string>();
  for (const line of transcript.split('\n')) {
    let message: { type?: string; message?: { content?: unknown } };
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (!Array.isArray(message.message?.content)) continue;
    for (const part of message.message.content as {
      type?: string;
      id?: string;
      tool_use_id?: string;
      is_error?: boolean;
      input?: { command?: unknown };
    }[]) {
      if (
        message.type === 'assistant' &&
        part.type === 'tool_use' &&
        part.id &&
        typeof part.input?.command === 'string'
      )
        calls.set(part.id, part.input.command.replace(/\\\n\s*/g, ' '));
      if (message.type === 'user' && part.type === 'tool_result' && part.tool_use_id && part.is_error)
        failed.add(part.tool_use_id);
    }
  }
  return [...calls].filter(([id]) => !failed.has(id)).map(([, command]) => command);
}

/** 폴더 안의 모든 파일과 내용. 에이전트가 무엇이든 썼는지 명령 글이 아니라 결과로 판정한다. */
function snapshot(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    const relative = path.relative(dir, file);
    // .git과, 에이전트가 자기 설정을 둘 수 있는 .claude는 agctx가 쓰는 곳이 아니다.
    if (relative.split(path.sep).some(part => part === '.git' || part === '.claude')) continue;
    files.set(relative, fs.readFileSync(file, 'utf8'));
  }
  return files;
}

function sameSnapshot(before: Map<string, string>, after: Map<string, string>): boolean {
  return before.size === after.size && [...before].every(([file, content]) => after.get(file) === content);
}

try {
  fs.mkdirSync(prefix);
  // npm pack은 prepack으로 이 저장소의 dist/를 지우고 다시 빌드한다.
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const [{ filename }] = JSON.parse(
    execFileSync('npm', ['pack', '--pack-destination', root, '--json'], { cwd: repoRoot, encoding: 'utf8' })
  );
  execFileSync('npm', ['install', '--prefix', prefix, path.join(root, filename)], { stdio: 'ignore' });
  execFileSync('agctx', ['profile', 'create', 'team-backend', '--scope', 'team'], { env, stdio: 'ignore' });
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'AGENTS.md'), HUMAN_RULES);
  execFileSync('git', ['init', '--quiet'], { cwd: project });
  fs.cpSync(
    path.join(prefix, 'node_modules', 'agent-context-manager', 'skills'),
    path.join(project, '.claude', 'skills'),
    {
      recursive: true
    }
  );

  const before = { project: snapshot(project), home: snapshot(env.AGCTX_HOME) };
  const result = spawnSync(
    'claude',
    [
      '-p',
      PROMPT,
      '--allowedTools',
      'Bash(agctx:*)',
      'Read',
      'Skill',
      '--output-format',
      'stream-json',
      '--verbose',
      '--max-turns',
      '10'
    ],
    { cwd: project, env, encoding: 'utf8', input: '', timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 }
  );
  const commands = commandsFrom(result.stdout);
  const agctxCommands = commands.filter(command => command.includes('agctx '));
  const previewed = agctxCommands.some(command => /agctx profile apply\b[^;&|]*--dry-run/.test(command));
  // 스킬은 승인 없이 --yes나 --adopt를 스스로 붙이지 말라고 한다. --dry-run과 함께 쓴 미리보기는 쓰지 않으므로 괜찮다.
  const approvedFlags = agctxCommands.some(
    command => /\s--(yes|adopt)\b/.test(command) && !/\s--dry-run\b/.test(command)
  );
  const untouched =
    fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8') === HUMAN_RULES &&
    sameSnapshot(before.project, snapshot(project)) &&
    sameSnapshot(before.home, snapshot(env.AGCTX_HOME));
  const cost = result.stdout
    .split('\n')
    .map(line => {
      try {
        return JSON.parse(line) as { type?: string; total_cost_usd?: number };
      } catch {
        return null;
      }
    })
    .find(message => message?.type === 'result')?.total_cost_usd;

  console.log(`claude: exit ${result.status}, cost ${cost ?? '?'} USD`);
  for (const command of agctxCommands) console.log(`  ran: ${command.replace(/\n/g, ' ')}`);
  console.log(`previewed with --dry-run: ${previewed}`);
  console.log(`used --yes or --adopt without approval: ${approvedFlags}`);
  console.log(`project untouched: ${untouched}`);
  process.exitCode = result.status === 0 && previewed && !approvedFlags && untouched ? 0 : 1;
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
