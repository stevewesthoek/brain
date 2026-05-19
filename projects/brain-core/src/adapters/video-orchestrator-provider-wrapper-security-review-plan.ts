import type {
  BrainCoreVideoProviderWrapperSecurityReviewPlan,
  BrainCoreVideoProviderWrapperSecurityReviewPlanEntry,
  BrainCoreVideoProviderWrapperSecurityReviewPlanResponse,
} from '../types/api.js';

const threatCategories = [
  'credential exfiltration',
  'prompt injection',
  'path traversal',
  'arbitrary command execution',
  'unsafe network egress',
  'raw provider output leakage',
  'artifact sandbox escape',
  'audit tampering',
  'approval bypass',
  'publishing bypass',
  'STB mutation',
  'Mind vault mutation',
] as const;

const requiredEvidence = [
  'provider request wrapper implementation plan reviewed',
  'credential store implementation boundary reviewed',
  'prompt review UX implementation plan reviewed',
  'provider audit persistence boundary reviewed',
  'output redaction policy reviewed',
  'artifact sandbox handoff plan reviewed',
  'compliance checklist reviewed',
  'final planning checkpoint reviewed',
] as const;

const prohibitedImplementationPatterns = [
  'dynamic shell execution',
  'arbitrary command input',
  'raw token logging',
  'raw provider response logging',
  'direct .env reads',
  'filesystem credential discovery',
  'unbounded network egress',
  'provider calls without approval',
  'artifact writes outside sandbox',
  'Mind vault writes',
  'STB artifact mutation',
  'publishing from provider response',
] as const;

const requiredManualReviewChecks = [
  'confirm no raw secrets in code or tests',
  'confirm no provider call path is enabled',
  'confirm no POST route was added',
  'confirm no mutation control was added to Brain Console',
  'confirm every future provider call has approval gate',
  'confirm output redaction happens before persistence',
  'confirm audit persistence remains disabled until explicitly approved',
] as const;

const requiredAutomatedReviewChecks = [
  'TypeScript typecheck',
  'Brain Core CI',
  'Brain Console typecheck',
  'Brain Console build',
  'forbidden secret material scan',
  'forbidden runtime execution scan',
  'forbidden upload/network pattern scan',
  'route surface review',
] as const;

const safety: BrainCoreVideoProviderWrapperSecurityReviewPlanEntry['safety'] = {
  readOnly: true,
  securityReviewPlanOnly: true,
  securityReviewCompleted: false,
  providerImplementationApproved: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  rawProviderOutputAccessEnabled: false,
  securityScanExecutionEnabled: false,
  automatedReviewExecutionEnabled: false,
  networkAccessEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoProviderWrapperSecurityReviewPlanEntry, 'safety'>,
): BrainCoreVideoProviderWrapperSecurityReviewPlanEntry {
  return { ...input, safety };
}

export function readVideoProviderWrapperSecurityReviewPlan(): BrainCoreVideoProviderWrapperSecurityReviewPlanResponse {
  const entries: BrainCoreVideoProviderWrapperSecurityReviewPlanEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      implementationBoundaryOnly: true,
      securityReviewPlanOnly: true,
      reviewPurpose: 'Define the security review scope required before image-generation provider wrapper implementation can begin.',
      threatCategories: [...threatCategories],
      requiredEvidence: [...requiredEvidence],
      prohibitedImplementationPatterns: [...prohibitedImplementationPatterns],
      requiredManualReviewChecks: [...requiredManualReviewChecks],
      requiredAutomatedReviewChecks: [...requiredAutomatedReviewChecks],
      approvalGates: [
        'security review completion',
        'provider implementation start approval',
        'wrapper security sign-off',
      ],
      blockers: [
        'security review is not complete',
        'provider implementation is not approved',
        'no wrapper implementation gate exists',
      ],
      nextSafeStep: 'Keep the wrapper security review as a plan only until security review completion and implementation start approval are granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      implementationBoundaryOnly: true,
      securityReviewPlanOnly: true,
      reviewPurpose: 'Define the security review scope required before layout-rendering provider wrapper implementation can begin.',
      threatCategories: [...threatCategories],
      requiredEvidence: [...requiredEvidence],
      prohibitedImplementationPatterns: [...prohibitedImplementationPatterns],
      requiredManualReviewChecks: [...requiredManualReviewChecks],
      requiredAutomatedReviewChecks: [...requiredAutomatedReviewChecks],
      approvalGates: [
        'security review completion',
        'provider implementation start approval',
        'wrapper security sign-off',
      ],
      blockers: [
        'security review is not complete',
        'provider implementation is not approved',
        'no wrapper implementation gate exists',
      ],
      nextSafeStep: 'Keep the wrapper security review as a plan only until security review completion and implementation start approval are granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      implementationBoundaryOnly: true,
      securityReviewPlanOnly: true,
      reviewPurpose: 'Define the security review scope required before brand-compliance provider wrapper implementation can begin.',
      threatCategories: [...threatCategories],
      requiredEvidence: [...requiredEvidence],
      prohibitedImplementationPatterns: [...prohibitedImplementationPatterns],
      requiredManualReviewChecks: [...requiredManualReviewChecks],
      requiredAutomatedReviewChecks: [...requiredAutomatedReviewChecks],
      approvalGates: [
        'security review completion',
        'provider implementation start approval',
        'wrapper security sign-off',
      ],
      blockers: [
        'security review is not complete',
        'provider implementation is not approved',
        'no wrapper implementation gate exists',
      ],
      nextSafeStep: 'Keep the wrapper security review as a plan only until security review completion and implementation start approval are granted.',
    }),
  ];

  const reviewPlanCount: 3 = 3;
  const blockedCount: 3 = 3;
  const securityReviewCompletedCount: 0 = 0;
  const providerImplementationApprovedCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const mutationControlCount: 0 = 0;
  const postRouteCount: 0 = 0;

  const plan: BrainCoreVideoProviderWrapperSecurityReviewPlan = {
    id: 'video-orchestrator-provider-wrapper-security-review-plan',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    reviewPlanCount,
    blockedCount,
    securityReviewCompletedCount,
    providerImplementationApprovedCount,
    providerCallCount,
    mutationControlCount,
    postRouteCount,
    entries,
    summary: {
      reviewPlanCount,
      blockedCount,
      securityReviewCompletedCount,
      providerImplementationApprovedCount,
      providerCallCount,
      mutationControlCount,
      postRouteCount,
    },
    blockers: entries.flatMap((entry) => entry.blockers),
    nextSafeStep: 'Keep the provider wrapper security review as a plan only until explicit implementation approval is granted.',
    safety,
  };

  return { plan };
}

export function readVideoProviderWrapperSecurityReviewPlanEntry(providerClass: string): BrainCoreVideoProviderWrapperSecurityReviewPlanEntry | undefined {
  return readVideoProviderWrapperSecurityReviewPlan().plan.entries.find((entry) => entry.providerClass === providerClass);
}
