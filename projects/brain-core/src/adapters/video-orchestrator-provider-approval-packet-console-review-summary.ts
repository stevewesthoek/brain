import type {
  BrainCoreVideoProviderApprovalPacketConsoleReviewSummary,
  BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry,
  BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryResponse,
} from '../types/api.js';

const reviewHighlights = [
  'approval packet exists',
  'provider planning surfaces complete',
  'first possible implementation is wrapper scaffolding only',
  'provider calls remain blocked',
  'credential access remains blocked',
  'network access remains blocked',
  'Brain Console remains read-only',
] as const;

const reviewWarnings = [
  'this review summary is not approval',
  'no approval record is created',
  'no provider implementation starts',
  'no provider call is allowed',
  'no credential access is allowed',
  'no Brain Console mutation control is rendered',
] as const;

const requiredOperatorAcknowledgements = [
  'I understand provider calls remain blocked',
  'I understand credentials remain inaccessible',
  'I understand wrapper scaffolding must not call providers',
  'I understand Brain Console controls remain read-only',
  'I understand separate explicit approval is required for any implementation transition',
] as const;

const blockedControls = [
  'approve implementation button',
  'call provider button',
  'add credential button',
  'generate image button',
  'render layout button',
  'write artifact button',
  'persist audit button',
  'publish button',
  'decommission STB button',
] as const;

const safety: BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry['safety'] = {
  readOnly: true,
  consoleReviewOnly: true,
  approvalRecordCreated: false,
  implementationApproved: false,
  implementationEligible: false,
  mutationControlsEnabled: false,
  approvalButtonsEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry, 'safety'>,
): BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry {
  return { ...input, safety };
}

export function readVideoProviderApprovalPacketConsoleReviewSummary(): BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryResponse {
  const entries: BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      consoleReviewOnly: true,
      approvalPacketRef: 'video-orchestrator-provider-implementation-approval-packet',
      currentDecision: 'not-approved',
      acceptableNextDecision: 'approve-wrapper-scaffolding-only',
      unacceptableDecisions: [
        'approve-provider-calls',
        'approve-credential-access',
        'approve-generation',
        'approve-publishing',
        'approve-decommissioning',
      ],
      reviewHighlights: [...reviewHighlights],
      reviewWarnings: [...reviewWarnings],
      requiredOperatorAcknowledgements: [...requiredOperatorAcknowledgements],
      blockedControls: [...blockedControls],
      nextSafeStep: 'Keep the console review summary read-only until explicit approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      consoleReviewOnly: true,
      approvalPacketRef: 'video-orchestrator-provider-implementation-approval-packet',
      currentDecision: 'not-approved',
      acceptableNextDecision: 'approve-wrapper-scaffolding-only',
      unacceptableDecisions: [
        'approve-provider-calls',
        'approve-credential-access',
        'approve-generation',
        'approve-publishing',
        'approve-decommissioning',
      ],
      reviewHighlights: [...reviewHighlights],
      reviewWarnings: [...reviewWarnings],
      requiredOperatorAcknowledgements: [...requiredOperatorAcknowledgements],
      blockedControls: [...blockedControls],
      nextSafeStep: 'Keep the console review summary read-only until explicit approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      consoleReviewOnly: true,
      approvalPacketRef: 'video-orchestrator-provider-implementation-approval-packet',
      currentDecision: 'not-approved',
      acceptableNextDecision: 'approve-wrapper-scaffolding-only',
      unacceptableDecisions: [
        'approve-provider-calls',
        'approve-credential-access',
        'approve-generation',
        'approve-publishing',
        'approve-decommissioning',
      ],
      reviewHighlights: [...reviewHighlights],
      reviewWarnings: [...reviewWarnings],
      requiredOperatorAcknowledgements: [...requiredOperatorAcknowledgements],
      blockedControls: [...blockedControls],
      nextSafeStep: 'Keep the console review summary read-only until explicit approval is granted.',
    }),
  ];

  const reviewCount: 3 = 3;
  const decisionRequiredCount: 3 = 3;
  const approvalRecordCreatedCount: 0 = 0;
  const implementationApprovedCount: 0 = 0;
  const implementationEligibleCount: 0 = 0;
  const mutationControlCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const credentialAccessCount: 0 = 0;

  const summary: BrainCoreVideoProviderApprovalPacketConsoleReviewSummary = {
    id: 'video-orchestrator-provider-approval-packet-console-review-summary',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    reviewCount,
    decisionRequiredCount,
    approvalRecordCreatedCount,
    implementationApprovedCount,
    implementationEligibleCount,
    mutationControlCount,
    providerCallCount,
    credentialAccessCount,
    entries,
    summary: {
      reviewCount,
      decisionRequiredCount,
      approvalRecordCreatedCount,
      implementationApprovedCount,
      implementationEligibleCount,
      mutationControlCount,
      providerCallCount,
      credentialAccessCount,
    },
    blockers: [
      'approval record creation is blocked',
      'implementation is not approved',
      'provider calls remain blocked',
      'credentials remain inaccessible',
      'network access remains blocked',
      'Brain Console remains read-only',
    ],
    nextSafeStep: 'Await explicit approval: approve-wrapper-scaffolding-only.',
    safety,
  };

  return { summary };
}

export function readVideoProviderApprovalPacketConsoleReviewSummaryEntry(providerClass: string): BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry | undefined {
  return readVideoProviderApprovalPacketConsoleReviewSummary().summary.entries.find((entry) => entry.providerClass === providerClass);
}
