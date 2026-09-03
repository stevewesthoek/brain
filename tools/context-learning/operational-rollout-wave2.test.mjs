import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runOperationalRolloutWave2 } from './run-operational-rollout-wave2.mjs';

test('Wave 2 records explicit capability-derived states without new semantic activation', async () => {
  const result = await runOperationalRolloutWave2();
  assert.equal(result.decision, 'UNIVERSAL_ROLLOUT_COMPLETE');
  assert.deepEqual(result.missingVisual, ['browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction']);
  assert.equal(result.checks.universal, true);
  assert.equal(result.checks.orchestrator, true);
  assert.equal(result.checks.contract, true);
  assert.equal(result.rolloutMatrix.find((row) => row[0] === 'Claude Code')[3], 'BLOCKED_CAPABILITY');
  assert.equal(result.checks.noOtherActivation, true);
});

test('Wave 2 report is the requested operational deliverable when generated', () => {
  const report = path.resolve('operations/reports/infinite-brain-operational-rollout-wave2-universal-consumers-2026-09-03.md');
  assert.equal(fs.existsSync(report), true);
});
