const IMPLEMENTATION_RECORD_HEADING = /^#### 구현 기록: \S.*$/m;

export function requiresImplementationRecord(status: string): boolean {
  return status === 'Implemented';
}

/** A record means some contract is implemented, so the topic is at least Implementing. */
export function forbidsImplementationRecord(status: string): boolean {
  return status === 'Proposed';
}

export function hasImplementationRecord(content: string): boolean {
  return IMPLEMENTATION_RECORD_HEADING.test(content.replace(/```[\s\S]*?```/g, ''));
}
