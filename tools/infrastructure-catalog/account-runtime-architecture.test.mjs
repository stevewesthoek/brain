import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';
import {
  allocateAccountIdentity,
  allocateSurfaceBinding,
  buildIncrementalProfileVerificationPlan,
  buildSurfaceCapabilityMatrix,
  prepareAccountEnrollment,
  runtimeProfileIdFor,
  surfaceBindingIdFor,
  validateDynamicCatalogShape,
} from './account-runtime-architecture.mjs';

function emptyCatalog() {
  return { accounts: [], surfaceBindings: [], runtimeProfiles: [], sessions: [], verificationPolicies: [], lifecyclePolicies: [] };
}

function appendAccount(catalog, identityRef, index) {
  const allocation = allocateAccountIdentity({ catalog, providerId: 'openai', identityRef, observedAt: '2026-09-05T00:00:00Z' });
  assert.equal(allocation.state, 'allocated');
  const account = { ...allocation.account };
  const next = { ...catalog, accounts: [...catalog.accounts, account] };
  const surface = allocateSurfaceBinding({ catalog: next, account, surfaceId: 'codex-cli', observedAt: '2026-09-05T00:00:00Z' });
  account.surfaceBindingIds = [surface.surfaceBindingId];
  account.runtimeProfileIds = [surface.runtimeProfileId];
  next.accounts[next.accounts.length - 1] = account;
  next.surfaceBindings = [...next.surfaceBindings, surface.surfaceBinding];
  next.runtimeProfiles = [...next.runtimeProfiles, surface.runtimeProfile];
  assert.equal(account.displayName.includes(String(index)), true);
  return next;
}

for (const count of [1, 2, 5, 20]) {
  test(`dynamic allocator supports ${count} accounts without count-specific logic`, () => {
    let catalog = emptyCatalog();
    for (let index = 1; index <= count; index += 1) {
      catalog = appendAccount(catalog, `opaque-ref://openai/synthetic-${index}`, index);
    }
    assert.deepEqual(validateDynamicCatalogShape({ catalog }), []);
    assert.equal(new Set(catalog.accounts.map((account) => account.accountId)).size, count);
    assert.equal(new Set(catalog.runtimeProfiles.map((profile) => profile.runtimeProfileId)).size, count);
    assert.equal(new Set(catalog.runtimeProfiles.map((profile) => profile.isolationRef)).size, count);
    assert.equal(catalog.accounts.every((account) => account.accountRole.isPreferred === false), true);
  });
}

test('allocator never reuses an identifier from a retired account', () => {
  const catalog = emptyCatalog();
  const first = appendAccount(catalog, 'opaque-ref://openai/retired-1', 1);
  first.accounts[0].lifecycleState = 'retired';
  const next = appendAccount(first, 'opaque-ref://openai/new-2', 2);
  assert.notEqual(next.accounts[0].accountId, next.accounts[1].accountId);
  assert.equal(next.accounts[1].accountId, 'account:openai.02');
});

test('allocator reserves ordinals from canonical and legacy semantic identifiers', () => {
  const catalog = {
    ...emptyCatalog(),
    accounts: [
      { accountId: 'account:openai.01', providerId: 'openai', lifecycleState: 'retired' },
      { accountId: 'account:openai.personal.02', providerId: 'openai', lifecycleState: 'retired' },
      { accountId: 'account:openai.primary.04', providerId: 'openai', lifecycleState: 'retired' },
    ],
  };
  const allocation = allocateAccountIdentity({
    catalog,
    providerId: 'openai',
    identityRef: 'opaque-ref://openai/new-5',
  });
  assert.equal(allocation.accountId, 'account:openai.05');
});

test('account identifiers are stable when role policy changes', () => {
  const first = allocateAccountIdentity({
    catalog: emptyCatalog(),
    providerId: 'openai',
    identityRef: 'opaque-ref://openai/stable',
    preferred: false,
  });
  const second = allocateAccountIdentity({
    catalog: emptyCatalog(),
    providerId: 'openai',
    identityRef: 'opaque-ref://openai/stable',
    preferred: true,
  });
  assert.equal(first.accountId, second.accountId);
  assert.equal(first.accountId, 'account:openai.01');
  assert.notEqual(first.role.class, second.role.class);
});

test('new account identifiers never encode mutable role semantics', () => {
  let catalog = emptyCatalog();
  for (const [index, purpose] of ['default', 'overflow_capacity', 'primary'].entries()) {
    const allocation = allocateAccountIdentity({
      catalog,
      providerId: 'openai',
      identityRef: `opaque-ref://openai/semantic-${index}`,
      purpose,
      preferred: purpose === 'primary',
    });
    assert.match(allocation.accountId, /^account:openai\.\d{2}$/);
    assert.doesNotMatch(allocation.accountId, /personal|work|business|primary|secondary/);
    catalog = { ...catalog, accounts: [...catalog.accounts, allocation.account] };
  }
});

test('preferred policy is explicit and does not follow the active account', () => {
  const catalog = emptyCatalog();
  const preferred = allocateAccountIdentity({ catalog, providerId: 'openai', identityRef: 'opaque-ref://openai/preferred', preferred: true });
  assert.deepEqual(preferred.role, { class: 'primary', isPreferred: true, rank: 1 });
  const withPreferred = { ...catalog, accounts: [preferred.account] };
  const secondary = allocateAccountIdentity({ catalog: withPreferred, providerId: 'openai', identityRef: 'opaque-ref://openai/secondary' });
  assert.equal(secondary.role.isPreferred, false);
  assert.equal(secondary.role.class, 'secondary');
  assert.throws(() => allocateAccountIdentity({ catalog: withPreferred, providerId: 'openai', identityRef: 'opaque-ref://openai/second-preferred', preferred: true }), /preferred account already exists/);
  assert.throws(() => allocateAccountIdentity({ catalog, providerId: 'openai', identityRef: 'opaque-ref://openai/invalid-primary', purpose: 'primary' }), /preferred=true/);
});

test('known identity re-observation is idempotent and creates no duplicate binding', () => {
  const account = {
    accountId: 'account:openai.01',
    providerId: 'openai',
    accountKind: 'human_account',
    displayName: 'OpenAI primary account 01',
    lifecycleState: 'enrolled',
    accountRole: { class: 'primary', isPreferred: true, rank: 1 },
    expectedPrincipal: { principalType: 'provider_account', principalRef: 'opaque-ref://openai/preferred', displayLabel: null, matchStrategy: 'provider_asserted_subject' },
    credentialIds: [], sessionIds: [], surfaceBindingIds: [], runtimeProfileIds: [], verificationPolicyId: 'verification_policy:read-only', recoveryRunbookRef: 'runbook://openai/reauth',
    provenance: { sourceRef: 'test', classification: 'USER-PROPOSED', verifiedAt: '2026-09-05T00:00:00Z', freshnessDeadline: '2026-10-05T00:00:00Z', owner: 'test', evidenceRefs: [] },
  };
  const seeded = { ...emptyCatalog(), accounts: [account] };
  const surface = allocateSurfaceBinding({ catalog: seeded, account, surfaceId: 'codex-cli' });
  account.surfaceBindingIds = [surface.surfaceBindingId];
  account.runtimeProfileIds = [surface.runtimeProfileId];
  const first = prepareAccountEnrollment({ catalog: { ...seeded, surfaceBindings: [surface.surfaceBinding], runtimeProfiles: [surface.runtimeProfile] }, observation: { providerId: 'openai', providerPrincipalRef: 'opaque-ref://openai/preferred', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' }, identityRef: 'opaque-ref://openai/preferred', surfaceId: 'codex-cli' });
  assert.equal(first.status, 'known_account');
  assert.equal(first.catalogMutation.proposedRecords.length, 0);
});

test('unknown account becomes a candidate and requires an official login without auth transfer', () => {
  const result = prepareAccountEnrollment({
    catalog: emptyCatalog(),
    observation: { observationId: 'observation:openai.new', providerId: 'openai', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    surfaceId: 'codex-cli',
  });
  assert.equal(result.status, 'candidate_requires_stable_identity');
  assert.equal(result.accountId, null);
  assert.equal(result.officialLogin.managerExecutes, false);
  assert.equal(result.officialLogin.authCopied, false);
  assert.equal(result.redaction.rawIdentityValueReturned, false);
});

test('opaque new account gets a candidate account and dedicated surface runtime', () => {
  const result = prepareAccountEnrollment({
    catalog: emptyCatalog(),
    observation: { observationId: 'observation:openai.new', providerId: 'openai', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    identityRef: 'opaque-ref://openai/new-account',
    surfaceId: 'codex-cli',
  });
  assert.equal(result.status, 'candidate_prepared');
  assert.equal(result.account.accountRole.isPreferred, false);
  assert.equal(result.surfaceBinding.accountId, result.accountId);
  assert.equal(result.runtimeProfile.surfaceBindingId, result.surfaceBinding.surfaceBindingId);
  assert.equal(result.runtimeProfile.runtimeProfileId, runtimeProfileIdFor(result.accountId, 'codex-cli'));
  assert.equal(result.surfaceBinding.surfaceBindingId, surfaceBindingIdFor(result.accountId, 'codex-cli'));
  assert.equal(result.admissionPlan.executionEnabled, false);
  assert.equal(result.catalogMutation.performed, false);
  assert.deepEqual(result.account.surfaceBindingIds, [result.surfaceBinding.surfaceBindingId]);
  assert.deepEqual(result.account.runtimeProfileIds, [result.runtimeProfile.runtimeProfileId]);
});

test('new account proposals can be admitted as a schema-valid linked unit', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
  const result = prepareAccountEnrollment({
    catalog,
    observation: { observationId: 'observation:openai.schema-proposal', providerId: 'openai', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    identityRef: 'opaque-ref://openai/schema-proposal',
    surfaceId: 'codex-cli',
  });
  const next = structuredClone(catalog);
  next.accounts.push(result.account);
  next.surfaceBindings.push(result.surfaceBinding);
  next.runtimeProfiles.push(result.runtimeProfile);
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  assert.deepEqual(validateJsonSchema(schema.$defs.identityAccessCatalog, next, schema), []);
});

test('private matcher output can enroll a known account without exposing its identity value', () => {
  const account = {
    accountId: 'account:openai.01',
    providerId: 'openai',
    accountKind: 'human_account',
    displayName: 'OpenAI primary account 01',
    lifecycleState: 'enrolled',
    accountRole: { class: 'primary', isPreferred: true, rank: 1 },
    expectedPrincipal: { principalType: 'provider_account', principalRef: 'opaque-ref://openai/private', displayLabel: null, matchStrategy: 'provider_asserted_subject' },
    credentialIds: [], sessionIds: [], surfaceBindingIds: [], runtimeProfileIds: [], verificationPolicyId: 'verification_policy:read-only', recoveryRunbookRef: 'runbook://openai/reauth',
    provenance: { sourceRef: 'test', classification: 'USER-PROPOSED', verifiedAt: '2026-09-05T00:00:00Z', freshnessDeadline: '2026-10-05T00:00:00Z', owner: 'test', evidenceRefs: [] },
  };
  const result = prepareAccountEnrollment({
    catalog: { ...emptyCatalog(), accounts: [account] },
    observation: { observationId: 'observation:openai.private', providerId: 'openai', status: 'authenticated', canonicalAccountId: account.accountId, observedAt: '2026-09-05T00:00:00Z' },
    surfaceId: 'codex-mcp',
  });
  assert.equal(result.status, 'known_account');
  assert.equal(result.accountId, account.accountId);
  assert.equal(result.catalogMutation.performed, false);
});

test('partial surface enrollment proposes only the missing runtime record and link', () => {
  const account = {
    accountId: 'account:openai.02',
    providerId: 'openai',
    accountKind: 'human_account',
    displayName: 'OpenAI secondary account 01',
    lifecycleState: 'candidate',
    accountRole: { class: 'secondary', isPreferred: false, rank: 1 },
    expectedPrincipal: { principalType: 'provider_account', principalRef: 'opaque-ref://openai/partial', displayLabel: null, matchStrategy: 'provider_asserted_subject' },
    credentialIds: [], sessionIds: [], surfaceBindingIds: [], runtimeProfileIds: [], verificationPolicyId: 'verification_policy:read-only', recoveryRunbookRef: 'runbook://openai/reauth',
    provenance: { sourceRef: 'test', classification: 'USER-PROPOSED', verifiedAt: '2026-09-05T00:00:00Z', freshnessDeadline: '2026-09-05T01:00:00Z', owner: 'test', evidenceRefs: [] },
  };
  const binding = allocateSurfaceBinding({ catalog: { ...emptyCatalog(), accounts: [account] }, account, surfaceId: 'codex-cli' });
  const result = prepareAccountEnrollment({
    catalog: { ...emptyCatalog(), accounts: [account], surfaceBindings: [binding.surfaceBinding] },
    observation: { observationId: 'observation:openai.partial', providerId: 'openai', providerPrincipalRef: 'opaque-ref://openai/partial', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    surfaceId: 'codex-cli',
  });
  assert.equal(result.status, 'known_account');
  assert.equal(result.runtimeProfile.runtimeProfileId, 'runtime_profile:openai.02.cli');
  assert.equal(result.catalogMutation.proposedRecords.some((record) => record.runtimeProfileId === result.runtimeProfile.runtimeProfileId), true);
  assert.deepEqual(result.account.runtimeProfileIds, [result.runtimeProfile.runtimeProfileId]);
});

test('binding changes are explicit and require admission', () => {
  const original = prepareAccountEnrollment({
    catalog: emptyCatalog(),
    observation: { observationId: 'observation:openai.original', providerId: 'openai', providerPrincipalRef: 'opaque-ref://openai/original', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    identityRef: 'opaque-ref://openai/original',
    surfaceId: 'codex-cli',
  });
  const catalog = { ...emptyCatalog(), accounts: [original.account], surfaceBindings: [original.surfaceBinding], runtimeProfiles: [original.runtimeProfile] };
  const changed = prepareAccountEnrollment({
    catalog,
    observation: { observationId: 'observation:openai.changed', providerId: 'openai', providerPrincipalRef: 'opaque-ref://openai/changed', status: 'authenticated', observedAt: '2026-09-05T00:00:00Z' },
    identityRef: 'opaque-ref://openai/changed',
    surfaceId: 'codex-cli',
    boundAccountId: original.accountId,
    surfaceBindingId: original.surfaceBinding.surfaceBindingId,
  });
  assert.equal(changed.bindingChange.event, 'account_binding_changed');
  assert.equal(changed.bindingChange.previousAccountId, original.accountId);
  assert.notEqual(changed.bindingChange.observedAccountId, original.accountId);
});

test('incremental persistence verification is linear rather than pairwise', () => {
  const ids = Array.from({ length: 20 }, (_, index) => `runtime_profile:openai.${String(index + 1).padStart(2, '0')}.cli`);
  const plan = buildIncrementalProfileVerificationPlan(ids, { newProfileId: ids[19] });
  assert.equal(plan.checkCount, 39);
  assert.equal(plan.complexity, 'O(N)');
  assert.deepEqual(plan.phases.map((phase) => phase.profileIds.length), [19, 1, 19]);
});

test('surface capability matrix keeps unknown and unsupported distinct', () => {
  const matrix = buildSurfaceCapabilityMatrix({ catalog: { surfaceBindings: [{ surfaceId: 'codex-cli', capabilityEvidence: { authIsolation: 'unknown', concurrentProfiles: 'unsupported' } }] } });
  const cli = matrix.rows.find((row) => row.surfaceId === 'codex-cli');
  assert.equal(cli.nAccountModel, 'supported');
  assert.equal(cli.authIsolation, 'unknown');
  assert.equal(cli.concurrentProfiles, 'unsupported');
  assert.equal(matrix.liveOAuthPerformed, false);
});
