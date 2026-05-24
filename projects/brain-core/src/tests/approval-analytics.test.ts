/**
 * Tests for approval-analytics.ts
 *
 * These tests exercise the analytics functions against the live VO approval
 * file store (which may be empty in CI). All functions must be safe to call
 * with no records present.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getApprovalStats, getFullAuditLog, parseDateParam } from '../adapters/approval-analytics.js';

// ── parseDateParam ──────────────────────────────────────────────────────────

test('parseDateParam returns a date 30 days ago for "30d"', () => {
  const now = Date.now();
  const result = parseDateParam('30d');
  const expected = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Allow 1 second tolerance
  assert.ok(
    Math.abs(result.getTime() - expected.getTime()) < 1000,
    'Should be approximately 30 days ago',
  );
});

test('parseDateParam returns a date 7 days ago for "7d"', () => {
  const now = Date.now();
  const result = parseDateParam('7d');
  const expected = new Date(now - 7 * 24 * 60 * 60 * 1000);

  assert.ok(
    Math.abs(result.getTime() - expected.getTime()) < 1000,
    'Should be approximately 7 days ago',
  );
});

test('parseDateParam parses an ISO date string', () => {
  const isoDate = '2026-01-01T00:00:00.000Z';
  const result = parseDateParam(isoDate);
  assert.equal(result.toISOString(), isoDate);
});

test('parseDateParam defaults to 30 days ago for invalid input', () => {
  const now = Date.now();
  const result = parseDateParam('not-a-date');
  const expected = new Date(now - 30 * 24 * 60 * 60 * 1000);
  assert.ok(
    Math.abs(result.getTime() - expected.getTime()) < 1000,
    'Should default to 30 days ago for invalid input',
  );
});

// ── getApprovalStats ────────────────────────────────────────────────────────

test('getApprovalStats returns ok:true with valid structure', () => {
  const result = getApprovalStats();

  assert.equal(result.ok, true);
  assert.ok(result.stats, 'stats should be present');
  assert.ok(typeof result.stats.totalRequested === 'number');
  assert.ok(typeof result.stats.totalApproved === 'number');
  assert.ok(typeof result.stats.totalRejected === 'number');
  assert.ok(typeof result.stats.approvalRate === 'number');
  assert.ok(typeof result.stats.avgDecisionTimeMinutes === 'number');
  assert.ok(typeof result.stats.avgWaitTimeMinutes === 'number');
  assert.ok(typeof result.stats.rejectionReasons === 'object');
  assert.ok(typeof result.stats.byType === 'object');
  assert.ok(typeof result.stats.byProject === 'object');
  assert.ok(typeof result.stats.byOperator === 'object');
});

test('getApprovalStats returns since and until timestamps', () => {
  const result = getApprovalStats();

  assert.ok(result.since, 'since should be present');
  assert.ok(result.until, 'until should be present');
  // Both should be parseable ISO dates
  assert.ok(!isNaN(new Date(result.since!).getTime()), 'since should be a valid date');
  assert.ok(!isNaN(new Date(result.until!).getTime()), 'until should be a valid date');
});

test('getApprovalStats approvalRate is between 0 and 1', () => {
  const result = getApprovalStats();

  assert.ok(result.ok);
  assert.ok(result.stats!.approvalRate >= 0, 'approvalRate >= 0');
  assert.ok(result.stats!.approvalRate <= 1, 'approvalRate <= 1');
});

test('getApprovalStats totalApproved + totalRejected <= totalRequested', () => {
  const result = getApprovalStats();

  assert.ok(result.ok);
  const stats = result.stats!;
  assert.ok(
    stats.totalApproved + stats.totalRejected <= stats.totalRequested,
    'approved + rejected should not exceed total (pending/expired exist)',
  );
});

test('getApprovalStats accepts a projectId filter', () => {
  const result = getApprovalStats('nonexistent-project-xyz');

  assert.equal(result.ok, true);
  assert.ok(result.stats);
  // With a nonexistent project, totals should be 0
  assert.equal(result.stats.totalRequested, 0);
});

test('getApprovalStats accepts custom since/until dates', () => {
  const since = new Date('2020-01-01');
  const until = new Date('2020-12-31');

  const result = getApprovalStats(undefined, since, until);

  assert.equal(result.ok, true);
  assert.ok(result.stats);
  assert.equal(result.since, since.toISOString());
  assert.equal(result.until, until.toISOString());
});

test('getApprovalStats byType values have required shape', () => {
  const result = getApprovalStats();

  assert.ok(result.ok);
  const byType = result.stats!.byType;
  for (const [, value] of Object.entries(byType)) {
    assert.ok(typeof value.requested === 'number', 'byType.requested should be a number');
    assert.ok(typeof value.approved === 'number', 'byType.approved should be a number');
    assert.ok(typeof value.rejected === 'number', 'byType.rejected should be a number');
  }
});

test('getApprovalStats byOperator values have required shape', () => {
  const result = getApprovalStats();

  assert.ok(result.ok);
  const byOperator = result.stats!.byOperator;
  for (const [, value] of Object.entries(byOperator)) {
    assert.ok(typeof value.decided === 'number', 'byOperator.decided should be a number');
    assert.ok(typeof value.approvalRate === 'number', 'byOperator.approvalRate should be a number');
    assert.ok(value.approvalRate >= 0 && value.approvalRate <= 1, 'byOperator.approvalRate in [0,1]');
  }
});

// ── getFullAuditLog ─────────────────────────────────────────────────────────

test('getFullAuditLog returns ok:true with entries array', () => {
  const result = getFullAuditLog();

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.entries), 'entries should be an array');
  assert.ok(typeof result.count === 'number', 'count should be a number');
});

test('getFullAuditLog count matches entries length', () => {
  const result = getFullAuditLog();

  assert.equal(result.ok, true);
  assert.equal(result.count, result.entries.length);
});

test('getFullAuditLog entry has required fields', () => {
  const result = getFullAuditLog();

  assert.equal(result.ok, true);
  for (const entry of result.entries) {
    assert.ok(typeof entry.id === 'string', 'entry.id should be string');
    assert.ok(typeof entry.approvalId === 'string', 'entry.approvalId should be string');
    assert.ok(typeof entry.action === 'string', 'entry.action should be string');
    assert.ok(typeof entry.actor === 'string', 'entry.actor should be string');
    assert.ok(typeof entry.timestamp === 'string', 'entry.timestamp should be string');
    assert.ok(typeof entry.details === 'object', 'entry.details should be object');
    // Timestamps must be valid ISO dates
    assert.ok(!isNaN(new Date(entry.timestamp).getTime()), 'entry.timestamp should be a valid date');
  }
});

test('getFullAuditLog action is a valid literal', () => {
  const result = getFullAuditLog();

  assert.equal(result.ok, true);
  const validActions = ['created', 'approved', 'rejected', 'escalated', 'expired'];
  for (const entry of result.entries) {
    assert.ok(validActions.includes(entry.action), `action "${entry.action}" should be a valid action`);
  }
});

test('getFullAuditLog accepts a projectId filter', () => {
  const result = getFullAuditLog('nonexistent-project-xyz');

  assert.equal(result.ok, true);
  assert.equal(result.entries.length, 0);
  assert.equal(result.count, 0);
});

test('getFullAuditLog entries are ordered newest first', () => {
  const result = getFullAuditLog();

  assert.equal(result.ok, true);
  const timestamps = result.entries.map((e) => e.timestamp);
  for (let i = 1; i < timestamps.length; i++) {
    assert.ok(
      timestamps[i - 1]! >= timestamps[i]!,
      `Entry ${i - 1} timestamp should be >= entry ${i} timestamp (newest first)`,
    );
  }
});
