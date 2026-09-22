const IMPLEMENTATION_RECORD_HEADING = /^#### 구현 기록: \S.*$/m;

export function requiresImplementationRecord(status: string): boolean {
  return status === 'Implemented';
}

/** 기록이 있다는 것은 어떤 계약이 구현됐다는 뜻이므로, 주제는 적어도 Implementing이다. */
export function forbidsImplementationRecord(status: string): boolean {
  return status === 'Proposed';
}

export function hasImplementationRecord(content: string): boolean {
  return IMPLEMENTATION_RECORD_HEADING.test(content.replace(/```[\s\S]*?```/g, ''));
}
