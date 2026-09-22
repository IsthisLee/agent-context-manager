import type { AgentId } from '../shared/agents.ts';
import { tomlString } from '../mcp/toml.ts';
import type { SubagentDefinition } from './definitions.ts';

/**
 * 에이전트마다 저장소에서 skills·subagents·hooks를 읽는 위치와, 프로필 정의를 그 에이전트의 형식으로
 * 옮기는 방법. 위치의 근거는 docs/references.md의 「skills·subagents·hooks 위치와 형식 근거」다.
 */

/** skill 폴더를 두는 곳. Codex와 Antigravity는 같은 `.agents/skills`를 읽는다. */
export const SKILL_ROOTS: readonly { root: string; agents: readonly AgentId[] }[] = [
  { root: '.claude/skills', agents: ['claude'] },
  { root: '.agents/skills', agents: ['codex', 'antigravity'] }
];

export interface SubagentTarget {
  agent: AgentId;
  /** subagent 이름으로 만든 파일 경로. */
  rel: (name: string) => string;
  render: (definition: SubagentDefinition) => string;
  /** 머리말의 다른 키를 옮기지 못하는지. 옮기지 못하면 경고한다. */
  dropsExtraFields: boolean;
}

/** TOML 여러 줄 기본 문자열. 백슬래시와 제어 문자를 이스케이프하고 `"""`가 문자열을 닫지 않게 한다. */
export function tomlMultiline(value: string): string {
  const text = value.endsWith('\n') ? value : `${value}\n`;
  // 줄바꿈과 탭 말고 TOML이 여러 줄 문자열에 그대로 받지 않는 제어 문자는 \uXXXX로 쓴다.
  const control = (code: number) => (code < 0x20 && code !== 0x0a && code !== 0x09) || code === 0x7f;
  const escaped = [...text.replace(/\\/g, '\\\\')]
    .map(char =>
      control(char.charCodeAt(0)) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}` : char
    )
    .join('')
    .replace(/"""/g, '""\\"');
  return `"""\n${escaped}"""`;
}

export const SUBAGENT_TARGETS: readonly SubagentTarget[] = [
  {
    agent: 'claude',
    rel: name => `.claude/agents/${name}.md`,
    render: definition => definition.source,
    dropsExtraFields: false
  },
  {
    agent: 'codex',
    rel: name => `.codex/agents/${name}.toml`,
    render: definition =>
      [
        '# Subagent from the agctx profile. Change it in the profile, not here.',
        `name = ${tomlString(definition.name)}`,
        `description = ${tomlString(definition.description)}`,
        `developer_instructions = ${tomlMultiline(definition.body)}`,
        ''
      ].join('\n'),
    dropsExtraFields: true
  }
];

/**
 * hooks 설정 파일. 둘 다 `hooks.<이벤트>` 배열에 matcher 묶음을 넣는 같은 형식이다. Antigravity는
 * 최상위 키가 hook 이름인 `.agents/hooks.json`을 쓰는데, 워크스페이스의 그 파일을 읽는 것을 확인하지 못해
 * 아직 쓰지 않는다(ADR 0046).
 */
export const HOOK_TARGETS: readonly { agent: AgentId; rel: string }[] = [
  { agent: 'claude', rel: '.claude/settings.json' },
  { agent: 'codex', rel: '.codex/hooks.json' }
];

/** subagents·hooks를 아직 쓰지 않는 에이전트. 문서의 위치에 두어도 읽는 것을 확인하지 못했다. */
export const UNVERIFIED_AGENTS: readonly AgentId[] = ['antigravity'];

/** agctx가 파일째 소유하는 skills·subagents 파일이 놓이는 폴더. */
const OWNED_FILE_ROOTS: readonly string[] = [
  ...SKILL_ROOTS.map(entry => `${entry.root}/`),
  '.claude/agents/',
  '.codex/agents/'
];

/** agctx가 파일째 소유하는 skills·subagents 파일인가. */
export function isOwnedArtifactFile(rel: string): boolean {
  return OWNED_FILE_ROOTS.some(root => rel.startsWith(root));
}

export function isHooksFile(rel: string): boolean {
  return HOOK_TARGETS.some(target => target.rel === rel);
}
