import type {
  BrainCoreVideoPromptReviewUxImplementationPlan,
  BrainCoreVideoPromptReviewUxImplementationPlanEntry,
  BrainCoreVideoPromptReviewUxImplementationPlanResponse,
} from '../types/api.js';

const proposedReviewStates = [
  'not_loaded',
  'draft_preview',
  'awaiting_operator_review',
  'changes_requested',
  'blocked_by_policy',
  'approved_for_future_provider_request',
] as const;

const proposedReadOnlyFields = [
  'providerClass',
  'sourcePlanId',
  'promptReviewPolicyId',
  'credentialIsolationPlanId',
  'outputRedactionPolicyId',
  'complianceChecklistId',
  'safetySummary',
  'blockerSummary',
  'auditRefPlaceholder',
] as const;

const proposedFutureEditableFields = [
  'operatorRationale',
  'promptAdjustmentNotes',
  'riskAcknowledgement',
  'expirationWindowSelection',
] as const;

const prohibitedControls = [
  'approve prompt button',
  'call provider button',
  'generate image button',
  'render layout button',
  'publish button',
  'write to Mind button',
  'export artifact button',
  'decommission STB button',
  'raw credential reveal button',
  'raw prompt copy button',
] as const;

const requiredGuardrails = [
  'no mutation controls in this phase',
  'no provider calls from UI',
  'no raw credentials in UI',
  'no raw prompt persistence',
  'no platform write controls',
  'no Mind write controls',
  'no STB mutation controls',
  'explicit confirmation required before any future approval',
  'all future edits must be audited',
  'stale prompt previews must be invalidated before provider use',
] as const;

const safety: BrainCoreVideoPromptReviewUxImplementationPlanEntry['safety'] = {
  readOnly: true,
  implementationPlanOnly: true,
  promptReviewUxImplemented: false,
  editableUiEnabled: false,
  mutationControlsEnabled: false,
  approvalButtonsEnabled: false,
  promptApprovalEnabled: false,
  promptPersistenceEnabled: false,
  providerCallButtonsEnabled: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  rawCredentialDisplayEnabled: false,
  rawPromptCopyEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoPromptReviewUxImplementationPlanEntry, 'safety'>,
): BrainCoreVideoPromptReviewUxImplementationPlanEntry {
  return { ...input, safety };
}

export function readVideoPromptReviewUxImplementationPlan(): BrainCoreVideoPromptReviewUxImplementationPlanResponse {
  const entries: BrainCoreVideoPromptReviewUxImplementationPlanEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      implementationPlanOnly: true,
      uxPurpose: 'Define a future read-only prompt review UX for image-generation with no approval controls in this phase.',
      proposedReviewStates: [...proposedReviewStates],
      proposedReadOnlyFields: [...proposedReadOnlyFields],
      proposedFutureEditableFields: [...proposedFutureEditableFields],
      prohibitedControls: [...prohibitedControls],
      requiredGuardrails: [...requiredGuardrails],
      operatorConfirmationCopy: 'This view remains read-only until explicit approval introduces future editing and approval controls.',
      auditRequirements: [
        'Audit future edits only after approval.',
        'No prompt persistence in this phase.',
        'Audit references remain placeholders only.',
      ],
      failureModes: [
        'missing approval',
        'attempted mutation',
        'provider call surfaced from UI',
        'raw credential exposure',
        'raw prompt persistence attempt',
        'stale preview',
      ],
      requiredPreImplementationApprovals: [
        'prompt review UX implementation approval',
        'provider request wrapper approval',
        'credential isolation boundary approval',
        'output redaction approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'no editable UI',
        'no approval buttons',
        'no provider calls',
      ],
      firstSafeImplementationSlice: 'Start with a read-only review state renderer only after explicit approval.',
      nextSafeStep: 'Keep the prompt review UX as a plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      implementationPlanOnly: true,
      uxPurpose: 'Define a future read-only prompt review UX for layout-rendering with no approval controls in this phase.',
      proposedReviewStates: [...proposedReviewStates],
      proposedReadOnlyFields: [...proposedReadOnlyFields],
      proposedFutureEditableFields: [...proposedFutureEditableFields],
      prohibitedControls: [...prohibitedControls],
      requiredGuardrails: [...requiredGuardrails],
      operatorConfirmationCopy: 'This view remains read-only until explicit approval introduces future editing and approval controls.',
      auditRequirements: [
        'Audit future edits only after approval.',
        'No prompt persistence in this phase.',
        'Audit references remain placeholders only.',
      ],
      failureModes: [
        'missing approval',
        'attempted mutation',
        'provider call surfaced from UI',
        'raw credential exposure',
        'raw prompt persistence attempt',
        'stale preview',
      ],
      requiredPreImplementationApprovals: [
        'prompt review UX implementation approval',
        'provider request wrapper approval',
        'credential isolation boundary approval',
        'output redaction approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'no editable UI',
        'no approval buttons',
        'no provider calls',
      ],
      firstSafeImplementationSlice: 'Start with a read-only review state renderer only after explicit approval.',
      nextSafeStep: 'Keep the prompt review UX as a plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      implementationPlanOnly: true,
      uxPurpose: 'Define a future read-only prompt review UX for brand-compliance with no approval controls in this phase.',
      proposedReviewStates: [...proposedReviewStates],
      proposedReadOnlyFields: [...proposedReadOnlyFields],
      proposedFutureEditableFields: [...proposedFutureEditableFields],
      prohibitedControls: [...prohibitedControls],
      requiredGuardrails: [...requiredGuardrails],
      operatorConfirmationCopy: 'This view remains read-only until explicit approval introduces future editing and approval controls.',
      auditRequirements: [
        'Audit future edits only after approval.',
        'No prompt persistence in this phase.',
        'Audit references remain placeholders only.',
      ],
      failureModes: [
        'missing approval',
        'attempted mutation',
        'provider call surfaced from UI',
        'raw credential exposure',
        'raw prompt persistence attempt',
        'stale preview',
      ],
      requiredPreImplementationApprovals: [
        'prompt review UX implementation approval',
        'provider request wrapper approval',
        'credential isolation boundary approval',
        'output redaction approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'no editable UI',
        'no approval buttons',
        'no provider calls',
      ],
      firstSafeImplementationSlice: 'Start with a read-only review state renderer only after explicit approval.',
      nextSafeStep: 'Keep the prompt review UX as a plan only until explicit implementation approval is granted.',
    }),
  ];

  const planCount: 3 = 3;
  const blockedCount: 3 = 3;
  const implementationPlanOnlyCount: 3 = 3;
  const editableUiEnabledCount: 0 = 0;
  const promptApprovalEnabledCount: 0 = 0;
  const providerCallButtonCount: 0 = 0;
  const promptPersistedCount: 0 = 0;

  const plan: BrainCoreVideoPromptReviewUxImplementationPlan = {
    id: 'video-orchestrator-prompt-review-ux-implementation-plan',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    planCount,
    blockedCount,
    implementationPlanOnlyCount,
    editableUiEnabledCount,
    promptApprovalEnabledCount,
    providerCallButtonCount,
    promptPersistedCount,
    entries,
    summary: {
      planCount,
      blockedCount,
      implementationPlanOnlyCount,
      editableUiEnabledCount,
      promptApprovalEnabledCount,
      providerCallButtonCount,
      promptPersistedCount,
    },
    blockers: entries.flatMap(entry => entry.implementationBlockers),
    nextSafeStep: 'Keep the prompt review UX as a plan only until explicit implementation approval is granted.',
    safety,
  };

  return { plan };
}

export function readVideoPromptReviewUxImplementationPlanEntry(providerClass: string): BrainCoreVideoPromptReviewUxImplementationPlanEntry | undefined {
  return readVideoPromptReviewUxImplementationPlan().plan.entries.find(entry => entry.providerClass === providerClass);
}
