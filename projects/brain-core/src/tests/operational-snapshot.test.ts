import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrainCoreAgentEventSummary, BrainCoreAgentRunSummary, BrainCoreStatus } from '../types/api.js';
import { createDeploymentIdentity } from '../adapters/deployment-identity.js';
import { buildOperationalSnapshot } from '../adapters/operational-snapshot.js';
import { getCapabilities } from '../adapters/capabilities.js';
import type { OperationalSnapshotSourceInputs } from '../types/operational-snapshot.js';

const timestamp = '2026-09-04T08:00:00.000Z';

function run(overrides: Partial<BrainCoreAgentRunSummary> = {}): BrainCoreAgentRunSummary {
  return {
    id: 'run-1',
    agentId: 'codex',
    title: 'Example task',
    kind: 'code',
    status: 'running',
    startedAt: timestamp,
    targetType: 'task',
    targetId: 'task-1',
    source: 'scheduler',
    summary: 'Example active task.',
    blockers: [],
    safety: { writesToMind: false, executesShell: false, mutatesRuntime: false, requiresApproval: false, executionEnabled: false },
    ...overrides,
  };
}

function event(overrides: Partial<BrainCoreAgentEventSummary> = {}): BrainCoreAgentEventSummary {
  return {
    id: 'event-1',
    runId: 'run-1',
    type: 'executed',
    createdAt: timestamp,
    status: 'completed',
    summary: 'Example activity.',
    severity: 'info',
    ...overrides,
  };
}

function base(overrides: Partial<OperationalSnapshotSourceInputs> = {}): OperationalSnapshotSourceInputs {
  return {
    status: {
      service: 'brain-core',
      mode: 'read-only',
      ok: true,
      startedAt: timestamp,
      uptimeSeconds: 60,
      version: '0.1.0',
      host: 'test-host',
    },
    capabilities: getCapabilities(),
    identity: createDeploymentIdentity({
      metadataAvailable: true,
      canonicalSourcePath: '/repo/brain',
      sourceRevision: 'revision-1',
      runtimePath: '/deploy/brain-runtime',
      deploymentRevision: 'revision-1',
      buildMode: 'production',
    }),
    scheduler: { status: 'ok', health: 'healthy', totalJobs: 2, runningJobs: 0, failedJobs: 0, blockedJobs: 0, nextRunAt: timestamp },
    localApps: { status: 'available', appCount: 2, runningCount: 2, stoppedCount: 0, unknownCount: 0 },
    computer: { catalog: { resources: [{ freshness: 'fresh' }] }, health: { runtimeState: 'ok', observations: [] }, backups: { backupPolicies: [] } },
    graphify: { status: 'ok', reports: { brain: { available: true, generatedAt: timestamp }, mind: { available: true, generatedAt: timestamp } } },
    runtimeReports: [],
    infiniteBrain: { status: 'ok', runtime: { status: 'idle' }, safety: { executionEnabled: false, writesToMind: false }, orchestrators: [{ id: 'code' }] },
    activeWork: [],
    activity: [],
    generatedAt: timestamp,
    snapshotId: 'snapshot-test-1',
    ...overrides,
  };
}

test('healthy idle snapshot is bounded and read-only', () => {
  const snapshot = buildOperationalSnapshot(base());
  assert.equal(snapshot.contract, 'operational-snapshot-v1');
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.overall.state, 'CURRENT');
  assert.equal(snapshot.sections.activeWork.data.items.length, 0);
  assert.equal(snapshot.sections.attention.data.items.length, 0);
  assert.deepEqual(snapshot.safety, { readOnly: true, writesToMind: false, executionEnabled: false, externalMutations: false });
});

test('active work and pending approval are represented without packet bodies', () => {
  const active = buildOperationalSnapshot(base({ activeWork: [run()] }));
  assert.equal(active.sections.activeWork.data.items[0]?.state, 'CURRENT');
  assert.equal(active.sections.activeWork.data.items[0]?.taskRef, 'run-1');
  assert.equal(active.sections.activeWork.data.items[0]?.specialist, 'codex');
  assert.equal(active.sections.activeWork.data.items[0]?.capabilityRoute, 'code');
  assert.equal(active.sections.activeWork.data.items[0]?.progress, null);
  assert.equal(active.sections.activeWork.data.items[0]?.nextAction, 'Continue the current stage.');

  const pending = buildOperationalSnapshot(base({ activeWork: [run({ status: 'queued', blockers: [] })] }));
  assert.equal(pending.sections.activeWork.data.items[0]?.state, 'PENDING');
});

test('blocked scheduler and blocked work create explicit attention states', () => {
  const snapshot = buildOperationalSnapshot(base({
    scheduler: { status: 'ok', health: 'warning', totalJobs: 3, runningJobs: 0, failedJobs: 0, blockedJobs: 1, nextRunAt: timestamp },
    activeWork: [run({ status: 'blocked', blockers: ['Awaiting approval'] })],
  }));
  assert.equal(snapshot.sections.scheduler.state, 'DEGRADED');
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.state === 'BLOCKED'));
  assert.equal(snapshot.sections.activeWork.data.items[0]?.state, 'BLOCKED');
});

test('stale host telemetry and failed backups remain visible', () => {
  const snapshot = buildOperationalSnapshot(base({
    computer: {
      catalog: { resources: [{ freshness: 'stale' }] },
      health: { runtimeState: 'ok', observations: [] },
      backups: { backupPolicies: [{ status: 'failed' }] },
    },
  }));
  assert.equal(snapshot.sections.computer.state, 'ERROR');
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.id === 'computer-stale-resources'));
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.id === 'computer-failed-backups'));
});

test('machine telemetry pressure feeds the bounded operational attention model', () => {
  const snapshot = buildOperationalSnapshot(base({
    machineTelemetry: {
      state: 'DEGRADED',
      disk: { state: 'DEGRADED', usedPercent: 88 },
      processes: {
        state: 'CURRENT',
        anomalies: [{ id: 'process-memory-101', state: 'DEGRADED', title: 'Brain Core memory pressure', explanation: 'Brain Core is above the conservative memory envelope.', pid: 101, serviceId: 'brain-core' }],
      },
    },
  }));
  assert.equal(snapshot.sections.computer.state, 'DEGRADED');
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.id === 'primary-disk-pressure'));
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.id === 'process-process-memory-101'));
});

test('provider failure degrades only the optional source and leaves snapshot valid', () => {
  const snapshot = buildOperationalSnapshot(base({
    sourceErrors: [{ source: 'provider', optional: true, error: { code: 'provider_unavailable', message: 'Provider did not respond.' } }],
  }));
  assert.equal(snapshot.overall.state, 'CURRENT');
  assert.equal(snapshot.errors[0]?.code, 'provider_unavailable');
  assert.equal(snapshot.sections.scheduler.state, 'CURRENT');
  assert.ok(snapshot.sections.attention.data.items.some((item) => item.state === 'DEGRADED'));
});

test('source/runtime mismatch, stale index, and all optional absence are explicit', () => {
  const mismatch = buildOperationalSnapshot(base({
    identity: createDeploymentIdentity({ ...base().identity.deployment, canonicalSourcePath: '/repo/brain', sourceRevision: 'new', deploymentRevision: 'old' }),
    graphify: { status: 'partial', stale: true, reports: { brain: { available: false, generatedAt: null } } },
  }));
  assert.equal(mismatch.sections.identity.state, 'STALE');
  assert.equal(mismatch.sections.index.state, 'STALE');
  assert.ok(mismatch.sections.attention.data.items.some((item) => item.id === 'runtime-source-mismatch'));

  const unavailable = buildOperationalSnapshot(base({
    graphify: { status: 'missing', reports: {} },
    sourceErrors: [
      { source: 'provider-a', optional: true, error: { code: 'unavailable', message: 'Not configured.' } },
      { source: 'provider-b', optional: true, error: { code: 'unavailable', message: 'Not configured.' } },
    ],
  }));
  assert.equal(unavailable.sections.index.state, 'UNAVAILABLE');
  assert.equal(unavailable.sections.scheduler.state, 'CURRENT');
});

test('recent activity is normalized and bounded', () => {
  const snapshot = buildOperationalSnapshot(base({ activity: [event()] }));
  assert.equal(snapshot.sections.activity.data.items[0]?.eventType, 'executed');
  assert.equal(snapshot.sections.activity.data.items[0]?.domain, 'operations');
});
