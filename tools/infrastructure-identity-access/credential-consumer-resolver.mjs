import { verifyCredential } from './credential-verification-boundary.mjs';
import { buildCredentialResolution } from './credential-vault-core.mjs';

/**
 * Provider-neutral consumer boundary. Provider adapters supply verification
 * semantics; the consumer only supplies an opaque Brain credential reference.
 * No raw Keychain value is returned to the caller.
 */
export async function resolveCredentialForConsumer({ credentialId, catalog, account, credential, verificationPolicy, providerAdapter, secretStoreAdapter, now = new Date() } = {}) {
  const resolution = buildCredentialResolution({ credentialId, catalog });
  if (!resolution.ok) return { ok: false, reasonCode: resolution.reasonCode, metadata: resolution.metadata, containsSecrets: false, secretValueReturned: false };
  if (!account || !credential || !verificationPolicy || !providerAdapter || !secretStoreAdapter) {
    return { ok: false, reasonCode: 'consumer_boundary_incomplete', metadata: resolution.metadata, containsSecrets: false, secretValueReturned: false };
  }
  const observation = await verifyCredential({
    credentialId,
    credentialRef: resolution.reference,
    expectedPrincipal: account.expectedPrincipal,
    verificationPolicy,
    providerAdapter,
    secretStoreAdapter,
    now,
  });
  return { ok: observation?.detailedState === 'verified_healthy', credentialId, observation, metadata: resolution.metadata, containsSecrets: false, secretValueReturned: false };
}
