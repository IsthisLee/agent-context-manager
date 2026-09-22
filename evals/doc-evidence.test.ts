import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adrEvidenceError, undatedReferenceLinkLines } from '../tools/doc-evidence.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('외부 링크가 있는 참고 줄은 코드 블록 밖에서 확인일을 붙여야 한다', () => {
  const content = [
    '- Dated claim. [Doc](https://example.com) (확인일: 2026-09-14)',
    '- Undated claim. [Doc](https://example.com/a)',
    '| [Tool](https://github.com/x) | row | (확인일: 2026-09-14) |',
    '| [Tool](https://github.com/y) | row |',
    '- Internal link only. [ADR](adr/0001-product-scope.md)',
    '> "Quoted text without a link."',
    '```markdown',
    '- [Example in code](https://example.com/in-code)',
    '```',
    '- Malformed date. [Doc](https://example.com/b) (확인일: 2026-9-14)'
  ].join('\n');

  assert.deepEqual(undatedReferenceLinkLines(content), [2, 4, 10]);
});

const adr = (evidenceField: string) =>
  [
    '# 0000. Title',
    '',
    '* **상태:** 채택됨 (Accepted)',
    '* **결정자:** 개발자',
    ...(evidenceField ? [evidenceField] : []),
    '',
    '## 배경 (Context)',
    ''
  ].join('\n');

test('0009 전의 ADR은 근거 머리말 필드가 필요 없다', () => {
  assert.equal(adrEvidenceError('0008-earlier-decision.md', adr('')), null);
});

test('0009부터의 ADR은 근거 머리말 필드가 필요하다', () => {
  assert.match(adrEvidenceError('0009-new-decision.md', adr('')) ?? '', /근거/);
});

test('ADR 근거 필드는 references 링크, 외부 링크, 외부 근거가 없다는 이유를 받는다', () => {
  assert.equal(
    adrEvidenceError('0009-new-decision.md', adr('* **근거:** [외부 참고 문헌](../references.md#section)')),
    null
  );
  assert.equal(
    adrEvidenceError('0010-new-decision.md', adr('* **근거:** [Official docs](https://example.com/docs)')),
    null
  );
  assert.equal(
    adrEvidenceError('0010-new-decision.md', adr('* **근거:** 외부 근거 없음: 저장소 내부 설계만 바꾸는 결정이다.')),
    null
  );
  assert.equal(
    adrEvidenceError(
      '0010-new-decision.md',
      adr('* **Evidence:** No external evidence: internal refactoring decision.')
    ),
    null
  );
});

test('링크도 이유도 없는 ADR 근거 필드는 거부한다', () => {
  assert.match(adrEvidenceError('0010-new-decision.md', adr('* **근거:** 외부 근거 없음')) ?? '', /근거/);
  assert.match(adrEvidenceError('0010-new-decision.md', adr('* **근거:** 공식 문서')) ?? '', /근거/);
});

test('문서 검사기는 references.md와 ADR에 근거 규칙을 적용한다', () => {
  const checker = fs.readFileSync(path.join(repoRoot, 'tools/check-docs.ts'), 'utf8');

  assert.match(checker, /undatedReferenceLinkLines/);
  assert.match(checker, /adrEvidenceError/);
});
