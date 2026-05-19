import type {
  BrainCoreProBotSessionsParityResponse,
  BrainCoreProBotParityFeature,
} from '../types/api.js';

const features: BrainCoreProBotParityFeature[] = [
  {
    id: 'sessions-continuations',
    label: 'Sessions & Continuations',
    probotTab: 'Sessions',
    brainConsoleSection: 'overview',
    migrationDecision: 'keep',
    migrationStatus: 'available',
    safeDataAvailable: true,
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    relatedBrainCoreEndpoints: ['/sessions', '/repos', '/skills'],
    blockedReason: null,
    nextSafeStep: 'Display recent sessions in Overview with tool badges and continuation support.',
  },
];

export function readProBotSessionsParity(): BrainCoreProBotSessionsParityResponse {
  const availableCount = features.filter(f => f.migrationStatus === 'available').length;
  const partialCount = features.filter(f => f.migrationStatus === 'partial').length;
  const missingCount = features.filter(f => f.migrationStatus === 'missing').length;
  const legacyOnlyCount = features.filter(f => f.migrationStatus === 'legacy-only').length;
  const blockedCount = features.filter(f => f.migrationStatus === 'blocked').length;
  const visibleCount = features.filter(f => f.visibleInBrainConsole).length;
  const workingCount = features.filter(f => f.workingInBrainConsole).length;

  return {
    id: 'probot-sessions-parity',
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
      exposesGoogleAdsSpendData: false,
      exposesAccountIds: false,
      exposesRawLogs: false,
      mutationControlsEnabled: false,
      shellExecutionEnabled: false,
      platformWritesEnabled: false,
      mindWritesEnabled: false,
      publishingEnabled: false,
      decommissionEnabled: false,
    },
    nextSafeStep: 'Add click-through continuation support and recent session filtering by tool type.',
  };
}
