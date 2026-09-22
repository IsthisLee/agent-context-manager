// 저장소 밖의 사실을 기록하는 문서에 대한 근거 규칙. 외부 출처는 예고 없이 바뀌므로 references.md의
// 모든 외부 링크에는 주장을 확인한 날짜를 붙이고, 새 ADR은 근거가 어디 있는지나 근거에 기대지
// 않는다는 것을 밝힌다.

const EXTERNAL_LINK = /\]\(\s*<?https?:\/\//i;
const CHECKED_DATE = /확인일:\s*\d{4}-\d{2}-\d{2}\b/;
const CODE_FENCE = /^\s*(```|~~~)/;

/** 근거 머리말 필드를 갖춰야 하는 첫 ADR 번호. */
export const EVIDENCE_REQUIRED_FROM_ADR = 9;
const EVIDENCE_FIELD = /^\s*[*-]?\s*\*\*(?:근거|Evidence):\*\*[ \t]*(.*)$/m;
const MARKDOWN_LINK = /\]\([^)\s]+\)/;
const NO_EXTERNAL_EVIDENCE = /^(?:외부 근거 없음|No external evidence)\s*:\s*\S/i;

/**
 * 확인일 없이 외부 링크를 인용하는 줄의 번호. 1부터 센다.
 * 펜스 코드 블록은 주장이 아니라 예시를 보여 주므로 건너뛴다.
 */
export function undatedReferenceLinkLines(content: string): number[] {
  const undated: number[] = [];
  let inCodeBlock = false;
  content.split(/\r?\n/).forEach((line, index) => {
    if (CODE_FENCE.test(line)) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (!inCodeBlock && EXTERNAL_LINK.test(line) && !CHECKED_DATE.test(line)) undated.push(index + 1);
  });
  return undated;
}

/**
 * EVIDENCE_REQUIRED_FROM_ADR 이후의 ADR에 링크나 외부 근거가 없다는 이유를 담은 근거 필드가 없을 때의
 * 오류 메시지.
 * @param fileName - 예: `0009-agent-rule-frontmatter.md`
 */
export function adrEvidenceError(fileName: string, content: string): string | null {
  const number = Number.parseInt(fileName.slice(0, 4), 10);
  if (!(number >= EVIDENCE_REQUIRED_FROM_ADR)) return null;
  const value = content.match(EVIDENCE_FIELD)?.[1]?.trim() ?? '';
  if (MARKDOWN_LINK.test(value) || NO_EXTERNAL_EVIDENCE.test(value)) return null;
  return `docs/adr/${fileName}: ADR header field (근거) needs a link or "외부 근거 없음: <이유>"`;
}
