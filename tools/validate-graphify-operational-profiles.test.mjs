import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-graphify-operational-profiles.mjs');

test('graphify operational profiles validate', () => {
  assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /catalog=pass/);
});

test('profile catalog operationalOutputRoots are runtime/local/graphify/... (not compatibility roots)', () => {
  const profilePath = path.join(root, 'operations/specs/graphify-operational-profiles.json');
  const catalog = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  for (const profile of catalog.profiles) {
    assert.ok(
      profile.operationalOutputRoot.startsWith('runtime/local/graphify/'),
      `profile ${profile.profileId} operationalOutputRoot must start with runtime/local/graphify/; got: ${profile.operationalOutputRoot}`
    );
    assert.ok(
      !profile.operationalOutputRoot.includes('.graphify-out') &&
      !profile.operationalOutputRoot.includes('graphify-out'),
      `profile ${profile.profileId} operationalOutputRoot must not be a compatibility root (.graphify-out/ or graphify-out/)`
    );
  }
});

test('profile catalog excludes compatibility roots from corpus', () => {
  const profilePath = path.join(root, 'operations/specs/graphify-operational-profiles.json');
  const catalog = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  for (const profile of catalog.profiles) {
    const excluded = profile.corpus?.excluded ?? [];
    assert.ok(
      excluded.includes('graphify-out'),
      `profile ${profile.profileId} must exclude graphify-out from corpus`
    );
    assert.ok(
      excluded.includes('.graphify-out'),
      `profile ${profile.profileId} must exclude .graphify-out from corpus`
    );
  }
});

test('governance JSON uses capability-based language — no obsolete B8 labels as current phase or next task', () => {
  const govPath = path.join(root, 'operations/specs/graphify-transition-governance.json');
  const gov = JSON.parse(fs.readFileSync(govPath, 'utf8'));
  const migration = gov.migrationPath ?? {};
  const obsoletePattern = /\bB8\.[0-9]+[A-Z][-\w]*\b/;
  assert.ok(
    !obsoletePattern.test(migration.currentPhase ?? ''),
    `migrationPath.currentPhase must not contain obsolete pre-canonical B8 label; got: "${migration.currentPhase}"`
  );
  assert.ok(
    !obsoletePattern.test(migration.nextTask ?? ''),
    `migrationPath.nextTask must not contain obsolete pre-canonical B8 label; got: "${migration.nextTask}"`
  );
});

test('governance JSON retention gate uses capability-based conditions (not task-ID-dependent)', () => {
  const govPath = path.join(root, 'operations/specs/graphify-transition-governance.json');
  const gov = JSON.parse(fs.readFileSync(govPath, 'utf8'));
  const conditions = gov.states?.deletion?.retentionGateConditions ?? [];
  assert.ok(conditions.length >= 3, 'at least three retention gate conditions required');
  // None of the conditions may name a specific canonical B8 task label (B8.1–B8.6) as the sole qualifier.
  // Capability descriptions are allowed; bare labels like "B8.5 verified" are not.
  const taskLabelOnly = /^B8\.[1-6]\b/;
  for (const condition of conditions) {
    assert.ok(
      !taskLabelOnly.test(condition.trim()),
      `retention gate condition starts with a bare canonical B8 label — use capability-based language: "${condition}"`
    );
  }
});
