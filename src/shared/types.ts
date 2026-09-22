/** CLI 모듈들이 함께 쓰는 도메인 타입. */

export type Locale = 'ko' | 'en';
export type Scope = 'personal' | 'company' | 'team' | 'workspace';
export type GuidanceKey =
  | 'workflow'
  | 'context'
  | 'tdd'
  | 'review'
  | 'verification'
  | 'instructions'
  | 'docs'
  | 'security'
  | 'untrusted'
  | 'language';
export type GuidanceLevel = 'off' | 'on';

/** 프로필 폴더의 `profile.json`. 스키마 버전 2만 `instructions`로 규칙 파일을 지정할 수 있다. */
export interface ProfileMetadata {
  schemaVersion: 1 | 2;
  name: string;
  scope: Scope;
  /** 프로필 폴더 기준의 규칙 파일 경로. 폴더는 `/`로 나눈다. 없으면 AGENTS.md. */
  instructions?: string;
  createdAt?: string;
  settings?: Partial<Record<GuidanceKey, GuidanceLevel>>;
  updatedAt?: string;
}

/** `profile list`가 보고하는 프로필: 메타데이터와, 연결된 경우 가리키는 폴더. */
export type ListedProfile = ProfileMetadata & { link?: string };

export interface Profile {
  profileDir: string;
  metadataPath: string;
  /** profile.json에 적힌 대로의 규칙 파일. 프로필 폴더 기준 경로. */
  instructions: string;
  instructionsPath: string;
  /** 연결된 프로필이 가리키는 폴더. 폴더가 보관함에 있는 프로필이면 null. */
  link: string | null;
  metadata: ProfileMetadata;
}

/** 프로젝트가 적용한 프로필의 Git 버전. */
export interface ProjectSource {
  /** 사용자 이름, 비밀번호, 토큰을 뺀 원격 URL. 프로필에 원격이 없으면 null. */
  git: string | null;
  branch: string | null;
  commit: string | null;
}

/** `agctx.project.json`이 적용한 프로필 버전에 대해 기록하는 것. */
export interface VersionRecord {
  source: ProjectSource | null;
  /** 프로젝트는 `profile apply --pin`이 옮기기 전까지 `source.commit`에 머문다. */
  pin: boolean;
  /** 적용한 내용에 커밋하지 않은 프로필 수정이 들어 있어서 다시 만들 수 없다. */
  uncommitted: boolean;
}

/** 프로젝트의 `agctx.project.json`. 파일을 다시 쓸 때 모르는 키도 남긴다. */
export interface ProjectConfig {
  schemaVersion?: number;
  profile?: string;
  /** AGENTS.md를 렌더링할 때 쓴 프로젝트 이름. */
  projectName?: string;
  source?: ProjectSource;
  pin?: boolean;
  uncommitted?: boolean;
  managedHashes?: Record<string, string>;
  /** JSON 설정 파일마다 agctx가 소유한 키(MCP 서버 이름). 검사는 `src/project/mcp-plan.ts`가 한다. */
  managedKeys?: unknown;
  /** 이 저장소가 받는 대상 종류(`rules`·`mcp`). 없으면 hooks를 뺀 전부다. */
  include?: unknown;
  /** 이 저장소가 고른 에이전트. 없으면 지원하는 에이전트 전부다. 검사는 `recordedAgents`가 한다. */
  agents?: unknown;
  [key: string]: unknown;
}

/**
 * `agents`는 프로젝트 AGENTS.md이고, `pointer`는 관리 블록이 있는 에이전트 파일이다. `mcp-json`·`mcp-toml`은
 * MCP 서버 설정 파일이다.
 */
export type ManagedKind = 'agents' | 'pointer' | 'mcp-json' | 'mcp-toml';

export interface Conflict {
  kind: 'missing' | 'edited';
  /** 마지막으로 쓴 관리 영역. 알 수 없으면 null. */
  base: string | null;
}

export interface PlannedFile {
  rel: string;
  kind: ManagedKind;
  target: string;
  existing: string | null;
  regenerated: string;
  currentRegion: string | null;
  nextRegion: string | null;
  conflict: Conflict | null;
  /** 고르지 않은 에이전트의 파일이라 관리 블록을 지운다. `regenerated`는 블록을 뺀 나머지다. */
  remove: boolean;
  /** agctx가 쓴 적도 없고 agctx 표지도 없는 기존 파일이라, `--adopt` 없이는 쓰지 않는다. */
  unmanaged: boolean;
}

export type ConflictedFile = PlannedFile & { conflict: Conflict };

export type ChangeStatus = 'create' | 'update' | 'remove' | 'unchanged';

export interface PlannedChange {
  target: string;
  relativePath: string;
  content: string;
  status: ChangeStatus;
}

export interface ProjectPlan {
  files: PlannedFile[];
  conflicts: ConflictedFile[];
  changes: PlannedChange[];
  /** 허락 없이 쓰지 않을, agctx 표지가 없는 기존 파일. `adopt`로 계획하면 늘 비어 있다. */
  unmanaged: PlannedFile[];
  /** 계획이 바꾸지는 않지만 사용자가 알아야 할 것. 예를 들어 AGENTS.md를 import하지 않는 CLAUDE.md. */
  warnings: string[];
}
