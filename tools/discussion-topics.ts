import fs from 'node:fs';
import path from 'node:path';

/**
 * 모든 논의 주제의 상태는 JSON 파일 하나에 있다. 각 주제 문서의 상태 줄, 영역 색인, README 상태
 * 목록은 tools/generate-discussion-status.ts가 여기서 생성하므로, 상태를 바꾸는 일은 이 파일 한 곳을
 * 고치는 것이다.
 */
export const TOPICS_FILE = 'docs/discussion/topics.json';

export const STATUSES: readonly string[] = [
  'Proposed',
  'Implementing',
  'Implemented',
  'Superseded',
  'Active reference',
  'Active process'
];

export interface DiscussionTopic {
  /** 패키지 구현 계획의 단계 번호. 단계는 architecture 영역에만 있다. */
  stage?: number;
  /** `docs/discussion/<area>/topics/` 안의 파일 이름. */
  file: string;
  title: string;
  /** README.en.md에 쓰는 영어 제목. README가 나열하는 architecture 주제에는 필수다. */
  titleEn?: string;
  importance?: string;
  /** 이 주제가 기대는 단계 번호. */
  prerequisites?: number[];
  outcome: string;
  status: string;
}

/** 논의 영역별 주제. 색인 순서다. */
export type DiscussionTopics = Record<string, DiscussionTopic[]>;

export function readTopics(repoRoot: string): DiscussionTopics {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, TOPICS_FILE), 'utf8')) as DiscussionTopics;
}

/**
 * 주제 문서가 제안 요약에 적은 중요도. 예: `| 중요도 | High — 이유 |`에서 `High`. 문서는 이유를,
 * topics.json은 단계를 가지므로 검사기가 둘을 비교한다.
 */
export function summaryImportance(content: string): string | undefined {
  return content.match(/^\| 중요도 \| ([A-Za-z]+)/m)?.[1];
}

/** 주제가 갖춰야 할 필드. 없거나 타입이 틀리면 이유를 붙인다. */
export function topicFieldErrors(topic: DiscussionTopic): string[] {
  const errors: string[] = [];
  for (const field of ['file', 'title', 'outcome', 'status'] as const) {
    if (typeof topic[field] !== 'string' || !topic[field]) errors.push(`${field} must be a non-empty string`);
  }
  if (topic.stage !== undefined && !Number.isInteger(topic.stage)) errors.push('stage must be an integer');
  if (
    topic.prerequisites !== undefined &&
    !(Array.isArray(topic.prerequisites) && topic.prerequisites.every(Number.isInteger))
  ) {
    errors.push('prerequisites must be a list of stage numbers');
  }
  return errors;
}
