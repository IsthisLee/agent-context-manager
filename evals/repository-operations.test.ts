import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

function runReleaseCheck(args: string[]) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'tools/check-release.ts'), ...args], { encoding: 'utf8' });
}

test('CI는 지원하는 Node와 운영체제 조합에서 저장소를 검증한다', () => {
  const ci = read('.github/workflows/ci.yml');
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(packageJson.engines.node, '>=22.0.0');
  assert.equal(read('.nvmrc').trim(), '22');
  assert.match(ci, /pnpm\/action-setup@[0-9a-f]{40}/);
  assert.match(ci, /persist-credentials: false/);
  assert.match(ci, /pnpm install --frozen-lockfile/);
  assert.match(ci, /ubuntu-latest/);
  assert.match(ci, /macos-latest/);
  assert.match(ci, /windows-latest/);
  assert.match(ci, /node: 22\.x/);
  assert.match(ci, /node: 24\.x/);
  assert.match(ci, /node: 26\.x/);
  assert.match(ci, /pnpm run check/);
  assert.match(ci, /pnpm run package:smoke/);
  assert.match(ci, /pnpm run audit/);
});

test('npm 게시는 게시 전 검증과 provenance를 요구한다', () => {
  const publish = read('.github/workflows/publish.yml');
  assert.match(publish, /node-version: 24\.x/);
  assert.match(publish, /persist-credentials: false/);
  assert.match(publish, /id-token: write/);
  assert.match(publish, /pnpm run check:release/);
  assert.match(publish, /npm publish --provenance --access public/);
});

test('공개 저장소 운영 파일과 의존성 자동화 파일이 있다', () => {
  for (const relative of [
    'SECURITY.md',
    '.github/dependabot.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.editorconfig',
    '.gitattributes'
  ])
    assert(fs.existsSync(path.join(repoRoot, relative)), `${relative}이 있어야 한다`);
  // ADR 0031로 뺐다. 행동 규범과 이슈 템플릿은 두 사람 이상이 있어야 의미가 있고, CODEOWNERS는
  // 소유자가 둘 이상이어야 의미가 있다.
  for (const relative of ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', '.github/CODEOWNERS', '.github/ISSUE_TEMPLATE']) {
    assert(!fs.existsSync(path.join(repoRoot, relative)), `${relative}은 뺐고 계속 빠져 있어야 한다`);
  }
  const dependabot = read('.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('GitHub Actions 참조는 바뀌지 않는 커밋에 고정한다', () => {
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/dependency-review.yml',
    '.github/workflows/publish.yml'
  ]) {
    const workflow = read(relative);
    for (const match of workflow.matchAll(/uses:\s+([^\s#]+)@([^\s#]+)/g)) {
      assert.match(match[2], /^[0-9a-f]{40}$/, `${relative}: ${match[1]}은 40자 커밋 SHA를 써야 한다`);
    }
  }
});

test('모든 GitHub 워크플로는 checkout 자격 증명을 남기지 않는다', () => {
  for (const relative of [
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/dependency-review.yml',
    '.github/workflows/publish.yml'
  ]) {
    const workflow = read(relative);
    const checkouts = [
      ...workflow.matchAll(/uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=\n {6}- name:|\n {2}jobs:|$)/g)
    ];
    assert(checkouts.length > 0, `${relative}은 checkout을 써야 한다`);
    for (const [, block] of checkouts) assert.match(block, /persist-credentials: false/);
  }
});

test('워크플로의 최상위 권한은 읽기뿐이고, 쓰기 권한은 그것이 필요한 작업에만 준다', () => {
  const workflows = fs
    .readdirSync(path.join(repoRoot, '.github/workflows'))
    .filter(name => name.endsWith('.yml'))
    .map(name => `.github/workflows/${name}`);
  assert.ok(workflows.length > 0);
  for (const relative of workflows) {
    const top = read(relative).match(/^permissions:\n((?:[ \t]+.*\n)+)/m);
    assert.ok(top, `${relative}에 최상위 permissions가 있어야 한다`);
    assert.doesNotMatch(top[1], /:\s*write/, `${relative}의 최상위 permissions에 쓰기 권한이 있다`);
  }
  // 쓰기 권한은 옮겼을 뿐 없애지 않았다.
  assert.match(read('.github/workflows/codeql.yml'), /^ {4}permissions:\n(?: {6}.*\n)*? {6}security-events: write$/m);
  assert.match(read('.github/workflows/publish.yml'), /^ {4}permissions:\n(?: {6}.*\n)*? {6}id-token: write$/m);
});

test('release check는 빠진 태그를 스택 추적 없는 깔끔한 오류로 보고한다', () => {
  const result = runReleaseCheck([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Error: A release tag is required/m);
  assert.doesNotMatch(result.stderr, /\n\s+at /, 'Node 스택 추적을 출력하면 안 된다');
});

test('release check는 현재 패키지 버전 태그에서 통과한다', () => {
  const { version } = JSON.parse(read('package.json'));
  const result = runReleaseCheck([`v${version}`]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Release contract passed for v${version.replaceAll('.', '\\.')}\\.`));
});
