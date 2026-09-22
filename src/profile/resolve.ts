import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { say } from '../commands/output.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import type { ConflictedFile, PlannedChange } from '../shared/types.ts';
import { assertProjectDirectory, boundProfile, planFor, printConflicts, unmanagedError } from './apply.ts';
import { shellWord } from '../shared/shell.ts';
import { BACKUP_DIR, collectUserEdits, formatDiff, relocateUserEdits } from '../project/conflicts.ts';
import { mergeFileName, mergeInVsCode } from '../project/merge-editor.ts';
import { managedRegion, regionHash, writePlan } from '../project/plan.ts';

/** 자동 resolve가 쓰는 파일: 관리 영역 안에 더한 줄을 영역 밖으로 옮긴다. */
function automaticResolution(file: ConflictedFile, base: string) {
  const edits = collectUserEdits(base, file.currentRegion ?? '');
  return { edits, content: relocateUserEdits(file.regenerated, edits.addedLines, file.kind) };
}

/** 관리 영역을 base로 되돌린 현재 파일. 3방향 병합에 쓴다. */
function withBaseRegion(file: ConflictedFile, base: string): string {
  const existing = file.existing ?? '';
  if (file.kind === 'agents') return `${base}${existing.slice((file.currentRegion ?? '').length)}`;
  return existing.replace(file.currentRegion ?? '', () => base);
}

/**
 * VS Code 병합 결과를 파일의 새 내용으로 쓴다. 관리 영역은 다시 만들기 때문에 관리 영역 밖에 있는
 * 것만 남는다(ADR 0010).
 */
function mergeWithEditor(file: ConflictedFile, base: string): string {
  say(
    _('resolve.edit.guide', {
      file: file.rel,
      pane: mergeFileName('current', file.rel),
      boundary: _(`resolve.edit.boundary.${file.kind === 'agents' ? 'agents' : 'pointer'}`)
    })
  );
  const merged = mergeInVsCode({
    name: file.rel,
    current: file.existing ?? '',
    incoming: file.regenerated,
    base: withBaseRegion(file, base),
    result: automaticResolution(file, base).content
  });
  const mergedRegion = managedRegion(file.kind, merged.content);
  const hasBoundary = file.kind === 'agents' ? mergedRegion !== merged.content.trimEnd() : mergedRegion !== null;
  if (!mergedRegion || !hasBoundary) {
    throw new CliError(
      'resolve.no-managed-area',
      _('error.resolve.no-managed-area', { file: file.rel, result: merged.resultPath }),
      { exitCode: EXIT.conflict, hint: _('hint.resolve.markers') }
    );
  }
  if (regionHash(mergedRegion) === regionHash(file.nextRegion)) {
    merged.cleanup();
    say(_('resolve.edit.applied', { file: file.rel }));
  } else {
    say(_('resolve.edit.partial', { file: file.rel, result: merged.resultPath }));
    say(formatDiff(`merge-result/${file.rel}`, `next/${file.rel}`, mergedRegion, file.nextRegion ?? ''));
  }
  return merged.content;
}

export interface ResolveResult {
  conflicts: number;
  written: boolean;
  files: {
    file: string;
    action: 'recreate' | 'discard' | 'move' | 'edit';
    moved?: number;
    restored?: number;
    backup?: string;
  }[];
}

/**
 * 프로필에 묶인 프로젝트의 관리 영역 충돌을 푼다. 관리 영역 안의 수정은 영역 밖으로 옮기고 영역은
 * 다시 만든다. 마지막으로 적용한 버전을 모르면 `--discard`(백업과 함께)만 진행한다. `confirm`은
 * 무엇이든 쓰기 전에 실행되며 거절할 수 있다.
 */
export async function resolveProject(
  targetDir: string,
  options: { dryRun: boolean; discard: boolean; edit: boolean; adopt?: boolean },
  confirm: () => Promise<boolean>
): Promise<ResolveResult> {
  assertProjectDirectory(targetDir);
  const name = boundProfile(targetDir, 'profile resolve');
  const adopt = options.adopt === true;
  const { plan, agents } = planFor(name, targetDir, 'keep', undefined, { adopt });
  // resolve도 계획한 파일을 모두 쓰므로, 표지 없는 파일은 편입을 허락받기 전에는 쓰지 않는다(ADR 0043).
  if (plan.unmanaged.length)
    throw unmanagedError(plan.unmanaged, {
      retry: `agctx profile resolve ${shellWord(targetDir)}${options.discard ? ' --discard' : ''}${options.edit ? ' --edit' : ''} --adopt`,
      profile: name,
      targetDir,
      agents
    });
  if (!plan.conflicts.length) {
    say(_('resolve.nothing'));
    return { conflicts: 0, written: false, files: [] };
  }

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const overrides = new Map<string, string | null>();
  const backups: PlannedChange[] = [];
  const unresolved: ConflictedFile[] = [];
  const files: ResolveResult['files'] = [];
  const edits: ConflictedFile[] = [];
  for (const file of plan.conflicts) {
    const base = file.conflict.base;
    if (file.conflict.kind === 'missing') {
      overrides.set(file.rel, null);
      files.push({ file: file.rel, action: 'recreate' });
    } else if (base === null || file.kind === 'mcp-json' || file.kind === 'mcp-toml') {
      // MCP 설정 파일은 고친 줄을 관리 영역 밖으로 옮길 자리가 없다. 백업한 뒤 다시 만드는 것만 한다.
      if (!options.discard) {
        unresolved.push(file);
        continue;
      }
      const backup = `${BACKUP_DIR}/${stamp}/${file.rel}`;
      backups.push({
        target: path.join(targetDir, backup),
        relativePath: backup,
        content: file.existing ?? '',
        status: 'create'
      });
      overrides.set(file.rel, file.regenerated);
      files.push({ file: file.rel, action: 'discard', backup });
    } else if (options.edit && !options.dryRun && file.currentRegion && !file.remove) {
      edits.push(file);
      files.push({ file: file.rel, action: 'edit' });
    } else {
      const { edits: userEdits, content } = automaticResolution(file, base);
      overrides.set(file.rel, content);
      files.push({
        file: file.rel,
        action: 'move',
        moved: userEdits.addedLines.length,
        restored: userEdits.removedLines.length
      });
    }
  }

  const mcpUnresolved = unresolved.filter(file => file.kind === 'mcp-json' || file.kind === 'mcp-toml');
  if (mcpUnresolved.length) {
    printConflicts(unresolved);
    throw new CliError(
      'resolve.mcp-discard',
      _('error.resolve.mcp-discard', { files: mcpUnresolved.map(file => file.rel).join(', ') }),
      { exitCode: EXIT.conflict, hint: _('hint.resolve.mcp-discard', { project: targetDir, backups: BACKUP_DIR }) }
    );
  }
  if (unresolved.length) {
    printConflicts(unresolved);
    throw new CliError(
      'resolve.unknown-base',
      _('error.resolve.unknown-base', { files: unresolved.map(file => file.rel).join(', ') }),
      { exitCode: EXIT.conflict, hint: _('hint.resolve.discard', { project: targetDir, backups: BACKUP_DIR }) }
    );
  }
  for (const file of files)
    say(
      _(`resolve.${options.dryRun ? 'plan' : 'will'}.${file.action}`, {
        file: file.file,
        moved: file.moved ?? 0,
        restored: file.restored ?? 0,
        backup: file.backup ?? ''
      })
    );
  if (options.dryRun) {
    say(_('plan.dry-run.done'));
    return { conflicts: plan.conflicts.length, written: false, files };
  }
  if (!(await confirm())) {
    say(_('confirm.declined'));
    return { conflicts: plan.conflicts.length, written: false, files };
  }
  for (const file of edits) overrides.set(file.rel, mergeWithEditor(file, file.conflict.base as string));
  const resolved = planFor(name, targetDir, 'keep', overrides, { adopt });
  if (resolved.plan.conflicts.length)
    throw usageError('resolve.still-conflicted', _('error.resolve.still-conflicted'), null);
  writePlan([...backups, ...resolved.plan.changes], targetDir);
  say(_('resolve.done', { count: plan.conflicts.length, project: targetDir }));
  return { conflicts: plan.conflicts.length, written: true, files };
}
