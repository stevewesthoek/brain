import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-performance-budgets.mjs');

test('performance budgets validate', () => {
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /budgets=pass/);
});
