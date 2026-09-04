import test from 'node:test';
import assert from 'node:assert/strict';
import { OptionalEndpointNegativeCache } from './optional-endpoint-cache';

test('negative cache suppresses repeated optional endpoint probes until expiry', () => {
  const cache = new OptionalEndpointNegativeCache(100);
  cache.mark('/optional/report', 1_000);
  assert.equal(cache.has('/optional/report', 1_099), true);
  assert.equal(cache.has('/optional/report', 1_100), false);
  assert.equal(cache.has('/optional/report', 1_101), false);
});

test('negative cache can invalidate one endpoint after a report is generated', () => {
  const cache = new OptionalEndpointNegativeCache(10_000);
  cache.mark('/optional/report', 1_000);
  cache.mark('/optional/other', 1_000);
  cache.clear('/optional/report');
  assert.equal(cache.has('/optional/report', 1_001), false);
  assert.equal(cache.has('/optional/other', 1_001), true);
});
