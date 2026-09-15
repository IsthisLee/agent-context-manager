/**
 * Locale resolution and message catalog for the agctx CLI.
 *
 * The default locale is `ko`, so with no flag, environment variable, saved
 * choice, or interactive prompt the CLI behaves exactly as before. English is
 * opt-in.
 */

import type { GuidanceKey, GuidanceLevel, Locale, Scope } from '../shared/types.ts';
import en from './messages-en.ts';
import ko from './messages-ko.ts';

export type { Locale } from '../shared/types.ts';
export type MessageVars = Record<string, string | number>;

export const SUPPORTED_LOCALES: readonly Locale[] = ['ko', 'en'];
export const DEFAULT_LOCALE: Locale = 'ko';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function validated(source: string, value: string): Locale {
  if (!isLocale(value)) throw new Error(`${source} must be one of: ${SUPPORTED_LOCALES.join(', ')}.`);
  return value;
}

export interface LocaleInputs {
  flag?: string | null;
  env?: string | null;
  saved?: string | null;
  isTTY?: boolean;
}

/**
 * Decide the active locale from the fixed precedence order:
 *   1. --lang flag        (this run only; invalid value throws)
 *   2. AGCTX_LANG env    (invalid value throws)
 *   3. saved user choice   (invalid value ignored)
 *   4. interactive (TTY) → null, meaning the caller must prompt and save
 *      non-interactive     → DEFAULT_LOCALE (ko), the pre-i18n behavior
 */
export function resolveLocale({ flag = null, env = null, saved = null, isTTY = false }: LocaleInputs = {}): Locale | null {
  if (flag != null) return validated('--lang', flag);
  if (env != null && env !== '') return validated('AGCTX_LANG', env);
  if (isLocale(saved)) return saved;
  if (!isTTY) return DEFAULT_LOCALE;
  return null;
}

const messages: Record<Locale, Record<string, string>> = { ko, en };

function forLocale<T>(table: Record<Locale, T>, locale: string): T {
  return isLocale(locale) ? table[locale] : table[DEFAULT_LOCALE];
}

export function t(locale: string, key: string, vars: MessageVars = {}): string {
  const table = forLocale(messages, locale);
  let value = table[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

const scopeHints: Record<Locale, Record<Scope, string>> = {
  ko: { personal: '개인 공통 지침', company: '회사 공통 지침', team: '팀 공통 지침', workspace: '작업공간 공통 지침' },
  en: { personal: 'Personal shared guidance', company: 'Company shared guidance', team: 'Team shared guidance', workspace: 'Workspace shared guidance' }
};

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export function scopeOptions(locale: string): ChoiceOption<Scope>[] {
  const hints = forLocale(scopeHints, locale);
  return [
    { value: 'personal', label: 'Personal', hint: hints.personal },
    { value: 'company', label: 'Company', hint: hints.company },
    { value: 'team', label: 'Team', hint: hints.team },
    { value: 'workspace', label: 'Workspace', hint: hints.workspace }
  ];
}

const levelHints: Record<Locale, { off: string }> = {
  ko: { off: '이 지침을 프로필에 포함하지 않음' },
  en: { off: 'Exclude this guidance from the profile' }
};

// The meaning of each level, defined once. The setup legend and the TUI level
// hints both read from here so a person choosing a level and an agent reading
// the produced AGENTS.md see the same definition.
const levelDefinitions: Record<Locale, { recommended: string; strict: string }> = {
  ko: {
    recommended: '기본값이다. 일반적으로 지키되 합당한 이유가 있으면 예외를 두고 그 이유를 기록한다.',
    strict: '예외 없이 항상 적용한다. 위반을 발견하면 작업을 멈추고 해결한 뒤 진행한다.'
  },
  en: {
    recommended: 'The default. Follow it as a rule; when a sound reason calls for an exception, make it and record why.',
    strict: 'Always applied, with no exceptions. If you find a violation, stop, resolve it, then continue.'
  }
};

export function guidanceLevelDefinitions(locale: string): { recommended: string; strict: string } {
  return forLocale(levelDefinitions, locale);
}

export function levelOptions(locale: string): ChoiceOption<GuidanceLevel>[] {
  const hints = forLocale(levelHints, locale);
  const definitions = guidanceLevelDefinitions(locale);
  return [
    { value: 'off', label: 'Off', hint: hints.off },
    { value: 'recommended', label: 'Recommended', hint: definitions.recommended },
    { value: 'strict', label: 'Strict', hint: definitions.strict }
  ];
}

interface GuidanceText {
  labels: Record<GuidanceKey, string>;
  descriptions: Record<GuidanceKey, string>;
  sections: Record<GuidanceKey, [title: string, body: string]>;
}

const guidance: Record<Locale, GuidanceText> = {
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

export function guidanceLabels(locale: string): Record<GuidanceKey, string> {
  return forLocale(guidance, locale).labels;
}

export function guidanceDescriptions(locale: string): Record<GuidanceKey, string> {
  return forLocale(guidance, locale).descriptions;
}

export function guidanceSections(locale: string): Record<GuidanceKey, [title: string, body: string]> {
  return forLocale(guidance, locale).sections;
}

let activeLocale: Locale = DEFAULT_LOCALE;

/** The locale this CLI run uses. */
export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale): Locale {
  activeLocale = locale;
  return locale;
}

/** Translate with the active locale. */
export const _ = (key: string, vars?: MessageVars): string => t(activeLocale, key, vars);
