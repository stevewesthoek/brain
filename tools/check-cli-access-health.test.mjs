import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCapabilityInventory } from './discover-capabilities.mjs';
import { buildHealthReport } from './check-cli-access-health.mjs';

test('health registry covers every discoverable CLI and classifies safe probes', async () => {
  const inventory = buildCapabilityInventory();
  const report = await buildHealthReport({
    inventory,
    runner: () => ({ status: 'pass', exitCode: 0, timedOut: false }),
  });

  assert.equal(report.summary.total, inventory.capabilities.filter((record) => record.kind === 'cli').length);
  assert.ok(report.results.some((result) => result.cli === 'stripe'));
  assert.ok(report.results.some((result) => result.cli === 'cli-access-health' && result.overall === 'ready'));
  assert.ok(report.results.some((result) => result.cli === 'stable-audio-warmup' && result.overall === 'not_tested'));
  assert.equal(report.results.filter((result) => result.installed).length, report.summary.installed);
});
