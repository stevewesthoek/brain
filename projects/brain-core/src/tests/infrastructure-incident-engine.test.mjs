import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { incidentFingerprint, projectIncidents } from '../adapters/infrastructure-incident-engine.mjs';
import { pruneIncidents, readIncidentSnapshot, writeIncidentSnapshot } from '../adapters/infrastructure-incident-runtime.mjs';
import { emptyNotificationCursor, planIncidentAttention, readNotificationCursor, writeNotificationCursor } from '../adapters/infrastructure-incident-notifications.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const policiesDoc = JSON.parse(fs.readFileSync(path.join(root, 'operations/infrastructure/catalog/health-policies.v1.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-incident-fixtures-v1.json'), 'utf8'));
const scenarios = Object.fromEntries(fixtures.scenarios.map((scenario) => [scenario.scenarioId, scenario]));
const NOW = '2026-08-17T14:30:00Z';

function project(previousIncidents, observations, extra = {}) {
  return projectIncidents({
    previousIncidents,
    observations,
    healthPolicies: policiesDoc.healthPolicies,
    policyCatalogVersion: policiesDoc.catalogVersion,
    now: NOW,
    ...extra,
  });
}

function openedCritical() {
  return project([], [scenarios['authoritative-critical-open'].observation]);
}

function openedHigh() {
  return project([], [scenarios['authoritative-high-open'].observation]);
}

function withTransition(incident, transition) {
  return [{ incidentId: incident.incidentId, transition, observationId: `observation:${transition}` }];
}

test('policy-backed condition opens authoritative incident with direct resource only', () => {
  const result = openedCritical();
  const incident = result.incidents[0];
  assert.equal(incident.severity, 'critical');
  assert.equal(incident.policyAuthority, 'authoritative');
  assert.equal(incident.healthPolicyId, 'health_policy:dokploy-aws-host');
  assert.equal(incident.status, 'open');
  assert.equal(incident.lastTransition, 'opened');
  assert.deepEqual(incident.affectedResourceIds, [incident.resourceId]);
});

test('repeated condition continues same fingerprint and increments observationCount', () => {
  const first = openedCritical();
  const second = project(first.incidents, [scenarios['repeated-condition-continues'].observation]);
  assert.equal(second.incidents[0].fingerprint, first.incidents[0].fingerprint);
  assert.equal(second.incidents[0].lastTransition, 'continued');
  assert.equal(second.incidents[0].observationCount, 2);
});

test('fresh clean observation recovers', () => {
  const first = openedCritical();
  const result = project(first.incidents, [scenarios['fresh-clean-recovers'].observation]);
  assert.equal(result.incidents[0].status, 'recovered');
  assert.equal(result.incidents[0].lastTransition, 'recovered');
  assert.equal(result.incidents[0].recoveryEvidence.evidenceObservationId, scenarios['fresh-clean-recovers'].observation.observationId);
});

test('stale and unknown freshness never recover active incident', () => {
  const first = openedCritical();
  const stale = project(first.incidents, [scenarios['stale-does-not-recover'].observation]);
  assert.equal(stale.incidents[0].status, 'open');
  assert.equal(stale.incidents[0].freshness, 'stale');
  const unknownObservation = { ...scenarios['fresh-clean-recovers'].observation, observationId: 'observation:unknown', freshness: 'unknown' };
  const unknown = project(first.incidents, [unknownObservation]);
  assert.equal(unknown.incidents[0].status, 'open');
  assert.equal(unknown.incidents[0].freshness, 'unknown');
});

test('recovered recurrence reopens same identity and increments occurrenceCount', () => {
  const first = openedCritical();
  const recovered = project(first.incidents, [scenarios['fresh-clean-recovers'].observation]);
  const reopened = project(recovered.incidents, [scenarios['recovered-reopens'].observation]);
  assert.equal(reopened.incidents[0].fingerprint, first.incidents[0].fingerprint);
  assert.equal(reopened.incidents[0].status, 'open');
  assert.equal(reopened.incidents[0].lastTransition, 'reopened');
  assert.equal(reopened.incidents[0].occurrenceCount, 2);
});

test('fingerprint is deterministic and changes with catalog version', () => {
  const input = { resourceId: 'host:x', conditionCode: 'c', healthPolicyId: 'health_policy:x', policyCatalogVersion: '1.0.0' };
  assert.equal(incidentFingerprint(input), incidentFingerprint({ ...input }));
  assert.notEqual(incidentFingerprint(input), incidentFingerprint({ ...input, policyCatalogVersion: '2.0.0' }));
});

test('unknown condition fails closed with unknown severity and authority', () => {
  const result = project([], [scenarios['unknown-policy-fails-closed'].observation]);
  assert.equal(result.incidents[0].severity, 'unknown');
  assert.equal(result.incidents[0].policyAuthority, 'unknown');
  assert.equal(result.incidents[0].healthPolicyId, null);
});

test('acknowledgement suppresses attention but does not change incident health', () => {
  const first = openedHigh();
  const incident = first.incidents[0];
  const ack = scenarios['acknowledgement-does-not-change-health'].acknowledgement;
  const acknowledged = project(first.incidents, [], { acknowledgements: [{ incidentId: incident.incidentId, ...ack }] });
  assert.equal(acknowledged.incidents[0].status, 'open');
  assert.equal(acknowledged.incidents[0].lastTransition, 'acknowledged');
  const attentionNow = '2026-08-17T13:00:00Z';
  const plan = planIncidentAttention({ incidents: acknowledged.incidents, transitions: withTransition(acknowledged.incidents[0], 'opened'), previousCursor: emptyNotificationCursor({ now: attentionNow }), now: attentionNow });
  assert.equal(plan.immediate.length, 0);
});

test('expired acknowledgement restores immediate attention eligibility', () => {
  const first = openedHigh();
  const incident = { ...first.incidents[0], acknowledgement: { acknowledgedAt: '2026-08-17T12:00:00Z', acknowledgedBy: 'fixture', expiresAt: '2026-08-17T13:00:00Z' } };
  const plan = planIncidentAttention({ incidents: [incident], transitions: withTransition(incident, 'opened'), previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  assert.equal(plan.immediate.length, 1);
});

test('critical/high open and recovery transitions emit immediate/recovery attention', () => {
  const opened = openedCritical().incidents[0];
  const openPlan = planIncidentAttention({ incidents: [opened], transitions: withTransition(opened, 'opened'), previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  assert.equal(openPlan.immediate[0].type, 'immediate');
  const recovered = project([opened], [scenarios['fresh-clean-recovers'].observation]).incidents[0];
  const recoveryPlan = planIncidentAttention({ incidents: [recovered], transitions: withTransition(recovered, 'recovered'), previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  assert.equal(recoveryPlan.immediate[0].type, 'recovery');
});

test('identical transition dedupes', () => {
  const incident = openedHigh().incidents[0];
  const first = planIncidentAttention({ incidents: [incident], transitions: withTransition(incident, 'opened'), previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  const second = planIncidentAttention({ incidents: [incident], transitions: withTransition(incident, 'opened'), previousCursor: first.nextCursor, now: NOW });
  assert.equal(first.immediate.length, 1);
  assert.equal(second.immediate.length, 0);
});

test('sixth immediate event per resource per hour is deferred and not marked delivered', () => {
  const incident = openedHigh().incidents[0];
  const cursor = emptyNotificationCursor({ now: NOW });
  cursor.immediateHistory = [
    '2026-08-17T11:57:00Z',
    '2026-08-17T11:58:00Z',
    '2026-08-17T11:59:00Z',
    '2026-08-17T12:00:00Z',
    '2026-08-17T12:01:00Z',
  ].map((occurredAt, index) => ({ resourceId: incident.resourceId, occurredAt, key: `k${index}` }));
  const plan = planIncidentAttention({ incidents: [incident], transitions: withTransition(incident, 'opened'), previousCursor: cursor, now: NOW });
  assert.equal(plan.immediate.length, 0);
  assert.equal(plan.deferred.length, 1);
  assert.equal(plan.nextCursor.deliveredKeys.length, 0);
});

test('medium and low incidents enter one daily digest', () => {
  const mediumObservation = { ...scenarios['authoritative-critical-open'].observation, observationId: 'observation:warning', conditionCodes: ['disk_capacity_warning'] };
  const incident = project([], [mediumObservation]).incidents[0];
  assert.equal(incident.severity, 'medium');
  const first = planIncidentAttention({ incidents: [incident], transitions: [], previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  assert.ok(first.digest);
  const second = planIncidentAttention({ incidents: [incident], transitions: [], previousCursor: first.nextCursor, now: NOW });
  assert.equal(second.digest, null);
});

test('unknown severity remains explicit and enters digest attention', () => {
  const incident = project([], [scenarios['unknown-policy-fails-closed'].observation]).incidents[0];
  const plan = planIncidentAttention({ incidents: [incident], transitions: [], previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  assert.equal(incident.severity, 'unknown');
  assert.equal(plan.digest.items[0].severity, 'unknown');
});

test('notification payload is bounded to safe fields only', () => {
  const incident = openedCritical().incidents[0];
  const plan = planIncidentAttention({ incidents: [incident], transitions: withTransition(incident, 'opened'), previousCursor: emptyNotificationCursor({ now: NOW }), now: NOW });
  const payload = plan.immediate[0].payload;
  assert.deepEqual(Object.keys(payload).sort(), ['conditionCode', 'incidentId', 'occurredAt', 'openIncidentCount', 'resourceId', 'severity', 'transition'].sort());
  const serialized = JSON.stringify(payload);
  for (const forbidden of ['providerRefs', 'sourceEntityId', 'acknowledgedBy', 'provenance', 'metricsSummary']) assert.equal(serialized.includes(forbidden), false);
});

test('incident runtime writes atomic-style 0600 file only in temp directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp3-incident-'));
  try {
    const incident = openedCritical().incidents[0];
    const result = writeIncidentSnapshot([incident], { root: dir, now: NOW });
    assert.ok(result.path.endsWith(path.join('runtime', 'local', 'infrastructure', 'incident-state.json')));
    assert.equal(fs.statSync(result.path).mode & 0o777, 0o600);
    assert.equal(fs.readdirSync(path.dirname(result.path)).some((name) => name.includes('.tmp-')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('open and suppressed incidents never age-prune', () => {
  const base = openedCritical().incidents[0];
  const oldOpen = { ...base, openedAt: '2025-01-01T00:00:00Z', lastObservedAt: '2025-01-01T00:00:00Z' };
  const oldSuppressed = { ...oldOpen, incidentId: 'incident:suppressed0000000000000000', fingerprint: 'suppressed0000000000000000', status: 'suppressed' };
  const retained = pruneIncidents([oldOpen, oldSuppressed], { now: NOW, maxIncidents: 1, maxIncidentAgeSeconds: 1, recoveredRetentionSeconds: 1 });
  assert.equal(retained.length, 2);
  assert.deepEqual(new Set(retained.map((item) => item.status)), new Set(['open', 'suppressed']));
});

test('recovered history age-prunes', () => {
  const incident = openedCritical().incidents[0];
  const recovered = { ...incident, status: 'recovered', recoveryEvidence: { recoveredAt: '2026-08-01T00:00:00Z', evidenceObservationId: 'observation:old' }, lastObservedAt: '2026-08-01T00:00:00Z' };
  assert.equal(pruneIncidents([recovered], { now: NOW, recoveredRetentionSeconds: 60, maxIncidentAgeSeconds: 60 }).length, 0);
});

test('active incidents survive maxIncidents overflow', () => {
  const base = openedCritical().incidents[0];
  const incidents = Array.from({ length: 3 }, (_, index) => ({ ...base, incidentId: `incident:${String(index).padStart(16, '0')}`, fingerprint: String(index).padStart(16, '0') }));
  assert.equal(pruneIncidents(incidents, { now: NOW, maxIncidents: 1 }).length, 3);
});

test('missing incident and cursor state return empty state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp3-missing-'));
  try {
    assert.equal(readIncidentSnapshot({ root: dir, now: NOW }).snapshot.incidents.length, 0);
    assert.equal(readNotificationCursor({ root: dir, now: NOW }).cursor.deliveredKeys.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('malformed incident and cursor state fail explicitly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp3-corrupt-'));
  try {
    const incidentPath = path.join(dir, 'incident.json');
    const cursorPath = path.join(dir, 'cursor.json');
    fs.writeFileSync(incidentPath, '{');
    fs.writeFileSync(cursorPath, '{');
    assert.throws(() => readIncidentSnapshot({ root: dir, now: NOW, inputPath: incidentPath }), /malformed/);
    assert.throws(() => readNotificationCursor({ root: dir, now: NOW, inputPath: cursorPath }), /malformed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('notification cursor writes 0600 and contains delivery state only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp3-cursor-'));
  try {
    const cursor = emptyNotificationCursor({ now: NOW });
    const result = writeNotificationCursor(cursor, { root: dir, now: NOW });
    assert.equal(fs.statSync(result.path).mode & 0o777, 0o600);
    assert.deepEqual(Object.keys(result.cursor).sort(), ['deliveredKeys', 'digestDays', 'generatedAt', 'immediateHistory', 'schemaVersion'].sort());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no Decision Core integration is present in incident modules', () => {
  for (const relative of [
    'projects/brain-core/src/adapters/infrastructure-incident-engine.mjs',
    'projects/brain-core/src/adapters/infrastructure-incident-runtime.mjs',
    'projects/brain-core/src/adapters/infrastructure-incident-notifications.mjs',
  ]) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.equal(/infinite-brain-decision|DecisionCore|decision-core|createProposal/.test(source), false);
  }
});
