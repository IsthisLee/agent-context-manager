import fs from 'node:fs';
import path from 'node:path';

/**
 * The status of every discussion topic lives in one JSON file. The status line
 * of each topic document, the area indexes and the README status lists are
 * generated from it by tools/generate-discussion-status.ts, so a status change
 * is one edit to this file.
 */
export const TOPICS_FILE = 'docs/discussion/topics.json';

export const STATUSES: readonly string[] = ['Proposed', 'Implementing', 'Implemented', 'Superseded', 'Active reference', 'Active process'];

export interface DiscussionTopic {
  /** Stage number in the package implementation plan; only the architecture area has stages. */
  stage?: number;
  /** File name inside `docs/discussion/<area>/topics/`. */
  file: string;
  title: string;
  /** English title for README.en.md; required for architecture topics the README lists. */
  titleEn?: string;
  importance?: string;
  /** Stage numbers this topic depends on. */
  prerequisites?: number[];
  outcome: string;
  status: string;
}

/** Topics keyed by discussion area, in index order. */
export type DiscussionTopics = Record<string, DiscussionTopic[]>;

export function readTopics(repoRoot: string): DiscussionTopics {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, TOPICS_FILE), 'utf8')) as DiscussionTopics;
}

/** Fields a topic must carry, with a reason when one is missing or has the wrong type. */
export function topicFieldErrors(topic: DiscussionTopic): string[] {
  const errors: string[] = [];
  for (const field of ['file', 'title', 'outcome', 'status'] as const) {
    if (typeof topic[field] !== 'string' || !topic[field]) errors.push(`${field} must be a non-empty string`);
  }
  if (topic.stage !== undefined && !Number.isInteger(topic.stage)) errors.push('stage must be an integer');
  if (topic.prerequisites !== undefined && !(Array.isArray(topic.prerequisites) && topic.prerequisites.every(Number.isInteger))) {
    errors.push('prerequisites must be a list of stage numbers');
  }
  return errors;
}
