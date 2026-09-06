#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { healthPolicyForCredential, IDENTITY_HEALTH_POLICY_CATALOG_VERSION, severityForCondition } from './infrastructure-identity-access/credential-health-policy.mjs';
import { DEFAULT_CREDENTIAL_HEALTH_STATE_PATH } from './infrastructure-identity-access/credential-health-runtime.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
const runtimeSchema = loadJson(path.join(root, 'operations/specs/infrastructure-credential-health-runtime-v1.schema.json'));
const canonical = loadJson(path.join(root, 'operations/infrastructure/catalog/identity-access.v1.json'));
const alternate = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
const orchestratorSource = fs.readFileSync(path.join(root, 'tools/infrastructure-identity-access/credential-health-orchestrator.mjs'), 'utf8');
const cliSource = fs.readFileSync(path.join(root, 'tools/infrastructure-identity-access/credential-health-cli.mjs'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'tools/infrastructure-identity-access/credential-health-runtime.mjs'), 'utf8');
const dispatcherSource = fs.readFileSync(path.join(root, 'tools/infrastructure-identity-access/credential-health-attention-dispatcher.mjs'), 'utf8');
const policySource = fs.readFileSync(path.join(root, 'tools/infrastructure-identity-access/credential-health-policy.mjs'), 'utf8');
const errors = [];

errors.push(...validateJsonSchema(schema.$defs.identityAccessCatalog, canonical, schema, '$.canonical'));
errors.push(...validateJsonSchema(schema.$defs.identityAccessCatalog, alternate, schema, '$.alternate'));
if (runtimeSchema.$defs?.evaluation?.additionalProperties !== false || runtimeSchema.properties?.containsSecrets?.const !== false) errors.push('credential health runtime schema must be closed and secret-free');
if (canonical.mutationEnabled !== false || alternate.mutationEnabled !== false) errors.push('identity access catalogs must remain mutation-disabled');
if ((alternate.accounts?.length ?? 0) < 2) errors.push('alternate fixture must prove multiple account identities');
if (new Set(alternate.accounts.map((entry) => entry.accountId)).size !== alternate.accounts.length) errors.push('alternate account IDs are not unique');
if (new Set(alternate.credentials.map((entry) => entry.credentialId)).size !== alternate.credentials.length) errors.push('alternate credential IDs are not unique');
if (IDENTITY_HEALTH_POLICY_CATALOG_VERSION !== '1.0.0') errors.push('identity health policy catalog version changed unexpectedly');
if (DEFAULT_CREDENTIAL_HEALTH_STATE_PATH !== path.join('runtime', 'local', 'infrastructure', 'credential-health-state.json')) errors.push('credential health runtime path is not canonical');

const samplePolicies = alternate.credentials.map((credential) => healthPolicyForCredential(credential));
if (new Set(samplePolicies.map((policy) => policy.healthPolicyId)).size !== samplePolicies.length) errors.push('credential health policy IDs are not stable/unique');
for (const code of ['identity_provider_revoked', 'identity_wrong_account', 'identity_credential_expiring', 'identity_verification_stale']) {
  if (!['critical', 'high', 'medium', 'unknown'].includes(severityForCondition(code))) errors.push(`missing severity mapping for ${code}`);
}

if (!policySource.includes('readOnly: true') || !orchestratorSource.includes('verificationPolicy.readOnlyOnly !== true')) errors.push('credential health does not preserve read-only provenance/policy');
for (const [label, source] of [['orchestrator', orchestratorSource], ['runtime', runtimeSource], ['dispatcher', dispatcherSource]]) {
  if (/\bDecisionCore\b|infinite-brain-decision|createProposal/.test(source)) errors.push(`${label} contains Decision Core integration`);
}
if (!runtimeSource.includes('0o600') || !runtimeSource.includes('renameSync') || !runtimeSource.includes('.tmp-${process.pid}')) errors.push('credential health runtime lacks owner-only atomic persistence');
if (!orchestratorSource.includes('projectIncidents') || !orchestratorSource.includes('planIncidentAttention')) errors.push('credential health does not reuse IKHP incident and attention owners');
if (!orchestratorSource.includes('createGitHubProviderAdapter') || !orchestratorSource.includes('createMacOSKeychainAdapter')) errors.push('production GitHub/Keychain adapters are not wired');
if (!dispatcherSource.includes("const OSASCRIPT = '/usr/bin/osascript'")) errors.push('notification delivery is not pinned to the macOS notification binary');
if (!dispatcherSource.includes("execFileAsync(OSASCRIPT")) errors.push('notification delivery must use shell-free execFile');
if (/\b(fetch|spawn)\s*\(/.test(dispatcherSource)) errors.push('attention dispatcher contains an unapproved provider/process primitive');
if (!cliSource.includes("arg !== '--notify'")) errors.push('credential health CLI accepts more than the explicit notify switch');
if (/(--root|--credential-ref|--token|--password|--secret)/.test(cliSource)) errors.push('credential health CLI exposes a secret or root override');

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

console.log(`infrastructure-credential-health-valid canonicalAccounts=${canonical.accounts.length} alternateAccounts=${alternate.accounts.length} alternateCredentials=${alternate.credentials.length} policyCatalogVersion=${IDENTITY_HEALTH_POLICY_CATALOG_VERSION} scheduled=read-only incidents=ikhp3 notifications=clr3 secrets=none`);
