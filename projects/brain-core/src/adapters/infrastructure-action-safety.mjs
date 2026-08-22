import { createHash } from 'node:crypto';

export const INFRASTRUCTURE_ACTION_SCHEMA_VERSION = '1.0.0';

const SUPPORTED_ACTION_TYPES = new Set([
  'inspect',
  'config.change',
  'service.restart',
  'service.deploy',
  'network.route.change',
  'dns.change',
  'tunnel.change',
  'credential.rotate',
  'credential.revoke',
  'backup.policy.change',
  'backup.restore',
  'resource.delete',
  'provider.write',
]);

const READ_ONLY_OPERATIONS = new Set(['inspect', 'diagnose', 'plan', 'propose']);
const HIGH_RISK_ACTION_TYPES = new Set([
  'credential.rotate',
  'credential.revoke',
  'backup.restore',
  'resource.delete',
]);
const PROVIDER_EVIDENCE_ACTION_TYPES = new Set([
  'provider.write',
  'dns.change',
  'tunnel.change',
  'network.route.change',
  'service.deploy',
  'service.restart',
  'credential.rotate',
  'credential.revoke',
  'backup.policy.change',
  'backup.restore',
]);
const HIGH_RISK_RESOURCE_CLASSES = new Set([
  'availability_impacting',
  'auth_sensitive',
  'data_sensitive',
  'destructive',
]);
const REQUIRED_EVIDENCE_TO_CODE = new Map([
  ['expected_revision', 'missing_expected_revision'],
  ['dependency_graph', 'dependency_graph_incomplete'],
  ['current_health', 'current_health_missing'],
  ['backup_evidence', 'backup_evidence_missing'],
  ['dry_run', 'dry_run_evidence_missing'],
  ['config_validation', 'config_validation_evidence_missing'],
  ['owner_approval', 'approval_required'],
  ['rollback_plan', 'rollback_missing'],
  ['post_change_health', 'post_check_plan_missing'],
]);
const SEVERITY_ORDER = new Map([
  ['none', -1],
  ['low', 0],
  ['medium', 1],
  ['high', 2],
  ['critical', 3],
  ['unknown', 4],
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort();
}

function byResourceId(items = []) {
  return new Map(items.map((item) => [item.resourceId, item]));
}

function parseTime(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMutation(actionPlan) {
  return !READ_ONLY_OPERATIONS.has(actionPlan.operation);
}

function directTargetsDeclared(actionPlan) {
  const declared = sortedUnique(actionPlan.preconditions?.blastRadius?.directTargetResourceIds ?? []);
  return stableStringify(declared) === stableStringify(sortedUnique(actionPlan.targetResourceIds));
}

export function computeInfrastructureActionHash(actionPlan) {
  const intent = {
    schemaVersion: actionPlan.schemaVersion,
    actionId: actionPlan.actionId,
    actionType: actionPlan.actionType,
    operation: actionPlan.operation,
    targetResourceIds: sortedUnique(actionPlan.targetResourceIds),
    policyCatalogVersion: actionPlan.policyCatalogVersion,
    expectedRevisions: [...(actionPlan.preconditions?.expectedRevisions ?? [])]
      .map((entry) => ({
        resourceId: entry.resourceId,
        revisionKind: entry.revisionKind,
        expectedRevision: entry.expectedRevision,
      }))
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
    expectedEffects: actionPlan.expectedEffects ?? [],
    forbiddenEffects: actionPlan.forbiddenEffects ?? [],
    reversibility: actionPlan.reversibility,
    rollback: actionPlan.rollback,
  };
  return createHash('sha256').update(stableStringify(intent)).digest('hex');
}

export function resolveInfrastructureSafetyPolicies(targetResourceIds, safetyPolicies = []) {
  const byTarget = new Map(safetyPolicies.map((policy) => [policy.resourceId, policy]));
  return targetResourceIds.map((resourceId) => ({ resourceId, policy: byTarget.get(resourceId) ?? null }));
}

export function classifyInfrastructureAction(actionPlan, resolvedPolicies = []) {
  if (!SUPPORTED_ACTION_TYPES.has(actionPlan.actionType)) return 'forbidden';
  if (READ_ONLY_OPERATIONS.has(actionPlan.operation)) return 'read-only';
  if (HIGH_RISK_ACTION_TYPES.has(actionPlan.actionType) || actionPlan.operation === 'delete' || actionPlan.operation === 'restore') {
    return 'high-risk-human-approval-required';
  }
  const resourceClasses = resolvedPolicies
    .map(({ policy }) => policy?.safetyClass)
    .filter(Boolean);
  if (resourceClasses.some((value) => HIGH_RISK_RESOURCE_CLASSES.has(value))) {
    return 'high-risk-human-approval-required';
  }
  if (resourceClasses.length > 0 && resourceClasses.every((value) => value === 'low_risk_reversible')) {
    return 'low-risk-reversible';
  }
  return 'guarded-reversible';
}

function discoverInfrastructureBlastRadius(actionPlan, relations = []) {
  const targetSet = new Set(actionPlan.targetResourceIds);
  const relevant = relations.filter((relation) =>
    relation.state === 'active'
    && (targetSet.has(relation.sourceId) || targetSet.has(relation.targetId)),
  );
  const dependents = new Set();
  for (const relation of relevant) {
    if (targetSet.has(relation.targetId)) dependents.add(relation.sourceId);
    if (targetSet.has(relation.sourceId) && relation.relationClass === 'routes_to') dependents.add(relation.targetId);
  }
  return {
    directTargetResourceIds: sortedUnique(actionPlan.targetResourceIds),
    dependentResourceIds: sortedUnique([...dependents].filter((id) => !targetSet.has(id))),
    relationIds: sortedUnique(relevant.map((relation) => relation.relationId)),
  };
}

export function deriveInfrastructureBlastRadius(actionPlan, relations = []) {
  const discovered = discoverInfrastructureBlastRadius(actionPlan, relations);
  return {
    ...discovered,
    completeness: actionPlan.preconditions?.blastRadius?.completeness ?? 'unknown',
    computedAt: actionPlan.preconditions?.blastRadius?.computedAt ?? null,
  };
}

export function validateInfrastructureApprovalReference(actionPlan, nowInput) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const approval = actionPlan.approvalRef;
  if (!approval) return { status: 'missing', valid: false, code: 'approval_required' };
  if (approval.system !== 'clr3-decision-core') return { status: 'invalid', valid: false, code: 'approval_system_invalid' };
  if (approval.actionId !== actionPlan.actionId) return { status: 'invalid', valid: false, code: 'approval_action_mismatch' };
  if (approval.decision !== 'approved') return { status: 'invalid', valid: false, code: 'approval_not_approved' };
  if (!/^[a-f0-9]{16,64}$/.test(approval.proposalHash ?? '')) return { status: 'invalid', valid: false, code: 'approval_hash_invalid' };
  const deadline = parseTime(approval.freshnessDeadline);
  if (deadline === null || deadline <= now.getTime()) return { status: 'stale', valid: false, code: 'approval_stale' };
  const decidedAt = parseTime(approval.decidedAt);
  if (decidedAt === null || decidedAt > now.getTime()) return { status: 'invalid', valid: false, code: 'approval_time_invalid' };
  return { status: 'approved', valid: true, code: null };
}

function collectRequiredEvidence(resolvedPolicies) {
  return sortedUnique(resolvedPolicies.flatMap(({ policy }) => policy?.requiredEvidence ?? []));
}

function healthEvidenceStatus(actionPlan) {
  const evidenceByResource = byResourceId(actionPlan.preconditions?.healthEvidence ?? []);
  const missing = [];
  const stale = [];
  const unknown = [];
  for (const resourceId of actionPlan.targetResourceIds) {
    const evidence = evidenceByResource.get(resourceId);
    if (!evidence) missing.push(resourceId);
    else if (evidence.freshness === 'stale') stale.push(resourceId);
    else if (evidence.freshness === 'unknown') unknown.push(resourceId);
  }
  return { missing, stale, unknown };
}

function expectedRevisionStatus(actionPlan) {
  const expected = byResourceId(actionPlan.preconditions?.expectedRevisions ?? []);
  const current = byResourceId(actionPlan.preconditions?.currentRevisions ?? []);
  const missingExpected = [];
  const missingCurrent = [];
  const mismatched = [];
  for (const resourceId of actionPlan.targetResourceIds) {
    const expectedEntry = expected.get(resourceId);
    const currentEntry = current.get(resourceId);
    if (!expectedEntry) missingExpected.push(resourceId);
    if (!currentEntry) missingCurrent.push(resourceId);
    if (expectedEntry && currentEntry && (
      expectedEntry.revisionKind !== currentEntry.revisionKind
      || expectedEntry.expectedRevision !== currentEntry.expectedRevision
    )) mismatched.push(resourceId);
  }
  return { missingExpected, missingCurrent, mismatched };
}

function incidentConstraintViolation(actionPlan, incidents = []) {
  const constraints = actionPlan.preconditions?.incidentConstraints;
  if (!constraints) return null;
  const active = incidents.filter((incident) => incident.status === 'open' || incident.status === 'suppressed');
  const blocked = new Set(constraints.blockedIncidentIds ?? []);
  const explicit = active.find((incident) => blocked.has(incident.incidentId));
  if (explicit) return 'blocked_incident_present';
  const max = SEVERITY_ORDER.get(constraints.maxAllowedSeverity ?? 'unknown');
  if (max === undefined || max === 4) return null;
  const tooSevere = active.find((incident) =>
    actionPlan.targetResourceIds.includes(incident.resourceId)
    && (SEVERITY_ORDER.get(incident.severity) ?? 4) > max,
  );
  return tooSevere ? 'incident_severity_exceeds_limit' : null;
}

function providerEvidenceFailures(actionPlan) {
  if (!PROVIDER_EVIDENCE_ACTION_TYPES.has(actionPlan.actionType) || !isMutation(actionPlan)) return [];
  const providerEvidence = actionPlan.preconditions?.providerAvailability ?? [];
  if (providerEvidence.length === 0) return ['provider_availability_missing'];
  const failures = [];
  if (providerEvidence.some((item) => item.supported !== true)) failures.push('unsupported_provider_action');
  if (providerEvidence.some((item) => item.freshness === 'stale')) failures.push('provider_availability_stale');
  if (providerEvidence.some((item) => item.freshness === 'unknown')) failures.push('provider_availability_unknown');
  if (providerEvidence.some((item) => item.available !== true)) failures.push('provider_unavailable');
  return sortedUnique(failures);
}

function evaluateRequiredEvidence(actionPlan, requiredEvidence, approvalStatus) {
  if (!isMutation(actionPlan)) return [];
  const failures = [];
  const pre = actionPlan.preconditions ?? {};
  const health = healthEvidenceStatus(actionPlan);

  for (const requirement of requiredEvidence) {
    switch (requirement) {
      case 'expected_revision': {
        const revisionStatus = expectedRevisionStatus(actionPlan);
        if (revisionStatus.missingExpected.length > 0) failures.push('missing_expected_revision');
        if (revisionStatus.missingCurrent.length > 0) failures.push('current_revision_missing');
        if (revisionStatus.mismatched.length > 0) failures.push('expected_revision_stale');
        break;
      }
      case 'dependency_graph':
        if (pre.relationSnapshot?.completeness !== 'complete') failures.push('dependency_graph_incomplete');
        if (pre.blastRadius?.completeness !== 'complete' || !directTargetsDeclared(actionPlan)) failures.push('blast_radius_incomplete');
        break;
      case 'current_health':
        if (health.missing.length > 0) failures.push('current_health_missing');
        if (health.stale.length > 0) failures.push('current_health_stale');
        if (health.unknown.length > 0) failures.push('current_health_unknown');
        break;
      case 'backup_evidence':
        if ((pre.backupEvidenceRefs ?? []).length === 0) failures.push('backup_evidence_missing');
        break;
      case 'dry_run':
        if (actionPlan.dryRun?.supported !== true || (pre.dryRunEvidenceRefs ?? []).length === 0 || !actionPlan.dryRun?.evidenceRef) failures.push('dry_run_evidence_missing');
        break;
      case 'config_validation':
        if ((pre.configValidationEvidenceRefs ?? []).length === 0) failures.push('config_validation_evidence_missing');
        break;
      case 'owner_approval':
        if (!approvalStatus.valid) failures.push(approvalStatus.code ?? 'approval_required');
        break;
      case 'rollback_plan':
        if (actionPlan.rollback?.required !== true || actionPlan.rollback?.available !== true || !actionPlan.rollback?.strategy) failures.push('rollback_missing');
        break;
      case 'post_change_health':
        if ((actionPlan.postCheckPlan ?? []).length === 0) failures.push('post_check_plan_missing');
        break;
      default:
        failures.push(REQUIRED_EVIDENCE_TO_CODE.get(requirement) ?? `required_evidence_unsupported:${requirement}`);
    }
  }
  return sortedUnique(failures);
}

export function evaluateInfrastructureActionSafety({
  actionPlan,
  resources = [],
  relations = [],
  safetyPolicies = [],
  incidents = [],
  canonicalPolicyCatalogVersion,
  now,
}) {
  const evaluatedAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const denialCodes = [];
  const targetIds = actionPlan.targetResourceIds ?? [];
  const uniqueTargets = sortedUnique(targetIds);
  const resourceMap = byResourceId(resources);

  if (!SUPPORTED_ACTION_TYPES.has(actionPlan.actionType)) denialCodes.push('unsupported_action_type');
  if (uniqueTargets.length !== targetIds.length) denialCodes.push('ambiguous_target');
  for (const resourceId of uniqueTargets) {
    if (!resourceMap.has(resourceId)) denialCodes.push(`target_missing:${resourceId}`);
  }

  const resolvedPolicies = resolveInfrastructureSafetyPolicies(uniqueTargets, safetyPolicies);
  for (const { resourceId, policy } of resolvedPolicies) {
    if (!policy) denialCodes.push(`safety_policy_missing:${resourceId}`);
    else if (!(policy.allowedOperations ?? []).includes(actionPlan.operation)) denialCodes.push(`operation_not_allowed:${resourceId}`);
  }

  const policyRefs = sortedUnique(resolvedPolicies.map(({ policy }) => policy?.safetyPolicyId).filter(Boolean));
  const requiredEvidence = collectRequiredEvidence(resolvedPolicies);
  let safetyClass = classifyInfrastructureAction(actionPlan, resolvedPolicies);
  if (denialCodes.some((code) => code.startsWith('target_missing:') || code.startsWith('safety_policy_missing:') || code.startsWith('operation_not_allowed:') || code === 'unsupported_action_type')) {
    safetyClass = 'forbidden';
  }

  if (!canonicalPolicyCatalogVersion || actionPlan.policyCatalogVersion !== canonicalPolicyCatalogVersion) {
    denialCodes.push('policy_catalog_version_mismatch');
  }
  if (stableStringify(sortedUnique(actionPlan.policyRefs ?? [])) !== stableStringify(policyRefs)) {
    denialCodes.push('policy_refs_mismatch');
  }
  if (actionPlan.safetyClass !== safetyClass) denialCodes.push('safety_class_mismatch');

  const approvalRequired = isMutation(actionPlan)
    && (safetyClass === 'high-risk-human-approval-required' || requiredEvidence.includes('owner_approval'));
  const requiredAuthority = approvalRequired ? 'decision_core_approval' : 'none';
  if (actionPlan.requiredAuthority !== requiredAuthority) denialCodes.push('required_authority_mismatch');
  const approvalStatus = approvalRequired
    ? validateInfrastructureApprovalReference(actionPlan, now)
    : { status: actionPlan.approvalRef ? 'not-required' : 'none', valid: true, code: null };

  denialCodes.push(...evaluateRequiredEvidence(actionPlan, requiredEvidence, approvalStatus));
  denialCodes.push(...providerEvidenceFailures(actionPlan));
  const incidentFailure = incidentConstraintViolation(actionPlan, incidents);
  if (incidentFailure) denialCodes.push(incidentFailure);

  if (isMutation(actionPlan)) {
    const declaredBlastRadius = actionPlan.preconditions?.blastRadius;
    const discoveredBlastRadius = discoverInfrastructureBlastRadius(actionPlan, relations);
    if (!declaredBlastRadius || !directTargetsDeclared(actionPlan)) denialCodes.push('blast_radius_undeclared');
    if (declaredBlastRadius) {
      const declaredDependencies = new Set(declaredBlastRadius.dependentResourceIds ?? []);
      const declaredRelations = new Set(declaredBlastRadius.relationIds ?? []);
      if (discoveredBlastRadius.dependentResourceIds.some((resourceId) => !declaredDependencies.has(resourceId))
        || discoveredBlastRadius.relationIds.some((relationId) => !declaredRelations.has(relationId))) {
        denialCodes.push('blast_radius_underdeclared');
      }
    }
    if (actionPlan.reversibility?.rollbackRequired === true && actionPlan.rollback?.available !== true) denialCodes.push('rollback_missing');
  }

  const uniqueDenials = sortedUnique(denialCodes);
  const forbidden = safetyClass === 'forbidden' || uniqueDenials.some((code) =>
    code === 'unsupported_action_type'
    || code.startsWith('target_missing:')
    || code.startsWith('safety_policy_missing:')
    || code.startsWith('operation_not_allowed:')
    || code === 'unsupported_provider_action',
  );
  const approvalOnly = uniqueDenials.length > 0 && uniqueDenials.every((code) => code === 'approval_required');
  let decision;
  if (forbidden) decision = 'forbidden';
  else if (approvalOnly) decision = 'approval_required';
  else if (uniqueDenials.length > 0) decision = 'denied';
  else if (!isMutation(actionPlan)) decision = 'allowed_read_only';
  else decision = 'preflight_ready';

  const actionHash = computeInfrastructureActionHash(actionPlan);
  const blastRadius = deriveInfrastructureBlastRadius(actionPlan, relations);
  const satisfiedEvidence = requiredEvidence.filter((requirement) => !uniqueDenials.includes(REQUIRED_EVIDENCE_TO_CODE.get(requirement)));

  return {
    schemaVersion: INFRASTRUCTURE_ACTION_SCHEMA_VERSION,
    actionId: actionPlan.actionId,
    actionHash,
    evaluatedAt,
    safetyClass,
    decision,
    denialCodes: uniqueDenials,
    policyRefs,
    targetResourceIds: uniqueTargets,
    blastRadius,
    requiredEvidence,
    satisfiedEvidence,
    missingEvidence: uniqueDenials,
    requiredAuthority,
    approvalStatus: approvalStatus.status,
    executionEnabled: false,
    executionPerformed: false,
    plannedEffects: actionPlan.expectedEffects ?? [],
    actualEffects: [],
    postCheckRequirements: actionPlan.postCheckPlan ?? [],
    receipt: {
      schemaVersion: INFRASTRUCTURE_ACTION_SCHEMA_VERSION,
      actionId: actionPlan.actionId,
      actionHash,
      idempotencyKey: actionPlan.idempotencyKey,
      evaluatedAt,
      decision,
      safetyClass,
      targetResourceIds: uniqueTargets,
      policyRefs,
      executionPerformed: false,
      containsSecrets: false,
    },
  };
}
