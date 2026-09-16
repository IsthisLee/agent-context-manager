import fs from 'node:fs';
import path from 'node:path';
import { _, SUPPORTED_LOCALES } from '../i18n/index.ts';
import { checkProject } from '../check.ts';
import { explainPath, parseAgents, type AgentId } from '../explain.ts';
import { verifyPath } from '../verify/index.ts';
import { boundProfile, conflictError, planFor, printConflicts, printPlan } from '../profile/apply.ts';
import { cloneProfile, connectProfile, planPush, profileGitState, pullProfile, pushProfile } from '../profile/git-profile.ts';
import { resolveProject } from '../profile/resolve.ts';
import { setupProfile } from '../profile/setup.ts';
import { createProfile, getProfiles, removeProfile, viewProfile } from '../profile/store.ts';
import { writePlan } from '../project/plan.ts';
import { openPullRequests, prepareReposPrs, type PrItem, type PrOptions } from '../repos/pr.ts';
import { pruneRepos, recordRepo, selectRepos } from '../repos/registry.ts';
import { reposStatus } from '../repos/status.ts';
import { applyReposSync, planReposSync, type SyncItem } from '../repos/sync.ts';
import { EXIT, usageError, worstExitCode } from '../shared/errors.ts';
import { saveLocale } from '../shared/home.ts';
import { createProfileTui, listProfiles, removeProfileTui, setupProfileTui } from '../tui/profile.ts';
import { canPrompt, confirmChange, type ParsedArguments } from './options.ts';
import { isJsonMode, say, warn, type CommandOutcome } from './output.ts';

type Handler = (parsed: ParsedArguments) => Promise<CommandOutcome>;

const ok = (data?: unknown, warnings?: string[]): CommandOutcome => ({ exitCode: EXIT.ok, data, warnings });
const projectDir = (value: string | undefined) => path.resolve(process.cwd(), value || '.');
const flag = (parsed: ParsedArguments, name: string) => parsed.options[name] === true;
const text = (parsed: ParsedArguments, name: string) => (typeof parsed.options[name] === 'string' ? (parsed.options[name] as string) : null);
const retryWithYes = (words: string, parsed: ParsedArguments) => [`agctx ${words}`, ...parsed.raw, '--yes'].join(' ');

/** Remember a repository for the repos commands. A broken list must not fail an apply that already succeeded. */
function remember(targetDir: string, profile: string, pinned: boolean, warnings: string[]): void {
  try {
    recordRepo(targetDir, profile, pinned);
  } catch (error) {
    const message = _('repos.warn.record', { detail: error instanceof Error ? error.message : String(error) });
    warnings.push(message);
    if (!isJsonMode()) warn(message);
  }
}

function agentName(agent: AgentId): string {
  if (agent === 'codex') return _('explain.agent.codex');
  if (agent === 'claude') return _('explain.agent.claude');
  return _('explain.agent.antigravity');
}

function printSyncItems(items: readonly SyncItem[]): void {
  for (const item of items) say(`${item.state.padEnd(11)} ${item.path}  ${item.detail}`);
}

function printPrItems(items: readonly PrItem[]): void {
  for (const item of items) say(`${item.state.padEnd(13)} ${item.target}  ${item.detail}`);
}

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
  const warnings = [...(pin === false && previousPin ? [_('apply.warn.unpin', { project: targetDir })] : []), ...plan.warnings];
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
    remember(targetDir, name, version.pin, warnings);
    return done(false);
  }
  if (!(await confirmChange(parsed, _('confirm.apply', { count: changed.length, project: targetDir }), retry))) {
    say(_('confirm.declined'));
    return done(false);
  }
  writePlan(plan.changes, targetDir);
  say(_('apply.done', { profile: name, project: targetDir }));
  remember(targetDir, name, version.pin, warnings);
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
    say(_('connect.done', { name, remote: state.remote ?? '', branch: state.remoteBranch ?? state.branch ?? '' }));
    say(_('connect.next', { name }));
    return ok(state);
  },
  check: async parsed => {
    const report = checkProject(projectDir(parsed.positional[0]), { refresh: flag(parsed, 'refresh') });
    for (const finding of report.findings) say(`${finding.kind.padEnd(17)} ${finding.file ?? '-'}  ${finding.detail}`);
    if (!report.findings.length) say(_('check.ok', { project: report.project }));
    return { exitCode: report.exitCode, data: report, warnings: report.warnings };
  },
  explain: async parsed => {
    const report = explainPath(projectDir(parsed.positional[0]), parseAgents(text(parsed, 'agent')));
    for (const agent of report.agents) {
      say(`${agentName(agent.agent)} · ${_('explain.started-in', { dir: agent.startDir === '.' ? _('explain.project-root') : agent.startDir })}`);
      if (!agent.files.length) say(`  ${_('explain.none')}`);
      for (const file of agent.files) say(`  ${file.status.padEnd(12)} ${file.path}  ${file.reason}`);
      for (const finding of agent.findings) say(`  ${finding.kind.padEnd(12)} ${finding.message}`);
      say('');
    }
    if (report.unsupported.length) {
      say(_('explain.unsupported.title'));
      for (const file of report.unsupported) say(`  ${file.path}  ${file.reason}`);
    }
    return { exitCode: report.exitCode, data: report };
  },
  verify: async parsed => {
    const agents = parseAgents(text(parsed, 'agent'));
    const probe = flag(parsed, 'probe');
    const names = agents.map(agentName).join(', ');
    // A probe changes no files but spends agent usage, so the refusal names that cost instead of a dry run.
    if (probe && parsed.options.yes !== true && !canPrompt()) {
      throw usageError('confirm.required', _('error.verify.probe-confirm', { agents: names }), _('hint.verify.probe-yes', { command: retryWithYes('verify', parsed) }));
    }
    if (probe && !(await confirmChange(parsed, _('confirm.verify-probe', { agents: names }), retryWithYes('verify', parsed)))) {
      say(_('confirm.declined'));
      return ok();
    }
    const report = verifyPath(projectDir(parsed.positional[0]), agents, { probe });
    const unstarted: string[] = [];
    const stale: string[] = [];
    const errors: string[] = [];
    for (const agent of report.agents) {
      const evidence = agent.evidence === 'session-log'
        ? _('verify.evidence.session-log', { source: agent.source ?? '' })
        : agent.evidence === 'probe' ? _('verify.evidence.probe', { command: agent.source ?? '' })
          : agent.agent === 'antigravity' ? _('verify.evidence.unreadable') : _('verify.evidence.none');
      say(`${agent.agent.padEnd(12)} ${agent.status.padEnd(12)} ${evidence}`);
      for (const file of agent.delivered) say(`  ${'delivered'.padEnd(10)} ${file}`);
      for (const file of agent.missing) say(`  ${'missing'.padEnd(10)} ${file}`);
      for (const file of agent.stale) say(`  ${'stale'.padEnd(10)} ${file}`);
      if (agent.error) say(`  ${agent.error.message}`);
      if (agent.status === 'no-evidence' && agent.agent !== 'antigravity') (agent.stale.length ? stale : unstarted).push(agentName(agent.agent));
      if (agent.error?.hint) errors.push(`${_('output.next')}: ${agent.error.hint}`);
    }
    const hints = [
      ...(unstarted.length ? [_('verify.hint.start', { agents: unstarted.join(', ') })] : []),
      ...(stale.length ? [_('verify.hint.stale', { agents: stale.join(', ') })] : []),
      ...(report.agents.some(agent => agent.agent === 'antigravity' && agent.status === 'no-evidence') ? [_('verify.hint.antigravity')] : []),
      ...errors
    ];
    return { exitCode: report.exitCode, data: report, warnings: hints };
  },
  'repos.list': async parsed => {
    if (flag(parsed, 'prune')) {
      const removed = pruneRepos();
      say(_('repos.pruned', { count: removed.length }));
      for (const entry of removed) say(`  ${entry.path}`);
    }
    const repos = selectRepos(text(parsed, 'profile')).map(entry => ({ ...entry, missing: !fs.existsSync(entry.path) }));
    if (!repos.length) say(_('repos.none'));
    for (const repo of repos) say(`${(repo.missing ? 'missing' : 'ok').padEnd(8)} ${repo.profile.padEnd(16)} ${(repo.pinned ? 'pinned' : '-').padEnd(6)} ${repo.path}`);
    return ok({ repos }, repos.some(repo => repo.missing) ? [_('repos.hint.prune')] : []);
  },
  'repos.status': async parsed => {
    const statuses = reposStatus({ profile: text(parsed, 'profile'), refresh: flag(parsed, 'refresh') });
    if (!statuses.length) say(_('repos.none'));
    const hints = new Set<string>();
    for (const status of statuses) {
      const version = status.commit
        ? `${status.commit.slice(0, 7)}${status.latestCommit && status.latestCommit !== status.commit ? `→${status.latestCommit.slice(0, 7)}` : ''}`
        : '-';
      say(`${status.state.padEnd(17)} ${status.profile.padEnd(16)} ${(status.pinned ? 'pinned' : '-').padEnd(6)} ${version.padEnd(15)} ${status.path}`);
      if (status.error) say(`  ${status.error.message}`);
      if (status.state === 'behind') hints.add(status.pinned ? _('repos.next.pr', { profile: status.profile }) : _('repos.next.sync', { profile: status.profile }));
      if (status.state === 'conflict') hints.add(_('repos.next.resolve', { project: status.path }));
      if (status.state === 'missing') hints.add(_('repos.hint.prune'));
      if (status.error?.hint) hints.add(`${_('output.next')}: ${status.error.hint}`);
    }
    return { exitCode: worstExitCode(statuses.map(status => status.exitCode)), data: { repos: statuses }, warnings: [...hints] };
  },
  'repos.sync': async parsed => {
    const planned = planReposSync(text(parsed, 'profile'));
    if (!planned.length) say(_('repos.none'));
    printSyncItems(planned);
    // Plan warnings, such as a CLAUDE.md that does not import its AGENTS.md, name the repository they belong to.
    const planWarnings = planned.flatMap(item => (item.plan?.plan.warnings ?? []).map(message => `${item.path}: ${message}`));
    const summary = (items: readonly SyncItem[]) => ({
      exitCode: worstExitCode(items.map(item => item.exitCode)),
      data: { repos: items.map(({ plan: _plan, ...item }) => item) },
      warnings: planWarnings
    });
    const updates = planned.filter(item => item.state === 'update');
    if (flag(parsed, 'dry-run')) {
      say(_('plan.dry-run.done'));
      return summary(planned);
    }
    if (!updates.length) return summary(planned);
    if (!(await confirmChange(parsed, _('confirm.repos-sync', { count: updates.length }), retryWithYes('repos sync', parsed)))) {
      say(_('confirm.declined'));
      return summary(planned);
    }
    const synced = applyReposSync(planned);
    printSyncItems(synced.filter((item, index) => item.state !== planned[index].state));
    return summary(synced);
  },
  'repos.pr': async parsed => {
    const options: PrOptions = { profile: text(parsed, 'profile'), targets: text(parsed, 'targets'), base: text(parsed, 'base'), draft: flag(parsed, 'draft'), message: text(parsed, 'message') };
    const dryRun = flag(parsed, 'dry-run');
    const prepared = prepareReposPrs(options, dryRun);
    try {
      if (!prepared.items.length) say(_('repos.none'));
      printPrItems(prepared.items);
      let items = prepared.items;
      if (dryRun) say(_('plan.dry-run.done'));
      else if (prepared.candidates.length) {
        if (!(await confirmChange(parsed, _('confirm.repos-pr', { count: prepared.candidates.length }), retryWithYes('repos pr', parsed)))) {
          say(_('confirm.declined'));
        } else {
          const opened = openPullRequests(prepared.candidates, options);
          printPrItems(opened);
          items = items.map(item => opened.find(result => result.target === item.target) ?? item);
        }
      }
      return { exitCode: worstExitCode(items.map(item => item.exitCode)), data: { repos: items } };
    } finally {
      prepared.cleanup();
    }
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
  return _('status.git', { name: state.name, remote: state.remote ?? '-', branch: state.remoteBranch ?? state.branch ?? '-', commit: (state.commit ?? '').slice(0, 7), dirty: state.dirty.length ? _('status.dirty', { count: state.dirty.length }) : _('status.clean'), position });
}
