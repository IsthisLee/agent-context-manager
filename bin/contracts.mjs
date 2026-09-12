/**
 * User-facing Core capabilities. Every capability must be reachable through
 * the command line, the terminal UI, and the Core management menu.
 */
export const CORE_OPERATION_CONTRACT = [
  { id: 'create', cli: 'core create', tui: 'core list → 새 Core 생성', coreList: true },
  { id: 'list', cli: 'core list', tui: 'core list', coreList: true },
  { id: 'view', cli: 'core view <name>', tui: 'core list → 상세 보기', coreList: true },
  { id: 'setup', cli: 'setup', tui: 'core list → 지침 설정', coreList: true },
  { id: 'apply', cli: 'init', tui: 'core list → 프로젝트에 적용', coreList: true },
  { id: 'sync', cli: 'sync', tui: 'core list → 프로젝트 동기화', coreList: true },
  { id: 'remove', cli: 'core remove', tui: 'core list → Core 삭제', coreList: true }
];
