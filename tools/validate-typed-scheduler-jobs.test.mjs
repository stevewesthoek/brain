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

test('Google Ads remains disabled and is human-classified as blocked pending hardening', () => {
  const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const googleAds = source.jobs.find((job) => job.id === 'google-ads-sync');
  assert.equal(googleAds.reviewCategory, 'BLOCKED');
  assert.equal(googleAds.lifecycle, 'disabled');
  assert.equal(googleAds.mode, 'disabled');
  assert.match(googleAds.policyReason, /replacement\/hardening/);

  const counts = source.jobs.reduce((result, job) => {
    result[job.reviewCategory] = (result[job.reviewCategory] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual({
    ACTIVE: counts.ACTIVE ?? 0,
    BLOCKED: counts.BLOCKED ?? 0,
    'NEEDS REVIEW': counts['NEEDS REVIEW'] ?? 0,
    OBSOLETE: counts.OBSOLETE ?? 0,
  }, { ACTIVE: 4, BLOCKED: 10, 'NEEDS REVIEW': 0, OBSOLETE: 3 });
});

test('skill prune is obsolete, disabled, and an explicit deletion candidate', () => {
  const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const skillPrune = source.jobs.find((job) => job.id === 'skill-prune');
  assert.equal(skillPrune.reviewCategory, 'OBSOLETE');
  assert.equal(skillPrune.lifecycle, 'disabled');
  assert.equal(skillPrune.mode, 'disabled');
  assert.equal(skillPrune.scheduleType, 'disabled');
  assert.equal(skillPrune.schedule, 'not scheduled');
  assert.equal(skillPrune.destructive, true);
  assert.match(skillPrune.policyReason, /automated pruning responsibility is retired/);
  assert.match(skillPrune.humanAction, /DELETE CANDIDATE/);
  assert.ok(skillPrune.tags.includes('obsolete'));
  assert.ok(skillPrune.tags.includes('delete-candidate'));
});

test('memory context refresh is retained for manual use but blocked from automation', () => {
  const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const memoryRefresh = source.jobs.find((job) => job.id === 'memory-context-refresh');
  assert.equal(memoryRefresh.reviewCategory, 'BLOCKED');
  assert.equal(memoryRefresh.lifecycle, 'disabled');
  assert.equal(memoryRefresh.mode, 'disabled');
  assert.equal(memoryRefresh.scheduleType, 'disabled');
  assert.equal(memoryRefresh.schedule, 'not scheduled');
  assert.deepEqual(memoryRefresh.outputArtifacts, ['~/.brain/memory-context.md']);
  assert.ok(memoryRefresh.tags.includes('local-derived'));
  assert.ok(memoryRefresh.tags.includes('local-write'));
  assert.match(memoryRefresh.policyReason, /manual \/ on-demand only/);
  assert.match(memoryRefresh.policyReason, /automatic scheduling/);
  assert.match(memoryRefresh.humanAction, /Manual \/ on-demand only/);
  assert.match(memoryRefresh.humanAction, /must not run automatically/);
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
