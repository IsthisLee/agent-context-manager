import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, gitIn, makeWorkspace, repoRoot } from './support/git-workspace.ts';

/**
 * 가이드와 개념 문서가 싣는 명령 출력을 실제로 실행해 비교한다. 예시 블록 바로 앞의
 * `<!-- agctx-example: <이름> -->` 주석이 고정물을 고르고, 고정물이 문서의 상태를 임시 폴더에 만든다.
 * 그래서 이 문서들은 메시지 카탈로그 전체를 핀하지 않아도 출력 문구가 바뀌면 이 평가가 실패한다.
 *
 * 비교 규칙: 임시 경로는 문서의 경로로 바꾸고, 7자리 커밋 해시는 `<commit>`으로 맞춘다. 문서의 `…`만
 * 있는 줄은 실제 출력의 여러 줄을 건너뛰고, 줄 끝의 `…`는 그 앞까지만 비교한다.
 */

interface Scenario {
  cwd: string;
  env: Record<string, string>;
  /** 실제 경로(또는 URL)와 문서에 적은 경로. 긴 것부터 바꾼다. */
  paths: [actual: string, doc: string][];
  /** 블록의 n번째 명령을 실행하기 전에 할 일. 문서가 글로 설명한 단계다. */
  before?: (block: number, command: number) => void;
}

type Fixture = (t: TestContext) => Scenario;

/** 문서 안의 예시 블록: 고정물 이름과, `$` 명령마다 기대하는 출력. */
interface Example {
  fixture: string;
  block: number;
  steps: { command: string; expected: string[] }[];
}

function examples(markdown: string): Example[] {
  const found: Example[] = [];
  const counts = new Map<string, number>();
  const annotations = [...markdown.matchAll(/<!-- agctx-example: ([\w-]+) -->/g)].length;
  for (const match of markdown.matchAll(/<!-- agctx-example: ([\w-]+) -->\n(\s*)```bash\n([\s\S]*?)\n\s*```/g)) {
    const [, fixture, indent, body] = match;
    const block = counts.get(fixture) ?? 0;
    counts.set(fixture, block + 1);
    const steps: Example['steps'] = [];
    for (const raw of body.split('\n')) {
      const line = raw.startsWith(indent) ? raw.slice(indent.length) : raw.trimStart();
      if (line.startsWith('$ ')) steps.push({ command: line.slice(2), expected: [] });
      else steps.at(-1)?.expected.push(line);
    }
    for (const step of steps) while (step.expected.at(-1)?.trim() === '') step.expected.pop();
    found.push({ fixture, block, steps });
  }
  // 주석 뒤에 bash 블록이 오지 않으면 그 예시는 조용히 빠진다. 빠뜨리지 않게 수를 맞춘다.
  assert.equal(found.length, annotations, '모든 agctx-example 주석 바로 뒤에 bash 블록이 있다');
  return found;
}

/** 작은따옴표와 큰따옴표를 이해하는 단어 나누기. 예시 명령만 다루면 된다. */
function words(command: string): string[] {
  return [...command.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map(match => match[1] ?? match[2] ?? match[3]);
}

function toDoc(output: string, paths: Scenario['paths']): string {
  let text = output;
  for (const [actual, doc] of [...paths].sort((a, b) => b[0].length - a[0].length)) {
    text = text.split(actual).join(doc);
    // Windows에서는 문서 경로 뒤의 구분자가 역슬래시다.
    text = text.replace(
      new RegExp(`${doc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}((?:\\\\[^\\s\\\\]+)+)`, 'g'),
      (_m, rest: string) => `${doc}${rest.replaceAll('\\', '/')}`
    );
  }
  return text;
}

/** 문서 쪽의 커밋 짧은 해시: 숫자와 a~f가 함께 든 7자리 16진수. 낱말(`defaced`)이나 숫자(`1000000`)는 아니다. */
const DOC_HASH = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7}\b/g;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 문서의 한 줄을 실제 줄에 맞추는 정규식과, 그 줄에 든 문서 해시. 문서 해시 자리에는 실제 줄의 어떤 7자리
 * 16진수든 올 수 있다(실제 해시는 숫자로만 이루어질 수도 있다). 줄 끝의 `…`는 그 앞까지만 비교하되, 실제
 * 줄에서 그 뒤가 낱말 경계(공백이나 줄 끝)여야 한다.
 */
function lineMatcher(want: string): { pattern: RegExp; hashes: string[] } {
  const elided = want.endsWith('…');
  const text = elided ? want.slice(0, -1).trimEnd() : want;
  const hashes = [...text.matchAll(DOC_HASH)].map(match => match[0]);
  const body = text.split(DOC_HASH).map(escape).join('([0-9a-f]{7})');
  return { pattern: new RegExp(elided ? `^${body}(?=\\s|$)` : `^${body}$`), hashes };
}

/**
 * 문서의 줄과 실제 줄을 맞춘다. `…`만 있는 줄은 여러 줄을 건너뛰고, 같은 문서 해시는 한 단계 안에서 늘 같은
 * 실제 해시에, 다른 문서 해시는 다른 실제 해시에 대응해야 한다(예: `ab35396→c61bea6`의 양쪽이 다른 커밋인지).
 */
function matches(expectedLines: readonly string[], actualLines: readonly string[]): boolean {
  const expected = expectedLines.map(line => line.trimEnd());
  const actual = actualLines.map(line => line.trimEnd());
  const go = (e: number, a: number, pairs: ReadonlyMap<string, string>): boolean => {
    if (e === expected.length) return a === actual.length;
    if (expected[e].trim() === '…') {
      for (let skip = a; skip <= actual.length; skip++) if (go(e + 1, skip, pairs)) return true;
      return false;
    }
    if (a === actual.length) return false;
    const { pattern, hashes } = lineMatcher(expected[e]);
    const found = actual[a].match(pattern);
    if (!found) return false;
    const next = new Map(pairs);
    for (const [index, hash] of hashes.entries()) {
      const value = found[index + 1];
      const known = next.get(hash);
      if (known !== undefined && known !== value) return false;
      if (known === undefined && [...next.values()].includes(value)) return false;
      next.set(hash, value);
    }
    return go(e + 1, a + 1, next);
  };
  return go(0, 0, new Map());
}

function runExamples(t: TestContext, doc: string, fixtures: Record<string, Fixture>): void {
  const markdown = fs.readFileSync(path.join(repoRoot, doc), 'utf8');
  const found = examples(markdown);
  assert.ok(found.length, `${doc}에 고정물을 붙인 예시가 있다`);
  const scenarios = new Map<string, Scenario>();
  for (const example of found) {
    const fixture = fixtures[example.fixture];
    assert.ok(fixture, `${doc}: 고정물 ${example.fixture}가 있다`);
    const scenario = scenarios.get(example.fixture) ?? fixture(t);
    scenarios.set(example.fixture, scenario);
    let status = 0;
    example.steps.forEach((step, index) => {
      scenario.before?.(example.block, index);
      let command = step.command;
      for (const [actual, docPath] of [...scenario.paths].sort((a, b) => b[1].length - a[1].length))
        command = command.split(docPath).join(actual);
      let output = '';
      const cd = command.match(/^cd (\S+)(?: && (.*))?$/);
      if (cd) {
        scenario.cwd = path.resolve(scenario.cwd, cd[1]);
        command = cd[2] ?? '';
        status = 0;
      }
      const [program, ...args] = words(command);
      if (!program) return;
      if (program === 'echo' && args[0] === '$?') output = `${status}\n`;
      else if (program === 'printf') {
        status = 0;
        const target = path.resolve(scenario.cwd, args[2]);
        assert.equal(args[1], '>', `${doc}: printf는 파일로 보내는 예시만 다룬다`);
        fs.writeFileSync(target, args[0].replaceAll('\\n', '\n'));
      } else {
        assert.equal(program, 'agctx', `${doc}: 예시 실행기가 모르는 명령: ${step.command}`);
        const result = spawnSync(process.execPath, [cli, ...args], {
          cwd: scenario.cwd,
          env: { ...process.env, ...scenario.env },
          encoding: 'utf8'
        });
        status = result.status ?? 1;
        output = result.stdout + result.stderr;
      }
      const actual = toDoc(output, scenario.paths).replace(/\s+$/, '');
      const lines = actual ? actual.split('\n') : [];
      assert.ok(
        matches(step.expected, lines),
        `${doc} (${example.fixture} #${example.block + 1}) $ ${step.command}\n--- 문서\n${step.expected.join('\n')}\n--- 실제\n${actual}`
      );
    });
  }
}

/** agctx 홈과 사용자 홈을 따로 둔 사람 한 명과, 프로필을 만드는 도우미. */
function person(t: TestContext, prefix: string) {
  const workspace = makeWorkspace(t, prefix);
  const userHome = workspace.folder('user-home');
  const env = {
    AGCTX_HOME: path.join(workspace.root, 'agctx-home'),
    AGCTX_LANG: 'en',
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: path.join(userHome, '.codex'),
    CLAUDE_CONFIG_DIR: path.join(userHome, '.claude'),
    GIT_AUTHOR_NAME: 'tester',
    GIT_AUTHOR_EMAIL: 'tester@example.com',
    GIT_COMMITTER_NAME: 'tester',
    GIT_COMMITTER_EMAIL: 'tester@example.com'
  };
  const agctx = (args: string[], cwd = workspace.root) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `agctx ${args.join(' ')}\n${result.stdout}${result.stderr}`);
  };
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const repo = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    gitIn(dir, 'init', '--quiet', '--initial-branch=main');
    return dir;
  };
  return { ...workspace, env, agctx, write, repo, profiles: path.join(env.AGCTX_HOME, 'profiles') };
}

const PAYMENTS_RULE = (trigger: string) =>
  `---\ntrigger: ${trigger}\nglobs: services/payments/**\n---\n\n- Payments rule.\n`;

const FIXTURES: Record<string, Fixture> = {
  /** 루트에 프로필을 적용한 뒤 결제 서비스의 AGENTS.md와 glob 규칙을 더한 모노레포. */
  'explain-payments': t => {
    const me = person(t, 'agctx-doc-explain-');
    const repo = me.repo(me.folder('shop'));
    me.agctx(['profile', 'create', 'team-backend', '--scope', 'team']);
    me.agctx(['profile', 'apply', 'team-backend', repo, '--yes']);
    me.write(path.join(repo, 'services', 'payments', 'AGENTS.md'), '# Payments\n\n- Use idempotency keys.\n');
    me.write(path.join(repo, '.agents', 'rules', 'payments.md'), PAYMENTS_RULE('glob'));
    return {
      cwd: repo,
      env: me.env,
      paths: [[repo, '/work/shop']],
      // 두 번째 예시 앞의 글: 규칙의 trigger를 always_on으로 고친다.
      before: (block, command) => {
        if (block === 1 && command === 0)
          me.write(path.join(repo, '.agents', 'rules', 'payments.md'), PAYMENTS_RULE('always_on'));
      }
    };
  },
  /** APM이 같은 규칙 세 줄을 AGENTS.md와 .claude/rules/api.md에 넣은 저장소. */
  'apm-duplicate': t => {
    const me = person(t, 'agctx-doc-apm-');
    const repo = me.repo(me.folder('api'));
    me.agctx(['profile', 'create', 'team-backend', '--scope', 'team']);
    me.agctx(['profile', 'apply', 'team-backend', repo, '--yes']);
    const rules = '- Validate every request body.\n- Return problem+json errors.\n- Version every public endpoint.\n';
    fs.appendFileSync(path.join(repo, 'AGENTS.md'), `\n<!-- apm:start -->\n${rules}<!-- apm:end -->\n`);
    me.write(path.join(repo, '.claude', 'rules', 'api.md'), `---\npaths:\n  - "**"\n---\n\n${rules}`);
    return { cwd: repo, env: me.env, paths: [[repo, '/work/api']] };
  },
  /** 사람이 둔 packages/web/CLAUDE.md가 AGENTS.md를 가져오지 않는 모노레포. */
  'monorepo-web': t => {
    const me = person(t, 'agctx-doc-monorepo-');
    const repo = me.repo(me.folder('shop'));
    me.write(path.join(repo, 'packages', 'web', 'AGENTS.md'), '# Web\n');
    me.write(path.join(repo, 'packages', 'web', 'CLAUDE.md'), '# Notes a person wrote\n');
    me.agctx(['profile', 'create', 'team-backend', '--scope', 'team']);
    me.agctx(['profile', 'apply', 'team-backend', repo, '--yes']);
    return {
      cwd: repo,
      env: me.env,
      paths: [[repo, '/work/shop']],
      // 두 번째 예시 앞의 글: missing 줄의 안내대로 @AGENTS.md를 더한다.
      before: (block, command) => {
        if (block === 1 && command === 0)
          fs.appendFileSync(path.join(repo, 'packages', 'web', 'CLAUDE.md'), '\n@AGENTS.md\n');
      }
    };
  },
  /** 개인 프로필을 쓰는 저장소 둘이 뒤처졌고 고객사 저장소 하나는 최신인 컴퓨터. */
  'repos-personal': t => {
    const me = person(t, 'agctx-doc-repos-');
    const work = me.folder('work');
    me.agctx(['profile', 'create', 'personal', '--scope', 'personal']);
    me.agctx(['profile', 'create', 'client-a', '--scope', 'company']);
    for (const [name, profile] of [
      ['blog', 'personal'],
      ['client-a-api', 'client-a'],
      ['notes', 'personal']
    ]) {
      const repo = me.repo(path.join(work, name));
      me.agctx(['profile', 'apply', profile, repo, '--yes']);
    }
    fs.appendFileSync(path.join(me.profiles, 'personal', 'AGENTS.md'), '\n- Write the test first.\n');
    return { cwd: work, env: me.env, paths: [[work, '/work']] };
  },
  /** 같은 Git 프로필을 고정하지 않은 web-app과 고정한 orders-api에 적용한 뒤 프로필에 새 커밋이 생긴 컴퓨터. */
  'repos-pinned': t => pinnedPair(t, '/work'),
  'update-policies': t => pinnedPair(t, '/path/to', false),
  /** 규칙을 templates/AGENTS.md에 둔 규칙 저장소와, 그 저장소를 받는 팀원. */
  'link-rules': t => {
    const me = person(t, 'agctx-doc-link-');
    const rules = me.repo(me.folder('team-rules'));
    me.write(path.join(rules, 'templates', 'AGENTS.md'), '# Team rules\n\n- Review every migration.\n');
    const published = path.join(me.root, 'remotes', 'team-rules.git');
    const bare = path.join(me.root, 'remotes', 'no-profile.git');
    for (const remote of [published, bare])
      gitIn(me.root, 'init', '--bare', '--quiet', '--initial-branch=main', remote);
    // 팀원이 받을 원격: profile.json을 커밋해 올린 규칙 저장소.
    const upstream = me.repo(me.folder('upstream'));
    me.write(path.join(upstream, 'templates', 'AGENTS.md'), '# Team rules\n');
    me.write(
      path.join(upstream, 'profile.json'),
      `${JSON.stringify({ schemaVersion: 2, name: 'team-rules', scope: 'team', instructions: 'templates/AGENTS.md' })}\n`
    );
    gitIn(upstream, 'add', '-A');
    gitIn(upstream, 'commit', '--quiet', '-m', 'Add profile');
    gitIn(upstream, 'push', '--quiet', published, 'main');
    const plain = me.repo(me.folder('plain'));
    me.write(path.join(plain, 'AGENTS.md'), '# Rules\n');
    gitIn(plain, 'add', '-A');
    gitIn(plain, 'commit', '--quiet', '-m', 'Add rules');
    gitIn(plain, 'push', '--quiet', bare, 'main');
    const teammate = path.join(me.root, 'teammate-home');
    const scenario: Scenario = {
      cwd: me.root,
      env: { ...me.env },
      paths: [
        [rules, '/work/team-rules'],
        [path.join(me.env.AGCTX_HOME, 'profiles'), '~/.agctx/profiles'],
        [published, 'git@github.com:acme/team-rules.git']
      ],
      before: (block, command) => {
        // 둘째 예시의 clone은 profile.json을 커밋해 올린 뒤 다른 컴퓨터의 팀원이 한다.
        if (block === 1 && command === 0) scenario.env.AGCTX_HOME = teammate;
        // 셋째 예시는 profile.json이 없는 저장소를 받는다.
        if (block === 2 && command === 0) scenario.paths[2] = [bare, 'git@github.com:acme/team-rules.git'];
      }
    };
    return scenario;
  }
};

function pinnedPair(t: TestContext, docRoot: string, synced = true): Scenario {
  const me = person(t, 'agctx-doc-pinned-');
  const work = me.folder('work');
  me.agctx(['profile', 'create', 'team-backend', '--scope', 'team']);
  const profile = path.join(me.profiles, 'team-backend');
  gitIn(profile, 'init', '--quiet', '--initial-branch=main');
  gitIn(profile, 'add', '-A');
  gitIn(profile, 'commit', '--quiet', '-m', 'Add profile');
  const orders = me.repo(path.join(work, 'orders-api'));
  const web = me.repo(path.join(work, 'web-app'));
  me.agctx(['profile', 'apply', 'team-backend', orders, '--pin', '--yes']);
  me.agctx(['profile', 'apply', 'team-backend', web, '--yes']);
  // 문서의 「관리자가 변경 검토 지침을 켜서 올린 커밋을 profile pull로 받은」 상태: 보관함에 새 커밋이 있다.
  fs.appendFileSync(path.join(profile, 'AGENTS.md'), '\n- Review changes before merging.\n');
  gitIn(profile, 'commit', '--quiet', '-am', 'Turn on change review');
  if (synced) me.agctx(['repos', 'sync', '--yes']);
  return { cwd: work, env: me.env, paths: [[work, docRoot]] };
}

test('concepts/agent-loading.md의 explain 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/concepts/agent-loading.md', FIXTURES);
});

test('guides/apm-coexistence.md의 중복 경고 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/guides/apm-coexistence.md', FIXTURES);
});

test('guides/monorepo.md의 확인 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/guides/monorepo.md', FIXTURES);
});

test('guides/multi-repo-individual.md의 repos status 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/guides/multi-repo-individual.md', FIXTURES);
});

test('guides/update-policies.md의 check·sync 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/guides/update-policies.md', FIXTURES);
});

test('guides/team-sharing.md의 link·clone 예시는 실제 출력과 같다', t => {
  runExamples(t, 'docs/guides/team-sharing.md', FIXTURES);
});

test('예시 비교는 …를 생략으로만 인정한다', () => {
  assert.ok(matches(['a', '…', 'd'], ['a', 'b', 'c', 'd']));
  assert.ok(matches(['a', '  …'], ['a']));
  assert.ok(matches(['warning  x …'], ['warning  x and more']));
  assert.ok(!matches(['a', 'b'], ['a', 'c']));
  assert.ok(!matches(['a'], ['a', 'extra']), '생략 표시 없이 남은 줄이 있으면 다르다');
  assert.ok(matches(['commit 1df750b.'], ['commit abcd3f0.']), '커밋 해시는 맞춰 비교한다');
  assert.ok(matches(['commit 1df750b.'], ['commit 8120752.']), '숫자로만 된 실제 해시도 해시로 본다');
  assert.ok(!matches(['ab35396→c61bea6'], ['c61bea6→c61bea6']), '화살표 양쪽이 다른 커밋인지는 비교한다');
  assert.ok(!matches(['word defaced'], ['word effaced']), '해시가 아닌 낱말은 그대로 비교한다');
  assert.ok(!matches(['warning  share 3 …'], ['warning  share 30 lines']), '줄 끝 … 앞은 낱말 경계까지 맞아야 한다');
  assert.ok(!matches(['a … b'], ['a x b']), '줄 중간의 …는 생략이 아니다');
});
