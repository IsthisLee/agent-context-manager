import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Evidence that an agent received instruction files, read from the session logs
 * the agents keep on this machine. The log formats are not public contracts, so
 * each reader only relies on the fields evals/verify.test.ts pins down.
 */

export interface CodexEvidence {
  source: string;
  /** When the session last loaded its instructions; files changed later cannot be judged. */
  startedAt: number;
  /** The instruction text Codex injected into the session. */
  text: string;
}

export interface ClaudeEvidence {
  source: string;
  /** When the session last loaded its instructions (session start, or a reload after compaction). */
  startedAt: number;
  /** Real paths of instruction files Claude Code loaded. */
  loaded: Set<string>;
}

/** Only the newest logs are searched, so a machine with years of sessions stays fast. */
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

/** The newest Codex session started in `startDir`, from `$CODEX_HOME/sessions/**\/rollout-*.jsonl`. */
export function codexSessionEvidence(startDir: string): CodexEvidence | null {
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  for (const file of jsonlFiles(path.join(home, 'sessions'), name => name.startsWith('rollout-') && name.endsWith('.jsonl'))) {
    const lines = records(file);
    const cwd = lines
      .filter(record => record.type === 'session_meta' || record.type === 'turn_context')
      .map(record => text(object(record.payload)?.cwd))
      .find((value): value is string => Boolean(value));
    if (!cwd || realOrResolved(cwd) !== startDir) continue;
    // Judge against the latest instructions the session loaded.
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

/** The newest Claude Code transcript whose records ran in `startDir`, from `$CLAUDE_CONFIG_DIR/projects`. */
export function claudeSessionEvidence(startDir: string): ClaudeEvidence | null {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projects = path.join(configDir, 'projects');
  let folders = [path.join(projects, startDir.replace(/[^A-Za-z0-9]/g, '-'))].filter(folder => fs.existsSync(folder));
  if (!folders.length) {
    // The folder naming is not documented; fall back to folders that end with the same last path segment.
    const tail = path.basename(startDir).replace(/[^A-Za-z0-9]/g, '-');
    try {
      folders = fs.readdirSync(projects).filter(name => name.endsWith(tail)).map(name => path.join(projects, name));
    } catch {
      folders = [];
    }
  }
  const files = folders.flatMap(folder => jsonlFiles(folder, name => name.endsWith('.jsonl')));
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const file of files) {
    const lines = records(file);
    if (!lines.some(record => typeof record.cwd === 'string' && realOrResolved(record.cwd) === startDir)) continue;
    // Claude Code loads instructions at start and again after compaction; the latest load decides.
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
    return { source: file, startedAt: Number.isNaN(at) ? startedAt(file, lines.map(record => text(record.timestamp))) : at, loaded };
  }
  return null;
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Whether a file's content appears in the text Codex injected. Long files match by their start and end. */
export function codexReceived(content: string, injected: string): boolean {
  const body = normalize(content);
  if (!body) return true;
  const haystack = normalize(injected);
  if (body.length <= 1200) return haystack.includes(body);
  return haystack.includes(body.slice(0, 600)) && haystack.includes(body.slice(-400));
}
