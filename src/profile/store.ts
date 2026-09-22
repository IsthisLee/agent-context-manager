import fs from 'node:fs';
import path from 'node:path';
import { say } from '../commands/output.ts';
import { _, getLocale } from '../i18n/index.ts';
import { toCliError, usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { PACKAGE_ROOT } from '../shared/runtime.ts';
import { shellWord } from '../shared/shell.ts';
import type { ListedProfile, Profile, ProfileMetadata, Scope } from '../shared/types.ts';
import { parseMcpServers, PROFILE_MCP_FILE } from '../mcp/servers.ts';
import { parseProfileArtifacts, type ProfileArtifacts } from '../artifacts/definitions.ts';
import { workingArtifactFiles } from '../artifacts/profile-files.ts';
import { describeServer } from '../mcp/targets.ts';

export const SCOPES: readonly Scope[] = ['personal', 'company', 'team', 'workspace'];

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** profile.json이 규칙 파일을 지정하지 않은 프로필의 규칙 파일. */
export const DEFAULT_INSTRUCTIONS = 'AGENTS.md';

/** 연결된 프로필이 자기 파일 대신 보관함에 두는 포인터. */
export const LINK_FILE = 'link.json';

export interface ProfileLink {
  /** 프로필이 가리키는 폴더. 절대 경로. */
  path: string;
  /** 그 폴더가 사라졌는지. 예를 들어 옮겼거나 지운 경우다. */
  broken: boolean;
  /** 마지막으로 연결할 때 폴더가 가졌던 범위와 규칙 파일. 잃은 profile.json을 원래대로 다시 쓸 수 있게 한다. */
  scope: Scope | null;
  instructions: string | null;
}

/**
 * 연결된 프로필을 쓸 수 없는 이유: 폴더가 사라졌거나, profile.json을 잃었거나, 다른 프로필의
 * profile.json을 갖고 있거나, profile.json이 가리키는 규칙 파일을 잃었다. 또는 포인터 자체를 읽을 수 없다.
 */
export type BrokenLinkReason =
  'missing-folder' | 'missing-metadata' | 'invalid-metadata' | 'missing-rules' | 'invalid-link';

export interface BrokenLink {
  name: string;
  /** 링크가 가리키는 폴더. 포인터를 읽을 수 없으면 포인터 파일 자체. */
  path: string;
  reason: BrokenLinkReason;
}

/**
 * 보관함 폴더 `dir`이 프로필이 아니라 포인터인지: link.json이 있고 profile.json이 없다. clone한
 * 저장소가 profile.json 옆에 자기 link.json을 갖고 있을 수 있는데, 그것은 여전히 프로필이다.
 */
export function isPointerFolder(dir: string): boolean {
  try {
    return fs.lstatSync(path.join(dir, LINK_FILE)).isFile() && !fs.existsSync(path.join(dir, PROFILE_METADATA_FILE));
  } catch {
    return false;
  }
}

export function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/** 파일 시스템이 보기에 `a`와 `b`가 같은 폴더인지. 대소문자까지 따진다. */
export function sameFolder(a: string, b: string): boolean {
  if (path.resolve(a) === path.resolve(b)) return true;
  try {
    return fs.realpathSync.native(a) === fs.realpathSync.native(b);
  } catch {
    return false;
  }
}

/** profile.json을 해석한 내용. JSON으로 읽을 수 없으면 null. */
export function readMetadataFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 링크를 따라갔을 때 `target`이 파일인지. 사람의 폴더에서 규칙 파일이 링크일 수 있다. */
function isFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

/**
 * 연결된 프로필이 가리키는 폴더. `name`이 보관함에 파일을 두면 null. 보관함은 운영체제 링크가 아니라
 * `link.json`만 든 폴더를 두므로, 프로필을 지워도 가리키는 폴더에 닿지 않고, 사라진 폴더도 원래
 * 경로로 알릴 수 있다.
 */
export function profileLink(name: string): ProfileLink | null {
  const dir = path.join(profileHome(), name);
  if (!isPointerFolder(dir)) return null;
  const file = path.join(dir, LINK_FILE);
  let record: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object') record = parsed as Record<string, unknown>;
  } catch {}
  const target = record?.path;
  if (record?.schemaVersion !== 1 || typeof target !== 'string' || !path.isAbsolute(target)) {
    throw usageError(
      'profile.link-invalid',
      _('error.profile.link-invalid', { name, file }),
      _('hint.profile.link-remove', { name })
    );
  }
  const instructions =
    typeof record.instructions === 'string' && isInstructionsPath(record.instructions) ? record.instructions : null;
  return {
    path: target,
    broken: !isDirectory(target),
    scope: isScope(record.scope) ? record.scope : null,
    instructions
  };
}

export interface ProfileLocation {
  /** 보관함이 프로필을 두는 방식: 자기 파일, link.json 포인터, 또는 폴더를 가리키는 운영체제 링크. */
  kind: 'folder' | 'pointer' | 'symlink';
  /** profile.json과 규칙 파일이 있는 폴더. */
  dir: string;
  /**
   * 포인터이면 가리키는 폴더, 읽을 수 없으면 포인터 파일. 폴더가 사라진 운영체제 링크이면 가리키던
   * 폴더. 보관함에서 읽은 프로필이면 null.
   */
  link: string | null;
  /** 읽을 수 있을 때의 포인터 기록. 연결할 때의 범위와 규칙 파일을 포함한다. */
  pointer: ProfileLink | null;
  /** 프로필을 쓸 수 없는 이유. 없으면 null. */
  problem: BrokenLinkReason | null;
  /** `dir`의 profile.json. 이 이름에 맞을 때만. */
  metadata: ProfileMetadata | null;
}

/** `dir`에 `name`에 맞는 profile.json과 그것이 가리키는 규칙 파일이 있는지. */
function inspectProfileFolder(dir: string, name: string): Pick<ProfileLocation, 'dir' | 'problem' | 'metadata'> {
  const metadataPath = path.join(dir, PROFILE_METADATA_FILE);
  if (!fs.existsSync(metadataPath)) return { dir, problem: 'missing-metadata', metadata: null };
  const metadata = readMetadataFile(metadataPath);
  if (!isValidProfileMetadata(metadata, name)) return { dir, problem: 'invalid-metadata', metadata: null };
  const rules = instructionsFile(metadata);
  if (!isInstructionsPath(rules) || !isFile(path.join(dir, ...rules.split('/'))))
    return { dir, problem: 'missing-rules', metadata };
  return { dir, problem: null, metadata };
}

/**
 * 프로필 `name`이 파일을 두는 곳과, 쓸 수 있는지. 프로필 폴더가 필요하거나 링크가 끊겼는지 묻는
 * 모든 호출이 여기를 거치므로 어디서나 답이 같다. 보관함에 그 이름이 없으면 null.
 */
export function profileLocation(name: string): ProfileLocation | null {
  const storeDir = path.join(profileHome(), name);
  const osLink = isSymbolicLink(storeDir);
  if (!osLink && !fs.existsSync(storeDir)) return null;
  if (osLink && !isDirectory(storeDir)) {
    // profile link가 생기기 전에 손으로 만든 운영체제 링크인데, 가리키던 폴더가 옮겨졌다.
    let target = storeDir;
    try {
      target = path.resolve(path.dirname(storeDir), fs.readlinkSync(storeDir));
    } catch {}
    return { kind: 'symlink', dir: storeDir, link: target, pointer: null, problem: 'missing-folder', metadata: null };
  }
  if (!isPointerFolder(storeDir))
    return { kind: osLink ? 'symlink' : 'folder', link: null, pointer: null, ...inspectProfileFolder(storeDir, name) };
  let pointer: ProfileLink;
  try {
    pointer = profileLink(name) as ProfileLink;
  } catch {
    return {
      kind: 'pointer',
      dir: storeDir,
      link: path.join(storeDir, LINK_FILE),
      pointer: null,
      problem: 'invalid-link',
      metadata: null
    };
  }
  if (pointer.broken)
    return {
      kind: 'pointer',
      dir: pointer.path,
      link: pointer.path,
      pointer,
      problem: 'missing-folder',
      metadata: null
    };
  return { kind: 'pointer', link: pointer.path, pointer, ...inspectProfileFolder(pointer.path, name) };
}

export interface StoreContents {
  profiles: ListedProfile[];
  /** 쓸 수 없는 링크와 그 이유. 찾고, 다시 연결하고, 지울 수 있도록 목록에 남긴다. */
  brokenLinks: BrokenLink[];
  /** 프로필도 링크도 아닌 보관함 폴더. 예를 들어 올바른 profile.json 없이 남은 폴더. */
  unreadable: string[];
}

/** 보관함의 모든 항목을 한 번 읽어 프로필, 끊긴 링크, 둘 다 아닌 폴더로 나눈다. */
export function readStore(): StoreContents {
  const home = profileHome();
  const contents: StoreContents = { profiles: [], brokenLinks: [], unreadable: [] };
  if (!fs.existsSync(home)) return contents;
  for (const name of fs.readdirSync(home).sort()) {
    if (!isProfileName(name)) continue;
    let location: ProfileLocation | null = null;
    try {
      location = profileLocation(name);
    } catch {}
    if (!location) continue;
    if (location.link) {
      if (location.problem) contents.brokenLinks.push({ name, path: location.link, reason: location.problem });
      else if (location.metadata) contents.profiles.push({ ...location.metadata, link: location.link });
    } else if (location.metadata) {
      // 규칙 파일이 없는 사본은 링크가 생기기 전처럼 목록에 남는다. 쓰려고 하면 무엇이 없는지 알려 준다.
      contents.profiles.push(location.metadata);
    } else if (isDirectory(location.dir)) {
      contents.unreadable.push(name);
    }
  }
  contents.profiles.sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`));
  return contents;
}

/**
 * 폴더를 다시 프로필 `name`으로 연결하는 명령. 포인터가 기록한 범위와 규칙 파일을 넣어서, 되살리려고
 * 지운 링크가 원래대로 돌아오게 한다.
 */
export function relinkCommand(name: string, pointer: ProfileLink | null, folder: string): string {
  return [
    'agctx profile link',
    folder,
    '--name',
    name,
    ...(pointer?.scope ? ['--scope', pointer.scope] : []),
    ...(pointer?.instructions ? ['--instructions', shellWord(pointer.instructions)] : [])
  ].join(' ');
}

/**
 * 프로필을 읽을 때마다 포인터의 범위·규칙 파일 기록을 폴더의 profile.json과 맞춘다. 그래서 잃은
 * profile.json을 되살리는 안내가 폴더에 마지막으로 있던 값을 가리킨다. 쓸 수 없는 기록은 그대로
 * 둔다. 그 안내에만 쓰는 값이기 때문이다.
 */
export function refreshPointerRecord(name: string, pointer: ProfileLink, metadata: ProfileMetadata): void {
  const instructions = instructionsFile(metadata);
  if (pointer.scope === metadata.scope && pointer.instructions === instructions) return;
  const record = { schemaVersion: 1, path: pointer.path, scope: metadata.scope, instructions };
  try {
    writeTextAtomic(path.join(profileHome(), name, LINK_FILE), JSON.stringify(record, null, 2) + '\n');
  } catch {}
}

/** 끊긴 링크 `name`을 되살리려면 실행할 명령. 쓸 수 있는 링크이면 null. */
export function brokenLinkHint(name: string): string | null {
  try {
    readProfile(name);
    return null;
  } catch (error) {
    return toCliError(error).hint;
  }
}

/** 연결된 프로필이 가리키는 폴더의 Git 이력이나 설정을 옮길 명령을 거부한다. */
export function assertNotLinked(name: string): void {
  const link = profileLink(name);
  if (link)
    throw usageError(
      'profile.linked-git',
      _('error.profile.linked-git', { name, path: link.path }),
      _('hint.profile.linked-git', { path: shellWord(link.path) })
    );
}

export function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && (SCOPES as readonly string[]).includes(value);
}

/** `name`을 프로필 이름으로 쓸 수 있는지: 소문자, 숫자, 하이픈으로 1~64자이고 문자나 숫자로 시작한다. */
export function isProfileName(name: string): boolean {
  return PROFILE_NAME.test(name);
}

export function validateProfileName(name: string | null | undefined): asserts name is string {
  if (!name || !isProfileName(name)) {
    throw usageError(
      'profile.invalid-name',
      _('error.profile.invalid-name', { name: name ?? '' }),
      _('hint.profile.name')
    );
  }
}

export function isValidProfileMetadata(
  metadata: unknown,
  expectedName: string | null = null
): metadata is ProfileMetadata {
  if (!metadata || typeof metadata !== 'object') return false;
  const record = metadata as Record<string, unknown>;
  // `instructions`를 아는 agctx는 규칙 파일을 지정하는 profile.json에 버전 2를 요구한다. 그래서 옛
  // agctx는 루트 AGENTS.md를 조용히 적용하지 않고 거부한다.
  const version =
    record.schemaVersion === 1
      ? record.instructions === undefined
      : record.schemaVersion === 2 && (record.instructions === undefined || typeof record.instructions === 'string');
  return (
    version &&
    typeof record.name === 'string' &&
    (!expectedName || record.name === expectedName) &&
    PROFILE_NAME.test(record.name) &&
    isScope(record.scope)
  );
}

/** profile.json이 가리키는 규칙 파일. 프로필 폴더 기준 경로. */
export function instructionsFile(metadata: ProfileMetadata): string {
  return metadata.instructions ?? DEFAULT_INSTRUCTIONS;
}

/**
 * `instructions` 값이 저장소 안의 Markdown 파일을 가리키는지: 상대 경로이고, 폴더를 `/`로 나누고,
 * 빈 부분이나 `.`·`..`이 없고, `.git` 밖에 있어야 한다.
 */
export function isInstructionsPath(file: string): boolean {
  const parts = file.split('/');
  return (
    !file.includes('\\') &&
    !path.isAbsolute(file) &&
    !/^[a-z]:/i.test(file) &&
    parts.every(part => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git') &&
    /\.md$/i.test(file)
  );
}

export function assertInstructionsPath(file: string, source: string): void {
  if (!isInstructionsPath(file)) {
    throw usageError(
      'profile.instructions-path',
      _('error.profile.instructions-path', { source, file }),
      _('hint.profile.instructions')
    );
  }
}

/**
 * `dir` 안에서 `file`이 가리키는 파일. 없거나, 일반 파일이 아니거나, 심볼릭 링크를 거쳐 닿으면 null.
 * 원격에서 온 내용을 등록하기 전에 쓴다.
 */
export function regularFileInside(dir: string, file: string): string | null {
  const parts = file.split('/');
  let current = dir;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) return null;
  }
  return current;
}

export function readProfile(name: string): Profile {
  validateProfileName(name);
  const location = profileLocation(name);
  if (!location) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  const { dir: profileDir, link, problem, metadata } = location;
  const metadataPath = path.join(profileDir, PROFILE_METADATA_FILE);
  // 읽을 수 없는 포인터는 그 사실과, 다시 연결하거나 지우는 방법을 스스로 알린다.
  if (problem === 'invalid-link') profileLink(name);
  if (problem === 'missing-folder') {
    throw usageError(
      'profile.link-broken',
      _('error.profile.link-broken', { name, path: link ?? profileDir }),
      _('hint.profile.link-broken', { name, command: relinkCommand(name, location.pointer, '<new path>') })
    );
  }
  if (problem === 'missing-metadata') {
    if (!link) throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
    throw usageError(
      'profile.link-metadata-missing',
      _('error.profile.link-metadata-missing', { name, path: profileDir }),
      _('hint.profile.link-metadata-missing', {
        name,
        path: shellWord(profileDir),
        command: relinkCommand(name, location.pointer, shellWord(profileDir))
      })
    );
  }
  if (!metadata) {
    if (!link)
      throw usageError(
        'profile.invalid-metadata',
        _('error.profile.invalid-metadata', { name, file: metadataPath }),
        null
      );
    throw usageError(
      'profile.link-metadata-other',
      _('error.profile.link-metadata-other', { name, path: profileDir, file: metadataPath }),
      _('hint.profile.link-metadata-other', { name, file: metadataPath })
    );
  }
  const instructions = instructionsFile(metadata);
  assertInstructionsPath(instructions, metadataPath);
  // 보관함은 사용자 자신의 폴더이므로, 다른 곳에서 연결해 온 규칙 파일도 여기서는 쓸 수 있다. 원격
  // 내용은 여기 오기 전에 clone과 pull이 링크를 검사한다.
  const instructionsPath = path.join(profileDir, ...instructions.split('/'));
  if (problem === 'missing-rules') {
    if (link)
      throw usageError(
        'profile.link-rules-missing',
        _('error.profile.link-rules-missing', { name, path: profileDir, file: instructions }),
        _('hint.profile.link-rules-missing', { file: metadataPath })
      );
    if (metadata.instructions === undefined)
      throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
    throw usageError(
      'profile.instructions-missing',
      _('error.profile.instructions-missing', { source: metadataPath, file: instructions }),
      _('hint.profile.instructions')
    );
  }
  if (location.pointer) refreshPointerRecord(name, location.pointer, metadata);
  return { profileDir, metadataPath, instructions, instructionsPath, metadata, link };
}

export function createProfile(name: string, scope: string = 'personal'): ProfileMetadata {
  validateProfileName(name);
  if (!isScope(scope))
    throw usageError(
      'profile.invalid-scope',
      _('error.profile.invalid-scope', { scope, scopes: SCOPES.join(', ') }),
      null
    );
  const profileDir = path.join(profileHome(), name);
  if (fs.existsSync(profileDir))
    throw usageError('profile.exists', _('error.profile.exists', { name }), _('hint.profile.view', { name }));
  fs.mkdirSync(profileDir, { recursive: true });
  const metadata: ProfileMetadata = { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() };
  writeTextAtomic(path.join(profileDir, PROFILE_METADATA_FILE), JSON.stringify(metadata, null, 2) + '\n');
  const profileTemplate = fs.readFileSync(
    path.join(PACKAGE_ROOT, getLocale() === 'ko' ? 'templates/profile/AGENTS.ko.md' : 'templates/profile/AGENTS.md'),
    'utf8'
  );
  writeTextAtomic(path.join(profileDir, DEFAULT_INSTRUCTIONS), profileTemplate.replaceAll('{{PROFILE_NAME}}', name));
  say(_('create.done', { name, scope }));
  return metadata;
}

export function getProfiles(): ListedProfile[] {
  return readStore().profiles;
}

export function removeProfile(name: string): void {
  validateProfileName(name);
  // 보관함 폴더만 지운다. 링크라면 포인터만 지우고, 가리키는 폴더는 절대 지우지 않는다. 올바른
  // 프로필이 아닌 보관함 폴더도 지울 수 있다. link와 clone이 이름을 비우라고 이렇게 안내하기 때문이다.
  const storeDir = path.join(profileHome(), name);
  if (!fs.existsSync(storeDir) && !isSymbolicLink(storeDir))
    throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  fs.rmSync(storeDir, { recursive: true, force: true });
  say(_('remove.done', { name }));
}

export function viewProfile(name: string): {
  name: string;
  scope: Scope;
  instructions: string;
  mcpServers: string[] | null;
  skills: string[];
  subagents: string[];
  hooks: string[] | null;
} {
  const profile = readProfile(name);
  const instructions = fs.readFileSync(profile.instructionsPath, 'utf8').trim();
  say(`${profile.metadata.name}\t${profile.metadata.scope}`);
  say(instructions);
  const mcpPath = path.join(profile.profileDir, PROFILE_MCP_FILE);
  let servers: ReturnType<typeof parseMcpServers> | null = null;
  try {
    servers = fs.existsSync(mcpPath) ? parseMcpServers(fs.readFileSync(mcpPath, 'utf8'), mcpPath) : null;
  } catch (error) {
    // 보기는 읽기만 하므로, 잘못된 mcp.json 때문에 지침까지 못 보게 하지 않는다.
    say(`\n${_('view.mcp-invalid', { detail: error instanceof Error ? error.message : String(error) })}`);
  }
  if (servers)
    say(
      `\n${_('view.mcp', {
        servers:
          Object.entries(servers)
            .map(([server, spec]) => describeServer(server, spec))
            .join(', ') || '-'
      })}`
    );
  let artifacts: ProfileArtifacts | null = null;
  try {
    artifacts = parseProfileArtifacts(workingArtifactFiles(profile.profileDir));
  } catch (error) {
    say(`\n${_('view.artifacts-invalid', { detail: error instanceof Error ? error.message : String(error) })}`);
  }
  if (artifacts?.skills.length)
    say(`\n${_('view.skills', { names: artifacts.skills.map(skill => skill.name).join(', ') })}`);
  if (artifacts?.subagents.length)
    say(`\n${_('view.subagents', { names: artifacts.subagents.map(definition => definition.name).join(', ') })}`);
  if (artifacts?.hooks)
    say(`\n${_('view.hooks', { names: artifacts.hooks.map(hook => hook.name).join(', ') || '-' })}`);
  return {
    name: profile.metadata.name,
    scope: profile.metadata.scope,
    instructions,
    mcpServers: servers ? Object.keys(servers) : null,
    skills: artifacts?.skills.map(skill => skill.name) ?? [],
    subagents: artifacts?.subagents.map(definition => definition.name) ?? [],
    hooks: artifacts?.hooks ? artifacts.hooks.map(hook => hook.name) : null
  };
}

export function selectProfile(selection: string | undefined, profiles: ListedProfile[] = getProfiles()): string {
  if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
  const index = Number.parseInt(selection ?? '', 10);
  const selected =
    Number.isInteger(index) && index >= 1 ? profiles[index - 1] : profiles.find(profile => profile.name === selection);
  if (!selected)
    throw usageError(
      'profile.not-found',
      _('error.profile.not-found', { name: selection ?? '' }),
      _('hint.profile.list')
    );
  return selected.name;
}
