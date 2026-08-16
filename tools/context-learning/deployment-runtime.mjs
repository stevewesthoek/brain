import crypto from 'node:crypto';

export const DEPLOYMENT_SCHEMA_VERSION = '1.0.0';
export const PROFILE_KINDS = Object.freeze([
  'personal-local',
  'personal-dual-host',
  'business-single-tenant',
  'managed-single-tenant',
]);
export const LIFECYCLE_OPERATIONS = Object.freeze(['install', 'update', 'export', 'backup', 'rollback']);
const SAFE_EXCLUDES = Object.freeze([
  'secrets',
  'raw_private_evidence',
  'derived_indexes',
  'caches',
  'runtime_sessions',
]);

export function chooseTransport(candidates = [], observations = {}) {
  const ordered = [...candidates]
    .filter((candidate) => candidate?.enabled === true)
    .sort((a, b) => a.priority - b.priority || String(a.transportId).localeCompare(String(b.transportId)));

  for (const candidate of ordered) {
    const observation = observations[candidate.transportId] ?? {};
    if (observation.available === true && observation.healthy !== false) {
      return {
        status: 'available',
        transportId: candidate.transportId,
        adapterRef: candidate.adapterRef,
        configRef: candidate.configRef ?? null,
        priority: candidate.priority,
      };
    }
  }

  return {
    status: 'unavailable',
    transportId: null,
    adapterRef: null,
    configRef: null,
    priority: null,
  };
}

export function evaluateLastKnownGood(cacheEntry, policy, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (Number.isNaN(now.getTime())) throw new Error('evaluateLastKnownGood requires a valid now value');
  if (!cacheEntry || policy?.enabled !== true) {
    return { state: 'missing', ageSeconds: null, sourceRevision: null, usable: false };
  }

  const capturedAt = Date.parse(cacheEntry.capturedAt ?? '');
  if (!Number.isFinite(capturedAt)) {
    return {
      state: 'invalid',
      ageSeconds: null,
      sourceRevision: cacheEntry.sourceRevision ?? null,
      usable: false,
    };
  }

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - capturedAt) / 1000));
  const revisionOk = policy.requireSourceRevision !== true
    || (typeof cacheEntry.sourceRevision === 'string' && cacheEntry.sourceRevision.length > 0);
  if (!revisionOk) {
    return { state: 'invalid', ageSeconds, sourceRevision: null, usable: false };
  }

  if (ageSeconds <= policy.maxAgeSeconds) {
    return { state: 'fresh-cache', ageSeconds, sourceRevision: cacheEntry.sourceRevision ?? null, usable: true };
  }
  if (ageSeconds <= policy.maxAgeSeconds * 2) {
    return { state: 'stale-cache', ageSeconds, sourceRevision: cacheEntry.sourceRevision ?? null, usable: true };
  }
  return { state: 'expired-cache', ageSeconds, sourceRevision: cacheEntry.sourceRevision ?? null, usable: false };
}

export function evaluateAccessRequirement({
  scope,
  liveAvailable,
  liveFresh,
  cacheState,
  cachePolicy,
}) {
  const failClosed = (cachePolicy?.failClosedScopes ?? []).includes(scope);
  if (liveAvailable === true && liveFresh === true) {
    return { allowed: true, mode: 'live', reason: 'current-live-authority' };
  }
  if (failClosed) {
    return { allowed: false, mode: 'blocked', reason: `fresh-${scope}-required` };
  }
  if (cacheState?.usable === true) {
    return {
      allowed: true,
      mode: 'last-known-good',
      reason: `${cacheState.state}:${cacheState.ageSeconds}s`,
    };
  }
  return { allowed: false, mode: 'blocked', reason: 'no-usable-context' };
}

export function buildDoctorReport(profile, observations = {}, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (Number.isNaN(now.getTime())) throw new Error('buildDoctorReport requires a valid now value');

  const hosts = (profile.hosts ?? []).map((host) => ({
    hostId: host.hostId,
    role: host.role,
    transport: chooseTransport(host.transports ?? [], observations.transports ?? {}),
  }));
  const providers = (profile.providers ?? []).map((provider) => {
    const observed = observations.providers?.[provider.providerId] ?? {};
    return {
      providerId: provider.providerId,
      role: provider.role,
      authoritative: provider.authoritative === true,
      health: observed.health ?? 'unknown',
      sourceRevision: observed.sourceRevision ?? null,
    };
  });

  return {
    schemaVersion: DEPLOYMENT_SCHEMA_VERSION,
    profileId: profile.profileId,
    profileKind: profile.profileKind,
    checkedAt: now.toISOString(),
    readOnly: true,
    hosts,
    providers,
    broker: {
      transport: profile.broker?.transport ?? null,
      endpointRef: profile.broker?.endpointRef ?? null,
    },
    lifecycleMutationPerformed: false,
  };
}

export function validateLifecyclePlan(plan) {
  const errors = [];
  if (!LIFECYCLE_OPERATIONS.includes(plan?.operation)) errors.push('unsupported lifecycle operation');
  if (plan?.schemaVersion !== DEPLOYMENT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${DEPLOYMENT_SCHEMA_VERSION}`);
  }
  if (plan?.dryRun !== true) errors.push('CLR4 lifecycle plans must be dry-run only');
  if (!plan?.receiptRef) errors.push('receiptRef is required');
  if (!plan?.rollbackRef) errors.push('rollbackRef is required');

  if (['export', 'backup'].includes(plan?.operation)) {
    const excludes = new Set(plan?.excludeClasses ?? []);
    for (const required of SAFE_EXCLUDES) {
      if (!excludes.has(required)) errors.push(`safe export/backup must exclude ${required}`);
    }
  }
  return errors;
}

export function createSafeLifecyclePlan({ operation, profileId, receiptRef, rollbackRef }) {
  return {
    schemaVersion: DEPLOYMENT_SCHEMA_VERSION,
    operation,
    profileId,
    dryRun: true,
    receiptRef,
    rollbackRef,
    excludeClasses: ['export', 'backup'].includes(operation) ? [...SAFE_EXCLUDES] : [],
    mutationAuthorized: false,
  };
}



export function createDryRunLifecycleReceipt({
  plan,
  status = 'validated',
  createdAt = new Date(),
  blockedReason = null,
}) {
  const timestamp = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error('createDryRunLifecycleReceipt requires a valid createdAt');
  const validationErrors = validateLifecyclePlan(plan);
  const effectiveStatus = validationErrors.length > 0 ? 'blocked' : status;
  const planHash = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return {
    schemaVersion: DEPLOYMENT_SCHEMA_VERSION,
    operation: plan?.operation,
    profileId: plan?.profileId,
    mode: 'dry-run',
    status: effectiveStatus === 'blocked' ? 'blocked' : 'validated',
    createdAt: timestamp.toISOString(),
    writesPerformed: false,
    planHash,
    rollbackRef: plan?.rollbackRef ?? '',
    blockedReason: effectiveStatus === 'blocked'
      ? (blockedReason ?? (validationErrors.join('; ') || 'lifecycle plan blocked'))
      : null,
  };
}
