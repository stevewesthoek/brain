import { validateJsonSchema } from '../context-learning/context-learning-core.mjs';

export const INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION = '1.0.0';

const RAW_ACCESS_KEYS = new Set([
  'value', 'token', 'password', 'apikey', 'api_key', 'privatekey', 'private_key',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'client_secret', 'clientsecret',
]);
const MUTABLE_CAPABILITIES = new Set(['mutate', 'recover']);

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort();
}

function resourceMap(bundle) {
  return new Map((bundle?.resources ?? []).map((resource) => [resource.resourceId, resource]));
}

function scanSafeMetadata(value, label, errors, keyPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSafeMetadata(entry, label, errors, `${keyPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_ACCESS_KEYS.has(key.toLowerCase())) pushUnique(errors, `${label}: forbidden raw-access field ${keyPath}.${key}`);
    scanSafeMetadata(child, label, errors, `${keyPath}.${key}`);
  }
}

function ownerRelations(bundle, sourceId) {
  return (bundle.relations ?? []).filter((relation) =>
    relation.state === 'active' && relation.relationClass === 'owned_by' && relation.sourceId === sourceId);
}

function routeRelations(bundle) {
  return (bundle.relations ?? []).filter((relation) => relation.state === 'active' && relation.relationClass === 'routes_to');
}

function dependencyRelations(bundle, sourceId) {
  return (bundle.relations ?? []).filter((relation) =>
    relation.state === 'active' && relation.relationClass === 'depends_on' && relation.sourceId === sourceId);
}

function identityEntries(identityAccess) {
  if (!identityAccess || typeof identityAccess !== 'object') return null;
  return new Map([
    ...(identityAccess.accounts ?? []).map((entry) => [entry.accountId, { ...entry, identityKind: 'account' }]),
    ...(identityAccess.credentials ?? []).map((entry) => [entry.credentialId, { ...entry, identityKind: 'credential' }]),
    ...(identityAccess.sessions ?? []).map((entry) => [entry.sessionId, { ...entry, identityKind: 'session' }]),
    ...(identityAccess.runtimeProfiles ?? []).map((entry) => [entry.runtimeProfileId, { ...entry, identityKind: 'runtime_profile' }]),
  ]);
}

function identityAccountId(entry) {
  if (!entry) return null;
  return entry.identityKind === 'account' ? entry.accountId : entry.accountId ?? null;
}

function validateIdentityBindings(resource, identityAccess, errors, warnings, coverage) {
  const refs = resource.governance?.identityBindingRefs ?? [];
  if (refs.length === 0) return;
  const entries = identityEntries(identityAccess);
  if (!entries) {
    coverage.identityIssues += refs.length;
    pushUnique(warnings, `identity-access-unavailable:${resource.resourceId}`);
    return;
  }
  const accountIds = new Set();
  for (const ref of refs) {
    const entry = entries.get(ref);
    if (!entry) {
      coverage.identityIssues += 1;
      pushUnique(errors, `identity-binding-missing:${resource.resourceId}:${ref}`);
      continue;
    }
    const accountId = identityAccountId(entry);
    if (accountId) accountIds.add(accountId);
    if (entry.identityKind === 'session' && entry.applicationRef && entry.applicationRef !== resource.resourceId) {
      pushUnique(errors, `identity-session-application-mismatch:${resource.resourceId}:${ref}`);
    }
  }
  if (accountIds.size > 1 && resource.governance.accountCapacity !== 'many') {
    coverage.identityIssues += 1;
    pushUnique(errors, `identity-account-capacity-mismatch:${resource.resourceId}`);
  }
}

function validateResourceGovernance(resource, bundle, resources, identityAccess, errors, warnings, coverage) {
  const governance = resource.governance;
  if (!governance) {
    coverage.unknownAdmission += 1;
    coverage.unknownOwnership += 1;
    coverage.ungovernedResources += 1;
    return;
  }

  const prefix = `resource:${resource.resourceId}`;
  const owner = governance.ownership;
  const lifecycle = governance.lifecycle;
  const isolation = governance.isolation;
  const admitted = governance.admissionState === 'admitted';
  const mutable = (governance.capabilities ?? []).some((capability) => MUTABLE_CAPABILITIES.has(capability));

  if (governance.admissionState === 'unknown') coverage.unknownAdmission += 1;
  if (!owner || owner.ownerState === 'unknown' || owner.ownerState === 'candidate') coverage.unknownOwnership += 1;
  if (!governance.environmentRef) coverage.unknownEnvironment += 1;
  if (governance.accountCapacity === 'unknown') coverage.unknownAccountCapacity += 1;
  if (governance.profileConcurrency === 'unknown') coverage.unknownProfileConcurrency += 1;
  if (!governance.healthPolicyRef || !lifecycle?.recoveryRunbookRef) coverage.missingHealthRecovery += 1;

  if (owner?.authoritativeOwnerRef && !resources.has(owner.authoritativeOwnerRef)) {
    pushUnique(errors, `${prefix}:owner-reference-missing:${owner.authoritativeOwnerRef}`);
  }
  if (owner?.ownerState === 'confirmed' && !owner.authoritativeOwnerRef) {
    pushUnique(errors, `${prefix}:confirmed-owner-without-reference`);
  }
  if (owner?.ownerState === 'conflicted') {
    pushUnique(errors, `${prefix}:ownership-conflicted`);
  }
  if (owner?.custody === 'application' && owner.authoritativeOwnerKind !== 'application') {
    pushUnique(errors, `${prefix}:application-custody-owner-mismatch`);
  }
  if (owner?.mutationAuthority !== 'none' && (owner?.mutationActorRefs ?? []).length === 0) {
    pushUnique(errors, `${prefix}:mutation-authority-without-actor`);
  }
  if ((owner?.mutationActorRefs ?? []).length > 1 && owner.mutationAuthority !== 'explicit-transfer') {
    pushUnique(errors, `${prefix}:competing-mutation-authority`);
  }
  if (mutable && owner?.ownerState !== 'confirmed') {
    pushUnique(errors, `${prefix}:mutable-capability-without-confirmed-owner`);
  }
  if (mutable && owner?.mutationAuthority === 'none') {
    pushUnique(errors, `${prefix}:mutable-capability-without-mutation-authority`);
  }

  if (admitted) {
    if (governance.discovery?.authority !== 'authoritative') pushUnique(errors, `${prefix}:admitted-without-authoritative-discovery`);
    if (!governance.environmentRef) pushUnique(errors, `${prefix}:admitted-without-environment`);
    if (owner?.ownerState !== 'confirmed' || !owner.authoritativeOwnerRef) pushUnique(errors, `${prefix}:admitted-without-confirmed-owner`);
    if (!governance.healthPolicyRef) pushUnique(errors, `${prefix}:admitted-without-health-policy`);
    if (!lifecycle?.recoveryRunbookRef) pushUnique(errors, `${prefix}:admitted-without-recovery-runbook`);
    if (isolation?.mode === 'unknown' || (isolation?.boundaryRefs ?? []).length === 0) pushUnique(errors, `${prefix}:admitted-without-isolation-boundary`);
    if (lifecycle?.activeWorkloadPolicy === 'unknown') pushUnique(errors, `${prefix}:admitted-without-workload-policy`);
  } else if (governance.admissionState === 'candidate') {
    if (owner?.ownerState === 'confirmed' && governance.discovery?.authority === 'authoritative') {
      pushUnique(warnings, `${prefix}:candidate-is-admissible-but-not-admitted`);
    }
    if (mutable) pushUnique(errors, `${prefix}:candidate-exposes-mutation-capability`);
  }

  if (governance.environmentRef && !resources.has(governance.environmentRef)) {
    pushUnique(errors, `${prefix}:environment-reference-missing:${governance.environmentRef}`);
  }
  if (governance.healthPolicyRef && !(bundle.healthPolicies ?? []).some((policy) => policy.healthPolicyId === governance.healthPolicyRef)) {
    pushUnique(errors, `${prefix}:health-policy-reference-missing:${governance.healthPolicyRef}`);
  }
  for (const boundaryRef of isolation?.boundaryRefs ?? []) {
    if (!resources.has(boundaryRef)) pushUnique(errors, `${prefix}:isolation-boundary-missing:${boundaryRef}`);
  }
  validateIdentityBindings(resource, identityAccess, errors, warnings, coverage);

  const owners = ownerRelations(bundle, resource.resourceId);
  if (owners.length > 1) {
    coverage.multipleOwners += 1;
    pushUnique(errors, `${prefix}:multiple-authoritative-owners`);
  }
  if (owners.length === 1 && owner?.authoritativeOwnerRef && owners[0].targetId !== owner.authoritativeOwnerRef) {
    pushUnique(errors, `${prefix}:owner-relation-mismatch`);
  }
  for (const dependency of dependencyRelations(bundle, resource.resourceId)) {
    if (!dependency.governance?.dependency) {
      coverage.dependencyIssues += 1;
      pushUnique(warnings, `${prefix}:dependency-governance-unknown:${dependency.relationId}`);
    }
    const target = resources.get(dependency.targetId);
    if (dependency.governance?.dependency?.class === 'required' && target?.governance?.admissionState !== 'admitted') {
      coverage.dependencyIssues += 1;
      pushUnique(warnings, `${prefix}:required-dependency-not-admitted:${dependency.targetId}`);
    }
  }
}

function validateRoutes(bundle, resources, errors, warnings, coverage) {
  for (const route of routeRelations(bundle)) {
    const routeOwner = route.governance?.routeOwnership;
    const label = `route:${route.relationId}`;
    if (!routeOwner) {
      coverage.unownedRoutes += 1;
      const governedEndpoint = resources.get(route.sourceId)?.governance || resources.get(route.targetId)?.governance;
      pushUnique(governedEndpoint ? errors : warnings, `${label}:unowned-route`);
      continue;
    }
    if (routeOwner.ownerState === 'confirmed' && !routeOwner.ownerRef) {
      coverage.unownedRoutes += 1;
      pushUnique(errors, `${label}:confirmed-route-owner-without-reference`);
    }
    if (routeOwner.ownerRef && !resources.has(routeOwner.ownerRef)) {
      coverage.unownedRoutes += 1;
      pushUnique(errors, `${label}:route-owner-missing:${routeOwner.ownerRef}`);
    }
    if (routeOwner.ownerState !== 'confirmed') {
      coverage.unownedRoutes += 1;
      pushUnique(warnings, `${label}:route-owner-unknown`);
    }
    if ((routeOwner.writerRefs ?? []).length > 1 && routeOwner.mutationAuthority !== 'explicit-transfer') {
      pushUnique(errors, `${label}:competing-route-writers`);
    }
  }
}

function validateEnvironmentIsolation(bundle, resources, errors, coverage) {
  const boundaries = new Map();
  for (const resource of bundle.resources ?? []) {
    const governance = resource.governance;
    for (const boundaryRef of governance?.isolation?.boundaryRefs ?? []) {
      const entries = boundaries.get(boundaryRef) ?? [];
      entries.push(resource);
      boundaries.set(boundaryRef, entries);
    }
  }
  for (const [boundaryRef, entries] of boundaries) {
    const environments = new Set(entries.map((entry) => entry.governance?.environmentRef).filter(Boolean));
    if (environments.size > 1 && entries.some((entry) => entry.governance?.isolation?.mode !== 'shared-approved')) {
      coverage.isolationIssues += 1;
      pushUnique(errors, `environment-isolation-collision:${boundaryRef}`);
    }
  }
}

export function evaluateLifecycleReadiness({ resource, runtimeEvidence = [] } = {}) {
  const lifecycle = resource?.governance?.lifecycle;
  if (!resource || !lifecycle) {
    return { status: 'unknown', safeToProceed: false, code: 'governance_missing', resourceId: resource?.resourceId ?? null };
  }
  if (lifecycle.quiescenceRequired !== true) {
    return { status: 'not_required', safeToProceed: true, code: null, resourceId: resource.resourceId };
  }
  const evidence = runtimeEvidence.find((entry) => entry.resourceId === resource.resourceId);
  if (!evidence) {
    return { status: 'unknown', safeToProceed: false, code: 'runtime_evidence_missing', resourceId: resource.resourceId };
  }
  if (evidence.workloadState === 'active' || (lifecycle.activeWorkloadPolicy === 'lease_required' && Number(evidence.activeLeaseCount ?? 0) > 0)) {
    return { status: 'blocked', safeToProceed: false, code: 'active_workload_or_lease', resourceId: resource.resourceId };
  }
  if (evidence.workloadState === 'idle') {
    if (lifecycle.activeWorkloadPolicy === 'lease_required' && evidence.activeLeaseCount === null) {
      return { status: 'unknown', safeToProceed: false, code: 'lease_evidence_missing', resourceId: resource.resourceId };
    }
    return { status: 'ready', safeToProceed: true, code: null, resourceId: resource.resourceId };
  }
  return { status: 'unknown', safeToProceed: false, code: 'workload_state_unknown', resourceId: resource.resourceId };
}

export function validateInfrastructureGovernance({ schema, bundle, identityAccess = null, runtimeEvidence = [], now = new Date(), label = 'catalog' } = {}) {
  const errors = [];
  const warnings = [];
  const resources = resourceMap(bundle);
  const coverage = {
    totalResources: bundle?.resources?.length ?? 0,
    governedResources: 0,
    ungovernedResources: 0,
    admitted: 0,
    candidates: 0,
    rejectedOrRetired: 0,
    unknownAdmission: 0,
    unknownOwnership: 0,
    unknownEnvironment: 0,
    multipleOwners: 0,
    unownedRoutes: 0,
    missingHealthRecovery: 0,
    dependencyIssues: 0,
    isolationIssues: 0,
    identityIssues: 0,
    quiescenceUnknown: 0,
    unknownAccountCapacity: 0,
    unknownProfileConcurrency: 0,
    staleEvidence: 0,
  };

  if (schema) errors.push(...validateJsonSchema(schema.$defs.catalogBundle, bundle, schema, `$${label}`));
  scanSafeMetadata(bundle, label, errors);
  for (const resource of bundle?.resources ?? []) {
    if (resource.governance) {
      coverage.governedResources += 1;
      if (resource.governance.admissionState === 'admitted') coverage.admitted += 1;
      else if (resource.governance.admissionState === 'candidate') coverage.candidates += 1;
      else coverage.rejectedOrRetired += 1;
      validateResourceGovernance(resource, bundle, resources, identityAccess, errors, warnings, coverage);
      const readiness = evaluateLifecycleReadiness({ resource, runtimeEvidence });
      if (readiness.status === 'unknown' && resource.governance.lifecycle.quiescenceRequired) coverage.quiescenceUnknown += 1;
    } else {
      coverage.ungovernedResources += 1;
      coverage.unknownAdmission += 1;
      coverage.unknownOwnership += 1;
      coverage.unknownEnvironment += 1;
    }
    const deadline = Date.parse(resource.provenance?.freshnessDeadline ?? '');
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (Number.isFinite(deadline) && Number.isFinite(nowMs) && deadline < nowMs) coverage.staleEvidence += 1;
  }
  validateRoutes(bundle, resources, errors, warnings, coverage);
  validateEnvironmentIsolation(bundle, resources, errors, coverage);

  for (const resource of bundle?.resources ?? []) {
    if (resource.governance?.admissionState === 'admitted' && !resource.governance.ownership?.verifierRefs?.length) {
      pushUnique(warnings, `resource:${resource.resourceId}:no-verifier-reference`);
    }
  }

  return {
    schemaVersion: INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION,
    label,
    errors: sortedUnique(errors),
    warnings: sortedUnique(warnings),
    counts: coverage,
    coverage: {
      ...coverage,
      ownershipCoverage: coverage.totalResources === 0 ? 1 : (coverage.totalResources - coverage.unknownOwnership) / coverage.totalResources,
      admissionCoverage: coverage.totalResources === 0 ? 1 : (coverage.totalResources - coverage.unknownAdmission) / coverage.totalResources,
      routeOwnershipCoverage: coverage.unownedRoutes === 0 ? 1 : 0,
      healthRecoveryCoverage: coverage.governedResources === 0
        ? (coverage.ungovernedResources === 0 ? 1 : 0)
        : (coverage.governedResources - coverage.missingHealthRecovery) / coverage.governedResources,
    },
    readOnly: true,
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
    containsSecrets: false,
  };
}

export function planInfrastructureAdmission({ resourceId, bundle, identityAccess = null, now = new Date() } = {}) {
  const resource = (bundle?.resources ?? []).find((entry) => entry.resourceId === resourceId);
  if (!resource) {
    return { schemaVersion: INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION, resourceId, decision: 'blocked', reasons: ['resource_missing'], changes: [], executionEnabled: false, executionPerformed: false, containsSecrets: false };
  }
  const governance = resource.governance;
  if (!governance) {
    return { schemaVersion: INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION, resourceId, decision: 'blocked', reasons: ['governance_missing'], changes: [], executionEnabled: false, executionPerformed: false, containsSecrets: false };
  }
  if (governance.admissionState !== 'candidate') {
    return { schemaVersion: INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION, resourceId, decision: 'no_op', currentState: governance.admissionState, reasons: [], changes: [], executionEnabled: false, executionPerformed: false, containsSecrets: false };
  }
  const reasons = [];
  if (governance.discovery?.authority !== 'authoritative') reasons.push('discovery_not_authoritative');
  if (governance.ownership?.ownerState !== 'confirmed' || !governance.ownership?.authoritativeOwnerRef) reasons.push('owner_unresolved');
  if (!governance.environmentRef) reasons.push('environment_unresolved');
  if (!governance.healthPolicyRef) reasons.push('health_policy_missing');
  if (!governance.lifecycle?.recoveryRunbookRef) reasons.push('recovery_runbook_missing');
  if (governance.isolation?.mode === 'unknown' || !(governance.isolation?.boundaryRefs ?? []).length) reasons.push('isolation_unresolved');
  const report = validateInfrastructureGovernance({ bundle, identityAccess, now, label: 'admission-plan' });
  if (report.errors.some((error) => error.includes(resourceId))) reasons.push('resource_validation_failed');
  const uniqueReasons = sortedUnique(reasons);
  const admit = uniqueReasons.length === 0;
  return {
    schemaVersion: INFRASTRUCTURE_GOVERNANCE_SCHEMA_VERSION,
    resourceId,
    decision: admit ? 'admit' : 'remain_candidate',
    reasons: uniqueReasons,
    changes: admit ? [{ path: 'governance.admissionState', from: 'candidate', to: 'admitted' }] : [],
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
    containsSecrets: false,
  };
}
