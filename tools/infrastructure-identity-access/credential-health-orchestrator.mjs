import fs from 'node:fs';
import path from 'node:path';

import { projectIncidents } from '../../projects/brain-core/src/adapters/infrastructure-incident-engine.mjs';
import {
  DEFAULT_INCIDENT_STATE_PATH,
  readIncidentSnapshot,
  writeIncidentSnapshot,
} from '../../projects/brain-core/src/adapters/infrastructure-incident-runtime.mjs';
import {
  DEFAULT_NOTIFICATION_STATE_PATH,
  planIncidentAttention,
  readNotificationCursor,
  writeNotificationCursor,
} from '../../projects/brain-core/src/adapters/infrastructure-incident-notifications.mjs';
import {
  applyDeclaredExpiry,
  DEFAULT_ATTENTION_POLICY,
  evaluationFromVerification,
  healthPolicyForCredential,
  IDENTITY_HEALTH_POLICY_CATALOG_VERSION,
  isDue,
  materializeEvaluation,
  toInfrastructureObservation,
} from './credential-health-policy.mjs';
import { createGitHubProviderAdapter } from './github-provider-adapter.mjs';
import { createMacOSKeychainAdapter, MACOS_KEYCHAIN_ADAPTER_ID } from './macos-keychain-adapter.mjs';
import { verifyCredential } from './credential-verification-boundary.mjs';
import {
  DEFAULT_CREDENTIAL_HEALTH_STATE_PATH,
  readCredentialHealthState,
  writeCredentialHealthState,
} from './credential-health-runtime.mjs';
import { dispatchCredentialAttention } from './credential-health-attention-dispatcher.mjs';

export const IDENTITY_ACCESS_CATALOG_PATH = path.join('operations', 'infrastructure', 'catalog', 'identity-access.v1.json');
export const DEFAULT_IDENTITY_ACCESS_ROOT = path.resolve(import.meta.dirname, '../..');

function iso(value, label = 'timestamp') {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function readCatalog(root) {
  const absolutePath = path.join(root, IDENTITY_ACCESS_CATALOG_PATH);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function indexBy(items, key) {
  return new Map((items ?? []).map((item) => [item[key], item]));
}

function defaultProviderAdapterFactory({ account, credential }) {
  if (account.providerId === 'github') return createGitHubProviderAdapter({ credentialType: credential.providerCredentialType ?? 'unknown' });
  return null;
}

function defaultSecretStoreAdapterFactory({ credential, catalog }) {
  const adapter = (catalog.secretStoreAdapters ?? []).find((entry) => entry.adapterId === credential.secretStoreAdapterId);
  if (adapter?.adapterId === MACOS_KEYCHAIN_ADAPTER_ID) return createMacOSKeychainAdapter();
  return null;
}

function safeUnavailableEvaluation({ credential, account, verificationPolicy, lifecyclePolicy, previous, now, reason }) {
  const evaluation = materializeEvaluation({ credential, account, verificationPolicy, lifecyclePolicy, previous, now });
  const consecutiveTransientFailures = (previous?.consecutiveTransientFailures ?? 0) + 1;
  const delaySeconds = Math.min(24 * 60 * 60, Math.max(verificationPolicy.backoffSeconds ?? 60, (verificationPolicy.backoffSeconds ?? 60) * (2 ** Math.max(0, consecutiveTransientFailures - 1))));
  return applyDeclaredExpiry({
    ...evaluation,
    evaluationStatus: 'skipped',
    detailedState: 'unknown',
    status: 'unknown',
    freshness: 'unknown',
    conditionCodes: ['identity_verification_unknown'],
    providerReasonCode: reason,
    consecutiveTransientFailures,
    lastAttemptAt: iso(now),
    nextDueAt: new Date(Date.parse(iso(now)) + delaySeconds * 1000).toISOString(),
  }, credential, verificationPolicy, now);
}

function eligibleCredentials(catalog) {
  const accounts = indexBy(catalog.accounts, 'accountId');
  return (catalog.credentials ?? [])
    .map((credential) => ({ credential, account: accounts.get(credential.accountId) }))
    .filter(({ account }) => account?.lifecycleState === 'enrolled')
    .sort((a, b) => a.credential.credentialId.localeCompare(b.credential.credentialId));
}

function safeSummary(evaluations, incidents, attention, delivery) {
  return {
    evaluations: evaluations.map((entry) => ({
      credentialId: entry.credentialId,
      accountId: entry.accountId,
      providerId: entry.providerId,
      status: entry.status,
      freshness: entry.freshness,
      detailedState: entry.detailedState,
      evaluationStatus: entry.evaluationStatus,
      nextDueAt: entry.nextDueAt,
      missedIntervals: entry.missedIntervals,
    })),
    incidents: incidents.map((entry) => ({ incidentId: entry.incidentId, resourceId: entry.resourceId, conditionCode: entry.conditionCode, severity: entry.severity, status: entry.status, lastTransition: entry.lastTransition })),
    attention: {
      immediate: attention.immediate.length,
      deferred: attention.deferred.length,
      digest: Boolean(attention.digest),
    },
    delivery,
    containsSecrets: false,
  };
}

/**
 * Run one provider-neutral, read-only identity health pass.
 *
 * The default factories are fixed production adapters. Test factories are
 * injectable so lifecycle behavior can be proven without reading any real
 * credential or contacting a provider.
 */
export async function runCredentialHealthEvaluation({
  root = DEFAULT_IDENTITY_ACCESS_ROOT,
  catalog = readCatalog(root),
  now = new Date(),
  notify = false,
  providerAdapterFactory = defaultProviderAdapterFactory,
  secretStoreAdapterFactory = defaultSecretStoreAdapterFactory,
  attentionSender,
  incidentStatePath = DEFAULT_INCIDENT_STATE_PATH,
  notificationStatePath = DEFAULT_NOTIFICATION_STATE_PATH,
  healthStatePath = DEFAULT_CREDENTIAL_HEALTH_STATE_PATH,
} = {}) {
  const nowIso = iso(now, 'now');
  const accounts = indexBy(catalog.accounts, 'accountId');
  const credentials = indexBy(catalog.credentials, 'credentialId');
  const verificationPolicies = indexBy(catalog.verificationPolicies, 'verificationPolicyId');
  const lifecyclePolicies = indexBy(catalog.lifecyclePolicies, 'lifecyclePolicyId');
  const previousHealth = readCredentialHealthState({ root, now, inputPath: healthStatePath, policyCatalogVersion: IDENTITY_HEALTH_POLICY_CATALOG_VERSION });
  const previousByCredential = indexBy(previousHealth.state.evaluations, 'credentialId');
  const evaluations = [];
  const observations = [];
  const healthPolicies = [];

  for (const { credential, account } of eligibleCredentials(catalog)) {
    const verificationPolicy = verificationPolicies.get(credential.verificationPolicyId) ?? verificationPolicies.get(account.verificationPolicyId);
    const lifecyclePolicy = lifecyclePolicies.get(credential.lifecyclePolicyId);
    const previous = previousByCredential.get(credential.credentialId) ?? null;
    if (!verificationPolicy || !lifecyclePolicy || verificationPolicy.readOnlyOnly !== true || verificationPolicy.probeMode !== 'read_only' || !lifecyclePolicy) {
      const skipped = safeUnavailableEvaluation({ credential, account, verificationPolicy: verificationPolicy ?? { freshnessSeconds: 3600, backoffSeconds: 60 }, lifecyclePolicy: lifecyclePolicy ?? { verificationCadenceSeconds: 86400 }, previous, now, reason: 'policy_unavailable' });
      evaluations.push(skipped);
      observations.push(toInfrastructureObservation(skipped, now));
      healthPolicies.push(healthPolicyForCredential(credential));
      continue;
    }

    let evaluation;
    if (previous && !isDue(previous, now)) {
      evaluation = materializeEvaluation({ credential, account, verificationPolicy, lifecyclePolicy, previous, now });
    } else {
      const providerAdapter = await providerAdapterFactory({ account, credential, verificationPolicy, catalog });
      const secretStoreAdapter = await secretStoreAdapterFactory({ account, credential, verificationPolicy, catalog });
      if (!providerAdapter || !secretStoreAdapter) {
        evaluation = safeUnavailableEvaluation({ credential, account, verificationPolicy, lifecyclePolicy, previous, now, reason: 'adapter_unavailable' });
      } else {
        const observation = await verifyCredential({
          credentialId: credential.credentialId,
          credentialRef: credential.secretStoreRef,
          expectedPrincipal: account.expectedPrincipal,
          verificationPolicy,
          providerAdapter,
          secretStoreAdapter,
          now,
        });
        evaluation = evaluationFromVerification({ credential, account, observation, verificationPolicy, lifecyclePolicy, previous, now });
      }
    }
    evaluations.push(evaluation);
    observations.push(toInfrastructureObservation(evaluation, now));
    healthPolicies.push(healthPolicyForCredential(credential));
  }

  const previousIncidents = readIncidentSnapshot({ root, now, inputPath: incidentStatePath }).snapshot;
  const projected = projectIncidents({
    previousIncidents: previousIncidents.incidents,
    observations,
    healthPolicies,
    policyCatalogVersion: IDENTITY_HEALTH_POLICY_CATALOG_VERSION,
    now: nowIso,
  });
  const incidentWrite = writeIncidentSnapshot(projected.incidents, { root, now, outputPath: incidentStatePath });
  const previousCursor = readNotificationCursor({ root, now, inputPath: notificationStatePath }).cursor;
  const attention = planIncidentAttention({
    incidents: projected.incidents,
    transitions: projected.transitions,
    previousCursor,
    now: nowIso,
    attentionPolicy: DEFAULT_ATTENTION_POLICY,
  });
  if (notify) writeNotificationCursor(attention.nextCursor, { root, now, outputPath: notificationStatePath });
  const delivery = await dispatchCredentialAttention(attention, { notify, sender: attentionSender });
  const healthWrite = writeCredentialHealthState(evaluations, { root, now, outputPath: healthStatePath, policyCatalogVersion: IDENTITY_HEALTH_POLICY_CATALOG_VERSION });
  return {
    schemaVersion: '1.0.0',
    generatedAt: nowIso,
    policyCatalogVersion: IDENTITY_HEALTH_POLICY_CATALOG_VERSION,
    paths: { health: healthWrite.path, incidents: incidentWrite.path, notifications: path.isAbsolute(notificationStatePath) ? notificationStatePath : path.join(root, notificationStatePath) },
    summary: safeSummary(evaluations, projected.incidents, attention, delivery),
    evaluations: healthWrite.state.evaluations,
    incidents: incidentWrite.snapshot.incidents,
    transitions: projected.transitions,
    attention,
    delivery,
    containsSecrets: false,
  };
}
