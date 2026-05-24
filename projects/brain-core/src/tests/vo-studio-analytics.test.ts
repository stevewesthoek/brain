import test from 'node:test';
import assert from 'node:assert/strict';
import { readWebhookDeliveryRates, readEventLatencyMetrics, readRoutingStatistics, readPipelineHealth } from '../adapters/vo-studio-read.js';

test('readWebhookDeliveryRates accepts valid projectId', () => {
  const result = readWebhookDeliveryRates('project-123');

  assert.equal(result.ok, true);
  assert.ok(result.metrics);
  assert.equal(result.metrics.successCount, 0);
  assert.equal(result.metrics.failureCount, 0);
  assert.equal(result.metrics.pendingCount, 0);
  assert.equal(result.metrics.successRate, 0);
  assert.ok(typeof result.metrics.byPlatform === 'object');
  assert.equal(result.projectId, 'project-123');
});

test('readWebhookDeliveryRates rejects missing projectId', () => {
  const result = readWebhookDeliveryRates('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readWebhookDeliveryRates metrics has all required fields', () => {
  const result = readWebhookDeliveryRates('project-123');

  assert.equal(result.ok, true);
  assert.ok('successCount' in result.metrics!);
  assert.ok('failureCount' in result.metrics!);
  assert.ok('pendingCount' in result.metrics!);
  assert.ok('successRate' in result.metrics!);
  assert.ok('byPlatform' in result.metrics!);
});

test('readEventLatencyMetrics accepts valid projectId', () => {
  const result = readEventLatencyMetrics('project-123');

  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, []);
  assert.equal(result.projectId, 'project-123');
});

test('readEventLatencyMetrics rejects missing projectId', () => {
  const result = readEventLatencyMetrics('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.deepEqual(result.entries, []);
});

test('readEventLatencyMetrics entries is an array', () => {
  const result = readEventLatencyMetrics('project-123');

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.entries));
});

test('readRoutingStatistics accepts valid projectId', () => {
  const result = readRoutingStatistics('project-123');

  assert.equal(result.ok, true);
  assert.deepEqual(result.stats, []);
  assert.equal(result.projectId, 'project-123');
});

test('readRoutingStatistics rejects missing projectId', () => {
  const result = readRoutingStatistics('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.deepEqual(result.stats, []);
});

test('readRoutingStatistics stats is an array', () => {
  const result = readRoutingStatistics('project-123');

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.stats));
});

test('readPipelineHealth accepts valid projectId', () => {
  const result = readPipelineHealth('project-123');

  assert.equal(result.ok, true);
  assert.ok(result.health);
  assert.equal(result.health.score, 100);
  assert.equal(result.health.status, 'healthy');
  assert.equal(result.projectId, 'project-123');
});

test('readPipelineHealth rejects missing projectId', () => {
  const result = readPipelineHealth('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readPipelineHealth health has components object', () => {
  const result = readPipelineHealth('project-123');

  assert.equal(result.ok, true);
  assert.ok('components' in result.health!);
  assert.ok(typeof result.health!.components === 'object');
});

test('readPipelineHealth status is valid literal', () => {
  const result = readPipelineHealth('project-123');

  assert.equal(result.ok, true);
  const validStatuses = ['healthy', 'degraded', 'critical'];
  assert.ok(validStatuses.includes(result.health!.status));
});

test('all analytics functions echo projectId when valid', () => {
  const projectId = 'test-project-xyz';

  const r1 = readWebhookDeliveryRates(projectId);
  const r2 = readEventLatencyMetrics(projectId);
  const r3 = readRoutingStatistics(projectId);
  const r4 = readPipelineHealth(projectId);

  assert.equal(r1.projectId, projectId);
  assert.equal(r2.projectId, projectId);
  assert.equal(r3.projectId, projectId);
  assert.equal(r4.projectId, projectId);
});

test('all analytics functions return ok:true with non-null metrics', () => {
  const projectId = 'project-123';

  const r1 = readWebhookDeliveryRates(projectId);
  const r2 = readEventLatencyMetrics(projectId);
  const r3 = readRoutingStatistics(projectId);
  const r4 = readPipelineHealth(projectId);

  assert.equal(r1.ok, true);
  assert.ok(r1.metrics);
  assert.equal(r2.ok, true);
  assert.ok(Array.isArray(r2.entries));
  assert.equal(r3.ok, true);
  assert.ok(Array.isArray(r3.stats));
  assert.equal(r4.ok, true);
  assert.ok(r4.health);
});
