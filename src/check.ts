import fs from 'node:fs';
import path from 'node:path';
import { _ } from './i18n/index.ts';
import { assertProjectDirectory, planFor, PROJECT_CONFIG_FILE, readProjectConfig } from './profile/apply.ts';
import { profileLocation } from './profile/store.ts';
import { managedRegion, regionHash } from './project/plan.ts';
import { EXIT, usageError, worstExitCode } from './shared/errors.ts';
import { toLf } from './shared/fs-utils.ts';
import { git, isGitRoot } from './shared/git.ts';
import { describeHiddenCharacters, findHiddenCharacters } from './shared/hidden-chars.ts';
import type { ManagedKind } from './shared/types.ts';

/**
 * `agctx check`: 이 저장소가 기록해 둔 프로필 버전과 아직 맞는가? 보관함 없이도 CI에서 동작하고,
 * --refresh를 주면 기록된 커밋을 원본 저장소와 비교한다.
 */

export type FindingKind = 'hidden-characters' | 'conflict' | 'behind';

export interface CheckFinding {
  kind: FindingKind;
  file: string | null;
  detail: string;
}

export interface CheckReport {
  project: string;
  profile: string | null;
  pinned: boolean;
  commit: string | null;
  latestCommit: string | null;
  findings: CheckFinding[];
  warnings: string[];
  exitCode: number;
}

const CODE: Record<FindingKind, number> = {
  'hidden-characters': EXIT.hiddenCharacters,
  conflict: EXIT.conflict,
  behind: EXIT.behind
};

const COMMIT = /^[0-9a-f]{7,64}$/i;

/** 원격 브랜치의 최신 커밋. 브랜치가 없으면 null. */
export function remoteHeadCommit(url: string, branch: string): string | null {
  const line = git(['ls-remote', '--', url, `refs/heads/${branch}`]).stdout.trim();
  return line.split(/\s+/)[0] || null;
}

/** 고정한 프로젝트가 같은 이력의 더 오래된 커밋을 기록했을 때의 보관함 커밋. */
function newerStoreCommit(profileDir: string, recorded: string | null): string | null {
  if (!recorded || !COMMIT.test(recorded) || !isGitRoot(profileDir)) return null;
  const head = git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: profileDir, allowFailure: true }).stdout.trim();
  if (!head || head === recorded) return null;
  return git(['merge-base', '--is-ancestor', recorded, head], { cwd: profileDir, allowFailure: true }).status === 0
    ? head
    : null;
}

export interface CheckOptions {
  refresh?: boolean;
  /** 원격 브랜치의 최신 커밋을 읽는 방법. `repos status`는 원본마다 한 번만 조회해 나눠 쓴다. */
  remoteHead?: (url: string, branch: string) => string | null;
}

export function checkProject(targetDir: string, options: CheckOptions = {}): CheckReport {
  assertProjectDirectory(targetDir);
  const configPath = path.join(targetDir, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw usageError(
      'check.not-applied',
      _('error.check.not-applied', { project: targetDir }),
      _('hint.apply', { project: targetDir })
    );
  }
  const config = readProjectConfig(configPath);
  const findings: CheckFinding[] = [];
  const warnings: string[] = [];

  const profile = config.profile ?? null;
  // 연결된 프로필은 포인터가 가리키는 폴더에 있다. 쓸 수 없는 링크는 이 컴퓨터에 없는 프로필로 센다.
  const location = profile ? profileLocation(profile) : null;
  const brokenLink = Boolean(location?.link && location.problem);
  const inStore = Boolean(location) && !brokenLink;
  const profileDir = inStore && location ? location.dir : null;
  // 이 컴퓨터에 프로필이 있을 때 sync가 쓸 내용. 관리 영역에 이미 그 내용이 있으면 충돌이 아니므로
  // `check`와 `sync`가 같은 답을 낸다. 프로필이 없으면 기록된 해시밖에 없어서, 해시가 다르면
  // 그대로 충돌이다.
  const plan = profile && inStore ? planFor(profile, targetDir, 'keep').plan : null;
  const settled = new Set((plan?.files ?? []).filter(file => file.conflict === null).map(file => file.rel));

  for (const [rel, recorded] of Object.entries(config.managedHashes ?? {})) {
    const file = path.join(targetDir, rel);
    const kind: ManagedKind = rel === 'AGENTS.md' ? 'agents' : 'pointer';
    const content = fs.existsSync(file) ? toLf(fs.readFileSync(file, 'utf8')) : null;
    if (content === null) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.missing') });
      continue;
    }
    for (const line of describeHiddenCharacters(rel, findHiddenCharacters(content))) {
      findings.push({ kind: 'hidden-characters', file: rel, detail: line });
    }
    if (regionHash(managedRegion(kind, content)) !== recorded && !settled.has(rel)) {
      findings.push({ kind: 'conflict', file: rel, detail: _('check.edited') });
    }
  }

  const source = config.source ?? null;
  if (config.uncommitted) findings.push({ kind: 'behind', file: null, detail: _('check.uncommitted') });

  const hasConflict = findings.some(finding => finding.kind === 'conflict');
  let latestCommit: string | null = null;
  if (plan && profileDir && !hasConflict) {
    for (const file of plan.files) {
      if (file.existing !== file.regenerated)
        findings.push({ kind: 'behind', file: file.rel, detail: _('check.profile-changed') });
    }
    const storeCommit = config.pin ? newerStoreCommit(profileDir, source?.commit ?? null) : null;
    if (storeCommit) {
      latestCommit = storeCommit;
      findings.push({
        kind: 'behind',
        file: null,
        detail: _('check.profile-newer', { commit: storeCommit.slice(0, 7) })
      });
    }
  } else if (profile && !inStore) {
    if (brokenLink && location?.link)
      warnings.push(
        _('check.warn.link-broken', { profile, path: location.link, reason: _(`list.broken.${location.problem}`) })
      );
    if (!options.refresh)
      warnings.push(source?.git ? _('check.warn.refresh') : _('check.warn.no-profile', { profile }));
  }

  if (options.refresh && source?.git && source.branch) {
    latestCommit = (options.remoteHead ?? remoteHeadCommit)(source.git, source.branch);
    if (latestCommit && latestCommit !== source.commit) {
      findings.push({
        kind: 'behind',
        file: null,
        detail: _('check.remote-newer', { commit: latestCommit.slice(0, 7) })
      });
    }
  }

  return {
    project: targetDir,
    profile,
    pinned: config.pin === true,
    commit: source?.commit ?? null,
    latestCommit,
    findings,
    warnings,
    exitCode: worstExitCode(findings.map(finding => CODE[finding.kind]))
  };
}
