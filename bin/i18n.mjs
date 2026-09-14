/**
 * Locale resolution and message catalog for the Agentic CLI.
 *
 * The default locale is `ko`, so with no flag, environment variable, saved
 * choice, or interactive prompt the CLI behaves exactly as before. English is
 * opt-in.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeTextAtomic } from './fs-utils.mjs';

export const SUPPORTED_LOCALES = ['ko', 'en'];
export const DEFAULT_LOCALE = 'ko';

const LEGACY_CORES_DIR = '.agentic-cores';        // pre-rename layout (Core era)
const LEGACY_PROFILES_DIR = '.agentic-profiles';  // post-rename, pre-nesting layout
const LEGACY_METADATA_FILE = 'agentic-core.json';
const AGENTIC_DIR = '.agentic';
const PROFILES_SUBDIR = 'profiles';
const CONFIG_FILE = 'config.json';
export const PROFILE_METADATA_FILE = 'agentic-profile.json';

/**
 * Move a flat legacy home (`.agentic-cores` or `.agentic-profiles`) into
 * `.agentic/profiles`, lift its `config.json` up to `.agentic/config.json`,
 * and, for the Core-era layout, rename each `agentic-core.json` to
 * `agentic-profile.json`. Best-effort and one-time: if anything fails, fall
 * back to the new (possibly empty) home instead of crashing the CLI.
 */
function migrateFlatHome(flatDir, agenticDir, profilesDir, { renameMetadata }) {
  try {
    fs.mkdirSync(agenticDir, { recursive: true });
    fs.renameSync(flatDir, profilesDir);
  } catch {
    return;
  }
  if (renameMetadata) {
    for (const entry of fs.readdirSync(profilesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const legacyMetadata = path.join(profilesDir, entry.name, LEGACY_METADATA_FILE);
      const currentMetadata = path.join(profilesDir, entry.name, PROFILE_METADATA_FILE);
      if (fs.existsSync(legacyMetadata) && !fs.existsSync(currentMetadata)) {
        try { fs.renameSync(legacyMetadata, currentMetadata); } catch {}
      }
    }
  }
  // config.json sat beside the profile dirs in the flat layout; lift it out.
  const movedConfig = path.join(profilesDir, CONFIG_FILE);
  const targetConfig = path.join(agenticDir, CONFIG_FILE);
  if (fs.existsSync(movedConfig) && !fs.existsSync(targetConfig)) {
    try { fs.renameSync(movedConfig, targetConfig); } catch {}
  }
}

/**
 * Resolve the user's profile home (`<base>/.agentic/profiles`), migrating a
 * legacy `.agentic-profiles` or `.agentic-cores` home once on first use.
 */
export function profileHome() {
  const base = process.env.AGENTIC_HOME || os.homedir();
  const agenticDir = path.join(base, AGENTIC_DIR);
  const current = path.join(agenticDir, PROFILES_SUBDIR);
  if (!fs.existsSync(current)) {
    const legacyProfiles = path.join(base, LEGACY_PROFILES_DIR);
    const legacyCores = path.join(base, LEGACY_CORES_DIR);
    if (fs.existsSync(legacyProfiles)) migrateFlatHome(legacyProfiles, agenticDir, current, { renameMetadata: false });
    else if (fs.existsSync(legacyCores)) migrateFlatHome(legacyCores, agenticDir, current, { renameMetadata: true });
  }
  return current;
}

/** The locale config lives beside the profiles dir, at `<base>/.agentic/config.json`. */
function configPath() {
  profileHome(); // trigger the one-time legacy migration before reading or writing config
  return path.join(process.env.AGENTIC_HOME || os.homedir(), AGENTIC_DIR, CONFIG_FILE);
}

export function readAgenticConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (config && typeof config === 'object' && !Array.isArray(config)) return config;
  } catch {}
  return {};
}

export function getSavedLocale() {
  const locale = readAgenticConfig().locale;
  return SUPPORTED_LOCALES.includes(locale) ? locale : null;
}

export function saveLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) throw new Error(`locale must be one of: ${SUPPORTED_LOCALES.join(', ')}.`);
  const config = { ...readAgenticConfig(), locale };
  fs.mkdirSync(profileHome(), { recursive: true });
  writeTextAtomic(configPath(), JSON.stringify(config, null, 2) + '\n');
  return locale;
}

function validated(source, value) {
  if (!SUPPORTED_LOCALES.includes(value)) throw new Error(`${source} must be one of: ${SUPPORTED_LOCALES.join(', ')}.`);
  return value;
}

/**
 * Decide the active locale from the fixed precedence order:
 *   1. --lang flag        (this run only; invalid value throws)
 *   2. AGENTIC_LANG env    (invalid value throws)
 *   3. saved user choice   (invalid value ignored)
 *   4. interactive (TTY) → null, meaning the caller must prompt and save
 *      non-interactive     → DEFAULT_LOCALE (ko), the pre-i18n behavior
 */
export function resolveLocale({ flag = null, env = null, saved = null, isTTY = false } = {}) {
  if (flag != null) return validated('--lang', flag);
  if (env != null && env !== '') return validated('AGENTIC_LANG', env);
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  if (!isTTY) return DEFAULT_LOCALE;
  return null;
}

const messages = {
  ko: {
    'create.intro': 'Agentic 프로필 생성',
    'create.name.message': '프로필 이름을 입력하세요.',
    'create.name.invalid': '영문 소문자, 숫자, 하이픈으로 1-64자를 입력하세요.',
    'create.scope.message': '프로필의 용도를 선택하세요.',
    'create.note.title': '생성할 프로필',
    'create.confirm': '이 프로필을 생성할까요?',
    'create.cancel': '프로필 생성을 취소했습니다.',
    'create.outro': '프로필이 생성되었습니다.',

    'list.intro': 'Agentic 프로필',
    'list.scope.message': '확인할 프로필 범위를 선택하세요.',
    'list.scope.all': '전체 scope',
    'list.scope.allHint': '{n}개 프로필',
    'list.scope.hint': '{n}개 프로필 · {hint}',
    'list.cancel': '프로필 관리를 취소했습니다.',
    'list.manage.message': '관리할 프로필을 선택하세요.',
    'list.create.label': '새 프로필 생성',
    'list.manage.hint': '선택 후 작업 메뉴 열기',

    'project.path.invalid': '존재하는 프로젝트 폴더를 선택하세요.',

    'actions.message': '{name}에서 수행할 작업을 선택하세요.',
    'actions.setup.label': '지침 설정',
    'actions.setup.hint': 'TDD·변경 검토·검증·문서화·보안 수준 변경',
    'actions.apply.label': '프로젝트에 적용',
    'actions.apply.hint': '선택한 프로필을 프로젝트에 처음 적용',
    'actions.sync.label': '프로젝트 동기화',
    'actions.sync.hint': '변경된 프로필 지침을 프로젝트에 재적용',
    'actions.view.label': '상세 보기',
    'actions.view.hint': 'scope와 현재 프로필 지침 확인',
    'actions.remove.label': '프로필 삭제',
    'actions.remove.hint': '확인 후 프로필 원본과 설정 삭제',
    'actions.view.outro': '프로필 상세 보기 완료',
    'actions.apply.path': '적용할 프로젝트 경로를 입력하세요.',
    'actions.sync.path': '동기화할 프로젝트 경로를 입력하세요.',
    'actions.project.cancel': '프로젝트 작업을 취소했습니다.',
    'actions.preview.confirm': '실제 변경 전에 계획만 확인할까요?',
    'actions.outro.preview': '변경 계획 확인 완료',
    'actions.outro.apply': '프로필 적용 완료',
    'actions.outro.sync': '프로필 동기화 완료',
    'actions.resolve.label': '프로젝트 충돌 해결',
    'actions.resolve.hint': '관리 영역 안의 편집을 밖으로 옮기고 관리 영역을 다시 생성',

    'resolve.path': '충돌을 해결할 프로젝트 경로를 입력하세요.',
    'resolve.conflict.title': '관리 영역 충돌',
    'resolve.offer': '충돌 해결로 이어갈까요?',
    'resolve.mode.message': '충돌을 어떻게 해결할까요?',
    'resolve.mode.auto': '자동 해결',
    'resolve.mode.auto.hint': '내 편집을 관리 영역 밖으로 옮기고 관리 영역을 다시 생성',
    'resolve.mode.edit': 'VS Code에서 병합',
    'resolve.mode.edit.hint': '마지막 적용본을 base로 3-way merge 편집기를 연다',
    'resolve.mode.discard': '백업 후 다시 생성',
    'resolve.mode.discard.hint': '현재 파일을 .agentic/backups/에 복사한 뒤 관리 영역을 새로 만든다',
    'resolve.nothing': '해결할 충돌이 없습니다.',
    'resolve.outro': '충돌 해결 완료',

    'main.intro': 'Agentic',
    'main.message': '무엇을 할까요?',
    'main.manage.label': '프로필 관리',
    'main.manage.hint': '프로필 선택 후 설정·적용·동기화·조회·삭제',
    'main.create.label': '새 프로필 생성',
    'main.create.hint': '이름과 scope를 입력해 프로필 생성',
    'main.setup.label': '프로필 지침 설정',
    'main.setup.hint': '프로필을 선택하고 지침 수준 설정',
    'main.lang.label': '언어 / Language',
    'main.lang.hint': '표시 언어 변경 (한국어/English)',
    'main.help.label': '도움말',
    'main.help.hint': 'CLI 명령과 자동화 방식 확인',
    'main.exit.label': '종료',
    'main.outro': 'Agentic을 종료했습니다.',

    'lang.prompt.message': '언어를 선택하세요 / Select your language',
    'lang.saved': '언어 설정을 저장했습니다: {locale}',
    'lang.cancel': '언어 선택을 취소했습니다.',

    'remove.intro': 'Agentic 프로필 삭제',
    'remove.select': '삭제할 프로필을 선택하세요.',
    'remove.select.hint': '프로필 원본과 설정만 삭제',
    'remove.note.title': '삭제 대상',
    'remove.note.body': '{scope} · {name}\n프로젝트에 이미 적용된 파일은 변경되지 않습니다.',
    'remove.confirm': '이 프로필을 영구 삭제할까요?',
    'remove.cancel': '프로필 삭제를 취소했습니다.',
    'remove.outro': '프로필이 삭제되었습니다.',

    'setup.intro': 'Agentic 프로필 지침 설정',
    'setup.select': '설정할 프로필을 선택하세요.',
    'setup.select.hint': '공통 지침을 설정할 프로필',
    'setup.item.message': '{label} — {description}',
    'setup.note.title': '{name}에 적용할 지침',
    'setup.confirm': '이 설정을 프로필에 저장할까요?',
    'setup.cancel': '프로필 설정을 취소했습니다.',
    'setup.outro': '프로필 지침이 설정되었습니다.',
    'setup.block.level': '적용 수준',
    'setup.legend.title': '적용 수준 정의',
    'setup.legend.intro': '아래 각 지침의 `적용 수준`은 이 정의를 따른다.',

    'scaffold.extHeading': '## 4. 프로젝트 규칙 확장 (SSOT)',
    'scaffold.extBody': '이 프로젝트에만 적용되는 도메인 규칙은 이 섹션 아래에 추가한다. 프로필에는 역으로 동기화하지 않는다.'
  },
  en: {
    'create.intro': 'Create an Agentic Profile',
    'create.name.message': 'Enter a profile name.',
    'create.name.invalid': 'Use 1-64 lowercase letters, numbers, or hyphens.',
    'create.scope.message': 'Select what this profile is for.',
    'create.note.title': 'Profile to create',
    'create.confirm': 'Create this profile?',
    'create.cancel': 'Profile creation cancelled.',
    'create.outro': 'Profile created.',

    'list.intro': 'Agentic Profiles',
    'list.scope.message': 'Select the profile scope to view.',
    'list.scope.all': 'All scopes',
    'list.scope.allHint': '{n} profiles',
    'list.scope.hint': '{n} profiles · {hint}',
    'list.cancel': 'Profile management cancelled.',
    'list.manage.message': 'Select a profile to manage.',
    'list.create.label': 'Create a new profile',
    'list.manage.hint': 'Open the action menu after selecting',

    'project.path.invalid': 'Select an existing project folder.',

    'actions.message': 'Select an action for {name}.',
    'actions.setup.label': 'Configure guidance',
    'actions.setup.hint': 'Change levels for TDD, change review, verification, documentation, and security',
    'actions.apply.label': 'Apply to a project',
    'actions.apply.hint': 'Apply the selected profile to a project for the first time',
    'actions.sync.label': 'Sync a project',
    'actions.sync.hint': 'Re-apply changed profile guidance to a project',
    'actions.view.label': 'View details',
    'actions.view.hint': 'Check the scope and current profile guidance',
    'actions.remove.label': 'Delete profile',
    'actions.remove.hint': 'Delete the profile source and settings after confirmation',
    'actions.view.outro': 'Profile details shown',
    'actions.apply.path': 'Enter the project path to apply to.',
    'actions.sync.path': 'Enter the project path to sync.',
    'actions.project.cancel': 'Project operation cancelled.',
    'actions.preview.confirm': 'Preview the plan before making changes?',
    'actions.outro.preview': 'Change plan reviewed',
    'actions.outro.apply': 'Profile applied',
    'actions.outro.sync': 'Profile synced',
    'actions.resolve.label': 'Resolve project conflicts',
    'actions.resolve.hint': 'Move edits out of managed areas and regenerate them',

    'resolve.path': 'Enter the project path to resolve.',
    'resolve.conflict.title': 'Managed area conflict',
    'resolve.offer': 'Continue to resolve the conflict?',
    'resolve.mode.message': 'How do you want to resolve it?',
    'resolve.mode.auto': 'Resolve automatically',
    'resolve.mode.auto.hint': 'Move your edits outside the managed area and regenerate it',
    'resolve.mode.edit': 'Merge in VS Code',
    'resolve.mode.edit.hint': 'Open the three-way merge editor with the last applied version as base',
    'resolve.mode.discard': 'Back up and regenerate',
    'resolve.mode.discard.hint': 'Copy current files to .agentic/backups/ and regenerate managed areas',
    'resolve.nothing': 'Nothing to resolve.',
    'resolve.outro': 'Conflicts resolved',

    'main.intro': 'Agentic',
    'main.message': 'What would you like to do?',
    'main.manage.label': 'Manage profiles',
    'main.manage.hint': 'Select a profile, then configure, apply, sync, view, or delete',
    'main.create.label': 'Create a new profile',
    'main.create.hint': 'Create a profile by entering a name and scope',
    'main.setup.label': 'Configure profile guidance',
    'main.setup.hint': 'Select a profile and set guidance levels',
    'main.lang.label': '언어 / Language',
    'main.lang.hint': 'Change display language (한국어/English)',
    'main.help.label': 'Help',
    'main.help.hint': 'View CLI commands and automation',
    'main.exit.label': 'Exit',
    'main.outro': 'Agentic exited.',

    'lang.prompt.message': '언어를 선택하세요 / Select your language',
    'lang.saved': 'Saved language preference: {locale}',
    'lang.cancel': 'Language selection cancelled.',

    'remove.intro': 'Delete an Agentic Profile',
    'remove.select': 'Select a profile to delete.',
    'remove.select.hint': 'Deletes only the profile source and settings',
    'remove.note.title': 'Deletion target',
    'remove.note.body': '{scope} · {name}\nFiles already applied to projects are left unchanged.',
    'remove.confirm': 'Permanently delete this profile?',
    'remove.cancel': 'Profile deletion cancelled.',
    'remove.outro': 'Profile deleted.',

    'setup.intro': 'Configure Agentic Profile guidance',
    'setup.select': 'Select a profile to configure.',
    'setup.select.hint': 'The profile whose shared guidance you configure',
    'setup.item.message': '{label} — {description}',
    'setup.note.title': 'Guidance to apply to {name}',
    'setup.confirm': 'Save these settings to the profile?',
    'setup.cancel': 'Profile configuration cancelled.',
    'setup.outro': 'Profile guidance configured.',
    'setup.block.level': 'Level',
    'setup.legend.title': 'What the levels mean',
    'setup.legend.intro': 'The `Level` on each guidance item below follows these definitions.',

    'scaffold.extHeading': '## 4. Project rule extensions (SSOT)',
    'scaffold.extBody': 'Add domain rules specific to this project below this section. They are not synced back to the profile.'
  }
};

export function t(locale, key, vars = {}) {
  const table = messages[locale] || messages[DEFAULT_LOCALE];
  let value = table[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

const scopeHints = {
  ko: { personal: '개인 공통 지침', company: '회사 공통 지침', team: '팀 공통 지침', workspace: '작업공간 공통 지침' },
  en: { personal: 'Personal shared guidance', company: 'Company shared guidance', team: 'Team shared guidance', workspace: 'Workspace shared guidance' }
};

export function scopeOptions(locale) {
  const hints = scopeHints[locale] || scopeHints[DEFAULT_LOCALE];
  return [
    { value: 'personal', label: 'Personal', hint: hints.personal },
    { value: 'company', label: 'Company', hint: hints.company },
    { value: 'team', label: 'Team', hint: hints.team },
    { value: 'workspace', label: 'Workspace', hint: hints.workspace }
  ];
}

const levelHints = {
  ko: { off: '이 지침을 프로필에 포함하지 않음' },
  en: { off: 'Exclude this guidance from the profile' }
};

// The meaning of each level, defined once. The setup legend and the TUI level
// hints both read from here so a person choosing a level and an agent reading
// the produced AGENTS.md see the same definition.
const levelDefinitions = {
  ko: {
    recommended: '기본값이다. 일반적으로 지키되 합당한 이유가 있으면 예외를 두고 그 이유를 기록한다.',
    strict: '예외 없이 항상 적용한다. 위반을 발견하면 작업을 멈추고 해결한 뒤 진행한다.'
  },
  en: {
    recommended: 'The default. Follow it as a rule; when a sound reason calls for an exception, make it and record why.',
    strict: 'Always applied, with no exceptions. If you find a violation, stop, resolve it, then continue.'
  }
};

export function guidanceLevelDefinitions(locale) {
  return levelDefinitions[locale] || levelDefinitions[DEFAULT_LOCALE];
}

export function levelOptions(locale) {
  const hints = levelHints[locale] || levelHints[DEFAULT_LOCALE];
  const definitions = guidanceLevelDefinitions(locale);
  return [
    { value: 'off', label: 'Off', hint: hints.off },
    { value: 'recommended', label: 'Recommended', hint: definitions.recommended },
    { value: 'strict', label: 'Strict', hint: definitions.strict }
  ];
}

const guidance = {
  ko: {
    labels: { harness: '하네스 동작', tdd: 'TDD', review: '변경 검토', verification: '검증', documentation: '문서화', security: '보안' },
    descriptions: {
      harness: '작업을 계획하고 실제 검증 결과를 보고하는 기본 작업 방식',
      tdd: '실패 테스트부터 시작하는 Red-Green-Refactor 개발 방식',
      review: '변경 범위와 위험을 확인하고 필요하면 독립 리뷰를 거치는 방식',
      verification: '프로젝트의 검증 명령을 실행하고 결과를 기록하는 방식',
      documentation: '계약·정책·구조 변경을 정본 문서에 반영하는 방식',
      security: '비밀값 보호와 외부 변경 승인에 관한 규칙'
    },
    sections: {
      harness: ['하네스 동작', '작업을 작은 단위로 계획한 뒤 변경마다 프로젝트의 검증 명령을 실행해 실제 결과를 보고한다. 기본 작업 방식은 작게 유지하고 복잡한 자동화나 도구는 필요할 때만 더한다. 말이나 추론이 아니라 실행 결과로 판단한다.'],
      tdd: ['TDD', '구현 전에 실패하는 테스트를 먼저 쓴다. 통과시키는 최소 코드를 쓴 뒤 테스트를 유지하며 정리한다(Red-Green-Refactor).'],
      review: ['변경 검토', '변경의 범위와 위험을 먼저 확인한다. 보안·데이터·공개 인터페이스가 얽히면 독립적인 리뷰를 거친다.'],
      verification: ['검증', '프로젝트가 선택한 검증 명령을 실행하고 그 출력을 근거로 남긴다. 실행 결과는 실행 사실일 뿐 요구사항 충족이나 품질 전체의 증명이 아니다.'],
      documentation: ['문서화', '다른 사람이 관찰하거나 의존하는 계약·정책·구조가 바뀌면 관련 정본 문서를 같은 변경에서 갱신한다. 루트 지침에는 고신호 정보만 두고 상세는 링크로 찾게 한다.'],
      security: ['보안', '비밀값을 출력하거나 커밋하지 않는다. 외부로 나가는 작업이나 권한이 필요한 작업은 실행 전에 사용자 승인을 받는다.']
    }
  },
  en: {
    labels: { harness: 'Harness behavior', tdd: 'TDD', review: 'Change review', verification: 'Verification', documentation: 'Documentation', security: 'Security' },
    descriptions: {
      harness: 'The default way of planning work and reporting real verification results',
      tdd: 'Red-Green-Refactor development that starts from a failing test',
      review: 'Checking the scope and risk of changes, with independent review when needed',
      verification: 'Running the project verification command and recording the result',
      documentation: 'Reflecting contract, policy, and structure changes in canonical docs',
      security: 'Rules on protecting secrets and approving outbound changes'
    },
    sections: {
      harness: ['Harness behavior', 'Plan work in small units and run the project verification command after each change, reporting the real result. Keep the default way of working small and add complex automation or tooling only when it is needed. Judge by execution results, not by claims or reasoning.'],
      tdd: ['TDD', 'Write a failing test before the implementation. Write the minimal code to make it pass, then refactor while the tests stay green (Red-Green-Refactor).'],
      review: ['Change review', 'Check the scope and risk of a change first. When security, data, or a public interface is involved, put the change through an independent review.'],
      verification: ['Verification', "Run the project's chosen verification command and keep its output as evidence. The result proves that it ran, not that requirements are met or that overall quality is sound."],
      documentation: ['Documentation', 'When a contract, policy, or structure that others observe or depend on changes, update the canonical document in the same change. Keep root guidance to high-signal information and let detail be found through links.'],
      security: ['Security', 'Never print or commit secrets. Get user approval before any outbound action or privileged operation.']
    }
  }
};

export function guidanceLabels(locale) {
  return (guidance[locale] || guidance[DEFAULT_LOCALE]).labels;
}

export function guidanceDescriptions(locale) {
  return (guidance[locale] || guidance[DEFAULT_LOCALE]).descriptions;
}

export function guidanceSections(locale) {
  return (guidance[locale] || guidance[DEFAULT_LOCALE]).sections;
}
