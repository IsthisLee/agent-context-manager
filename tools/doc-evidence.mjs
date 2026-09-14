// Evidence rules for documentation that records facts from outside the
// repository. External sources change without notice, so every external link
// in references.md carries the date its claim was checked, and newer ADRs state
// where their evidence lives or that they rely on none.

const EXTERNAL_LINK = /\]\(\s*<?https?:\/\//i;
const CHECKED_DATE = /확인일:\s*\d{4}-\d{2}-\d{2}\b/;
const CODE_FENCE = /^\s*(```|~~~)/;

/** The first ADR number that must carry the evidence header field. */
export const EVIDENCE_REQUIRED_FROM_ADR = 9;
const EVIDENCE_FIELD = /^\s*[*-]?\s*\*\*(?:근거|Evidence):\*\*[ \t]*(.*)$/m;
const MARKDOWN_LINK = /\]\([^)\s]+\)/;
const NO_EXTERNAL_EVIDENCE = /^(?:외부 근거 없음|No external evidence)\s*:\s*\S/i;

/**
 * 1-based line numbers of lines that cite an external link without a 확인일.
 * Fenced code blocks are skipped because they show examples, not claims.
 * @param {string} content
 * @returns {number[]}
 */
export function undatedReferenceLinkLines(content) {
  const undated = [];
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
 * Error message when an ADR from EVIDENCE_REQUIRED_FROM_ADR on lacks an evidence
 * field holding a link or a stated reason for having no external evidence.
 * @param {string} fileName - e.g. `0009-agent-rule-frontmatter.md`
 * @param {string} content
 * @returns {string|null}
 */
export function adrEvidenceError(fileName, content) {
  const number = Number.parseInt(fileName.slice(0, 4), 10);
  if (!(number >= EVIDENCE_REQUIRED_FROM_ADR)) return null;
  const value = content.match(EVIDENCE_FIELD)?.[1]?.trim() ?? '';
  if (MARKDOWN_LINK.test(value) || NO_EXTERNAL_EVIDENCE.test(value)) return null;
  return `docs/adr/${fileName}: ADR header field (근거) needs a link or "외부 근거 없음: <이유>"`;
}
