import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { loadAndValidateIdentityAccess, validateIdentityAccessCatalog } from './validate-infrastructure-identity-access.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('identity and access catalog validates without raw secret material', () => {
  const result = loadAndValidateIdentityAccess({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.canonical.accounts, 2);
  assert.equal(result.counts.canonical.credentials, 0);
  assert.equal(result.counts.canonical.runtimeProfiles, 3);
  assert.equal(result.counts.canonical.runtimeInstances, 3);
  assert.equal(result.counts.canonical.accessPaths, 2);
  assert.equal(result.counts.alternate.accounts, 2);
  assert.equal(result.counts.alternate.credentials, 2);
  assert.equal(result.counts.alternate.sessions, 2);
  assert.equal(result.counts.alternate.runtimeProfiles, 2);
  assert.equal(result.counts.observations, 2);
});

test('canonical runtime instances are host-local while MacBook access paths remain remote', () => {
  const catalog = loadJson(path.join(root, 'operations/infrastructure/catalog/identity-access.v1.json'));
  assert.deepEqual(catalog.runtimeInstances.map((instance) => instance.runtimeHostId).sort(), ['host:macbook', 'host:office', 'host:office']);
  assert.deepEqual(catalog.accessPaths.map((accessPath) => [accessPath.sourceHostId, accessPath.destinationHostId, accessPath.accessMode]), [
    ['host:macbook', 'host:office', 'remote'],
    ['host:macbook', 'host:office', 'remote'],
  ]);
  assert.equal(catalog.runtimeInstances.every((instance) => instance.authenticationStorage.owner === 'application'), true);
  assert.equal(catalog.executionConnections.every((connection) => connection.targetRuntimeInstanceId === null), true);
  assert.equal(catalog.executionConnections.every((connection) => connection.sourceRuntimeInstanceId === 'runtime_instance:macbook.openai.02.desktop'), true);
});

test('the portable fixture proves multiple accounts for one provider and application-owned sessions', () => {
  const fixture = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
  assert.deepEqual(new Set(fixture.accounts.map((account) => account.providerId)), new Set(['provider-a']));
  assert.equal(fixture.sessions.every((session) => session.stateOwner === 'application'), true);
  assert.equal(fixture.credentials.every((credential) => credential.secretStoreRef?.startsWith('secret-ref://')), true);
  assert.deepEqual(new Set(fixture.runtimeProfiles.map((profile) => profile.accountId)), new Set(['account:provider-a.01', 'account:provider-a.02']));
  assert.equal(fixture.runtimeProfiles.every((profile) => profile.binding.state === 'declared'), true);
  assert.equal(fixture.runtimeProfiles.find((profile) => profile.authenticationStorage.mode === 'keyring')?.authenticationStorage.profileIsolationProven, null);
  assert.equal(fixture.runtimeProfiles.find((profile) => profile.authenticationStorage.mode === 'file')?.authenticationStorage.profileIsolationProven, false);
  assert.equal(fixture.sessions.every((session) => session.authenticationStorage.materialExposure !== 'metadata_only' || session.authenticationStorage.mode !== 'file'), true);
});

test('wrong-account evidence fails closed at the detailed and normalized levels', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const observations = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-observations-v1.json'));
  const wrongAccount = observations.observations.find((observation) => observation.detailedState === 'wrong_account');
  assert.equal(validateJsonSchema(schema.$defs.verificationObservation, wrongAccount, schema).length, 0);
  wrongAccount.expectedPrincipalMatch = 'verified';
  assert.notEqual(validateJsonSchema(schema.$defs.verificationObservation, wrongAccount, schema).length, 0);
});

test('schema rejects inline secret material and keepalive policy', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
  catalog.credentials[0].secretStoreRef = 'inline-secret-material';
  assert.notEqual(validateJsonSchema(schema.$defs.identityAccessCatalog, catalog, schema).length, 0);
  catalog.credentials[0].secretStoreRef = 'secret-ref://machine-runtime/provider-a.01/refresh';
  catalog.lifecyclePolicies[0].artificialKeepaliveAllowed = true;
  assert.notEqual(validateJsonSchema(schema.$defs.identityAccessCatalog, catalog, schema).length, 0);
});

test('validator rejects enabling secret-store mutation in the foundation tranche', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
  catalog.secretStoreAdapters[0].mutationMode = 'approval_gated';
  const result = validateIdentityAccessCatalog({ schema, catalog, label: '.mutation' });
  assert.ok(result.errors.some((error) => error.includes('mutation is not allowed')));
});

test('profile isolation cannot be marked proven without confirmed evidence', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const catalog = loadJson(path.join(root, 'operations/fixtures/infrastructure-identity-access-alternate-v1.json'));
  catalog.runtimeProfiles[1].authenticationStorage.profileIsolationProven = true;
  const result = validateIdentityAccessCatalog({ schema, catalog, label: '.profile-isolation' });
  assert.ok(result.errors.some((error) => error.includes('profileIsolationProven=true')));
});

test('catalog preserves preferred account separately from the current observed application session', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const fixture = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
  const result = validateIdentityAccessCatalog({ schema, catalog: fixture, label: '.codex-pilot-candidates' });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(fixture.accounts.find((account) => account.accountId === 'account:openai.01').accountRole, {
    class: 'primary', isPreferred: true, rank: 1,
  });
  assert.deepEqual(fixture.accounts.find((account) => account.accountId === 'account:openai.02').accountRole, {
    class: 'secondary', isPreferred: false, rank: 2,
  });
  const current = fixture.sessions.find((session) => fixture.currentObservedSessionIds.includes(session.sessionId));
  assert.equal(current.accountId, 'account:openai.02');
  assert.equal(current.binding.state, 'user_attested');
  assert.equal(current.runtimeProfileId, null);
});

test('catalog rejects more than one preferred account', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const fixture = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
  fixture.accounts[1].accountRole.isPreferred = true;
  const result = validateIdentityAccessCatalog({ schema, catalog: fixture, label: '.multiple-preferred' });
  assert.ok(result.errors.some((error) => error.includes('multiple preferred accounts')));
});

test('catalog rejects one-way account-to-surface links', () => {
  const schema = loadJson(path.join(root, 'operations/specs/infrastructure-identity-access-v1.schema.json'));
  const fixture = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json'));
  fixture.accounts[0].surfaceBindingIds = [];
  const result = validateIdentityAccessCatalog({ schema, catalog: fixture, label: '.reverse-surface-link' });
  assert.ok(result.errors.some((error) => error.includes('account reverse link missing')));
});
