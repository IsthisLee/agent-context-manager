import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAgentsManagedDocument, hashAgentsManagedDocument, mergeAgentsMd, mergeManagedDocument } from '../bin/analyzer.mjs';

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

  // 1. Updated core content must be present
  assert.ok(merged.includes('# Agent Guidelines for my-app (Updated Core)'));
  assert.ok(merged.includes('Next.js (App Router)'));

  // 2. User custom rules MUST be preserved
  assert.ok(merged.includes('### 결제 모듈 규칙 (사용자가 추가한 커스텀 규칙)'));
  assert.ok(merged.includes('토스페이먼츠 샌드박스 키를 사용할 것.'));
  assert.ok(merged.includes('결제 승인 API 호출 시 멱등키(Idempotency Key)를 전송할 것.'));
});

test('AGENTS managed hash excludes the project extension and detects Core-area edits', () => {
  const document = `# Core guidance\n\n- Run checks.\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Keep the domain rule.`;
  const managed = extractAgentsManagedDocument(document);
  assert.equal(managed, '# Core guidance\n\n- Run checks.');
  assert.equal(hashAgentsManagedDocument(document), hashAgentsManagedDocument(`${managed}\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- Changed domain rule.`));
  assert.notEqual(hashAgentsManagedDocument(document), hashAgentsManagedDocument('# Changed Core guidance'));
});

test('mergeManagedDocument updates only the Agentic block and preserves user edits', () => {
  const first = mergeManagedDocument('Generated v1', null);
  const existing = `${first}\n\n## User additions\n\nKeep this rule.\n`;
  const updated = mergeManagedDocument('Generated v2', existing);

  assert.match(updated, /Generated v2/);
  assert.doesNotMatch(updated, /Generated v1/);
  assert.match(updated, /## User additions/);
  assert.match(updated, /Keep this rule/);
  assert.equal((updated.match(/agentic:managed:start/g) || []).length, 1);
  assert.equal((updated.match(/agentic:managed:end/g) || []).length, 1);
});

test('mergeManagedDocument preserves an unmarked legacy file instead of replacing it', () => {
  const legacy = '# Existing instructions\n\n- Keep this content.\n';
  const merged = mergeManagedDocument('Generated guidance', legacy);

  assert.match(merged, /Existing instructions/);
  assert.match(merged, /Keep this content/);
  assert.match(merged, /Generated guidance/);
});
