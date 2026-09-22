import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { usageError } from '../shared/errors.ts';
import { isSymbolicLink, writeTextAtomic } from '../shared/fs-utils.ts';
import { git } from '../shared/git.ts';
import { PROFILE_METADATA_FILE, profileHome } from '../shared/home.ts';
import { shellWord } from '../shared/shell.ts';
import { MANAGED_END } from '../project/conflicts.ts';
import type { ProfileMetadata, Scope } from '../shared/types.ts';
import {
  assertInstructionsPath,
  brokenLinkHint,
  DEFAULT_INSTRUCTIONS,
  instructionsFile,
  isDirectory,
  isInstructionsPath,
  isProfileName,
  isScope,
  isValidProfileMetadata,
  LINK_FILE,
  profileLocation,
  readMetadataFile,
  readStore,
  regularFileInside,
  sameFolder,
  SCOPES,
  validateProfileName
} from './store.ts';

/**
 * `profile link`는 이 컴퓨터에 이미 있는 규칙 저장소 폴더를 프로필로 만든다. 폴더에 profile.json이
 * 없으면 쓰고, 보관함에는 그 폴더를 가리키는 포인터를 둬서 폴더를 있는 그대로 적용한다. 커밋이나
 * push는 하지 않는다. 나누는 일은 여전히 Git과 `profile clone`으로 한다.
 */

/** 프로필이 적용할 규칙이 들어 있을 리 없는 폴더: 의존성과 빌드 결과. 숨은 폴더도 건너뛴다. */
const SKIPPED = new Set(['node_modules', 'vendor', 'dist', 'build']);

/** AGENTS.md를 찾을 때 내려가는 폴더 깊이. */
const MAX_DEPTH = 4;

/** AGENTS.md를 찾다가 멈추기 전까지 읽는 폴더 수. 큰 폴더를 통째로 읽지 않게 한다. */
export const MAX_FOLDERS = 1000;

export interface LinkRequest {
  name?: string | null;
  scope?: string | null;
  instructions?: string | null;
}

export interface LinkPlan {
  dir: string;
  name: string;
  scope: Scope;
  instructions: string;
  /** 쓸 profile.json. 폴더에 이미 있으면 null. */
  metadata: ProfileMetadata | null;
  /** 포인터에 일어날 일: 새 링크, 또는 이미 여기를 가리키는 링크. */
  link: 'create' | 'unchanged';
  /** 계획을 실행하면 무언가 바뀌는지. */
  changes: boolean;
}

/**
 * `dir` 안에서 MAX_DEPTH 단계까지 내려가며 찾은 모든 AGENTS.md(`/`로 나눈 경로)와, 찾으려던
 * 폴더를 모두 읽었는지. MAX_FOLDERS개 폴더를 읽으면 멈춘다. 숨은 폴더, 의존성·빌드 폴더, 연결된
 * 폴더는 건너뛴다. 심볼릭 링크인 AGENTS.md도 목록에 넣어서, 없는 것이 아니라 링크라고 알릴 수 있게 한다.
 */
export function instructionCandidates(dir: string): { files: string[]; complete: boolean } {
  const files: string[] = [];
  let read = 0;
  let complete = true;
  const walk = (rel: string, depth: number) => {
    if (read >= MAX_FOLDERS) {
      complete = false;
      return;
    }
    read++;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !entry.name.startsWith('.') && !SKIPPED.has(entry.name)) walk(child, depth + 1);
      } else if ((entry.isFile() || entry.isSymbolicLink()) && entry.name === DEFAULT_INSTRUCTIONS) files.push(child);
    }
  };
  walk('', 0);
  return { files, complete };
}

function readExistingMetadata(dir: string): ProfileMetadata | null {
  const file = path.join(dir, PROFILE_METADATA_FILE);
  if (!fs.existsSync(file)) return null;
  const metadata = readMetadataFile(file);
  if (!isValidProfileMetadata(metadata)) {
    throw usageError('link.invalid-metadata', _('error.link.invalid-metadata', { file }), null);
  }
  return metadata;
}

/**
 * `dir`의 `rel`에 있는 AGENTS.md가, agctx가 이 폴더에 프로필을 적용하며 쓴 것인지. 그 파일은 다른
 * 프로필의 출력이지 이 폴더 자신의 규칙이 아니므로, 이름으로 지정하지 않으면 가져가지 않는다.
 */
function writtenByAgctx(dir: string, rel: string): boolean {
  try {
    return fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8').includes(MANAGED_END);
  } catch {
    return false;
  }
}

/**
 * `profile link`가 `dir`에서 가져갈 수 있는 규칙 파일: agctx가 쓰지 않은 모든 AGENTS.md와, 따로
 * 말하지 않아도 가져가는 하나. 그 하나는 루트 AGENTS.md이고, 없으면 하나뿐인 AGENTS.md다. 여럿인데
 * 루트에 없으면 하나도 가져가지 않고, 찾기가 일찍 멈췄으면 더 있을 수 있으므로 루트 것만 가져간다.
 */
export function ruleFileChoices(dir: string): {
  detected: string | null;
  candidates: string[];
  complete: boolean;
  written: string[];
} {
  const { files, complete } = instructionCandidates(dir);
  const written = files.filter(file => writtenByAgctx(dir, file));
  const candidates = files.filter(file => !written.includes(file));
  const detected =
    candidates.includes(DEFAULT_INSTRUCTIONS) && regularFileInside(dir, DEFAULT_INSTRUCTIONS)
      ? DEFAULT_INSTRUCTIONS
      : complete && candidates.length === 1
        ? candidates[0]
        : null;
  return { detected, candidates, complete, written };
}

function chooseInstructions(dir: string): string {
  // 폴더 자신의 루트 AGENTS.md가 있으면 찾지 않고 정한다. 그것이 심볼릭 링크이면 planLink가 알린다.
  const root = path.join(dir, DEFAULT_INSTRUCTIONS);
  if (
    (regularFileInside(dir, DEFAULT_INSTRUCTIONS) && !writtenByAgctx(dir, DEFAULT_INSTRUCTIONS)) ||
    isSymbolicLink(root)
  )
    return DEFAULT_INSTRUCTIONS;
  const { detected, candidates, complete, written } = ruleFileChoices(dir);
  if (detected) return detected;
  if (!candidates.length && written.length && complete) {
    throw usageError(
      'link.rules-written',
      _('error.link.rules-written', { dir, files: written.join(', ') }),
      _('hint.link.instructions')
    );
  }
  const files = candidates.join('\n  ');
  if (!complete) {
    throw usageError(
      'link.search-limit',
      candidates.length
        ? _('error.link.search-limit-found', { dir, count: MAX_FOLDERS, files })
        : _('error.link.search-limit', { dir, count: MAX_FOLDERS }),
      _('hint.link.instructions')
    );
  }
  if (!candidates.length)
    throw usageError('link.no-rules', _('error.link.no-rules', { dir }), _('hint.link.instructions'));
  throw usageError('link.many-rules', _('error.link.many-rules', { dir, files }), _('hint.link.instructions'));
}

/**
 * `dir`이 루트 아래에 놓인 Git 저장소. 그 루트와 거기서부터의 `/` 경로로 나타내고, 둘 다 디스크의
 * 폴더에서 읽어서 링크를 거친 경로도 실제 저장소를 가리킨다. `dir`이 저장소 루트이거나, Git 밖에
 * 있거나, 저장소 커밋이 담지 않는 폴더이거나, dotfiles 저장소로 쓰는 홈 폴더 안에 있으면 null.
 * 커밋이 없는 저장소는 아직 담은 것이 없으므로 그 폴더들을 안에 있다고 본다. git이 설치되지 않았으면
 * 어떤 폴더도 저장소 안으로 보지 않는다. Git 밖의 폴더는 연결할 수 있기 때문이다.
 */
function enclosingRepository(dir: string): { root: string; prefix: string } | null {
  try {
    const top = git(['rev-parse', '--show-toplevel'], { cwd: dir, allowFailure: true });
    if (top.status !== 0) return null;
    const root = path.resolve(top.stdout.trim());
    const real = fs.realpathSync.native(dir);
    if (sameFolder(root, real) || sameFolder(root, os.homedir())) return null;
    const committed = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: dir, allowFailure: true }).status === 0;
    if (
      committed &&
      git(['rev-parse', '--verify', '--quiet', 'HEAD:./'], { cwd: dir, allowFailure: true }).status !== 0
    )
      return null;
    return { root, prefix: path.relative(fs.realpathSync.native(root), real).split(path.sep).join('/') };
  } catch {
    return null;
  }
}

/** `profile link`가 폴더에 제안하는 프로필 이름: 폴더 이름, 또는 규칙에 맞는 가장 가까운 이름. */
export function suggestedName(folder: string): string | null {
  if (isProfileName(folder)) return folder;
  const name = folder
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return isProfileName(name) ? name : null;
}

/**
 * 심볼릭 링크인 규칙 파일에 대한 안내. 고정과 `profile clone`은 Git에서 규칙 파일을 읽는데, Git에서
 * 링크는 가리키는 파일이 아니다. 그래서 링크가 가리키는 파일이 폴더 안의 일반 파일이면 그 파일을
 * 안내한다.
 */
function symbolicLinkHint(dir: string, file: string): string {
  let target: string | null = null;
  try {
    target = path
      .relative(dir, path.resolve(path.dirname(file), fs.readlinkSync(file)))
      .split(path.sep)
      .join('/');
  } catch {}
  if (target && isInstructionsPath(target) && regularFileInside(dir, target))
    return _('hint.link.rules-symlink-target', { file: shellWord(target) });
  return target && (target === '..' || target.startsWith('../') || path.isAbsolute(target))
    ? _('hint.link.rules-symlink-outside')
    : _('hint.link.instructions');
}

/**
 * 찾지 않고도 할 수 있는 검사를 거친 뒤 `profile link`가 연결할 폴더: 폴더이고, 홈 폴더가 아니고,
 * Git 저장소 안의 폴더가 아니다. TUI는 폴더의 규칙 파일을 나열하기 전에 이것을 실행한다.
 */
export function checkLinkFolder(dirInput: string, request: LinkRequest = {}): string {
  const dir = path.resolve(dirInput);
  if (!isDirectory(dir)) throw usageError('link.not-directory', _('error.link.not-directory', { dir }), null);
  if (sameFolder(dir, os.homedir()))
    throw usageError('link.home-folder', _('error.link.home-folder', { dir }), _('hint.link.home-folder'));
  // 고정, status, clone은 저장소 루트에서 동작하므로, 저장소 안의 폴더는 그 루트로 연결한다.
  const repository = enclosingRepository(dir);
  if (repository) {
    let existing: ProfileMetadata | null = null;
    try {
      existing = readExistingMetadata(dir);
    } catch {}
    const { root, prefix } = repository;
    const inner = request.instructions || (existing ? instructionsFile(existing) : ruleFileChoices(dir).detected);
    const name = request.name || existing?.name || suggestedName(path.basename(dir));
    const scope = request.scope || existing?.scope;
    const command = [
      'agctx profile link',
      shellWord(root),
      '--instructions',
      inner ? shellWord(path.posix.join(prefix, inner)) : `${shellWord(prefix)}/<file>`,
      ...(name ? ['--name', shellWord(name)] : []),
      ...(scope ? ['--scope', shellWord(scope)] : [])
    ].join(' ');
    throw usageError(
      'link.inside-repository',
      _('error.link.inside-repository', { dir, root }),
      _('hint.link.inside-repository', { command })
    );
  }
  return dir;
}

/** `profile link`가 `dir`에 할 일. 아무것도 쓰지 않는다. */
export function planLink(dirInput: string, request: LinkRequest = {}): LinkPlan {
  const dir = checkLinkFolder(dirInput, request);
  const existing = readExistingMetadata(dir);
  const metadataFile = path.join(dir, PROFILE_METADATA_FILE);
  let name: string;
  if (existing) {
    const given: [string, string | null | undefined, string][] = [
      ['name', request.name, existing.name],
      ['scope', request.scope, existing.scope],
      ['instructions', request.instructions, instructionsFile(existing)]
    ];
    for (const [field, value, recorded] of given) {
      if (value && value !== recorded) {
        throw usageError(
          'link.mismatch',
          _('error.link.mismatch', { field, value, recorded, file: metadataFile }),
          _('hint.link.mismatch')
        );
      }
    }
    name = existing.name;
  } else {
    name = request.name || path.basename(dir);
    if (!request.name && !isProfileName(name)) {
      const suggestion = suggestedName(name);
      throw usageError(
        'profile.invalid-name',
        _('error.profile.invalid-name', { name }),
        suggestion ? _('hint.link.name', { name: suggestion }) : _('hint.profile.name')
      );
    }
    validateProfileName(name);
  }

  // 폴더 하나에 링크 하나. 동작하는 링크의 이름은 폴더 profile.json의 이름이므로, 이 폴더를 다른
  // 이름으로 붙잡을 수 있는 것은 끊긴 링크뿐이다. 다시 연결하면 프로필이 둘로 갈라진다.
  const linkedAs = readStore().brokenLinks.find(link => link.name !== name && sameFolder(link.path, dir));
  if (linkedAs)
    throw usageError(
      'link.folder-linked',
      _('error.link.folder-linked', { dir, name: linkedAs.name }),
      brokenLinkHint(linkedAs.name)
    );

  // 보관함에 이미 있는 이름은, 끊겼든 아니든 다른 폴더를 가리키게 하지 않는다. 그러지 않으면 다른 곳에
  // 있는 같은 이름의 폴더가 묻지도 않고 자리를 차지한다. 끊긴 링크를 되살리려면 remove 뒤에 link한다.
  const location = profileLocation(name);
  let linked = false;
  if (location) {
    if (location.kind === 'symlink' && !location.link) {
      throw usageError(
        'link.exists',
        _('error.link.exists-symlink', { name, path: location.dir }),
        _('hint.link.exists-symlink', { name })
      );
    }
    // 폴더에 profile.json이 있으면 이름은 거기서 오므로, --name으로 충돌을 피해 갈 수 없다.
    if (!location.link)
      throw usageError(
        'link.exists',
        _('error.link.exists', { name }),
        existing ? _('hint.link.exists-metadata', { name, file: metadataFile }) : _('hint.link.exists', { name })
      );
    if (location.problem)
      throw usageError(
        'link.broken-exists',
        _('error.link.broken-exists', { name, path: location.link, reason: _(`list.broken.${location.problem}`) }),
        brokenLinkHint(name)
      );
    if (!sameFolder(location.link, dir))
      throw usageError(
        'link.linked-elsewhere',
        _('error.link.linked-elsewhere', { name, from: location.link }),
        _('hint.link.linked-elsewhere', { name, path: dir })
      );
    linked = true;
  }

  let scope: Scope;
  let instructions: string;
  if (existing) {
    scope = existing.scope;
    instructions = instructionsFile(existing);
  } else {
    const requestedScope = request.scope || 'personal';
    if (!isScope(requestedScope))
      throw usageError(
        'profile.invalid-scope',
        _('error.profile.invalid-scope', { scope: requestedScope, scopes: SCOPES.join(', ') }),
        null
      );
    scope = requestedScope;
    instructions = request.instructions || chooseInstructions(dir);
  }
  assertInstructionsPath(instructions, metadataFile);
  if (!regularFileInside(dir, instructions)) {
    const file = path.join(dir, ...instructions.split('/'));
    if (isSymbolicLink(file))
      throw usageError('link.rules-symlink', _('error.link.rules-symlink', { file }), symbolicLinkHint(dir, file));
    // profile.json에 적힌 규칙 파일은 거기서 정해진다. --instructions는 그것과 어긋나기만 할 것이다.
    throw usageError(
      'link.rules-missing',
      _('error.link.rules-missing', { dir, file: instructions }),
      existing ? _('hint.link.metadata-rules', { file: metadataFile }) : _('hint.link.instructions')
    );
  }

  const metadata: ProfileMetadata | null = existing
    ? null
    : instructions === DEFAULT_INSTRUCTIONS
      ? { schemaVersion: 1, name, scope, createdAt: new Date().toISOString() }
      : { schemaVersion: 2, name, scope, instructions, createdAt: new Date().toISOString() };
  return {
    dir,
    name,
    scope,
    instructions,
    metadata,
    link: linked ? 'unchanged' : 'create',
    changes: Boolean(metadata) || !linked
  };
}

/** 계획에 대한 확인 질문. */
export function linkQuestion(plan: LinkPlan): string {
  return _('confirm.link', { name: plan.name, path: plan.dir });
}

/**
 * 계획에 profile.json이 있으면 쓰고, 그다음 포인터를 쓴다. 포인터는 범위와 규칙 파일도 기록해서,
 * profile.json을 잃은 링크의 안내가 그것을 되살리는 명령에 이 값을 넣을 수 있다.
 */
export function writeLink(plan: LinkPlan): void {
  if (plan.metadata)
    writeTextAtomic(path.join(plan.dir, PROFILE_METADATA_FILE), JSON.stringify(plan.metadata, null, 2) + '\n');
  const storeDir = path.join(profileHome(), plan.name);
  fs.mkdirSync(storeDir, { recursive: true });
  const record = { schemaVersion: 1, path: plan.dir, scope: plan.scope, instructions: plan.instructions };
  writeTextAtomic(path.join(storeDir, LINK_FILE), JSON.stringify(record, null, 2) + '\n');
}
