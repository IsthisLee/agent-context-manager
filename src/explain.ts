import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { EXIT } from './shared/errors.ts';
import { filesBelow } from './shared/scan.ts';

/**
 * `agctx explain`: 각 에이전트가 한 폴더에서 시작할 때 어떤 지침 파일을 읽는지, 어떤 파일이
 * 에이전트에 닿지 않는지. 에이전트마다 문서에 적힌 로드 규칙을 따르고, 문서가 말하지 않는 곳은
 * docs/references.md에 기록한 측정 결과를 따른다. 아무것도 쓰지 않는다.
 */

import { canonicalAgents, recordedAgents, type AgentId } from './shared/agents.ts';

export { AGENT_IDS, parseAgents, type AgentId } from './shared/agents.ts';

export type FileStatus = 'read' | 'on-demand' | 'conditional' | 'not-read' | 'shadowed';
export type FileScope = 'managed-policy' | 'user' | 'project';

export interface ExplainedFile {
  /** 프로젝트 루트 기준으로 `/`를 쓴 경로. 루트 밖의 파일은 절대 경로. */
  path: string;
  absolutePath: string;
  status: FileStatus;
  scope: FileScope;
  reason: string;
  origin: 'agctx-managed' | 'project' | null;
}

export interface ExplainFinding {
  /** `not-selected`는 이 저장소가 agctx.project.json에서 고르지 않은 에이전트라는 안내다. */
  kind: 'missing' | 'warning' | 'not-selected';
  file: string | null;
  message: string;
}

export interface AgentExplanation {
  agent: AgentId;
  /** 이 저장소가 고른 에이전트인가. 고르지 않은 에이전트의 누락은 종료 코드에 세지 않는다. */
  selected: boolean;
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

/** Codex는 기본 설정에서 프로젝트 AGENTS.md를 합친 크기가 이 값에 이르면 더 붙이지 않는다. */
const CODEX_MAX_BYTES = 32 * 1024;
/** Claude Code가 따라가는 import의 최대 단계 수. */
const CLAUDE_IMPORT_DEPTH = 4;
/** 같은 규칙이 두 번 전달된다고 보려면 두 파일이 함께 가져야 하는 줄 수. */
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

/** 폴더 위의 Git 루트. Git 밖이면 그 폴더 자체. */
export function projectRoot(dir: string): string {
  for (let current = dir; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    if (path.dirname(current) === current) return dir;
  }
}

/** `root`에서 `target`까지 내려가는 폴더들. 양 끝을 포함한다. */
function chain(root: string, target: string): string[] {
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  return [root, ...parts.map((_part, index) => path.join(root, ...parts.slice(0, index + 1)))];
}

/** 파일 시스템 루트에서 `target`까지 내려가는 폴더들. */
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

/** 파일 맨 앞의 간단한 `key: value` frontmatter. */
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

/** 코드 블록과 코드 스팬 밖의 `@path` import. import하는 파일 기준으로 경로를 푼다. */
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

/** Claude Code의 Project instructions 설정. 사용자 설정 파일에서만 읽는다. */
type ClaudeInstructionFiles = 'claude-md-or-agents-md' | 'claude-md-and-agents-md' | 'claude-md' | 'managed-only';
const CLAUDE_INSTRUCTION_FILES: readonly string[] = [
  'claude-md-or-agents-md',
  'claude-md-and-agents-md',
  'claude-md',
  'managed-only'
];
/** Claude Code가 AGENTS.md 대신 CLAUDE.md를 읽게 만드는 파일들. Claude Code가 나열하는 순서대로. */
const CLAUDE_SHADOWING_NAMES = ['CLAUDE.md', path.join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md'];

/**
 * `<config>/settings.json`의 `pluginConfigs["agents-md@builtin"].options.instructionFiles`.
 * Claude Code는 프로젝트·로컬 설정 파일의 같은 값을 무시하므로 둘 다 읽지 않는다.
 */
function claudeInstructionFiles(configDir: string): ClaudeInstructionFiles {
  let value: unknown;
  try {
    const settings = JSON.parse(read(path.join(configDir, 'settings.json'))) as {
      pluginConfigs?: Record<string, { options?: Record<string, unknown> }>;
    };
    value = settings.pluginConfigs?.['agents-md@builtin']?.options?.instructionFiles;
  } catch {
    // 설정 파일이 없거나 Claude Code도 해석하지 못하는 파일이면 기본값이 적용된다.
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
  /** managed-only는 시작 컨텍스트에 조직의 CLAUDE.md만 남긴다. */
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

  // Claude Code v2.1.277 이상은 AGENTS.md를 직접 읽는다. 기본으로는 시작 폴더나 그 위에 CLAUDE.md,
  // .claude/CLAUDE.md, CLAUDE.local.md가 없을 때만 그렇다. 사용자 CLAUDE.md, 관리 CLAUDE.md,
  // .claude/rules 파일은 세지 않고 함께 계속 불러온다.
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

  // import는 그것을 적은 파일과 함께 최대 네 단계까지 불러온다. 프로젝트 수준 파일이 시작 폴더
  // 밖에서 import하면 사용자가 한 번 승인한 뒤에만 불러온다. 사용자 수준 파일은 신뢰한다.
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

  /** 전달되지 않는 AGENTS.md에 대해 안내할 말: 옆의 CLAUDE.md에서 import하거나, CLAUDE.md를 더하라. */
  const importAdvice = (entry: ExplainedFile) => {
    const folder = path.dirname(entry.absolutePath);
    const personFile = [path.join(folder, 'CLAUDE.md'), path.join(folder, '.claude', 'CLAUDE.md')].find(isFile);
    return personFile
      ? _('explain.missing.claude-no-import', { file: entry.path, claude: display(collector.root, personFile) })
      : _('explain.missing.claude', { file: entry.path });
  };
  /** Claude Code가 읽지 않는 AGENTS.md와, 그것을 막는 파일이나 설정. */
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
    // CLAUDE.local.md는 그 사람이 커밋하지 않은 자기 파일이므로, 저장소 결함이 아니라 경고로 다룬다.
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

  // 시작 폴더 아래에서는, Claude Code가 어떤 폴더의 파일을 열고 그 폴더에 자기 CLAUDE.md 세 종류가
  // 하나도 없을 때 그 폴더의 AGENTS.md를 읽는다.
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

  // explain은 에이전트를 시작하지 않으므로, 이번 세션이 AGENTS.md를 직접 읽는 세션인지 알 수 없다.
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
  // 측정 결과: 하위 폴더의 AGENTS.md는 세션 시작 때 전달되지 않았다. 나중에 불러오는지는 모른다.
  for (const file of filesBelow(collector.root, ['AGENTS.md'])) {
    const entry = add(collector, file, 'conditional', 'project', _('explain.reason.antigravity.subfolder'));
    collector.findings.push({
      kind: 'warning',
      file: entry.path,
      message: _('explain.warning.antigravity-subfolder', { file: entry.path })
    });
  }
}

/** 규칙이라고 볼 만큼 긴 줄. 목록 기호, 제목, 주석, import는 뺀다. */
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
 * 같은 규칙이 두 파일을 거쳐 한 에이전트에 닿는 경우. 예를 들어 CLAUDE.md가 import한 AGENTS.md와
 * .claude/rules의 사본이다. 둘 중 하나는 시작할 때 읽고, 다른 하나는 경로 범위 규칙처럼 나중에
 * 불러올 수 있다.
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

export function explainPath(requested: string, agents: readonly AgentId[]): Explanation {
  const target = fs.existsSync(requested) && fs.statSync(requested).isFile() ? path.dirname(requested) : requested;
  assertProjectDirectory(target);
  const start = fs.realpathSync(target);
  const root = projectRoot(start);
  const configPath = path.join(root, PROJECT_CONFIG_FILE);
  const config = readProjectConfig(configPath);
  const managed = new Set(Object.keys(config.managedHashes ?? {}));
  const chosen = recordedAgents(config.agents, configPath);

  const explained = agents.map((agent): AgentExplanation => {
    const collector: Collector = { root, managed, files: [], findings: [] };
    if (agent === 'codex') explainCodex(collector, start);
    else if (agent === 'claude') explainClaude(collector, start);
    else explainAntigravity(collector);
    duplicateFindings(collector);
    const selected = chosen === null || chosen.includes(agent);
    if (!selected) {
      // 안내하는 명령은 지금 고른 에이전트에 이 에이전트를 더한 목록이라, 그대로 실행해도 다른 에이전트가 빠지지 않는다.
      const message =
        agent === 'codex'
          ? _('explain.not-selected.codex')
          : _('explain.not-selected', {
              profile: config.profile ?? '<profile>',
              agents: canonicalAgents([...(chosen ?? []), agent]).join(',')
            });
      collector.findings.unshift({ kind: 'not-selected', file: null, message });
    }
    return {
      agent,
      selected,
      startDir: path.relative(root, start).split(path.sep).join('/') || '.',
      files: collector.files,
      findings: collector.findings
    };
  });

  const unsupported = UNSUPPORTED.filter(name => fs.existsSync(path.join(root, name))).map(name => ({
    path: name,
    reason: _('explain.unsupported.reason')
  }));
  const missing = explained.some(agent => agent.selected && agent.findings.some(finding => finding.kind === 'missing'));
  return { path: start, root, agents: explained, unsupported, exitCode: missing ? EXIT.deliveryMissing : EXIT.ok };
}
