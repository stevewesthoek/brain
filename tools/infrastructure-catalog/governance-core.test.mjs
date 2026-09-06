import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  evaluateLifecycleReadiness,
  planInfrastructureAdmission,
  validateInfrastructureGovernance,
} from './governance-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-onboarding-alternate-v1.json'), 'utf8'));

test('provider-neutral fixture proves admitted and candidate consumers share one contract', () => {
  const report = validateInfrastructureGovernance({ bundle: fixture, now: new Date('2026-09-05T00:00:00Z') });
  assert.deepEqual(report.errors, []);
  assert.equal(report.counts.governedResources, 8);
  assert.equal(report.counts.admitted, 6);
  assert.equal(report.counts.candidates, 2);
  assert.equal(report.counts.unownedRoutes, 1);
  assert.equal(report.readOnly, true);
  assert.equal(report.executionEnabled, false);
  assert.deepEqual(report.actualEffects, []);
});

test('admission is a pure decision and unresolved discovery remains a candidate', () => {
  const before = JSON.stringify(fixture);
  const plan = planInfrastructureAdmission({ resourceId: 'application:beta-consumer', bundle: fixture });
  assert.equal(plan.decision, 'remain_candidate');
  assert.ok(plan.reasons.includes('discovery_not_authoritative'));
  assert.ok(plan.reasons.includes('owner_unresolved'));
  assert.equal(JSON.stringify(fixture), before);

  const admitted = structuredClone(fixture);
  const resource = admitted.resources.find((entry) => entry.resourceId === 'application:beta-consumer');
  resource.governance.discovery.authority = 'authoritative';
  resource.governance.ownership.authoritativeOwnerRef = resource.resourceId;
  resource.governance.ownership.ownerState = 'confirmed';
  resource.governance.ownership.authoritativeOwnerKind = 'application';
  resource.governance.ownership.custody = 'application';
  resource.governance.ownership.verifierRefs = ['monitor:beta-verifier'];
  resource.governance.ownership.driftDetectorRefs = ['monitor:beta-drift'];
  resource.governance.lifecycle.maintenanceMode = 'normal';
  resource.governance.lifecycle.activeWorkloadPolicy = 'idle_required';
  const admittedPlan = planInfrastructureAdmission({ resourceId: resource.resourceId, bundle: admitted });
  assert.equal(admittedPlan.decision, 'admit');
  assert.deepEqual(admittedPlan.changes, [{ path: 'governance.admissionState', from: 'candidate', to: 'admitted' }]);
  assert.equal(admittedPlan.executionPerformed, false);
});

test('lifecycle readiness fails closed for active, missing, and unknown workload evidence', () => {
  const resource = fixture.resources.find((entry) => entry.resourceId === 'service:alpha-runtime');
  assert.equal(evaluateLifecycleReadiness({ resource }).status, 'unknown');
  assert.equal(evaluateLifecycleReadiness({ resource, runtimeEvidence: [{ resourceId: resource.resourceId, workloadState: 'active' }] }).status, 'blocked');
  assert.equal(evaluateLifecycleReadiness({ resource, runtimeEvidence: [{ resourceId: resource.resourceId, workloadState: 'unknown' }] }).safeToProceed, false);
  assert.equal(evaluateLifecycleReadiness({ resource, runtimeEvidence: [{ resourceId: resource.resourceId, workloadState: 'idle' }] }).status, 'ready');
});

test('ownership, route writers, and environment isolation conflicts are explicit', () => {
  const duplicateOwner = structuredClone(fixture);
  duplicateOwner.relations.push({ ...duplicateOwner.relations.find((entry) => entry.relationId === 'relation:alpha-owner'), relationId: 'relation:alpha-owner-2', targetId: 'application:beta-consumer' });
  assert.ok(validateInfrastructureGovernance({ bundle: duplicateOwner }).errors.some((error) => error.includes('multiple-authoritative-owners')));

  const unownedRoute = structuredClone(fixture);
  delete unownedRoute.relations.find((entry) => entry.relationId === 'relation:alpha-route').governance;
  assert.ok(validateInfrastructureGovernance({ bundle: unownedRoute }).errors.some((error) => error.includes('unowned-route')));

  const competingWriters = structuredClone(fixture);
  competingWriters.relations.find((entry) => entry.relationId === 'relation:alpha-route').governance.routeOwnership.writerRefs = [
    'application:alpha-consumer', 'application:beta-consumer',
  ];
  assert.ok(validateInfrastructureGovernance({ bundle: competingWriters }).errors.some((error) => error.includes('competing-route-writers')));

  const collision = structuredClone(fixture);
  const beta = collision.resources.find((entry) => entry.resourceId === 'service:beta-runtime');
  beta.governance.isolation.boundaryRefs = ['network:alpha-production'];
  assert.ok(validateInfrastructureGovernance({ bundle: collision }).errors.some((error) => error.includes('environment-isolation-collision')));
});

test('application-custodied state cannot be assigned to a different owner kind', () => {
  const invalid = structuredClone(fixture);
  const config = invalid.resources.find((entry) => entry.resourceId === 'control_plane:alpha-config');
  config.governance.ownership.authoritativeOwnerKind = 'provider';
  assert.ok(validateInfrastructureGovernance({ bundle: invalid }).errors.some((error) => error.includes('application-custody-owner-mismatch')));
});

test('multiple accounts require an explicit many-account capacity declaration', () => {
  const identityAccess = {
    accounts: [{ accountId: 'account:one' }, { accountId: 'account:two' }],
    credentials: [], sessions: [], runtimeProfiles: [],
  };
  const invalid = structuredClone(fixture);
  const app = invalid.resources.find((entry) => entry.resourceId === 'application:alpha-consumer');
  app.governance.identityBindingRefs = ['account:one', 'account:two'];
  app.governance.accountCapacity = 'one';
  const report = validateInfrastructureGovernance({ bundle: invalid, identityAccess });
  assert.ok(report.errors.some((error) => error.includes('identity-account-capacity-mismatch')));
});

test('governance metadata is non-secret by construction', () => {
  const invalid = structuredClone(fixture);
  invalid.resources[0].attributes = { token: 'must-not-be-retained' };
  const report = validateInfrastructureGovernance({ bundle: invalid });
  assert.ok(report.errors.some((error) => error.includes('forbidden raw-access field')));
  assert.equal(report.containsSecrets, false);
});
