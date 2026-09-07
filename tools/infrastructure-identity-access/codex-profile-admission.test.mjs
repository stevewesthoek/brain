import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadJson } from '../context-learning/context-learning-core.mjs';
import { validateIdentityAccessCatalog } from '../validate-infrastructure-identity-access.mjs';
import { applyCodexProfileAdmission, buildCodexProfileAdmissionPlan } from './codex-profile-admission.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
const canonical = (() => {
  const value = loadJson(path.join(root, 'operations/infrastructure/catalog/identity-access.v1.json'));
  // The live catalog may contain a prior real admission when tests run from a
  // developer checkout. Admission unit tests intentionally start from the
  // clean baseline, while preserving the catalog's static metadata.
  value.catalogVersion = '0.1.0';
  for (const collection of [
    'accounts', 'credentials', 'sessions', 'surfaceBindings', 'runtimeProfiles',
    'secretStoreAdapters', 'lifecyclePolicies', 'verificationPolicies',
  ]) value[collection] = [];
  return value;
})();
const candidate = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
const selectedProfiles = candidate.runtimeProfiles.map((profile) => profile.runtimeProfileId);

function successfulAcceptance(overrides = {}) {
  return {
    operation: 'finalize',
    status: 'OK',
    catalog: { candidateOnly: true, canonicalCatalogMutated: false },
    identity: { attribution: 'operator_attested', selectedProfiles, attestedProfiles: selectedProfiles },
    evidence: {
      targetScope: 'profile_scoped',
      profileIsolationProven: true,
      rootsDistinct: true,
      sharedDefaultRootPolicy: { mutation: 'forbidden' },
      profiles: selectedProfiles.map((runtimeProfileId) => ({
        runtimeProfileId,
        authentication: { status: 'authenticated' },
        security: { rootExists: true, safe: true },
        configuration: { state: 'owned' },
      })),
    },
    controls: {
      authContentsRead: false,
      authCopied: false,
      loginExecuted: false,
      logoutExecuted: false,
      routeMutation: false,
      canonicalCatalogMutation: false,
      sharedDefaultRootMutation: false,
    },
    ...overrides,
  };
}

test('admission derives an enrolled, account-agnostic profile collection without claiming concurrency', () => {
  const plan = buildCodexProfileAdmissionPlan({
    canonicalCatalog: canonical,
    candidateCatalog: candidate,
    acceptanceReport: successfulAcceptance(),
    acceptanceReportPath: '/tmp/codex-cli-pilot-finalize.json',
    schema,
    now: new Date('2026-09-06T00:00:00.000Z'),
  });
  assert.equal(plan.status, 'READY');
  assert.deepEqual(plan.changes.runtimeProfiles, selectedProfiles);
  assert.equal(plan.mergedCatalog.accounts.length, 2);
  assert.equal(plan.mergedCatalog.surfaceBindings.length, 2);
  assert.equal(plan.mergedCatalog.runtimeProfiles.length, 2);
  assert.equal(plan.mergedCatalog.sessions.length, 0);
  assert.equal(plan.mergedCatalog.runtimeProfiles.every((profile) => profile.binding.state === 'user_attested'), true);
  assert.equal(plan.mergedCatalog.runtimeProfiles.every((profile) => profile.authenticationStorage.profileIsolationProven === true), true);
  assert.equal(plan.mergedCatalog.runtimeProfiles.every((profile) => profile.switchPolicy.allowsConcurrentProfiles === false), true);
  assert.equal(validateIdentityAccessCatalog({ schema, catalog: plan.mergedCatalog, label: '.test-admitted' }).errors.length, 0);
});

test('admission fails closed on an unsuccessful or unsafe acceptance report', () => {
  const plan = buildCodexProfileAdmissionPlan({
    canonicalCatalog: canonical,
    candidateCatalog: candidate,
    acceptanceReport: successfulAcceptance({ status: 'NOT_OK' }),
    schema,
  });
  assert.equal(plan.status, 'BLOCKED');
  assert.ok(plan.reasons.includes('acceptance_report_not_successful_finalize'));
});

test('admission rejects a selected profile that is not a bound native CLI profile', () => {
  const nonCli = structuredClone(candidate);
  nonCli.runtimeProfiles[0].profileKind = 'webgpt_production';
  const plan = buildCodexProfileAdmissionPlan({
    canonicalCatalog: canonical,
    candidateCatalog: nonCli,
    acceptanceReport: successfulAcceptance(),
    schema,
  });
  assert.equal(plan.status, 'BLOCKED');
  assert.ok(plan.reasons.includes('unsupported_profile_surface:runtime_profile:openai.01.cli'));
});

test('admission fails closed on conflicting canonical identity records', () => {
  const seed = buildCodexProfileAdmissionPlan({
    canonicalCatalog: canonical,
    candidateCatalog: candidate,
    acceptanceReport: successfulAcceptance(),
    schema,
    now: new Date('2026-09-06T00:00:00.000Z'),
  });
  const conflicting = structuredClone(seed.mergedCatalog);
  conflicting.accounts[0] = { ...conflicting.accounts[0], displayName: 'conflicting existing record' };
  const plan = buildCodexProfileAdmissionPlan({
    canonicalCatalog: conflicting,
    candidateCatalog: candidate,
    acceptanceReport: successfulAcceptance(),
    schema,
  });
  assert.equal(plan.status, 'BLOCKED');
  assert.ok(plan.reasons.includes('catalog_id_conflict:account:openai.01'));
});

test('execution creates an owner-only backup and atomically publishes the validated catalog', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-profile-admission-'));
  const targetPath = path.join(tempRoot, 'identity-access.v1.json');
  const backupDir = path.join(tempRoot, 'backups');
  fs.writeFileSync(targetPath, `${JSON.stringify(canonical, null, 2)}\n`, { mode: 0o600 });
  const plan = buildCodexProfileAdmissionPlan({ canonicalCatalog: canonical, candidateCatalog: candidate, acceptanceReport: successfulAcceptance(), schema });
  const result = applyCodexProfileAdmission({ plan, targetPath, backupDir, now: new Date('2026-09-06T00:00:00.000Z') });
  assert.equal(result.status, 'OK');
  assert.equal(fs.statSync(targetPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(result.backupPath).mode & 0o777, 0o600);
  assert.equal(loadJson(targetPath).runtimeProfiles.length, 2);
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
