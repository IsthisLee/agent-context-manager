import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 에이전트가 지침 파일을 받았다는 증거. 에이전트가 이 컴퓨터에 남기는 세션 기록에서 읽는다. 기록
 * 형식은 공개 계약이 아니므로, 판독기마다 evals/verify.test.ts가 고정한 필드에만 기댄다.
 */

export interface CodexEvidence {
  source: string;
  /** 세션이 마지막으로 지침을 불러온 때. 그 뒤에 바뀐 파일은 판단할 수 없다. */
  startedAt: number;
  /** Codex가 세션에 주입한 지침 글. */
  text: string;
}

export interface ClaudeEvidence {
  source: string;
  /** 세션이 마지막으로 지침을 불러온 때(세션 시작, 또는 압축 뒤 다시 불러온 때). */
  startedAt: number;
  /** Claude Code가 불러온 지침 파일의 실제 경로. */
  loaded: Set<string>;
}

/** 최신 기록만 찾아서, 몇 년 치 세션이 있는 컴퓨터에서도 빠르게 한다. */
const MAX_LOGS = 300;

type LogRecord = Record<string, unknown>;

function realOrResolved(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

function records(file: string): LogRecord[] {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').flatMap(line => {
    if (!line.trim()) return [];
    try {
      const value: unknown = JSON.parse(line);
      return value && typeof value === 'object' ? [value as LogRecord] : [];
    } catch {
      return [];
    }
  });
}

function jsonlFiles(dir: string, match: (name: string) => boolean): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (match(entry.name)) found.push(full);
    }
  };
  walk(dir);
  return found
    .map(file => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_LOGS)
    .map(entry => entry.file);
}

const object = (value: unknown): LogRecord | null => (value && typeof value === 'object' ? (value as LogRecord) : null);
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function startedAt(file: string, stamps: (string | null)[]): number {
  const times = stamps.map(stamp => (stamp ? Date.parse(stamp) : NaN)).filter(time => !Number.isNaN(time));
  return times.length ? Math.min(...times) : fs.statSync(file).mtimeMs;
}

/** `startDir`에서 시작한 가장 최근 Codex 세션. `$CODEX_HOME/sessions/**\/rollout-*.jsonl`에서 찾는다. */
export function codexSessionEvidence(startDir: string): CodexEvidence | null {
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  for (const file of jsonlFiles(
    path.join(home, 'sessions'),
    name => name.startsWith('rollout-') && name.endsWith('.jsonl')
  )) {
    const lines = records(file);
    const cwd = lines
      .filter(record => record.type === 'session_meta' || record.type === 'turn_context')
      .map(record => text(object(record.payload)?.cwd))
      .find((value): value is string => Boolean(value));
    if (!cwd || realOrResolved(cwd) !== startDir) continue;
    // 세션이 불러온 가장 최근 지침을 기준으로 판단한다.
    let latest: { text: string; at: string | null } | null = null;
    for (const record of lines) {
      const payload = object(record.payload);
      const agentsMd = record.type === 'world_state' ? text(object(object(payload?.state)?.agents_md)?.text) : null;
      if (agentsMd) latest = { text: agentsMd, at: text(record.timestamp) };
      if (record.type === 'response_item' && payload?.type === 'message' && Array.isArray(payload.content)) {
        for (const part of payload.content) {
          const value = text(object(part)?.text);
          if (value?.includes('# AGENTS.md instructions')) latest = { text: value, at: text(record.timestamp) };
        }
      }
    }
    const meta = lines.find(record => record.type === 'session_meta');
    const sessionStart = startedAt(file, [text(object(meta?.payload)?.timestamp), text(meta?.timestamp)]);
    const loadedAt = latest?.at ? Date.parse(latest.at) : NaN;
    return { source: file, startedAt: Number.isNaN(loadedAt) ? sessionStart : loadedAt, text: latest?.text ?? '' };
  }
  return null;
}

/** `startDir`에서 실행된 기록이 있는 가장 최근 Claude Code 대화 기록. `$CLAUDE_CONFIG_DIR/projects`에서 찾는다. */
export function claudeSessionEvidence(startDir: string): ClaudeEvidence | null {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projects = path.join(configDir, 'projects');
  let folders = [path.join(projects, startDir.replace(/[^A-Za-z0-9]/g, '-'))].filter(folder => fs.existsSync(folder));
  if (!folders.length) {
    // 폴더 이름 규칙은 문서에 없다. 마지막 경로 조각이 같은 폴더로 대신 찾는다.
    const tail = path.basename(startDir).replace(/[^A-Za-z0-9]/g, '-');
    try {
      folders = fs
        .readdirSync(projects)
        .filter(name => name.endsWith(tail))
        .map(name => path.join(projects, name));
    } catch {
      folders = [];
    }
  }
  const files = folders.flatMap(folder => jsonlFiles(folder, name => name.endsWith('.jsonl')));
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const file of files) {
    const lines = records(file);
    if (!lines.some(record => typeof record.cwd === 'string' && realOrResolved(record.cwd) === startDir)) continue;
    // Claude Code는 시작할 때와 압축 뒤에 지침을 불러온다. 가장 최근에 불러온 것이 판단 기준이다.
    let loaded = new Set<string>();
    let loadedAt: string | null = null;
    for (const record of lines) {
      const attachment = object(record.attachment);
      if (record.type !== 'attachment' || !attachment) continue;
      if (attachment.type === 'instructions' && Array.isArray(attachment.files)) {
        loaded = new Set<string>();
        loadedAt = text(record.timestamp);
        for (const entry of attachment.files) {
          const loadedPath = text(object(entry)?.path);
          if (loadedPath) loaded.add(realOrResolved(loadedPath));
        }
      }
      if (attachment.type === 'nested_memory') {
        const loadedPath = text(attachment.path);
        if (loadedPath) loaded.add(realOrResolved(loadedPath));
      }
    }
    const at = loadedAt ? Date.parse(loadedAt) : NaN;
    return {
      source: file,
      startedAt: Number.isNaN(at)
        ? startedAt(
            file,
            lines.map(record => text(record.timestamp))
          )
        : at,
      loaded
    };
  }
  return null;
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** 파일 내용이 Codex가 주입한 글에 나오는지. 긴 파일은 앞부분과 끝부분으로 맞춰 본다. */
export function codexReceived(content: string, injected: string): boolean {
  const body = normalize(content);
  if (!body) return true;
  const haystack = normalize(injected);
  if (body.length <= 1200) return haystack.includes(body);
  return haystack.includes(body.slice(0, 600)) && haystack.includes(body.slice(-400));
}
