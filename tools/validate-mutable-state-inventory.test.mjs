import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-mutable-state-inventory.mjs');

test('mutable-state inventory validates', () => {
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /inventory=pass/);
});
