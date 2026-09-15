const IMPLEMENTATION_RECORD_HEADING = /^#### 구현 기록: \S.*$/m;

export function requiresImplementationRecord(status: string): boolean {
  return status === 'Implemented';
}

export function hasImplementationRecord(content: string): boolean {
  return IMPLEMENTATION_RECORD_HEADING.test(content.replace(/```[\s\S]*?```/g, ''));
}
