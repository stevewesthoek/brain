import { stableJsonHash, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

export const OBSERVATION_ADAPTER_CONTRACT_VERSION = '1.0.0';
export const CANDIDATE_SCHEMA_VERSION = '1.0.0';

const RAW_ACCESS_KEYS = new Set([
  'value', 'token', 'password', 'secret', 'apikey', 'api_key', 'privatekey', 'private_key',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'client_secret', 'clientsecret',
]);

const GENERIC_OBSERVATION_KINDS = new Set(['discovery', 'runtime', 'relationship', 'lifecycle', 'identity_access']);
const REQUIRED_GENERIC_OBSERVATION_FIELDS = [
  'observer', 'candidateId', 'environment', 'runtimeIdentity', 'processEvidence',
  'endpointEvidence', 'ownershipEvidence', 'dependencyEvidence', 'identityBindingEvidence',
  'healthCapability', 'lifecycleCapability', 'isolationEvidence', 'redaction',
];
const EVIDENCE_STATES = new Set(['confirmed', 'candidate', 'unknown', 'conflicted', 'not_applicable']);
const ADMISSION_READY_STATES = new Set(['confirmed', 'not_applicable']);

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort();
}

function scanRawAccessKeys(value, label, errors, keyPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanRawAccessKeys(entry, label, errors, `${keyPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_ACCESS_KEYS.has(key.toLowerCase())) pushUnique(errors, `${label}: forbidden raw-access field ${keyPath}.${key}`);
    scanRawAccessKeys(child, label, errors, `${keyPath}.${key}`);
  }
}

function validDate(value) {
  return Number.isFinite(Date.parse(value ?? ''));
}

function iso(value, label) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return new Date(parsed).toISOString();
}

function deadlineFrom(observedAt, freshnessSeconds) {
  const seconds = Number.isInteger(freshnessSeconds) && freshnessSeconds > 0 ? freshnessSeconds : 300;
  return new Date(Date.parse(observedAt) + seconds * 1000).toISOString();
}

function evidenceState(evidence, field) {
  return evidence?.[field]?.state ?? 'unknown';
}

function readinessReason(field, state) {
  if (state === 'conflicted') return `${field}_conflicted`;
  if (state === 'unknown') return `${field}_unknown`;
  if (state === 'candidate') return `${field}_unresolved`;
  return null;
}

function validateBindingCandidate(binding, label = 'binding') {
  const errors = [];
  if (!binding || typeof binding !== 'object') return [`${label}: binding must be an object`];
  if (binding.subjectRef === binding.targetRef) errors.push(`${label}: subject and target must differ`);
  if (binding.observedTargetRef && binding.observedTargetRef !== binding.targetRef && binding.state !== 'conflicted') {
    errors.push(`${label}: observed target mismatch requires conflicted state`);
  }
  if (binding.state === 'confirmed' && !['OBSERVED-VERIFIED', 'DERIVED-VERIFIED'].includes(binding.provenance?.classification)) {
    errors.push(`${label}: confirmed binding requires observed or derived provenance`);
  }
  if (binding.state === 'candidate' && binding.provenance?.classification !== 'USER-PROPOSED') {
    errors.push(`${label}: candidate binding requires USER-PROPOSED provenance`);
  }
  const observedAt = Date.parse(binding.provenance?.observedAt ?? '');
  const expiresAt = binding.expiresAt === null ? null : Date.parse(binding.expiresAt ?? '');
  if (expiresAt !== null && Number.isFinite(observedAt) && Number.isFinite(expiresAt) && expiresAt < observedAt) {
    errors.push(`${label}: expiresAt precedes observedAt`);
  }
  return sortedUnique(errors);
}

export function createObservationAdapter({
  observerId,
  adapterKind,
  adapterVersion = OBSERVATION_ADAPTER_CONTRACT_VERSION,
  capabilities = ['discover', 'observe', 'verify_relationship'],
  discover,
  observe,
  verifyRelationship,
} = {}) {
  if (typeof observerId !== 'string' || !/^[a-z][a-z0-9._-]*$/.test(observerId)) throw new Error('observerId is invalid');
  if (typeof adapterKind !== 'string' || !/^[a-z][a-z0-9._-]*$/.test(adapterKind)) throw new Error('adapterKind is invalid');
  if (typeof adapterVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(adapterVersion)) throw new Error('adapterVersion is invalid');
  if (typeof discover !== 'function' || typeof observe !== 'function' || typeof verifyRelationship !== 'function') {
    throw new Error('observation adapter requires discover, observe, and verifyRelationship functions');
  }
  return Object.freeze({
    observerId,
    adapterKind,
    adapterVersion,
    capabilities: sortedUnique(capabilities),
    discover,
    observe,
    verifyRelationship,
  });
}

export function validateObservationContract({ observation, schema, label = 'observation' } = {}) {
  const errors = [];
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return [`${label}: observation must be an object`];
  }
  if (schema) errors.push(...validateJsonSchema(schema.$defs.observation, observation, schema, `$${label}`));
  scanRawAccessKeys(observation, label, errors);
  if (observation.provenance?.readOnly !== true) pushUnique(errors, `${label}: provenance must be read-only`);
  if (observation.redaction && observation.redaction.secretsExcluded !== true) pushUnique(errors, `${label}: redaction must exclude secrets`);
  if (GENERIC_OBSERVATION_KINDS.has(observation.observationKind)) {
    for (const field of REQUIRED_GENERIC_OBSERVATION_FIELDS) {
      if (!Object.hasOwn(observation, field)) pushUnique(errors, `${label}: generic observation missing ${field}`);
    }
  }
  if (observation.environment && !EVIDENCE_STATES.has(observation.environment.state)) pushUnique(errors, `${label}: invalid environment evidence state`);
  return sortedUnique(errors);
}

export function createCandidate({
  candidateId,
  proposedResourceId = null,
  resourceClass,
  resourceKind,
  admissionState = 'candidate',
  identityStability = 'unknown',
  freshness = 'unknown',
  observationIds = [],
  evidence,
  observedAt,
  freshnessSeconds = 300,
  binding = null,
  provenanceSource,
  provenanceClassification = 'OBSERVED-VERIFIED',
  provenanceOwner = 'infrastructure-observer',
  provenanceEvidenceRefs = [],
} = {}) {
  const observedIso = iso(observedAt ?? new Date(), 'observedAt');
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    candidateId,
    proposedResourceId,
    resourceClass,
    resourceKind,
    admissionState,
    identityStability,
    freshness,
    observationIds: sortedUnique(observationIds),
    evidence: {
      identity: evidence?.identity ?? 'unknown',
      environment: evidence?.environment ?? 'unknown',
      ownership: evidence?.ownership ?? 'unknown',
      dependencies: evidence?.dependencies ?? 'unknown',
      health: evidence?.health ?? 'unknown',
      lifecycle: evidence?.lifecycle ?? 'unknown',
      isolation: evidence?.isolation ?? 'unknown',
      credentialCustody: evidence?.credentialCustody ?? 'unknown',
      routeOwnership: evidence?.routeOwnership ?? 'unknown',
      conflicts: sortedUnique(evidence?.conflicts ?? []),
    },
    ...(binding ? { binding } : {}),
    provenance: {
      sourceRef: provenanceSource ?? 'infrastructure-observer',
      classification: provenanceClassification,
      observedAt: observedIso,
      freshnessDeadline: deadlineFrom(observedIso, freshnessSeconds),
      owner: provenanceOwner,
      evidenceRefs: sortedUnique(provenanceEvidenceRefs),
      readOnly: true,
    },
    redaction: {
      classification: 'non-secret-allowlisted',
      secretsExcluded: true,
      excludedClasses: ['access_values', 'oauth_tokens', 'cookies', 'authorization_headers', 'passwords'],
    },
  };
}

export function candidateFromObservation(observation, {
  proposedResourceId = null,
  resourceKind = 'observed-resource',
  provenanceOwner = 'infrastructure-observer',
} = {}) {
  const runtime = observation.runtimeIdentity ?? {};
  const evidence = {
    identity: runtime.state ?? 'unknown',
    environment: observation.environment?.state ?? 'unknown',
    ownership: observation.ownershipEvidence?.state ?? 'unknown',
    dependencies: observation.dependencyEvidence?.state ?? 'unknown',
    health: observation.healthCapability?.state ?? 'unknown',
    lifecycle: observation.lifecycleCapability?.state ?? 'unknown',
    isolation: observation.isolationEvidence?.state ?? 'unknown',
    credentialCustody: observation.identityBindingEvidence?.custody === 'unknown'
      ? 'unknown'
      : observation.identityBindingEvidence?.state ?? 'unknown',
    routeOwnership: observation.routeOwnershipEvidence?.state ?? 'not_applicable',
    conflicts: [
      ...(observation.conditionCodes ?? []).filter((code) => /conflict|ambiguous|collision/i.test(code)),
      ...(observation.ownershipEvidence?.state === 'conflicted' ? ['ownership_conflict'] : []),
      ...(observation.routeOwnershipEvidence?.state === 'conflicted' ? ['route_ownership_conflict'] : []),
    ],
  };
  return createCandidate({
    candidateId: observation.candidateId,
    proposedResourceId,
    resourceClass: observation.resourceId.split(':', 1)[0],
    resourceKind: runtime.runtimeKind ?? resourceKind,
    admissionState: 'candidate',
    identityStability: runtime.identityStability ?? 'unknown',
    freshness: observation.freshness,
    observationIds: [observation.observationId],
    evidence,
    observedAt: observation.observedAt,
    freshnessSeconds: Math.max(1, Math.floor((Date.parse(observation.provenance?.freshnessDeadline ?? '') - Date.parse(observation.observedAt)) / 1000)) || 300,
    provenanceSource: observation.provenance?.source ?? 'infrastructure-observer',
    provenanceClassification: observation.provenance?.classification ?? 'OBSERVED-VERIFIED',
    provenanceOwner,
    provenanceEvidenceRefs: observation.provenance?.evidenceRefs ?? [],
  });
}

export function validateCandidateContract(candidate, { schema, label = 'candidate' } = {}) {
  const errors = [];
  if (schema) errors.push(...validateJsonSchema(schema.$defs.candidate, candidate, schema, `$${label}`));
  scanRawAccessKeys(candidate, label, errors);
  if (candidate?.binding) errors.push(...validateBindingCandidate(candidate.binding, `${label}.binding`));
  return sortedUnique(errors);
}

export function createBindingCandidate({
  candidateId,
  relationshipKind,
  subjectRef,
  targetRef,
  state = 'candidate',
  proposedResourceId = subjectRef ?? null,
  resourceKind = 'identity-binding',
  evidence,
  observedAt,
  freshnessSeconds = 300,
  provenanceSource = 'identity-access-observer',
  provenanceClassification = 'USER-PROPOSED',
  provenanceOwner = 'identity-access-observer',
  provenanceEvidenceRefs = [],
  expiresAt = null,
  observedTargetRef = null,
} = {}) {
  const observedIso = iso(observedAt ?? new Date(), 'observedAt');
  return createCandidate({
    candidateId,
    proposedResourceId,
    resourceClass: 'runtime_profile',
    resourceKind,
    admissionState: 'candidate',
    identityStability: 'profile-scoped',
    freshness: 'fresh',
    observationIds: [`observation:${candidateId.replace(/^candidate:/, '')}`],
    evidence: {
      identity: 'confirmed',
      environment: 'confirmed',
      ownership: 'confirmed',
      dependencies: 'not_applicable',
      health: 'not_applicable',
      lifecycle: 'confirmed',
      isolation: evidence?.isolation ?? 'unknown',
      credentialCustody: evidence?.credentialCustody ?? 'not_applicable',
      routeOwnership: 'not_applicable',
      conflicts: evidence?.conflicts ?? [],
    },
    binding: {
      relationshipKind,
      subjectRef,
      targetRef,
      observedTargetRef,
      state,
      expiresAt,
      provenance: {
        sourceRef: provenanceSource,
        classification: provenanceClassification,
        observedAt: observedIso,
        freshnessDeadline: deadlineFrom(observedIso, freshnessSeconds),
        owner: provenanceOwner,
        evidenceRefs: sortedUnique(provenanceEvidenceRefs),
        readOnly: true,
      },
    },
    observedAt: observedIso,
    freshnessSeconds,
    provenanceSource,
    provenanceClassification,
    provenanceOwner,
    provenanceEvidenceRefs,
  });
}

export function planCandidateAdmission({ candidate, observationIds = candidate?.observationIds ?? [], now = new Date() } = {}) {
  const reasons = [];
  if (!candidate || typeof candidate !== 'object') {
    return {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      candidateId: 'candidate:missing',
      decision: 'blocked',
      reasons: ['candidate_missing'],
      changes: [],
      executionEnabled: false,
      executionPerformed: false,
      actualEffects: [],
      containsSecrets: false,
    };
  }
  if (candidate.admissionState !== 'candidate') {
    return {
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      candidateId: candidate.candidateId,
      decision: 'no_op',
      reasons: [],
      changes: [],
      executionEnabled: false,
      executionPerformed: false,
      actualEffects: [],
      containsSecrets: false,
    };
  }
  if (candidate.freshness !== 'fresh') reasons.push('evidence_not_fresh');
  if (!candidate.proposedResourceId) reasons.push('resource_identity_unresolved');
  if (!['stable', 'profile-scoped'].includes(candidate.identityStability)) reasons.push('identity_unstable');
  for (const field of ['identity', 'environment', 'ownership', 'dependencies', 'health', 'lifecycle', 'isolation', 'credentialCustody', 'routeOwnership']) {
    const state = candidate.evidence?.[field] ?? 'unknown';
    const reason = readinessReason(field, state);
    if (reason) reasons.push(reason);
    if (!ADMISSION_READY_STATES.has(state) && !reason) reasons.push(`${field}_not_ready`);
  }
  if ((candidate.evidence?.conflicts ?? []).length > 0) reasons.push('conflict_detected');
  if (candidate.binding) {
    if (candidate.binding.state === 'conflicted') reasons.push('conflict_detected');
    else if (candidate.binding.state !== 'confirmed') reasons.push('binding_not_verified');
  }
  const uniqueReasons = sortedUnique(reasons);
  const decision = uniqueReasons.includes('conflict_detected') ? 'reject' : uniqueReasons.length > 0 ? 'remain_candidate' : 'admit';
  const observedAt = candidate.provenance?.observedAt ?? new Date(now).toISOString();
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    candidateId: candidate.candidateId,
    decision,
    reasons: uniqueReasons,
    changes: decision === 'admit'
      ? [{ path: 'admissionState', from: 'candidate', to: 'admitted' }, { path: 'resourceId', from: null, to: candidate.proposedResourceId }]
      : [],
    observationIds: sortedUnique(observationIds),
    observedAt,
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
    containsSecrets: false,
  };
}

function backlogReasonsForResource(resource, routeResourceIds) {
  if (!resource.governance) {
    const reasons = ['governance_unknown', 'owner_unknown', 'environment_unknown', 'identity_binding_unknown', 'runtime_adapter_unknown', 'health_adapter_unknown', 'recovery_policy_unknown', 'isolation_unknown'];
    if (routeResourceIds.has(resource.resourceId)) reasons.push('route_ownership_unknown');
    if (resource.resourceClass === 'credential_reference') reasons.push('credential_custody_unknown');
    return sortedUnique(reasons);
  }
  const governance = resource.governance;
  const reasons = [];
  if (governance.ownership?.ownerState !== 'confirmed') reasons.push('owner_unknown');
  if (governance.environmentClass === 'unknown' || !governance.environmentRef) reasons.push('environment_unknown');
  if (!governance.runtimeAdapterRef) reasons.push('runtime_adapter_unknown');
  if (!governance.healthPolicyRef) reasons.push('health_adapter_unknown');
  if (!governance.lifecycle?.recoveryRunbookRef) reasons.push('recovery_policy_unknown');
  if (governance.isolation?.mode === 'unknown' || !(governance.isolation?.boundaryRefs ?? []).length) reasons.push('isolation_unknown');
  if (!(governance.identityBindingRefs ?? []).length && resource.resourceClass === 'credential_reference') reasons.push('identity_binding_unknown');
  if (routeResourceIds.has(resource.resourceId) && governance.ownership?.ownerState !== 'confirmed') reasons.push('route_ownership_unknown');
  if (governance.admissionState === 'candidate' && reasons.length === 0) reasons.push('admission_pending');
  return sortedUnique(reasons);
}

export function buildOnboardingBacklog({ catalog = {}, candidates = [], observations = [], governanceReport = null, now = new Date() } = {}) {
  const routeResourceIds = new Set((catalog.relations ?? [])
    .filter((relation) => relation.state === 'active' && relation.relationClass === 'routes_to')
    .flatMap((relation) => [relation.sourceId, relation.targetId]));
  const items = [];
  for (const resource of catalog.resources ?? []) {
    const reasons = backlogReasonsForResource(resource, routeResourceIds);
    const status = resource.governance?.admissionState === 'admitted' && reasons.length === 0
      ? 'admitted'
      : resource.governance?.admissionState === 'candidate' ? 'blocked' : 'governance_unknown';
    if (status !== 'admitted') items.push({ itemId: resource.resourceId, subjectKind: 'resource', status, reasons });
  }
  for (const candidate of candidates) {
    const plan = planCandidateAdmission({ candidate, now });
    items.push({
      itemId: candidate.candidateId,
      subjectKind: 'candidate',
      status: plan.decision === 'admit' ? 'observed_candidate' : plan.decision === 'reject' ? 'blocked' : 'observed_candidate',
      reasons: plan.decision === 'admit' ? ['admission_plan_ready'] : plan.reasons,
      observationIds: candidate.observationIds,
    });
  }
  for (const observation of observations) {
    if (!observation.candidateId && observation.observationKind === 'discovery') {
      items.push({ itemId: observation.observationId, subjectKind: 'observation', status: 'unknown', reasons: ['candidate_missing'], observationIds: [observation.observationId] });
    }
  }
  const counts = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    for (const reason of item.reasons) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  if (governanceReport?.counts) {
    counts.governanceUnknown = governanceReport.counts.unknownAdmission ?? 0;
    counts.ownerUnknown = governanceReport.counts.unknownOwnership ?? 0;
    counts.environmentUnknown = governanceReport.counts.unknownEnvironment ?? 0;
  }
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    generatedAt: iso(now, 'now'),
    items: items.sort((a, b) => a.itemId.localeCompare(b.itemId)),
    counts,
    executionEnabled: false,
    containsSecrets: false,
  };
}

export async function runObservationAdapter(adapter, context = {}) {
  const discovered = await adapter.discover(context);
  if (!discovered || typeof discovered !== 'object') throw new Error('observer discover() must return an object');
  const candidates = [...(discovered.candidates ?? [])];
  const observations = [...(discovered.observations ?? [])];
  for (const observation of observations) {
    const errors = validateObservationContract({ observation, schema: context.observationSchema, label: observation.observationId ?? 'observation' });
    if (errors.length > 0) throw new Error(errors.join('; '));
  }
  for (const candidate of candidates) {
    const candidateErrors = validateCandidateContract(candidate, {
      schema: context.candidateSchema,
      label: candidate.candidateId ?? 'candidate',
    });
    if (candidateErrors.length > 0) throw new Error(candidateErrors.join('; '));
  }
  return {
    adapter: {
      observerId: adapter.observerId,
      adapterKind: adapter.adapterKind,
      adapterVersion: adapter.adapterVersion,
      capabilities: adapter.capabilities,
    },
    observedAt: discovered.observedAt ?? null,
    sourceAvailability: discovered.sourceAvailability ?? {},
    summary: discovered.summary ?? null,
    candidates,
    observations,
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
    containsSecrets: false,
  };
}

export function observationHash(observation) {
  return stableJsonHash(observation);
}
