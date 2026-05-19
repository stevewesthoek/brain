import type {
  BrainCoreVideoDesignProviderEnablementReadinessIndex,
  BrainCoreVideoDesignProviderEnablementReadinessIndexEntry,
  BrainCoreVideoDesignProviderEnablementReadinessIndexResponse,
} from '../types/api.js';

const requiredPlanningSurfaces = [
  'design-provider-boundary-plan',
  'design-provider-credential-isolation-plan',
  'design-provider-prompt-review-policy-plan',
  'artifact-sandbox-provider-handoff-plan',
  'provider-output-redaction-policy-plan',
  'design-provider-compliance-checklist-plan',
] as const;

const missingImplementationGates = [
  'explicit user approval for provider implementation',
  'approved provider credential store design',
  'approved provider request wrapper implementation',
  'approved artifact sandbox implementation',
  'approved output redaction implementation',
  'approved audit persistence implementation',
  'approved operator review UX',
  'approved rollback/cleanup policy',
  'final security review',
] as const;

const safety: BrainCoreVideoDesignProviderEnablementReadinessIndexEntry['safety'] = {
  readOnly: true,
  readinessIndexOnly: true,
  providerImplementationApproved: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  complianceEvaluationEnabled: false,
  filesystemAccessEnabled: false,
  networkAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoDesignProviderEnablementReadinessIndexEntry, 'safety'>,
): BrainCoreVideoDesignProviderEnablementReadinessIndexEntry {
  return { ...input, safety };
}

export function readVideoDesignProviderEnablementReadinessIndex(): BrainCoreVideoDesignProviderEnablementReadinessIndexResponse {
  const entries: BrainCoreVideoDesignProviderEnablementReadinessIndexEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      readinessPercent: 0,
      requiredPlanningSurfaces: [...requiredPlanningSurfaces],
      completedPlanningSurfaceRefs: [],
      missingImplementationGates: [...missingImplementationGates],
      blockingReasons: [
        'No provider implementation is approved.',
        'No provider credentials may be configured or accessed.',
        'All planning surfaces remain design-only.',
      ],
      nextSafeStep: 'Keep the image-generation provider blocked until the full planning chain and security review are approved.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      readinessPercent: 0,
      requiredPlanningSurfaces: [...requiredPlanningSurfaces],
      completedPlanningSurfaceRefs: [],
      missingImplementationGates: [...missingImplementationGates],
      blockingReasons: [
        'No provider implementation is approved.',
        'No provider requests may be issued.',
        'Artifact and output boundaries remain design-only.',
      ],
      nextSafeStep: 'Keep the layout-rendering provider blocked until all required planning surfaces are approved and implementation gates are explicit.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      readinessPercent: 0,
      requiredPlanningSurfaces: [...requiredPlanningSurfaces],
      completedPlanningSurfaceRefs: [],
      missingImplementationGates: [...missingImplementationGates],
      blockingReasons: [
        'No provider implementation is approved.',
        'Compliance tooling remains design-only.',
        'Audit persistence and review UX are not enabled.',
      ],
      nextSafeStep: 'Keep the brand-compliance provider blocked until the full design-provider planning chain and audit design are approved.',
    }),
  ];

  const providerClassCount: 3 = 3;
  const readyCount: 0 = 0;
  const blockedCount: 3 = 3;
  const providerConfiguredCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const executionEnabledCount: 0 = 0;

  const index: BrainCoreVideoDesignProviderEnablementReadinessIndex = {
    id: 'video-orchestrator-design-provider-enablement-readiness-index',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    readinessPercent: 0,
    providerClassCount,
    blockedCount,
    readyCount,
    averageReadinessPercent: 0,
    providerConfiguredCount,
    providerCallCount,
    executionEnabledCount,
    entries,
    summary: {
      providerClassCount,
      blockedCount,
      readyCount,
      averageReadinessPercent: 0,
      providerConfiguredCount,
      providerCallCount,
      executionEnabledCount,
    },
    blockers: entries.flatMap(entry => entry.blockingReasons),
    nextSafeStep: 'Do not enable any provider implementation until the design-provider planning chain and final security review are approved.',
    safety,
  };

  return { index };
}

export function readVideoDesignProviderEnablementReadinessIndexEntry(providerClass: string): BrainCoreVideoDesignProviderEnablementReadinessIndexEntry | undefined {
  return readVideoDesignProviderEnablementReadinessIndex().index.entries.find(entry => entry.providerClass === providerClass);
}
