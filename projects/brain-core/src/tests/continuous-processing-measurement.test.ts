import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { getContinuousProcessingMeasurementView, sampleProcessMemory } from '../adapters/continuous-processing-measurement.js';
import type { ApprovalEvidenceSnapshot } from '../adapters/continuous-processing-measurement.js';
import { refreshMindStewardInboxQueue, recordMindStewardInboxQueueFailure } from '../adapters/mind-steward-inbox-queue.js';
import type { BrainCoreApprovalRecord, BrainCoreApprovalStoreSummary } from '../types/api.js';

function createMindFixture(prefix: string) {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const inboxDir = path.join(mindRoot, 'capture', 'inbox');
  const statePath = path.join(tempDir, 'brain-runtime', 'mind-steward', 'inbox-queue-state.json');
  mkdirSync(inboxDir, { recursive: true });
  return { tempDir, mindRoot, inboxDir, statePath };
}

function ageFile(filePath: string, secondsAgo: number, now: Date): void {
  const timestamp = new Date(now.getTime() - secondsAgo * 1000);
  utimesSync(filePath, timestamp, timestamp);
}

// Test 1: Missing queue/runtime/approval evidence returns null metrics with blockers
test('missing queue state returns null metrics with blockers', () => {
  const now = new Date('2026-06-18T12:00:00Z');
  const view = getContinuousProcessingMeasurementView({ state: null, now });

  assert.equal(view.status, 'missing');
  assert.equal(view.latency, null);
  assert.equal(view.machineLoad, null);
  assert.equal(view.reviewBurden, null);
  assert.equal(view.configuration, null);
  assert(view.blockers.includes('queueStateUnavailable'));
  assert.equal(view.valueAssessment.status, 'insufficient-evidence');
  assert(view.valueAssessment.blockers.includes('queueStateUnavailable'));
  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.writesToMind, false);
});

// Test 2: Missing evidence is never reported as zero
test('empty queue does not report missing latency as zero', () => {
  const fixture = createMindFixture('measurement-empty-');
  const now = new Date('2026-06-18T12:00:00Z');

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.latency!.oldestPendingAgeSeconds, null);
    assert.equal(view.latency!.sampleCount, 0);
    assert(view.latency!.blockers.includes('noStablePendingItemsWithTimestamps'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 3: Latency derives correctly from real timestamps
test('latency derives correctly from real firstSeenAt timestamps', () => {
  const fixture = createMindFixture('measurement-latency-');
  const firstSeen = new Date('2026-06-18T10:00:00Z');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'old.md');
  writeFileSync(filePath, '# Old\n');
  ageFile(filePath, 7200, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: firstSeen,
    });
    const laterState = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state: laterState, now });

    assert.equal(view.latency!.oldestPendingAgeSeconds, 7200);
    assert.equal(view.latency!.sampleCount, 1);
    assert.equal(view.latency!.source, 'queue-item-firstSeenAt-timestamps');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 4: Invalid timestamps fail closed
test('invalid timestamps produce blockers, not zero latency', () => {
  const now = new Date('2026-06-18T12:00:00Z');
  const state = {
    schemaVersion: '1.0' as const,
    queueId: 'test-queue',
    generatedAt: now.toISOString(),
    source: 'brain-runtime' as const,
    mindRoot: '/tmp/fake',
    inboxPath: '/tmp/fake/capture/inbox',
    status: 'ready' as const,
    settings: { maxConcurrentJobs: 1, maxFilesPerRun: 3, debounceSeconds: 30, maxRetries: 2, largeFileThresholdMb: 2, minimumSecondsBetweenRuns: 300, localOnly: true as const },
    items: [{
      id: 'test-item',
      path: 'capture/inbox/test.md',
      status: 'pending' as const,
      sizeBytes: 100,
      contentSha256: 'abc123',
      modifiedAt: '2026-06-18T10:00:00Z',
      firstSeenAt: 'not-a-valid-timestamp',
      lastCheckedAt: now.toISOString(),
      stableFile: true,
      stableAt: '2026-06-18T10:00:30Z',
      debounceSeconds: 30,
      debounceUntil: null,
      attemptCount: 0,
      lastError: null,
      nextRetryAfter: null,
      failureRoute: null,
      largeFile: false,
      selectedForSample: true,
      selectorStatus: 'unknown' as const,
    }],
    summary: { total: 1, pending: 1, blocked: 0, failed: 0, selectedForSample: 1, stableFile: 1, debouncing: 0, largeFile: 0, done: 0 },
    blockers: [],
    safety: { writesToMind: false as const, movesCaptures: false as const, deletesCaptures: false as const, writesKanban: false as const, stateOwnedBy: 'brain' as const, statePath: '/tmp/fake-state.json' },
  };

  const view = getContinuousProcessingMeasurementView({ state, now });

  assert.equal(view.latency!.oldestPendingAgeSeconds, null);
  assert.equal(view.latency!.sampleCount, 0);
  assert(view.latency!.blockers.some(b => b.startsWith('invalidTimestamp:')));
});

// Test 5: Runtime duration is reported as duration, not CPU load
test('machine load reports process memory, not queue counts or durations', () => {
  const fixture = createMindFixture('measurement-machine-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.machineLoad!.source, 'process.memoryUsage-one-time-sample');
    assert(typeof view.machineLoad!.processRssBytes === 'number');
    assert(view.machineLoad!.processRssBytes > 0);
    assert(typeof view.machineLoad!.processHeapUsedBytes === 'number');
    assert(view.machineLoad!.processHeapUsedBytes > 0);
    assert(typeof view.machineLoad!.sampledAt === 'string');
    // Ensure queue counts are NOT under machineLoad
    assert(!('totalQueueItems' in view.machineLoad!));
    assert(!('pendingCount' in view.machineLoad!));
    assert(!('maxConcurrentJobs' in view.machineLoad!));
    assert(!('maxFilesPerRun' in view.machineLoad!));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 6: Actual process memory sample is typed and bounded
test('process memory sample is bounded positive numbers', () => {
  const fixture = createMindFixture('measurement-mem-bounded-');
  const now = new Date('2026-06-18T12:00:00Z');

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert(Number.isFinite(view.machineLoad!.processRssBytes));
    assert(view.machineLoad!.processRssBytes > 0);
    assert(view.machineLoad!.processRssBytes < 4 * 1024 * 1024 * 1024); // < 4GB sanity bound
    assert(Number.isFinite(view.machineLoad!.processHeapUsedBytes));
    assert(view.machineLoad!.processHeapUsedBytes > 0);
    assert(view.machineLoad!.processHeapUsedBytes <= view.machineLoad!.processRssBytes);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 7: Queue configuration appears only under configuration, not machine load
test('configuration is separate from machine load and review burden', () => {
  const fixture = createMindFixture('measurement-config-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.notEqual(view.configuration, null);
    assert.equal(view.configuration!.maxConcurrentJobs, 1);
    assert.equal(view.configuration!.maxFilesPerRun, 3);
    assert.equal(view.configuration!.maxRetries, 2);
    assert.equal(view.configuration!.debounceSeconds, 30);
    assert.equal(view.configuration!.minimumSecondsBetweenRuns, 300);
    // Confirm these do NOT appear under machineLoad or reviewBurden
    assert(!('maxRetries' in view.machineLoad!));
    assert(!('maxRetries' in view.reviewBurden!));
    assert(!('maxConcurrentJobs' in view.reviewBurden!));
    assert(!('debounceSeconds' in view.machineLoad!));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 8: Pending/approved/rejected review counts derive from real records
test('review burden reports queue reported-items and approval store counts', () => {
  const fixture = createMindFixture('measurement-review-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.reviewBurden!.source, 'queue-status-reported-items-and-approval-store');
    assert(typeof view.reviewBurden!.pendingReviewCount === 'number');
    assert(typeof view.reviewBurden!.failedNeedingReviewCount === 'number');
    // Ensure old misleading fields are NOT present
    assert(!('handledCount' in view.reviewBurden!));
    assert(!('averageQueueDepth' in view.reviewBurden!));
    assert(!('maxRetries' in view.reviewBurden!));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 9: No approval records returns insufficient evidence, not zero burden
test('unavailable approval store reports blockers, not zero counts', () => {
  const fixture = createMindFixture('measurement-no-approvals-');
  const now = new Date('2026-06-18T12:00:00Z');

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    // Without BRAIN_CORE_APPROVAL_STORE_PATH, store is disabled
    assert(
      view.reviewBurden!.approvedCount === null ||
      view.reviewBurden!.blockers.includes('approvalStoreUnavailableOrDisabled'),
    );
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 10: Value assessment remains not-proven without comparative evidence
test('value assessment is not-proven without baseline comparison', () => {
  const fixture = createMindFixture('measurement-value-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.valueAssessment.status, 'not-proven');
    assert(view.valueAssessment.blockers.includes('noBaselineComparisonAvailable'));
    assert(view.valueAssessment.blockers.includes('noBeforeAfterTimeSavingsEvidence'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 11: Route is read-only and does not execute, schedule, mutate Mind, or start monitoring
test('measurement view is read-only with no side effects', () => {
  const fixture = createMindFixture('measurement-safety-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.safety.createsSchedulerJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.watcherEnabled, false);
    assert.equal(view.safety.collectsMetricsAutomatically, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// Test 12: Existing queue and scheduler behavior remains unchanged
test('measurement view does not alter queue state', () => {
  const fixture = createMindFixture('measurement-noalter-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const stateBefore = JSON.stringify(state);
    getContinuousProcessingMeasurementView({ state, now });
    const stateAfter = JSON.stringify(state);

    assert.equal(stateBefore, stateAfter, 'Queue state must not be mutated by measurement view');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// --- Injected approval evidence tests ---

function makeApprovalRecord(status: BrainCoreApprovalRecord['status']): BrainCoreApprovalRecord {
  return {
    id: `test-${status}-${Date.now()}`,
    createdAt: '2026-06-18T10:00:00Z',
    updatedAt: '2026-06-18T10:00:00Z',
    requestedBy: 'test',
    kind: 'scheduler-run-mind-steward-dry-run',
    status,
    executed: false,
    source: 'memory',
    preview: { kind: 'scheduler-run-mind-steward-dry-run', summary: 'test', wouldExecute: false, requiresApproval: true, writesToMind: false, externalSideEffects: false, commands: [] },
    policy: { executionEnabled: false, executionGate: 'disabled-until-explicit-enable', requiresDurableAudit: true, requiresRollbackPlan: true },
  };
}

function makeApprovalEvidence(records: BrainCoreApprovalRecord[]): ApprovalEvidenceSnapshot {
  return {
    store: {
      enabled: true,
      status: 'available',
      path: 'test/approvals.json',
      recordCount: records.length,
      writesToMind: false,
      executableActions: false,
      records,
    },
  };
}

test('injected approval records produce correct approved/rejected/pending counts', () => {
  const fixture = createMindFixture('measurement-inject-approval-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });

    const records = [
      makeApprovalRecord('approved'),
      makeApprovalRecord('approved'),
      makeApprovalRecord('rejected'),
      makeApprovalRecord('pending'),
      makeApprovalRecord('pending'),
      makeApprovalRecord('pending'),
    ];
    const approvalEvidence = makeApprovalEvidence(records);
    const view = getContinuousProcessingMeasurementView({ state, now, approvalEvidence });

    assert.equal(view.reviewBurden!.approvedCount, 2);
    assert.equal(view.reviewBurden!.rejectedCount, 1);
    assert.equal(view.reviewBurden!.pendingApprovalCount, 3);
    assert.equal(view.reviewBurden!.approvalStoreSource, 'test/approvals.json');
    assert.equal(view.reviewBurden!.blockers.length, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('unavailable approval evidence yields null counts and blockers, not zero', () => {
  const fixture = createMindFixture('measurement-null-approval-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });

    const view = getContinuousProcessingMeasurementView({ state, now, approvalEvidence: null });

    assert.equal(view.reviewBurden!.approvedCount, null);
    assert.equal(view.reviewBurden!.rejectedCount, null);
    assert.equal(view.reviewBurden!.pendingApprovalCount, null);
    assert.equal(view.reviewBurden!.approvalStoreSource, null);
    assert(view.reviewBurden!.blockers.includes('approvalEvidenceUnavailable'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('malformed approval evidence fails closed', () => {
  const fixture = createMindFixture('measurement-malformed-approval-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });

    const malformedEvidence: ApprovalEvidenceSnapshot = {
      store: {
        enabled: true,
        status: 'invalid',
        path: 'test/bad.json',
        recordCount: 0,
        writesToMind: false,
        executableActions: false,
        records: [],
      },
    };
    const view = getContinuousProcessingMeasurementView({ state, now, approvalEvidence: malformedEvidence });

    assert.equal(view.reviewBurden!.approvedCount, null);
    assert.equal(view.reviewBurden!.rejectedCount, null);
    assert.equal(view.reviewBurden!.pendingApprovalCount, null);
    assert(view.reviewBurden!.blockers.includes('approvalEvidenceMalformed'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('tests do not depend on real approval store environment', () => {
  const fixture = createMindFixture('measurement-no-env-approval-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });

    const approvalEvidence = makeApprovalEvidence([makeApprovalRecord('approved')]);
    const view = getContinuousProcessingMeasurementView({ state, now, approvalEvidence });

    assert.equal(view.reviewBurden!.approvedCount, 1);
    assert.equal(view.reviewBurden!.blockers.length, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// --- Deterministic timestamp tests ---

test('generatedAt and machineLoad.sampledAt equal the supplied now', () => {
  const fixture = createMindFixture('measurement-timestamp-');
  const now = new Date('2026-06-18T14:30:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert.equal(view.generatedAt, '2026-06-18T14:30:00.000Z');
    assert.equal(view.machineLoad!.sampledAt, '2026-06-18T14:30:00.000Z');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('injected memory sample is reported exactly', () => {
  const fixture = createMindFixture('measurement-injected-mem-');
  const now = new Date('2026-06-18T14:30:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const memorySample = { rssBytes: 123456789, heapUsedBytes: 98765432 };
    const view = getContinuousProcessingMeasurementView({ state, now, memorySample });

    assert.equal(view.machineLoad!.processRssBytes, 123456789);
    assert.equal(view.machineLoad!.processHeapUsedBytes, 98765432);
    assert.equal(view.machineLoad!.sampledAt, '2026-06-18T14:30:00.000Z');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('sampleProcessMemory uses supplied now for sampledAt', () => {
  const now = new Date('2026-06-18T09:00:00Z');
  const sample = sampleProcessMemory(now);
  assert.equal(sample.sampledAt, '2026-06-18T09:00:00.000Z');
  assert(sample.rssBytes > 0);
  assert(sample.heapUsedBytes > 0);
});

test('sampleProcessMemory uses injected memory sample exactly', () => {
  const now = new Date('2026-06-18T09:00:00Z');
  const injected = { rssBytes: 42, heapUsedBytes: 21 };
  const sample = sampleProcessMemory(now, injected);
  assert.equal(sample.rssBytes, 42);
  assert.equal(sample.heapUsedBytes, 21);
  assert.equal(sample.sampledAt, '2026-06-18T09:00:00.000Z');
});

// --- Metric-name honesty tests ---

test('configuration remains outside machineLoad', () => {
  const fixture = createMindFixture('measurement-config-isolation-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingMeasurementView({ state, now });

    assert(!('cpuPercent' in view.machineLoad!));
    assert(!('totalMachineUtilization' in view.machineLoad!));
    assert(!('eventLoopLoad' in view.machineLoad!));
    assert(!('maxConcurrentJobs' in view.machineLoad!));
    assert(!('maxFilesPerRun' in view.machineLoad!));
    assert(!('debounceSeconds' in view.machineLoad!));
    assert.equal(view.machineLoad!.source, 'process.memoryUsage-one-time-sample');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('valueAssessment stays not-proven without comparative evidence', () => {
  const fixture = createMindFixture('measurement-value-notproven-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const approvalEvidence = makeApprovalEvidence([makeApprovalRecord('approved')]);
    const view = getContinuousProcessingMeasurementView({ state, now, approvalEvidence });

    assert.equal(view.valueAssessment.status, 'not-proven');
    assert(view.valueAssessment.blockers.includes('noBaselineComparisonAvailable'));
    assert(view.valueAssessment.blockers.includes('noBeforeAfterTimeSavingsEvidence'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
