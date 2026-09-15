import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { EXIT, usageError } from './shared/errors.ts';

/**
 * `agctx explain`: which instruction files each agent reads when started in a
 * folder, and where a file never reaches an agent. It follows each agent's
 * documented loading rules and, where documents are silent, the measured
 * behavior recorded in docs/references.md. Nothing is written.
 */

export type AgentId = 'codex' | 'claude' | 'antigravity';
export const AGENT_IDS: readonly AgentId[] = ['codex', 'claude', 'antigravity'];

export type FileStatus = 'read' | 'on-demand' | 'conditional' | 'not-read' | 'shadowed';
export type FileScope = 'managed-policy' | 'user' | 'project';

export interface ExplainedFile {
  /** Relative to the project root with `/`, or absolute for files outside it. */
  path: string;
  absolutePath: string;
  status: FileStatus;
  scope: FileScope;
  reason: string;
  origin: 'agctx-managed' | 'project' | null;
}

export interface ExplainFinding {
  kind: 'missing' | 'warning';
  file: string | null;
  message: string;
}

export interface AgentExplanation {
  agent: AgentId;
  startDir: string;
  files: ExplainedFile[];
  findings: ExplainFinding[];
}

export interface Explanation {
  path: string;
  root: string;
  agents: AgentExplanation[];
  unsupported: { path: string; reason: string }[];
  exitCode: number;
}

/** Codex stops adding project AGENTS.md files at this combined size by default. */
const CODEX_MAX_BYTES = 32 * 1024;
/** Claude Code follows imports at most this many hops. */
const CLAUDE_IMPORT_DEPTH = 4;
/** Folders never searched for nested instruction files. */
const SKIPPED_FOLDERS = new Set(['.git', 'node_modules', '.agctx', 'dist', 'build', 'vendor', '.venv', 'target', 'coverage']);
const MAX_SCANNED_FOLDERS = 5000;
const UNSUPPORTED = ['.cursorrules', '.cursor/rules', '.github/copilot-instructions.md', '.windsurfrules', '.clinerules', '.agent/rules'];

const isFile = (file: string) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
const isNonEmptyFile = (file: string) => isFile(file) && fs.statSync(file).size > 0;
const read = (file: string) => fs.readFileSync(file, 'utf8');

/** The Git root above a folder, or the folder itself outside Git. */
export function projectRoot(dir: string): string {
  for (let current = dir; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    if (path.dirname(current) === current) return dir;
  }
}

/** Folders from `root` down to `target`, both included. */
function chain(root: string, target: string): string[] {
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  return [root, ...parts.map((_part, index) => path.join(root, ...parts.slice(0, index + 1)))];
}

/** Folders from the filesystem root down to `target`. */
function ancestors(target: string): string[] {
  const folders: string[] = [];
  for (let current = target; ; current = path.dirname(current)) {
    folders.unshift(current);
    if (path.dirname(current) === current) return folders;
  }
}

/** Files with one of `names` in folders below `start`, skipping dependency and build folders. */
function filesBelow(start: string, names: readonly string[]): string[] {
  const found: string[] = [];
  const queue = [start];
  let scanned = 0;
  while (queue.length && scanned < MAX_SCANNED_FOLDERS) {
    const dir = queue.shift() as string;
    scanned += 1;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(entry.name)) queue.push(full);
      } else if (dir !== start && names.includes(entry.name)) {
        found.push(full);
      }
    }
  }
  return found.sort();
}

function markdownFiles(dir: string, recursive: boolean): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return recursive ? markdownFiles(full, true) : [];
    return entry.name.endsWith('.md') ? [full] : [];
  }).sort();
}

/** Simple `key: value` frontmatter at the very start of a file. */
function frontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const fields: Record<string, string> = {};
  let listKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) {
      fields[pair[1]] = pair[2].trim();
      listKey = pair[2].trim() === '' ? pair[1] : null;
    } else if (listKey && /^\s*-\s+/.test(line)) {
      fields[listKey] = `${fields[listKey]} ${line.replace(/^\s*-\s+/, '').trim()}`.trim();
    }
  }
  return fields;
}

/** `@path` imports outside code blocks and code spans, resolved from the importing file. */
function claudeImports(file: string): string[] {
  const text = read(file).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const imports: string[] = [];
  for (const match of text.matchAll(/(?:^|\s)@((?:~\/|\.{0,2}\/)?[^\s@`)\]]+)/gm)) {
    const target = match[1].startsWith('~/') ? path.join(os.homedir(), match[1].slice(2)) : path.resolve(path.dirname(file), match[1]);
    if (isFile(target)) imports.push(target);
  }
  return imports;
}

interface Collector {
  root: string;
  managed: Set<string>;
  files: ExplainedFile[];
  findings: ExplainFinding[];
}

function display(root: string, file: string): string {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative.split(path.sep).join('/') : file;
}

function add(collector: Collector, file: string, status: FileStatus, scope: FileScope, reason: string): ExplainedFile {
  const shown = display(collector.root, file);
  const existing = collector.files.find(entry => entry.absolutePath === file);
  if (existing) return existing;
  const entry: ExplainedFile = {
    path: shown,
    absolutePath: file,
    status,
    scope,
    reason,
    origin: scope === 'project' ? (collector.managed.has(shown) ? 'agctx-managed' : 'project') : null
  };
  collector.files.push(entry);
  return entry;
}

function explainCodex(collector: Collector, target: string): void {
  const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const globalOverride = path.join(home, 'AGENTS.override.md');
  const globalFile = path.join(home, 'AGENTS.md');
  if (isNonEmptyFile(globalOverride)) {
    add(collector, globalOverride, 'read', 'user', _('explain.reason.codex.global'));
    if (isFile(globalFile)) add(collector, globalFile, 'shadowed', 'user', _('explain.reason.codex.shadowed'));
  } else if (isNonEmptyFile(globalFile)) {
    add(collector, globalFile, 'read', 'user', _('explain.reason.codex.global'));
  }

  let total = 0;
  for (const dir of chain(collector.root, target)) {
    const override = path.join(dir, 'AGENTS.override.md');
    const agents = path.join(dir, 'AGENTS.md');
    const chosen = isNonEmptyFile(override) ? override : isNonEmptyFile(agents) ? agents : null;
    if (!chosen) continue;
    total += fs.statSync(chosen).size;
    if (total > CODEX_MAX_BYTES) {
      const entry = add(collector, chosen, 'not-read', 'project', _('explain.reason.codex.size-limit'));
      collector.findings.push({ kind: 'warning', file: entry.path, message: _('explain.warning.codex-size', { file: entry.path }) });
    } else {
      add(collector, chosen, 'read', 'project', _('explain.reason.codex.chain'));
    }
    if (chosen === override && isFile(agents)) add(collector, agents, 'shadowed', 'project', _('explain.reason.codex.shadowed'));
  }

  for (const file of filesBelow(target, ['AGENTS.md', 'AGENTS.override.md'])) {
    const entry = add(collector, file, 'not-read', 'project', _('explain.reason.codex.below-start'));
    collector.findings.push({ kind: 'warning', file: entry.path, message: _('explain.warning.codex-start', { file: entry.path, dir: display(collector.root, path.dirname(file)) }) });
  }
}

function managedPolicyClaudeFile(): string {
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode/CLAUDE.md';
  if (process.platform === 'win32') return 'C:\\Program Files\\ClaudeCode\\CLAUDE.md';
  return '/etc/claude-code/CLAUDE.md';
}

function explainClaude(collector: Collector, target: string): void {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const launched: string[] = [];
  const launch = (file: string, scope: FileScope, reason: string) => {
    if (!isFile(file) || collector.files.some(entry => entry.absolutePath === file)) return;
    add(collector, file, 'read', scope, reason);
    launched.push(file);
  };

  launch(managedPolicyClaudeFile(), 'managed-policy', _('explain.reason.claude.managed'));
  launch(path.join(configDir, 'CLAUDE.md'), 'user', _('explain.reason.claude.user'));
  for (const rule of markdownFiles(path.join(configDir, 'rules'), true)) {
    const paths = frontmatter(read(rule))?.paths;
    if (paths) add(collector, rule, 'conditional', 'user', _('explain.reason.claude.rule-paths'));
    else launch(rule, 'user', _('explain.reason.claude.rule'));
  }

  for (const dir of ancestors(target)) {
    const scope: FileScope = dir === collector.root || dir.startsWith(collector.root + path.sep) ? 'project' : 'user';
    launch(path.join(dir, 'CLAUDE.md'), scope, _('explain.reason.claude.ancestor'));
    launch(path.join(dir, '.claude', 'CLAUDE.md'), scope, _('explain.reason.claude.ancestor'));
    launch(path.join(dir, 'CLAUDE.local.md'), scope, _('explain.reason.claude.ancestor'));
  }
  for (const dir of chain(collector.root, target)) {
    for (const rule of markdownFiles(path.join(dir, '.claude', 'rules'), true)) {
      if (frontmatter(read(rule))?.paths) add(collector, rule, 'conditional', 'project', _('explain.reason.claude.rule-paths'));
      else launch(rule, 'project', _('explain.reason.claude.rule'));
    }
  }

  // Imports load with the file that names them, up to four hops. A project-level file that imports
  // from outside the start folder loads it only after the user approves once; user-level files are trusted.
  const trusted = (file: string) => file.startsWith(configDir + path.sep) || file === managedPolicyClaudeFile();
  const followImports = (files: string[], status: FileStatus) => {
    let frontier = files.map(file => ({ file, status, trusted: trusted(file), depth: 0 }));
    while (frontier.length) {
      const next: typeof frontier = [];
      for (const item of frontier) {
        if (item.depth >= CLAUDE_IMPORT_DEPTH) continue;
        const importer = display(collector.root, item.file);
        for (const imported of claudeImports(item.file)) {
          if (collector.files.some(entry => entry.absolutePath === imported)) continue;
          const external = item.status === 'read' && !item.trusted && !imported.startsWith(target + path.sep);
          const scope: FileScope = imported.startsWith(collector.root + path.sep) ? 'project' : 'user';
          const reason = external ? _('explain.reason.claude.external-import', { file: importer }) : _('explain.reason.claude.import', { file: importer });
          const entry = add(collector, imported, external ? 'conditional' : item.status, scope, reason);
          if (external) collector.findings.push({ kind: 'warning', file: entry.path, message: _('explain.warning.external-import', { importer, file: entry.path }) });
          next.push({ file: imported, status: entry.status, trusted: item.trusted, depth: item.depth + 1 });
        }
      }
      frontier = next;
    }
  };
  followImports(launched, 'read');

  const nested = filesBelow(target, ['CLAUDE.md', 'CLAUDE.local.md']);
  for (const file of nested) add(collector, file, 'on-demand', 'project', _('explain.reason.claude.below-start'));
  followImports(nested, 'on-demand');

  // Claude Code reads CLAUDE.md, not AGENTS.md: every AGENTS.md needs an import to arrive.
  const agentsFiles = [...chain(collector.root, target).map(dir => path.join(dir, 'AGENTS.md')), ...filesBelow(target, ['AGENTS.md'])].filter(isNonEmptyFile);
  for (const file of agentsFiles) {
    if (collector.files.some(entry => entry.absolutePath === file)) continue;
    const entry = add(collector, file, 'not-read', 'project', _('explain.reason.claude.agents-not-imported'));
    collector.findings.push({ kind: 'missing', file: entry.path, message: _('explain.missing.claude', { file: entry.path }) });
  }
}

function explainAntigravity(collector: Collector): void {
  const globalRules = path.join(os.homedir(), '.gemini', 'GEMINI.md');
  if (isNonEmptyFile(globalRules)) add(collector, globalRules, 'read', 'user', _('explain.reason.antigravity.global'));
  for (const name of ['AGENTS.md', 'GEMINI.md']) {
    const file = path.join(collector.root, name);
    if (isNonEmptyFile(file)) add(collector, file, 'read', 'project', _('explain.reason.antigravity.root-file'));
  }
  for (const rule of markdownFiles(path.join(collector.root, '.agents', 'rules'), false)) {
    const trigger = frontmatter(read(rule))?.trigger ?? null;
    const shown = display(collector.root, rule);
    if (trigger === 'always_on') {
      add(collector, rule, 'read', 'project', _('explain.reason.antigravity.always-on'));
    } else if (trigger === 'glob') {
      add(collector, rule, 'not-read', 'project', _('explain.reason.antigravity.glob'));
      collector.findings.push({ kind: 'missing', file: shown, message: _('explain.missing.antigravity-glob', { file: shown }) });
    } else if (trigger) {
      add(collector, rule, 'conditional', 'project', _('explain.reason.antigravity.conditional', { trigger }));
    } else {
      add(collector, rule, 'not-read', 'project', _('explain.reason.antigravity.no-trigger'));
      collector.findings.push({ kind: 'missing', file: shown, message: _('explain.missing.antigravity-trigger', { file: shown }) });
    }
  }
  // Measured: a subfolder AGENTS.md did not arrive at session start; whether it loads later is unknown.
  for (const file of filesBelow(collector.root, ['AGENTS.md'])) {
    const entry = add(collector, file, 'conditional', 'project', _('explain.reason.antigravity.subfolder'));
    collector.findings.push({ kind: 'warning', file: entry.path, message: _('explain.warning.antigravity-subfolder', { file: entry.path }) });
  }
}

export function parseAgents(value: string | null): AgentId[] {
  if (!value || value === 'all') return [...AGENT_IDS];
  const agents = value.split(',').map(item => item.trim()).filter(Boolean);
  const unknown = agents.filter(agent => !(AGENT_IDS as readonly string[]).includes(agent));
  if (unknown.length || !agents.length) {
    throw usageError('explain.unknown-agent', _('error.explain.unknown-agent', { agent: unknown.join(', ') || value }), _('hint.explain.agents'));
  }
  return agents as AgentId[];
}

export function explainPath(requested: string, agents: readonly AgentId[]): Explanation {
  const target = fs.existsSync(requested) && fs.statSync(requested).isFile() ? path.dirname(requested) : requested;
  assertProjectDirectory(target);
  const start = fs.realpathSync(target);
  const root = projectRoot(start);
  const config = readProjectConfig(path.join(root, PROJECT_CONFIG_FILE));
  const managed = new Set(Object.keys(config.managedHashes ?? {}));

  const explained = agents.map((agent): AgentExplanation => {
    const collector: Collector = { root, managed, files: [], findings: [] };
    if (agent === 'codex') explainCodex(collector, start);
    else if (agent === 'claude') explainClaude(collector, start);
    else explainAntigravity(collector);
    return { agent, startDir: path.relative(root, start).split(path.sep).join('/') || '.', files: collector.files, findings: collector.findings };
  });

  const unsupported = UNSUPPORTED.filter(name => fs.existsSync(path.join(root, name))).map(name => ({ path: name, reason: _('explain.unsupported.reason') }));
  const missing = explained.some(agent => agent.findings.some(finding => finding.kind === 'missing'));
  return { path: start, root, agents: explained, unsupported, exitCode: missing ? EXIT.deliveryMissing : EXIT.ok };
}
