import type {
  BrainCoreAgentEventSummary,
  BrainCoreAgentRunSummary,
  BrainCoreCapabilitySummary,
  BrainCoreLocalAppsDashboardResponse,
  BrainCoreRuntimeReportSummary,
  BrainCoreStatus,
} from './api.js';
import type { DeploymentIdentity } from './deployment-identity.js';
import type {
  ProjectionAuthorityOwner,
  ProjectionAvailability,
  ProjectionConfidence,
  ProjectionFreshness,
  ProjectionPrivacy,
  ProjectionProvenance,
} from './projection.js';
import type { OperationalSeverity, OperationalState } from './operational-state.js';

export const OPERATIONAL_SNAPSHOT_CONTRACT = 'operational-snapshot-v1' as const;

export interface OperationalSnapshotFailure {
  code: string;
  message: string;
}

export interface OperationalSnapshotEvidence {
  authorityOwner: ProjectionAuthorityOwner;
  provenance: ProjectionProvenance;
  freshness: ProjectionFreshness;
  confidence: ProjectionConfidence;
  uncertainty: string[];
  privacyClassification: ProjectionPrivacy;
  availability: ProjectionAvailability;
  failure: OperationalSnapshotFailure | null;
}

export interface OperationalSnapshotSection<TData> extends OperationalSnapshotEvidence {
  state: OperationalState;
  severity: OperationalSeverity;
  data: TData;
}

export interface OperationalAttentionItem {
  id: string;
  severity: OperationalSeverity;
  state: Exclude<OperationalState, 'CURRENT'>;
  title: string;
  explanation: string;
  source: string;
  entityRef: string | null;
  observedAt: string;
  freshness: ProjectionFreshness;
  safeNextAction: string | null;
  receiptRef: string | null;
  evidenceRef: string | null;
}

export interface OperationalActivityItem {
  id: string;
  eventType: string;
  occurredAt: string;
  severity: OperationalSeverity;
  domain: string;
  entityRef: string | null;
  status: string;
  summary: string;
  source: string;
  receiptRef: string | null;
}

export interface OperationalActiveWorkItem {
  id: string;
  domain: string;
  consumer: string;
  specialist: string;
  capabilityRoute: string;
  state: OperationalState;
  primaryOwner: string;
  currentStage: string;
  progress: number | null;
  nextAction: string;
  gateState: OperationalState;
  continuationState: OperationalState;
  startedAt: string | null;
  updatedAt: string | null;
  taskRef: string;
  evidenceRef: string | null;
}

export interface OperationalPostureSummary {
  itemCount: number;
  currentCount: number;
  attentionCount: number;
  summary: string;
}

export interface OperationalSnapshotDataSources {
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
}

export interface OperationalSnapshot {
  contract: typeof OPERATIONAL_SNAPSHOT_CONTRACT;
  version: 1;
  snapshotId: string;
  generatedAt: string;
  sourceRevision: string | null;
  overall: OperationalSnapshotSection<{
    summary: string;
    attentionCount: number;
    activeWorkCount: number;
  }>;
  sections: {
    attention: OperationalSnapshotSection<{ items: OperationalAttentionItem[] }>;
    activeWork: OperationalSnapshotSection<{ items: OperationalActiveWorkItem[] }>;
    activity: OperationalSnapshotSection<{ items: OperationalActivityItem[] }>;
    brain: OperationalSnapshotSection<OperationalPostureSummary & { runtimeStatus: string; executionEnabled: boolean }>;
    computer: OperationalSnapshotSection<OperationalPostureSummary & { resourceCount: number; activeIncidents: number; staleResources: number; failedBackups: number }>;
    scheduler: OperationalSnapshotSection<OperationalPostureSummary & { totalJobs: number; runningJobs: number; failedJobs: number; blockedJobs: number; nextRunAt: string | null }>;
    index: OperationalSnapshotSection<OperationalPostureSummary & { sources: Array<{ id: string; state: OperationalState; generatedAt: string | null }> }>;
    consumers: OperationalSnapshotSection<OperationalPostureSummary & { domains: string[] }>;
    identity: OperationalSnapshotSection<DeploymentIdentity>;
  };
  dataSources: OperationalSnapshotDataSources;
  errors: OperationalSnapshotFailure[];
  safety: {
    readOnly: true;
    writesToMind: false;
    executionEnabled: false;
    externalMutations: false;
  };
}

export interface OperationalSnapshotSourceInputs {
  status: BrainCoreStatus;
  capabilities: BrainCoreCapabilitySummary;
  identity: DeploymentIdentity;
  scheduler: unknown;
  localApps: unknown;
  computer: unknown;
  machineTelemetry?: unknown;
  graphify: unknown;
  runtimeReports: BrainCoreRuntimeReportSummary[];
  infiniteBrain: unknown;
  activeWork: BrainCoreAgentRunSummary[];
  activity: BrainCoreAgentEventSummary[];
  sourceErrors?: Array<{ source: string; error: OperationalSnapshotFailure; optional?: boolean }>;
  generatedAt?: string;
  snapshotId?: string;
}

export type OperationalSnapshotLoader = () => unknown | Promise<unknown>;

export interface OperationalSnapshotLoaders {
  scheduler: OperationalSnapshotLoader;
  localApps: OperationalSnapshotLoader;
  computer: OperationalSnapshotLoader;
  machineTelemetry?: OperationalSnapshotLoader;
  graphify: OperationalSnapshotLoader;
  runtimeReports: OperationalSnapshotLoader;
  infiniteBrain: OperationalSnapshotLoader;
  activeWork: OperationalSnapshotLoader;
  activity: OperationalSnapshotLoader;
}

export interface OperationalSnapshotInputLoaders {
  status: () => BrainCoreStatus;
  capabilities: () => BrainCoreCapabilitySummary;
  identity: () => DeploymentIdentity;
  sources: OperationalSnapshotLoaders;
}
