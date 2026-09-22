import { createHash } from 'node:crypto';
import { SUPPORTED_LOCALES, t } from '../i18n/index.ts';
import { MANAGED_END } from './conflicts.ts';

/**
 * 프로젝트 지침 병합 도우미.
 * 프로필 지침과 프로젝트 고유 지침은 소유자가 따로다.
 */

// agctx가 파일에 마커를 넣기 전에 쓴 AGENTS.md를 위한 대체 경계. 제목이 어디서 끝나는지 추측하는
// 방식이 경계를 약하게 만들었다. 제목은 현재 로캘로 렌더링되고, 사람들은 자기 파일에서 제목 번호와
// 단계를 바꾸므로, 여기서는 번호, 점, 제목 단계가 모두 선택 사항이다. 경계를 알아보지 못하면 파일
// 전체가 관리 영역이 되어 모든 수정이 충돌이 된다. 그래서 이제는 MANAGED_END가 경계를 정하고,
// 이 패턴은 다음 sync가 마커를 쓸 때까지 옛 파일을 이어 줄 뿐이다.
const EXTENSION_HEADER = /^#{2,6}\s*(?:\d+\.?\s*)?(?:프로젝트 규칙 확장|Project rule extensions)[^\n]*\n+/im;
const EXTENSION_BOILERPLATES = SUPPORTED_LOCALES.map(locale => t(locale, 'scaffold.extBody'));

/** 렌더링한 AGENTS.md에서 프로필이 소유한 부분: 마커까지의 모든 것. */
function managedHead(rendered: string): string {
  const marker = rendered.indexOf(MANAGED_END);
  return marker === -1 ? rendered.trimEnd() : rendered.slice(0, marker + MANAGED_END.length);
}

/**
 * 프로필이 렌더링한 AGENTS.md와 프로젝트의 도메인 규칙 확장 영역을 합친다.
 * @param profileContent - 렌더링한 프로필 지침
 * @param existingContent - 기존 프로젝트 AGENTS.md
 */
export function mergeAgentsMd(profileContent: string, existingContent?: string | null): string {
  if (!existingContent || typeof existingContent !== 'string') return profileContent;

  // 마커 아래는 제목까지 모두 프로젝트의 것이므로, 뼈대 글로 다시 만들지 않고 적힌 그대로 옮긴다.
  const marker = existingContent.indexOf(MANAGED_END);
  if (marker !== -1) {
    const kept = existingContent
      .slice(marker + MANAGED_END.length)
      .replace(/^\n+/, '')
      .trimEnd();
    const head = managedHead(profileContent);
    return kept ? `${head}\n\n${kept}\n` : `${head}\n`;
  }

  const match = existingContent.match(EXTENSION_HEADER);
  if (!match) {
    return `${profileContent.trimEnd()}\n\n## Existing project guidance\n\n${existingContent.trim()}\n`;
  }

  const contentAfterHeader = existingContent.slice((match.index ?? 0) + match[0].length).trim();
  if (!contentAfterHeader) return profileContent;

  const boilerplate = EXTENSION_BOILERPLATES.find(text => contentAfterHeader.startsWith(text));
  const customRules = boilerplate ? contentAfterHeader.slice(boilerplate.length).trim() : contentAfterHeader;
  if (!customRules) return profileContent;

  return `${profileContent.trimEnd()}\n\n${customRules}\n`;
}

/**
 * 프로젝트 AGENTS.md에서 프로필이 소유한 부분을 돌려준다.
 * 프로젝트 확장 영역과 그 아래의 모든 것은 프로젝트의 것이다.
 */
export function extractAgentsManagedDocument(content: string | null | undefined): string | null {
  if (typeof content !== 'string') return null;
  const marker = content.indexOf(MANAGED_END);
  if (marker !== -1) return content.slice(0, marker + MANAGED_END.length);
  const extension = content.match(EXTENSION_HEADER);
  if (extension) return content.slice(0, extension.index).trimEnd();
  const preserved = content.match(/## Existing project guidance\s*\n+/i);
  if (preserved) return content.slice(0, preserved.index).trimEnd();
  return content.trimEnd();
}

export function hashAgentsManagedDocument(content: string | null | undefined): string | null {
  const managed = extractAgentsManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}

const LEADING_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

/**
 * 생성한 지침 파일에서 agctx가 소유한 블록만 바꾼다.
 * 마커가 없는 옛 파일은 그대로 두고 새 관리 블록을 받는다.
 * 에이전트는 규칙 frontmatter를 첫 줄에서만 해석하므로, 템플릿 frontmatter는 파일 맨 위의 블록
 * 밖에 둔다. 파일 맨 위에 이미 있던 frontmatter는 사용자 것으로 남긴다.
 */
export function mergeManagedDocument(managedContent: string, existingContent?: string | null): string {
  const start = '<!-- agctx:managed:start -->';
  const end = '<!-- agctx:managed:end -->';
  const template = managedContent.trim();
  const frontmatter = template.match(LEADING_FRONTMATTER)?.[0] || '';
  const managedBlock = `${start}\n${template.slice(frontmatter.length).trim()}\n${end}`;
  const withFrontmatter = (content: string) => (frontmatter ? `${frontmatter}\n${content}` : content);
  if (!existingContent || typeof existingContent !== 'string') return withFrontmatter(`${managedBlock}\n`);

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
  const merged = pattern.test(existingContent)
    ? `${existingContent.replace(pattern, managedBlock).trimEnd()}\n`
    : `${existingContent.trimEnd()}\n\n${managedBlock}\n`;
  return LEADING_FRONTMATTER.test(existingContent) ? merged : withFrontmatter(merged);
}

export function extractManagedDocument(content: string | null | undefined): string | null {
  const start = '<!-- agctx:managed:start -->';
  const end = '<!-- agctx:managed:end -->';
  const match = content?.match(new RegExp(`${start}[\\s\\S]*?${end}`, 'm'));
  return match?.[0] || null;
}

export function hashManagedDocument(content: string | null | undefined): string | null {
  const managed = extractManagedDocument(content);
  return managed ? createHash('sha256').update(managed).digest('hex') : null;
}

/**
 * 자기 Markdown 블록을 여는 줄. 다시 접은 문단이 이 줄을 넘어 이어지지 않게 한다: 제목, 목록 항목,
 * 인용, 표 행, 구분선, HTML.
 */
const BLOCK_START = /^\s*(?:#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>|\||<|-{3,}\s*$|\*{3,}\s*$|(?:```|~~~))/;

/** 그 한 줄이 블록 전체인 줄. 다음 줄이 이 줄에 이어 붙지 않는다. */
const BLOCK_CLOSES = /^\s*(?:#{1,6}[ \t]|\||<|-{3,}\s*$|\*{3,}\s*$|(?:```|~~~))/;

/**
 * Markdown 포매터가 만드는 차이를 평평하게 없앤 같은 글. 「편집기가 저장할 때 다시 포맷했다」와
 * 「사람이 고쳤다」를 가려내는 데 쓴다. 포매터들이 수렴하는 모양만 건드리고 낱말은 건드리지 않으므로,
 * 같게 정규화되는 두 글은 같은 규칙을 담는다.
 *
 * Markdown에서 문단 안의 줄바꿈 하나는 공백이므로 문단을 한 줄로 합친다. 그래서 `proseWrap: always`가
 * 모든 문단을 다시 접어도 에이전트가 읽는 내용은 바뀌지 않는다. 줄바꿈이 뜻을 갖는 펜스 코드는
 * 그대로 둔다.
 */
export function formatterNormalized(text: string): string {
  const lines = text
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, '').replace(/^(\s*)[*+]([ \t]+)/, '$1-$2'));
  const out: Array<{ text: string; fenced: boolean }> = [];
  let fenced = false;
  for (const line of lines) {
    const opensFence = /^\s*(?:```|~~~)/.test(line);
    const inFence = fenced || opensFence;
    const joinable = !inFence && line.trim() !== '' && !BLOCK_START.test(line);
    const previous = out.at(-1);
    if (
      joinable &&
      previous !== undefined &&
      !previous.fenced &&
      previous.text.trim() !== '' &&
      !BLOCK_CLOSES.test(previous.text)
    ) {
      previous.text = `${previous.text} ${line.trim()}`;
    } else {
      out.push({ text: line, fenced: inFence });
    }
    if (opensFence) fenced = !fenced;
  }
  // 빈 줄은 문단을 끝내는 일을 마친 뒤 마지막에 정리한다. 블록 사이에 빈 줄이 몇 개인지는 규칙이
  // 아니라 포매터가 정할 일이다.
  return out
    .filter(entry => entry.fenced || entry.text.trim() !== '')
    .map(entry => entry.text)
    .join('\n')
    .trimEnd();
}

export interface UnstableLine {
  /** 검사한 글 안의 줄 번호. 1부터 센다. */
  line: number;
  reason: string;
}

/**
 * Markdown 포매터가 다시 쓸 줄.
 *
 * 저장할 때 포맷하는 편집기는 파일 전체를 다시 쓰므로, 경계 아래 자기 규칙만 고친 사람도 관리 영역
 * 안의 바이트를 바꾸고, 바뀐 바이트는 그 사람이 만들지 않은 충돌로 읽힌다. 한 프로젝트에서
 * Prettier가 이렇게 `* **Project:**`를 `- **Project:**`로 바꿨다(2026-09-20 실측). 그래서 agctx가 관리
 * 영역에 쓰는 것은 처음부터 포매터가 수렴하는 모양이어야 한다.
 */
export function formatterUnstableLines(text: string): UnstableLine[] {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const found: UnstableLine[] = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) return;
    const at = index + 1;
    const next = lines[index + 1];
    if (/^\s*[*+][ \t]+\S/.test(line)) found.push({ line: at, reason: 'bullet marker is not -' });
    if (/[ \t]$/.test(line)) found.push({ line: at, reason: 'trailing whitespace' });
    if (/^#{1,6}[ \t]/.test(line) && next !== undefined && next.trim() !== '')
      found.push({ line: at, reason: 'no blank line after heading' });
    if (line === '' && index > 0 && lines[index - 1] === '')
      found.push({ line: at, reason: 'consecutive blank lines' });
  });
  return found;
}
