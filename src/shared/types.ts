/** Domain types shared across the CLI modules. */

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

/** `profile.json` in a profile folder. Only schema version 2 may name the rules file with `instructions`. */
export interface ProfileMetadata {
  schemaVersion: 1 | 2;
  name: string;
  scope: Scope;
  /** The rules file relative to the profile folder, folders separated by `/`. AGENTS.md when absent. */
  instructions?: string;
  createdAt?: string;
  settings?: Partial<Record<GuidanceKey, GuidanceLevel>>;
  updatedAt?: string;
}

/** A profile as `profile list` reports it: its metadata, and the folder it points at when it is linked. */
export type ListedProfile = ProfileMetadata & { link?: string };

export interface Profile {
  profileDir: string;
  metadataPath: string;
  /** The rules file relative to the profile folder, as profile.json names it. */
  instructions: string;
  instructionsPath: string;
  /** The folder a linked profile points at; null for a profile whose folder is in the store. */
  link: string | null;
  metadata: ProfileMetadata;
}

/** The Git version of the profile a project was applied from. */
export interface ProjectSource {
  /** Remote URL without user names, passwords, or tokens; null when the profile has no remote. */
  git: string | null;
  branch: string | null;
  commit: string | null;
}

/** What `agctx.project.json` records about the applied profile version. */
export interface VersionRecord {
  source: ProjectSource | null;
  /** The project stays on `source.commit` until `profile apply --pin` moves it. */
  pin: boolean;
  /** The applied content included profile edits that were not committed, so it cannot be reproduced. */
  uncommitted: boolean;
}

/** `agctx.project.json` in a project. Unknown keys are kept when the file is rewritten. */
export interface ProjectConfig {
  schemaVersion?: number;
  profile?: string;
  /** The project name AGENTS.md was rendered with. */
  projectName?: string;
  source?: ProjectSource;
  pin?: boolean;
  uncommitted?: boolean;
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
  /** Things the plan does not change but the user should know, such as a CLAUDE.md that does not import its AGENTS.md. */
  warnings: string[];
}
