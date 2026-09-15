import path from 'node:path';
import { hasFlag } from '../commands/args.ts';
import { _ } from '../i18n/index.ts';
import type { ConflictedFile, PlannedChange } from '../shared/types.ts';
import { assertProjectDirectory, boundProfile, planFor, printConflicts, readProjectConfig } from './apply.ts';
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
 * the managed area survives, because the managed area is regenerated; a formatter
 * that rewrote the area on save therefore does not block the merge (ADR 0010).
 */
function mergeWithEditor(file: ConflictedFile, base: string): string {
  console.log(_('resolve.edit.guide', {
    file: file.rel,
    pane: mergeFileName('current', file.rel),
    boundary: _(`resolve.edit.boundary.${file.kind === 'agents' ? 'agents' : 'pointer'}`)
  }));
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
    throw new Error(`Merge result for ${file.rel} has no agctx managed area. Keep the managed markers (the extension heading in AGENTS.md) and run resolve again. Result kept at ${merged.resultPath}`);
  }
  if (regionHash(mergedRegion) === regionHash(file.nextRegion)) {
    merged.cleanup();
    console.log(`${file.rel}: applied the VS Code merge result.`);
  } else {
    console.log(`${file.rel}: applied content outside the managed area from the VS Code merge result; changes inside it were not applied. Merge result kept at ${merged.resultPath}`);
    console.log(formatDiff(`merge-result/${file.rel}`, `next/${file.rel}`, mergedRegion, file.nextRegion ?? ''));
  }
  return merged.content;
}

/**
 * Resolve managed-area conflicts on a project bound to a profile. Edits made
 * inside a managed area move outside it and the area is regenerated. When the
 * last applied version is unknown, only `--discard` (with a backup) proceeds.
 */
export function resolveProject(values: readonly string[]): { conflicts: number } {
  const positional = values.filter(value => !value.startsWith('--'));
  if (positional.length > 1) throw new Error('profile resolve takes only <project>.');
  const targetDir = path.resolve(process.cwd(), positional[0] || '.');
  assertProjectDirectory(targetDir);
  const name = boundProfile(readProjectConfig(path.join(targetDir, 'agctx.project.json')));
  if (!name) throw new Error('profile resolve requires a project already applied with `agctx profile apply <name> <project>`.');
  const dryRun = hasFlag(values, 'dry-run');
  const plan = planFor(name, targetDir);
  if (!plan.conflicts.length) {
    console.log('Nothing to resolve: every managed area matches the last apply.');
    return { conflicts: 0 };
  }

  const stamp = new Date().toISOString().replaceAll(':', '-');
  const will = (past: string, future: string) => (dryRun ? future : past);
  const overrides = new Map<string, string | null>();
  const backups: PlannedChange[] = [];
  const unresolved: ConflictedFile[] = [];
  for (const file of plan.conflicts) {
    const base = file.conflict.base;
    if (file.conflict.kind === 'missing') {
      overrides.set(file.rel, null);
      console.log(`${file.rel}: ${will('recreated', 'would recreate')} the missing file.`);
    } else if (base === null) {
      if (!hasFlag(values, 'discard')) {
        unresolved.push(file);
        continue;
      }
      const backup = `${BACKUP_DIR}/${stamp}/${file.rel}`;
      backups.push({ target: path.join(targetDir, backup), relativePath: backup, content: file.existing ?? '', status: 'create' });
      overrides.set(file.rel, file.regenerated);
      console.log(`${file.rel}: ${will('backed up', 'would back up')} to ${backup} and ${will('regenerated', 'would regenerate')} the managed area.`);
    } else if (hasFlag(values, 'edit') && !dryRun && file.currentRegion) {
      overrides.set(file.rel, mergeWithEditor(file, base));
    } else {
      const { edits, content } = automaticResolution(file, base);
      overrides.set(file.rel, content);
      console.log(`${file.rel}: ${will('moved', 'would move')} ${edits.addedLines.length} line(s) outside the managed area; ${will('restored', 'would restore')} ${edits.removedLines.length} line(s) removed inside it.`);
      if (edits.addedLines.length && edits.removedLines.length) {
        console.log(`  Some lines were changed rather than added. Check ${file.rel} for near-duplicate lines below the managed area.`);
      }
    }
  }

  if (unresolved.length) {
    printConflicts(unresolved);
    throw new Error([
      `Cannot tell your edits from profile changes in: ${unresolved.map(file => file.rel).join(', ')}. The last applied version is unknown.`,
      `  Keep what you need outside the managed area, then run: agctx profile resolve --discard ${targetDir}`,
      `  --discard backs up each file under ${BACKUP_DIR}/ before regenerating it.`
    ].join('\n'));
  }
  if (dryRun) {
    console.log('Dry-run: no files were changed.');
    return { conflicts: plan.conflicts.length };
  }
  const resolved = planFor(name, targetDir, overrides);
  writePlan([...backups, ...resolved.changes], targetDir);
  console.log(`Resolved ${plan.conflicts.length} conflict(s) in ${targetDir}`);
  return { conflicts: plan.conflicts.length };
}
