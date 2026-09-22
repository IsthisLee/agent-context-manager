import test from 'node:test';
import assert from 'node:assert/strict';
import { CliError } from '../src/shared/errors.ts';
import { parseMcpServers } from '../src/mcp/servers.ts';

/** 프로필의 `mcp.json`은 아는 필드만 받는다. 에이전트가 이해하지 못할 설정을 조용히 버리지 않는다. */

const parse = (value: unknown) => parseMcpServers(JSON.stringify(value), 'team-backend/mcp.json');

function rejects(value: unknown, pattern: RegExp) {
  assert.throws(
    () => (typeof value === 'string' ? parseMcpServers(value, 'team-backend/mcp.json') : parse(value)),
    (error: unknown) => error instanceof CliError && error.exitCode === 64 && pattern.test(error.message),
    String(pattern)
  );
}

test('stdio와 http 서버를 이름 순으로 정리해 읽는다', () => {
  const servers = parse({
    servers: {
      issues: { command: 'npx', args: ['-y', '@acme/issues-mcp'], env: { B: '2', A: '${ISSUES_TOKEN}' } },
      docs: { url: 'https://mcp.acme.dev/docs', headers: { Authorization: 'Bearer ${DOCS_TOKEN}' } },
      lint: { command: 'acme-lint-mcp' }
    }
  });
  assert.deepEqual(Object.keys(servers), ['docs', 'issues', 'lint']);
  assert.deepEqual(servers.issues, {
    command: 'npx',
    args: ['-y', '@acme/issues-mcp'],
    env: { A: '${ISSUES_TOKEN}', B: '2' }
  });
  assert.deepEqual(Object.keys((servers.issues as { env: object }).env), ['A', 'B']);
  assert.deepEqual(servers.lint, { command: 'acme-lint-mcp', args: [], env: {} });
  assert.deepEqual(servers.docs, {
    url: 'https://mcp.acme.dev/docs',
    headers: { Authorization: 'Bearer ${DOCS_TOKEN}' }
  });
  assert.deepEqual(parse({ servers: {} }), {});
});

test('형식이 틀리면 어디가 틀렸는지 말하며 멈춘다', () => {
  rejects('{ not json', /team-backend\/mcp\.json/);
  rejects({}, /"servers" must be an object/);
  rejects({ servers: [] }, /"servers" must be an object/);
  rejects({ servers: {}, version: 1 }, /unknown field "version"/);
  rejects({ servers: { 'bad name': { command: 'x' } } }, /server name "bad name"/);
  rejects({ servers: { both: { command: 'x', url: 'https://a' } } }, /exactly one of "command" or "url"/);
  rejects({ servers: { none: {} } }, /exactly one of "command" or "url"/);
  rejects({ servers: { a: { command: 'x', cwd: '/tmp' } } }, /unknown field "cwd"/);
  rejects({ servers: { a: { command: 'x', headers: {} } } }, /unknown field "headers"/);
  rejects({ servers: { a: { url: 'https://a', env: {} } } }, /unknown field "env"/);
  rejects({ servers: { a: { command: '' } } }, /"command" must be a non-empty string/);
  rejects({ servers: { a: { command: 'x', args: 'y' } } }, /"args" must be a list of strings/);
  rejects({ servers: { a: { command: 'x', env: { A: 1 } } } }, /"env" must map names to strings/);
  rejects({ servers: { a: { url: 'ftp://a' } } }, /http or https URL/);
});

test('TOML 서버 찾기는 따옴표 안의 =를 건너뛰고, 따옴표가 많이 반복된 줄도 선형 시간에 끝낸다', async () => {
  const { definedServers } = await import('../src/mcp/toml.ts');
  assert.deepEqual(definedServers('mcp_servers."x=y".command = "a=b"\n[mcp_servers]\nz = { c = 1 }\n', 'mcp_servers'), [
    'x=y',
    'z'
  ]);
  const started = Date.now();
  definedServers(`a${'""'.repeat(50_000)}!`, 'mcp_servers');
  assert.ok(Date.now() - started < 2000, '입력이 길어도 역추적으로 멈추지 않는다');
});
