import fs from 'node:fs';
import path from 'node:path';
import { createMacOSKeychainAdapter, MACOS_KEYCHAIN_SERVICE_NAMESPACE, MACOS_KEYCHAIN_PHYSICAL_STORE } from './macos-keychain-adapter.mjs';

export const BRAIN_CREDENTIAL_REFERENCE_RE = /^credential:[a-z0-9][a-z0-9._-]*$/;
export const BRAIN_KEYCHAIN_ACCOUNT_PREFIX = 'credential.';
export const CREDENTIAL_CATALOG_RELATIVE_PATH = 'operations/infrastructure/catalog/identity-access.v1.json';

function safeId(value) {
  if (typeof value !== 'string' || !BRAIN_CREDENTIAL_REFERENCE_RE.test(value)) throw new Error('invalid_credential_reference');
  return value;
}

export function keychainAccountForCredential(credentialId) {
  const id = safeId(credentialId).slice('credential:'.length);
  return `${BRAIN_KEYCHAIN_ACCOUNT_PREFIX}${id}`;
}

export function keychainReferenceForCredential(credentialId, service = MACOS_KEYCHAIN_SERVICE_NAMESPACE) {
  return `keychain-ref://${service}/${keychainAccountForCredential(credentialId)}`;
}

export function credentialIdFromKeychainAccount(account) {
  if (typeof account !== 'string' || !account.startsWith(BRAIN_KEYCHAIN_ACCOUNT_PREFIX)) return null;
  const suffix = account.slice(BRAIN_KEYCHAIN_ACCOUNT_PREFIX.length);
  return BRAIN_CREDENTIAL_REFERENCE_RE.test(`credential:${suffix}`) ? `credential:${suffix}` : null;
}

export function readIdentityAccessCatalog(root) {
  const catalogPath = path.resolve(root, CREDENTIAL_CATALOG_RELATIVE_PATH);
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

function catalogCredentials(catalog) {
  return new Map((catalog?.credentials ?? []).map((credential) => [credential.credentialId, credential]));
}

function accountIndex(catalog) {
  return new Map((catalog?.accounts ?? []).map((account) => [account.accountId, account]));
}

function itemMetadata(item, credentials, accounts) {
  const credentialId = credentialIdFromKeychainAccount(item.account);
  const credential = credentialId ? credentials.get(credentialId) : null;
  const account = credential ? accounts.get(credential.accountId) : null;
  return {
    service: item.service,
    account: item.account,
    label: item.label ?? null,
    credentialId,
    catalogState: credential ? 'cataloged' : 'orphan_keychain_item',
    owner: credential?.secretOwner ?? null,
    accountId: credential?.accountId ?? null,
    accountLifecycle: account?.lifecycleState ?? null,
    consumers: account ? [account.accountId, ...(account.runtimeProfileIds ?? [])] : [],
    containsSecrets: false,
  };
}

export function reconcileCredentialInventory({ catalog, inventory } = {}) {
  const credentials = catalogCredentials(catalog);
  const accounts = accountIndex(catalog);
  const items = (inventory?.items ?? []).map((item) => itemMetadata(item, credentials, accounts));
  const byAccount = new Map();
  for (const item of items) byAccount.set(item.account, [...(byAccount.get(item.account) ?? []), item]);
  const duplicates = [...byAccount.entries()].filter(([, entries]) => entries.length > 1).map(([account, entries]) => ({ account, count: entries.length }));
  const catalogMissing = [...credentials.values()].flatMap((credential) => {
    const reference = credential.secretStoreRef;
    const expectedAccount = reference?.match(/^keychain-ref:\/\/[^/]+\/(.+)$/)?.[1];
    return expectedAccount && !items.some((item) => item.account === expectedAccount) ? [{ credentialId: credential.credentialId, expectedAccount }] : [];
  });
  const retiredPresent = items.filter((item) => item.accountLifecycle === 'retired' || item.catalogState === 'orphan_keychain_item' && item.credentialId && !credentials.has(item.credentialId));
  const multipleActiveVersions = [...credentials.values()].flatMap((credential) => {
    const active = credential.versionMetadata?.versions?.filter((version) => version.state === 'active') ?? [];
    return active.length > 1 ? [{ credentialId: credential.credentialId, count: active.length }] : [];
  });
  return {
    items,
    duplicates,
    catalogMissing,
    retiredPresent,
    multipleActiveVersions,
    orphanCount: items.filter((item) => item.catalogState === 'orphan_keychain_item').length,
    duplicateCount: duplicates.length,
    missingCount: catalogMissing.length,
    count: items.length,
  };
}

export function buildRotationPlan({ credential, now = new Date().toISOString() } = {}) {
  if (!credential?.credentialId) throw new Error('credential_metadata_required');
  const metadata = credential.versionMetadata;
  if (metadata?.rotationPolicy === 'forbidden') return { ok: false, reasonCode: 'rotation_forbidden', credentialId: credential.credentialId };
  const versions = metadata?.versions ?? [];
  const highest = versions.reduce((max, version) => Math.max(max, Number(String(version.version).slice(1)) || 0), 0);
  const currentVersion = metadata?.activeVersion ?? (highest ? `v${highest}` : 'v1');
  const replacementVersion = `v${Math.max(highest + 1, Number(currentVersion.slice(1)) + 1)}`;
  return {
    ok: true,
    credentialId: credential.credentialId,
    currentVersion,
    replacementVersion,
    createdAt: new Date(now).toISOString(),
    activatedAt: null,
    retiredAt: null,
    rotationPolicy: metadata?.rotationPolicy ?? 'approval_gated',
    replacementState: 'pending',
    preserveLifecycleState: true,
    providerRevocation: 'separate_explicit_operation',
  };
}

export async function readVaultSnapshot({ root = process.cwd(), adapter = createMacOSKeychainAdapter() } = {}) {
  const catalog = readIdentityAccessCatalog(root);
  const description = adapter.describe();
  const availability = await adapter.checkAvailability();
  const inventory = await adapter.inspectNamespace();
  const reconciliation = reconcileCredentialInventory({ catalog, inventory });
  const credentials = catalogCredentials(catalog);
  const healthy = [...credentials.values()].filter((credential) => credential.lastKnownState === 'verified_healthy').length;
  return {
    physicalStore: description.physicalStore,
    serviceNamespace: description.serviceNamespace,
    accessibility: description.accessibility,
    synchronization: description.synchronization,
    hostScope: description.hostScope,
    mutationMode: description.mutationMode,
    adapterId: description.adapterId,
    availability,
    inventory: { storageState: inventory.storageState ?? 'unknown', count: reconciliation.count },
    health: { healthy, missing: reconciliation.missingCount, unavailable: availability.ok ? 0 : 1 },
    reconciliation,
    containsSecrets: false,
  };
}

export function inspectCredentialMetadata({ credentialId, catalog, inventoryItems = [] } = {}) {
  const id = safeId(credentialId);
  const credentials = catalogCredentials(catalog);
  const accounts = accountIndex(catalog);
  const credential = credentials.get(id) ?? null;
  const account = credential ? accounts.get(credential.accountId) ?? null : null;
  const reference = credential?.secretStoreRef ?? keychainReferenceForCredential(id);
  const keychain = inventoryItems.filter((item) => item.credentialId === id || item.account === keychainAccountForCredential(id));
  return {
    credentialId: id,
    reference,
    catalogState: credential ? 'cataloged' : 'not_cataloged',
    owner: credential?.secretOwner ?? null,
    accountId: credential?.accountId ?? null,
    scope: credential?.scopeSummary ?? [],
    consumers: account ? [account.accountId, ...(account.runtimeProfileIds ?? [])] : [],
    verificationPolicy: credential?.verificationPolicyId ?? null,
    rotationPolicy: credential?.lifecyclePolicyId ?? null,
    recoveryPolicy: credential?.recoveryRunbookRef ?? null,
    status: credential?.lastKnownState ?? 'unknown',
    lastVerified: credential?.lastVerifiedAt ?? null,
    version: credential?.versionMetadata ?? null,
    keychainItemCount: keychain.length,
    containsSecrets: false,
  };
}

export function buildCredentialResolution({ credentialId, catalog } = {}) {
  const metadata = inspectCredentialMetadata({ credentialId, catalog });
  if (metadata.catalogState !== 'cataloged') return { ok: false, reasonCode: 'credential_not_cataloged', metadata };
  if (metadata.owner !== 'secret_store' || !metadata.reference.startsWith('keychain-ref://')) return { ok: false, reasonCode: 'credential_not_brain_vault_owned', metadata };
  return { ok: true, credentialId: metadata.credentialId, reference: metadata.reference, metadata, containsSecrets: false, secretValueReturned: false };
}

export function classifyRetirement({ localDelete = false, catalogRetire = false, providerRevoke = false } = {}) {
  return {
    localKeychainDeletion: localDelete ? 'requested' : 'not_requested',
    catalogRetirement: catalogRetire ? 'requested' : 'not_requested',
    providerRevocation: providerRevoke ? 'requested' : 'not_requested',
    providerRevocationImpliedByLocalDelete: false,
  };
}

export function buildVaultDoctor({ snapshot } = {}) {
  const checks = [
    { check: 'keychain_available', status: snapshot.availability.ok ? 'pass' : 'fail', detail: snapshot.availability.diagnosticCode ?? snapshot.availability.storageState },
    { check: 'catalog_consistency', status: snapshot.reconciliation.missingCount === 0 ? 'pass' : 'attention', detail: `${snapshot.reconciliation.missingCount} catalog item(s) missing from Keychain` },
    { check: 'orphan_metadata', status: snapshot.reconciliation.orphanCount === 0 ? 'pass' : 'attention', detail: `${snapshot.reconciliation.orphanCount} Brain-namespaced item(s) lack catalog metadata` },
    { check: 'duplicate_active_items', status: snapshot.reconciliation.duplicateCount === 0 ? 'pass' : 'attention', detail: `${snapshot.reconciliation.duplicateCount} duplicate account group(s)` },
    { check: 'retired_items', status: snapshot.reconciliation.retiredPresent.length === 0 ? 'pass' : 'attention', detail: `${snapshot.reconciliation.retiredPresent.length} retired item(s) still present` },
    { check: 'multiple_active_versions', status: snapshot.reconciliation.multipleActiveVersions.length === 0 ? 'pass' : 'attention', detail: `${snapshot.reconciliation.multipleActiveVersions.length} credential(s) have multiple active versions` },
  ];
  return { checks, safeToProceed: checks.every((check) => check.status !== 'fail'), containsSecrets: false };
}
