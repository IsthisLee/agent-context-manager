import { _ } from '../i18n/index.ts';
import { AGENT_IDS, isAgentId, type AgentId } from '../shared/agents.ts';
import { usageError } from '../shared/errors.ts';
import { PROFILE_HOOKS_FILE, PROFILE_SKILLS_DIR, PROFILE_SUBAGENTS_DIR, type ProfileFile } from './profile-files.ts';

/**
 * 프로필 파일에서 skills·subagents·hooks 정의를 읽고 검사한다. 에이전트가 읽지 못할 정의를 저장소에
 * 조용히 쓰지 않도록, 형식이 틀리면 어느 파일의 무엇이 틀렸는지 말하는 사용법 오류로 멈춘다.
 *
 * - skill: `skills/<이름>/SKILL.md`와 같은 폴더의 다른 파일. SKILL.md 머리말의 `name`이 폴더 이름과 같다.
 * - subagent: `subagents/<이름>.md`. 머리말의 `name`이 파일 이름과 같다. 본문이 subagent의 지시다.
 * - hooks: `hooks.json`의 `{ "hooks": { "<이름>": { "<에이전트>": { "<이벤트>": [...] } } } }`. 도구 이름과
 *   이벤트가 에이전트마다 달라서 에이전트별로 따로 적는다.
 */

/** Claude Code가 skill·subagent 이름에 받는 글자: 소문자, 숫자, 하이픈. 세 에이전트가 모두 받는 범위다. */
const DEFINITION_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFINITION_NAME_MAX = 64;
const HOOK_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * 에이전트마다 문서에 적힌 hook 이벤트(확인일: 2026-09-23). 모르는 이벤트를 쓰면 에이전트가 설정 파일을
 * 거부할 수 있으므로 멈춘다. 근거는 docs/references.md의 「skills·subagents·hooks 위치와 형식 근거」다.
 */
export const HOOK_EVENTS: Record<AgentId, readonly string[]> = {
  claude: [
    'SessionStart',
    'Setup',
    'UserPromptSubmit',
    'UserPromptExpansion',
    'PreToolUse',
    'PermissionRequest',
    'PermissionDenied',
    'PostToolUse',
    'PostToolUseFailure',
    'PostToolBatch',
    'Notification',
    'MessageDisplay',
    'SubagentStart',
    'SubagentStop',
    'TaskCreated',
    'TaskCompleted',
    'Stop',
    'StopFailure',
    'TeammateIdle',
    'InstructionsLoaded',
    'ConfigChange',
    'CwdChanged',
    'DirectoryAdded',
    'FileChanged',
    'WorktreeCreate',
    'WorktreeRemove',
    'PreCompact',
    'PostCompact',
    'PreModelSwitch',
    'PostModelSwitch',
    'Elicitation',
    'ElicitationResult',
    'SessionEnd'
  ],
  codex: [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PermissionRequest',
    'PostToolUse',
    'PreCompact',
    'PostCompact',
    'SubagentStart',
    'SubagentStop',
    'Stop',
    'Interrupt',
    'SessionEnd'
  ],
  antigravity: ['PreToolUse', 'PostToolUse', 'PreInvocation', 'PostInvocation', 'Stop']
};

export interface Frontmatter {
  /** 한 줄 값만 담는다. 여러 줄 값(`|`, `>`, 목록)은 null이다. */
  fields: Map<string, string | null>;
  body: string;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'"))
    return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

/** Markdown 파일 맨 앞의 YAML 머리말. 최상위 키와 한 줄 값만 읽는다. 머리말이 없으면 null. */
export function parseFrontmatter(text: string): Frontmatter | null {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return null;
  const fields = new Map<string, string | null>();
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(line);
    if (!field) continue;
    const value = field[2].trim();
    fields.set(
      field[1],
      value === '' || value === '|' || value === '>' || /^[|>][+-]?$/.test(value) ? null : unquote(value)
    );
  }
  return { fields, body: text.slice(match[0].length) };
}

function invalid(file: string, reason: string): Error {
  return usageError(
    'profile.invalid-artifact',
    _('error.profile.invalid-artifact', { file, reason }),
    _('hint.profile.artifact')
  );
}

/** 머리말의 `name`과 `description`을 검사한다. `name`은 파일이나 폴더의 이름과 같아야 한다. */
function namedDefinition(file: string, text: string, expected: string): Frontmatter {
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) throw invalid(file, _('artifact.reason.frontmatter'));
  const name = frontmatter.fields.get('name');
  const description = frontmatter.fields.get('description');
  if (!DEFINITION_NAME.test(expected) || expected.length > DEFINITION_NAME_MAX)
    throw invalid(file, _('artifact.reason.name-pattern', { name: expected }));
  if (name !== expected) throw invalid(file, _('artifact.reason.name', { name: String(name ?? ''), expected }));
  if (!description) throw invalid(file, _('artifact.reason.description'));
  return frontmatter;
}

export interface SkillDefinition {
  name: string;
  /** skill 폴더 기준 `/` 경로와 내용. */
  files: { path: string; content: string; executable: boolean }[];
}

export interface SubagentDefinition {
  name: string;
  description: string;
  /** 프로필 파일 그대로. Claude Code가 받는다. */
  source: string;
  /** 머리말 뒤의 지시. */
  body: string;
  /** `name`·`description` 말고 머리말에 있는 키. 다른 에이전트로 옮기지 못한다. */
  extraFields: string[];
}

export type HookEntries = Record<string, unknown[]>;

export interface HookDefinition {
  name: string;
  /** 에이전트마다 이벤트 이름과 그 이벤트의 항목. */
  agents: Partial<Record<AgentId, HookEntries>>;
}

export interface ProfileArtifacts {
  skills: SkillDefinition[];
  subagents: SubagentDefinition[];
  /** 프로필에 `hooks.json`이 없으면 null. */
  hooks: HookDefinition[] | null;
}

export const NO_ARTIFACTS: ProfileArtifacts = { skills: [], subagents: [], hooks: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSkills(files: readonly ProfileFile[]): SkillDefinition[] {
  const byName = new Map<string, ProfileFile[]>();
  for (const file of files) {
    const parts = file.path.split('/');
    if (parts[0] !== PROFILE_SKILLS_DIR) continue;
    if (parts.length < 3) throw invalid(file.path, _('artifact.reason.skill-folder'));
    byName.set(parts[1], [...(byName.get(parts[1]) ?? []), file]);
  }
  return [...byName]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, skillFiles]) => {
      const skillMd = skillFiles.find(file => file.path === `${PROFILE_SKILLS_DIR}/${name}/SKILL.md`);
      if (!skillMd) throw invalid(`${PROFILE_SKILLS_DIR}/${name}`, _('artifact.reason.skill-md'));
      namedDefinition(skillMd.path, skillMd.content, name);
      return {
        name,
        files: skillFiles.map(file => ({
          path: file.path.slice(`${PROFILE_SKILLS_DIR}/${name}/`.length),
          content: file.content,
          executable: file.executable
        }))
      };
    });
}

function parseSubagents(files: readonly ProfileFile[]): SubagentDefinition[] {
  return files
    .filter(file => file.path.startsWith(`${PROFILE_SUBAGENTS_DIR}/`))
    .map(file => {
      const rest = file.path.slice(`${PROFILE_SUBAGENTS_DIR}/`.length);
      if (rest.includes('/') || !rest.endsWith('.md')) throw invalid(file.path, _('artifact.reason.subagent-file'));
      const name = rest.slice(0, -'.md'.length);
      const frontmatter = namedDefinition(file.path, file.content, name);
      return {
        name,
        description: frontmatter.fields.get('description') ?? '',
        source: file.content,
        body: frontmatter.body.replace(/^\n+/, ''),
        extraFields: [...frontmatter.fields.keys()].filter(key => key !== 'name' && key !== 'description')
      };
    });
}

/** hook 처리기: 실행할 `command`가 있는 객체. `type`이 있으면 `command`여야 한다. */
function checkHandler(file: string, where: string, value: unknown): void {
  if (!isRecord(value) || typeof value.command !== 'string' || !value.command.trim())
    throw invalid(file, _('artifact.reason.hook-command', { where }));
  if (value.type !== undefined && value.type !== 'command')
    throw invalid(file, _('artifact.reason.hook-type', { where, type: JSON.stringify(value.type) }));
}

/** matcher 묶음: `matcher`(선택)와 처리기 목록 `hooks`만 둔다. */
function checkGroup(file: string, where: string, value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value.hooks) || !value.hooks.length)
    throw invalid(file, _('artifact.reason.hook-group', { where }));
  const extra = Object.keys(value).filter(key => key !== 'matcher' && key !== 'hooks');
  if (extra.length || (value.matcher !== undefined && typeof value.matcher !== 'string'))
    throw invalid(file, _('artifact.reason.hook-group', { where }));
  value.hooks.forEach((handler, index) => checkHandler(file, `${where}.hooks[${index}]`, handler));
}

function parseHooks(files: readonly ProfileFile[]): HookDefinition[] | null {
  const file = files.find(entry => entry.path === PROFILE_HOOKS_FILE);
  if (!file) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch (error) {
    throw invalid(PROFILE_HOOKS_FILE, error instanceof Error ? error.message : String(error));
  }
  if (!isRecord(parsed) || !isRecord(parsed.hooks) || Object.keys(parsed).some(key => key !== 'hooks'))
    throw invalid(PROFILE_HOOKS_FILE, _('artifact.reason.hooks-shape'));
  return Object.entries(parsed.hooks)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, perAgent]) => {
      if (!HOOK_NAME.test(name)) throw invalid(PROFILE_HOOKS_FILE, _('artifact.reason.hook-name', { name }));
      if (!isRecord(perAgent) || !Object.keys(perAgent).length)
        throw invalid(PROFILE_HOOKS_FILE, _('artifact.reason.hook-agents', { name, agents: AGENT_IDS.join(', ') }));
      const agents: Partial<Record<AgentId, HookEntries>> = {};
      for (const [agent, events] of Object.entries(perAgent)) {
        if (!isAgentId(agent))
          throw invalid(
            PROFILE_HOOKS_FILE,
            _('artifact.reason.hook-agent', { name, agent, agents: AGENT_IDS.join(', ') })
          );
        if (!isRecord(events) || !Object.keys(events).length)
          throw invalid(PROFILE_HOOKS_FILE, _('artifact.reason.hook-events', { where: `${name}.${agent}` }));
        for (const [event, entries] of Object.entries(events)) {
          const where = `${name}.${agent}.${event}`;
          if (!HOOK_EVENTS[agent].includes(event))
            throw invalid(
              PROFILE_HOOKS_FILE,
              _('artifact.reason.hook-event', { where, event, events: HOOK_EVENTS[agent].join(', ') })
            );
          if (!Array.isArray(entries) || !entries.length)
            throw invalid(PROFILE_HOOKS_FILE, _('artifact.reason.hook-entries', { where }));
          // Antigravity의 PreInvocation·PostInvocation·Stop은 matcher 없이 처리기를 바로 둔다.
          entries.forEach((entry, index) =>
            agent === 'antigravity' && isRecord(entry) && !Array.isArray(entry.hooks)
              ? checkHandler(PROFILE_HOOKS_FILE, `${where}[${index}]`, entry)
              : checkGroup(PROFILE_HOOKS_FILE, `${where}[${index}]`, entry)
          );
        }
        agents[agent] = events as HookEntries;
      }
      return { name, agents };
    });
}

export function parseProfileArtifacts(files: readonly ProfileFile[]): ProfileArtifacts {
  return { skills: parseSkills(files), subagents: parseSubagents(files), hooks: parseHooks(files) };
}

/** hook 처리기들이 실행할 명령. 적용 계획에 보여 준다. */
export function hookCommands(entries: readonly unknown[]): { matcher: string | null; command: string }[] {
  const commands: { matcher: string | null; command: string }[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const matcher = typeof entry.matcher === 'string' && entry.matcher !== '' ? entry.matcher : null;
    const handlers = Array.isArray(entry.hooks) ? entry.hooks : [entry];
    for (const handler of handlers)
      if (isRecord(handler) && typeof handler.command === 'string')
        commands.push({ matcher, command: handler.command });
  }
  return commands;
}
