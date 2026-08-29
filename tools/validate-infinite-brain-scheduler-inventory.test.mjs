import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('legacy scheduler inventory validator delegates to the canonical typed registry', () => {
  const validator = path.join(root, 'tools/validate-infinite-brain-scheduler-inventory.mjs');
  assert.match(execFileSync(process.execPath, [validator], { encoding: 'utf8' }), /compatibility=typed-registry jobs=17/);
});
