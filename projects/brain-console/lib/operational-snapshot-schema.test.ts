import test from 'node:test';
import assert from 'node:assert/strict';
import { operationalSnapshotSchema } from './braincore-schemas';

const provenance = {
  sourceReferences: [{ ref: '/status', kind: 'route' as const }],
  adapter: 'test-adapter',
  capturedAt: '2026-09-04T08:00:00.000Z',
  sourceRevision: null,
};

const identity = {
  contract: 'brain-core-deployment-identity-v1' as const,
  version: 1 as const,
  identityState: 'matching' as const,
  metadataAvailable: true,
  canonicalSource: { repository: 'brain' as const, path: '/repo/brain', revision: 'revision-1' },
  deployment: { runtimePath: '/deploy/brain-runtime', revision: 'revision-1', buildMode: 'production' as const, buildTimestamp: null },
  services: { brainCore: 'com.office.brain-core', brainConsole: 'com.office.brain-console', scheduler: 'com.office.nightly-scheduler' },
  endpoints: { brainCore: 'http://127.0.0.1:4877', brainConsole: 'http://127.0.0.1:4881' },
  contractVersions: { projection: 'brain-core-projection-v1', operationalSnapshot: 'operational-snapshot-v1' as const, obsidian: 'brain-console-obsidian-widget-contract-v1' as const },
  safety: { readOnly: true as const, exposesSecrets: false as const, exposesEnvironmentValues: false as const },
};

function section<T>(data: T, state: 'CURRENT' | 'UNAVAILABLE' = 'CURRENT') {
  return {
    state,
    severity: state === 'CURRENT' ? 'info' as const : 'warning' as const,
    authorityOwner: 'brain' as const,
    provenance,
    freshness: state === 'CURRENT' ? 'fresh' as const : 'unavailable' as const,
    confidence: state === 'CURRENT' ? 'high' as const : 'unknown' as const,
    uncertainty: [],
    privacyClassification: 'public-local' as const,
    availability: state === 'CURRENT' ? 'available' as const : 'unavailable' as const,
    failure: null,
    data,
  };
}

function fixture() {
  const scheduler = { status: 'ok', health: 'healthy', totalJobs: 1, runningJobs: 0, failedJobs: 0, blockedJobs: 0, nextRunAt: null };
  const localApps = { status: 'available', appCount: 0, runningCount: 0, stoppedCount: 0, unknownCount: 0 };
  const computer = { status: 'ok', resourceCount: 0, activeIncidents: 0, staleResources: 0, failedBackups: 0 };
  const index = { status: 'ok', sources: [{ id: 'brain', status: 'CURRENT' as const, generatedAt: '2026-09-04T08:00:00.000Z' }] };
  const brain = { runtimeStatus: 'idle', executionEnabled: false, activeOrchestrators: 0, unavailableCapabilities: 0 };
  const posture = { itemCount: 0, currentCount: 0, attentionCount: 0, summary: 'Current.' };
  return {
    contract: 'operational-snapshot-v1' as const,
    version: 1 as const,
    snapshotId: 'snapshot-1',
    generatedAt: '2026-09-04T08:00:00.000Z',
    sourceRevision: 'revision-1',
    overall: section({ summary: 'Current.', attentionCount: 0, activeWorkCount: 0 }),
    sections: {
      attention: section({ items: [] }),
      activeWork: section({ items: [] }),
      activity: section({ items: [] }),
      brain: section({ ...posture, ...brain }),
      computer: section({ ...posture, ...computer }),
      scheduler: section({ ...posture, ...scheduler }),
      index: section({ ...posture, sources: [{ id: 'brain', state: 'CURRENT' as const, generatedAt: '2026-09-04T08:00:00.000Z' }] }),
      consumers: section({ ...posture, domains: ['Code', 'Research', 'Design/Web'] }, 'UNAVAILABLE'),
      identity: section(identity),
    },
    dataSources: {
      status: { ok: true },
      capabilities: {},
      identity,
      scheduler,
      localApps,
      computer,
      index,
      brain,
    },
    errors: [],
    safety: { readOnly: true, writesToMind: false, executionEnabled: false, externalMutations: false },
  };
}

test('Console schema validates operational-snapshot-v1 and preserves safety metadata', () => {
  const parsed = operationalSnapshotSchema.parse(fixture());
  assert.equal(parsed.contract, 'operational-snapshot-v1');
  assert.equal(parsed.sections.identity.data.deployment.revision, 'revision-1');
  assert.deepEqual(parsed.safety, { readOnly: true, writesToMind: false, executionEnabled: false, externalMutations: false });
});

test('Console schema rejects non-canonical state and unsafe snapshot flags', () => {
  const badState = fixture() as Record<string, unknown>;
  const badSections = badState.sections as Record<string, unknown>;
  badSections.attention = { ...(badSections.attention as Record<string, unknown>), state: 'offline' };
  assert.throws(() => operationalSnapshotSchema.parse(badState));

  const unsafe = fixture();
  unsafe.safety.readOnly = false;
  assert.throws(() => operationalSnapshotSchema.parse(unsafe));
});
