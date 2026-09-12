import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_OPERATION_CONTRACT } from '../bin/contracts.mjs';

test('every Core capability has CLI, TUI, and Core-list interface contracts', () => {
  assert.ok(CORE_OPERATION_CONTRACT.length > 0);
  for (const operation of CORE_OPERATION_CONTRACT) {
    assert.ok(operation.id, 'operation must have an id');
    assert.ok(operation.cli, `${operation.id} must define a CLI entry`);
    assert.ok(operation.tui, `${operation.id} must define a TUI entry`);
    assert.equal(operation.coreList, true, `${operation.id} must be available from core list`);
  }
});

test('the Core contract covers the complete user-facing capability set', () => {
  assert.deepEqual(
    CORE_OPERATION_CONTRACT.map(operation => operation.id),
    ['create', 'list', 'view', 'setup', 'apply', 'sync', 'remove']
  );
});
