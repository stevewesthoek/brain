import type {
  BrainCoreAgentEventSummary,
  BrainCoreAgentRunSummary,
  BrainCoreCapabilitySummary,
  BrainCoreLocalAppsDashboardResponse,
  BrainCoreRuntimeReportSummary,
  BrainCoreStatus,
} from '../types/api.js';
import type { DeploymentIdentity } from '../types/deployment-identity.js';
import {
  operationalSeverityForState,
  type OperationalState,
} from '../types/operational-state.js';
import {
  OPERATIONAL_SNAPSHOT_CONTRACT,
  type OperationalActiveWorkItem,
  type OperationalActivityItem,
  type OperationalAttentionItem,
  type OperationalSnapshot,
  type OperationalSnapshotEvidence,
  type OperationalSnapshotFailure,
  type OperationalSnapshotInputLoaders,
  type OperationalSnapshotSection,
  type OperationalSnapshotSourceInputs,
  type OperationalSnapshotLoaders,
} from '../types/operational-snapshot.js';
import type {
  ProjectionAvailability,
  ProjectionAuthorityOwner,
  ProjectionConfidence,
  ProjectionFreshness,
  ProjectionPrivacy,
  ProjectionProvenance,
} from '../types/projection.js';

const MAX_ATTENTION_ITEMS = 12;
const MAX_ACTIVITY_ITEMS = 12;
const MAX_ACTIVE_WORK_ITEMS = 8;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sourceErrorMap(input: OperationalSnapshotSourceInputs): Map<string, OperationalSnapshotFailure> {
  return new Map((input.sourceErrors ?? []).map((entry) => [entry.source, entry.error]));
}

function sourceMetadata(
  source: string,
  state: OperationalState,
  generatedAt: string,
  failure: OperationalSnapshotFailure | null = null,
  options: {
    authorityOwner?: ProjectionAuthorityOwner;
    confidence?: ProjectionConfidence;
    privacyClassification?: ProjectionPrivacy;
    sourceReferences?: Array<{ ref: string; kind: 'file' | 'report' | 'route' | 'contract' | 'revision' }>;
    uncertainty?: string[];
  } = {},
): OperationalSnapshotEvidence {
  const freshness: ProjectionFreshness = state === 'CURRENT' || state === 'PENDING' ? 'fresh'
    : state === 'STALE' ? 'stale'
      : state === 'UNAVAILABLE' ? 'unavailable'
        : 'unknown';
  const availability: ProjectionAvailability = state === 'CURRENT' || state === 'PENDING' || state === 'STALE' || state === 'DEGRADED'
    ? 'available'
    : state === 'UNAVAILABLE'
      ? 'unavailable'
      : 'invalid';
  const provenance: ProjectionProvenance = {
    sourceReferences: options.sourceReferences ?? [{ ref: source, kind: 'route' }],
    adapter: 'brain-core-operational-snapshot',
    capturedAt: generatedAt,
    sourceRevision: null,
  };

  return {
    authorityOwner: options.authorityOwner ?? 'brain',
    provenance,
    freshness,
    confidence: options.confidence ?? (state === 'CURRENT' ? 'high' : 'medium'),
    uncertainty: options.uncertainty ?? [],
    privacyClassification: options.privacyClassification ?? 'public-local',
    availability,
    failure,
  };
}

function section<TData>(
  source: string,
  state: OperationalState,
  data: TData,
  generatedAt: string,
  failure: OperationalSnapshotFailure | null = null,
  options: Parameters<typeof sourceMetadata>[4] = {},
): OperationalSnapshotSection<TData> {
  return {
    state,
    severity: operationalSeverityForState(state),
    data,
    ...sourceMetadata(source, state, generatedAt, failure, options),
  };
}

function stateForScheduler(value: unknown, failure: OperationalSnapshotFailure | undefined): OperationalState {
  if (failure) return 'ERROR';
  const source = record(value);
  const health = stringValue(source.health);
  if (source.status === 'error' || health === 'failed') return 'ERROR';
  if (health === 'warning') return 'DEGRADED';
  if (source.status === 'not-configured') return 'UNAVAILABLE';
  return 'CURRENT';
}

function stateForLocalApps(value: unknown, failure: OperationalSnapshotFailure | undefined): OperationalState {
  if (failure) return 'ERROR';
  const source = record(value);
  const status = stringValue(source.status);
  if (status === 'unavailable') return 'UNAVAILABLE';
  if (status === 'partial') return 'DEGRADED';
  if (numberValue(source.stoppedCount) > 0 || numberValue(source.unknownCount) > 0) return 'DEGRADED';
  return status === 'available' ? 'CURRENT' : 'UNAVAILABLE';
}

function stateForComputer(value: unknown, failure: OperationalSnapshotFailure | undefined): OperationalState {
  if (failure) return 'ERROR';
  const source = record(value);
  const health = record(source.health);
  const runtimeState = stringValue(health.runtimeState);
  if (runtimeState === 'invalid') return 'ERROR';
  if (runtimeState === 'missing') return 'DEGRADED';
  return 'CURRENT';
}

function stateForMachineTelemetry(value: unknown): OperationalState {
  const source = record(value);
  const disk = record(source.disk);
  const processes = record(source.processes);
  const states = [stringValue(disk.state), stringValue(processes.state)];
  if (states.includes('ERROR')) return 'ERROR';
  if (states.includes('DEGRADED')) return 'DEGRADED';
  if (states.includes('STALE')) return 'STALE';
  if (states.includes('UNAVAILABLE')) return 'UNAVAILABLE';
  if (states.includes('PENDING')) return 'PENDING';
  return 'CURRENT';
}

function stateForIndex(value: unknown, failure: OperationalSnapshotFailure | undefined): OperationalState {
  if (failure) return 'ERROR';
  const source = record(value);
  if (source.stale === true) return 'STALE';
  const status = stringValue(source.status);
  if (status === 'ok') return 'CURRENT';
  if (status === 'partial') return 'DEGRADED';
  return 'UNAVAILABLE';
}

function stateForBrain(value: unknown, failure: OperationalSnapshotFailure | undefined): OperationalState {
  if (failure) return 'ERROR';
  const source = record(value);
  const safety = record(source.safety);
  const runtime = record(source.runtime);
  if (source.status === 'error' || runtime.status === 'error') return 'ERROR';
  if (safety.continuousRuntime === true && safety.writesToMind === true) return 'DEGRADED';
  return 'CURRENT';
}

function stateForIdentity(identity: DeploymentIdentity): OperationalState {
  switch (identity.identityState) {
    case 'matching':
    case 'development':
      return 'CURRENT';
    case 'stale':
      return 'STALE';
    case 'unavailable':
      return 'UNAVAILABLE';
    case 'unknown':
      return 'DEGRADED';
  }
}

function summaryFor(state: OperationalState, itemCount: number, attentionCount: number, label: string): string {
  if (state === 'CURRENT') return `${label} is current with ${itemCount} item${itemCount === 1 ? '' : 's'}.`;
  return `${label} is ${state.toLowerCase()} with ${attentionCount} attention item${attentionCount === 1 ? '' : 's'}.`;
}

function asFailure(value: OperationalSnapshotFailure | undefined): OperationalSnapshotFailure | null {
  return value ?? null;
}

function attention(
  id: string,
  state: Exclude<OperationalState, 'CURRENT'>,
  title: string,
  explanation: string,
  source: string,
  generatedAt: string,
  safeNextAction: string | null = null,
  entityRef: string | null = null,
): OperationalAttentionItem {
  return {
    id,
    severity: operationalSeverityForState(state),
    state,
    title,
    explanation,
    source,
    entityRef,
    observedAt: generatedAt,
    freshness: state === 'STALE' ? 'stale' : state === 'UNAVAILABLE' ? 'unavailable' : 'unknown',
    safeNextAction,
    receiptRef: null,
    evidenceRef: null,
  };
}

function normalizeActiveWork(runs: BrainCoreAgentRunSummary[], generatedAt: string): OperationalActiveWorkItem[] {
  return runs
    .filter((run) => ['queued', 'running', 'blocked'].includes(run.status))
    .slice(0, MAX_ACTIVE_WORK_ITEMS)
    .map((run) => ({
    id: run.id,
    domain: run.kind,
    consumer: run.agentId,
    specialist: run.agentId,
    capabilityRoute: run.kind,
    state: run.status === 'blocked' ? 'BLOCKED' : run.status === 'queued' ? 'PENDING' : 'CURRENT',
    primaryOwner: run.agentId,
    currentStage: run.status,
    progress: null,
    nextAction: run.status === 'blocked' ? (run.blockers[0] ?? 'Resolve the task gate.') : run.status === 'queued' ? 'Await scheduling.' : 'Continue the current stage.',
    gateState: run.blockers.length > 0 ? 'BLOCKED' : 'CURRENT',
      continuationState: run.status === 'queued' ? 'PENDING' : 'CURRENT',
      startedAt: run.startedAt ?? null,
      updatedAt: run.completedAt ?? run.startedAt ?? generatedAt,
      taskRef: run.id,
      evidenceRef: run.relatedReportId ?? null,
    }));
}

function normalizeActivity(events: BrainCoreAgentEventSummary[]): OperationalActivityItem[] {
  return events.slice(0, MAX_ACTIVITY_ITEMS).map((event) => ({
    id: event.id,
    eventType: event.type,
    occurredAt: event.createdAt,
    severity: event.severity === 'error' ? 'critical' : event.severity,
    domain: 'operations',
    entityRef: event.relatedActionId ?? event.relatedApprovalId ?? event.runId ?? null,
    status: event.status,
    summary: event.summary,
    source: 'brain-core-agent-events',
    receiptRef: event.relatedApprovalId ?? null,
  }));
}

function buildSourceData(input: OperationalSnapshotSourceInputs): OperationalSnapshotDataShape {
  const scheduler = record(input.scheduler);
  const schedulerCounts = record(scheduler.counts);
  const localApps = record(input.localApps);
  const computer = record(input.computer);
  const catalog = record(computer.catalog);
  const catalogResources = arrayValue(catalog.resources);
  const health = record(computer.health);
  const healthObservations = arrayValue(health.observations);
  const backups = record(computer.backups);
  const backupPolicies = arrayValue(backups.backupPolicies);
  const failedBackups = backupPolicies.filter((item) => {
    const status = stringValue(record(item).status);
    return status === 'failed' || status === 'error';
  }).length;
  const graphify = record(input.graphify);
  const brain = record(input.infiniteBrain);
  const orchestrators = arrayValue(brain.orchestrators);
  const runtime = record(brain.runtime);
  const safety = record(brain.safety);
  const capabilities = input.capabilities;

  return {
    status: input.status,
    capabilities,
    identity: input.identity,
    scheduler: {
      status: stringValue(scheduler.status, 'unknown') ?? 'unknown',
      health: stringValue(scheduler.health, 'unknown') ?? 'unknown',
      totalJobs: numberValue(scheduler.totalJobs, numberValue(schedulerCounts.total)),
      runningJobs: numberValue(scheduler.runningJobs, numberValue(schedulerCounts.running)),
      failedJobs: numberValue(scheduler.failedJobs, numberValue(schedulerCounts.failed)),
      blockedJobs: numberValue(scheduler.blockedJobs, numberValue(schedulerCounts.blocked)),
      nextRunAt: stringValue(scheduler.nextRunAt),
    },
    localApps: {
      status: stringValue(localApps.status, 'unknown') ?? 'unknown',
      appCount: numberValue(localApps.appCount, arrayValue(localApps.apps).length),
      runningCount: numberValue(localApps.runningCount),
      stoppedCount: numberValue(localApps.stoppedCount),
      unknownCount: numberValue(localApps.unknownCount),
    },
    computer: {
      status: stringValue(health.runtimeState, 'unknown') ?? 'unknown',
      resourceCount: catalogResources.length,
      activeIncidents: numberValue(computer.activeIncidents, healthObservations.filter((item) => stringValue(record(item).status) === 'failed').length),
      staleResources: catalogResources.filter((item) => stringValue(record(item).freshness) === 'stale').length,
      failedBackups,
    },
    index: {
      status: stringValue(graphify.status, 'missing') ?? 'missing',
      sources: Object.entries(record(graphify.reports)).map(([id, value]) => ({
        id,
        status: record(value).available === true ? 'CURRENT' : 'UNAVAILABLE',
        generatedAt: stringValue(record(value).generatedAt),
      })),
    },
    brain: {
      runtimeStatus: stringValue(runtime.status, stringValue(brain.status, 'unknown')) ?? 'unknown',
      executionEnabled: safety.executionEnabled === true,
      activeOrchestrators: orchestrators.length,
      unavailableCapabilities: capabilities.readEndpoints.length === 0 ? 1 : 0,
    },
  };
}

type OperationalSnapshotDataShape = {
  status: BrainCoreStatus;
  capabilities: BrainCoreCapabilitySummary;
  identity: DeploymentIdentity;
  scheduler: {
    status: string;
    health: string;
    totalJobs: number;
    runningJobs: number;
    failedJobs: number;
    blockedJobs: number;
    nextRunAt: string | null;
  };
  localApps: {
    status: string;
    appCount: number;
    runningCount: number;
    stoppedCount: number;
    unknownCount: number;
  };
  computer: {
    status: string;
    resourceCount: number;
    activeIncidents: number;
    staleResources: number;
    failedBackups: number;
  };
  index: {
    status: string;
    sources: Array<{ id: string; status: OperationalState; generatedAt: string | null }>;
  };
  brain: {
    runtimeStatus: string;
    executionEnabled: boolean;
    activeOrchestrators: number;
    unavailableCapabilities: number;
  };
};

function buildAttention(input: OperationalSnapshotSourceInputs, data: OperationalSnapshotDataShape, generatedAt: string): OperationalAttentionItem[] {
  const errors = input.sourceErrors ?? [];
  const items: OperationalAttentionItem[] = [];
  if (data.identity.identityState === 'stale') {
    items.push(attention('runtime-source-mismatch', 'STALE', 'Runtime source revision differs', 'The intended source revision and deployed revision do not match.', '/runtime/identity', generatedAt, 'Inspect deployment identity before changing the live service.'));
  } else if (data.identity.identityState === 'unknown') {
    items.push(attention('runtime-source-unknown', 'DEGRADED', 'Runtime source revision is unknown', 'The service is running without both intended and deployed revisions.', '/runtime/identity', generatedAt, 'Provide pinned source and deployment revision metadata.'));
  }
  if (data.scheduler.failedJobs > 0) {
    items.push(attention('scheduler-failed-jobs', 'ERROR', 'Scheduler jobs failed', `${data.scheduler.failedJobs} scheduler job${data.scheduler.failedJobs === 1 ? '' : 's'} reported failure.`, '/infra/scheduler', generatedAt, 'Open Scheduler receipts and inspect the latest error.'));
  }
  if (data.scheduler.blockedJobs > 0) {
    items.push(attention('scheduler-blocked-jobs', 'BLOCKED', 'Scheduler jobs are policy-blocked', `${data.scheduler.blockedJobs} scheduler job${data.scheduler.blockedJobs === 1 ? '' : 's'} remain blocked by policy.`, '/infra/scheduler', generatedAt, 'Review the policy blocker; do not force-run the job.'));
  }
  if (data.localApps.stoppedCount > 0) {
    items.push(attention('local-apps-stopped', 'DEGRADED', 'Local apps are stopped', `${data.localApps.stoppedCount} local app${data.localApps.stoppedCount === 1 ? '' : 's'} are stopped.`, '/local-apps/dashboard', generatedAt, 'Open Local Apps detail and review safe action readiness.'));
  }
  if (data.computer.staleResources > 0) {
    items.push(attention('computer-stale-resources', 'STALE', 'Computer resource data is stale', `${data.computer.staleResources} resource record${data.computer.staleResources === 1 ? '' : 's'} exceeded its freshness budget.`, '/infra/status', generatedAt, 'Refresh Computer diagnostics and inspect source age.'));
  }
  if (data.computer.failedBackups > 0) {
    items.push(attention('computer-failed-backups', 'ERROR', 'A backup policy reports failure', `${data.computer.failedBackups} backup record${data.computer.failedBackups === 1 ? '' : 's'} reports failure.`, '/infra/backups', generatedAt, 'Inspect the backup failure receipt.'));
  }
  const machineTelemetry = record(input.machineTelemetry);
  const disk = record(machineTelemetry.disk);
  const diskState = stringValue(disk.state);
  const diskPercent = typeof disk.usedPercent === 'number' ? `${disk.usedPercent}% used` : 'usage is unavailable';
  if (diskState === 'ERROR') {
    items.push(attention('primary-disk-critical', 'ERROR', 'Primary disk is critically full', `The primary system volume is at ${diskPercent}.`, '/ops/system-metrics', generatedAt, 'Free space safely before starting large jobs.', 'primary-system-volume'));
  } else if (diskState === 'DEGRADED') {
    items.push(attention('primary-disk-pressure', 'DEGRADED', 'Primary disk pressure is elevated', `The primary system volume is at ${diskPercent}.`, '/ops/system-metrics', generatedAt, 'Review storage consumers before the volume reaches the critical threshold.', 'primary-system-volume'));
  } else if (diskState === 'STALE') {
    items.push(attention('primary-disk-stale', 'STALE', 'Primary disk telemetry is stale', 'The cached primary-volume sample exceeded its freshness budget.', '/ops/system-metrics', generatedAt, 'Refresh Computer telemetry and inspect the collector status.', 'primary-system-volume'));
  } else if (diskState === 'UNAVAILABLE') {
    items.push(attention('primary-disk-unavailable', 'UNAVAILABLE', 'Primary disk telemetry is unavailable', 'Core could not produce a bounded primary-volume sample.', '/ops/system-metrics', generatedAt, 'Inspect the read-only disk collector status.', 'primary-system-volume'));
  }
  const anomalies = arrayValue(record(machineTelemetry.processes).anomalies);
  for (const anomaly of anomalies.slice(0, 2)) {
    const entry = record(anomaly);
    const state = stringValue(entry.state);
    if (state === 'ERROR' || state === 'DEGRADED') {
      items.push(attention(
        `process-${stringValue(entry.id, 'anomaly')}`,
        state,
        stringValue(entry.title, 'Process resource pressure') ?? 'Process resource pressure',
        stringValue(entry.explanation, 'A bounded process sample reported resource pressure.') ?? 'A bounded process sample reported resource pressure.',
        '/ops/system-metrics',
        generatedAt,
        'Inspect the bounded process summary before taking any restart action.',
        stringValue(entry.serviceId, stringValue(entry.pid)),
      ));
    }
  }
  if (data.index.status === 'missing') {
    items.push(attention('index-unavailable', 'UNAVAILABLE', 'Index freshness is unavailable', 'No current Graph/index report is available for the configured sources.', '/projections/topology', generatedAt, 'Inspect index diagnostics; do not infer that the index is fresh.'));
  } else if (data.index.status === 'partial') {
    items.push(attention('index-partial', 'DEGRADED', 'Index coverage is partial', 'Only some configured index reports are current.', '/projections/topology', generatedAt, 'Inspect the stale or missing index source.'));
  }
  for (const entry of errors.slice(0, MAX_ATTENTION_ITEMS)) {
    items.push(attention(`source-error-${entry.source}`, entry.optional ? 'DEGRADED' : 'ERROR', `${entry.source} source failed`, entry.error.message, entry.source, generatedAt, 'Open the source detail and retry when safe.'));
  }
  for (const run of input.activeWork.filter((item) => item.status === 'blocked').slice(0, 3)) {
    items.push(attention(`active-work-${run.id}`, 'BLOCKED', run.title, run.blockers[0] ?? 'Active work is blocked.', 'agent-runs', generatedAt, 'Inspect the task gate and required human action.', run.id));
  }
  return items.slice(0, MAX_ATTENTION_ITEMS);
}

function aggregateState(states: OperationalState[]): OperationalState {
  const order: OperationalState[] = ['ERROR', 'BLOCKED', 'DEGRADED', 'STALE', 'PENDING', 'UNAVAILABLE', 'CURRENT'];
  return order.find((state) => states.includes(state)) ?? 'CURRENT';
}

function sectionAttentionCount(state: OperationalState, items: number): number {
  return state === 'CURRENT' ? 0 : Math.max(1, items);
}

export function buildOperationalSnapshot(input: OperationalSnapshotSourceInputs): OperationalSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const snapshotId = input.snapshotId ?? `operational-snapshot-${generatedAt}`;
  const errors = input.sourceErrors?.map((entry) => entry.error) ?? [];
  const failures = sourceErrorMap(input);
  const data = buildSourceData(input);
  const activeWork = normalizeActiveWork(input.activeWork, generatedAt);
  const activity = normalizeActivity(input.activity);
  const attentionItems = buildAttention(input, data, generatedAt);

  const schedulerState = stateForScheduler(input.scheduler, failures.get('scheduler'));
  const localAppsState = stateForLocalApps(input.localApps, failures.get('localApps'));
  const computedComputerState = stateForComputer(input.computer, failures.get('computer'));
  const machineState = stateForMachineTelemetry(input.machineTelemetry);
  const computerState: OperationalState = data.computer.failedBackups > 0 ? 'ERROR' : machineState === 'ERROR' ? 'ERROR' : machineState === 'DEGRADED' ? 'DEGRADED' : machineState === 'STALE' ? 'STALE' : data.computer.staleResources > 0 ? 'STALE' : computedComputerState;
  const indexState = stateForIndex(input.graphify, failures.get('graphify'));
  const brainState = stateForBrain(input.infiniteBrain, failures.get('infiniteBrain'));
  const activeWorkState: OperationalState = activeWork.some((item) => item.state === 'BLOCKED') ? 'BLOCKED' : activeWork.length > 0 ? 'CURRENT' : 'CURRENT';
  const activityState: OperationalState = failures.has('activity') ? 'ERROR' : 'CURRENT';
  const attentionState: OperationalState = attentionItems.some((item) => item.state === 'ERROR') ? 'ERROR' : attentionItems.some((item) => item.state === 'BLOCKED') ? 'BLOCKED' : attentionItems.length > 0 ? 'DEGRADED' : 'CURRENT';
  const identityState = stateForIdentity(input.identity);
  const consumersState: OperationalState = 'UNAVAILABLE';
  const optionalErrorsOnly = (input.sourceErrors ?? []).length > 0 && (input.sourceErrors ?? []).every((entry) => entry.optional === true);
  const overallState = aggregateState([
    ...(optionalErrorsOnly ? [] : [attentionState]),
    schedulerState,
    localAppsState,
    computerState,
    indexState,
    brainState,
    identityState,
  ]);

  const attentionSection = section('/operational-snapshot', attentionState, { items: attentionItems }, generatedAt, null, {
    uncertainty: ['Attention is bounded to the highest-value operational exceptions.'],
  });
  const activeWorkSection = section('/agent-runs', activeWorkState, { items: activeWork }, generatedAt, asFailure(failures.get('activeWork')));
  const activitySection = section('/agent-events', activityState, { items: activity }, generatedAt, asFailure(failures.get('activity')));
  const brainSection = section('/infinite-brain/status', brainState, {
    itemCount: data.brain.activeOrchestrators,
    currentCount: brainState === 'CURRENT' ? data.brain.activeOrchestrators : 0,
    attentionCount: sectionAttentionCount(brainState, data.brain.unavailableCapabilities),
    summary: summaryFor(brainState, data.brain.activeOrchestrators, data.brain.unavailableCapabilities, 'Brain runtime'),
    runtimeStatus: data.brain.runtimeStatus,
    executionEnabled: data.brain.executionEnabled,
  }, generatedAt, asFailure(failures.get('infiniteBrain')));
  const computerSection = section('/infra/status', computerState, {
    itemCount: data.computer.resourceCount,
    currentCount: computerState === 'CURRENT' ? data.computer.resourceCount : 0,
    attentionCount: data.computer.activeIncidents + data.computer.staleResources + data.computer.failedBackups,
    summary: summaryFor(computerState, data.computer.resourceCount, data.computer.activeIncidents + data.computer.staleResources + data.computer.failedBackups, 'Computer'),
    resourceCount: data.computer.resourceCount,
    activeIncidents: data.computer.activeIncidents,
    staleResources: data.computer.staleResources,
    failedBackups: data.computer.failedBackups,
  }, generatedAt, asFailure(failures.get('computer')));
  const schedulerSection = section('/infra/scheduler', schedulerState, {
    itemCount: data.scheduler.totalJobs,
    currentCount: schedulerState === 'CURRENT' ? data.scheduler.totalJobs : Math.max(0, data.scheduler.totalJobs - data.scheduler.failedJobs - data.scheduler.blockedJobs),
    attentionCount: data.scheduler.failedJobs + data.scheduler.blockedJobs,
    summary: summaryFor(schedulerState, data.scheduler.totalJobs, data.scheduler.failedJobs + data.scheduler.blockedJobs, 'Scheduler'),
    totalJobs: data.scheduler.totalJobs,
    runningJobs: data.scheduler.runningJobs,
    failedJobs: data.scheduler.failedJobs,
    blockedJobs: data.scheduler.blockedJobs,
    nextRunAt: data.scheduler.nextRunAt,
  }, generatedAt, asFailure(failures.get('scheduler')));
  const indexSection = section('/projections/topology', indexState, {
    itemCount: data.index.sources.length,
    currentCount: data.index.sources.filter((source) => source.status === 'CURRENT').length,
    attentionCount: data.index.sources.filter((source) => source.status !== 'CURRENT').length,
    summary: summaryFor(indexState, data.index.sources.length, data.index.sources.filter((source) => source.status !== 'CURRENT').length, 'Indexing'),
    sources: data.index.sources.map((source) => ({ id: source.id, state: source.status, generatedAt: source.generatedAt })),
  }, generatedAt, asFailure(failures.get('graphify')), {
    uncertainty: data.index.sources.length === 0 ? ['Index sources are not instrumented in the current runtime.'] : [],
  });
  const consumersSection = section('/capabilities', consumersState, {
    itemCount: 3,
    currentCount: 0,
    attentionCount: 1,
    summary: 'Consumer telemetry is not instrumented as a live Core read model.',
    domains: ['Code', 'Research', 'Design/Web'],
  }, generatedAt, null, {
    uncertainty: ['The current Core contract does not expose live consumer rollout health as a bounded endpoint.'],
  });
  const identitySection = section('/runtime/identity', identityState, input.identity, generatedAt, null, {
    privacyClassification: 'private-local',
  });
  const overall = section('/operational-snapshot', overallState, {
    summary: overallState === 'CURRENT'
      ? 'Brain is operational and current for the instrumented snapshot sources.'
      : `Brain posture is ${overallState.toLowerCase()}; inspect the attention items before relying on all subsystems.`,
    attentionCount: attentionItems.length,
    activeWorkCount: activeWork.length,
  }, generatedAt, errors[0] ?? null, {
    uncertainty: ['The snapshot is bounded and does not include full histories, logs, processes, or packet bodies.'],
  });

  return {
    contract: OPERATIONAL_SNAPSHOT_CONTRACT,
    version: 1,
    snapshotId,
    generatedAt,
    sourceRevision: input.identity.deployment.revision ?? input.identity.canonicalSource.revision,
    overall,
    sections: {
      attention: attentionSection,
      activeWork: activeWorkSection,
      activity: activitySection,
      brain: brainSection,
      computer: computerSection,
      scheduler: schedulerSection,
      index: indexSection,
      consumers: consumersSection,
      identity: identitySection,
    },
    dataSources: data,
    errors,
    safety: {
      readOnly: true,
      writesToMind: false,
      executionEnabled: false,
      externalMutations: false,
    },
  };
}

async function loadSource(loader: OperationalSnapshotLoaders, source: string): Promise<{ value: unknown; error?: { source: string; error: OperationalSnapshotFailure } }> {
  try {
    const sourceLoader = loader[source as keyof OperationalSnapshotLoaders];
    if (!sourceLoader) return { value: null };
    return { value: await sourceLoader() };
  } catch (error) {
    return {
      value: null,
      error: {
        source,
        error: {
          code: `${source}_source_failed`,
          message: error instanceof Error ? error.message : `${source} source failed while building the operational snapshot.`,
        },
      },
    };
  }
}

export async function readOperationalSnapshot(input: OperationalSnapshotInputLoaders, options: { generatedAt?: string; snapshotId?: string } = {}): Promise<OperationalSnapshot> {
  const sourceEntries = Object.keys(input.sources) as Array<keyof OperationalSnapshotLoaders>;
  const loaded = await Promise.all(sourceEntries.map(async (source) => [source, await loadSource(input.sources, source)] as const));
  const sourceValues = new Map(loaded.map(([source, result]) => [source, result.value]));
  const sourceErrors = loaded.flatMap(([, result]) => result.error ? [result.error] : []);
  const status = input.status();
  const capabilities = input.capabilities();
  const identity = input.identity();
  const runtimeReports = (sourceValues.get('runtimeReports') as BrainCoreRuntimeReportSummary[] | undefined) ?? [];
  const activeWork = (sourceValues.get('activeWork') as BrainCoreAgentRunSummary[] | undefined) ?? [];
  const activity = (sourceValues.get('activity') as BrainCoreAgentEventSummary[] | undefined) ?? [];
  const snapshotInput: OperationalSnapshotSourceInputs = {
    status,
    capabilities,
    identity,
    scheduler: sourceValues.get('scheduler'),
    localApps: sourceValues.get('localApps'),
    computer: sourceValues.get('computer'),
    machineTelemetry: sourceValues.get('machineTelemetry'),
    graphify: sourceValues.get('graphify'),
    runtimeReports,
    infiniteBrain: sourceValues.get('infiniteBrain'),
    activeWork,
    activity,
    sourceErrors,
  };
  if (options.generatedAt !== undefined) snapshotInput.generatedAt = options.generatedAt;
  if (options.snapshotId !== undefined) snapshotInput.snapshotId = options.snapshotId;
  return buildOperationalSnapshot(snapshotInput);
}

export function summarizeLocalApps(value: BrainCoreLocalAppsDashboardResponse): OperationalSnapshotSourceInputs['localApps'] {
  return value;
}
