import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateMindStewardIngestion } from './validate-mind-steward-ingestion.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-ingestion-validation-'));
  const mindRoot = path.join(root, 'mind');
  const repoRoot = path.join(root, 'brain');
  fs.mkdirSync(path.join(mindRoot, 'inbox', 'new'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'runtime', 'local', 'mind-steward'), { recursive: true });
  return { root, mindRoot, repoRoot, inbox: path.join(mindRoot, 'inbox', 'new') };
}

test('validation is deterministic for the same inbox and as-of timestamp', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.inbox, 'a.md'), '# A\n');
  const first = validateMindStewardIngestion({ ...f, asOf: '2026-08-23T12:00:00Z' });
  const second = validateMindStewardIngestion({ ...f, asOf: '2026-08-23T12:00:00Z' });
  assert.deepEqual(second, first);
  assert.equal(first.counts.successful_ingestions, 1);
  assert.equal(first.invariants.writes_to_mind, true);
  assert.equal(first.invariants.automatic_promotion, true);
});

test('validation reports unsupported formats and duplicate source revisions', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.inbox, 'a.md'), '# Same\n');
  fs.copyFileSync(path.join(f.inbox, 'a.md'), path.join(f.inbox, 'b.txt'));
  fs.writeFileSync(path.join(f.inbox, 'document.pdf'), '%PDF-fixture');
  const report = validateMindStewardIngestion({ ...f, asOf: '2026-08-23T12:00:00Z' });
  assert.equal(report.counts.successful_ingestions, 2);
  assert.equal(report.counts.unsupported_formats, 1);
  assert.equal(report.counts.duplicate_groups, 1);
  assert.ok(report.friction.includes('unsupported_or_unreadable_inputs_require_manual_review'));
  assert.ok(report.friction.includes('duplicate_inputs_require_human_disposition'));
});

test('missing inbox fails rather than inventing an alternate source', () => {
  const f = fixture();
  fs.rmSync(path.join(f.mindRoot, 'inbox', 'new'), { recursive: true });
  assert.throws(() => validateMindStewardIngestion({ ...f, asOf: '2026-08-23T12:00:00Z' }), /inbox_not_found/);
});
