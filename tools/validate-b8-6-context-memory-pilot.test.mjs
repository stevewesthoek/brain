import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { validatePilotContract } from './validate-b8-6-context-memory-pilot.mjs';

const ROOT = path.resolve('.');
const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-6-context-memory-pilot.json'), 'utf8'));
const benchmarkManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json'), 'utf8'));
const freshnessContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-3-context-memory-freshness.json'), 'utf8'));

function validate(candidate) {
  return validatePilotContract({ pilot: candidate, benchmarkManifest, freshnessContract });
}

test('canonical B8.6 pilot contract is valid', () => {
  assert.deepEqual(validate(pilot), []);
});

test('pilot cannot broaden beyond Brain plus ProChat', () => {
  const candidate = structuredClone(pilot);
  candidate.pilotRepositories.push({ repositoryId: 'workbench', role: 'application', retrievalProbes: [{}, {}] });
  const errors = validate(candidate);
  assert.ok(errors.includes('exactly-two-pilot-repositories'));
  assert.ok(errors.includes('forbidden-pilot-repository'));
});

test('pilot cannot weaken inherited cold or refresh limits', () => {
  const candidate = structuredClone(pilot);
  candidate.acceptance.maximumColdIndexPeakRssMiB += 1;
  candidate.acceptance.maximumRefreshWallMs += 1;
  const errors = validate(candidate);
  assert.ok(errors.includes('inherited-limit:maximumColdIndexPeakRssMiB'));
  assert.ok(errors.includes('inherited-limit:maximumRefreshWallMs'));
});

test('pilot requires perfect bounded probe/fallback hit rates', () => {
  const candidate = structuredClone(pilot);
  candidate.acceptance.minimumStructuralProbeHitRate = 0.8;
  candidate.acceptance.minimumExactSourceFallbackHitRate = 0.9;
  const errors = validate(candidate);
  assert.ok(errors.includes('structural-hit-rate'));
  assert.ok(errors.includes('fallback-hit-rate'));
});

test('pilot navigation token cap cannot exceed 1000 estimated tokens per probe', () => {
  const candidate = structuredClone(pilot);
  candidate.acceptance.maximumCbmNavigationEstimatedTokensPerProbe = 1001;
  assert.ok(validate(candidate).includes('navigation-token-cap'));
});

test('pilot cannot authorize blanket global rollout', () => {
  const candidate = structuredClone(pilot);
  candidate.rolloutDecision.globalAutomaticRollout = true;
  candidate.rolloutDecision.perRepositoryAdmissionRequired = false;
  assert.ok(validate(candidate).includes('rollout-boundary'));
});

test('pilot preserves source/Mind/Workbench/no-model/no-push boundaries', () => {
  const candidate = structuredClone(pilot);
  candidate.safety.noMindMutation = false;
  assert.ok(validate(candidate).includes('safety-boundary'));
});
