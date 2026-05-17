export const MIND_ROUTER_CONTRACT_FILES = [
  'router/current.md',
  'router/map.md',
  'router/rules.md',
  'router/taxonomy.md',
  'router/maintenance.md',
  'router/model-router.md',
] as const;

export const MIND_REQUIRED_PATHS = [
  'HOME.md',
  'TODAY.md',
  'README.md',
  'AGENTS.md',
  'router/',
  'capture/inbox/',
  'capture/daily/',
  'capture/failed/',
  'live/',
  'wiki/',
  'sources/',
  'archive/',
] as const;

export const MIND_LIVE_FILES = [
  'live/dashboard.md',
  'live/tasks.md',
  'live/projects.md',
  'live/workflows.md',
  'live/decisions.md',
] as const;

export const MIND_REQUIRED_INDEX_FILES = [
  'capture/inbox/README.md',
  'capture/daily/README.md',
  'capture/failed/README.md',
  'wiki/index.md',
  'sources/index.md',
  'archive/index.md',
] as const;

export const MIND_LEGACY_READ_ONLY_PATHS = [
  '01-inbox/',
  '02-strategy/',
  '03-projects/',
  '04-tasks/',
  '05-areas/',
  '06-resources/',
  '07-templates/',
  '08-archive/',
] as const;

export type MindRouterJobId =
  | 'mind-compile-loop'
  | 'mind-memory-loop'
  | 'mind-hygiene-loop'
  | 'mind-drift-error-loop';

export type MindRouterMode = 'dry-run' | 'write';

export type MindPathKind = 'file' | 'directory';

export interface MindPathStatus {
  path: string;
  kind: MindPathKind;
  exists: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
}

export type MindSaveToMindTarget = 'legacy-01-inbox' | 'capture-inbox' | 'unknown';

export type MindFailureBufferStatus =
  | 'not-configured'
  | 'folder-only'
  | 'test-verified'
  | 'real-error-verified'
  | 'unknown';

export interface MindContractSnapshot {
  paths: MindPathStatus[];
  saveToMindTarget?: MindSaveToMindTarget;
  liveDeploymentVerified?: boolean;
  failureBufferStatus?: MindFailureBufferStatus;
}

export interface MindRouterJobResult {
  jobId: MindRouterJobId;
  mode: MindRouterMode;
  ok: boolean;
  checkedPaths: string[];
  plannedWrites: string[];
  warnings: string[];
  errors: string[];
}

export interface MindContractDryRunResult extends MindRouterJobResult {
  missingRequiredPaths: string[];
  missingRouterContractFiles: string[];
  missingLiveFiles: string[];
  missingIndexFiles: string[];
  presentLegacyReadOnlyPaths: string[];
  saveToMindTarget: MindContractSnapshot['saveToMindTarget'];
  liveDeploymentVerified: boolean;
  failureBufferStatus: MindFailureBufferStatus;
  failureBufferReadyForArchivePhase: boolean;
}
