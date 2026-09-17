import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, path as pathPrompt, select, text } from '@clack/prompts';
import { COMMANDS } from '../commands/registry.ts';
import { _ } from '../i18n/index.ts';
import { getProfiles } from '../profile/store.ts';
import { readRepos } from '../repos/registry.ts';
import { cancelled } from './cancel.ts';
import { runFromTui } from './commands.ts';
import { projectPathTui, runTuiStep } from './profile.ts';

/** Commands under the main menu's project check, in registry order. */
export const PROJECT_MENU_COMMANDS = COMMANDS.filter(command => command.tui?.startsWith('project.menu.'));
/** Commands under the main menu's repositories entry, in registry order. */
export const REPOS_MENU_COMMANDS = COMMANDS.filter(command => command.tui?.startsWith('repos.menu.'));

const cancelProject = () => cancel(_('project.cancel'));
const cancelRepos = () => cancel(_('repos.cancel'));

/** The agent to check; null stands for every agent. Returns undefined when cancelled. */
async function agentAnswer(): Promise<string | null | undefined> {
  const agent = await select<string>({
    message: _('project.agent.message'),
    options: [
      { value: 'all', label: _('project.agent.all') },
      { value: 'codex', label: _('explain.agent.codex') },
      { value: 'claude', label: _('explain.agent.claude') },
      { value: 'antigravity', label: _('explain.agent.antigravity') }
    ]
  });
  if (cancelled(agent)) return undefined;
  return agent === 'all' ? null : agent;
}

/**
 * Which profile's repositories to act on (--profile); null stands for every profile. With one profile or
 * none there is nothing to choose. Returns undefined when cancelled.
 */
async function profileFilterAnswer(profiles: readonly string[]): Promise<string | null | undefined> {
  if (profiles.length < 2) return null;
  const selected = await select<string>({
    message: _('repos.profile.message'),
    options: [{ value: '__all__', label: _('repos.profile.all') }, ...profiles.map(profile => ({ value: profile, label: profile }))]
  });
  if (cancelled(selected)) return undefined;
  return selected === '__all__' ? null : selected;
}

/** Profiles that have repositories on this computer's list. */
const listedProfiles = () => [...new Set(readRepos().map(entry => entry.profile))].sort();

/** Optional text; empty means "use the default". Returns undefined when cancelled. */
async function optionalText(message: string): Promise<string | undefined> {
  const value = await text({ message });
  if (cancelled(value)) return undefined;
  return (value ?? '').trim();
}

export const REPOSITORY_ACTIONS: Record<string, () => Promise<void>> = {
  check: async () => {
    const project = await projectPathTui(_('project.check.path'));
    if (!project) return cancelProject();
    const refresh = await confirm({ message: _('project.refresh.confirm'), initialValue: false });
    if (cancelled(refresh)) return cancelProject();
    await runFromTui('check', [project], { refresh });
  },
  explain: async () => {
    const folder = await projectPathTui(_('project.start.path'));
    if (!folder) return cancelProject();
    const agent = await agentAnswer();
    if (agent === undefined) return cancelProject();
    await runFromTui('explain', [folder], { agent });
  },
  verify: async () => {
    const folder = await projectPathTui(_('project.start.path'));
    if (!folder) return cancelProject();
    const agent = await agentAnswer();
    if (agent === undefined) return cancelProject();
    const evidence = await select<string>({
      message: _('project.evidence.message'),
      options: [
        { value: 'logs', label: _('project.evidence.logs.label'), hint: _('project.evidence.logs.hint') },
        { value: 'probe', label: _('project.evidence.probe.label'), hint: _('project.evidence.probe.hint') }
      ]
    });
    if (cancelled(evidence)) return cancelProject();
    await runFromTui('verify', [folder], { agent, probe: evidence === 'probe' });
  },
  'repos.list': async () => {
    const profile = await profileFilterAnswer(listedProfiles());
    if (profile === undefined) return cancelRepos();
    await runFromTui('repos.list', [], { profile });
    const missing = readRepos().filter(entry => !fs.existsSync(entry.path)).length;
    if (!missing) return;
    const prune = await confirm({ message: _('repos.prune.confirm', { count: missing }), initialValue: false });
    if (cancelled(prune)) return cancelRepos();
    if (!prune) return;
    await runFromTui('repos.list', [], { profile, prune: true });
  },
  'repos.status': async () => {
    const profile = await profileFilterAnswer(listedProfiles());
    if (profile === undefined) return cancelRepos();
    const refresh = await confirm({ message: _('repos.refresh.confirm'), initialValue: false });
    if (cancelled(refresh)) return cancelRepos();
    await runFromTui('repos.status', [], { profile, refresh });
  },
  'repos.sync': async () => {
    const profile = await profileFilterAnswer(listedProfiles());
    if (profile === undefined) return cancelRepos();
    await runFromTui('repos.sync', [], { profile });
  },
  'repos.pr': async () => {
    const source = await select<string>({
      message: _('repos.pr.source.message'),
      options: [
        { value: 'list', label: _('repos.pr.source.list.label'), hint: _('repos.pr.source.list.hint') },
        { value: 'targets', label: _('repos.pr.source.targets.label'), hint: _('repos.pr.source.targets.hint') }
      ]
    });
    if (cancelled(source)) return cancelRepos();
    let targets: string | null = null;
    if (source === 'targets') {
      const file = await pathPrompt({
        message: _('repos.pr.targets.message'),
        root: process.cwd(),
        initialValue: process.cwd(),
        validate(value) {
          const target = path.resolve((value ?? '').trim() || '.');
          if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return _('repos.pr.targets.invalid');
        }
      });
      if (cancelled(file)) return cancelRepos();
      targets = path.resolve(file.trim());
    }
    const profile = await profileFilterAnswer(source === 'list' ? listedProfiles() : getProfiles().map(entry => entry.name).sort());
    if (profile === undefined) return cancelRepos();
    const base = await optionalText(_('repos.pr.base.message'));
    if (base === undefined) return cancelRepos();
    const draft = await confirm({ message: _('repos.pr.draft.confirm'), initialValue: false });
    if (cancelled(draft)) return cancelRepos();
    const message = await optionalText(_('repos.pr.message.message'));
    if (message === undefined) return cancelRepos();
    await runFromTui('repos.pr', [], { profile, targets, base, draft, message });
  }
};

async function menu(title: string, message: string, commands: typeof PROJECT_MENU_COMMANDS, onCancel: () => void): Promise<void> {
  intro(title);
  const action = await select<string>({
    message,
    options: commands.map(command => ({ value: command.id, label: _(command.tui as string), hint: _((command.tui as string).replace(/\.label$/, '.hint')) }))
  });
  if (cancelled(action)) return onCancel();
  await runTuiStep(() => REPOSITORY_ACTIONS[action]());
}

export function projectCheckTui(): Promise<void> {
  return menu(_('project.intro'), _('project.menu.message'), PROJECT_MENU_COMMANDS, cancelProject);
}

export function reposTui(): Promise<void> {
  return menu(_('repos.intro'), _('repos.menu.message'), REPOS_MENU_COMMANDS, cancelRepos);
}
