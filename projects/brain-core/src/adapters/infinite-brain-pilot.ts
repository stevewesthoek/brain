import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CapabilityLifecycleState } from './infinite-brain-typed-capability-worker.js';

export type InfiniteBrainPilotVerdict = 'retire' | 'revise' | 'retain';
export type InfiniteBrainPilotScopeMode = 'report-only' | 'read-only';

export interface InfiniteBrainPilotStateSnapshot {
  repositoryState: CapabilityLifecycleState;
  deployedState: CapabilityLifecycleState;
  observedState: CapabilityLifecycleState;
  verifiedState: CapabilityLifecycleState;
}

export interface InfiniteBrainPilotBaselineReference {
  sourceCommit: string;
  sourcePath: string;
  state: InfiniteBrainPilotStateSnapshot;
}

export interface InfiniteBrainPilotMetricDefinition {
  metricId:
    | 'latencyMs'
    | 'selectedSourceCount'
    | 'omittedSourceCount'
    | 'errorCount'
    | 'reviewDecision'
    | 'correctionTimeMs'
    | 'rollbackCount';
  label: string;
  source: string;
  collectionWindow: {
    start: string;
    end: string;
  };
}

export interface InfiniteBrainPilotScope {
  mode: InfiniteBrainPilotScopeMode;
  writesToMind: false;
  externalWrites: false;
}

export interface InfiniteBrainPilotManifest {
  pilotId: string;
  capabilityId: string;
  owner: string;
  startAt: string;
  endAt: string;
  sampleLimit: number;
  featureFlag: string;
  featureFlagEnabled: boolean;
  scheduleEnabled: boolean;
  killConditions: string[];
  baselineReference: InfiniteBrainPilotBaselineReference;
  metricDefinitions: InfiniteBrainPilotMetricDefinition[];
  humanVerdictPath: string;
  scope: InfiniteBrainPilotScope;
  state: InfiniteBrainPilotStateSnapshot;
  active: boolean;
}

export interface InfiniteBrainPilotMeasurementInput {
  latencyMs?: number | null;
  selectedSourceCount?: number | null;
  omittedSourceCount?: number | null;
  errorCount?: number | null;
  reviewDecision?: InfiniteBrainPilotVerdict | null;
  correctionTimeMs?: number | null;
  rollbackCount?: number | null;
}

export interface InfiniteBrainPilotMetricRecord extends InfiniteBrainPilotMetricDefinition {
  value: number | InfiniteBrainPilotVerdict | null;
}

export interface InfiniteBrainPilotMeasurementRecord {
  pilotId: string;
  capturedAt: string;
  sourceWindow: {
    start: string;
    end: string;
  };
  metrics: InfiniteBrainPilotMetricRecord[];
}

export interface InfiniteBrainPilotVerdictResult {
  verdict: InfiniteBrainPilotVerdict;
  featureFlagEnabled: boolean;
  scheduleEnabled: boolean;
  scope: InfiniteBrainPilotScope;
  state: InfiniteBrainPilotStateSnapshot;
}

export interface InfiniteBrainPilotRunInput {
  manifest: InfiniteBrainPilotManifest;
  activePilots?: readonly InfiniteBrainPilotManifest[];
  measurement?: InfiniteBrainPilotMeasurementInput;
  verdict?: InfiniteBrainPilotVerdict | null;
  modelSupplied?: Record<string, unknown>;
  proposedRetainScope?: InfiniteBrainPilotScope;
  now?: Date;
}

export interface InfiniteBrainPilotRunResult {
  ok: boolean;
  status: 'accepted' | 'rejected';
  manifest: InfiniteBrainPilotManifest;
  measurement: InfiniteBrainPilotMeasurementRecord;
  verdict: InfiniteBrainPilotVerdictResult | null;
  errors: string[];
}

export class InfiniteBrainPilotError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const FORBIDDEN_MODEL_FIELDS = new Set([
  'owner',
  'capabilityId',
  'featureFlag',
  'featureFlagEnabled',
  'scheduleEnabled',
  'scope',
  'state',
  'baselineReference',
  'humanVerdictPath',
  'killConditions',
  'sampleLimit',
  'active',
]);

const PERSISTENT_SCOPE_KEYS: readonly (keyof InfiniteBrainPilotScope)[] = ['mode', 'writesToMind', 'externalWrites'];

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeRepoRelativePath(value: string): boolean {
  if (!isNonEmptyString(value)) return false;
  if (path.isAbsolute(value)) return false;
  if (value.includes('\\') || value.includes('\0')) return false;
  if (value.includes('*') || value.includes('?') || value.includes('[') || value.includes(']')) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && !normalized.startsWith('../') && !normalized.includes('/../') && normalized !== '..';
}

function validateIsoRange(start: string, end: string, prefix: string): string[] {
  const errors: string[] = [];
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime)) errors.push(`${prefix}-start-invalid`);
  if (!Number.isFinite(endTime)) errors.push(`${prefix}-end-invalid`);
  if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime > endTime) {
    errors.push(`${prefix}-window-invalid`);
  }
  return errors;
}

function scopeEquals(left: InfiniteBrainPilotScope, right: InfiniteBrainPilotScope): boolean {
  return PERSISTENT_SCOPE_KEYS.every((key) => left[key] === right[key]);
}

function validateStateSnapshot(snapshot: InfiniteBrainPilotStateSnapshot, prefix: string): string[] {
  const errors: string[] = [];
  if (!snapshot || typeof snapshot !== 'object') {
    errors.push(`${prefix}-missing`);
    return errors;
  }

  const states = [snapshot.repositoryState, snapshot.deployedState, snapshot.observedState, snapshot.verifiedState];
  if (states.some((value) => !isNonEmptyString(value))) {
    errors.push(`${prefix}-invalid`);
  }
  return errors;
}

export function validateInfiniteBrainPilotManifest(
  manifest: InfiniteBrainPilotManifest,
  activePilots: readonly InfiniteBrainPilotManifest[] = [],
  modelSupplied: Record<string, unknown> | undefined = undefined,
): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(manifest.pilotId)) errors.push('pilot-id-required');
  if (!isNonEmptyString(manifest.capabilityId)) errors.push('capability-id-required');
  if (!isNonEmptyString(manifest.owner)) errors.push('owner-required');
  if (!isNonEmptyString(manifest.startAt)) errors.push('start-required');
  if (!isNonEmptyString(manifest.endAt)) errors.push('end-required');
  if (!Number.isInteger(manifest.sampleLimit) || manifest.sampleLimit < 1) errors.push('sample-limit-required');
  if (!isNonEmptyString(manifest.featureFlag)) errors.push('feature-flag-required');
  if (manifest.scope?.mode !== 'report-only' && manifest.scope?.mode !== 'read-only') {
    errors.push('scope-mode-required');
  }
  if (manifest.scope?.writesToMind !== false || manifest.scope?.externalWrites !== false) {
    errors.push('scope-must-remain-read-only');
  }
  if (manifest.featureFlagEnabled !== false && manifest.featureFlagEnabled !== true) {
    errors.push('feature-flag-state-required');
  }
  if (manifest.scheduleEnabled !== false && manifest.scheduleEnabled !== true) {
    errors.push('schedule-state-required');
  }
  if (!Array.isArray(manifest.killConditions) || manifest.killConditions.length === 0 || manifest.killConditions.some((condition) => !isNonEmptyString(condition))) {
    errors.push('kill-conditions-required');
  }
  if (!manifest.baselineReference) {
    errors.push('baseline-required');
  } else {
    if (!isNonEmptyString(manifest.baselineReference.sourceCommit)) errors.push('baseline-source-commit-required');
    if (!isSafeRepoRelativePath(manifest.baselineReference.sourcePath)) errors.push('baseline-source-path-required');
    errors.push(...validateStateSnapshot(manifest.baselineReference.state, 'baseline-state'));
  }
  if (!Array.isArray(manifest.metricDefinitions) || manifest.metricDefinitions.length === 0) {
    errors.push('metric-definitions-required');
  } else {
    for (const metric of manifest.metricDefinitions) {
      if (!isNonEmptyString(metric.metricId)) errors.push('metric-id-required');
      if (!isNonEmptyString(metric.label)) errors.push('metric-label-required');
      if (!isNonEmptyString(metric.source)) errors.push(`metric-source-required:${metric.metricId}`);
      if (!metric.collectionWindow || !isNonEmptyString(metric.collectionWindow.start) || !isNonEmptyString(metric.collectionWindow.end)) {
        errors.push(`metric-collection-window-required:${metric.metricId}`);
      } else {
        errors.push(...validateIsoRange(metric.collectionWindow.start, metric.collectionWindow.end, `metric-window:${metric.metricId}`));
      }
    }
  }
  if (!isSafeRepoRelativePath(manifest.humanVerdictPath)) errors.push('human-verdict-path-required');
  errors.push(...validateStateSnapshot(manifest.state, 'state'));

  if (!isNonEmptyString(manifest.startAt) || !isNonEmptyString(manifest.endAt)) {
    errors.push('pilot-window-required');
  } else {
    errors.push(...validateIsoRange(manifest.startAt, manifest.endAt, 'pilot-window'));
  }

  if (manifest.active && activePilots.some((pilot) => pilot.active)) {
    errors.push('second-active-pilot-rejected');
  }

  for (const key of Object.keys(modelSupplied ?? {})) {
    if (FORBIDDEN_MODEL_FIELDS.has(key)) {
      errors.push('model-supplied-authority-rejected');
      break;
    }
  }

  return [...new Set(errors)];
}

export function normalizeInfiniteBrainPilotMeasurement(
  manifest: InfiniteBrainPilotManifest,
  input: InfiniteBrainPilotMeasurementInput = {},
  now: Date = new Date(),
): InfiniteBrainPilotMeasurementRecord {
  const metricValues: Record<string, number | InfiniteBrainPilotVerdict | null> = {
    latencyMs: input.latencyMs ?? null,
    selectedSourceCount: input.selectedSourceCount ?? null,
    omittedSourceCount: input.omittedSourceCount ?? null,
    errorCount: input.errorCount ?? null,
    reviewDecision: input.reviewDecision ?? null,
    correctionTimeMs: input.correctionTimeMs ?? null,
    rollbackCount: input.rollbackCount ?? null,
  };

  return {
    pilotId: manifest.pilotId,
    capturedAt: now.toISOString(),
    sourceWindow: {
      start: manifest.startAt,
      end: manifest.endAt,
    },
    metrics: manifest.metricDefinitions.map((metric) => ({
      ...metric,
      value: metricValues[metric.metricId] ?? null,
    })),
  };
}

export function applyInfiniteBrainPilotVerdict(
  manifest: InfiniteBrainPilotManifest,
  verdict: InfiniteBrainPilotVerdict,
  options: {
    proposedRetainScope?: InfiniteBrainPilotScope;
    modelSupplied?: Record<string, unknown>;
  } = {},
): InfiniteBrainPilotVerdictResult {
  for (const key of Object.keys(options.modelSupplied ?? {})) {
    if (FORBIDDEN_MODEL_FIELDS.has(key)) {
      throw new InfiniteBrainPilotError('model_supplied_authority_rejected');
    }
  }

  if (verdict === 'retain') {
    const proposedRetainScope = options.proposedRetainScope ?? manifest.scope;
    if (!scopeEquals(proposedRetainScope, manifest.scope)) {
      throw new InfiniteBrainPilotError('retain_scope_expansion_rejected');
    }
    return {
      verdict,
      featureFlagEnabled: manifest.featureFlagEnabled,
      scheduleEnabled: manifest.scheduleEnabled,
      scope: manifest.scope,
      state: manifest.state,
    };
  }

  if (verdict === 'retire') {
    return {
      verdict,
      featureFlagEnabled: false,
      scheduleEnabled: false,
      scope: {
        ...manifest.scope,
        mode: 'report-only',
      },
      state: {
        ...manifest.state,
        deployedState: 'retired',
        observedState: 'retired',
        verifiedState: 'retired',
      },
    };
  }

  return {
    verdict,
    featureFlagEnabled: false,
    scheduleEnabled: false,
    scope: {
      ...manifest.scope,
      mode: 'report-only',
    },
    state: {
      ...manifest.state,
      deployedState: 'configured',
      observedState: 'observed',
      verifiedState: 'verified',
    },
  };
}

export function runInfiniteBrainPilot(
  input: InfiniteBrainPilotRunInput,
  activePilots: readonly InfiniteBrainPilotManifest[] = [],
  now: Date = input.now ?? new Date(),
): InfiniteBrainPilotRunResult {
  const errors = validateInfiniteBrainPilotManifest(
    input.manifest,
    activePilots,
    input.modelSupplied,
  );
  const measurement = normalizeInfiniteBrainPilotMeasurement(input.manifest, input.measurement ?? {}, now);

  if (errors.length > 0) {
    return {
      ok: false,
      status: 'rejected',
      manifest: input.manifest,
      measurement,
      verdict: null,
      errors,
    };
  }

  const verdict = input.verdict ?? null;
  return {
    ok: true,
    status: 'accepted',
    manifest: input.manifest,
    measurement,
    verdict: verdict === null
      ? null
      : applyInfiniteBrainPilotVerdict(input.manifest, verdict, {
          ...(input.proposedRetainScope === undefined ? {} : { proposedRetainScope: input.proposedRetainScope }),
          ...(input.modelSupplied === undefined ? {} : { modelSupplied: input.modelSupplied }),
        }),
    errors: [],
  };
}

export function canonicalPilotManifestHash(manifest: InfiniteBrainPilotManifest): string {
  return sha256(canonicalJson(manifest));
}
