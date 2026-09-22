import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { EXIT, usageError } from './shared/errors.ts';
import { filesBelow } from './shared/scan.ts';

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
/** Lines two files must share before the same rules count as delivered twice. */
const DUPLICATE_LINES = 3;
const UNSUPPORTED = [
  '.cursorrules',
  '.cursor/rules',
  '.github/copilot-instructions.md',
  '.windsurfrules',
  '.clinerules',
  '.agent/rules'
];

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

function markdownFiles(dir: string, recursive: boolean): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return recursive ? markdownFiles(full, true) : [];
      return entry.name.endsWith('.md') ? [full] : [];
    })
    .sort();
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
  const text = read(file)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  const imports: string[] = [];
  for (const match of text.matchAll(/(?:^|\s)@((?:~\/|\.{0,2}\/)?[^\s@`)\]]+)/gm)) {
    const target = match[1].startsWith('~/')
      ? path.join(os.homedir(), match[1].slice(2))
      : path.resolve(path.dirname(file), match[1]);
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
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative.split(path.sep).join('/')
    : file;
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
      collector.findings.push({
        kind: 'warning',
        file: entry.path,
        message: _('explain.warning.codex-size', { file: entry.path })
      });
    } else {
      add(collector, chosen, 'read', 'project', _('explain.reason.codex.chain'));
    }
    if (chosen === override && isFile(agents))
      add(collector, agents, 'shadowed', 'project', _('explain.reason.codex.shadowed'));
  }

  for (const file of filesBelow(target, ['AGENTS.md', 'AGENTS.override.md'])) {
    const entry = add(collector, file, 'not-read', 'project', _('explain.reason.codex.below-start'));
    collector.findings.push({
      kind: 'warning',
      file: entry.path,
      message: _('explain.warning.codex-start', { file: entry.path, dir: display(collector.root, path.dirname(file)) })
    });
  }
}

function managedPolicyClaudeFile(): string {
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode/CLAUDE.md';
  if (process.platform === 'win32') return 'C:\\Program Files\\ClaudeCode\\CLAUDE.md';
  return '/etc/claude-code/CLAUDE.md';
}

/** Claude Code's Project instructions setting, taken from the user settings file alone. */
type ClaudeInstructionFiles = 'claude-md-or-agents-md' | 'claude-md-and-agents-md' | 'claude-md' | 'managed-only';
const CLAUDE_INSTRUCTION_FILES: readonly string[] = [
  'claude-md-or-agents-md',
  'claude-md-and-agents-md',
  'claude-md',
  'managed-only'
];
/** The files that make Claude Code read CLAUDE.md instead of AGENTS.md, in the order it lists them. */
const CLAUDE_SHADOWING_NAMES = ['CLAUDE.md', path.join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md'];

/**
 * `pluginConfigs["agents-md@builtin"].options.instructionFiles` in `<config>/settings.json`.
 * Claude Code ignores the same value in project and local settings files, so neither is read.
 */
function claudeInstructionFiles(configDir: string): ClaudeInstructionFiles {
  let value: unknown;
  try {
    const settings = JSON.parse(read(path.join(configDir, 'settings.json'))) as {
      pluginConfigs?: Record<string, { options?: Record<string, unknown> }>;
    };
    value = settings.pluginConfigs?.['agents-md@builtin']?.options?.instructionFiles;
  } catch {
    // No settings file, or one Claude Code could not parse either: the default applies.
  }
  return typeof value === 'string' && CLAUDE_INSTRUCTION_FILES.includes(value)
    ? (value as ClaudeInstructionFiles)
    : 'claude-md-or-agents-md';
}

function explainClaude(collector: Collector, target: string): void {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const setting = claudeInstructionFiles(configDir);
  const managedOnly = setting === 'managed-only';
  const readsAgents = setting === 'claude-md-or-agents-md' || setting === 'claude-md-and-agents-md';
  const launched: string[] = [];
  const known = (file: string) => collector.files.some(entry => entry.absolutePath === file);
  const scopeOf = (file: string): FileScope => (file.startsWith(collector.root + path.sep) ? 'project' : 'user');
  const launch = (file: string, scope: FileScope, reason: string) => {
    if (!isFile(file) || known(file)) return;
    add(collector, file, 'read', scope, reason);
    launched.push(file);
  };
  /** managed-only keeps only the organization's own CLAUDE.md in the launch context. */
  const launchUnlessManagedOnly = (file: string, scope: FileScope, reason: string) => {
    if (!managedOnly) return launch(file, scope, reason);
    if (isFile(file) && !known(file))
      add(collector, file, 'not-read', scope, _('explain.reason.claude.setting-managed-only'));
  };

  launch(managedPolicyClaudeFile(), 'managed-policy', _('explain.reason.claude.managed'));
  launchUnlessManagedOnly(path.join(configDir, 'CLAUDE.md'), 'user', _('explain.reason.claude.user'));
  for (const rule of markdownFiles(path.join(configDir, 'rules'), true)) {
    const paths = frontmatter(read(rule))?.paths;
    if (paths) add(collector, rule, 'conditional', 'user', _('explain.reason.claude.rule-paths'));
    else launchUnlessManagedOnly(rule, 'user', _('explain.reason.claude.rule'));
  }

  for (const dir of ancestors(target)) {
    for (const name of CLAUDE_SHADOWING_NAMES) {
      const file = path.join(dir, name);
      launchUnlessManagedOnly(file, scopeOf(file), _('explain.reason.claude.ancestor'));
    }
  }
  for (const dir of chain(collector.root, target)) {
    for (const rule of markdownFiles(path.join(dir, '.claude', 'rules'), true)) {
      if (frontmatter(read(rule))?.paths)
        add(collector, rule, 'conditional', 'project', _('explain.reason.claude.rule-paths'));
      else launchUnlessManagedOnly(rule, 'project', _('explain.reason.claude.rule'));
    }
  }

  // Claude Code v2.1.277 and later read AGENTS.md themselves. By default that happens only when no
  // CLAUDE.md, .claude/CLAUDE.md, or CLAUDE.local.md sits in the start folder or above it; the user
  // CLAUDE.md, the managed one, and .claude/rules files do not count and keep loading beside it.
  const exempt = new Set([path.join(configDir, 'CLAUDE.md'), managedPolicyClaudeFile()]);
  const shadowing = (
    setting === 'claude-md-or-agents-md'
      ? ancestors(target)
          .flatMap(dir => CLAUDE_SHADOWING_NAMES.map(name => path.join(dir, name)))
          .filter(file => !exempt.has(file) && isFile(file))
      : []
  ).reverse();
  const readsDirectly = readsAgents && !shadowing.length;
  const agentsAtLaunch = readsDirectly
    ? ancestors(target)
        .flatMap(dir => [path.join(dir, 'AGENTS.md'), path.join(dir, '.claude', 'AGENTS.md')])
        .filter(isNonEmptyFile)
    : [];
  const launchReason =
    setting === 'claude-md-and-agents-md'
      ? _('explain.reason.claude.agents-with-claude')
      : _('explain.reason.claude.agents-launch');
  for (const file of agentsAtLaunch) launch(file, scopeOf(file), launchReason);

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
          if (known(imported)) continue;
          const external = item.status === 'read' && !item.trusted && !imported.startsWith(target + path.sep);
          const scope: FileScope = imported.startsWith(collector.root + path.sep) ? 'project' : 'user';
          const reason = external
            ? _('explain.reason.claude.external-import', { file: importer })
            : _('explain.reason.claude.import', { file: importer });
          const entry = add(collector, imported, external ? 'conditional' : item.status, scope, reason);
          if (external)
            collector.findings.push({
              kind: 'warning',
              file: entry.path,
              message: _('explain.warning.external-import', { importer, file: entry.path })
            });
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

  /** What to tell someone about an AGENTS.md that never arrives: import it from the CLAUDE.md beside it, or add one. */
  const importAdvice = (entry: ExplainedFile) => {
    const folder = path.dirname(entry.absolutePath);
    const personFile = [path.join(folder, 'CLAUDE.md'), path.join(folder, '.claude', 'CLAUDE.md')].find(isFile);
    return personFile
      ? _('explain.missing.claude-no-import', { file: entry.path, claude: display(collector.root, personFile) })
      : _('explain.missing.claude', { file: entry.path });
  };
  /** An AGENTS.md Claude Code does not read, with the file or the setting that keeps it out. */
  const doesNotArrive = (file: string, shadows: string[]) => {
    if (!readsAgents) {
      const entry = add(
        collector,
        file,
        'not-read',
        'project',
        _(managedOnly ? 'explain.reason.claude.setting-managed-only' : 'explain.reason.claude.setting-claude-md')
      );
      if (!managedOnly) collector.findings.push({ kind: 'missing', file: entry.path, message: importAdvice(entry) });
      return;
    }
    // A CLAUDE.local.md is the person's own uncommitted file, so it is a warning rather than a repository defect.
    const committed = shadows.find(shadow => path.basename(shadow) !== 'CLAUDE.local.md');
    const nearest = committed ?? shadows[0];
    const entry = add(
      collector,
      file,
      'shadowed',
      'project',
      _('explain.reason.claude.agents-shadowed', { file: display(collector.root, nearest) })
    );
    if (committed) collector.findings.push({ kind: 'missing', file: entry.path, message: importAdvice(entry) });
    else
      collector.findings.push({
        kind: 'warning',
        file: entry.path,
        message: _('explain.warning.claude-local-shadow', { file: entry.path, local: display(collector.root, nearest) })
      });
  };

  for (const dir of chain(collector.root, target)) {
    for (const name of ['AGENTS.md', path.join('.claude', 'AGENTS.md')]) {
      const file = path.join(dir, name);
      if (isNonEmptyFile(file) && !known(file)) doesNotArrive(file, shadowing);
    }
  }

  // Below the start folder Claude Code reads a folder's AGENTS.md when it opens a file there and
  // that folder has none of the three CLAUDE.md files of its own.
  const nestedAgents: string[] = [];
  for (const file of filesBelow(target, ['AGENTS.md']).filter(isNonEmptyFile)) {
    if (known(file)) continue;
    const own =
      setting === 'claude-md-or-agents-md'
        ? CLAUDE_SHADOWING_NAMES.map(name => path.join(path.dirname(file), name)).filter(isFile)
        : [];
    if (readsDirectly && !own.length) {
      add(collector, file, 'on-demand', 'project', _('explain.reason.claude.agents-below-start'));
      nestedAgents.push(file);
    } else {
      doesNotArrive(file, [...own, ...shadowing]);
    }
  }
  followImports(nestedAgents, 'on-demand');

  // explain never starts an agent, so it cannot tell whether this session is one that reads AGENTS.md directly.
  if (agentsAtLaunch.length || nestedAgents.length)
    collector.findings.push({ kind: 'warning', file: null, message: _('explain.warning.claude-direct-read') });
  if (managedOnly)
    collector.findings.push({ kind: 'warning', file: null, message: _('explain.warning.claude-managed-only') });
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
      collector.findings.push({
        kind: 'missing',
        file: shown,
        message: _('explain.missing.antigravity-glob', { file: shown })
      });
    } else if (trigger) {
      add(collector, rule, 'conditional', 'project', _('explain.reason.antigravity.conditional', { trigger }));
    } else {
      add(collector, rule, 'not-read', 'project', _('explain.reason.antigravity.no-trigger'));
      collector.findings.push({
        kind: 'missing',
        file: shown,
        message: _('explain.missing.antigravity-trigger', { file: shown })
      });
    }
  }
  // Measured: a subfolder AGENTS.md did not arrive at session start; whether it loads later is unknown.
  for (const file of filesBelow(collector.root, ['AGENTS.md'])) {
    const entry = add(collector, file, 'conditional', 'project', _('explain.reason.antigravity.subfolder'));
    collector.findings.push({
      kind: 'warning',
      file: entry.path,
      message: _('explain.warning.antigravity-subfolder', { file: entry.path })
    });
  }
}

/** Lines long enough to be a rule, without list bullets, headings, comments, or imports. */
function ruleLines(file: string): Set<string> {
  let text: string;
  try {
    text = read(file);
  } catch {
    return new Set();
  }
  return new Set(
    text
      .split(/\r?\n/)
      .map(line => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim())
      .filter(line => line.length >= 24 && !/^(?:#|<!--|@)/.test(line))
  );
}

/**
 * The same rules reaching one agent through two files, such as AGENTS.md imported
 * by CLAUDE.md and a copy in .claude/rules. One of the two is read at launch; the
 * other may load later, like a path-scoped rule.
 */
function duplicateFindings(collector: Collector): void {
  const reaching = collector.files
    .filter(file => file.status === 'read' || file.status === 'conditional' || file.status === 'on-demand')
    .map(file => ({ file, lines: ruleLines(file.absolutePath) }));
  reaching.forEach((later, index) => {
    for (const earlier of reaching.slice(0, index)) {
      if (earlier.file.status !== 'read' && later.file.status !== 'read') continue;
      const count = [...later.lines].filter(line => earlier.lines.has(line)).length;
      if (count >= DUPLICATE_LINES) {
        collector.findings.push({
          kind: 'warning',
          file: later.file.path,
          message: _('explain.warning.duplicate', { file: later.file.path, other: earlier.file.path, count })
        });
      }
    }
  });
}

export function parseAgents(value: string | null): AgentId[] {
  if (!value || value === 'all') return [...AGENT_IDS];
  const agents = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const unknown = agents.filter(agent => !(AGENT_IDS as readonly string[]).includes(agent));
  if (unknown.length || !agents.length) {
    throw usageError(
      'explain.unknown-agent',
      _('error.explain.unknown-agent', { agent: unknown.join(', ') || value }),
      _('hint.explain.agents')
    );
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
    duplicateFindings(collector);
    return {
      agent,
      startDir: path.relative(root, start).split(path.sep).join('/') || '.',
      files: collector.files,
      findings: collector.findings
    };
  });

  const unsupported = UNSUPPORTED.filter(name => fs.existsSync(path.join(root, name))).map(name => ({
    path: name,
    reason: _('explain.unsupported.reason')
  }));
  const missing = explained.some(agent => agent.findings.some(finding => finding.kind === 'missing'));
  return { path: start, root, agents: explained, unsupported, exitCode: missing ? EXIT.deliveryMissing : EXIT.ok };
}
