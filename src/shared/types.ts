/** Domain types shared across the CLI modules. */

export type Locale = 'ko' | 'en';
export type Scope = 'personal' | 'company' | 'team' | 'workspace';
export type GuidanceKey = 'harness' | 'tdd' | 'review' | 'verification' | 'documentation' | 'security';
export type GuidanceLevel = 'off' | 'recommended' | 'strict';

/** `profile.json` in a profile folder. */
export interface ProfileMetadata {
  schemaVersion: 1;
  name: string;
  scope: Scope;
  createdAt?: string;
  settings?: Partial<Record<GuidanceKey, GuidanceLevel>>;
  updatedAt?: string;
}

export interface Profile {
  profileDir: string;
  metadataPath: string;
  instructionsPath: string;
  metadata: ProfileMetadata;
}

/** `agctx.project.json` in a project. Unknown keys are kept when the file is rewritten. */
export interface ProjectConfig {
  schemaVersion?: number;
  profile?: string;
  managedHashes?: Record<string, string>;
  [key: string]: unknown;
}

/** `agents` is the project AGENTS.md; `pointer` is an agent file with a managed block. */
export type ManagedKind = 'agents' | 'pointer';

export interface Conflict {
  kind: 'missing' | 'edited';
  /** The managed area as last written, or null when it cannot be known. */
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
}
