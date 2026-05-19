import type {
  BrainCoreProBotLocalAppsParityResponse,
  BrainCoreProBotParityFeature,
} from '../types/api.js';

const features: BrainCoreProBotParityFeature[] = [
  {
    id: 'local-apps-status',
    label: 'Local Apps Status',
    probotTab: 'Local Apps',
    brainConsoleSection: 'apps',
    migrationDecision: 'keep',
    migrationStatus: 'available',
    safeDataAvailable: true,
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    relatedBrainCoreEndpoints: ['/local-apps'],
    blockedReason: null,
    nextSafeStep: 'Add app health indicators, uptime tracking, and log tail access without start/stop controls.',
  },
];

export function readProBotLocalAppsParity(): BrainCoreProBotLocalAppsParityResponse {
  const availableCount = features.filter(f => f.migrationStatus === 'available').length;
  const partialCount = features.filter(f => f.migrationStatus === 'partial').length;
  const missingCount = features.filter(f => f.migrationStatus === 'missing').length;
  const legacyOnlyCount = features.filter(f => f.migrationStatus === 'legacy-only').length;
  const blockedCount = features.filter(f => f.migrationStatus === 'blocked').length;
  const visibleCount = features.filter(f => f.visibleInBrainConsole).length;
  const workingCount = features.filter(f => f.workingInBrainConsole).length;

  return {
    id: 'probot-local-apps-parity',
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
    nextSafeStep: 'Expand local app metadata: git branch, last deploy, runtime errors, dependency versions.',
  };
}
