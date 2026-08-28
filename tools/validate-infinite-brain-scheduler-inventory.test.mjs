import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-infinite-brain-scheduler-inventory.mjs');
const inventory = path.join(root, 'operations/specs/infinite-brain-scheduler-inventory.json');
test('scheduler inventory validates its repository source markers and report-only Mind modes', () => {
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /jobs=18/);
});
test('scheduler inventory rejects inferred activation and missing receipts', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scheduler-inventory-'));
  try {
    const source = JSON.parse(fs.readFileSync(inventory, 'utf8'));
    source.jobs[0].externalActivation = 'deployed';
    source.jobs[1].receipt = '';
    fs.writeFileSync(path.join(temp, 'bad.json'), JSON.stringify(source));
    const text = fs.readFileSync(validator, 'utf8').replace(inventory, path.join(temp, 'bad.json'));
    const badValidator = path.join(temp, 'validator.mjs');
    fs.writeFileSync(badValidator, text);
    assert.throws(() => execFileSync('node', [badValidator], { encoding: 'utf8', stdio: 'pipe' }));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
