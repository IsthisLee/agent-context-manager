import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  extractAgentsManagedDocument,
  formatterNormalized,
  formatterUnstableLines,
  hashAgentsManagedDocument
} from '../src/project/analyzer.ts';
import { renderProfileAgents } from '../src/profile/apply.ts';
import { SUPPORTED_LOCALES, setLocale, t } from '../src/i18n/index.ts';

/**
 * 저장할 때 Markdown을 포맷하는 편집기는 파일 전체를 다시 쓴다. agctx가 관리 영역에 쓰는 내용이
 * 포매터가 만드는 모양이 아니면, 파일을 저장하기만 해도 관리 영역의 바이트가 바뀌고 `agctx check`가
 * 그 사람이 만든 적 없는 충돌을 보고한다.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const reasons = (text: string) => formatterUnstableLines(text).map(found => `line ${found.line}: ${found.reason}`);

test('formatterUnstableLines는 Markdown 포매터가 다시 쓸 것을 알려 준다', () => {
  assert.deepEqual(formatterUnstableLines('- kept\n'), []);
  assert.deepEqual(formatterUnstableLines('* changed\n'), [{ line: 1, reason: 'bullet marker is not -' }]);
  assert.deepEqual(formatterUnstableLines('+ changed\n'), [{ line: 1, reason: 'bullet marker is not -' }]);
  assert.deepEqual(formatterUnstableLines('본문 \n'), [{ line: 1, reason: 'trailing whitespace' }]);
  assert.deepEqual(formatterUnstableLines('## 제목\n본문\n'), [{ line: 1, reason: 'no blank line after heading' }]);
  assert.deepEqual(formatterUnstableLines('본문\n\n\n다음\n'), [{ line: 3, reason: 'consecutive blank lines' }]);

  assert.deepEqual(formatterUnstableLines('*강조*는 목록이 아니다\n'), [], '강조는 목록 기호가 아니다');
  assert.deepEqual(formatterUnstableLines('```sh\n* echo\n```\n'), [], '포매터는 펜스 코드를 건드리지 않는다');
  assert.deepEqual(formatterUnstableLines('## 제목\n\n본문\n'), []);
});

test('agctx가 쓰는 모든 템플릿은 포매터를 거쳐도 바뀌지 않는다', () => {
  const templates = [
    'templates/CLAUDE.md',
    'templates/CLAUDE.link.md',
    'templates/antigravity-rules/agctx.md',
    'templates/profile/AGENTS.md',
    'templates/profile/AGENTS.ko.md'
  ];
  for (const template of templates) {
    assert.deepEqual(reasons(read(template)), [], `${template}은 저장할 때 다시 쓰여 충돌이 된다`);
  }
});

test('agctx가 AGENTS.md에 붙이는 프로젝트 컨텍스트는 포매터를 거쳐도 바뀌지 않는다', () => {
  for (const locale of SUPPORTED_LOCALES) {
    setLocale(locale);
    const rendered = renderProfileAgents('# 프로필 지침\n\n- 규칙 하나.\n', 'isthis', 'my-app');
    assert.deepEqual(reasons(rendered), [], `${locale} 렌더링은 저장할 때 다시 쓰일 것이다`);
    assert.deepEqual(
      reasons(t(locale, 'scaffold.extBody')),
      [],
      `${locale} 확장 영역 본문은 저장할 때 다시 쓰일 것이다`
    );
  }
});

/** 프로필을 이미 적용한 프로젝트. 버려도 되는 agctx 홈에 있다. */
function applied(t: TestContext) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-formatter-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const run = (args: string[]) =>
    spawnSync(process.execPath, [path.join(repoRoot, 'src', 'agctx.ts'), ...args], {
      cwd: repoRoot,
      env: { ...process.env, AGCTX_HOME: home },
      encoding: 'utf8'
    });
  const ok = (args: string[]) => {
    const result = run(args);
    assert.equal(result.status, 0, `${args.join(' ')} 실패\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  ok(['profile', 'create', 'team', '--scope', 'team']);
  ok(['profile', 'apply', 'team', project, '--yes']);
  const read = (rel: string) => fs.readFileSync(path.join(project, rel), 'utf8');
  const write = (rel: string, content: string) => fs.writeFileSync(path.join(project, rel), content);
  return { project, run, read, write };
}

test('agctx가 쓸 내용이 이미 든 관리 영역은 충돌이 아니다', t => {
  // 예전 agctx는 `* **Project:**`를 썼고 편집기의 포매터가 저장할 때 `- **Project:**`로 바꿨다.
  // 이 버전도 `-`를 쓴다. 파일에는 이미 sync가 쓸 내용이 있으므로, 여기서 멈추면 그 사람은 더 나은
  // 결과로 풀 수 없는 충돌만 떠안는다.
  const fixture = applied(t);
  const region = extractAgentsManagedDocument(fixture.read('AGENTS.md')) ?? '';
  assert.ok(region.includes('- **Project:**'), '적용한 관리 영역에 프로젝트 줄이 있다');

  const config = JSON.parse(fixture.read('agctx.project.json'));
  config.managedHashes['AGENTS.md'] = createHash('sha256')
    .update(region.replace('- **Project:**', '* **Project:**'))
    .digest('hex');
  fixture.write('agctx.project.json', `${JSON.stringify(config, null, 2)}\n`);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 0, `sync가 어차피 쓰려던 관리 영역에서 멈췄다\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /conflict/);
});

test('다른 것이 든 관리 영역은 여전히 충돌이다', t => {
  const fixture = applied(t);
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace(/^(# .*\n)/, '$1\n## 내가 끼워 넣은 절\n'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 2, 'agctx가 덮어쓸 수정이 있으면 여전히 아무것도 쓰기 전에 멈춘다');
});

test('포매터가 관리 영역의 목록 기호 하나를 바꾸면 해시가 바뀐다', () => {
  const document =
    '# 지침\n\n## Project context\n\n- **Project:** my-app\n\n## 4. 프로젝트 규칙 확장 (SSOT)\n\n- 내 규칙.\n';
  const formatted = document.replace('- **Project:**', '* **Project:**');

  assert.notEqual(
    hashAgentsManagedDocument(document),
    hashAgentsManagedDocument(formatted),
    '관리 영역 안의 한 바이트만으로도 충돌을 보고한다'
  );
  assert.deepEqual(
    reasons(formatted),
    [{ line: 5, reason: 'bullet marker is not -' }].map(found => `line ${found.line}: ${found.reason}`),
    '그래서 프로젝트에 닿기 전에 검사가 그 줄을 알려 준다'
  );
});

test('포매터만 건드린 영역은 agctx가 다른 것을 쓰려 해도 충돌이 아니다', t => {
  // base 파일은 agctx가 마지막으로 쓴 내용을 알려 준다. 그것과의 차이가 포매터가 하는 일뿐이면
  // 아무도 관리 영역을 고치지 않은 것이므로, 다른 이유로 그 영역을 바꾸는 sync도 잃을 것이 없다.
  const fixture = applied(t);
  const before = fixture.read('AGENTS.md');
  fixture.write(
    'AGENTS.md',
    before.replace('- **Project:**', '* **Project:**').replace(/\n## Project context\n/, '\n## Project context  \n')
  );

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 0, `다시 포맷한 관리 영역이 sync를 멈췄다\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /conflict/);
});

test('관리 영역 안에서 낱말이 바뀌면 여전히 충돌이다', t => {
  const fixture = applied(t);
  fixture.write('AGENTS.md', fixture.read('AGENTS.md').replace('- **Project:** ', '- **Project:** my-'));

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 2, '서식을 정규화해도 실제 수정을 숨기면 안 된다');
});

test('formatterNormalized는 포매터가 바꾸는 것만 평평하게 하고 다른 것은 건드리지 않는다', () => {
  assert.equal(formatterNormalized('* 하나\n+ 둘\n'), '- 하나\n- 둘');
  assert.equal(formatterNormalized('본문   \n'), '본문');
  assert.equal(formatterNormalized('가\n\n\n\n나\n'), '가\n나', '블록 사이의 빈 줄은 포매터가 정할 일이다');
  assert.equal(formatterNormalized('## 가\r\n\r\n나\r\n'), '## 가\n나');
  assert.notEqual(formatterNormalized('- 하나'), formatterNormalized('- 둘'), '낱말은 절대 건드리지 않는다');
  assert.notEqual(formatterNormalized('- 하나'), formatterNormalized('하나'), '목록 항목은 문단과 같지 않다');
});

test('formatterNormalized는 포매터가 다시 접은 문단을 합친다. Markdown은 그것을 같게 읽기 때문이다', () => {
  assert.equal(formatterNormalized('한 문단이\n두 줄로 접혔다\n'), formatterNormalized('한 문단이 두 줄로 접혔다\n'));
  assert.equal(formatterNormalized('- 목록 항목이\n  접혔다\n'), formatterNormalized('- 목록 항목이 접혔다\n'));

  assert.notEqual(
    formatterNormalized('가\n나\n'),
    formatterNormalized('가\n\n나\n'),
    '빈 줄은 여전히 두 블록을 나눈다'
  );
  assert.notEqual(
    formatterNormalized('- 가\n- 나\n'),
    formatterNormalized('- 가 - 나\n'),
    '두 목록 항목은 하나가 아니다'
  );
  assert.notEqual(
    formatterNormalized('## 제목\n본문\n'),
    formatterNormalized('## 제목 본문\n'),
    '제목은 그 자체로 한 블록이다'
  );
  assert.notEqual(
    formatterNormalized('| 가 |\n| 나 |\n'),
    formatterNormalized('| 가 | | 나 |\n'),
    '표 행은 행으로 남는다'
  );
  assert.notEqual(
    formatterNormalized('문단에 낱말을 더했다\n'),
    formatterNormalized('문단에 낱말을 크게 더했다\n'),
    '낱말은 절대 건드리지 않는다'
  );
  assert.equal(
    formatterNormalized('```sh\necho 하나\necho 둘\n```\n'),
    '```sh\necho 하나\necho 둘\n```',
    '펜스 코드는 줄바꿈을 유지한다'
  );
});

test('포매터가 다시 접은 관리 영역은 충돌이 아니다', t => {
  // `proseWrap: always`인 Prettier는 모든 문단을 다시 접는다. 그 사람이 쓴 것은 바뀌지 않았으므로
  // agctx는 이것을 편집으로 보면 안 된다. 그렇게 보면 `resolve`가 관리 영역 전체를 「더한 줄」로
  // 확장 영역에 복사한다.
  const fixture = applied(t);
  const before = fixture.read('AGENTS.md');
  const rewrapped = before
    .split('\n')
    .map(line =>
      line.length > 40 && !line.startsWith('#') && !line.startsWith('<') ? line.replace(/(.{1,40}) /g, '$1\n') : line
    )
    .join('\n');
  assert.notEqual(rewrapped, before, '픽스처가 실제로 무언가를 다시 접었다');
  fixture.write('AGENTS.md', rewrapped);

  const result = fixture.run(['profile', 'sync', '--dry-run', fixture.project]);
  assert.equal(result.status, 0, `다시 접은 관리 영역이 sync를 멈췄다\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout, /conflict/);
});
