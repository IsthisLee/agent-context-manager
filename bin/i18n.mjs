/**
 * Locale resolution and message catalog for the Agentic CLI.
 *
 * The default locale is `ko`, so with no flag, environment variable, saved
 * choice, or interactive prompt the CLI behaves exactly as before. English is
 * opt-in. The `ko` catalog holds the exact strings the CLI shipped with, so the
 * `ko` output stays byte-identical to the pre-i18n behavior.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeTextAtomic } from './fs-utils.mjs';

export const SUPPORTED_LOCALES = ['ko', 'en'];
export const DEFAULT_LOCALE = 'ko';

function coreHome() {
  return path.join(process.env.AGENTIC_HOME || os.homedir(), '.agentic-cores');
}

function configPath() {
  return path.join(coreHome(), 'config.json');
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
  fs.mkdirSync(coreHome(), { recursive: true });
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
    'create.intro': 'Agentic Core 생성',
    'create.name.message': 'Core 이름을 입력하세요.',
    'create.name.invalid': '영문 소문자, 숫자, 하이픈으로 1-64자를 입력하세요.',
    'create.scope.message': 'Core의 용도를 선택하세요.',
    'create.note.title': '생성할 Core',
    'create.confirm': '이 Core를 생성할까요?',
    'create.cancel': 'Core 생성을 취소했습니다.',
    'create.outro': 'Core가 생성되었습니다.',

    'list.intro': 'Agentic Cores',
    'list.scope.message': '확인할 Core 범위를 선택하세요.',
    'list.scope.all': '전체 scope',
    'list.scope.allHint': '{n}개 Core',
    'list.scope.hint': '{n}개 Core · {hint}',
    'list.cancel': 'Core 관리를 취소했습니다.',
    'list.manage.message': '관리할 Core를 선택하세요.',
    'list.create.label': '새 Core 생성',
    'list.manage.hint': '선택 후 작업 메뉴 열기',

    'project.path.invalid': '존재하는 프로젝트 폴더를 선택하세요.',

    'actions.message': '{name}에서 수행할 작업을 선택하세요.',
    'actions.setup.label': '지침 설정',
    'actions.setup.hint': 'TDD·리뷰·검증·문서화·보안 수준 변경',
    'actions.apply.label': '프로젝트에 적용',
    'actions.apply.hint': '선택한 Core를 프로젝트에 처음 적용',
    'actions.sync.label': '프로젝트 동기화',
    'actions.sync.hint': '변경된 Core 지침을 프로젝트에 재적용',
    'actions.view.label': '상세 보기',
    'actions.view.hint': 'scope와 현재 Core 지침 확인',
    'actions.remove.label': 'Core 삭제',
    'actions.remove.hint': '확인 후 Core 원본과 설정 삭제',
    'actions.view.outro': 'Core 상세 보기 완료',
    'actions.apply.path': '적용할 프로젝트 경로를 입력하세요.',
    'actions.sync.path': '동기화할 프로젝트 경로를 입력하세요.',
    'actions.project.cancel': '프로젝트 작업을 취소했습니다.',
    'actions.preview.confirm': '실제 변경 전에 계획만 확인할까요?',
    'actions.outro.preview': '변경 계획 확인 완료',
    'actions.outro.apply': 'Core 적용 완료',
    'actions.outro.sync': 'Core 동기화 완료',

    'main.intro': 'Agentic',
    'main.message': '무엇을 할까요?',
    'main.manage.label': 'Core 관리',
    'main.manage.hint': 'Core 선택 후 설정·적용·동기화·조회·삭제',
    'main.create.label': '새 Core 생성',
    'main.create.hint': '이름과 scope를 입력해 Core 생성',
    'main.setup.label': 'Core 지침 설정',
    'main.setup.hint': 'Core를 선택하고 지침 수준 설정',
    'main.lang.label': '언어 / Language',
    'main.lang.hint': '표시 언어 변경 (한국어/English)',
    'main.help.label': '도움말',
    'main.help.hint': 'CLI 명령과 자동화 방식 확인',
    'main.exit.label': '종료',
    'main.outro': 'Agentic을 종료했습니다.',

    'lang.prompt.message': '언어를 선택하세요 / Select your language',
    'lang.saved': '언어 설정을 저장했습니다: {locale}',
    'lang.cancel': '언어 선택을 취소했습니다.',

    'remove.intro': 'Agentic Core 삭제',
    'remove.select': '삭제할 Core를 선택하세요.',
    'remove.select.hint': 'Core 원본과 설정만 삭제',
    'remove.note.title': '삭제 대상',
    'remove.note.body': '{scope} · {name}\n프로젝트에 이미 적용된 파일은 변경되지 않습니다.',
    'remove.confirm': '이 Core를 영구 삭제할까요?',
    'remove.cancel': 'Core 삭제를 취소했습니다.',
    'remove.outro': 'Core가 삭제되었습니다.',

    'setup.intro': 'Agentic Core 지침 설정',
    'setup.select': '설정할 Core를 선택하세요.',
    'setup.select.hint': '공통 지침을 설정할 Core',
    'setup.item.message': '{label} — {description}',
    'setup.note.title': '{name}에 적용할 지침',
    'setup.confirm': '이 설정을 Core에 저장할까요?',
    'setup.cancel': 'Core 설정을 취소했습니다.',
    'setup.outro': 'Core 지침이 설정되었습니다.',
    'setup.block.level': '적용 수준',

    'scaffold.extHeading': '## 4. 프로젝트 규칙 확장 (SSOT)',
    'scaffold.extBody': '이 프로젝트에만 적용되는 도메인 규칙은 이 섹션 아래에 추가한다. Core에는 역으로 동기화하지 않는다.'
  },
  en: {
    'create.intro': 'Create an Agentic Core',
    'create.name.message': 'Enter a Core name.',
    'create.name.invalid': 'Use 1-64 lowercase letters, numbers, or hyphens.',
    'create.scope.message': 'Select what this Core is for.',
    'create.note.title': 'Core to create',
    'create.confirm': 'Create this Core?',
    'create.cancel': 'Core creation cancelled.',
    'create.outro': 'Core created.',

    'list.intro': 'Agentic Cores',
    'list.scope.message': 'Select the Core scope to view.',
    'list.scope.all': 'All scopes',
    'list.scope.allHint': '{n} Cores',
    'list.scope.hint': '{n} Cores · {hint}',
    'list.cancel': 'Core management cancelled.',
    'list.manage.message': 'Select a Core to manage.',
    'list.create.label': 'Create a new Core',
    'list.manage.hint': 'Open the action menu after selecting',

    'project.path.invalid': 'Select an existing project folder.',

    'actions.message': 'Select an action for {name}.',
    'actions.setup.label': 'Configure guidance',
    'actions.setup.hint': 'Change TDD, review, verification, documentation, and security levels',
    'actions.apply.label': 'Apply to a project',
    'actions.apply.hint': 'Apply the selected Core to a project for the first time',
    'actions.sync.label': 'Sync a project',
    'actions.sync.hint': 'Re-apply changed Core guidance to a project',
    'actions.view.label': 'View details',
    'actions.view.hint': 'Check the scope and current Core guidance',
    'actions.remove.label': 'Delete Core',
    'actions.remove.hint': 'Delete the Core source and settings after confirmation',
    'actions.view.outro': 'Core details shown',
    'actions.apply.path': 'Enter the project path to apply to.',
    'actions.sync.path': 'Enter the project path to sync.',
    'actions.project.cancel': 'Project operation cancelled.',
    'actions.preview.confirm': 'Preview the plan before making changes?',
    'actions.outro.preview': 'Change plan reviewed',
    'actions.outro.apply': 'Core applied',
    'actions.outro.sync': 'Core synced',

    'main.intro': 'Agentic',
    'main.message': 'What would you like to do?',
    'main.manage.label': 'Manage Cores',
    'main.manage.hint': 'Select a Core, then configure, apply, sync, view, or delete',
    'main.create.label': 'Create a new Core',
    'main.create.hint': 'Create a Core by entering a name and scope',
    'main.setup.label': 'Configure Core guidance',
    'main.setup.hint': 'Select a Core and set guidance levels',
    'main.lang.label': '언어 / Language',
    'main.lang.hint': 'Change display language (한국어/English)',
    'main.help.label': 'Help',
    'main.help.hint': 'View CLI commands and automation',
    'main.exit.label': 'Exit',
    'main.outro': 'Agentic exited.',

    'lang.prompt.message': '언어를 선택하세요 / Select your language',
    'lang.saved': 'Saved language preference: {locale}',
    'lang.cancel': 'Language selection cancelled.',

    'remove.intro': 'Delete an Agentic Core',
    'remove.select': 'Select a Core to delete.',
    'remove.select.hint': 'Deletes only the Core source and settings',
    'remove.note.title': 'Deletion target',
    'remove.note.body': '{scope} · {name}\nFiles already applied to projects are left unchanged.',
    'remove.confirm': 'Permanently delete this Core?',
    'remove.cancel': 'Core deletion cancelled.',
    'remove.outro': 'Core deleted.',

    'setup.intro': 'Configure Agentic Core guidance',
    'setup.select': 'Select a Core to configure.',
    'setup.select.hint': 'The Core whose shared guidance you configure',
    'setup.item.message': '{label} — {description}',
    'setup.note.title': 'Guidance to apply to {name}',
    'setup.confirm': 'Save these settings to the Core?',
    'setup.cancel': 'Core configuration cancelled.',
    'setup.outro': 'Core guidance configured.',
    'setup.block.level': 'Level',

    'scaffold.extHeading': '## 4. Project rule extensions (SSOT)',
    'scaffold.extBody': 'Add domain rules specific to this project below this section. They are not synced back to the Core.'
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
  ko: { off: '이 지침을 Core에 포함하지 않음', recommended: '일반적으로 권장되는 수준', strict: '항상 엄격하게 적용하는 수준' },
  en: { off: 'Exclude this guidance from the Core', recommended: 'The generally recommended level', strict: 'Always applied strictly' }
};

export function levelOptions(locale) {
  const hints = levelHints[locale] || levelHints[DEFAULT_LOCALE];
  return [
    { value: 'off', label: 'Off', hint: hints.off },
    { value: 'recommended', label: 'Recommended', hint: hints.recommended },
    { value: 'strict', label: 'Strict', hint: hints.strict }
  ];
}

const guidance = {
  ko: {
    labels: { harness: '하네스 동작', tdd: 'TDD', review: '리뷰', verification: '검증', documentation: '문서화', security: '보안' },
    descriptions: {
      harness: '작업을 계획하고 실제 검증 결과를 보고하는 기본 작업 방식',
      tdd: '실패 테스트부터 시작하는 Red-Green-Refactor 개발 방식',
      review: '변경 범위와 위험을 확인하는 리뷰 방식',
      verification: '프로젝트의 검증 명령을 실행하고 결과를 기록하는 방식',
      documentation: '계약·정책·구조 변경을 정본 문서에 반영하는 방식',
      security: '비밀값 보호와 외부 변경 승인에 관한 규칙'
    },
    sections: {
      harness: ['하네스 동작', '작업을 작은 단위로 계획하고, 변경 후 프로젝트의 검증 명령을 실행해 실제 결과를 보고한다.'],
      tdd: ['TDD', 'strict이면 Red-Green-Refactor를 따르고, recommended이면 가능한 경우 실패 테스트부터 작성한다.'],
      review: ['리뷰', '변경 범위와 위험을 검토하고, 설정된 경우 독립적인 리뷰 결과를 남긴다.'],
      verification: ['검증', '프로젝트가 선택한 검증 명령을 실행한다. 실행 결과는 실행 사실이며 품질 전체의 증명이 아님을 명시한다.'],
      documentation: ['문서화', '사용자에게 영향을 주는 계약·정책·구조 변경은 관련 정본 문서와 함께 갱신한다.'],
      security: ['보안', '비밀값을 출력·커밋하지 않고, 외부 변경과 권한이 필요한 작업은 사용자 승인을 받는다.']
    }
  },
  en: {
    labels: { harness: 'Harness behavior', tdd: 'TDD', review: 'Review', verification: 'Verification', documentation: 'Documentation', security: 'Security' },
    descriptions: {
      harness: 'The default way of planning work and reporting real verification results',
      tdd: 'Red-Green-Refactor development that starts from a failing test',
      review: 'Review that checks the scope and risk of changes',
      verification: 'Running the project verification command and recording the result',
      documentation: 'Reflecting contract, policy, and structure changes in canonical docs',
      security: 'Rules on protecting secrets and approving outbound changes'
    },
    sections: {
      harness: ['Harness behavior', 'Plan work in small units and, after each change, run the project verification command and report the real result.'],
      tdd: ['TDD', 'At strict, follow Red-Green-Refactor; at recommended, start from a failing test when feasible.'],
      review: ['Review', 'Review the scope and risk of changes and, when configured, leave an independent review result.'],
      verification: ['Verification', "Run the project's chosen verification command. Its result is evidence of execution, not proof of overall quality."],
      documentation: ['Documentation', 'Update the relevant canonical documents together with any contract, policy, or structure change that affects users.'],
      security: ['Security', 'Never print or commit secrets; get user approval for outbound changes and privileged operations.']
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
