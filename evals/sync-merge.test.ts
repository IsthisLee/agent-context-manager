import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAgentsManagedDocument,
  extractManagedDocument,
  hashAgentsManagedDocument,
  mergeAgentsMd,
  mergeManagedDocument
} from '../src/project/analyzer.ts';
import { MANAGED_END } from '../src/project/conflicts.ts';
import { renderProfileAgents } from '../src/profile/apply.ts';
import { _ } from '../src/i18n/index.ts';

test('mergeAgentsMd는 4절 아래에 사용자가 더한 규칙을 지킨다', () => {
  const existingContent = `# Agent Guidelines for my-app

이 저장소는 프로젝트가 정한 개발 지침에 따라 개발된다.

---

## 1. 핵심 행동 규약
1. 기계 검증 우선

## 2. 프로젝트 실행 명령
* 검증: npm test

## 3. 프로젝트 기술 스택 및 핵심 제약
* 프레임워크: Next.js

## 4. 프로젝트 규칙 확장 (SSOT)

이 프로젝트에만 적용되는 도메인 규칙이나 아키텍처 제약은 오직 이 파일(\`AGENTS.md\`)의 하단이나 \`docs/\`에 추가하여 단일 정본으로 관리한다. 모든 에이전트는 이 규칙을 공통으로 따른다.

### 결제 모듈 규칙 (사용자가 추가한 커스텀 규칙)
* 토스페이먼츠 샌드박스 키를 사용할 것.
* 결제 승인 API 호출 시 멱등키(Idempotency Key)를 전송할 것.
`;

  const newTemplateContent = `# Agent Guidelines for my-app (Updated Core)

이 저장소는 프로젝트가 정한 개발 지침에 따라 개발된다.

---

## 1. 핵심 행동 규약 (필수 준수)
1. 말보다 기계의 검증 증거가 우선이다.

## 2. 프로젝트 실행 및 검사 명령
* 검증: npm test

## 3. 프로젝트 기술 스택 및 핵심 제약 (자동 감지)
* 프레임워크: Next.js (App Router)

## 4. 프로젝트 규칙 확장 (SSOT)

이 프로젝트에만 적용되는 도메인 규칙이나 아키텍처 제약은 오직 이 파일(\`AGENTS.md\`)의 하단이나 \`docs/\`에 추가하여 단일 정본으로 관리한다. 모든 에이전트는 이 규칙을 공통으로 따른다.
`;

  const merged = mergeAgentsMd(newTemplateContent, existingContent);

  // 1. 갱신한 핵심 내용이 있어야 한다
  assert.ok(merged.includes('# Agent Guidelines for my-app (Updated Core)'));
  assert.ok(merged.includes('Next.js (App Router)'));

  // 2. 사용자가 더한 규칙은 반드시 남아야 한다
  assert.ok(merged.includes('### 결제 모듈 규칙 (사용자가 추가한 커스텀 규칙)'));
  assert.ok(merged.includes('토스페이먼츠 샌드박스 키를 사용할 것.'));
  assert.ok(merged.includes('결제 승인 API 호출 시 멱등키(Idempotency Key)를 전송할 것.'));
});

test('mergeAgentsMd는 확장 영역 제목 위의 프로필 소유 영역을 다시 만든다', () => {
  // 소유 경계 계약: 사용자는 `## N. 프로젝트 규칙 확장` 제목 아래에 도메인 규칙을 더한다. 그 위는
  // 모두 프로필 소유이고 적용할 때마다 다시 만든다. 위의 테스트는 확장 영역 본문이 남는 것을 고정하고,
  // 이 테스트는 제목 위 영역이 남지 않고 바뀌는 것을 고정한다.
  // 적용된 프로젝트에서 이 영역을 손으로 고치면 AGENTS.md 드리프트 해시가 잡아내고(쓰기 전에 예외를
  // 던진다), 그래서 조용히 잃는 경우는 이미 그 제목이 있는 파일에 처음 적용할 때로 한정된다.
  const existing = [
    '# Hand-written core',
    '',
    '- A rule someone typed into the profile-owned region.',
    '',
    '## 4. 프로젝트 규칙 확장 (SSOT)',
    ''
  ].join('\n');
  const profileContent = '# Regenerated core\n\n- Profile rule.';

  const merged = mergeAgentsMd(profileContent, existing);

  assert.equal(merged, profileContent);
  assert.doesNotMatch(merged, /profile-owned region/);
});

test('AGENTS 관리 해시는 프로젝트 확장 영역을 빼고, 핵심 영역의 수정을 찾아낸다', () => {
  const document = `# Core guidance\n\n- Run checks.\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Keep the domain rule.`;
  const managed = extractAgentsManagedDocument(document);
  assert.equal(managed, '# Core guidance\n\n- Run checks.');
  assert.equal(
    hashAgentsManagedDocument(document),
    hashAgentsManagedDocument(`${managed}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Changed domain rule.`)
  );
  assert.notEqual(hashAgentsManagedDocument(document), hashAgentsManagedDocument('# Changed Core guidance'));
});

test('영어 확장 영역 제목도 한국어 제목처럼 관리 AGENTS.md 영역의 경계가 된다', () => {
  const header = '## 4. Project rule extensions (SSOT)';
  const boilerplate =
    'Add domain rules specific to this project below this section. They are not synced back to the profile.';
  const document = `# Core guidance\n\n- Run checks.\n\n${header}\n\n${boilerplate}\n\n- Keep the domain rule.`;

  assert.equal(extractAgentsManagedDocument(document), '# Core guidance\n\n- Run checks.');
  assert.equal(
    hashAgentsManagedDocument(document),
    hashAgentsManagedDocument(`# Core guidance\n\n- Run checks.\n\n${header}\n\n${boilerplate}\n`)
  );

  const merged = mergeAgentsMd(`# Core guidance v2\n\n${header}\n\n${boilerplate}\n`, document);
  assert.match(merged, /Core guidance v2/);
  assert.match(merged, /Keep the domain rule/);
  assert.equal(merged.split(boilerplate).length - 1, 1, '영어 뼈대 글이 중복되면 안 된다');
  assert.doesNotMatch(merged, /Existing project guidance/);
});

test('mergeManagedDocument는 agctx 블록만 갱신하고 사용자 수정을 지킨다', () => {
  const first = mergeManagedDocument('Generated v1', null);
  const existing = `${first}\n\n## User additions\n\nKeep this rule.\n`;
  const updated = mergeManagedDocument('Generated v2', existing);

  assert.match(updated, /Generated v2/);
  assert.doesNotMatch(updated, /Generated v1/);
  assert.match(updated, /## User additions/);
  assert.match(updated, /Keep this rule/);
  assert.equal((updated.match(/agctx:managed:start/g) || []).length, 1);
  assert.equal((updated.match(/agctx:managed:end/g) || []).length, 1);
});

const frontmatterTemplate = '---\nalwaysApply: true\n---\n\n# Generated rules v1\n';

test('mergeManagedDocument는 새 파일에서 템플릿 frontmatter를 관리 블록 밖 맨 위에 둔다', () => {
  const created = mergeManagedDocument(frontmatterTemplate, null);

  assert.ok(
    created.startsWith('---\nalwaysApply: true\n---\n'),
    '에이전트가 해석하도록 frontmatter는 첫 줄들이어야 한다'
  );
  const block = extractManagedDocument(created);
  assert.ok(block, '새 파일에 관리 블록이 있다');
  assert.doesNotMatch(block, /alwaysApply/);
  assert.match(block, /Generated rules v1/);
});

test('mergeManagedDocument는 이전 버전이 관리 블록 안에 쓴 frontmatter를 밖으로 옮긴다', () => {
  const earlier =
    '<!-- agctx:managed:start -->\n---\nalwaysApply: true\n---\n\n# Generated rules v1\n<!-- agctx:managed:end -->\n';
  const merged = mergeManagedDocument(frontmatterTemplate.replace('v1', 'v2'), earlier);

  assert.ok(merged.startsWith('---\nalwaysApply: true\n---\n'));
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
  assert.match(merged, /Generated rules v2/);
  assert.equal((merged.match(/agctx:managed:start/g) || []).length, 1);
});

test('mergeManagedDocument는 사용자가 이미 맨 위에 둔 frontmatter를 지킨다', () => {
  const existing = `---\nalwaysApply: false\n---\n\n${extractManagedDocument(mergeManagedDocument(frontmatterTemplate, null))}\n`;
  const merged = mergeManagedDocument(frontmatterTemplate.replace('v1', 'v2'), existing);

  assert.ok(merged.startsWith('---\nalwaysApply: false\n---\n'));
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
  assert.match(merged, /Generated rules v2/);
});

test('mergeManagedDocument는 frontmatter 없는 마커 없는 옛 파일의 맨 위에 템플릿 frontmatter를 더한다', () => {
  const merged = mergeManagedDocument(frontmatterTemplate, '# Existing rules\n\n- Keep this content.\n');

  assert.ok(merged.startsWith('---\nalwaysApply: true\n---\n'));
  assert.match(merged, /Keep this content/);
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
});

test('mergeManagedDocument는 마커 없는 옛 파일을 바꾸지 않고 지킨다', () => {
  const legacy = '# Existing instructions\n\n- Keep this content.\n';
  const merged = mergeManagedDocument('Generated guidance', legacy);

  assert.match(merged, /Existing instructions/);
  assert.match(merged, /Keep this content/);
  assert.match(merged, /Generated guidance/);
});

test('제목이 번호, 점, 단계를 잃어도 확장 영역 경계를 찾는다', () => {
  const managed = '# Profile: demo\n\n지침 본문\n';
  const variants = [
    '## 4. 프로젝트 규칙 확장 (SSOT)',
    '## 4 프로젝트 규칙 확장',
    '## 프로젝트 규칙 확장',
    '### 4. 프로젝트 규칙 확장 (SSOT)',
    '## Project rule extensions',
    '#### Project rule extensions (SSOT)'
  ];

  for (const heading of variants) {
    const content = `${managed}\n${heading}\n\n- 우리 팀 규칙\n`;
    assert.equal(extractAgentsManagedDocument(content), managed.trimEnd(), `경계: ${heading}`);
    assert.equal(
      hashAgentsManagedDocument(content),
      hashAgentsManagedDocument(`${managed}\n${heading}\n\n- 다른 규칙\n`),
      `프로젝트 쪽은 관리 해시를 바꾸지 않는다: ${heading}`
    );
  }
});

test('확장 영역 제목이 없는 문서는 통째로 관리되고, 호출한 쪽이 경계가 없다고 보고한다', () => {
  const content = '# Profile: demo\n\n지침 본문\n\n- 사람이 더한 줄\n';

  assert.equal(extractAgentsManagedDocument(content), content.trimEnd(), '경계가 없으면 문서 전체를 관리한다');
});

test('관리 끝 마커가 AGENTS.md의 경계가 되므로 확장 영역 제목은 사람이 마음대로 바꿔도 된다', () => {
  const managed = `# Profile: demo\n\n지침 본문\n\n${MANAGED_END}`;
  for (const heading of ['## 4. 프로젝트 규칙 확장 (SSOT)', '## 우리 팀 규칙', '### 규칙', '']) {
    const content = `${managed}\n\n${heading}\n\n- 우리 팀 규칙\n`;
    assert.equal(
      extractAgentsManagedDocument(content),
      managed,
      `무엇이 뒤따르든 마커가 영역의 경계다: ${heading || '(제목 없음)'}`
    );
    assert.equal(
      hashAgentsManagedDocument(content),
      hashAgentsManagedDocument(`${managed}\n\n${heading}\n\n- 다른 규칙\n`),
      `마커 아래를 고쳐도 해시는 그대로다: ${heading || '(제목 없음)'}`
    );
  }
});

test('마커 위에 확장 영역 제목이 있어도 마커가 이긴다', () => {
  // 자기 지침이 그 제목을 언급하는 프로필이 관리 영역을 중간에서 끊으면 안 된다.
  const content = `# Profile: demo\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n프로필이 쓴 안내\n\n${MANAGED_END}\n\n- 내 규칙\n`;
  assert.equal(
    extractAgentsManagedDocument(content),
    content.slice(0, content.indexOf(MANAGED_END) + MANAGED_END.length)
  );
});

test('마커가 생기기 전에 쓴 파일은 여전히 확장 영역 제목이 경계가 된다', () => {
  const content = '# Profile: demo\n\n지침 본문\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- 내 규칙\n';
  assert.equal(
    extractAgentsManagedDocument(content),
    '# Profile: demo\n\n지침 본문',
    'sync가 마커를 쓸 때까지 제목이 경계 역할을 한다'
  );
});

test('병합은 이름을 바꾼 제목을 포함해 마커 아래의 모든 것을 지킨다', () => {
  const rendered = `# Profile: demo v2\n\n${MANAGED_END}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n안내 한 줄\n`;
  const existing = `# Profile: demo\n\n${MANAGED_END}\n\n## 우리 팀 규칙\n\n- 배포 전에 QA를 받는다.\n`;

  const merged = mergeAgentsMd(rendered, existing);

  assert.match(merged, /# Profile: demo v2/, '프로필 영역은 다시 만든다');
  assert.match(merged, /## 우리 팀 규칙/, '이름을 바꾼 제목이 남는다');
  assert.match(merged, /배포 전에 QA를 받는다/);
  assert.doesNotMatch(merged, /안내 한 줄/, '뼈대 글은 첫 적용에만 쓴다');
  assert.equal(merged.split(MANAGED_END).length - 1, 1, '마커는 정확히 하나다');
});

test('렌더링한 프로젝트 AGENTS.md에는 관리 끝 마커가 있고 프로필 전용 지침 마커는 없다', () => {
  const profileBody =
    '# Profile: demo\n\n<!-- agctx:guidance:start -->\n\n## 작업 흐름\n\n본문\n\n<!-- agctx:guidance:end -->\n';
  const rendered = renderProfileAgents(profileBody, 'demo', 'my-app');

  assert.match(rendered, /## 작업 흐름/, '지침 글 자체는 남는다');
  assert.doesNotMatch(rendered, /agctx:guidance/, '프로필 전용 마커는 두 번째 경계로 읽힐 것이다');
  assert.equal(rendered.split(MANAGED_END).length - 1, 1);
  const heading = _('scaffold.extHeading');
  assert.ok(
    rendered.includes(heading) && rendered.indexOf(MANAGED_END) < rendered.indexOf(heading),
    '마커는 확장 영역 제목 위에 있다'
  );
  assert.equal(
    extractAgentsManagedDocument(rendered),
    rendered.slice(0, rendered.indexOf(MANAGED_END) + MANAGED_END.length)
  );
});
