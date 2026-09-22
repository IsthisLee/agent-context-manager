import path from 'node:path';
import { _ } from '../i18n/index.ts';
import { say } from '../commands/output.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import type { ConflictedFile, PlannedChange } from '../shared/types.ts';
import { assertProjectDirectory, boundProfile, planFor, printConflicts } from './apply.ts';
import { BACKUP_DIR, collectUserEdits, formatDiff, relocateUserEdits } from '../project/conflicts.ts';
import { mergeFileName, mergeInVsCode } from '../project/merge-editor.ts';
import { managedRegion, regionHash, writePlan } from '../project/plan.ts';

/** The file as automatic resolve writes it: lines added inside the managed area move outside it. */
function automaticResolution(file: ConflictedFile, base: string) {
  const edits = collectUserEdits(base, file.currentRegion ?? '');
  return { edits, content: relocateUserEdits(file.regenerated, edits.addedLines, file.kind) };
}

/** The current file with its managed area swapped back to the base, for a three-way merge. */
function withBaseRegion(file: ConflictedFile, base: string): string {
  const existing = file.existing ?? '';
  if (file.kind === 'agents') return `${base}${existing.slice((file.currentRegion ?? '').length)}`;
  return existing.replace(file.currentRegion ?? '', () => base);
}

/**
 * Use the VS Code merge result as the file's new content. Only what lies outside
 * the managed area survives, because the managed area is regenerated (ADR 0010).
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
 * Resolve managed-area conflicts on a project bound to a profile. Edits made
 * inside a managed area move outside it and the area is regenerated. When the
 * last applied version is unknown, only `--discard` (with a backup) proceeds.
 * `confirm` runs before anything is written and may decline.
 */
export async function resolveProject(
  targetDir: string,
  options: { dryRun: boolean; discard: boolean; edit: boolean },
  confirm: () => Promise<boolean>
): Promise<ResolveResult> {
  assertProjectDirectory(targetDir);
  const name = boundProfile(targetDir, 'profile resolve');
  const { plan } = planFor(name, targetDir, 'keep');
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
    } else if (base === null) {
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
    } else if (options.edit && !options.dryRun && file.currentRegion) {
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
  const resolved = planFor(name, targetDir, 'keep', overrides);
  if (resolved.plan.conflicts.length)
    throw usageError('resolve.still-conflicted', _('error.resolve.still-conflicted'), null);
  writePlan([...backups, ...resolved.plan.changes], targetDir);
  say(_('resolve.done', { count: plan.conflicts.length, project: targetDir }));
  return { conflicts: plan.conflicts.length, written: true, files };
}
