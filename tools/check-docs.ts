#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { docSourceHashPath } from './doc-source-path.ts';
import { forbidsImplementationRecord, hasImplementationRecord, requiresImplementationRecord } from './discussion-record.ts';
import { readTopics, STATUSES, summaryImportance, TOPICS_FILE, topicFieldErrors, type DiscussionTopic, type DiscussionTopics } from './discussion-topics.ts';
import { applyCitationMarkers, citationExempt, citationMarkerProblems, lineNumberCitations, namedCitations } from './doc-citations.ts';
import { citedText, symbolDigest } from './symbol-source.ts';
import { adrEvidenceError, undatedReferenceLinkLines } from './doc-evidence.ts';
import { discussionRoots } from './discussion-roots.ts';
import { docSourceSections, SOURCE_ROOTS, unpinnedSources, wholeRootPins, withoutGeneratedBlocks, withoutRecordedHash } from './doc-sources.ts';
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

// A document points at code by file and name, never by line number, so that a
// change above the cited code cannot make the document wrong on its own. The
// decision is in docs/discussion/repository/topics/code-citation-style.md.
/** Digest of the code a citation points at, or null when the target carries none. */
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
    // A citation points at a declaration or a key, never at a name that only
    // appears inside one: the gate can fingerprint the former and not the latter.
    if (!file.endsWith('.md') && citedText(file, source, name) === null) {
      errors.push(`${relative}: ${name} in ${file} is not a top-level declaration or key; cite one that is`);
    }
  }

  for (const problem of citationMarkerProblems(content, citationDigest)) {
    errors.push(`${relative}: ${problem}. Re-read the document, then run \`node tools/check-docs.ts --stamp\``);
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
    const targetFile = target
      ? path.resolve(path.dirname(markdownFile), target)
      : markdownFile;
    if (!fs.existsSync(targetFile) || path.extname(targetFile) !== '.md') continue;

    const headings = [...fs.readFileSync(targetFile, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)]
      .map(match => markdownHeadingSlug(match[1]));
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
  const adrFiles = fs.readdirSync(adrDir).filter(name => /^\d{4}-[a-z0-9-]+\.md$/.test(name)).sort();
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

// The status of each topic comes from topics.json. The status lines, indexes
// and README lists are generated from it, and evals/discussion-status.test.ts
// checks that they are up to date.
function checkDiscussionArea(area: string, listed: DiscussionTopic[] | undefined) {
  const discussionDir = path.join(root, 'docs', 'discussion', area);
  const topicsDir = path.join(discussionDir, 'topics');
  const proposalSummaryFields = ['대상 계층', '제안 목표', '제안 이유', '결정할 것', '중요도', '선행 작업', '선행 제안', '후속 제안', '연관 제안', '후속 작업', '권장 다음 작업'];
  if (!fs.existsSync(path.join(discussionDir, 'README.md'))) {
    errors.push(`docs/discussion/${area}/README.md: a discussion area needs an index listing its topics and their status`);
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

  const topicFiles = fs.readdirSync(topicsDir).filter(name => name.endsWith('.md')).sort();
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
      errors.push(`${document}: Implemented topic must include an implementation record heading (#### 구현 기록: <범위>)`);
    }
    if (forbidsImplementationRecord(status) && hasImplementationRecord(content)) {
      errors.push(`${document}: a topic with an implementation record is at least Implementing; update its status in ${TOPICS_FILE}`);
    }
    const stated = summaryImportance(content);
    if (stated !== entries[0].importance) {
      errors.push(`${document}: 중요도 in the proposal summary (${stated ?? 'none'}) must match importance in ${TOPICS_FILE} (${entries[0].importance ?? 'none'})`);
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
    errors.push('docs/discussion/architecture/topics/implementation-contracts.md: must define the implementation contract');
  }

  for (const file of requiredReferences) {
    if (!fs.readFileSync(file, 'utf8').includes('implementation-contracts.md')) {
      errors.push(`${path.relative(root, file)}: must link to the canonical proposal format`);
    }
  }

  // A one-person toy project keeps the files that do something and drops the
  // ones that only signal an open-source process (ADR 0031). What is left is
  // the vulnerability report path and the two workflows that gate a release.
  for (const file of [
    path.join(root, 'SECURITY.md'),
    path.join(root, '.github', 'workflows', 'ci.yml'),
    path.join(root, '.github', 'workflows', 'publish.yml')
  ]) {
    if (!fs.existsSync(file)) errors.push(`${path.relative(root, file)}: public repository contract file must exist`);
  }
}

/**
 * Every deployed guidance sentence must be traceable to an external source, so
 * the catalog carries an evidence column whose links point at references.md.
 * A row without one means a sentence ships without recorded evidence.
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
    errors.push(`docs/reference/guidance-catalog.md: expected one row per guidance option (${GUIDANCE_KEYS.length}), found ${rows.length}`);
    return;
  }
  for (const key of GUIDANCE_KEYS) {
    if (!rows.some(row => row.startsWith(`| \`--${key}\``))) errors.push(`docs/reference/guidance-catalog.md: no row for --${key}`);
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

// A document may pin the source files it cites so its `파일:줄` citations do not
// silently drift. It carries two HTML-comment markers: the source list and the
// sha256 of those files. When any listed source changes, the recorded hash no
// longer matches and `pnpm run check` fails, forcing a re-read of the document.
// `--stamp` re-records the hash after a human has re-verified the document.
/** Every file below a directory, so a pinned folder covers what is inside it. */
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
 * sha256 over each pinned source's relative path and bytes. A source may be a
 * file or a directory; a directory hashes every file beneath it in sorted order,
 * so files added, removed, or edited inside it trip the gate without a list edit.
 */
function computeDocSourcesHash(sources: string[]) {
  const hash = createHash('sha256');
  for (const source of sources) {
    const sourcePath = path.join(root, source);
    if (!fs.existsSync(sourcePath)) {
      return { error: `doc-source not found: ${source}` };
    }
    const files = fs.statSync(sourcePath).isDirectory()
      ? walkFiles(sourcePath).sort()
      : [sourcePath];
    for (const filePath of files) {
      hash.update(docSourceHashPath(root, filePath));
      hash.update('\0');
      const bytes = fs.readFileSync(filePath);
      hash.update(filePath.endsWith('.md') ? withoutGeneratedBlocks(withoutRecordedHash(bytes.toString('utf8'))) : bytes);
      hash.update('\0');
    }
  }
  return { digest: hash.digest('hex') };
}

function checkDocSources() {
  const pins: string[] = [];
  for (const markdownFile of walkMarkdown(root)) {
    const content = fs.readFileSync(markdownFile, 'utf8');
    const relative = path.relative(root, markdownFile);
    // Documentation that describes the marker format uses <placeholder> text.
    // Ignore it so the gate acts only on markers whose list is real paths.
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
        errors.push(`${place}: pin the modules inside ${pin.replace(/\/+$/, '')}/ instead of the whole folder, so one change does not fail every document at once`);
      }
      pins.push(...section.sources);
      const computed = computeDocSourcesHash(section.sources);
      if (computed.error) {
        errors.push(`${place}: ${computed.error}`);
        continue;
      }
      if (section.digest === 'PENDING') {
        errors.push(`${place}: doc-source hash is PENDING. Verify this part against ${section.sources.join(', ')}, then run \`node tools/check-docs.ts --stamp\`.`);
        continue;
      }
      if (section.digest !== computed.digest) {
        errors.push(`${place}: doc sources changed since last verified. Re-read this part against ${section.sources.join(', ')}, fix any drift, then run \`node tools/check-docs.ts --stamp\`.`);
      }
    }
  }
  const sourceFiles = SOURCE_ROOTS
    .filter(sourceRoot => fs.existsSync(path.join(root, sourceRoot)))
    .flatMap(sourceRoot => walkFiles(path.join(root, sourceRoot)))
    .map(file => docSourceHashPath(root, file))
    .sort();
  for (const file of unpinnedSources(sourceFiles, pins)) {
    errors.push(`${file}: no document pins this source; add it, or the module folder holding it, to the agctx-doc-sources marker of the document that describes it`);
  }
}

function stampCitations(): string[] {
  const updated: string[] = [];
  for (const markdownFile of walkMarkdown(root)) {
    const relative = docSourceHashPath(root, markdownFile, path);
    if (citationExempt(relative)) continue;
    const content = fs.readFileSync(markdownFile, 'utf8');
    const stamped = applyCitationMarkers(content, citationDigest);
    if (stamped === content) continue;
    fs.writeFileSync(markdownFile, stamped);
    updated.push(relative);
  }
  return updated;
}

function stampDocSources() {
  let failed = false;
  const updated = stampCitations();
  for (const markdownFile of walkMarkdown(root)) {
    const content = fs.readFileSync(markdownFile, 'utf8');
    const sections = docSourceSections(content).filter(section => section.sources.length && !section.sources.some(source => /[<>]/.test(source)));
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

if (process.argv.includes('--stamp')) {
  process.exit(stampDocSources() ? 0 : 1);
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
