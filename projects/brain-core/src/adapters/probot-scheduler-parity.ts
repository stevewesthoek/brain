import type {
  BrainCoreProBotSchedulerParityResponse,
  BrainCoreProBotParityFeature,
} from '../types/api.js';

const features: BrainCoreProBotParityFeature[] = [
  {
    id: 'scheduler-status',
    label: 'Scheduler Status',
    probotTab: 'Scheduler',
    brainConsoleSection: 'apps',
    migrationDecision: 'keep',
    migrationStatus: 'available',
    safeDataAvailable: true,
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    relatedBrainCoreEndpoints: ['/scheduler/status', '/scheduler/jobs'],
    blockedReason: null,
    nextSafeStep: 'Add scheduled job history, upcoming runs, and failure diagnostics in read-only mode.',
  },
];

export function readProBotSchedulerParity(): BrainCoreProBotSchedulerParityResponse {
  const availableCount = features.filter(f => f.migrationStatus === 'available').length;
  const partialCount = features.filter(f => f.migrationStatus === 'partial').length;
  const missingCount = features.filter(f => f.migrationStatus === 'missing').length;
  const legacyOnlyCount = features.filter(f => f.migrationStatus === 'legacy-only').length;
  const blockedCount = features.filter(f => f.migrationStatus === 'blocked').length;
  const visibleCount = features.filter(f => f.visibleInBrainConsole).length;
  const workingCount = features.filter(f => f.workingInBrainConsole).length;

  return {
    id: 'probot-scheduler-parity',
    source: 'probot',
    target: 'brain-console',
    status: 'available',
    migrationStatus: 'available',
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    legacyOnly: false,
    featureCount: features.length,
    features,
    summary: {
      availableCount,
      partialCount,
      missingCount,
      legacyOnlyCount,
      blockedCount,
      visibleCount,
      workingCount,
    },
    blockers: [],
    safety: {
      readOnly: true,
      exposesSecrets: false,
      exposesCredentials: false,
      exposesOAuth: false,
      exposesStripeFinancialData: false,
      exposesRawLogs: false,
      mutationControlsEnabled: false,
      shellExecutionEnabled: false,
      platformWritesEnabled: false,
      mindWritesEnabled: false,
      publishingEnabled: false,
      decommissionEnabled: false,
    },
    nextSafeStep: 'Add job category filtering and real-time failure notifications without execution controls.',
  };
}
