/** One user-facing capability and the interface paths that must reach it. */
export interface ProfileOperation {
  id: string;
  cli: string;
  tui: string;
  profileList: true;
}

/**
 * User-facing Guidance Profile capabilities. Every capability must be reachable
 * through the command line, the terminal UI, and the profile management menu.
 */
export const PROFILE_OPERATION_CONTRACT: readonly ProfileOperation[] = [
  { id: 'create', cli: 'profile create', tui: 'profile list → 새 프로필 생성', profileList: true },
  { id: 'list', cli: 'profile list', tui: 'profile list', profileList: true },
  { id: 'view', cli: 'profile view <name>', tui: 'profile list → 상세 보기', profileList: true },
  { id: 'setup', cli: 'profile setup <name>', tui: 'profile list → 지침 설정', profileList: true },
  { id: 'apply', cli: 'profile apply <name> <project>', tui: 'profile list → 프로젝트에 적용', profileList: true },
  { id: 'sync', cli: 'profile sync <project>', tui: 'profile list → 프로젝트 동기화', profileList: true },
  { id: 'resolve', cli: 'profile resolve <project>', tui: 'profile list → 프로젝트 충돌 해결', profileList: true },
  { id: 'remove', cli: 'profile remove', tui: 'profile list → 프로필 삭제', profileList: true }
];
