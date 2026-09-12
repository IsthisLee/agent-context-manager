import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAgentsMd } from '../bin/analyzer.mjs';

test('mergeAgentsMd preserves user custom rules under section 4', () => {
  const existingContent = `# Agent Guidelines for my-app

이 저장소는 결정론적 TDD 원칙에 따라 개발된다.

---

## 1. 핵심 행동 규약
1. 기계 검증 우선

## 2. 프로젝트 실행 명령
* 진단: node tools/agentic/doctor.mjs

## 3. 프로젝트 기술 스택 및 핵심 제약
* 프레임워크: Next.js

## 4. 프로젝트 규칙 확장 (SSOT)

이 프로젝트에만 적용되는 도메인 규칙이나 아키텍처 제약은 오직 이 파일(\`AGENTS.md\`)의 하단이나 \`docs/\`에 추가하여 단일 정본으로 관리한다. 모든 에이전트는 이 규칙을 공통으로 따른다.

### 결제 모듈 규칙 (사용자가 추가한 커스텀 규칙)
* 토스페이먼츠 샌드박스 키를 사용할 것.
* 결제 승인 API 호출 시 멱등키(Idempotency Key)를 전송할 것.
`;

  const newTemplateContent = `# Agent Guidelines for my-app (Updated Core)

이 저장소는 결정론적 TDD 원칙에 따라 개발된다.

---

## 1. 핵심 행동 규약 (필수 준수)
1. 말보다 기계의 검증 증거가 우선이다.

## 2. 프로젝트 실행 및 검사 명령
* 환경 및 지침 진단: node tools/agentic/doctor.mjs

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
