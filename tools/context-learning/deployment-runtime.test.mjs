import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildDoctorReport,
  chooseTransport,
  createDryRunLifecycleReceipt,
  createSafeLifecyclePlan,
  evaluateAccessRequirement,
  evaluateLastKnownGood,
  validateLifecyclePlan,
} from './deployment-runtime.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixtures = JSON.parse(readFileSync(
  path.join(root, 'operations/fixtures/context-learning-deployment-profiles-v1.json'),
  'utf8',
));
const byId = new Map(fixtures.profiles.map((profile) => [profile.profileId, profile]));

test('transport selection respects configured priority and visible fallback', () => {
  const profile = byId.get('steve-personal-dual-host-reference');
  const office = profile.hosts.find((host) => host.hostId === 'office');
  assert.equal(
    chooseTransport(office.transports, {
      thunderbolt: { available: true, healthy: true },
      tailscale: { available: true, healthy: true },
    }).transportId,
    'thunderbolt',
  );
  assert.equal(
    chooseTransport(office.transports, {
      thunderbolt: { available: false },
      tailscale: { available: true, healthy: true },
    }).transportId,
    'tailscale',
  );
  assert.equal(
    chooseTransport(office.transports, {
      thunderbolt: { available: false },
      tailscale: { available: false },
    }).status,
    'unavailable',
  );
});

test('last-known-good cache exposes exact age and fresh/stale/expired states', () => {
  const policy = { enabled: true, maxAgeSeconds: 60, requireSourceRevision: true, failClosedScopes: [] };
  const now = new Date('2026-08-16T12:02:00Z');
  assert.deepEqual(
    evaluateLastKnownGood({ capturedAt: '2026-08-16T12:01:30Z', sourceRevision: 'r1' }, policy, now),
    { state: 'fresh-cache', ageSeconds: 30, sourceRevision: 'r1', usable: true },
  );
  assert.equal(
    evaluateLastKnownGood({ capturedAt: '2026-08-16T12:00:30Z', sourceRevision: 'r1' }, policy, now).state,
    'stale-cache',
  );
  assert.equal(
    evaluateLastKnownGood({ capturedAt: '2026-08-16T11:58:00Z', sourceRevision: 'r1' }, policy, now).state,
    'expired-cache',
  );
});

test('current human authority and decision state fail closed when live freshness is required', () => {
  const cachePolicy = { failClosedScopes: ['human_authority', 'decision_state', 'canonical_write'] };
  const cacheState = { usable: true, state: 'fresh-cache', ageSeconds: 10 };
  assert.equal(evaluateAccessRequirement({
    scope: 'human_authority',
    liveAvailable: false,
    liveFresh: false,
    cacheState,
    cachePolicy,
  }).allowed, false);
  assert.equal(evaluateAccessRequirement({
    scope: 'decision_state',
    liveAvailable: true,
    liveFresh: false,
    cacheState,
    cachePolicy,
  }).allowed, false);
  assert.equal(evaluateAccessRequirement({
    scope: 'human_authority',
    liveAvailable: true,
    liveFresh: true,
    cacheState,
    cachePolicy,
  }).mode, 'live');
});

test('non-authority supplemental reads may use bounded last-known-good cache', () => {
  assert.deepEqual(evaluateAccessRequirement({
    scope: 'supplemental',
    liveAvailable: false,
    liveFresh: false,
    cacheState: { usable: true, state: 'stale-cache', ageSeconds: 90 },
    cachePolicy: { failClosedScopes: [] },
  }), {
    allowed: true,
    mode: 'last-known-good',
    reason: 'stale-cache:90s',
  });
});

test('doctor report is deterministic and read-only', () => {
  const profile = byId.get('atlas-business-single-tenant');
  const report = buildDoctorReport(profile, {
    transports: { 'private-network': { available: true, healthy: true } },
    providers: { 'atlas-context': { health: 'healthy', sourceRevision: 'atlas-r7' } },
  }, new Date('2026-08-16T12:00:00Z'));
  assert.equal(report.readOnly, true);
  assert.equal(report.lifecycleMutationPerformed, false);
  assert.equal(report.hosts[0].transport.status, 'available');
  assert.equal(
    report.providers.find((provider) => provider.providerId === 'atlas-context').sourceRevision,
    'atlas-r7',
  );
});

test('safe lifecycle plans are dry-run, receipted, rollback-aware, and exclude private/derived state', () => {
  const plan = createSafeLifecyclePlan({
    operation: 'backup',
    profileId: 'generic-personal-local',
    receiptRef: 'receipt://backup-1',
    rollbackRef: 'rollback://backup-1',
  });
  assert.deepEqual(validateLifecyclePlan(plan), []);
  assert.equal(plan.mutationAuthorized, false);
  for (const required of ['secrets', 'raw_private_evidence', 'derived_indexes', 'caches', 'runtime_sessions']) {
    assert.ok(plan.excludeClasses.includes(required));
  }
});

test('unsafe lifecycle plans fail validation', () => {
  const errors = validateLifecyclePlan({
    schemaVersion: '1.0.0',
    operation: 'export',
    dryRun: false,
    receiptRef: 'receipt://x',
    rollbackRef: 'rollback://x',
    excludeClasses: ['secrets'],
  });
  assert.ok(errors.some((error) => error.includes('dry-run')));
  assert.ok(errors.some((error) => error.includes('raw_private_evidence')));
});

test('alternate business profile has no Brain/Mind/Steve/Office/MacBook dependency', () => {
  const text = JSON.stringify(byId.get('atlas-business-single-tenant')).toLowerCase();
  for (const forbidden of ['steve', 'office', 'macbook', 'brain', 'mind', 'obsidian']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});



test('lifecycle receipts are deterministic dry-run evidence with no writes performed', () => {
  const plan = createSafeLifecyclePlan({
    operation: 'update',
    profileId: 'generic-personal-local',
    receiptRef: 'receipt://update-1',
    rollbackRef: 'rollback://update-1',
  });
  const receipt = createDryRunLifecycleReceipt({
    plan,
    createdAt: new Date('2026-08-16T12:30:00Z'),
  });
  assert.equal(receipt.status, 'validated');
  assert.equal(receipt.mode, 'dry-run');
  assert.equal(receipt.writesPerformed, false);
  assert.equal(receipt.rollbackRef, 'rollback://update-1');
  assert.match(receipt.planHash, /^[a-f0-9]{64}$/);

  const blocked = createDryRunLifecycleReceipt({
    plan: { ...plan, dryRun: false },
    createdAt: new Date('2026-08-16T12:30:00Z'),
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.writesPerformed, false);
  assert.match(blocked.blockedReason, /dry-run/);
});
