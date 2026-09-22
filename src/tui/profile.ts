import fs from 'node:fs';
import path from 'node:path';
import { cancel, confirm, intro, multiselect, note, outro, path as pathPrompt, select, text } from '@clack/prompts';
import { cancelled } from './cancel.ts';
import { runFromTui } from './commands.ts';
import { canPrompt } from '../commands/options.ts';
import { COMMANDS } from '../commands/registry.ts';
import { _, getLocale, guidanceDescriptions, guidanceLabels, levelOptions, scopeOptions } from '../i18n/index.ts';
import { isJsonMode, say, type CommandOutcome } from '../commands/output.ts';
import { resolveProject } from '../profile/resolve.ts';
import { GUIDANCE_KEYS, guidanceDefaults, setupProfile } from '../profile/setup.ts';
import {
  brokenLinkHint,
  createProfile,
  getProfiles,
  isInstructionsPath,
  isProfileName,
  isScope,
  profileLocation,
  readProfile,
  readStore,
  regularFileInside,
  removeProfile,
  SCOPES,
  selectProfile,
  validateProfileName,
  type BrokenLink,
  type StoreContents
} from '../profile/store.ts';
import { checkLinkFolder, ruleFileChoices, suggestedName } from '../profile/link.ts';
import { PROFILE_METADATA_FILE } from '../shared/home.ts';
import { CliError, EXIT, usageError } from '../shared/errors.ts';
import { isGitRoot } from '../shared/git.ts';
import { PROJECT_CONFIG_FILE, readProjectConfig } from '../profile/apply.ts';
import { AGENT_IDS, canonicalAgents, recordedAgents, type AgentId } from '../shared/agents.ts';

/** TUI 단계 하나를 실행하고, 실패하면 TUI를 나가지 않고 다음 명령과 함께 안내로 보여 준다. */
export async function runTuiStep(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    note(error.hint ? `${error.message}\n\n${_('output.next')}: ${error.hint}` : error.message, _('output.error'));
  }
}

/**
 * 선택한 프로필 하나에 대한 동작. 등록부 순서다. 프로필 메뉴 항목이 있는 프로필 명령은 여기
 * 나타나므로, 메뉴가 명령을 빠뜨릴 수 없다.
 */
export const PROFILE_MENU_COMMANDS = COMMANDS.filter(
  command =>
    command.surface === 'profile' &&
    command.profileMenu &&
    !['profile.create', 'profile.list', 'profile.clone', 'profile.link'].includes(command.id)
);

export async function createProfileTui(): Promise<void> {
  if (!process.stdin.isTTY) {
    const [name, scope = 'personal'] = fs
      .readFileSync(0, 'utf8')
      .split(/\r?\n/)
      .map(value => value.trim());
    if (!name)
      throw usageError(
        'argument.missing',
        _('error.argument.missing', { usage: 'agctx profile create <name> [--scope <scope>]' }),
        _('hint.command.options', { command: 'profile create' })
      );
    createProfile(name, scope || 'personal');
    return;
  }
  intro(_('create.intro'));
  const name = await text({
    message: _('create.name.message'),
    placeholder: 'company-main',
    validate(value) {
      const trimmed = (value ?? '').trim();
      if (!trimmed || !isProfileName(trimmed)) return _('create.name.invalid');
    }
  });
  if (cancelled(name)) return cancel(_('create.cancel'));
  const scope = await select({
    message: _('create.scope.message'),
    options: scopeOptions(getLocale())
  });
  if (cancelled(scope)) return cancel(_('create.cancel'));
  const selectedScope = scopeOptions(getLocale()).find(option => option.value === scope);
  note(`${name.trim()}\n${selectedScope?.label}: ${selectedScope?.hint}`, _('create.note.title'));
  const approved = await confirm({ message: _('create.confirm'), initialValue: true });
  if (cancelled(approved) || !approved) return cancel(_('create.cancel'));
  createProfile(name.trim(), scope);
  outro(_('create.outro'));
}

export async function cloneProfileTui(): Promise<void> {
  if (!process.stdin.isTTY)
    throw usageError('tui.required', _('error.tui.required', { command: 'profile clone' }), _('hint.tui.clone'));
  intro(_('clone.intro'));
  const url = await text({
    message: _('clone.url.message'),
    placeholder: 'git@github.com:acme/agent-profile.git',
    validate: value => ((value ?? '').trim() ? undefined : _('clone.url.invalid'))
  });
  if (cancelled(url)) return cancel(_('clone.cancel'));
  const branch = await text({ message: _('clone.branch.message') });
  if (cancelled(branch)) return cancel(_('clone.cancel'));
  await runFromTui('profile.clone', [url.trim()], { branch: (branch ?? '').trim() });
  outro(_('clone.outro'));
}

/** 나열된 AGENTS.md 대신 규칙 파일 경로를 입력하겠다는 선택 값. */
export const OTHER_RULES_FILE = '__other__';

/**
 * TUI가 `dir`에 대해 제안하는 규칙 파일: `profile link`가 찾는 모든 AGENTS.md, 그중 스스로 가져갈
 * 파일을 맨 앞에 미리 고른 채로, 그리고 그 사람이 직접 입력하는 경로. 그래서 `--instructions`처럼
 * 어떤 규칙 파일이든 고를 수 있다.
 */
export function linkRuleOptions(dir: string): { options: { value: string; label: string }[]; initial?: string } {
  const { detected, candidates } = ruleFileChoices(dir);
  const ordered = detected ? [detected, ...candidates.filter(file => file !== detected)] : candidates;
  return {
    options: [
      ...ordered.map(file => ({ value: file, label: file })),
      { value: OTHER_RULES_FILE, label: _('link.rules.other') }
    ],
    ...(detected ? { initial: detected } : {})
  };
}

/** TUI 연결이 어떻게 끝났는지. 명령이 돌려준 것에서 읽는다: 연결됨, 바꿀 것 없음, 거절, 실패. */
export function linkOutro(outcome: CommandOutcome): 'done' | 'unchanged' | 'declined' | 'failed' {
  if (outcome.exitCode !== EXIT.ok) return 'failed';
  const data = (outcome.data ?? {}) as { written?: boolean; link?: string; metadata?: string };
  if (data.written) return 'done';
  return data.link === 'unchanged' && data.metadata === 'keep' ? 'unchanged' : 'declined';
}

/** TUI가 `dir`에 제안하는 프로필 이름: 폴더 이름, 또는 이름 규칙에 맞는 가장 가까운 이름. */
export function linkNameDefault(dir: string): string {
  return suggestedName(path.basename(dir)) ?? path.basename(dir);
}

/**
 * 규칙 저장소 폴더를 묻고 프로필로 연결한다. 폴더에 profile.json이 있으면 그것이 이름, 범위, 규칙
 * 파일을 정하고, 없으면 그 사람이 고른다. 명령은 계획을 보여 주고 쓰기 전에 묻고, TUI는 실제로
 * 일어난 일로 끝난다.
 */
export async function linkProfileTui(): Promise<void> {
  if (!process.stdin.isTTY)
    throw usageError('tui.required', _('error.tui.required', { command: 'profile link' }), _('hint.tui.link'));
  intro(_('link.intro'));
  const chosen = await projectPathTui(_('link.path.message'));
  if (!chosen) return cancel(_('link.cancel'));
  // 규칙 파일을 찾기 전에 폴더를 검사해서, 홈 폴더나 저장소 안의 폴더는 읽지 않고 안내와 함께 멈춘다.
  const dir = checkLinkFolder(chosen);
  const answers: Record<string, string | null> = { name: null, scope: null, instructions: null };
  if (!fs.existsSync(path.join(dir, PROFILE_METADATA_FILE))) {
    const rules = linkRuleOptions(dir);
    let instructions: string | symbol = OTHER_RULES_FILE;
    if (rules.options.length > 1) {
      instructions = await select<string>({
        message: _('link.rules.message'),
        options: rules.options,
        ...(rules.initial ? { initialValue: rules.initial } : {})
      });
      if (cancelled(instructions)) return cancel(_('link.cancel'));
    }
    if (instructions === OTHER_RULES_FILE) {
      const typed = await text({
        message: _('link.rules.path.message'),
        placeholder: 'rules/AGENTS.md',
        validate(value) {
          const file = (value ?? '').trim();
          if (!isInstructionsPath(file) || !regularFileInside(dir, file)) return _('link.rules.path.invalid');
        }
      });
      if (cancelled(typed)) return cancel(_('link.cancel'));
      instructions = typed.trim();
    }
    const name = await text({
      message: _('link.name.message'),
      initialValue: linkNameDefault(dir),
      validate(value) {
        if (!isProfileName((value ?? '').trim())) return _('create.name.invalid');
      }
    });
    if (cancelled(name)) return cancel(_('link.cancel'));
    answers.name = name.trim();
    const scope = await select({ message: _('create.scope.message'), options: scopeOptions(getLocale()) });
    if (cancelled(scope)) return cancel(_('link.cancel'));
    answers.instructions = instructions as string;
    answers.scope = scope;
  }
  const result = linkOutro(await runFromTui('profile.link', [dir], answers));
  if (result === 'done') outro(_('link.outro'));
  else if (result === 'unchanged') outro(_('link.outro.unchanged'));
  else if (result === 'declined') cancel(_('link.cancel'));
}

function brokenLabel(link: BrokenLink): string {
  return _('list.broken', { name: link.name, path: link.path, reason: _(`list.broken.${link.reason}`) });
}

/**
 * TUI 목록에서 고른 프로필이 여는 메뉴: 그 프로필의 동작, 또는 끊긴 링크에 허락되는 삭제. 목록은
 * 이미 읽은 끊긴 링크를 넘긴다.
 */
export function menuFor(
  name: string,
  broken: readonly BrokenLink[] = readStore().brokenLinks
): 'profile' | 'broken-link' {
  return broken.some(link => link.name === name) ? 'broken-link' : 'profile';
}

/** 끊긴 링크에 대해 TUI가 하는 말: 어디를 가리키는지와, 되살리거나 버리는 명령. */
export function brokenLinkNote(name: string): string {
  const link = profileLocation(name)?.link ?? '';
  const hint = brokenLinkHint(name);
  return [_('broken.menu.message', { name, path: link }), ...(hint ? [hint] : [])].join('\n');
}

/**
 * 끊긴 링크는 TUI에서 지우기만 한다. 되살리는 길은 remove 뒤 link이고, 안내는 링크를 만들 때의 범위와
 * 규칙 파일을 넣은 그 명령을 보여 준다.
 */
async function brokenLinkTui(name: string): Promise<void> {
  note(brokenLinkNote(name), _('list.broken.title'));
  return removeProfileTui(name);
}

/**
 * TUI가 지울 수 있는 모든 보관함 항목: 프로필, 끊긴 링크, 프로필이 아닌 폴더. 그래서 동작을 멈춘
 * 링크나 남은 폴더도 치울 수 있다.
 */
export function removeChoices(): { value: string; label: string; hint: string }[] {
  const store = readStore();
  return [
    ...store.profiles.map(profile => ({
      value: profile.name,
      label: `${profile.scope} · ${profile.name}`,
      hint: _('remove.select.hint')
    })),
    ...store.brokenLinks.map(link => ({ value: link.name, label: brokenLabel(link), hint: _('remove.select.hint') })),
    ...store.unreadable.map(name => ({
      value: name,
      label: _('remove.unreadable', { name }),
      hint: _('remove.select.hint')
    }))
  ];
}

/**
 * `name`을 지우기 전에 TUI가 하는 말: 링크는 가리키는 폴더를 남기고, 프로필은 범위와 함께 사라지며,
 * 프로필이 아닌 보관함 폴더는 그렇다고 알린다.
 */
export function removeNote(name: string): string {
  validateProfileName(name);
  const location = profileLocation(name);
  if (location?.link) return _('remove.note.link', { name, path: location.link });
  if (location?.kind === 'symlink') return _('remove.note.link', { name, path: fs.realpathSync.native(location.dir) });
  if (location?.metadata) return _('remove.note.body', { scope: location.metadata.scope, name });
  return _('remove.note.unreadable', { name, path: location?.dir ?? name });
}

/** 프로필의 Git 상태를 보여 주기 전에 TUI가 fetch할지 묻는지. 연결된 폴더는 그 사람의 것이라 fetch하지 않는다. */
export function statusRefreshPrompt(name: string): { ask: boolean } {
  return { ask: !profileLocation(name)?.link };
}

export async function listProfiles(
  scopeFilter: string | null = null,
  store: StoreContents = readStore()
): Promise<void> {
  if (scopeFilter !== null && !isScope(scopeFilter))
    throw usageError(
      'profile.invalid-scope',
      _('error.profile.invalid-scope', { scope: scopeFilter, scopes: SCOPES.join(', ') }),
      null
    );
  let profiles = store.profiles;
  if (scopeFilter) profiles = profiles.filter(profile => profile.scope === scopeFilter);
  const broken = scopeFilter ? [] : store.brokenLinks;
  const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !isJsonMode();
  if (!profiles.length && !broken.length && !interactive) {
    say(scopeFilter ? _('list.empty.scope', { scope: scopeFilter }) : _('list.empty'));
    return;
  }
  const grouped = new Map<string, string[]>();
  for (const metadata of profiles) {
    const names = grouped.get(metadata.scope) ?? [];
    names.push(metadata.link ? _('list.linked', { name: metadata.name, path: metadata.link }) : metadata.name);
    grouped.set(metadata.scope, names);
  }
  if (interactive) {
    intro(_('list.intro'));
    if (!scopeFilter && profiles.length) {
      const selectedScope = await select<string>({
        message: _('list.scope.message'),
        options: [
          { value: '__all__', label: _('list.scope.all'), hint: _('list.scope.allHint', { n: profiles.length }) },
          ...scopeOptions(getLocale())
            .filter(option => profiles.some(profile => profile.scope === option.value))
            .map(option => ({
              ...option,
              hint: _('list.scope.hint', {
                n: profiles.filter(profile => profile.scope === option.value).length,
                hint: option.hint
              })
            }))
        ]
      });
      if (cancelled(selectedScope)) return cancel(_('list.cancel'));
      if (selectedScope !== '__all__') return listProfiles(selectedScope, store);
    }
    for (const [scope, names] of grouped) note(names.join('\n'), scope);
    if (broken.length) note(broken.map(brokenLabel).join('\n'), _('list.broken.title'));
    const selected = await select<string>({
      message: _('list.manage.message'),
      options: [
        { value: '__create__', label: _('list.create.label'), hint: _('main.create.hint') },
        { value: '__clone__', label: _('list.clone.label'), hint: _('main.clone.hint') },
        { value: '__link__', label: _('list.link.label'), hint: _('main.link.hint') },
        ...profiles.map(profile => ({
          value: profile.name,
          label: `${profile.scope} · ${profile.name}`,
          hint: profile.link ? _('list.linked.hint', { path: profile.link }) : _('list.manage.hint')
        })),
        ...broken.map(link => ({ value: link.name, label: brokenLabel(link), hint: _('list.broken.hint') }))
      ]
    });
    if (cancelled(selected)) return cancel(_('list.cancel'));
    if (selected === '__create__') return createProfileTui();
    if (selected === '__clone__') return cloneProfileTui();
    if (selected === '__link__') return linkProfileTui();
    if (menuFor(selected, broken) === 'broken-link') return brokenLinkTui(selected);
    await profileActions(selected);
    return;
  }
  for (const [scope, names] of grouped) {
    say(`[${scope}]`);
    for (const name of names) say(`  ${name}`);
  }
  if (broken.length) {
    say(`[${_('list.broken.title')}]`);
    for (const link of broken) say(`  ${brokenLabel(link)}`);
  }
}

export async function projectPathTui(message: string): Promise<string | null> {
  const target = await pathPrompt({
    message,
    root: process.cwd(),
    directory: true,
    initialValue: process.cwd(),
    validate(value) {
      const targetPath = path.resolve((value ?? '').trim() || '.');
      if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) return _('project.path.invalid');
    }
  });
  if (cancelled(target)) return null;
  return target.trim() || process.cwd();
}

/**
 * TUI 적용 흐름이 고정할지 묻는지와, 어떤 답을 미리 고르는지. Git 프로필만 고정할 수 있고, 이미
 * 고정한 프로젝트는 그 사람이 달리 고르지 않으면 고정을 유지해서, 메뉴에서 적용해도 고정이 조용히
 * 풀리지 않는다.
 */
export function pinPrompt(name: string, targetDir: string): { ask: boolean; initial: boolean } {
  if (!isGitRoot(readProfile(name).profileDir)) return { ask: false, initial: false };
  return { ask: true, initial: readProjectConfig(path.join(targetDir, PROJECT_CONFIG_FILE)).pin === true };
}

/**
 * TUI 적용 흐름에서 미리 체크할 에이전트. 저장소가 기록한 선택이 있으면 그것을, 없으면 전부를 체크한다.
 * 기록이 잘못돼 있으면 전부를 체크해 보여 준다. 고른 답이 `--agent`로 넘어가 잘못된 기록을 덮어쓴다.
 */
export function agentPrompt(targetDir: string): AgentId[] {
  const configPath = path.join(targetDir, PROJECT_CONFIG_FILE);
  try {
    return recordedAgents(readProjectConfig(configPath).agents, configPath) ?? [...AGENT_IDS];
  } catch {
    return [...AGENT_IDS];
  }
}

/** 체크한 에이전트를 `--agent` 값으로. 전부 골랐으면 `all`이라 기록이 지워지고 나중에 늘어날 에이전트도 받는다. */
export function agentAnswer(selected: readonly AgentId[]): string {
  const chosen = canonicalAgents(selected);
  return chosen.length === AGENT_IDS.length ? 'all' : chosen.join(',');
}

async function agentChoiceTui(targetDir: string): Promise<string | null> {
  const selected = await multiselect<AgentId>({
    message: _('actions.apply.agents'),
    required: true,
    initialValues: agentPrompt(targetDir),
    options: AGENT_IDS.map(agent => ({
      value: agent,
      label: _(`explain.agent.${agent}`),
      hint: _(`actions.apply.agents.${agent}`)
    }))
  });
  if (cancelled(selected)) return null;
  return agentAnswer(selected);
}

/** 프로필 메뉴 항목마다 하는 일. 키는 등록부의 명령 id다. */
export const MENU_ACTIONS: Record<string, (name: string) => Promise<void>> = {
  'profile.setup': name => setupProfileTui(name),
  'profile.view': async name => {
    const profile = readProfile(name);
    note(`${profile.metadata.scope}\n\n${fs.readFileSync(profile.instructionsPath, 'utf8').trim()}`, name);
    outro(_('actions.view.outro'));
  },
  'profile.apply': async name => {
    const target = await projectPathTui(_('actions.apply.path'));
    if (!target) return cancel(_('actions.project.cancel'));
    const agent = await agentChoiceTui(target);
    if (agent === null) return cancel(_('actions.project.cancel'));
    const choice = pinPrompt(name, target);
    let pin = false;
    if (choice.ask) {
      const answer = await confirm({ message: _('actions.apply.pin'), initialValue: choice.initial });
      if (cancelled(answer)) return cancel(_('actions.project.cancel'));
      pin = answer;
    }
    await withConflictRecovery(target, ({ adopt }) =>
      runFromTui('profile.apply', [name, target], { agent, pin, adopt })
    );
  },
  'profile.sync': async () => {
    const target = await projectPathTui(_('actions.sync.path'));
    if (!target) return cancel(_('actions.project.cancel'));
    await withConflictRecovery(target, ({ adopt }) => runFromTui('profile.sync', [target], { adopt }));
  },
  'profile.resolve': () => resolveProjectTui(),
  'profile.remove': name => removeProfileTui(name),
  'profile.status': async name => {
    let refresh = false;
    if (statusRefreshPrompt(name).ask) {
      const answer = await confirm({ message: _('actions.status.refresh'), initialValue: true });
      if (cancelled(answer)) return cancel(_('actions.project.cancel'));
      refresh = answer;
    }
    await runFromTui('profile.status', [name], { refresh });
  },
  'profile.pull': async name => {
    const preview = await runFromTui('profile.pull', [name], { 'dry-run': true });
    const commits = (preview.data as { commits?: string[] } | undefined)?.commits ?? [];
    if (!commits.length) return;
    const approved = await confirm({ message: _('confirm.pull', { name, count: commits.length }), initialValue: true });
    if (cancelled(approved) || !approved) return cancel(_('actions.project.cancel'));
    await runFromTui('profile.pull', [name], {});
  },
  'profile.push': async name => {
    await runFromTui('profile.push', [name], {});
  },
  'profile.connect': async name => {
    const url = await text({
      message: _('connect.url.message'),
      placeholder: 'git@github.com:acme/agent-profile.git',
      validate: value => ((value ?? '').trim() ? undefined : _('clone.url.invalid'))
    });
    if (cancelled(url)) return cancel(_('actions.project.cancel'));
    const branch = await text({ message: _('connect.branch.message') });
    if (cancelled(branch)) return cancel(_('actions.project.cancel'));
    await runFromTui('profile.connect', [name, url.trim()], { branch: (branch ?? '').trim() });
  }
};

export async function profileActions(name: string): Promise<void> {
  const action = await select<string>({
    message: _('actions.message', { name }),
    options: PROFILE_MENU_COMMANDS.map(command => ({
      value: command.id,
      label: _(command.profileMenu as string),
      hint: _(`${(command.profileMenu as string).replace(/\.label$/, '')}.hint`)
    }))
  });
  if (cancelled(action)) return cancel(_('list.cancel'));
  await runTuiStep(() => MENU_ACTIONS[action](name));
}

/**
 * apply·sync가 멈춘 오류에 TUI가 제안할 다음 단계. 관리 영역을 고쳤으면 resolve, agctx 표지가 없는
 * 기존 파일이면 그 파일에 관리 영역을 더할지(--adopt) 묻는다.
 */
export function recoveryFor(error: unknown): 'resolve' | 'adopt' | null {
  if (!(error instanceof CliError)) return null;
  if (error.code === 'project.conflict') return 'resolve';
  if (error.code === 'project.unmanaged') return 'adopt';
  return null;
}

/** apply나 sync를 실행한다. 멈추면 사용자를 오류에 두지 않고 다음 단계를 제안한다. */
async function withConflictRecovery(
  target: string,
  step: (answers: { adopt: boolean }) => Promise<unknown>
): Promise<void> {
  try {
    await step({ adopt: false });
  } catch (error) {
    const recovery = recoveryFor(error);
    if (!recovery || !(error instanceof CliError)) throw error;
    if (recovery === 'adopt') {
      note(error.message, _('adopt.title'));
      const adopt = await confirm({ message: _('adopt.offer'), initialValue: false });
      if (cancelled(adopt) || !adopt) return cancel(_('actions.project.cancel'));
      await withConflictRecovery(target, () => step({ adopt: true }));
      return;
    }
    note(`${error.message}\n\n${_('output.next')}: ${error.hint ?? ''}`, _('resolve.conflict.title'));
    const next = await confirm({ message: _('resolve.offer'), initialValue: true });
    if (cancelled(next) || !next) return cancel(_('actions.project.cancel'));
    await resolveProjectTui(target);
  }
}

/** 프로젝트의 충돌을 미리 보여 주고, 사용자가 고르는 방식으로 푼다. */
export async function resolveProjectTui(target: string | null = null): Promise<void> {
  const project = target || (await projectPathTui(_('resolve.path')));
  if (!project) return cancel(_('actions.project.cancel'));
  let preview: { conflicts: number } | null = null;
  try {
    preview = await resolveProject(project, { dryRun: true, discard: false, edit: false }, async () => false);
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    note(error.message, _('resolve.conflict.title'));
  }
  if (preview?.conflicts === 0) return outro(_('resolve.nothing'));
  const mode = await select<string>({
    message: _('resolve.mode.message'),
    options: [
      { value: 'auto', label: _('resolve.mode.auto'), hint: _('resolve.mode.auto.hint') },
      { value: 'edit', label: _('resolve.mode.edit'), hint: _('resolve.mode.edit.hint') },
      { value: 'discard', label: _('resolve.mode.discard'), hint: _('resolve.mode.discard.hint') }
    ]
  });
  if (cancelled(mode)) return cancel(_('actions.project.cancel'));
  const run = (adopt: boolean) =>
    resolveProject(
      project,
      { dryRun: false, discard: mode === 'discard', edit: mode === 'edit', adopt },
      async () => true
    );
  try {
    await run(false);
  } catch (error) {
    // 표지 없는 파일이 함께 있으면 resolve도 편입을 허락받기 전에는 쓰지 않는다.
    if (recoveryFor(error) !== 'adopt' || !(error instanceof CliError)) throw error;
    note(error.message, _('adopt.title'));
    const adopt = await confirm({ message: _('adopt.offer'), initialValue: false });
    if (cancelled(adopt) || !adopt) return cancel(_('actions.project.cancel'));
    await run(true);
  }
  outro(_('resolve.outro'));
}

export async function removeProfileTui(name: string | null = null): Promise<void> {
  if (!canPrompt())
    throw usageError(
      'confirm.required',
      _('error.confirm.required'),
      _('hint.confirm.yes', { command: `agctx profile remove ${name ?? '<name>'} --yes` })
    );
  intro(_('remove.intro'));
  if (!name) {
    const choices = removeChoices();
    if (!choices.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
    const selected = await select<string>({ message: _('remove.select'), options: choices });
    if (cancelled(selected)) return cancel(_('remove.cancel'));
    name = selected;
  }
  if (!profileLocation(name))
    throw usageError('profile.not-found', _('error.profile.not-found', { name }), _('hint.profile.list'));
  note(removeNote(name), _('remove.note.title'));
  const approved = await confirm({ message: _('remove.confirm'), initialValue: false });
  if (cancelled(approved) || !approved) return cancel(_('remove.cancel'));
  removeProfile(name);
  outro(_('remove.outro'));
}

export async function setupProfileTui(name: string | null = null): Promise<void> {
  if (!process.stdin.isTTY) {
    const answers = fs
      .readFileSync(0, 'utf8')
      .split(/\r?\n/)
      .map(value => value.trim());
    if (!name) name = selectProfile(answers.shift());
    const profile = readProfile(name);
    const values: string[] = [];
    for (const [index, key] of GUIDANCE_KEYS.entries()) {
      values.push(`--${key}`, answers[index] || profile.metadata.settings?.[key] || guidanceDefaults[key]);
    }
    setupProfile(name, values);
    return;
  }
  intro(_('setup.intro'));
  const labels = guidanceLabels(getLocale());
  const descriptions = guidanceDescriptions(getLocale());
  const levels = levelOptions(getLocale());
  const profiles = getProfiles();
  if (!name) {
    if (!profiles.length) throw usageError('profile.none', _('error.profile.none'), _('hint.profile.create'));
    const selected = await select<string>({
      message: _('setup.select'),
      options: profiles.map(profile => ({
        value: profile.name,
        label: `${profile.scope} · ${profile.name}`,
        hint: _('setup.select.hint')
      }))
    });
    if (cancelled(selected)) return cancel(_('setup.cancel'));
    name = selected;
  }
  const profile = readProfile(name);
  const values: string[] = [];
  for (const key of GUIDANCE_KEYS) {
    const current = profile.metadata.settings?.[key] || guidanceDefaults[key];
    const value = await select({
      message: _('setup.item.message', { label: labels[key], description: descriptions[key] }),
      options: levels,
      initialValue: current
    });
    if (cancelled(value)) return cancel(_('setup.cancel'));
    values.push(`--${key}`, value);
  }
  const summary = GUIDANCE_KEYS.map(key => `${labels[key]}: ${values[values.indexOf(`--${key}`) + 1]}`).join('\n');
  note(summary, _('setup.note.title', { name }));
  const approved = await confirm({ message: _('setup.confirm'), initialValue: true });
  if (cancelled(approved) || !approved) return cancel(_('setup.cancel'));
  setupProfile(name, values);
  outro(_('setup.outro'));
}
