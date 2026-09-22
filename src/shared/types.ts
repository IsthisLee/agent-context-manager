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
  [key: string]: unknown;
}

/** `agents`는 프로젝트 AGENTS.md이고, `pointer`는 관리 블록이 있는 에이전트 파일이다. */
export type ManagedKind = 'agents' | 'pointer';

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
}

export type ConflictedFile = PlannedFile & { conflict: Conflict };

export type ChangeStatus = 'create' | 'update' | 'unchanged';

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
  /** 계획이 바꾸지는 않지만 사용자가 알아야 할 것. 예를 들어 AGENTS.md를 import하지 않는 CLAUDE.md. */
  warnings: string[];
}
