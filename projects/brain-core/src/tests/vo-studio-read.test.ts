import test from 'node:test';
import assert from 'node:assert/strict';
import { readApprovalQueue, readWorkflowState, readExecutionSummary, readJobHistory, readPerformanceMetrics, readApprovalStatistics, readErrorAnalysis, readPublishingQueue, readDistributionSummary, readPublishingMetrics } from '../adapters/vo-studio-read.js';

test('readApprovalQueue accepts valid projectId', () => {
  const result = readApprovalQueue('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.items, []);
});

test('readApprovalQueue rejects missing projectId', () => {
  const result = readApprovalQueue('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.equal(result.count, 0);
  assert.deepEqual(result.items, []);
});

test('readWorkflowState accepts valid packageId', () => {
  const result = readWorkflowState('pkg-123');

  assert.equal(result.ok, true);
  assert.ok(result.state);
  assert.equal(result.state!.packageId, 'pkg-123');
  assert.equal(result.state!.currentStage, 'thumbnail');
  assert.deepEqual(result.state!.approvals, []);
  assert.deepEqual(result.state!.pendingApprovals, []);
});

test('readWorkflowState rejects missing packageId', () => {
  const result = readWorkflowState('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
  assert.equal(result.state, undefined);
});

test('readExecutionSummary accepts valid packageId', () => {
  const result = readExecutionSummary('pkg-123');

  assert.equal(result.ok, true);
  assert.ok(result.summary);
  assert.equal(result.summary!.packageId, 'pkg-123');
  assert.equal(result.summary!.progressPercent, 0);
  assert.deepEqual(result.summary!.completedStages, []);
  assert.deepEqual(result.summary!.failedStages, []);
});

test('readExecutionSummary rejects missing packageId', () => {
  const result = readExecutionSummary('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
  assert.equal(result.summary, undefined);
});

test('readJobHistory accepts valid projectId with default limit', () => {
  const result = readJobHistory('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.items, []);
});

test('readJobHistory accepts custom limit within range', () => {
  const result = readJobHistory('project-123', 100);

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});

test('readJobHistory rejects missing projectId', () => {
  const result = readJobHistory('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readJobHistory rejects limit below 1', () => {
  const result = readJobHistory('project-123', 0);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 1000/);
});

test('readJobHistory rejects limit above 1000', () => {
  const result = readJobHistory('project-123', 1001);

  assert.equal(result.ok, false);
  assert.match(result.error!, /limit must be between 1 and 1000/);
});

test('readPerformanceMetrics accepts valid projectId', () => {
  const result = readPerformanceMetrics('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.projectId, 'project-123');
  assert.deepEqual(result.metrics, []);
});

test('readPerformanceMetrics rejects missing projectId', () => {
  const result = readPerformanceMetrics('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readApprovalStatistics accepts valid projectId', () => {
  const result = readApprovalStatistics('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.projectId, 'project-123');
  assert.deepEqual(result.statistics, []);
});

test('readApprovalStatistics rejects missing projectId', () => {
  const result = readApprovalStatistics('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readErrorAnalysis accepts valid projectId', () => {
  const result = readErrorAnalysis('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.projectId, 'project-123');
  assert.deepEqual(result.errors, []);
});

test('readErrorAnalysis rejects missing projectId', () => {
  const result = readErrorAnalysis('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readPublishingQueue accepts valid projectId', () => {
  const result = readPublishingQueue('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.deepEqual(result.jobs, []);
});

test('readPublishingQueue accepts optional status filter', () => {
  const result = readPublishingQueue('project-123', 'scheduled');

  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
});

test('readPublishingQueue rejects missing projectId', () => {
  const result = readPublishingQueue('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('readDistributionSummary accepts valid packageId', () => {
  const result = readDistributionSummary('pkg-123');

  assert.equal(result.ok, true);
  assert.ok(result.summary);
  assert.equal(result.summary!.packageId, 'pkg-123');
  assert.equal(result.summary!.totalPlatforms, 0);
  assert.deepEqual(result.summary!.platforms, []);
});

test('readDistributionSummary rejects missing packageId', () => {
  const result = readDistributionSummary('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('readPublishingMetrics accepts valid projectId', () => {
  const result = readPublishingMetrics('project-123');

  assert.equal(result.ok, true);
  assert.equal(result.projectId, 'project-123');
  assert.ok(result.metrics);
  assert.equal(result.metrics!.totalPublished, 0);
  assert.equal(result.metrics!.failureRate, 0);
});

test('readPublishingMetrics rejects missing projectId', () => {
  const result = readPublishingMetrics('');

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});
