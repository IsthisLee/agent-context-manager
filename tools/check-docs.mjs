#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function walkMarkdown(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(entryPath, files);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
  }
  return files;
}

function contentWithoutCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, '');
}

function markdownHeadingSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function checkInternalAnchors(markdownFile) {
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

function checkInternalLinks(markdownFile) {
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
  }

  const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
  const indexed = [...index.matchAll(/\]\(adr\/(\d{4}-[a-z0-9-]+\.md)\)/g)].map(match => match[1]);
  if (indexed.join('|') !== adrFiles.join('|')) {
    errors.push('docs/README.md: ADR index must contain every ADR exactly once in filename order');
  }
}

function checkDiscussionStatuses() {
  const discussionDir = path.join(root, 'docs', 'discussion', 'architecture');
  const topicsDir = path.join(discussionDir, 'topics');
  const allowed = new Set(['Proposed', 'Implementing', 'Implemented', 'Superseded', 'Active reference', 'Active process']);
  const proposalSummaryFields = ['대상 계층', '제안 목표', '제안 이유', '결정할 것', '중요도', '선행 작업', '선행 제안', '후속 제안', '연관 제안', '후속 작업', '권장 다음 작업'];
  const index = fs.readFileSync(path.join(discussionDir, 'README.md'), 'utf8');

  if (!fs.existsSync(topicsDir)) {
    errors.push('docs/discussion/architecture/topics: must exist');
    return;
  }

  for (const name of fs.readdirSync(discussionDir).filter(name => name.endsWith('.md') && name !== 'README.md')) {
    errors.push(`docs/discussion/architecture/${name}: move topic documents into topics/`);
  }

  const topicFiles = fs.readdirSync(topicsDir).filter(name => name.endsWith('.md')).sort();
  const indexedTopics = [...index.matchAll(/\]\(topics\/([^\s)#]+\.md)\)/g)].map(match => match[1]);
  for (const name of topicFiles) {
    const content = fs.readFileSync(path.join(topicsDir, name), 'utf8');
    const match = content.match(/^\*\*상태:\*\* (.+)$/m);
    if (!match || !allowed.has(match[1].trim())) {
      errors.push(`docs/discussion/architecture/topics/${name}: use an allowed **상태:** value`);
      continue;
    }

    if (['Proposed', 'Implementing'].includes(match[1].trim())) {
      for (const field of proposalSummaryFields) {
        if (!content.includes(`| ${field} |`)) {
          errors.push(`docs/discussion/architecture/topics/${name}: missing proposal summary field (${field})`);
        }
      }
    }

    const occurrences = indexedTopics.filter(indexedName => indexedName === name).length;
    if (occurrences !== 1) {
      errors.push(`docs/discussion/architecture/README.md: ${name} must be indexed exactly once`);
    }
    const indexRow = index.split('\n').find(line => line.includes(`](topics/${name})`));
    const indexStatus = indexRow?.split('|').map(cell => cell.trim()).filter(Boolean).at(-1);
    if (indexStatus !== match[1].trim()) {
      errors.push(`docs/discussion/architecture/README.md: status for ${name} must match its document`);
    }
  }

  for (const indexedName of new Set(indexedTopics)) {
    if (!topicFiles.includes(indexedName)) {
      errors.push(`docs/discussion/architecture/README.md: index references missing topic ${indexedName}`);
    }
  }
}

function checkReadme() {
  const readmePath = path.join(root, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf8');
  const requiredHeadings = ['## 핵심 목표', '## 핵심 기능', '## 🧭 아키텍처 방향과 진행 상태', '## 빠른 시작', '## 문서'];
  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) errors.push(`README.md: missing required section ${heading}`);
  }
  for (const requiredText of [
    '@isthis/agentic',
    'npm install --global',
    'agt',
    'pnpm run check',
    'docs/discussion/architecture/',
    '개인·조직·프로젝트와 여러 AI 에이전트에 안전하게 적용·동기화·관리'
  ]) {
    if (!content.includes(requiredText)) errors.push(`README.md: missing required product guidance ${requiredText}`);
  }
}

function checkDocumentationGovernance() {
  const proposalFormat = path.join(root, 'docs', 'discussion', 'architecture', 'topics', 'implementation-contracts.md');
  const requiredReferences = [
    path.join(root, 'AGENTS.md'),
    path.join(root, 'docs', 'product-direction.md'),
    path.join(root, 'docs', 'README.md'),
    path.join(root, 'docs', 'repository-operations.md')
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

  for (const file of [
    path.join(root, 'CONTRIBUTING.md'),
    path.join(root, 'CODE_OF_CONDUCT.md'),
    path.join(root, 'SECURITY.md'),
    path.join(root, '.github', 'workflows', 'ci.yml'),
    path.join(root, '.github', 'workflows', 'publish.yml')
  ]) {
    if (!fs.existsSync(file)) errors.push(`${path.relative(root, file)}: public repository contract file must exist`);
  }
}

function checkChangelog() {
  const changelog = path.join(root, 'CHANGELOG.md');
  if (!fs.existsSync(changelog) || !/^## \[Unreleased\]/m.test(fs.readFileSync(changelog, 'utf8'))) {
    errors.push('CHANGELOG.md: must contain a ## [Unreleased] section');
  }
}

for (const markdownFile of walkMarkdown(root)) {
  checkInternalLinks(markdownFile);
  checkInternalAnchors(markdownFile);
}
checkAdrs();
checkDiscussionStatuses();
checkDocumentationGovernance();
checkChangelog();
checkReadme();

if (errors.length > 0) {
  console.error('Documentation check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Documentation check passed.');
