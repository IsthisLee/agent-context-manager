/**
 * 문서가 어떤 소스를 핀하는지에 대한 규칙. 소스 루트 전체를 핀하면 변경 하나가 모든 문서를 한꺼번에
 * 실패시켜, 읽는 사람이 다시 읽지 않고 stamp하게 된다. 어떤 문서도 핀하지 않은 소스는 아무 문서도
 * 모르게 바뀔 수 있다.
 */

/** 문서가 통째가 아니라 모듈 단위로 핀해야 하는 소스 루트. */
export const SOURCE_ROOTS: readonly string[] = ['src'];

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** 안의 모듈이 아니라 소스 루트 전체를 가리키는 핀. */
export function wholeRootPins(sources: readonly string[]): string[] {
  return sources.filter(source => SOURCE_ROOTS.includes(trimSlash(source)));
}

/**
 * 아무것도 덮지 않는 소스 파일. 문서가 그 파일을 직접 또는 핀한 폴더를 통해 핀하거나, 그 안의 이름을
 * 인용하면 덮인 것이다. 인용은 같은 지문을 갖고 같은 방식으로 실패하므로 핀은 그것을 되풀이할 뿐이다.
 * 경로는 `/`를 쓰고 저장소 루트 기준이다.
 */
export function unpinnedSources(
  sourceFiles: readonly string[],
  pins: readonly string[],
  citedFiles: readonly string[] = []
): string[] {
  const covering = pins.map(trimSlash).filter(pin => !SOURCE_ROOTS.includes(pin));
  const cited = new Set(citedFiles);
  return sourceFiles.filter(
    file => !cited.has(file) && !covering.some(pin => file === pin || file.startsWith(`${pin}/`))
  );
}

/** 소스를 핀하는 문서의 기록된 해시 마커 줄. */
const RECORDED_HASH = /<!--\s*agctx-doc-sources-sha256:\s*(?:[0-9a-f]{64}|PENDING)\s*-->/;

/**
 * 게이트가 해시하는 형태의 핀한 문서. 자기 기록 해시는 빼므로, 그 문서를 다시 stamp해도 그것을 핀한
 * 문서의 해시가 바뀌지 않고, README 번역본처럼 두 문서가 서로를 핀할 수 있다.
 */
export function withoutRecordedHash(text: string): string {
  return text.replace(RECORDED_HASH, '<!-- agctx-doc-sources-sha256 -->');
}

/** `<!-- agctx:generated:<name>:start -->`와 그 끝 마커 사이의 블록. 마커를 포함한다. */
const GENERATED_BLOCK = /(<!-- agctx:generated:(\S+):start -->)[\s\S]*?(<!-- agctx:generated:\2:end -->)/g;

/**
 * 게이트가 해시하는 형태의 핀한 문서에서 생성 블록의 내용을 뺀 것. 평가가 이미 그 블록을 데이터와
 * 비교하므로, 한 README의 상태 목록을 다시 만들어도 그 README를 핀한 README가 실패하지 않는다.
 */
export function withoutGeneratedBlocks(text: string): string {
  return text.replace(GENERATED_BLOCK, '$1\n$3');
}

/** 핀한 절: 마커 쌍과, 다음 마커까지 이어지는 그 절의 글. */
export interface DocSourceSection {
  sources: string[];
  /** 기록된 지문, `PENDING`, 또는 해시 줄이 없으면 null. */
  digest: string | null;
  /** 마커가 놓인 제목. 실패 메시지가 다시 읽을 곳을 가리키게 한다. */
  heading: string;
  /** 문서에서 목록 마커의 위치. stamp가 알맞은 해시 줄을 바꿀 수 있게 한다. */
  index: number;
}

const SOURCES_LIST = /<!--\s*agctx-doc-sources:\s*([^\n]+?)\s*-->/g;
const SOURCES_HASH = /<!--\s*agctx-doc-sources-sha256:\s*([0-9a-f]{64}|PENDING)\s*-->/;

/**
 * 문서의 모든 핀 절. 순서대로. 문서는 대부분처럼 맨 위에 마커 하나를 두거나, 절마다 마커를 둬서
 * 바뀐 소스가 문서 전체가 아니라 다시 읽을 절을 가리키게 할 수 있다.
 */
export function docSourceSections(content: string): DocSourceSection[] {
  const markers = [...content.matchAll(SOURCES_LIST)];
  return markers.map((marker, order) => {
    const from = marker.index ?? 0;
    const to = order + 1 < markers.length ? (markers[order + 1].index ?? content.length) : content.length;
    const hash = content.slice(from, to).match(SOURCES_HASH);
    const headings = [...content.slice(0, from).matchAll(/^#{1,6}\s+(.+)$/gm)];
    return {
      sources: marker[1]
        .split(',')
        .map(source => source.trim())
        .filter(Boolean),
      digest: hash ? hash[1] : null,
      heading: headings.length ? headings[headings.length - 1][1].trim() : '',
      index: from
    };
  });
}

/** stamp가 쓰는 지문: 절의 기록 해시와, 인용한 이름 옆의 마커. */
const DIGEST_IN_LINE = /(agctx-doc-sources-sha256:\s*)(?:[0-9a-f]{64}|PENDING)|<!--\s*s:[0-9a-f]{12}\s*-->/g;

/** 모든 지문을 비운 같은 줄. 지문만 다른 두 줄이 같게 비교되게 한다. */
function withoutDigests(line: string): string {
  return line.replace(DIGEST_IN_LINE, (_whole, prefix: string | undefined) =>
    prefix ? `${prefix}<digest>` : '<digest>'
  );
}

/**
 * diff에서 stamp가 쓰는 지문만 바뀐 Markdown 문서.
 *
 * 게이트의 목적은 문서를 다시 읽는 것인데 `--stamp`는 다시 읽지 않아도 통과하므로, 새 지문만 담은
 * 커밋은 아무도 다시 읽지 않은 문서의 모양이다. diff만으로 판단한다. 양쪽을 지문을 비운 채 비교하므로,
 * 줄이 더해지거나 빠지거나 표현이 바뀐 문서는 빠진다. PR #54가 이것이 잡는 경우다. 그때 README는
 * 해시가 바뀌었는데도 「6개 항목」이라는 문장을 그대로 두었다.
 */
export function restampOnlyDocuments(diff: string): string[] {
  const found: string[] = [];
  let file: string | null = null;
  let removed: string[] = [];
  let added: string[] = [];
  const settle = () => {
    const bare =
      file !== null &&
      removed.length > 0 &&
      removed.length === added.length &&
      removed.every((line, index) => withoutDigests(line) === withoutDigests(added[index])) &&
      removed.some((line, index) => line !== added[index]);
    if (bare && file !== null) found.push(file);
    file = null;
    removed = [];
    added = [];
  };
  for (const line of diff.split('\n')) {
    const header = line.match(/^diff --git a\/(\S+) b\/(\S+)$/);
    if (header) {
      settle();
      file = header[2].endsWith('.md') ? header[2] : null;
      continue;
    }
    if (file === null) continue;
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue;
    if (line.startsWith('-')) removed.push(line.slice(1));
    else if (line.startsWith('+')) added.push(line.slice(1));
  }
  settle();
  return found;
}

/**
 * checkout이 바꾼 파일 가운데 핀한 소스. 실패 메시지가 핀 목록 전체를 되풀이하지 않고 다시 읽을 것을
 * 가리키게 한다. 핀한 폴더는 그 아래의 모든 파일을 덮는다.
 */
export function sourcesToReread(pinned: readonly string[], changed: readonly string[]): string[] {
  const pins = pinned.map(trimSlash);
  return changed.filter(file => pins.some(pin => file === pin || file.startsWith(`${pin}/`)));
}

/** `--stamp`가 다시 쓰라고 요청받은 것: 모든 문서, 지정한 문서, 또는 지정할 때까지 아무것도 아님. */
export type StampTargets = { kind: 'all' } | { kind: 'ask' } | { kind: 'paths'; paths: string[] };

/**
 * `--stamp`와 그 뒤에 오는 것을 읽는다. 문서를 지정하는 것이 승인 단위다. 예전에는 `--stamp` 한 번이
 * 어긋난 문서를 모두 다시 써서, 하나만 읽고 실행해도 나머지까지 통과했다.
 */
export function stampTargets(argv: readonly string[]): StampTargets {
  const at = argv.indexOf('--stamp');
  if (at === -1) return { kind: 'ask' };
  const rest = argv.slice(at + 1).filter(value => value !== '--');
  if (rest.includes('--all')) return { kind: 'all' };
  const paths = rest.filter(value => !value.startsWith('-')).map(value => value.replace(/^\.\//, ''));
  return paths.length ? { kind: 'paths', paths } : { kind: 'ask' };
}
