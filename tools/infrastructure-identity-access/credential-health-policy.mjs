import { createHash } from 'node:crypto';

export const IDENTITY_HEALTH_POLICY_CATALOG_VERSION = '1.0.0';
export const DEFAULT_ATTENTION_POLICY = Object.freeze({
  maxImmediatePerResourcePerHour: 5,
  immediateSeverities: ['critical', 'high'],
  immediateTransitions: ['opened', 'reopened', 'recovered'],
});

const CONDITION_SEVERITY = Object.freeze({
  identity_provider_revoked: 'critical',
  identity_credential_expired: 'critical',
  identity_wrong_account: 'high',
  identity_provider_rejected: 'high',
  identity_credential_missing: 'high',
  identity_secret_store_unavailable: 'high',
  identity_secret_store_locked: 'high',
  identity_insufficient_scope: 'high',
  identity_interactive_reauthentication_required: 'high',
  identity_credential_expiring: 'medium',
  identity_provider_unavailable: 'medium',
  identity_refresh_available: 'low',
  identity_verification_stale: 'unknown',
  identity_verification_never_performed: 'unknown',
  identity_verification_unknown: 'unknown',
});

const TRANSIENT_STATES = new Set(['provider_unavailable', 'vault_unavailable', 'secret_store_locked', 'secret_store_unavailable', 'unknown']);

function epoch(value, label) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function iso(value, label = 'timestamp') {
  return new Date(epoch(value, label)).toISOString();
}

function credentialResourceId(credentialId) {
  if (typeof credentialId !== 'string' || !/^credential:[a-z0-9._-]+$/.test(credentialId)) {
    throw new Error(`Invalid credentialId: ${credentialId}`);
  }
  return credentialId;
}

function stablePolicyId(credentialId) {
  const digest = createHash('sha256').update(`identity-credential\n${credentialId}`).digest('hex').slice(0, 24);
  return `health_policy:identity-credential-${digest}`;
}

export function healthPolicyForCredential(credential) {
  const resourceId = credentialResourceId(credential.credentialId);
  return {
    healthPolicyId: stablePolicyId(credential.credentialId),
    resourceId,
    conditions: Object.entries(CONDITION_SEVERITY).map(([conditionCode, severity]) => ({ conditionCode, severity })),
    provenance: {
      source: 'ikhp-identity-access-health-policy',
      readOnly: true,
      authority: 'derived-runtime',
    },
  };
}

export function severityForCondition(conditionCode) {
  return CONDITION_SEVERITY[conditionCode] ?? 'unknown';
}

export function isTransientDetailedState(detailedState) {
  return TRANSIENT_STATES.has(detailedState);
}

function defaultConditionForState(detailedState) {
  const conditions = {
    verified_healthy: [],
    credential_present: [],
    credential_expiring: ['identity_credential_expiring'],
    credential_expired: ['identity_credential_expired'],
    provider_rejected: ['identity_provider_rejected'],
    provider_revoked: ['identity_provider_revoked'],
    wrong_account: ['identity_wrong_account'],
    insufficient_scope: ['identity_insufficient_scope'],
    interactive_reauthentication_required: ['identity_interactive_reauthentication_required'],
    refresh_available: ['identity_refresh_available'],
    provider_unavailable: ['identity_provider_unavailable'],
    vault_unavailable: ['identity_secret_store_unavailable'],
    secret_store_locked: ['identity_secret_store_locked'],
    secret_store_unavailable: ['identity_secret_store_unavailable'],
    credential_missing: ['identity_credential_missing'],
    unknown: ['identity_verification_unknown'],
  };
  return conditions[detailedState] ?? ['identity_verification_unknown'];
}

function safeStatus(detailedState) {
  if (detailedState === 'verified_healthy' || detailedState === 'credential_present') return 'healthy';
  if (['credential_expired', 'provider_rejected', 'provider_revoked', 'wrong_account', 'insufficient_scope', 'credential_missing'].includes(detailedState)) return 'unhealthy';
  if (['credential_expiring', 'interactive_reauthentication_required', 'refresh_available', 'provider_unavailable', 'vault_unavailable', 'secret_store_locked', 'secret_store_unavailable'].includes(detailedState)) return 'degraded';
  return 'unknown';
}

function safeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function safeRateLimit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of ['limit', 'remaining', 'retryAfterSeconds']) {
    if (Number.isInteger(value[key]) && value[key] >= 0) result[key] = value[key];
  }
  if (typeof value.resetAt === 'string' && Number.isFinite(Date.parse(value.resetAt))) result.resetAt = new Date(value.resetAt).toISOString();
  return Object.keys(result).length > 0 ? result : null;
}

function safeString(value, max = 512) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function copyObservationFields(observation) {
  return {
    expectedPrincipalMatch: observation.expectedPrincipalMatch,
    observedPrincipalLabel: safeString(observation.observedPrincipalLabel, 256),
    observedScopeSummary: safeArray(observation.observedScopeSummary),
    scopeEvidence: observation.scopeEvidence ?? 'unknown',
    observedExpiresAt: observation.observedExpiresAt ?? null,
    expiryMetadataSource: observation.expiryMetadataSource ?? 'unknown',
    refreshAvailable: typeof observation.refreshAvailable === 'boolean' ? observation.refreshAvailable : null,
    providerReasonCode: safeString(observation.providerReasonCode, 128),
    rateLimit: safeRateLimit(observation.rateLimit),
    checks: safeArray(observation.checks),
  };
}

export function applyDeclaredExpiry(evaluation, credential, verificationPolicy, now) {
  const expiresAt = credential.expiryState === 'known' && credential.expiresAt ? credential.expiresAt : null;
  if (!expiresAt) return evaluation;
  const expiryMs = epoch(expiresAt, 'credential expiresAt');
  const nowMs = epoch(now, 'now');
  const windowSeconds = Number.isInteger(verificationPolicy?.expiringWithinSeconds) ? verificationPolicy.expiringWithinSeconds : 86400;
  let detailedState = evaluation.detailedState;
  if (evaluation.detailedState === 'verified_healthy' || evaluation.detailedState === 'credential_present' || evaluation.detailedState === 'unknown') {
    if (expiryMs <= nowMs) detailedState = 'credential_expired';
    else if (expiryMs <= nowMs + windowSeconds * 1000) detailedState = 'credential_expiring';
  }
  if (detailedState === evaluation.detailedState) return { ...evaluation, observedExpiresAt: new Date(expiryMs).toISOString(), expiryMetadataSource: 'user_declared' };
  return {
    ...evaluation,
    detailedState,
    status: safeStatus(detailedState),
    conditionCodes: defaultConditionForState(detailedState),
    observedExpiresAt: new Date(expiryMs).toISOString(),
    expiryMetadataSource: 'user_declared',
  };
}

export function evaluationFromVerification({ credential, account, observation, verificationPolicy, lifecyclePolicy, previous = null, now }) {
  const evaluated = {
    credentialId: credential.credentialId,
    accountId: account.accountId,
    providerId: account.providerId,
    providerCredentialType: credential.providerCredentialType ?? observation.providerCredentialType ?? null,
    status: safeStatus(observation.detailedState),
    freshness: 'fresh',
    detailedState: observation.detailedState,
    observedAt: iso(observation.observedAt, 'observation.observedAt'),
    freshnessDeadline: new Date(epoch(observation.observedAt, 'observation.observedAt') + verificationPolicy.freshnessSeconds * 1000).toISOString(),
    evaluationStatus: 'verified',
    conditionCodes: safeArray(observation.conditionCodes).length > 0 ? safeArray(observation.conditionCodes) : defaultConditionForState(observation.detailedState),
    cadenceSeconds: lifecyclePolicy.verificationCadenceSeconds,
    backoffSeconds: verificationPolicy.backoffSeconds,
    consecutiveTransientFailures: isTransientDetailedState(observation.detailedState) ? (previous?.consecutiveTransientFailures ?? 0) + 1 : 0,
    missedIntervals: previous?.nextDueAt && epoch(now, 'now') > epoch(previous.nextDueAt, 'previous.nextDueAt')
      ? Math.min(1000, Math.floor((epoch(now, 'now') - epoch(previous.nextDueAt, 'previous.nextDueAt')) / (lifecyclePolicy.verificationCadenceSeconds * 1000)))
      : 0,
    lastAttemptAt: iso(now, 'now'),
    nextDueAt: null,
    ...copyObservationFields(observation),
    provenance: {
      source: 'ikhp-identity-access-health-orchestrator',
      readOnly: true,
      authority: 'derived-runtime',
    },
  };
  const withExpiry = applyDeclaredExpiry(evaluated, credential, verificationPolicy, now);
  const transient = isTransientDetailedState(withExpiry.detailedState);
  const failureNumber = withExpiry.consecutiveTransientFailures;
  const exponential = Math.min(24 * 60 * 60, verificationPolicy.backoffSeconds * (2 ** Math.max(0, failureNumber - 1)));
  const providerRetry = withExpiry.rateLimit?.retryAfterSeconds ?? 0;
  const delaySeconds = transient ? Math.max(verificationPolicy.backoffSeconds, exponential, providerRetry) : lifecyclePolicy.verificationCadenceSeconds;
  return { ...withExpiry, nextDueAt: new Date(epoch(now, 'now') + delaySeconds * 1000).toISOString() };
}

export function materializeEvaluation({ credential, account, verificationPolicy, lifecyclePolicy, previous = null, now }) {
  const nowIso = iso(now, 'now');
  if (!previous) {
    return {
      credentialId: credential.credentialId,
      accountId: account.accountId,
      providerId: account.providerId,
      providerCredentialType: credential.providerCredentialType ?? null,
      status: 'unknown',
      freshness: 'unknown',
      detailedState: 'unknown',
      observedAt: null,
      freshnessDeadline: null,
      evaluationStatus: 'not_verified',
      conditionCodes: ['identity_verification_never_performed'],
      cadenceSeconds: lifecyclePolicy.verificationCadenceSeconds,
      backoffSeconds: verificationPolicy.backoffSeconds,
      consecutiveTransientFailures: 0,
      missedIntervals: 0,
      lastAttemptAt: null,
      nextDueAt: nowIso,
      expectedPrincipalMatch: 'unknown',
      observedPrincipalLabel: null,
      observedScopeSummary: [],
      scopeEvidence: 'unknown',
      observedExpiresAt: credential.expiryState === 'known' ? credential.expiresAt : null,
      expiryMetadataSource: credential.expiryState === 'known' ? 'user_declared' : 'unknown',
      refreshAvailable: null,
      providerReasonCode: null,
      rateLimit: null,
      checks: [],
      provenance: { source: 'ikhp-identity-access-health-orchestrator', readOnly: true, authority: 'derived-runtime' },
    };
  }
  if (previous.nextDueAt && Number.isFinite(Date.parse(previous.nextDueAt)) && epoch(now, 'now') < epoch(previous.nextDueAt, 'previous.nextDueAt')) {
    return { ...previous, evaluationStatus: 'not_due' };
  }
  const observedAtMs = previous.observedAt ? epoch(previous.observedAt, 'previous.observedAt') : NaN;
  const deadlineMs = previous.freshnessDeadline ? epoch(previous.freshnessDeadline, 'previous.freshnessDeadline') : NaN;
  if (Number.isFinite(observedAtMs) && Number.isFinite(deadlineMs) && epoch(now, 'now') <= deadlineMs) {
    return { ...previous, evaluationStatus: 'not_due', freshness: 'fresh' };
  }
  const staleHealthy = previous.status === 'healthy' || previous.detailedState === 'verified_healthy';
  const conditionCodes = [...new Set([...(staleHealthy ? [] : (previous.conditionCodes ?? [])), 'identity_verification_stale'])];
  const missedIntervals = previous.nextDueAt && Number.isFinite(Date.parse(previous.nextDueAt))
    ? Math.min(1000, Math.floor(Math.max(0, epoch(now, 'now') - epoch(previous.nextDueAt, 'previous.nextDueAt')) / (lifecyclePolicy.verificationCadenceSeconds * 1000)))
    : 0;
  return {
    ...previous,
    status: staleHealthy ? 'unknown' : previous.status,
    freshness: 'stale',
    detailedState: staleHealthy ? 'unknown' : previous.detailedState,
    evaluationStatus: 'overdue',
    conditionCodes,
    missedIntervals,
    nextDueAt: nowIso,
    provenance: { source: 'ikhp-identity-access-health-orchestrator', readOnly: true, authority: 'derived-runtime' },
  };
}

export function toInfrastructureObservation(evaluation, now) {
  const observedAt = evaluation.observedAt ?? iso(now, 'now');
  const safeFreshness = ['fresh', 'stale', 'unknown'].includes(evaluation.freshness) ? evaluation.freshness : 'unknown';
  const safeStatusValue = safeFreshness === 'fresh' ? safeStatus(evaluation.detailedState) : evaluation.status === 'healthy' ? 'unknown' : evaluation.status;
  const safeStatusSet = new Set(['healthy', 'degraded', 'unhealthy', 'unknown']);
  return {
    schemaVersion: '1.0.0',
    observationId: `observation:${credentialResourceId(evaluation.credentialId)}:${safeString(evaluation.evaluationStatus, 64) ?? 'unknown'}:${observedAt}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
    resourceId: credentialResourceId(evaluation.credentialId),
    providerId: evaluation.providerId ?? 'identity-access',
    observedAt,
    status: safeStatusSet.has(safeStatusValue) ? safeStatusValue : 'unknown',
    freshness: safeFreshness,
    sourceEntityId: evaluation.accountId ?? null,
    metricsSummary: {
      detailedState: evaluation.detailedState,
      evaluationStatus: evaluation.evaluationStatus,
      nextDueAt: evaluation.nextDueAt,
      missedIntervals: evaluation.missedIntervals,
      consecutiveTransientFailures: evaluation.consecutiveTransientFailures,
    },
    conditionCodes: safeArray(evaluation.conditionCodes),
    provenance: { source: 'ikhp-identity-access-health-orchestrator', readOnly: true, authority: 'derived-runtime' },
  };
}

export function isDue(evaluation, now) {
  return !evaluation?.nextDueAt || epoch(evaluation.nextDueAt, 'nextDueAt') <= epoch(now, 'now');
}
