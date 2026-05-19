import type {
  BrainCoreVideoProviderFixtureOrchestrationTestsSummary,
  BrainCoreVideoProviderFixtureOrchestrationTestsSummaryResponse,
} from '../types/api.js';

const fixtureSuites = [
  'disabled-facade-fixtures',
  'capability-policy-fixtures',
  'blocked-action-recorder-fixtures',
  'credential-reference-fixtures',
  'response-redaction-fixtures',
  'request-envelope-fixtures',
  'response-envelope-fixtures',
];

const safety: BrainCoreVideoProviderFixtureOrchestrationTestsSummary['safety'] = {
  readOnlyStatusEndpoint: true,
  fixtureSummaryOnly: true,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
  networkAccessEnabled: false,
  persistenceEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

const blockers = [
  'All fixture suites contain pure/static data only',
  'No provider calls in any fixtures',
  'No network access required for fixture execution',
  'No persistence from fixture results',
];

export function readVideoProviderFixtureOrchestrationTestsSummary(): BrainCoreVideoProviderFixtureOrchestrationTestsSummaryResponse {
  const fixtureCountPerSuite = 12; // default from blocked-action-recorder

  return {
    summary: {
      id: 'video-orchestrator-provider-fixture-orchestration-tests-summary',
      status: 'scaffolded-disabled',
      phase: 'provider-fixture-orchestration-tests-summary',
      fixtureSuites,
      summary: {
        fixtureSuiteCount: fixtureSuites.length,
        fixtureCount: fixtureSuites.length * fixtureCountPerSuite,
        passedFixtureCount: 0,
        blockedFixtureCount: fixtureSuites.length * fixtureCountPerSuite,
        providerCallCount: 0,
        credentialAccessCount: 0,
        networkAccessCount: 0,
        persistenceCount: 0,
      },
      safety,
      blockers,
      nextSafeStep: 'Expand fixture suites with provider-specific test cases; maintain zero provider calls and persistence.',
    },
  };
}
