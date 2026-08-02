import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInfiniteBrainPilotVerdict,
  canonicalPilotManifestHash,
  normalizeInfiniteBrainPilotMeasurement,
  runInfiniteBrainPilot,
  validateInfiniteBrainPilotManifest,
  type InfiniteBrainPilotManifest,
} from '../adapters/infinite-brain-pilot.js';

const baseManifest = (): InfiniteBrainPilotManifest => ({
  pilotId: 'brain-runtime-measured-automation-pilot',
  capabilityId: 'measured-automation-pilot',
  owner: 'brain-runtime',
  startAt: '2026-07-16T00:00:00.000Z',
  endAt: '2026-08-15T00:00:00.000Z',
  sampleLimit: 3,
  featureFlag: 'BRAIN_RUNTIME_MEASURED_AUTOMATION_PILOT',
  featureFlagEnabled: false,
  scheduleEnabled: false,
  killConditions: ['baseline-missing', 'missing-human-verdict-path', 'second-active-pilot'],
  baselineReference: {
    sourceCommit: '5c23708a4fdc4c0e1d871620d6e818b82bc59d28',
    sourcePath: 'operations/reports/b4-4-b5-1-b5-3-batch-2026-07-16.md',
    state: {
      repositoryState: 'verified',
      deployedState: 'unknown',
      observedState: 'observed',
      verifiedState: 'verified',
    },
  },
  metricDefinitions: [
    {
      metricId: 'latencyMs',
      label: 'pilot latency',
      source: 'fixture-measurement-clock',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'selectedSourceCount',
      label: 'selected sources',
      source: 'fixture-source-selection',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'omittedSourceCount',
      label: 'omitted sources',
      source: 'fixture-source-selection',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'errorCount',
      label: 'pilot errors',
      source: 'fixture-execution-log',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'reviewDecision',
      label: 'review decision',
      source: 'fixture-human-verdict',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'correctionTimeMs',
      label: 'correction time',
      source: 'fixture-human-verdict',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
    {
      metricId: 'rollbackCount',
      label: 'rollback count',
      source: 'fixture-rollback-record',
      collectionWindow: {
        start: '2026-07-16T00:00:00.000Z',
        end: '2026-08-15T00:00:00.000Z',
      },
    },
  ],
  humanVerdictPath: 'operations/reports/infinite-brain-measured-automation-verdicts-2026-07-16.json',
  scope: {
    mode: 'report-only',
    writesToMind: false,
    externalWrites: false,
  },
  state: {
    repositoryState: 'verified',
    deployedState: 'unknown',
    observedState: 'observed',
    verifiedState: 'verified',
  },
  active: true,
});

test('valid pilot is accepted and runner records bounded measurements', () => {
  const manifest = baseManifest();
  const result = runInfiniteBrainPilot({
    manifest,
    measurement: {
      latencyMs: 42,
      selectedSourceCount: 2,
      omittedSourceCount: 1,
      errorCount: 0,
      reviewDecision: 'retain',
      correctionTimeMs: 18,
      rollbackCount: 1,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.errors.length, 0);
  assert.equal(result.measurement.metrics.length, 7);
  assert.equal(result.measurement.metrics[0]?.source, 'fixture-measurement-clock');
  assert.equal(result.measurement.metrics[0]?.collectionWindow.start, '2026-07-16T00:00:00.000Z');
  assert.equal(canonicalPilotManifestHash(manifest).length, 64);
});

test('second active pilot is rejected', () => {
  const result = validateInfiniteBrainPilotManifest(baseManifest(), [baseManifest()]);
  assert(result.includes('second-active-pilot-rejected'));
});

test('missing baseline, kill conditions, or verdict path fails closed', () => {
  const missingBaseline = baseManifest();
  delete (missingBaseline as Partial<InfiniteBrainPilotManifest>).baselineReference;
  assert(validateInfiniteBrainPilotManifest(missingBaseline).includes('baseline-required'));

  const missingKillConditions = baseManifest();
  missingKillConditions.killConditions = [];
  assert(validateInfiniteBrainPilotManifest(missingKillConditions).includes('kill-conditions-required'));

  const missingVerdictPath = baseManifest();
  missingVerdictPath.humanVerdictPath = '';
  assert(validateInfiniteBrainPilotManifest(missingVerdictPath).includes('human-verdict-path-required'));
});

test('missing measurements stay null and metric source/window are required', () => {
  const manifest = baseManifest();
  const measurement = normalizeInfiniteBrainPilotMeasurement(manifest, {
    selectedSourceCount: 0,
  });

  const latency = measurement.metrics.find((metric) => metric.metricId === 'latencyMs');
  const selected = measurement.metrics.find((metric) => metric.metricId === 'selectedSourceCount');
  assert.equal(latency?.value, null);
  assert.equal(selected?.value, 0);
  assert.equal(latency?.source, 'fixture-measurement-clock');
  assert.equal(latency?.collectionWindow.start, '2026-07-16T00:00:00.000Z');

  const invalid = baseManifest();
  const firstMetric = invalid.metricDefinitions[0]!;
  invalid.metricDefinitions[0] = {
    metricId: firstMetric.metricId,
    label: firstMetric.label,
    source: '',
    collectionWindow: {
      start: firstMetric.collectionWindow.start,
      end: firstMetric.collectionWindow.end,
    },
  };
  assert(validateInfiniteBrainPilotManifest(invalid).includes('metric-source-required:latencyMs'));
});

test('retire disables feature flag and schedule state', () => {
  const result = applyInfiniteBrainPilotVerdict(baseManifest(), 'retire');
  assert.equal(result.featureFlagEnabled, false);
  assert.equal(result.scheduleEnabled, false);
  assert.equal(result.scope.mode, 'report-only');
});

test('revise returns report-only state', () => {
  const result = applyInfiniteBrainPilotVerdict(baseManifest(), 'revise');
  assert.equal(result.featureFlagEnabled, false);
  assert.equal(result.scheduleEnabled, false);
  assert.equal(result.scope.mode, 'report-only');
});

test('retain preserves scope exactly and rejects scope expansion or model-supplied authority', () => {
  const manifest = baseManifest();
  const retained = applyInfiniteBrainPilotVerdict(manifest, 'retain');
  assert.deepEqual(retained.scope, manifest.scope);

  assert.throws(
    () => applyInfiniteBrainPilotVerdict(manifest, 'retain', {
      proposedRetainScope: { ...manifest.scope, mode: 'read-only' },
    }),
    /retain_scope_expansion_rejected/,
  );

  const blocked = runInfiniteBrainPilot({
    manifest,
    modelSupplied: { owner: 'model' },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'rejected');
  assert(blocked.errors.includes('model-supplied-authority-rejected'));
});
