import test from 'node:test';
import assert from 'node:assert/strict';
import { add, multiply } from '../src/calc.mjs';

test('add works correctly', () => {
  assert.equal(add(2, 3), 5);
});

test('multiply works correctly', () => {
  assert.equal(multiply(4, 5), 20);
});
