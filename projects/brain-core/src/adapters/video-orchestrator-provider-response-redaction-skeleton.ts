import type {
  BrainCoreVideoProviderResponseRedactionSkeleton,
  BrainCoreVideoProviderResponseRedactionSkeletonFixtureResult,
  BrainCoreVideoProviderResponseRedactionSkeletonResponse,
} from '../types/api.js';

const fixtureDefinitions = [
  {
    fixtureId: 'provider-response-with-secrets',
    input: {
      requestId: 'req-1',
      providerClass: 'image-generation',
      status: 'ok',
      rawProviderResponse: 'Bearer abc123',
      credentialRefId: 'sk-secret-token',
      artifactPath: '/Users/Office/secret.png',
      mindVaultPath: 'mind/vault/private-note',
      stbArtifactPath: 'stb/artifact/output.mov',
      providerAccountId: 'acct_123456',
      unredactedLog: 'full payload',
    },
    expectedOutcome: 'redacted',
    notes: 'fixture with raw output and secret-like values',
  },
  {
    fixtureId: 'provider-response-with-absolute-paths',
    input: {
      requestId: 'req-2',
      providerClass: 'layout-rendering',
      status: 'blocked',
      summary: 'safe summary',
      outputPath: '/tmp/layout-rendered.svg',
      rawPromptText: 'prompt content',
    },
    expectedOutcome: 'redacted',
    notes: 'fixture with absolute path values',
  },
  {
    fixtureId: 'provider-response-safe-summary',
    input: {
      requestId: 'req-3',
      providerClass: 'brand-compliance',
      status: 'ok',
      redactedSummaryOnly: true,
      outputRedactionPolicyRef: 'policy-ref',
      auditRefPlaceholder: 'audit-ref',
      errorCategoryPlaceholder: 'error-category',
      noRawProviderOutput: true,
    },
    expectedOutcome: 'redacted',
    notes: 'fixture with already redacted output',
  },
] as const;

const safety: BrainCoreVideoProviderResponseRedactionSkeleton['safety'] = {
  readOnlyStatusEndpoint: true,
  pureRedactionSkeletonOnly: true,
  rawProviderOutputAccessEnabled: false,
  redactedManifestCreationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (
      /Bearer\s+/.test(value) ||
      /^sk-[A-Za-z0-9._-]+$/.test(value) ||
      /^ya29\./.test(value) ||
      /BEGIN [A-Z ]+PRIVATE KEY/.test(value) ||
      /^\/[^\s]+/.test(value) ||
      /mind\/vault/i.test(value) ||
      /stb\/artifact/i.test(value) ||
      /acct_[A-Za-z0-9]+/.test(value)
    ) {
      return '[REDACTED]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes('raw') || normalizedKey.includes('secret') || normalizedKey.includes('token') || normalizedKey.includes('key') || normalizedKey.includes('cookie') || normalizedKey.includes('password') || normalizedKey.includes('path') || normalizedKey.includes('vault') || normalizedKey.includes('artifact') || normalizedKey.includes('log')) {
        redacted[key] = '[REDACTED]';
        continue;
      }
      redacted[key] = redactValue(nested);
    }
    return redacted;
  }

  return value;
}

export function redactVideoProviderResponseFixture(input: Record<string, unknown>): Record<string, unknown> & { redactedSummaryOnly: true } {
  const redacted = redactValue(input) as Record<string, unknown>;
  return {
    redactedSummaryOnly: true,
    ...redacted,
  };
}

export function readVideoProviderResponseRedactionSkeletonStatus(): BrainCoreVideoProviderResponseRedactionSkeletonResponse {
  const fixtureResults: BrainCoreVideoProviderResponseRedactionSkeletonFixtureResult[] = fixtureDefinitions.map((fixture) => {
    const redacted = redactVideoProviderResponseFixture(fixture.input);
    return {
      fixtureId: fixture.fixtureId,
      expectedOutcome: fixture.expectedOutcome,
      rawOutputAccessBlocked: true,
      redacted,
      notes: fixture.notes,
    };
  });

  return {
    skeleton: {
      id: 'video-orchestrator-provider-response-redaction-skeleton',
      status: 'scaffolded-disabled',
      phase: 'provider-response-redaction-skeleton',
      implementationApprovedScope: 'wrapper-scaffolding-only',
      redactionFunctionCount: 1,
      fixtureCount: fixtureResults.length,
      redactedFixtureCount: fixtureResults.length,
      rawOutputAccessCount: 0,
      redactedManifestCreatedCount: 0,
      artifactPersistedCount: 0,
      auditPersistedCount: 0,
      fixtureResults,
      safety,
      blockers: [
        'raw provider output remains blocked',
        'artifact persistence remains blocked',
        'audit persistence remains blocked',
      ],
      nextSafeStep: 'Await explicit approval before any provider response redaction implementation beyond inert scaffolding.',
    },
  };
}

export const readVideoProviderResponseRedactionSkeleton = readVideoProviderResponseRedactionSkeletonStatus;
