export const CANONICAL_BEDROCK_PROVIDER_ID = 'amazon-bedrock' as const;
export const LEGACY_PROVIDER_ALIASES = {
  'claude-bedrock': CANONICAL_BEDROCK_PROVIDER_ID,
} as const;

export type CanonicalManagedProvider = typeof CANONICAL_BEDROCK_PROVIDER_ID | 'codex-cli';

export function canonicalProviderId(providerId: string): string {
  return LEGACY_PROVIDER_ALIASES[providerId as keyof typeof LEGACY_PROVIDER_ALIASES] ?? providerId;
}

export function canonicalProviderIds(providerIds: string[]): string[] {
  return [...new Set(providerIds.map(canonicalProviderId))];
}
