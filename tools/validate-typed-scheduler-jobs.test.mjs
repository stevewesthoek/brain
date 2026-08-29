import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const validator = path.join(root, 'tools/validate-typed-scheduler-jobs.mjs');
const manifest = path.join(root, 'operations/specs/typed-scheduler-jobs.json');

test('typed registry is the sole 17-job inventory and reports lifecycle counts', () => {
  const output = execFileSync(node, [validator], { encoding: 'utf8' });
  assert.match(output, /jobs=17/);
  assert.match(output, /"active":4/);
  assert.match(output, /"policy-blocked":4/);
});

test('unsafe active changes fail closed through the schema and invariants', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-scheduler-'));
  try {
    const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const job = source.jobs.find((item) => item.id === 'local-apps-report');
    job.destructive = true;
    const bad = path.join(temp, 'jobs.json');
    fs.writeFileSync(bad, JSON.stringify(source));
    assert.throws(() => execFileSync(node, [validator, '--manifest', bad], { encoding: 'utf8', stdio: 'pipe' }));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('unknown dependency fails closed', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-scheduler-'));
  try {
    const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    source.jobs[0].dependencies = ['does-not-exist'];
    const bad = path.join(temp, 'jobs.json');
    fs.writeFileSync(bad, JSON.stringify(source));
    assert.throws(() => execFileSync(node, [validator, '--manifest', bad], { encoding: 'utf8', stdio: 'pipe' }));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
