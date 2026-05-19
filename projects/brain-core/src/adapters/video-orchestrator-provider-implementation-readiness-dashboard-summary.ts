import type {
  BrainCoreVideoProviderImplementationReadinessDashboardSummary,
  BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry,
  BrainCoreVideoProviderImplementationReadinessDashboardSummaryResponse,
} from '../types/api.js';

const dashboardHighlights = [
  'provider planning surfaces complete',
  'credential access remains disabled',
  'provider calls remain disabled',
  'Brain Console controls remain read-only',
  'implementation requires explicit approval',
  'first possible implementation slice is wrapper scaffolding only',
] as const;

const operatorWarnings = [
  'do not enable providers from this dashboard',
  'do not add credentials yet',
  'do not call providers yet',
  'do not enable prompt generation yet',
  'do not enable artifact writes yet',
  'do not enable audit persistence yet',
  'do not add mutation controls yet',
] as const;

const safety: BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry['safety'] = {
  readOnly: true,
  dashboardSummaryOnly: true,
  planningComplete: true,
  implementationApproved: false,
  implementationEligible: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  complianceEvaluationEnabled: false,
  mutationControlsEnabled: false,
  approvalButtonsEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry, 'safety'>,
): BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry {
  return { ...input, safety };
}

export function readVideoProviderImplementationReadinessDashboardSummary(): BrainCoreVideoProviderImplementationReadinessDashboardSummaryResponse {
  const entries: BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      planningComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      planningSurfaceCount: 13,
      completedPlanningSurfaceCount: 13,
      blockedGateCount: 3,
      remainingApprovalCount: 7,
      dashboardHighlights: [...dashboardHighlights],
      operatorWarnings: [...operatorWarnings],
      nextSafeStep: 'Keep the dashboard read-only until explicit approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      planningComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      planningSurfaceCount: 13,
      completedPlanningSurfaceCount: 13,
      blockedGateCount: 3,
      remainingApprovalCount: 7,
      dashboardHighlights: [...dashboardHighlights],
      operatorWarnings: [...operatorWarnings],
      nextSafeStep: 'Keep the dashboard read-only until explicit approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      planningComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      planningSurfaceCount: 13,
      completedPlanningSurfaceCount: 13,
      blockedGateCount: 3,
      remainingApprovalCount: 7,
      dashboardHighlights: [...dashboardHighlights],
      operatorWarnings: [...operatorWarnings],
      nextSafeStep: 'Keep the dashboard read-only until explicit approval is granted.',
    }),
  ];

  const providerClassCount: 3 = 3;
  const planningCompleteCount: 3 = 3;
  const implementationApprovedCount: 0 = 0;
  const implementationEligibleCount: 0 = 0;
  const blockedGateCount: 3 = 3;
  const providerConfiguredCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const credentialAccessCount: 0 = 0;
  const mutationControlCount: 0 = 0;

  const dashboard: BrainCoreVideoProviderImplementationReadinessDashboardSummary = {
    id: 'video-orchestrator-provider-implementation-readiness-dashboard-summary',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    providerClassCount,
    planningCompleteCount,
    implementationApprovedCount,
    implementationEligibleCount,
    blockedGateCount,
    providerConfiguredCount,
    providerCallCount,
    credentialAccessCount,
    mutationControlCount,
    entries,
    summary: {
      providerClassCount,
      planningCompleteCount,
      implementationApprovedCount,
      implementationEligibleCount,
      blockedGateCount,
      providerConfiguredCount,
      providerCallCount,
      credentialAccessCount,
      mutationControlCount,
    },
    blockers: entries.flatMap((entry) => [
      ...entry.operatorWarnings,
      'implementation remains blocked until explicit approval',
    ]),
    nextSafeStep: 'Await explicit approval before provider implementation. First implementation phase should be provider request wrapper scaffolding only, still no provider calls.',
    safety,
  };

  return { dashboard };
}

export function readVideoProviderImplementationReadinessDashboardSummaryEntry(providerClass: string): BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry | undefined {
  return readVideoProviderImplementationReadinessDashboardSummary().dashboard.entries.find((entry) => entry.providerClass === providerClass);
}
