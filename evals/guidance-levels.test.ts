import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * 지침 항목은 배포되거나 배포되지 않거나 둘 중 하나다. 예전의 세 단계는 「push 전에 승인을 받아라」
 * 같은 규칙에서 에이전트가 스스로 예외를 허락하게 했고, 켜는 두 단계가 행동을 바꿨다는 측정도
 * 없었다(ADR 0028). 이 평가들은 두 단계 계약을 고정한다: `on`과 `off`, 만든 블록에 단계 줄이 없고,
 * 단계를 정의하는 범례도 없다.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src', 'agctx.ts');

function profileHome(): { home: string; env: NodeJS.ProcessEnv } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agctx-levels-'));
  const env = { ...process.env, AGCTX_HOME: home, AGCTX_LANG: 'ko' };
  execFileSync(process.execPath, [cli, 'profile', 'create', 'team', '--scope', 'team'], { cwd: repoRoot, env });
  return { home, env };
}

test('setup은 on과 off만 받는다', () => {
  const { home, env } = profileHome();
  try {
    execFileSync(process.execPath, [cli, 'profile', 'setup', 'team', '--tdd', 'on', '--review', 'off'], {
      cwd: repoRoot,
      env
    });
    const metadata = JSON.parse(fs.readFileSync(path.join(home, 'profiles', 'team', 'profile.json'), 'utf8'));
    assert.equal(metadata.settings.tdd, 'on');
    assert.equal(metadata.settings.review, 'off');

    for (const value of ['recommended', 'strict']) {
      const result = spawnSync(process.execPath, [cli, 'profile', 'setup', 'team', '--tdd', value], {
        cwd: repoRoot,
        env,
        encoding: 'utf8'
      });
      assert.equal(result.status, 64, `이제 --tdd ${value}는 사용법 오류다`);
      assert.match(result.stderr, /on/, '오류가 대신 쓸 값을 알려 준다');
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('옛 단계로 저장한 프로필은 on으로 읽는다', () => {
  const { home, env } = profileHome();
  try {
    const metadataPath = path.join(home, 'profiles', 'team', 'profile.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metadata.settings = { ...metadata.settings, tdd: 'strict', review: 'recommended', language: 'off' };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');

    execFileSync(process.execPath, [cli, 'profile', 'setup', 'team', '--docs', 'off'], { cwd: repoRoot, env });
    const saved = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.equal(saved.settings.tdd, 'on', 'strict는 on이 된다. 둘 다 항목을 배포한다는 뜻이었다');
    assert.equal(saved.settings.review, 'on', 'recommended는 on이 된다');
    assert.equal(saved.settings.docs, 'off');
    assert.equal(saved.settings.language, 'off', 'off는 off로 남는다');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('만든 블록에는 단계 줄도 범례도 없다', () => {
  const { home, env } = profileHome();
  try {
    execFileSync(process.execPath, [cli, 'profile', 'setup', 'team', '--tdd', 'on'], { cwd: repoRoot, env });
    const instructions = fs.readFileSync(path.join(home, 'profiles', 'team', 'AGENTS.md'), 'utf8');
    assert.match(instructions, /## TDD/, '켠 항목은 블록에 남는다');
    assert.doesNotMatch(instructions, /적용 수준/, '단계 라벨도 범례 제목도 없다');
    assert.doesNotMatch(instructions, /^- on$/m, '항목 아래에 단계 줄이 없다');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
