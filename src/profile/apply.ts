import fs from 'node:fs';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { say } from '../commands/output.ts';
import {
  AGENT_IDS,
  canonicalAgents,
  parseAgents,
  parseInclude,
  recordedAgents,
  recordedInclude,
  type AgentId,
  type IncludeKind
} from '../shared/agents.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { toLf } from '../shared/fs-utils.ts';
import { committedFile, git, isGitRoot, sanitizeRemoteUrl } from '../shared/git.ts';
import { parseMcpServers, PROFILE_MCP_FILE, type McpServers } from '../mcp/servers.ts';
import { PROFILE_METADATA_FILE } from '../shared/home.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import { shellWord } from '../shared/shell.ts';
import type {
  ConflictedFile,
  PlannedFile,
  Profile,
  ProjectConfig,
  ProjectPlan,
  ProjectSource
} from '../shared/types.ts';
import { formatDiff, MANAGED_END } from '../project/conflicts.ts';
import { planProject } from '../project/plan.ts';
import { assertNoHiddenCharacters, committedProfile } from './git-profile.ts';
import { readProfile } from './store.ts';

export const PROJECT_CONFIG_FILE = 'agctx.project.json';

/** 기록이 없을 때 받는 대상 종류: hooks를 뺀 전부(ADR 0042). */
const INCLUDE_ALL: readonly IncludeKind[] = ['rules', 'mcp'];

/**
 * `<!-- agctx:guidance:start/end -->`는 프로필에 속하고, 프로필에서는 `profile setup`이 그 사이를
 * 다시 쓴다. 프로젝트에서는 이 쌍이 아무 뜻이 없고 MANAGED_END 위의 두 번째 경계처럼 읽히므로,
 * 글만 남긴다.
 */
const GUIDANCE_MARKERS = /^[ \t]*<!-- agctx:guidance:(?:start|end) -->[ \t]*\n*/gm;

export function renderProfileAgents(content: string, profileName: string, projectName: string): string {
  const body = content.replace(GUIDANCE_MARKERS, '').trimEnd();
  return `${body}\n\n> Applied from agctx profile: ${profileName}\n\n## Project context\n\n- **Project:** ${projectName}\n\n${MANAGED_END}\n\n${_('scaffold.extHeading')}\n\n${_('scaffold.extBody')}\n`;
}

/**
 * AGENTS.md에 보이는 프로젝트 이름: package.json의 name, 그다음 마지막 적용 때 기록한 이름, 그다음
 * 폴더 이름. 이름을 기록해 두면 다른 이름의 폴더에 있는 clone(동료의 사본, 임시 worktree)도 같은
 * 파일을 만든다.
 */
export function getProjectName(targetDir: string, recorded: string | null = null): string {
  const packagePath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.name) return String(packageJson.name);
    } catch {}
  }
  return recorded || path.basename(targetDir);
}

export function assertProjectDirectory(targetDir: string): void {
  let isDirectory = false;
  try {
    isDirectory = fs.statSync(targetDir).isDirectory();
  } catch {}
  if (!isDirectory) {
    throw usageError(
      'project.not-directory',
      _('error.project.not-directory', { project: targetDir }),
      _('hint.project.path')
    );
  }
}

export function readProjectConfig(configPath: string): ProjectConfig {
  if (!fs.existsSync(configPath)) return {};
  try {
    const config: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    return config as ProjectConfig;
  } catch {
    throw usageError(
      'project.invalid-config',
      _('error.project.invalid-config', { file: configPath }),
      _('hint.project.invalid-config', { file: configPath })
    );
  }
}

export const CONFLICT_GUIDE =
  'https://github.com/IsthisLee/agent-context-manager/blob/main/docs/concepts/managed-and-extension-areas.md#관리-영역을-고쳐서-멈췄을-때';

export function conflictError(
  conflicts: readonly ConflictedFile[],
  targetDir: string,
  warnings: readonly string[] = [],
  unmanaged: readonly PlannedFile[] = []
): CliError {
  return new CliError(
    'project.conflict',
    _('error.project.conflict', { files: conflicts.map(file => file.rel).join(', ') }),
    {
      exitCode: EXIT.conflict,
      hint: [
        _('hint.project.conflict', { project: targetDir, guide: CONFLICT_GUIDE }),
        conflicts.some(file => file.remove && file.kind === 'pointer')
          ? _('hint.project.conflict.remove', { project: targetDir })
          : '',
        conflicts.some(file => file.kind === 'mcp-json' || file.kind === 'mcp-toml')
          ? _('hint.project.conflict.mcp', { project: targetDir })
          : '',
        unmanaged.length
          ? _('hint.project.conflict.unmanaged', {
              files: unmanaged.map(file => file.rel).join(', '),
              project: shellWord(targetDir)
            })
          : ''
      ]
        .filter(Boolean)
        .join(' '),
      details: conflicts.map(file => ({ file: file.rel, kind: file.conflict.kind })),
      warnings
    }
  );
}

/** 프로젝트가 받는 프로필 내용과, 함께 쓰는 버전 기록. */
export interface ProfileVersion {
  content: string;
  /** 같은 버전의 `mcp.json` 원문. 프로필에 없으면 null. */
  mcp: string | null;
  source: ProjectSource | null;
  uncommitted: boolean;
  pin: boolean;
}

/**
 * - `pin: true` (apply --pin): 커밋된 프로필을 HEAD에 고정한다. 커밋하지 않은 수정은 거부한다.
 * - `pin: 'keep'` (sync): 고정한 프로젝트는 기록한 커밋을 렌더링하고, 나머지는 보관함을 따른다.
 * - `pin: false` (apply): 지금 보관함 그대로. 커밋과, 커밋하지 않은 수정이 있는지를 기록한다.
 */
export function profileVersion(profile: Profile, projectConfig: ProjectConfig, pin: boolean | 'keep'): ProfileVersion {
  const dir = profile.profileDir;
  const name = profile.metadata.name;
  const connected = isGitRoot(dir);
  const pinned = pin === true || (pin === 'keep' && projectConfig.pin === true);
  if (pinned && !connected) {
    // 연결된 폴더는 그 폴더에서 git으로 연결한다. profile connect는 링크를 거부한다.
    throw usageError(
      'pin.not-git',
      _('error.pin.not-git', { name }),
      profile.link ? _('hint.pin.link-not-git', { path: profile.link }) : _('hint.profile.connect', { name })
    );
  }
  const mcpPath = path.join(dir, PROFILE_MCP_FILE);
  const workingMcp = () => (fs.existsSync(mcpPath) ? toLf(fs.readFileSync(mcpPath, 'utf8')) : null);
  if (!connected)
    return {
      content: toLf(fs.readFileSync(profile.instructionsPath, 'utf8')),
      mcp: workingMcp(),
      source: null,
      uncommitted: false,
      pin: false
    };

  const branch =
    git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  const remoteName = branch
    ? git(['config', `branch.${branch}.remote`], { cwd: dir, allowFailure: true }).stdout.trim() || 'origin'
    : 'origin';
  const remoteUrl = git(['remote', 'get-url', remoteName], { cwd: dir, allowFailure: true }).stdout.trim();
  const remote = remoteUrl ? sanitizeRemoteUrl(remoteUrl) : null;

  if (pin === 'keep' && projectConfig.pin === true) {
    const commit = projectConfig.source?.commit;
    // 기록된 커밋의 profile.json이 그 커밋의 규칙 파일을 가리킨다. 규칙 파일은 그 뒤에 옮겨졌을 수 있다.
    const shown =
      commit && /^[0-9a-f]{7,64}$/i.test(commit) ? (committedProfile(dir, commit, name)?.content ?? null) : null;
    if (!commit || shown === null) {
      throw new CliError(
        'pin.commit-missing',
        _('error.pin.commit-missing', { name, commit: (commit ?? '').slice(0, 7) }),
        {
          exitCode: EXIT.unavailable,
          hint: profile.link
            ? _('hint.pin.link-commit-missing', { path: shellWord(profile.link) })
            : _('hint.profile.pull', { name })
        }
      );
    }
    const shownMcp = committedFile(dir, commit, PROFILE_MCP_FILE);
    return {
      content: shown,
      mcp: shownMcp === null ? null : toLf(shownMcp),
      source: {
        ...projectConfig.source,
        git: remote ?? projectConfig.source?.git ?? null,
        branch: projectConfig.source?.branch ?? branch,
        commit
      },
      uncommitted: false,
      pin: true
    };
  }

  const commit =
    git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: dir, allowFailure: true }).stdout.trim() || null;
  const edited =
    git(
      [
        '--literal-pathspecs',
        'status',
        '--porcelain',
        '--',
        profile.instructions,
        PROFILE_METADATA_FILE,
        PROFILE_MCP_FILE
      ],
      {
        cwd: dir
      }
    ).stdout.trim() !== '';
  if (pin === true && (edited || !commit)) {
    throw usageError('pin.uncommitted', _('error.pin.uncommitted', { name }), _('hint.git.commit', { dir }));
  }
  return {
    content: toLf(fs.readFileSync(profile.instructionsPath, 'utf8')),
    mcp: workingMcp(),
    source: { git: remote, branch, commit },
    uncommitted: edited,
    pin: pin === true
  };
}

export interface ApplyPlan {
  name: string;
  targetDir: string;
  version: ProfileVersion;
  plan: ProjectPlan;
  /** 이번 실행 전에 agctx.project.json이 이미 프로젝트를 고정했는지. */
  previousPin: boolean;
  /** 연결 파일을 쓸 에이전트. */
  agents: AgentId[];
  /** 이번에 쓴 대상 종류. */
  include: IncludeKind[];
  /** 이번에 쓸 MCP 서버. 프로필에 없거나 고르지 않았으면 null. */
  mcpServers: McpServers | null;
}

/**
 * 이번에 연결 파일을 쓸 에이전트와 agctx.project.json에 남길 목록. `--agent`가 없으면 기록을 따르고,
 * 기록도 없으면 전부다. `all`은 기록을 지워서, 나중에 지원 에이전트가 늘면 그것도 받게 한다.
 */
export function agentSelection(
  option: string | null,
  projectConfig: ProjectConfig,
  configPath: string
): { agents: AgentId[]; record: AgentId[] | null } {
  if (option === null) {
    const recorded = recordedAgents(projectConfig.agents, configPath);
    return { agents: recorded ?? [...AGENT_IDS], record: recorded };
  }
  if (option.trim() === '')
    throw usageError(
      'explain.unknown-agent',
      _('error.explain.unknown-agent', { agent: '""' }),
      _('hint.explain.agents')
    );
  if (option.trim() === 'all') return { agents: [...AGENT_IDS], record: null };
  const chosen = canonicalAgents(parseAgents(option));
  return { agents: chosen, record: chosen };
}

export interface PlanOptions {
  /** `--agent` 값. null이면 기록한 선택을 따른다. */
  agent?: string | null;
  /** `--include` 값. null이면 기록한 선택을 따른다. */
  include?: string | null;
  /** `--adopt`: agctx 표지가 없는 기존 파일에도 관리 영역을 더한다. */
  adopt?: boolean;
}

export function planFor(
  name: string,
  targetDir: string,
  pin: boolean | 'keep',
  overrides?: Map<string, string | null>,
  { agent: agentOption = null, include: includeOption = null, adopt = false }: PlanOptions = {}
): ApplyPlan {
  const profile = readProfile(name);
  assertProjectDirectory(targetDir);
  const configPath = path.join(targetDir, PROJECT_CONFIG_FILE);
  const projectConfig = readProjectConfig(configPath);
  const selection = agentSelection(agentOption, projectConfig, configPath);
  const includeRecord =
    includeOption === null ? recordedInclude(projectConfig.include, configPath) : parseInclude(includeOption);
  const include = includeRecord ?? [...INCLUDE_ALL];
  const version = profileVersion(profile, projectConfig, pin);
  assertNoHiddenCharacters([
    { file: `${name}/${profile.instructions}`, content: version.content },
    ...(version.mcp === null ? [] : [{ file: `${name}/${PROFILE_MCP_FILE}`, content: version.mcp }])
  ]);
  const mcpServers =
    include.includes('mcp') && version.mcp !== null
      ? parseMcpServers(version.mcp, path.join(profile.profileDir, PROFILE_MCP_FILE))
      : null;
  const projectName = getProjectName(
    targetDir,
    typeof projectConfig.projectName === 'string' ? projectConfig.projectName : null
  );
  const plan = planProject(
    {
      packageRoot: PACKAGE_ROOT,
      targetDir,
      projectName,
      profileName: name,
      renderedAgents: renderProfileAgents(version.content, name, projectName),
      projectConfig,
      record: { source: version.source, pin: version.pin, uncommitted: version.uncommitted },
      agents: selection.agents,
      recordAgents: selection.record,
      adopt,
      mcpServers,
      recordInclude: includeRecord
    },
    overrides
  );
  return {
    name,
    targetDir,
    version,
    plan,
    previousPin: projectConfig.pin === true,
    agents: selection.agents,
    include,
    mcpServers
  };
}

/** 파일을 받는 에이전트. `AGENTS.md`는 모든 에이전트가 읽으므로 null이다. */
function fileAgent(rel: string): AgentId | null {
  if (rel === 'CLAUDE.md' || rel.endsWith('/CLAUDE.md')) return 'claude';
  if (rel === '.agents/rules/agctx.md') return 'antigravity';
  return null;
}

function isSymlink(target: string): boolean {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}

export interface UnmanagedContext {
  /** 같은 명령에 `--adopt`를 붙인 것. */
  retry: string;
  profile: string;
  targetDir: string;
  /** 지금 연결 파일을 받는 에이전트. */
  agents: readonly AgentId[];
}

/**
 * 표지 없는 파일에서 멈춘 뒤 할 수 있는 일. 편입(`--adopt`)을 먼저 안내하고, 그 파일을 받는 에이전트를
 * 빼서 피할 수 있으면 뺀 목록을 채운 `apply` 명령도 알려 준다. 심볼릭 링크는 agctx가 쓸 수 없으므로
 * 편입 대신 에이전트를 빼라고만 안내한다. `AGENTS.md`는 모든 에이전트가 읽어 뺄 수 없다.
 */
function unmanagedHint(files: readonly PlannedFile[], context: UnmanagedContext): string {
  const avoidable = [...new Set(files.map(file => fileAgent(file.rel)).filter(agent => agent !== null))];
  const rest = context.agents.filter(agent => !avoidable.includes(agent));
  const linked = files.filter(file => isSymlink(file.target)).map(file => file.rel);
  // 에이전트를 빼도 남는 파일(AGENTS.md)이 있으면 그 명령에 편입까지 붙여 한 번에 끝나게 한다.
  const stillUnmanaged = files.some(file => fileAgent(file.rel) === null);
  const leaveOut =
    avoidable.length && rest.length
      ? _('hint.project.unmanaged.agent', {
          command: `agctx profile apply ${shellWord(context.profile)} ${shellWord(context.targetDir)} --agent ${rest.join(',')}${stillUnmanaged ? ' --adopt' : ''}`
        })
      : '';
  if (linked.length)
    return [_('hint.project.unmanaged.symlink', { files: linked.join(', ') }), leaveOut].filter(Boolean).join(' ');
  return [_('hint.project.unmanaged', { command: context.retry }), leaveOut].filter(Boolean).join(' ');
}

/** agctx 표지가 없는 기존 파일에서 멈추는 오류. `--json`의 `details`에 멈춘 파일을 담는다. */
export function unmanagedError(
  files: readonly PlannedFile[],
  context: UnmanagedContext,
  warnings: readonly string[] = []
): CliError {
  return new CliError(
    'project.unmanaged',
    _('error.project.unmanaged', { files: files.map(file => file.rel).join(', ') }),
    {
      exitCode: EXIT.conflict,
      hint: unmanagedHint(files, context),
      details: files.map(file => ({ file: file.rel, kind: 'unmanaged' })),
      warnings
    }
  );
}

export function printPlan(plan: ProjectPlan, label: string): void {
  const conflicted = new Set(plan.conflicts.map(file => file.rel));
  const unmanaged = new Set(plan.unmanaged.map(file => file.rel));
  const changed = plan.changes.filter(
    change =>
      change.status !== 'unchanged' && !conflicted.has(change.relativePath) && !unmanaged.has(change.relativePath)
  );
  say(_('plan.summary', { label, count: changed.length }));
  for (const change of plan.changes) {
    const status = conflicted.has(change.relativePath)
      ? 'conflict'
      : unmanaged.has(change.relativePath)
        ? 'unmanaged'
        : change.status;
    say(`  ${status.padEnd(9)} ${change.relativePath}`);
  }
}

export function printConflicts(conflicts: readonly ConflictedFile[]): void {
  for (const file of conflicts) {
    say(`\n${_('conflict.title', { file: file.rel })}`);
    if (file.conflict.kind === 'missing') {
      say(_('conflict.missing', { file: file.rel }));
    } else if (file.conflict.base !== null) {
      say(_('conflict.edits'));
      say(formatDiff(`last-applied/${file.rel}`, `current/${file.rel}`, file.conflict.base, file.currentRegion ?? ''));
      if (file.nextRegion !== file.conflict.base) {
        say(_('conflict.profile-changes'));
        say(formatDiff(`last-applied/${file.rel}`, `next/${file.rel}`, file.conflict.base, file.nextRegion ?? ''));
      }
    } else {
      say(_('conflict.unknown-base'));
      say(formatDiff(`current/${file.rel}`, `next/${file.rel}`, file.currentRegion ?? '', file.nextRegion ?? ''));
    }
  }
}

/** 프로젝트가 묶인 프로필. 없으면 `profile apply`를 안내하는 사용법 오류. */
export function boundProfile(targetDir: string, command: string): string {
  const name = readProjectConfig(path.join(targetDir, PROJECT_CONFIG_FILE)).profile;
  if (!name)
    throw usageError(
      'project.not-applied',
      _('error.project.not-applied', { command, project: targetDir }),
      _('hint.apply', { project: targetDir })
    );
  return name;
}
