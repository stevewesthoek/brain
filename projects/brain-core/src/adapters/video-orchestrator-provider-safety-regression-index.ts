import type {
  BrainCoreVideoProviderSafetyRegressionIndex,
  BrainCoreVideoProviderSafetyRegressionIndexResponse,
} from '../types/api.js';

const indexedModules = [
  'provider-request-wrapper-scaffold',
  'provider-wrapper-validation-harness',
  'credential-reference-scaffold',
  'provider-request-envelope-scaffold',
  'provider-response-envelope-scaffold',
  'provider-request-wrapper-inert-shell',
  'credential-reference-validator',
  'provider-response-redaction-skeleton',
  'provider-audit-event-types',
  'provider-disabled-orchestration-facade',
  'provider-capability-policy-evaluator',
  'provider-blocked-action-ledger-types',
  'provider-blocked-action-recorder-skeleton',
];

const forbiddenPatterns = [
  'fetch(',
  'axios',
  'requestUrl',
  'process.env',
  'child_process',
  'exec(',
  'spawn(',
  'writeFile',
  'appendFile',
  'createWriteStream',
];

const forbiddenCapabilities = [
  'provider calls',
  'credential access',
  'env reads',
  'network access',
  'prompt generation',
  'image generation',
  'raw output access',
  'artifact writes',
  'audit persistence',
  'ledger persistence',
  'POST routes',
  'Brain Console mutation controls',
  'publishing',
  'decommissioning',
];

const expectedDisabledFlags = [
  'providerCallsEnabled: false',
  'credentialAccessEnabled: false',
  'envReadEnabled: false',
  'networkAccessEnabled: false',
  'promptGenerationEnabled: false',
  'imageGenerationEnabled: false',
  'rawProviderOutputAccessEnabled: false',
  'artifactPersistenceEnabled: false',
  'auditPersistenceEnabled: false',
  'ledgerPersistenceEnabled: false',
  'postRoutesAdded: false',
  'brainConsoleMutationControlsEnabled: false',
];

const safety: BrainCoreVideoProviderSafetyRegressionIndex['safety'] = {
  readOnlyStatusEndpoint: true,
  regressionIndexOnly: true,
  scanExecutionEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  rawProviderOutputAccessEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  ledgerPersistenceEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

const blockers = [
  'All forbidden patterns must remain absent in provider scaffolds',
  'All forbidden capabilities must remain disabled',
  'All expected disabled flags must remain false',
  'Scan execution disabled to prevent false positives',
];

export function readVideoProviderSafetyRegressionIndex(): BrainCoreVideoProviderSafetyRegressionIndexResponse {
  return {
    index: {
      id: 'video-orchestrator-provider-safety-regression-index',
      status: 'scaffolded-disabled',
      phase: 'provider-safety-regression-index',
      indexedModules,
      forbiddenPatterns,
      forbiddenCapabilities,
      expectedDisabledFlags,
      summary: {
        indexedModuleCount: indexedModules.length,
        forbiddenPatternCount: 10,
        forbiddenCapabilityCount: 14,
        expectedDisabledFlagCount: expectedDisabledFlags.length,
        expectedProviderCallCount: 0,
        expectedCredentialAccessCount: 0,
        expectedNetworkAccessCount: 0,
        expectedWriteCount: 0,
      },
      safety,
      blockers,
      nextSafeStep: 'Maintain safety regression index; automated scans to verify no forbidden patterns in future phases.',
    },
  };
}
