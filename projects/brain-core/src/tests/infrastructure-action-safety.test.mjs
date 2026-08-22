import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  computeInfrastructureActionHash,
  evaluateInfrastructureActionSafety,
} from '../adapters/infrastructure-action-safety.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-action-fixtures-v1.json'), 'utf8'));

const clone = (value) => structuredClone(value);
const base = (name) => clone(fixtures.plans[name]);

function evaluate(actionPlan, extra = {}) {
  return evaluateInfrastructureActionSafety({
    actionPlan,
    resources: extra.resources ?? fixtures.resources,
    relations: extra.relations ?? fixtures.relations,
    safetyPolicies: extra.safetyPolicies ?? fixtures.safetyPolicies,
    incidents: extra.incidents ?? [],
    canonicalPolicyCatalogVersion: extra.canonicalPolicyCatalogVersion ?? fixtures.policyCatalogVersion,
    now: extra.now ?? fixtures.now,
  });
}

function expectDenied(result, code) {
  assert.notEqual(result.decision, 'preflight_ready');
  assert.notEqual(result.decision, 'allowed_read_only');
  assert.ok(result.denialCodes.includes(code), `expected denial ${code}; got ${result.denialCodes.join(',')}`);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.executionPerformed, false);
}

test('read-only action is allowed without execution capability', () => {
  const result = evaluate(base('readOnly'));
  assert.equal(result.decision, 'allowed_read_only');
  assert.equal(result.safetyClass, 'read-only');
  assert.equal(result.executionEnabled, false);
  assert.equal(result.executionPerformed, false);
});

test('missing target is forbidden', () => {
  const plan = base('highRiskApproved');
  const result = evaluate(plan, { resources: fixtures.resources.filter((resource) => resource.resourceId !== 'host:test-high') });
  assert.equal(result.decision, 'forbidden');
  assert.ok(result.denialCodes.includes('target_missing:host:test-high'));
});

test('duplicate target is ambiguous and denied', () => {
  const plan = base('highRiskApproved');
  plan.targetResourceIds.push('host:test-high');
  const result = evaluate(plan);
  expectDenied(result, 'ambiguous_target');
});

test('missing safety policy is forbidden', () => {
  const result = evaluate(base('highRiskApproved'), {
    safetyPolicies: fixtures.safetyPolicies.filter((policy) => policy.resourceId !== 'host:test-high'),
  });
  assert.equal(result.decision, 'forbidden');
  assert.ok(result.denialCodes.includes('safety_policy_missing:host:test-high'));
});

test('operation disallowed by IKHP1 policy is forbidden', () => {
  const policies = clone(fixtures.safetyPolicies);
  policies.find((policy) => policy.resourceId === 'host:test-high').allowedOperations = ['inspect'];
  const result = evaluate(base('highRiskApproved'), { safetyPolicies: policies });
  assert.equal(result.decision, 'forbidden');
  assert.ok(result.denialCodes.includes('operation_not_allowed:host:test-high'));
});

test('unsupported action type is forbidden', () => {
  const plan = base('highRiskApproved');
  plan.actionType = 'shell.exec';
  const result = evaluate(plan);
  assert.equal(result.decision, 'forbidden');
  assert.ok(result.denialCodes.includes('unsupported_action_type'));
});

test('requester cannot downgrade safety class', () => {
  const plan = base('highRiskApproved');
  plan.safetyClass = 'low-risk-reversible';
  expectDenied(evaluate(plan), 'safety_class_mismatch');
});

test('requester cannot remove required Decision Core authority', () => {
  const plan = base('highRiskApproved');
  plan.requiredAuthority = 'none';
  expectDenied(evaluate(plan), 'required_authority_mismatch');
});

test('declared policy refs must exactly match resolved IKHP1 policy refs', () => {
  const plan = base('highRiskApproved');
  plan.policyRefs = [];
  expectDenied(evaluate(plan), 'policy_refs_mismatch');
});

test('policy catalog version mismatch fails closed', () => {
  const plan = base('highRiskApproved');
  plan.policyCatalogVersion = '1.2.0';
  expectDenied(evaluate(plan), 'policy_catalog_version_mismatch');
});

test('missing expected revision is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.expectedRevisions = [];
  expectDenied(evaluate(plan), 'missing_expected_revision');
});

test('missing current revision evidence is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.currentRevisions = [];
  expectDenied(evaluate(plan), 'current_revision_missing');
});

test('stale expected revision is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.currentRevisions[0].expectedRevision = 'rev-high-2';
  expectDenied(evaluate(plan), 'expected_revision_stale');
});

test('stale health evidence is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.healthEvidence[0].freshness = 'stale';
  expectDenied(evaluate(plan), 'current_health_stale');
});

test('unknown health evidence is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.healthEvidence[0].freshness = 'unknown';
  expectDenied(evaluate(plan), 'current_health_unknown');
});

test('incomplete relation snapshot is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.relationSnapshot.completeness = 'partial';
  expectDenied(evaluate(plan), 'dependency_graph_incomplete');
});

test('incomplete blast radius is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.blastRadius.completeness = 'partial';
  expectDenied(evaluate(plan), 'blast_radius_incomplete');
});

test('under-declared discovered blast radius is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.blastRadius.dependentResourceIds = [];
  plan.preconditions.blastRadius.relationIds = [];
  expectDenied(evaluate(plan), 'blast_radius_underdeclared');
});

test('provider evidence is required for provider-write-class actions', () => {
  const plan = base('highRiskApproved');
  plan.actionType = 'provider.write';
  expectDenied(evaluate(plan), 'provider_availability_missing');
});

test('unsupported provider action is forbidden', () => {
  const plan = base('highRiskApproved');
  plan.actionType = 'provider.write';
  plan.preconditions.providerAvailability = [{
    providerRef: 'provider:test', supported: false, available: true, freshness: 'fresh', observedAt: '2026-08-18T17:44:00Z',
  }];
  const result = evaluate(plan);
  assert.equal(result.decision, 'forbidden');
  assert.ok(result.denialCodes.includes('unsupported_provider_action'));
});

test('unavailable provider is denied', () => {
  const plan = base('highRiskApproved');
  plan.actionType = 'provider.write';
  plan.preconditions.providerAvailability = [{
    providerRef: 'provider:test', supported: true, available: false, freshness: 'fresh', observedAt: '2026-08-18T17:44:00Z',
  }];
  expectDenied(evaluate(plan), 'provider_unavailable');
});

test('missing backup evidence is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.backupEvidenceRefs = [];
  expectDenied(evaluate(plan), 'backup_evidence_missing');
});

test('missing dry-run evidence is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.dryRunEvidenceRefs = [];
  plan.dryRun.evidenceRef = null;
  expectDenied(evaluate(plan), 'dry_run_evidence_missing');
});

test('missing config validation is denied', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.configValidationEvidenceRefs = [];
  expectDenied(evaluate(plan), 'config_validation_evidence_missing');
});

test('missing rollback availability is denied', () => {
  const plan = base('highRiskApproved');
  plan.rollback.available = false;
  plan.rollback.strategy = null;
  expectDenied(evaluate(plan), 'rollback_missing');
});

test('missing human approval produces approval_required only when all other gates pass', () => {
  const plan = base('highRiskApproved');
  plan.approvalRef = null;
  const result = evaluate(plan);
  assert.equal(result.decision, 'approval_required');
  assert.deepEqual(result.denialCodes, ['approval_required']);
});

test('stale approval is denied', () => {
  const plan = base('highRiskApproved');
  plan.approvalRef.freshnessDeadline = '2026-08-18T17:59:59Z';
  expectDenied(evaluate(plan), 'approval_stale');
});

test('approval for another action cannot authorize this plan', () => {
  const plan = base('highRiskApproved');
  plan.approvalRef.actionId = 'action:other';
  expectDenied(evaluate(plan), 'approval_action_mismatch');
});

test('valid high-risk approved plan reaches preflight_ready but cannot execute', () => {
  const result = evaluate(base('highRiskApproved'));
  assert.equal(result.decision, 'preflight_ready');
  assert.equal(result.safetyClass, 'high-risk-human-approval-required');
  assert.equal(result.requiredAuthority, 'decision_core_approval');
  assert.equal(result.approvalStatus, 'approved');
  assert.equal(result.executionEnabled, false);
  assert.equal(result.executionPerformed, false);
});

test('valid low-risk reversible plan reaches preflight_ready without Decision Core authority', () => {
  const result = evaluate(base('lowRiskReady'));
  assert.equal(result.decision, 'preflight_ready');
  assert.equal(result.safetyClass, 'low-risk-reversible');
  assert.equal(result.requiredAuthority, 'none');
  assert.equal(result.executionEnabled, false);
});

test('active incident severity constraint blocks mutation', () => {
  const result = evaluate(base('highRiskApproved'), { incidents: [fixtures.blockingIncident] });
  expectDenied(result, 'incident_severity_exceeds_limit');
});

test('action hash is deterministic', () => {
  const plan = base('highRiskApproved');
  assert.equal(computeInfrastructureActionHash(plan), computeInfrastructureActionHash(clone(plan)));
});

test('requestedAt does not alter stable intent hash', () => {
  const first = base('highRiskApproved');
  const second = clone(first);
  second.requestedAt = '2026-08-18T17:59:00Z';
  assert.equal(computeInfrastructureActionHash(first), computeInfrastructureActionHash(second));
});

test('receipt is bounded and contains no provider payload or secret material', () => {
  const result = evaluate(base('highRiskApproved'));
  const text = JSON.stringify(result.receipt);
  assert.equal(result.receipt.containsSecrets, false);
  assert.equal('providerAvailability' in result.receipt, false);
  assert.equal('approvalRef' in result.receipt, false);
  assert.equal(text.includes('evidence:backup-high'), false);
});

test('planned effects remain separate from actual effects', () => {
  const result = evaluate(base('highRiskApproved'));
  assert.equal(result.plannedEffects.length, 1);
  assert.deepEqual(result.actualEffects, []);
});

test('execution flags are always false for all fixture plans', () => {
  for (const plan of Object.values(fixtures.plans)) {
    const result = evaluate(clone(plan));
    assert.equal(result.executionEnabled, false);
    assert.equal(result.executionPerformed, false);
  }
});
