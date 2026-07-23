import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CANDIDATE = path.join(ROOT, 'operations/automations/n8n/workflows/mind-inbox-fixed.json');
const MANIFEST = path.join(ROOT, 'operations/automations/n8n/save-to-mind-topology-migration.json');
const PLAN = path.join(ROOT, 'tools/n8n-save-to-mind-plan.mjs');
const TOPOLOGY_PLAN = path.join(ROOT, 'tools/n8n-save-to-mind-topology-plan.mjs');

test('candidate metadata is paused and cannot establish deployed or verified state', () => {
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  assert.equal(candidate.id, 'FwP5INe9qoo1OwGC');
  assert.equal(candidate.active, false);
  assert.deepEqual(manifest.candidateState, {
    repositoryCandidate: true,
    deploymentPlanned: 'conditional',
    deployed: 'unverified',
    observedCanonicalSuccessRouting: 'stored-rollback-partial-evidence',
    observedCanonicalFailureRouting: 'unverified',
    activation: 'not_asserted',
    schedule: 'not_asserted',
    liveVersion: 'not_asserted',
    verified: false,
    paused: true,
    retired: false,
    b1_0a: 'incomplete',
  });
});

test('candidate planners are static-only and emit no live n8n command', () => {
  for (const file of [PLAN, TOPOLOGY_PLAN]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /n8n-api\.sh|update-workflow|get-workflow|\bfetch\b|\bcurl\b|\bspawn\b|\bexec\b/);
  }

  const result = spawnSync(process.execPath, [PLAN, 'status-plan'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {},
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /deployed=unverified/);
  assert.match(result.stdout, /live_commands_emitted=false/);
  assert.doesNotMatch(result.stdout, /update-workflow|get-workflow|activation.*command|schedule.*command/i);
});
