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

test('mergeAgentsMd preserves user custom rules under section 4', () => {
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

test('mergeAgentsMd regenerates the profile-owned region above the extension header', () => {
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

test('AGENTS managed hash excludes the project extension and detects Core-area edits', () => {
  const document = `# Core guidance\n\n- Run checks.\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Keep the domain rule.`;
  const managed = extractAgentsManagedDocument(document);
  assert.equal(managed, '# Core guidance\n\n- Run checks.');
  assert.equal(
    hashAgentsManagedDocument(document),
    hashAgentsManagedDocument(`${managed}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Changed domain rule.`)
  );
  assert.notEqual(hashAgentsManagedDocument(document), hashAgentsManagedDocument('# Changed Core guidance'));
});

test('the English extension header bounds the managed AGENTS.md region like the Korean one', () => {
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
  assert.equal(merged.split(boilerplate).length - 1, 1, 'the English boilerplate must not be duplicated');
  assert.doesNotMatch(merged, /Existing project guidance/);
});

test('mergeManagedDocument updates only the agctx block and preserves user edits', () => {
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

test('mergeManagedDocument keeps template frontmatter at the top of a new file, outside the managed block', () => {
  const created = mergeManagedDocument(frontmatterTemplate, null);

  assert.ok(
    created.startsWith('---\nalwaysApply: true\n---\n'),
    'frontmatter must be the first lines so the agent parses it'
  );
  const block = extractManagedDocument(created);
  assert.ok(block, 'the new file has a managed block');
  assert.doesNotMatch(block, /alwaysApply/);
  assert.match(block, /Generated rules v1/);
});

test('mergeManagedDocument moves frontmatter out of a managed block written by an earlier version', () => {
  const earlier =
    '<!-- agctx:managed:start -->\n---\nalwaysApply: true\n---\n\n# Generated rules v1\n<!-- agctx:managed:end -->\n';
  const merged = mergeManagedDocument(frontmatterTemplate.replace('v1', 'v2'), earlier);

  assert.ok(merged.startsWith('---\nalwaysApply: true\n---\n'));
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
  assert.match(merged, /Generated rules v2/);
  assert.equal((merged.match(/agctx:managed:start/g) || []).length, 1);
});

test('mergeManagedDocument keeps frontmatter the user already has at the top', () => {
  const existing = `---\nalwaysApply: false\n---\n\n${extractManagedDocument(mergeManagedDocument(frontmatterTemplate, null))}\n`;
  const merged = mergeManagedDocument(frontmatterTemplate.replace('v1', 'v2'), existing);

  assert.ok(merged.startsWith('---\nalwaysApply: false\n---\n'));
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
  assert.match(merged, /Generated rules v2/);
});

test('mergeManagedDocument adds template frontmatter to the top of an unmarked legacy file without it', () => {
  const merged = mergeManagedDocument(frontmatterTemplate, '# Existing rules\n\n- Keep this content.\n');

  assert.ok(merged.startsWith('---\nalwaysApply: true\n---\n'));
  assert.match(merged, /Keep this content/);
  assert.equal((merged.match(/alwaysApply/g) || []).length, 1);
});

test('mergeManagedDocument preserves an unmarked legacy file instead of replacing it', () => {
  const legacy = '# Existing instructions\n\n- Keep this content.\n';
  const merged = mergeManagedDocument('Generated guidance', legacy);

  assert.match(merged, /Existing instructions/);
  assert.match(merged, /Keep this content/);
  assert.match(merged, /Generated guidance/);
});

test('the extension boundary is found even when the heading lost its number, dot or level', () => {
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
    assert.equal(extractAgentsManagedDocument(content), managed.trimEnd(), `boundary: ${heading}`);
    assert.equal(
      hashAgentsManagedDocument(content),
      hashAgentsManagedDocument(`${managed}\n${heading}\n\n- 다른 규칙\n`),
      `the project side does not change the managed hash: ${heading}`
    );
  }
});

test('a document with no extension heading is managed as a whole, which the caller reports as a missing boundary', () => {
  const content = '# Profile: demo\n\n지침 본문\n\n- 사람이 더한 줄\n';

  assert.equal(
    extractAgentsManagedDocument(content),
    content.trimEnd(),
    'without a boundary the whole document is managed'
  );
});

test("the managed end marker bounds AGENTS.md, so the extension heading is the person's to rename", () => {
  const managed = `# Profile: demo\n\n지침 본문\n\n${MANAGED_END}`;
  for (const heading of ['## 4. 프로젝트 규칙 확장 (SSOT)', '## 우리 팀 규칙', '### 규칙', '']) {
    const content = `${managed}\n\n${heading}\n\n- 우리 팀 규칙\n`;
    assert.equal(
      extractAgentsManagedDocument(content),
      managed,
      `the marker bounds the area whatever follows it: ${heading || '(제목 없음)'}`
    );
    assert.equal(
      hashAgentsManagedDocument(content),
      hashAgentsManagedDocument(`${managed}\n\n${heading}\n\n- 다른 규칙\n`),
      `editing below the marker leaves the hash alone: ${heading || '(제목 없음)'}`
    );
  }
});

test('the marker wins over an extension heading that appears above it', () => {
  // 자기 지침이 그 제목을 언급하는 프로필이 관리 영역을 중간에서 끊으면 안 된다.
  const content = `# Profile: demo\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n프로필이 쓴 안내\n\n${MANAGED_END}\n\n- 내 규칙\n`;
  assert.equal(
    extractAgentsManagedDocument(content),
    content.slice(0, content.indexOf(MANAGED_END) + MANAGED_END.length)
  );
});

test('a file written before the marker existed is still bounded by its extension heading', () => {
  const content = '# Profile: demo\n\n지침 본문\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- 내 규칙\n';
  assert.equal(
    extractAgentsManagedDocument(content),
    '# Profile: demo\n\n지침 본문',
    'the heading keeps working until sync writes the marker'
  );
});

test('merging keeps everything below the marker, including a renamed heading', () => {
  const rendered = `# Profile: demo v2\n\n${MANAGED_END}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n안내 한 줄\n`;
  const existing = `# Profile: demo\n\n${MANAGED_END}\n\n## 우리 팀 규칙\n\n- 배포 전에 QA를 받는다.\n`;

  const merged = mergeAgentsMd(rendered, existing);

  assert.match(merged, /# Profile: demo v2/, 'the profile area is regenerated');
  assert.match(merged, /## 우리 팀 규칙/, 'the renamed heading survives');
  assert.match(merged, /배포 전에 QA를 받는다/);
  assert.doesNotMatch(merged, /안내 한 줄/, 'the scaffold text is only for a first apply');
  assert.equal(merged.split(MANAGED_END).length - 1, 1, 'exactly one marker');
});

test('a rendered project AGENTS.md carries the managed end marker and drops the profile-only guidance markers', () => {
  const profileBody =
    '# Profile: demo\n\n<!-- agctx:guidance:start -->\n\n## 작업 흐름\n\n본문\n\n<!-- agctx:guidance:end -->\n';
  const rendered = renderProfileAgents(profileBody, 'demo', 'my-app');

  assert.match(rendered, /## 작업 흐름/, 'the guidance text itself stays');
  assert.doesNotMatch(rendered, /agctx:guidance/, 'the profile-only markers would read as a second boundary');
  assert.equal(rendered.split(MANAGED_END).length - 1, 1);
  const heading = _('scaffold.extHeading');
  assert.ok(
    rendered.includes(heading) && rendered.indexOf(MANAGED_END) < rendered.indexOf(heading),
    'the marker sits above the extension heading'
  );
  assert.equal(
    extractAgentsManagedDocument(rendered),
    rendered.slice(0, rendered.indexOf(MANAGED_END) + MANAGED_END.length)
  );
});
