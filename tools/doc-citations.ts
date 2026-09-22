/**
 * 문서가 코드를 가리키는 방식. 줄 번호는 그 위의 무엇이든 바뀌면 움직이므로, 문서는 파일과 그 안의
 * 이름을 적고 `check:docs`는 그 이름이 아직 있는지 확인한다. 결정은
 * docs/discussion/repository/topics/code-citation-style.md에 있다.
 */

/** 이력을 기록하는 문서는 쓸 때의 인용을 그대로 둔다. */
const EXEMPT_PREFIXES: readonly string[] = ['docs/discussion/', 'docs/adr/'];
const EXEMPT_FILES: readonly string[] = ['CHANGELOG.md'];

export function citationExempt(relativePath: string): boolean {
  const posix = relativePath.replaceAll('\\', '/');
  return EXEMPT_PREFIXES.some(prefix => posix.startsWith(prefix)) || EXEMPT_FILES.includes(posix);
}

/** 이 저장소가 소유한 폴더와 루트 파일. 다른 경로는 다른 도구나 사용자 프로젝트의 것이다. */
const REPO_FOLDERS: readonly string[] = [
  'src/',
  'tools/',
  'evals/',
  'templates/',
  'skills/',
  '.agents/',
  '.github/',
  'docs/'
];
const REPO_FILES: readonly string[] = [
  'package.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'AGENTS.md',
  'README.md',
  'README.en.md',
  'SECURITY.md',
  'CHANGELOG.md'
];

export function repoFile(citedPath: string): boolean {
  return REPO_FOLDERS.some(folder => citedPath.startsWith(folder)) || REPO_FILES.includes(citedPath);
}

/** 백쿼트 안의 `path/to/file.ts:12`나 `path/to/file.ts:12-20`. */
const LINE_CITATION = /`([\w./-]+\.[A-Za-z0-9]+:\d+(?:-\d+)?)`/g;

export function lineNumberCitations(text: string): string[] {
  return [...text.matchAll(LINE_CITATION)].map(match => match[1]).filter(citation => repoFile(citation.split(':')[0]));
}

export interface NamedCitation {
  file: string;
  name: string;
  /** 인용 옆에 기록한 지문. 아직 없으면 null. */
  digest: string | null;
}

/** `path/to/file.ts`의 `name`. 이름이 더 있으면 `·`, `,`, `와`, `과`로 잇고, 이름마다 지문 마커가 붙는다. */
const NAMED_CITATION =
  /`([\w./-]+\.[A-Za-z0-9]+)`의((?:\s*`[A-Za-z_$][\w$]*`(?:<!--\s*s:[0-9a-f]{12}\s*-->)?\s*[·,]?\s*(?:와|과)?)+)/g;
const NAME = /`([A-Za-z_$][\w$]*)`(?:<!--\s*s:([0-9a-f]{12})\s*-->)?/g;

export function namedCitations(text: string): NamedCitation[] {
  return [...text.matchAll(NAMED_CITATION)]
    .filter(match => repoFile(match[1]))
    .flatMap(match =>
      [...match[2].matchAll(NAME)].map(name => ({ file: match[1], name: name[1], digest: name[2] ?? null }))
    );
}

/** 인용이 가리키는 것의 지문. 그런 대상에 지문이 없으면 null. */
export type DigestLookup = (file: string, name: string) => string | null;

function rewriteNames(names: string, file: string, digestFor: DigestLookup): string {
  return names.replace(NAME, (whole, name: string) => {
    const digest = digestFor(file, name);
    return digest ? `\`${name}\`<!--s:${digest}-->` : `\`${name}\``;
  });
}

/** 모든 인용 마커를 쓰거나 새로 고친 문서. 펜스 코드 블록은 건드리지 않는다. */
export function applyCitationMarkers(text: string, digestFor: DigestLookup): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map(part =>
      part.startsWith('```')
        ? part
        : part.replace(NAMED_CITATION, (whole, file: string, names: string) =>
            repoFile(file) ? `\`${file}\`의${rewriteNames(names, file, digestFor)}` : whole
          )
    )
    .join('');
}

/** 마커가 없거나 가리키는 것과 더는 맞지 않는 인용. */
export function citationMarkerProblems(text: string, digestFor: DigestLookup): string[] {
  return namedCitations(text).flatMap(({ file, name, digest }) => {
    const current = digestFor(file, name);
    if (!current) return [];
    if (!digest) return [`${file}의 ${name}: 지문이 없다`];
    return digest === current ? [] : [`${file}의 ${name}: 가리킨 코드가 바뀌었다`];
  });
}
