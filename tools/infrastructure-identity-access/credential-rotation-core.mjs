function safeResult(result, step) {
  if (!result || result.ok !== true) throw new Error(`${step}_failed`);
  return result;
}

export function rotationDisposition({ credential, lifecyclePolicy } = {}) {
  if (!credential?.credentialId) return { mode: 'blocked', reasonCode: 'credential_metadata_required' };
  if (credential.secretOwner !== 'secret_store') return { mode: 'blocked', reasonCode: 'application_or_provider_owned' };
  if (lifecyclePolicy?.rotationMode === 'provider_managed') return { mode: 'automatic', reasonCode: null };
  if (lifecyclePolicy?.rotationMode === 'approval_gated') return { mode: 'human_required', reasonCode: 'provider_rotation_requires_human' };
  return { mode: 'blocked', reasonCode: 'rotation_forbidden' };
}

/**
 * Execute the admitted automatic rotation transaction using injected bounded
 * operations. The old credential is never retired or revoked before every
 * replacement and consumer verification step succeeds.
 */
export async function executeAutomaticRotation({ credential, lifecyclePolicy, operations, now = new Date().toISOString() } = {}) {
  const disposition = rotationDisposition({ credential, lifecyclePolicy });
  if (disposition.mode !== 'automatic') return { ok: false, ...disposition, credentialId: credential?.credentialId ?? null, containsSecrets: false };
  const required = ['createReplacement', 'storeReplacement', 'verifyReplacement', 'cutoverConsumers', 'verifyConsumers', 'retireOld', 'finalHealth'];
  if (required.some((name) => typeof operations?.[name] !== 'function')) return { ok: false, mode: 'blocked', reasonCode: 'rotation_operations_incomplete', credentialId: credential.credentialId, containsSecrets: false };
  let replacement = null;
  let cutover = false;
  const steps = [];
  try {
    replacement = safeResult(await operations.createReplacement({ credential, now }), 'create_replacement');
    steps.push('replacement_created');
    safeResult(await operations.storeReplacement({ credential, replacement, now }), 'store_replacement');
    steps.push('replacement_stored');
    safeResult(await operations.verifyReplacement({ credential, replacement, now }), 'verify_replacement');
    steps.push('replacement_verified');
    safeResult(await operations.cutoverConsumers({ credential, replacement, now }), 'consumer_cutover');
    cutover = true;
    steps.push('consumer_cutover');
    safeResult(await operations.verifyConsumers({ credential, replacement, now }), 'consumer_verification');
    steps.push('consumers_verified');
    safeResult(await operations.retireOld({ credential, replacement, now }), 'retire_old');
    steps.push('old_retired');
    if (typeof operations.revokeOld === 'function') {
      safeResult(await operations.revokeOld({ credential, replacement, now }), 'revoke_old');
      steps.push('old_revoked');
    }
    safeResult(await operations.finalHealth({ credential, replacement, now }), 'final_health');
    steps.push('final_health');
    return { ok: true, mode: 'automatic', credentialId: credential.credentialId, steps, replacementVersion: replacement.version ?? null, containsSecrets: false };
  } catch (error) {
    if (cutover && typeof operations.rollbackConsumers === 'function') {
      try { await operations.rollbackConsumers({ credential, replacement, now }); steps.push('consumer_cutover_rolled_back'); } catch { steps.push('consumer_cutover_rollback_failed'); }
    }
    if (replacement && typeof operations.deleteReplacement === 'function') {
      try { await operations.deleteReplacement({ credential, replacement, now }); steps.push('replacement_deleted'); } catch { steps.push('replacement_cleanup_failed'); }
    }
    return { ok: false, mode: 'automatic', credentialId: credential.credentialId, reasonCode: error instanceof Error ? error.message : 'rotation_failed', steps, oldCredentialRetired: steps.includes('old_retired'), containsSecrets: false };
  }
}
