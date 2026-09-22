import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COMMANDS } from '../src/commands/registry.ts';
import { gitIn, makeWorkspace, publishProfile, repoRoot } from './support/git-workspace.ts';

/**
 * `docs/reference/json-data.md`의 표가 명령마다 실제 `--json` 결과의 `data`와 같은지 본다. 스크립트와
 * 에이전트는 이 문서를 보고 결과를 읽으므로, 필드가 늘거나 빠지면 문서도 같은 변경에서 고쳐야 한다.
 */

const DOC = path.join(repoRoot, 'docs', 'reference', 'json-data.md');

/** 명령 이름마다 문서가 적은 필드. 절 제목에 명령이 여럿이면 같은 표를 나눠 쓴다. */
function documentedFields(): Map<string, string[] | null> {
  const fields = new Map<string, string[] | null>();
  const sections = fs.readFileSync(DOC, 'utf8').split(/^### /m).slice(1);
  for (const section of sections) {
    const [heading, ...body] = section.split('\n');
    const names = [...heading.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const rows = body.flatMap(line => {
      const match = line.match(/^\| `([^`]+)` \|/);
      return match ? [match[1]] : [];
    });
    for (const name of names) fields.set(name, rows.length ? rows : null);
  }
  return fields;
}

function topLevel(fields: readonly string[]): string[] {
  return fields.filter(field => !/[.[]/.test(field)).sort();
}

/** `prefix[].name`이나 `prefix.name` 꼴의 필드에서 `prefix` 아래 이름들. */
function nested(fields: readonly string[], prefix: string): string[] {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}(?:\\[\\])?\\.([^.[]+)$`);
  return fields.flatMap(field => field.match(pattern)?.[1] ?? []).sort();
}

/** 뜻에 "~때만 있다"라고 적은 필드. 없어도 된다. */
function optionalFields(): Set<string> {
  const optional = new Set<string>();
  for (const line of fs.readFileSync(DOC, 'utf8').split('\n')) {
    const match = line.match(/^\| `([^`]+)` \|[^|]*\|(.*)\|$/);
    if (match && /때만 있다/.test(match[2])) optional.add(match[1]);
  }
  return optional;
}

function checkShape(name: string, data: unknown, fields: string[] | null): void {
  if (fields === null) {
    assert.equal(data, null, `${name}: 문서는 data가 null이라고 적었다`);
    return;
  }
  assert.ok(data && typeof data === 'object', `${name}: data가 객체다`);
  const record = data as Record<string, unknown>;
  assert.deepEqual(Object.keys(record).sort(), topLevel(fields), `${name}: 최상위 필드가 문서와 같다`);
  const optional = optionalFields();
  for (const key of topLevel(fields)) {
    const inner = nested(fields, key);
    if (!inner.length) continue;
    const value = record[key];
    const samples = (Array.isArray(value) ? value : [value]).filter(item => item && typeof item === 'object');
    for (const sample of samples) {
      const actual = Object.keys(sample as object).sort();
      const required = inner.filter(field => !optional.has(`${key}[].${field}`) && !optional.has(`${key}.${field}`));
      for (const field of required) assert.ok(actual.includes(field), `${name}: ${key}의 ${field}가 실제 결과에 있다`);
      for (const field of actual) assert.ok(inner.includes(field), `${name}: ${key}의 ${field}가 문서에 있다`);
    }
  }
}

/** 확인한 목록마다 한 항목 이상 들어 있었는지. 빈 목록은 필드를 확인하지 못하기 때문이다. */
const filled = new Set<string>();
function noteFilled(name: string, data: unknown): void {
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data))
    if (Array.isArray(value) && value.length) filled.add(`${name} ${key}`);
}

test('모든 명령은 json-data.md에 data 형식을 적는다', () => {
  const documented = documentedFields();
  for (const command of COMMANDS) {
    const name = command.words.join(' ');
    assert.ok(documented.has(name), `${name}의 data 형식이 json-data.md에 있다`);
  }
});

test('json-data.md의 필드는 명령마다 실제 --json 결과와 같다', t => {
  const documented = documentedFields();
  const { root, person, folder } = makeWorkspace(t, 'agctx-json-data-');
  const admin = person('admin');
  const dev = person('dev');
  const userHome = folder('user-home');
  fs.mkdirSync(path.join(userHome, '.claude'));
  const homeEnv = {
    HOME: userHome,
    USERPROFILE: userHome,
    CODEX_HOME: path.join(userHome, '.codex'),
    CLAUDE_CONFIG_DIR: path.join(userHome, '.claude')
  };
  const seen = new Set<string>();
  const run = (who: typeof admin, args: string[]) => {
    const result = who.run([...args, '--json'], homeEnv);
    const envelope = JSON.parse(result.stdout);
    const name = COMMANDS.find(command => args.join(' ').startsWith(command.words.join(' ')))?.words.join(' ');
    assert.ok(name, `등록된 명령이다: ${args.join(' ')}`);
    assert.deepEqual(envelope.errors, [], `${args.join(' ')} 성공\n${result.stderr}`);
    checkShape(name, envelope.data, documented.get(name) ?? null);
    noteFilled(name, envelope.data);
    seen.add(name);
    return envelope.data;
  };

  run(admin, ['profile', 'create', 'solo', '--scope', 'personal']);
  run(admin, ['profile', 'setup', 'solo', '--tdd', 'on']);
  run(admin, ['profile', 'view', 'solo']);
  run(admin, ['profile', 'list']);
  const { dir, remote } = publishProfile(root, admin, 'team-backend');
  fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\n- Keep migrations reversible.\n');
  gitIn(dir, 'commit', '--quiet', '-am', 'Add a rule');
  run(admin, ['profile', 'push', 'team-backend', '--dry-run']);
  run(admin, ['profile', 'push', 'team-backend', '--yes']);
  run(admin, ['profile', 'status', 'team-backend']);
  run(dev, ['profile', 'clone', remote]);
  run(dev, ['profile', 'pull', 'team-backend']);
  run(admin, ['profile', 'create', 'other', '--scope', 'team']);
  const otherRemote = path.join(root, 'remotes', 'other.git');
  gitIn(root, 'init', '--bare', '--quiet', '--initial-branch=main', otherRemote);
  gitIn(admin.profileDir('other'), 'init', '--quiet', '--initial-branch=main');
  gitIn(admin.profileDir('other'), 'add', '-A');
  gitIn(admin.profileDir('other'), 'commit', '--quiet', '-m', 'Add other');
  run(admin, ['profile', 'connect', 'other', otherRemote]);
  const rules = folder('rules-repo');
  fs.writeFileSync(path.join(rules, 'AGENTS.md'), '# Rules\n');
  gitIn(rules, 'init', '--quiet', '--initial-branch=main');
  run(admin, ['profile', 'link', rules, '--yes']);

  const project = folder('payments-api');
  gitIn(project, 'init', '--quiet', '--initial-branch=main');
  run(admin, ['profile', 'apply', 'team-backend', project, '--yes']);
  run(admin, ['profile', 'sync', project, '--yes']);
  run(admin, ['profile', 'resolve', project, '--yes']);
  // 관리 영역 안에 줄을 더해 resolve가 옮길 파일 목록을 채운다.
  const agentsFile = path.join(project, 'AGENTS.md');
  fs.writeFileSync(
    agentsFile,
    fs
      .readFileSync(agentsFile, 'utf8')
      .replace('## Project context', '- Added inside the managed area.\n\n## Project context')
  );
  run(admin, ['profile', 'resolve', project, '--yes']);
  run(admin, ['check', project]);
  // 프로필을 고쳐 check의 findings를 채운다.
  fs.appendFileSync(path.join(admin.profileDir('team-backend'), 'AGENTS.md'), '\n- Another rule.\n');
  run(admin, ['check', project]);
  fs.mkdirSync(path.join(project, 'services', 'payments'), { recursive: true });
  fs.writeFileSync(path.join(project, 'services', 'payments', 'AGENTS.md'), '# Payments\n');
  run(admin, ['explain', path.join(project, 'services', 'payments')]);
  run(admin, ['verify', project]);
  run(admin, ['repos', 'list']);
  run(admin, ['repos', 'status']);
  run(admin, ['repos', 'sync', '--yes']);
  const targets = path.join(root, 'targets.txt');
  fs.writeFileSync(targets, `${project}\n`);
  const pr = JSON.parse(admin.run(['repos', 'pr', '--targets', targets, '--dry-run', '--json'], homeEnv).stdout);
  checkShape('repos pr', pr.data, documented.get('repos pr') ?? null);
  seen.add('repos pr');
  run(admin, ['install', '--dry-run']);
  run(admin, ['uninstall', '--dry-run']);
  run(admin, ['config', 'lang', 'en']);
  run(admin, ['help']);
  run(admin, ['profile', 'remove', 'solo', '--yes']);
  // 연결한 폴더를 지워 끊긴 링크를 만든다.
  fs.rmSync(rules, { recursive: true, force: true });
  run(admin, ['profile', 'list']);

  for (const list of [
    'profile resolve files',
    'check findings',
    'explain agents',
    'profile list brokenLinks',
    'profile list profiles',
    'repos sync repos',
    'install items',
    'install skipped'
  ])
    assert.ok(filled.has(list), `${list}에 항목이 있는 결과를 확인했다`);

  const missing = COMMANDS.map(command => command.words.join(' ')).filter(name => !seen.has(name));
  assert.deepEqual(missing, [], '모든 명령의 결과를 확인했다');
});
