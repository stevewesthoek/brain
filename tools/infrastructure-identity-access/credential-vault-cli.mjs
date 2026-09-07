#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMacOSKeychainAdapter } from './macos-keychain-adapter.mjs';
import { createGitHubProviderAdapter } from './github-provider-adapter.mjs';
import { verifyCredential } from './credential-verification-boundary.mjs';
import {
  BRAIN_CREDENTIAL_REFERENCE_RE,
  buildCredentialResolution,
  buildRotationPlan,
  buildVaultDoctor,
  classifyRetirement,
  inspectCredentialMetadata,
  keychainAccountForCredential,
  readIdentityAccessCatalog,
  readVaultSnapshot,
  reconcileCredentialInventory,
} from './credential-vault-core.mjs';

const root = path.resolve(process.env.BRAIN_CREDENTIAL_VAULT_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const storeScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'macos-keychain-store.swift');
const adapter = createMacOSKeychainAdapter();

function output(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify({ ...payload, containsSecrets: false, secretValueReturned: false })}\n`);
  process.exitCode = exitCode;
}

function fail(reasonCode, message = reasonCode, exitCode = 2) {
  output({ ok: false, reasonCode, message: String(message).replace(/[\r\n]/g, ' ').slice(0, 300) }, exitCode);
}

function option(args, name, fallback = null) {
  const exact = args.find((arg) => arg === name);
  if (exact) return true;
  const prefix = args.find((arg) => arg.startsWith(`${name}=`));
  return prefix ? prefix.slice(name.length + 1) : fallback;
}

function requireCredentialId(value) {
  if (typeof value !== 'string' || !BRAIN_CREDENTIAL_REFERENCE_RE.test(value)) throw new Error('credential reference must match credential:<opaque-id>');
  return value;
}

function rejectSecretOptions(args) {
  if (args.some((arg) => /^(--?(secret|value|token|password|api-key)|--(?:secret|value|token|password|api[_-]?key)=)/i.test(arg))) throw new Error('raw secret options are forbidden; use the hidden native prompt');
}

function runInteractiveStore(operation, credentialId, label = 'Brain credential') {
  if (process.platform !== 'darwin') return { status: null, output: '' };
  const account = keychainAccountForCredential(credentialId);
  const result = spawnSync('/usr/bin/swift', [storeScript, operation, 'tools.prochat.brain', account, label], { cwd: '/', stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8', timeout: 30000 });
  return { status: result.status, output: String(result.stdout ?? '') };
}

const [command, ...args] = process.argv.slice(2);
async function main() {
try {
  rejectSecretOptions(args);
  if (!command || command === '--help' || command === '-h') {
    output({ ok: true, usage: 'vault {status|list|inspect <credential:id>|add <credential:id> --confirm|update <credential:id> --confirm|rotate <credential:id> --confirm|verify <credential:id>|delete <credential:id> --confirm|retire <credential:id>|doctor}' });
  } else if (command === 'status') {
    output({ ok: true, command, ...(await readVaultSnapshot({ root, adapter })) });
  } else if (command === 'list') {
    const catalog = readIdentityAccessCatalog(root);
    const inventory = await adapter.inspectNamespace();
    output({ ok: true, command, items: reconcileCredentialInventory({ catalog, inventory }).items, count: inventory.count ?? 0 });
  } else if (command === 'inspect') {
    const credentialId = requireCredentialId(args[0]);
    const catalog = readIdentityAccessCatalog(root);
    const inventory = await adapter.inspectNamespace();
    const metadata = inspectCredentialMetadata({ credentialId, catalog, inventoryItems: reconcileCredentialInventory({ catalog, inventory }).items });
    const storage = await adapter.inspectReference(metadata.reference);
    output({ ok: true, command, metadata, storage: { storageState: storage.storageState, detailedState: storage.detailedState, diagnosticCode: storage.diagnosticCode }, health: metadata.status });
  } else if (['add', 'update', 'rotate'].includes(command)) {
    const credentialId = requireCredentialId(args[0]);
    if (!option(args, '--confirm')) return fail('confirmation_required', 'explicit --confirm is required before Keychain mutation');
    const catalog = readIdentityAccessCatalog(root);
    const credential = catalog.credentials.find((entry) => entry.credentialId === credentialId);
    if (!credential) return fail('credential_not_cataloged', 'admit Brain ownership in the canonical catalog before storing a credential');
    const rotation = command === 'rotate' ? buildRotationPlan({ credential }) : null;
    if (rotation && !rotation.ok) return fail(rotation.reasonCode, 'credential rotation is not allowed by its lifecycle policy');
    const label = option(args, '--label', 'Brain credential');
    const result = runInteractiveStore(command === 'add' ? 'interactive-create' : 'interactive-update', credentialId, label);
    if (result.status !== 0) return fail('keychain_mutation_failed', 'native Keychain operation failed', 1);
    output({ ok: true, command: command === 'rotate' ? 'rotate' : command, credentialId, lifecycle: { replacementStored: command !== 'add', consumerCutover: 'operator_verified', oldCredentialRetirement: command === 'rotate' ? 'separate_explicit_step' : 'not_applicable' }, rotationPlan: rotation });
  } else if (command === 'verify') {
    const credentialId = requireCredentialId(args[0]);
    const catalog = readIdentityAccessCatalog(root);
    const resolution = buildCredentialResolution({ credentialId, catalog });
    if (!resolution.ok) return fail(resolution.reasonCode, 'credential is not an admitted Brain Keychain credential');
    const credential = catalog.credentials.find((entry) => entry.credentialId === credentialId);
    const account = catalog.accounts.find((entry) => entry.accountId === credential.accountId);
    const policy = catalog.verificationPolicies.find((entry) => entry.verificationPolicyId === credential.verificationPolicyId || entry.verificationPolicyId === account?.verificationPolicyId);
    const provider = account?.providerId === 'github' ? createGitHubProviderAdapter({ credentialType: credential.providerCredentialType ?? 'unknown' }) : null;
    if (!provider || !policy) return fail('verification_boundary_unavailable', 'no admitted provider verifier is registered for this credential');
    const observation = await verifyCredential({ credentialId, credentialRef: resolution.reference, expectedPrincipal: account.expectedPrincipal, verificationPolicy: policy, providerAdapter: provider, secretStoreAdapter: adapter, now: new Date() });
    output({ ok: true, command, credentialId, observation });
  } else if (command === 'delete' || command === 'retire') {
    const credentialId = requireCredentialId(args[0]);
    const catalog = readIdentityAccessCatalog(root);
    const metadata = inspectCredentialMetadata({ credentialId, catalog });
    if (command === 'delete') {
      if (!option(args, '--confirm')) return fail('confirmation_required', 'explicit --confirm is required before local Keychain deletion');
      const result = await adapter.delete(metadata.reference, { operatorConfirmed: true });
      output({ ok: result.ok, command, credentialId, result: { storageState: result.storageState, reasonCode: result.reasonCode }, retirement: classifyRetirement({ localDelete: true, catalogRetire: false, providerRevoke: false }) }, result.ok ? 0 : 1);
    } else {
      output({ ok: true, command, credentialId, retirement: classifyRetirement({ localDelete: option(args, '--local-delete') === true, catalogRetire: true, providerRevoke: false }), nextAction: 'human approval and separate catalog/provider operation required' });
    }
  } else if (command === 'doctor') {
    const snapshot = await readVaultSnapshot({ root, adapter });
    output({ ok: snapshot.availability.ok, command, doctor: buildVaultDoctor({ snapshot }), snapshot: { availability: snapshot.availability, inventory: snapshot.inventory, health: snapshot.health }, }, snapshot.availability.ok ? 0 : 1);
  } else {
    fail('unknown_command', `unsupported vault command: ${command}`);
  }
} catch (error) {
  fail('vault_command_failed', error instanceof Error ? error.message : 'unknown');
}
}

await main();
