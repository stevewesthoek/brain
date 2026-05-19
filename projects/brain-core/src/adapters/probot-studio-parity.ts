import type {
  BrainCoreProBotStudioParityResponse,
  BrainCoreProBotParityFeature,
} from '../types/api.js';

const features: BrainCoreProBotParityFeature[] = [
  {
    id: 'viral-flow-status',
    label: 'Viral Flow',
    probotTab: 'Studio',
    brainConsoleSection: 'posts',
    migrationDecision: 'redesign',
    migrationStatus: 'partial',
    safeDataAvailable: true,
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    relatedBrainCoreEndpoints: ['/post-orchestrator/status', '/post-orchestrator/overview'],
    blockedReason: null,
    nextSafeStep: 'Use Brain Post Orchestrator as canonical instead of legacy product name.',
  },
  {
    id: 'video-orchestrator-status',
    label: 'Video Orchestrator',
    probotTab: 'Studio',
    brainConsoleSection: 'pipelines',
    migrationDecision: 'keep',
    migrationStatus: 'available',
    safeDataAvailable: true,
    visibleInBrainConsole: true,
    workingInBrainConsole: true,
    relatedBrainCoreEndpoints: ['/video-orchestrator/status', '/video/status'],
    blockedReason: null,
    nextSafeStep: 'Ensure account health shows without credentials/OAuth/secrets exposed.',
  },
];

export function readProBotStudioParity(): BrainCoreProBotStudioParityResponse {
  const availableCount = features.filter(f => f.migrationStatus === 'available').length;
  const partialCount = features.filter(f => f.migrationStatus === 'partial').length;
  const missingCount = features.filter(f => f.migrationStatus === 'missing').length;
  const legacyOnlyCount = features.filter(f => f.migrationStatus === 'legacy-only').length;
  const blockedCount = features.filter(f => f.migrationStatus === 'blocked').length;
  const visibleCount = features.filter(f => f.visibleInBrainConsole).length;
  const workingCount = features.filter(f => f.workingInBrainConsole).length;

  return {
    id: 'probot-studio-parity',
    source: 'probot',
    target: 'brain-console',
    status: 'partial',
    migrationStatus: 'partial',
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
    blockers: [
      'Viral Flow still uses legacy product name; should use Brain Post Orchestrator branding.',
    ],
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
    nextSafeStep: 'Unify Studio display under Video Orchestrator + Post Orchestrator branding; no execution buttons.',
  };
}
