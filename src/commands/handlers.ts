import path from 'node:path';
import { _, SUPPORTED_LOCALES } from '../i18n/index.ts';
import { checkProject } from '../check.ts';
import { boundProfile, conflictError, planFor, printConflicts, printPlan } from '../profile/apply.ts';
import { cloneProfile, connectProfile, planPush, profileGitState, pullProfile, pushProfile } from '../profile/git-profile.ts';
import { resolveProject } from '../profile/resolve.ts';
import { setupProfile } from '../profile/setup.ts';
import { createProfile, getProfiles, removeProfile, viewProfile } from '../profile/store.ts';
import { writePlan } from '../project/plan.ts';
import { EXIT, usageError } from '../shared/errors.ts';
import { saveLocale } from '../shared/home.ts';
import { createProfileTui, listProfiles, removeProfileTui, setupProfileTui } from '../tui/profile.ts';
import { confirmChange, type ParsedArguments } from './options.ts';
import { isJsonMode, say, warn, type CommandOutcome } from './output.ts';

type Handler = (parsed: ParsedArguments) => Promise<CommandOutcome>;

const ok = (data?: unknown, warnings?: string[]): CommandOutcome => ({ exitCode: EXIT.ok, data, warnings });
const projectDir = (value: string | undefined) => path.resolve(process.cwd(), value || '.');
const flag = (parsed: ParsedArguments, name: string) => parsed.options[name] === true;

function requirePositional(parsed: ParsedArguments, index: number, usage: string): string {
  const value = parsed.positional[index];
  if (!value) throw usageError('argument.missing', _('error.argument.missing', { usage }), _('hint.command.options', { command: usage.split(' ').slice(1, 3).join(' ') }));
  return value;
}

/** Plan, show, confirm, and write for apply and sync. Conflicts stop with exit code 2 before anything is written. */
async function applyOrSync(parsed: ParsedArguments, name: string, targetDir: string, pin: boolean | 'keep', retry: string): Promise<CommandOutcome> {
  const dryRun = flag(parsed, 'dry-run');
  const { plan, version, previousPin } = planFor(name, targetDir, pin);
  const data = { profile: name, project: targetDir, source: version.source, pin: version.pin, uncommitted: version.uncommitted, changes: plan.changes.map(({ relativePath, status }) => ({ file: relativePath, status })), conflicts: plan.conflicts.map(file => ({ file: file.rel, kind: file.conflict.kind })) };
  const warnings = pin === false && previousPin ? [_('apply.warn.unpin', { project: targetDir })] : [];
  if (!isJsonMode()) warnings.forEach(message => warn(message));
  // Human output already printed the warnings; the JSON document carries them instead.
  const done = (written: boolean): CommandOutcome => ({ exitCode: EXIT.ok, data: { ...data, written }, warnings: isJsonMode() ? warnings : [] });
  printPlan(plan, dryRun ? _('plan.label.dry-run') : _('plan.label.plan'));
  const changed = plan.changes.filter(change => change.status !== 'unchanged');
  if (plan.conflicts.length) {
    if (dryRun) printConflicts(plan.conflicts);
    throw conflictError(plan.conflicts, targetDir);
  }
  if (dryRun) {
    say(_('plan.dry-run.done'));
    return done(false);
  }
  if (!changed.length) {
    say(_('plan.up-to-date', { project: targetDir }));
    return done(false);
  }
  if (!(await confirmChange(parsed, _('confirm.apply', { count: changed.length, project: targetDir }), retry))) {
    say(_('confirm.declined'));
    return done(false);
  }
  writePlan(plan.changes, targetDir);
  say(_('apply.done', { profile: name, project: targetDir }));
  return done(true);
}

export const HANDLERS: Record<string, Handler> = {
  'profile.create': async parsed => {
    const name = parsed.positional[0];
    if (!name) {
      if (isJsonMode()) throw usageError('argument.missing', _('error.argument.missing', { usage: 'agctx profile create <name> [--scope <scope>]' }), _('hint.command.options', { command: 'profile create' }));
      await createProfileTui();
      return ok();
    }
    createProfile(name, typeof parsed.options.scope === 'string' ? parsed.options.scope : 'personal');
    return ok({ profile: name });
  },
  'profile.list': async parsed => {
    const scope = typeof parsed.options.scope === 'string' ? parsed.options.scope : null;
    await listProfiles(scope);
    return ok({ profiles: getProfiles().filter(profile => !scope || profile.scope === scope) });
  },
  'profile.view': async parsed => {
    const name = requirePositional(parsed, 0, 'agctx profile view <name>');
    return ok(viewProfile(name));
  },
  'profile.setup': async parsed => {
    const name = parsed.positional[0] ?? null;
    const levelOptions = Object.keys(parsed.options).filter(option => !['json', 'lang'].includes(option));
    if (!levelOptions.length) {
      if (isJsonMode()) throw usageError('argument.missing', _('error.argument.missing', { usage: 'agctx profile setup <name> --tdd <level> ...' }), _('hint.command.options', { command: 'profile setup' }));
      await setupProfileTui(name);
      return ok();
    }
    if (!name) throw usageError('argument.missing', _('error.argument.missing', { usage: 'agctx profile setup <name> [--tdd <level>] ...' }), null);
    return ok(setupProfile(name, parsed.raw));
  },
  'profile.apply': async parsed => {
    const name = requirePositional(parsed, 0, 'agctx profile apply <name> [<project>]');
    const targetDir = projectDir(parsed.positional[1]);
    const pin = flag(parsed, 'pin');
    return applyOrSync(parsed, name, targetDir, pin, `agctx profile apply ${name} ${targetDir}${pin ? ' --pin' : ''} --yes`);
  },
  'profile.sync': async parsed => {
    const targetDir = projectDir(parsed.positional[0]);
    const name = boundProfile(targetDir, 'profile sync');
    return applyOrSync(parsed, name, targetDir, 'keep', `agctx profile sync ${targetDir} --yes`);
  },
  'profile.resolve': async parsed => {
    const targetDir = projectDir(parsed.positional[0]);
    const result = await resolveProject(targetDir, { dryRun: flag(parsed, 'dry-run'), discard: flag(parsed, 'discard'), edit: flag(parsed, 'edit') },
      () => confirmChange(parsed, _('confirm.resolve', { project: targetDir }), `agctx profile resolve ${targetDir}${flag(parsed, 'discard') ? ' --discard' : ''}${flag(parsed, 'edit') ? ' --edit' : ''} --yes`));
    return ok(result);
  },
  'profile.remove': async parsed => {
    const name = parsed.positional[0] ?? null;
    if (!flag(parsed, 'yes')) {
      await removeProfileTui(name);
      return ok();
    }
    if (!name) throw usageError('argument.missing', _('error.argument.missing', { usage: 'agctx profile remove <name> --yes' }), null);
    removeProfile(name);
    return ok({ profile: name, removed: true });
  },
  'profile.clone': async parsed => {
    const url = requirePositional(parsed, 0, 'agctx profile clone <git-url>');
    const state = cloneProfile(url, { branch: typeof parsed.options.branch === 'string' ? parsed.options.branch : null });
    say(_('clone.done', { name: state.name, commit: (state.commit ?? '').slice(0, 7) }));
    say(_('clone.next', { name: state.name }));
    return ok(state);
  },
  'profile.status': async parsed => {
    const names = parsed.positional[0] ? [parsed.positional[0]] : getProfiles().map(profile => profile.name);
    const profiles = names.map(name => profileGitState(name, { refresh: flag(parsed, 'refresh') }));
    for (const state of profiles) {
      say(describeState(state));
      if (state.behind) say(_('status.next.pull', { name: state.name }));
      if (state.ahead) say(_('status.next.push', { name: state.name }));
    }
    return ok({ profiles });
  },
  'profile.pull': async parsed => {
    const name = requirePositional(parsed, 0, 'agctx profile pull <name>');
    const result = pullProfile(name, { dryRun: flag(parsed, 'dry-run') });
    if (!result.commits.length) say(_('pull.up-to-date', { name }));
    else {
      say(_(result.applied ? 'pull.done' : 'pull.dry-run', { name, count: result.commits.length }));
      for (const commit of result.commits) say(`  ${commit}`);
      if (result.applied) say(_('pull.next', { name }));
    }
    return ok(result);
  },
  'profile.push': async parsed => {
    const name = requirePositional(parsed, 0, 'agctx profile push <name>');
    const plan = planPush(name);
    if (!plan.commits.length) {
      say(_('push.nothing', { name }));
      return ok(plan);
    }
    say(_('push.plan', { name, count: plan.commits.length, remote: plan.state.remote ?? '' }));
    for (const commit of plan.commits) say(`  ${commit}`);
    if (flag(parsed, 'dry-run')) return ok(plan);
    if (!(await confirmChange(parsed, _('confirm.push', { name, count: plan.commits.length }), `agctx profile push ${name} --yes`))) {
      say(_('confirm.declined'));
      return ok(plan);
    }
    const pushed = pushProfile(plan);
    say(_('push.done', { name }));
    return ok(pushed);
  },
  'profile.connect': async parsed => {
    const name = requirePositional(parsed, 0, 'agctx profile connect <name> <git-url>');
    const url = requirePositional(parsed, 1, 'agctx profile connect <name> <git-url>');
    const state = connectProfile(name, url, { branch: typeof parsed.options.branch === 'string' ? parsed.options.branch : null });
    say(_('connect.done', { name, remote: state.remote ?? '', branch: state.branch ?? '' }));
    say(_('connect.next', { name }));
    return ok(state);
  },
  check: async parsed => {
    const report = checkProject(projectDir(parsed.positional[0]), { refresh: flag(parsed, 'refresh') });
    for (const finding of report.findings) say(`${finding.kind.padEnd(17)} ${finding.file ?? '-'}  ${finding.detail}`);
    if (!report.findings.length) say(_('check.ok', { project: report.project }));
    return { exitCode: report.exitCode, data: report, warnings: report.warnings };
  },
  'config.lang': async parsed => {
    const value = requirePositional(parsed, 0, `agctx config lang <${SUPPORTED_LOCALES.join('|')}>`);
    const saved = saveLocale(value);
    say(_('lang.saved', { locale: saved }));
    return ok({ locale: saved });
  },
  help: async () => ok()
};

function describeState(state: ReturnType<typeof profileGitState>): string {
  if (!state.connected) return _('status.local', { name: state.name });
  const position = state.ahead === null ? _('status.no-upstream') : _('status.position', { ahead: state.ahead, behind: state.behind ?? 0 });
  return _('status.git', { name: state.name, remote: state.remote ?? '-', branch: state.branch ?? '-', commit: (state.commit ?? '').slice(0, 7), dirty: state.dirty.length ? _('status.dirty', { count: state.dirty.length }) : _('status.clean'), position });
}
