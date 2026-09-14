const IMPLEMENTATION_RECORD_HEADING = /^#### 구현 기록: \S.*$/m;

export function requiresImplementationRecord(status) {
  return status === 'Implemented';
}

export function hasImplementationRecord(content) {
  return IMPLEMENTATION_RECORD_HEADING.test(content.replace(/```[\s\S]*?```/g, ''));
}
