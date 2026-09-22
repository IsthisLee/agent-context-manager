#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { docSourceHashPath } from './doc-source-path.ts';
import {
  forbidsImplementationRecord,
  hasImplementationRecord,
  requiresImplementationRecord
} from './discussion-record.ts';
import {
  readTopics,
  STATUSES,
  summaryImportance,
  TOPICS_FILE,
  topicFieldErrors,
  type DiscussionTopic,
  type DiscussionTopics
} from './discussion-topics.ts';
import {
  applyCitationMarkers,
  citationExempt,
  citationMarkerProblems,
  lineNumberCitations,
  namedCitations
} from './doc-citations.ts';
import { citedText, symbolDigest } from './symbol-source.ts';
import { adrEvidenceError, undatedReferenceLinkLines } from './doc-evidence.ts';
import { discussionRoots } from './discussion-roots.ts';
import { execFileSync } from 'node:child_process';
import {
  docSourceSections,
  restampOnlyDocuments,
  SOURCE_ROOTS,
  sourcesToReread,
  stampTargets,
  unpinnedSources,
  wholeRootPins,
  withoutGeneratedBlocks,
  withoutRecordedHash
} from './doc-sources.ts';
import { GUIDANCE_KEYS } from '../src/profile/setup.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];

function walkMarkdown(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(entryPath, files);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
  }
  return files;
}

function contentWithoutCodeBlocks(content: string) {
  return content.replace(/```[\s\S]*?```/g, '');
}

function markdownHeadingSlug(heading: string) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

// 문서는 줄 번호가 아니라 파일과 이름으로 코드를 가리킨다. 그래야 인용한 코드 위의 변경만으로
// 문서가 틀려지지 않는다. 결정은 docs/discussion/repository/topics/code-citation-style.md에 있다.
/** 인용이 가리키는 코드의 지문. 대상에 지문이 없으면 null. */
function citationDigest(file: string, name: string): string | null {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) return null;
  const text = citedText(file, fs.readFileSync(target, 'utf8'), name);
  return text === null ? null : symbolDigest(text);
}

function checkCitations(markdownFile: string) {
  const relative = docSourceHashPath(root, markdownFile, path);
  if (citationExempt(relative)) return;
  const content = contentWithoutCodeBlocks(fs.readFileSync(markdownFile, 'utf8'));

  for (const citation of lineNumberCitations(content)) {
    errors.push(`${relative}: cite code by name, not by line (${citation})`);
  }

  for (const { file, name } of namedCitations(content)) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) {
      errors.push(`${relative}: cited file is missing (${file})`);
      continue;
    }
    const source = fs.readFileSync(target, 'utf8');
    if (!new RegExp(`\\b${name.replaceAll('$', '\\$')}\\b`).test(source)) {
      errors.push(`${relative}: ${file} no longer has ${name}; re-read the document and fix the citation`);
      continue;
    }
    // 인용은 선언이나 키를 가리키고, 그 안에만 나오는 이름은 가리키지 않는다. 게이트는 앞의 것에는
    // 지문을 붙일 수 있지만 뒤의 것에는 붙일 수 없다.
    if (!file.endsWith('.md') && citedText(file, source, name) === null) {
      errors.push(`${relative}: ${name} in ${file} is not a top-level declaration or key; cite one that is`);
    }
  }

  for (const problem of citationMarkerProblems(content, citationDigest)) {
    errors.push(
      `${relative}: ${problem}. Re-read the document, then run \`node tools/check-docs.ts --stamp ${relative}\``
    );
  }
}

function checkInternalAnchors(markdownFile: string) {
  const content = contentWithoutCodeBlocks(fs.readFileSync(markdownFile, 'utf8'));
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|tel:)/i.test(rawTarget) || !rawTarget.includes('#')) continue;

    const [target, rawFragment] = rawTarget.split('#', 2);
    if (!rawFragment) continue;
    const targetFile = target ? path.resolve(path.dirname(markdownFile), target) : markdownFile;
    if (!fs.existsSync(targetFile) || path.extname(targetFile) !== '.md') continue;

    const headings = [...fs.readFileSync(targetFile, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(match =>
      markdownHeadingSlug(match[1])
    );
    const fragment = markdownHeadingSlug(decodeURIComponent(rawFragment));
    if (!headings.includes(fragment)) {
      errors.push(`${path.relative(root, markdownFile)}: missing Markdown heading anchor ${rawTarget}`);
    }
  }
}

function checkInternalLinks(markdownFile: string) {
  const content = contentWithoutCodeBlocks(fs.readFileSync(markdownFile, 'utf8'));
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].replace(/^<|>$/g, '');
    if (rawTarget.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(rawTarget)) continue;
    const target = rawTarget.split('#')[0];
    if (target && !fs.existsSync(path.resolve(path.dirname(markdownFile), target))) {
      errors.push(`${path.relative(root, markdownFile)}: missing internal link target ${rawTarget}`);
    }
  }
}

function checkAdrs() {
  const adrDir = path.join(root, 'docs', 'adr');
  if (!fs.existsSync(adrDir)) {
    errors.push('docs/adr: directory must exist');
    return;
  }
  const adrFiles = fs
    .readdirSync(adrDir)
    .filter(name => /^\d{4}-[a-z0-9-]+\.md$/.test(name))
    .sort();
  for (const adrFile of adrFiles) {
    const content = fs.readFileSync(path.join(adrDir, adrFile), 'utf8');
    for (const section of ['배경|Context', '대안|Options', '결정|Decision', '결과|Consequences']) {
      if (!new RegExp(`^## .*(${section})`, 'mi').test(content)) {
        errors.push(`docs/adr/${adrFile}: missing required ADR section (${section})`);
      }
    }
    if (!/^\s*[*-]?\s*\*\*(결정자|Deciders):\*\*\s+\S/m.test(content)) {
      errors.push(`docs/adr/${adrFile}: missing required ADR header field (결정자)`);
    }
    const evidenceError = adrEvidenceError(adrFile, content);
    if (evidenceError) errors.push(evidenceError);
  }

  const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
  const indexed = [...index.matchAll(/\]\(adr\/(\d{4}-[a-z0-9-]+\.md)\)/g)].map(match => match[1]);
  if (indexed.join('|') !== adrFiles.join('|')) {
    errors.push('docs/README.md: ADR index must contain every ADR exactly once in filename order');
  }
}

function checkReferenceDates() {
  const references = path.join(root, 'docs', 'references.md');
  if (!fs.existsSync(references)) return;
  for (const line of undatedReferenceLinkLines(fs.readFileSync(references, 'utf8'))) {
    errors.push(`docs/references.md:${line}: external link needs (확인일: YYYY-MM-DD) after verifying the claim`);
  }
}

function checkDiscussionStatuses() {
  const discussionRoot = path.join(root, 'docs', 'discussion');
  const areas = discussionRoots(discussionRoot);
  if (!areas.includes('architecture')) {
    errors.push('docs/discussion/architecture/topics: must exist');
    return;
  }
  let topics: DiscussionTopics;
  try {
    topics = readTopics(root);
  } catch (error) {
    errors.push(`${TOPICS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  for (const area of Object.keys(topics).filter(area => !areas.includes(area))) {
    errors.push(`${TOPICS_FILE}: ${area} has no docs/discussion/${area}/topics folder`);
  }
  for (const area of areas) checkDiscussionArea(area, topics[area]);
}

// 각 주제의 상태는 topics.json에서 온다. 상태 줄, 색인, README 목록은 거기서 생성하고,
// evals/discussion-status.test.ts가 최신인지 검사한다.
function checkDiscussionArea(area: string, listed: DiscussionTopic[] | undefined) {
  const discussionDir = path.join(root, 'docs', 'discussion', area);
  const topicsDir = path.join(discussionDir, 'topics');
  const proposalSummaryFields = [
    '대상 계층',
    '제안 목표',
    '제안 이유',
    '결정할 것',
    '중요도',
    '선행 작업',
    '선행 제안',
    '후속 제안',
    '연관 제안',
    '후속 작업',
    '권장 다음 작업'
  ];
  if (!fs.existsSync(path.join(discussionDir, 'README.md'))) {
    errors.push(
      `docs/discussion/${area}/README.md: a discussion area needs an index listing its topics and their status`
    );
    return;
  }
  if (!Array.isArray(listed)) {
    errors.push(`${TOPICS_FILE}: add the ${area} area with its topics`);
    return;
  }

  for (const name of fs.readdirSync(discussionDir).filter(name => name.endsWith('.md') && name !== 'README.md')) {
    errors.push(`docs/discussion/${area}/${name}: move topic documents into topics/`);
  }

  for (const topic of listed) {
    for (const problem of topicFieldErrors(topic)) errors.push(`${TOPICS_FILE}: ${area}/${topic.file}: ${problem}`);
  }

  const topicFiles = fs
    .readdirSync(topicsDir)
    .filter(name => name.endsWith('.md'))
    .sort();
  for (const name of topicFiles) {
    const entries = listed.filter(topic => topic.file === name);
    if (entries.length !== 1) {
      errors.push(`${TOPICS_FILE}: ${area}/${name} must be indexed exactly once`);
      continue;
    }
    const status = entries[0].status;
    if (!STATUSES.includes(status)) {
      errors.push(`${TOPICS_FILE}: ${area}/${name} needs an allowed status (${STATUSES.join(', ')})`);
      continue;
    }

    const document = `docs/discussion/${area}/topics/${name}`;
    const content = fs.readFileSync(path.join(topicsDir, name), 'utf8');
    if (requiresImplementationRecord(status) && !hasImplementationRecord(content)) {
      errors.push(
        `${document}: Implemented topic must include an implementation record heading (#### 구현 기록: <범위>)`
      );
    }
    if (forbidsImplementationRecord(status) && hasImplementationRecord(content)) {
      errors.push(
        `${document}: a topic with an implementation record is at least Implementing; update its status in ${TOPICS_FILE}`
      );
    }
    const stated = summaryImportance(content);
    if (stated !== entries[0].importance) {
      errors.push(
        `${document}: 중요도 in the proposal summary (${stated ?? 'none'}) must match importance in ${TOPICS_FILE} (${entries[0].importance ?? 'none'})`
      );
    }

    if (['Proposed', 'Implementing'].includes(status)) {
      for (const field of proposalSummaryFields) {
        if (!content.includes(`| ${field} |`)) {
          errors.push(`${document}: missing proposal summary field (${field})`);
        }
      }
    }
  }

  for (const topic of listed) {
    if (!topicFiles.includes(topic.file)) {
      errors.push(`${TOPICS_FILE}: index references missing topic ${area}/${topic.file}`);
    }
  }
}

function checkReadme() {
  const readmePath = path.join(root, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf8');
  const requiredHeadings = ['## 핵심 목표', '## 핵심 기능', '## 아키텍처 방향과 진행 상태', '## 시작하기', '## 문서'];
  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) errors.push(`README.md: missing required section ${heading}`);
  }
  for (const requiredText of [
    'agent-context-manager',
    'npm install -g',
    'agctx',
    'docs/discussion/architecture/',
    '개인·조직별 에이전트 컨텍스트를 프로필로 생성·설정'
  ]) {
    if (!content.includes(requiredText)) errors.push(`README.md: missing required product guidance ${requiredText}`);
  }
}

function checkDocumentationGovernance() {
  const proposalFormat = path.join(root, 'docs', 'discussion', 'architecture', 'topics', 'implementation-contracts.md');
  const requiredReferences = [
    path.join(root, 'AGENTS.md'),
    path.join(root, 'docs', 'contributing', 'product-direction.md'),
    path.join(root, 'docs', 'README.md'),
    path.join(root, 'docs', 'contributing', 'releasing.md')
  ];

  const formatContent = fs.readFileSync(proposalFormat, 'utf8');
  if (!formatContent.includes('## 구현 단계 계약')) {
    errors.push(
      'docs/discussion/architecture/topics/implementation-contracts.md: must define the implementation contract'
    );
  }

  for (const file of requiredReferences) {
    if (!fs.readFileSync(file, 'utf8').includes('implementation-contracts.md')) {
      errors.push(`${path.relative(root, file)}: must link to the canonical proposal format`);
    }
  }

  // 혼자 하는 장난감 프로젝트는 실제로 일을 하는 파일만 두고, 오픈소스 절차를 보여 주기만 하는 파일은
  // 뺀다(ADR 0031). 남는 것은 취약점 신고 경로와 릴리스를 막는 두 워크플로다.
  for (const file of [
    path.join(root, 'SECURITY.md'),
    path.join(root, '.github', 'workflows', 'ci.yml'),
    path.join(root, '.github', 'workflows', 'publish.yml')
  ]) {
    if (!fs.existsSync(file)) errors.push(`${path.relative(root, file)}: public repository contract file must exist`);
  }
}

/**
 * 배포하는 지침 문장은 모두 외부 출처까지 따라갈 수 있어야 한다. 그래서 카탈로그에는 references.md를
 * 가리키는 근거 열이 있다. 근거가 없는 행은 기록된 근거 없이 나가는 문장이다.
 */
function checkGuidanceCatalog() {
  const catalog = path.join(root, 'docs', 'reference', 'guidance-catalog.md');
  if (!fs.existsSync(catalog)) {
    errors.push('docs/reference/guidance-catalog.md: guidance catalog must exist');
    return;
  }
  const content = fs.readFileSync(catalog, 'utf8');
  const rows = content.split('\n').filter(line => line.startsWith('| `--'));
  if (rows.length !== GUIDANCE_KEYS.length) {
    errors.push(
      `docs/reference/guidance-catalog.md: expected one row per guidance option (${GUIDANCE_KEYS.length}), found ${rows.length}`
    );
    return;
  }
  for (const key of GUIDANCE_KEYS) {
    if (!rows.some(row => row.startsWith(`| \`--${key}\``)))
      errors.push(`docs/reference/guidance-catalog.md: no row for --${key}`);
  }
  for (const row of rows) {
    const option = row.split('|')[1].trim();
    if (!/\.\.\/references\.md#/.test(row)) {
      errors.push(`docs/reference/guidance-catalog.md: ${option} has no evidence link into references.md`);
    }
  }
}

function checkChangelog() {
  const changelog = path.join(root, 'CHANGELOG.md');
  if (!fs.existsSync(changelog) || !/^## \[Unreleased\]/m.test(fs.readFileSync(changelog, 'utf8'))) {
    errors.push('CHANGELOG.md: must contain a ## [Unreleased] section');
  }
}

// 문서는 인용한 소스 파일을 핀해서 `파일:줄` 인용이 조용히 어긋나지 않게 할 수 있다. 문서에는 HTML
// 주석 마커 두 개가 있다: 소스 목록과 그 파일들의 sha256. 목록의 소스가 바뀌면 기록된 해시가 더는
// 맞지 않아 `pnpm run check`가 실패하고, 문서를 다시 읽게 만든다. `--stamp`는 사람이 문서를 다시
// 확인한 뒤 해시를 다시 기록한다.
/** 폴더 아래의 모든 파일. 핀한 폴더가 그 안의 것을 모두 덮게 한다. */
function walkFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

/**
 * 핀한 소스마다 상대 경로와 바이트를 넣은 sha256. 소스는 파일이나 폴더일 수 있다. 폴더는 그 아래의
 * 모든 파일을 정렬 순서로 해시하므로, 안에서 파일을 더하거나 지우거나 고치면 목록을 고치지 않아도
 * 게이트가 걸린다.
 */
function computeDocSourcesHash(sources: string[]) {
  const hash = createHash('sha256');
  for (const source of sources) {
    const sourcePath = path.join(root, source);
    if (!fs.existsSync(sourcePath)) {
      return { error: `doc-source not found: ${source}` };
    }
    const files = fs.statSync(sourcePath).isDirectory() ? walkFiles(sourcePath).sort() : [sourcePath];
    for (const filePath of files) {
      hash.update(docSourceHashPath(root, filePath));
      hash.update('\0');
      const bytes = fs.readFileSync(filePath);
      hash.update(
        filePath.endsWith('.md') ? withoutGeneratedBlocks(withoutRecordedHash(bytes.toString('utf8'))) : bytes
      );
      hash.update('\0');
    }
  }
  return { digest: hash.digest('hex') };
}

/** `git` 출력. checkout이 아니거나 명령이 실패하면 null. */
function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * 이 절의 지문을 기록한 뒤 바뀐 핀 소스. 실패 메시지가 살펴볼 파일을 가리키게 한다. 지문은 모든 핀
 * 소스를 합친 해시 하나라서 검사기 혼자서는 구별할 수 없지만, git은 이 지문을 쓴 커밋을 찾아 그 뒤에
 * 바뀐 것을 나열해서 구별한다. git이 답하지 못하면 빈 목록을 돌려주고, 메시지는 핀 목록으로 돌아간다.
 */
function changedPinnedSources(relative: string, digest: string, sources: string[]): string[] {
  const commit = git('log', '-1', '--format=%H', '-S', `agctx-doc-sources-sha256: ${digest}`, '--', relative)?.trim();
  if (!commit) return [];
  const since = git('log', '--name-only', '--format=', `${commit}..HEAD`, '--', ...sources) ?? '';
  const uncommitted = git('status', '--porcelain', '--', ...sources) ?? '';
  const changed = new Set<string>();
  for (const line of since.split('\n')) if (line.trim()) changed.add(line.trim());
  for (const line of uncommitted.split('\n')) if (line.trim()) changed.add(line.slice(3).trim());
  return sourcesToReread(sources, [...changed]).sort();
}

/** 커밋 범위에서 `--stamp`가 쓰는 지문만 바뀐 문서. */
function reportRestamped(base: string): number {
  const diff = git('diff', '--unified=0', `${base}...HEAD`);
  if (diff === null) {
    console.error(`cannot diff against ${base}: not a git checkout, or that revision is unknown`);
    return 1;
  }
  const documents = restampOnlyDocuments(diff);
  if (!documents.length) {
    console.log(`No document changed only its recorded hash between ${base} and HEAD.`);
    return 0;
  }
  console.log(`Documents that changed only their recorded hash between ${base} and HEAD:`);
  for (const document of documents) console.log(`- ${document}`);
  console.log(
    'Re-read each one against the sources it pins. A hash moves when the code moves, and the gate passes either way.'
  );
  return 0;
}

function checkDocSources() {
  const pins: string[] = [];
  const cited = new Set<string>();
  for (const markdownFile of walkMarkdown(root)) {
    const content = fs.readFileSync(markdownFile, 'utf8');
    const relative = path.relative(root, markdownFile);
    // 마커 형식을 설명하는 문서는 <placeholder> 글을 쓴다. 그것은 무시해서, 게이트가 목록이 실제 경로인
    // 마커에만 작용하게 한다.
    for (const { file } of namedCitations(contentWithoutCodeBlocks(content))) cited.add(file);
    for (const section of docSourceSections(content)) {
      if (section.sources.some(source => /[<>]/.test(source))) continue;
      const place = section.heading ? `${relative} (${section.heading})` : relative;
      if (section.digest === null) {
        errors.push(`${place}: doc-source marker needs both the agctx-doc-sources and agctx-doc-sources-sha256 lines`);
        continue;
      }
      if (!section.sources.length) {
        errors.push(`${place}: agctx-doc-sources list is empty`);
        continue;
      }
      for (const pin of wholeRootPins(section.sources)) {
        errors.push(
          `${place}: pin the modules inside ${pin.replace(/\/+$/, '')}/ instead of the whole folder, so one change does not fail every document at once`
        );
      }
      pins.push(...section.sources);
      const computed = computeDocSourcesHash(section.sources);
      if (computed.error) {
        errors.push(`${place}: ${computed.error}`);
        continue;
      }
      if (section.digest === 'PENDING') {
        errors.push(
          `${place}: doc-source hash is PENDING. Verify this part against ${section.sources.join(', ')}, then run \`node tools/check-docs.ts --stamp ${relative}\`.`
        );
        continue;
      }
      if (section.digest !== computed.digest) {
        const changed = changedPinnedSources(relative, section.digest, section.sources);
        const what = changed.length ? changed.join(', ') : section.sources.join(', ');
        errors.push(
          `${place}: doc sources changed since last verified. Re-read this part against ${what}, fix any drift, then run \`node tools/check-docs.ts --stamp ${relative}\`.`
        );
      }
    }
  }
  const sourceFiles = SOURCE_ROOTS.filter(sourceRoot => fs.existsSync(path.join(root, sourceRoot)))
    .flatMap(sourceRoot => walkFiles(path.join(root, sourceRoot)))
    .map(file => docSourceHashPath(root, file))
    .sort();
  for (const file of unpinnedSources(sourceFiles, pins, [...cited])) {
    errors.push(
      `${file}: no document pins or cites this source; add it to the agctx-doc-sources marker of the section that describes it, or cite a name inside it`
    );
  }
}

function stampCitations(wanted: Set<string> | null): string[] {
  const updated: string[] = [];
  for (const markdownFile of walkMarkdown(root)) {
    const relative = docSourceHashPath(root, markdownFile, path);
    if (citationExempt(relative)) continue;
    if (wanted && !wanted.has(relative)) continue;
    const content = fs.readFileSync(markdownFile, 'utf8');
    const stamped = applyCitationMarkers(content, citationDigest);
    if (stamped === content) continue;
    fs.writeFileSync(markdownFile, stamped);
    updated.push(relative);
  }
  return updated;
}

function stampDocSources(wanted: Set<string> | null) {
  let failed = false;
  const updated = stampCitations(wanted);
  for (const markdownFile of walkMarkdown(root)) {
    if (wanted && !wanted.has(docSourceHashPath(root, markdownFile, path))) continue;
    const content = fs.readFileSync(markdownFile, 'utf8');
    const sections = docSourceSections(content).filter(
      section => section.sources.length && !section.sources.some(source => /[<>]/.test(source))
    );
    if (!sections.length) continue;
    let next = content;
    let changed = false;
    for (const section of sections) {
      if (section.digest === null) continue;
      const computed = computeDocSourcesHash(section.sources);
      if (computed.error) {
        console.error(`- ${path.relative(root, markdownFile)}: ${computed.error}`);
        failed = true;
        continue;
      }
      if (section.digest === computed.digest) continue;
      const from = next.indexOf(`<!-- agctx-doc-sources-sha256: ${section.digest} -->`);
      if (from < 0) continue;
      next = `${next.slice(0, from)}<!-- agctx-doc-sources-sha256: ${computed.digest} -->${next.slice(from + `<!-- agctx-doc-sources-sha256: ${section.digest} -->`.length)}`;
      changed = true;
    }
    if (!changed) continue;
    fs.writeFileSync(markdownFile, next);
    updated.push(path.relative(root, markdownFile));
  }
  if (updated.length) {
    console.log('Stamped documents:');
    for (const file of updated) console.log(`- ${file}`);
  } else if (!failed) {
    console.log('Doc-source hashes already current.');
  }
  return !failed;
}

/** 기록된 해시가 더는 맞지 않는 문서. 경로 없이 `--stamp`를 실행하면 출력하는 목록이다. */
function driftedDocuments(): string[] {
  const drifted: string[] = [];
  for (const markdownFile of walkMarkdown(root)) {
    const content = fs.readFileSync(markdownFile, 'utf8');
    const sections = docSourceSections(content).filter(
      section => section.sources.length && !section.sources.some(source => /[<>]/.test(source))
    );
    const off = sections.some(section => {
      if (section.digest === null) return false;
      if (section.digest === 'PENDING') return true;
      const computed = computeDocSourcesHash(section.sources);
      return !computed.error && section.digest !== computed.digest;
    });
    if (off) drifted.push(docSourceHashPath(root, markdownFile, path));
  }
  return drifted;
}

const restampedAt = process.argv.indexOf('--restamped');
if (restampedAt !== -1) {
  const given = process.argv[restampedAt + 1];
  process.exit(reportRestamped(given && !given.startsWith('-') ? given : 'main'));
}

if (process.argv.includes('--stamp')) {
  const targets = stampTargets(process.argv);
  if (targets.kind === 'ask') {
    const drifted = driftedDocuments();
    if (!drifted.length) {
      console.log('Doc-source hashes already current.');
      process.exit(0);
    }
    // 문서를 이름으로 지정하는 것이 다시 읽었다는 표시다. 모두를 한 번에 다시 쓰면 한 번 읽은 것이 어긋난
    // 모든 문서에 통하게 되므로, 이제 그렇게 하려면 `--all`이 필요하다.
    console.error('Name the documents to stamp, after re-reading each one:');
    for (const document of drifted) console.error(`- node tools/check-docs.ts --stamp ${document}`);
    console.error('Use --all to stamp every document above, for example after a marker format change.');
    process.exit(1);
  }
  process.exit(stampDocSources(targets.kind === 'paths' ? new Set(targets.paths) : null) ? 0 : 1);
}

for (const markdownFile of walkMarkdown(root)) {
  checkInternalLinks(markdownFile);
  checkInternalAnchors(markdownFile);
  checkCitations(markdownFile);
}
checkAdrs();
checkReferenceDates();
checkDiscussionStatuses();
checkDocumentationGovernance();
checkChangelog();
checkGuidanceCatalog();
checkReadme();
checkDocSources();

if (errors.length > 0) {
  console.error('Documentation check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Documentation check passed.');
