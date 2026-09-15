import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_OPERATION_CONTRACT } from '../src/commands/contracts.ts';

test('every Guidance Profile capability has CLI, TUI, and profile-list interface contracts', () => {
  assert.ok(PROFILE_OPERATION_CONTRACT.length > 0);
  for (const operation of PROFILE_OPERATION_CONTRACT) {
    assert.ok(operation.id, 'operation must have an id');
    assert.ok(operation.cli, `${operation.id} must define a CLI entry`);
    assert.ok(operation.tui, `${operation.id} must define a TUI entry`);
    assert.equal(operation.profileList, true, `${operation.id} must be available from profile list`);
  }
});

test('the profile contract covers the complete user-facing capability set', () => {
  assert.deepEqual(
    PROFILE_OPERATION_CONTRACT.map(operation => operation.id),
    ['create', 'list', 'view', 'setup', 'apply', 'sync', 'resolve', 'remove']
  );
});
