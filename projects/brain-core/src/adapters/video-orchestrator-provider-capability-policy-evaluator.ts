import type {
  BrainCoreVideoProviderCapabilityPolicy,
  BrainCoreVideoProviderCapabilityPolicyEvaluator,
  BrainCoreVideoProviderCapabilityPolicyEvaluatorResponse,
} from '../types/api.js';

const allCapabilities = [
  'provider-call',
  'credential-access',
  'env-read',
  'network-access',
  'prompt-generation',
  'image-generation',
  'raw-output-access',
  'artifact-write',
  'audit-persist',
  'brain-console-mutation-control',
  'post-route',
  'publishing',
  'decommissioning',
] as const;

const safety: BrainCoreVideoProviderCapabilityPolicyEvaluator['safety'] = {
  readOnlyStatusEndpoint: true,
  purePolicyEvaluatorOnly: true,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  rawProviderOutputAccessEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  mutationControlsEnabled: false,
  postRoutesAdded: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

export function evaluateVideoProviderCapabilityPolicy(
  capability: (typeof allCapabilities)[number],
): BrainCoreVideoProviderCapabilityPolicy {
  const reasonMap: Record<string, string> = {
    'provider-call': 'Provider calls blocked in wrapper-scaffolding-only phase',
    'credential-access': 'Credential access blocked in wrapper-scaffolding-only phase',
    'env-read': 'Environment variable reads blocked in wrapper-scaffolding-only phase',
    'network-access': 'Network access blocked in wrapper-scaffolding-only phase',
    'prompt-generation': 'Prompt generation blocked in wrapper-scaffolding-only phase',
    'image-generation': 'Image generation blocked in wrapper-scaffolding-only phase',
    'raw-output-access': 'Raw provider output access blocked in wrapper-scaffolding-only phase',
    'artifact-write': 'Artifact writes blocked in wrapper-scaffolding-only phase',
    'audit-persist': 'Audit persistence blocked in wrapper-scaffolding-only phase',
    'brain-console-mutation-control':
      'Brain Console mutation controls blocked in wrapper-scaffolding-only phase',
    'post-route': 'POST routes blocked in wrapper-scaffolding-only phase',
    publishing: 'Publishing blocked in wrapper-scaffolding-only phase',
    decommissioning: 'Decommissioning blocked in wrapper-scaffolding-only phase',
  };

  return {
    capability,
    allowed: false,
    reason: reasonMap[capability] || 'Capability blocked in wrapper-scaffolding-only phase',
    requiresExplicitApproval: true,
  };
}

export function readVideoProviderCapabilityPolicyEvaluatorStatus(): BrainCoreVideoProviderCapabilityPolicyEvaluatorResponse {
  const capabilities = allCapabilities.map((cap) => evaluateVideoProviderCapabilityPolicy(cap));

  const evaluator: BrainCoreVideoProviderCapabilityPolicyEvaluator = {
    id: 'video-orchestrator-provider-capability-policy-evaluator',
    status: 'facade-disabled',
    phase: 'provider-capability-policy-evaluator',
    capabilities,
    summary: {
      evaluatorCount: 1,
      capabilityCount: allCapabilities.length,
      allowedCapabilityCount: 0,
      deniedCapabilityCount: allCapabilities.length,
      providerCallAllowedCount: 0,
      credentialAccessAllowedCount: 0,
      networkAccessAllowedCount: 0,
    },
    safety,
    nextSafeStep: 'Keep all risky capabilities denied; await explicit approval before enabling any capability.',
  };

  return { evaluator };
}
