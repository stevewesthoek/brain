import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import test from 'node:test';
import { createMacOSKeychainAdapter } from './macos-keychain-adapter.mjs';
import { createSyntheticProviderAdapter, verifyCredential } from './credential-verification-boundary.mjs';

const SWIFT = '/usr/bin/swift';
const FIXTURE_SCRIPT = new URL('./macos-keychain-synthetic-fixture.swift', import.meta.url).pathname;
const SERVICE = 'com.brain.identity-access.synthetic.e2e';
const ACCOUNT = 'brain-verification-e2e';
const REFERENCE = `keychain-ref://${SERVICE}/${ACCOUNT}`;
const CREDENTIAL_ID = 'credential:fixture.account.02';
const BASE_EXPECTED_PRINCIPAL = {
  principalType: 'provider_account',
  principalRef: 'fixture.account.02',
  displayLabel: 'synthetic-secondary',
  matchStrategy: 'provider_asserted_subject',
};
const BASE_POLICY = {
  probeMode: 'read_only',
  readOnlyOnly: true,
  requiredScopes: ['fixture.read'],
};

function safeEnvironment() {
  const environment = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };
  for (const key of ['HOME', 'USER', 'LOGNAME', 'TMPDIR']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return environment;
}

function runProcess(executable, args, input = '') {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: '/',
      env: safeEnvironment(),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => resolve({ code: null, stdout: '', stderr: '' }));
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function mutateSyntheticFixture(operation, secret = '') {
  const result = await runProcess(SWIFT, [FIXTURE_SCRIPT, operation, SERVICE, ACCOUNT], secret);
  if (secret) {
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stderr.includes(secret), false);
  }
  return result;
}

function request({ expectedPrincipal = BASE_EXPECTED_PRINCIPAL, providerMode = 'normal', secretStoreAdapter = createMacOSKeychainAdapter() } = {}) {
  return verifyCredential({
    credentialId: CREDENTIAL_ID,
    credentialRef: REFERENCE,
    expectedPrincipal,
    verificationPolicy: BASE_POLICY,
    providerAdapter: createSyntheticProviderAdapter({ mode: providerMode }),
    secretStoreAdapter,
  });
}

test('native bounded boundary verifies synthetic Keychain data without exposing the canary', { skip: process.platform !== 'darwin' }, async () => {
  const canary = `brain-synthetic:v1:fixture.account.02:fixture.read:2099-01-01T00:00:00Z:${crypto.randomUUID()}`;
  const rejectedCanary = `brain-synthetic:rejected:${crypto.randomUUID()}`;
  try {
    await mutateSyntheticFixture('delete');
    const added = await mutateSyntheticFixture('add', canary);
    assert.equal(added.code, 0);
    assert.equal(added.stdout.trim(), 'added');

    const healthy = await request();
    assert.equal(healthy.detailedState, 'verified_healthy', JSON.stringify(healthy));
    assert.equal(healthy.normalizedStatus, 'healthy');
    assert.equal(healthy.expectedPrincipalMatch, 'verified');
    assert.equal(JSON.stringify(healthy).includes(canary), false);

    const wrongAccount = await request({ expectedPrincipal: { ...BASE_EXPECTED_PRINCIPAL, principalRef: 'fixture.account.01' } });
    assert.equal(wrongAccount.detailedState, 'wrong_account');
    assert.equal(wrongAccount.normalizedStatus, 'unhealthy');
    assert.equal(JSON.stringify(wrongAccount).includes(canary), false);

    const providerUnavailable = await request({ providerMode: 'unavailable' });
    assert.equal(providerUnavailable.detailedState, 'provider_unavailable');
    assert.notEqual(providerUnavailable.normalizedStatus, 'healthy');
    assert.equal(JSON.stringify(providerUnavailable).includes(canary), false);

    const verifierLeakAttempt = await request({ providerMode: 'leak' });
    assert.equal(verifierLeakAttempt.detailedState, 'unknown');
    assert.notEqual(verifierLeakAttempt.normalizedStatus, 'healthy');
    assert.equal(JSON.stringify(verifierLeakAttempt).includes(canary), false);

    const cli = await runProcess(process.execPath, [
      new URL('./credential-verification-cli.mjs', import.meta.url).pathname,
      '--credential-ref', REFERENCE,
      '--expected-principal', 'fixture.account.02',
      '--credential-id', CREDENTIAL_ID,
    ]);
    assert.equal(cli.code, 0);
    assert.equal(cli.stdout.includes(canary), false);
    assert.equal(cli.stderr.includes(canary), false);
    assert.equal(process.argv.includes(canary), false);
    assert.equal([REFERENCE, 'fixture.account.02', CREDENTIAL_ID].some((arg) => arg.includes(canary)), false);
    const cliObservation = JSON.parse(cli.stdout);
    assert.equal(cliObservation.detailedState, 'verified_healthy');
    assert.equal(cliObservation.secretValueReturned, undefined);

    const rejected = await mutateSyntheticFixture('delete');
    assert.equal(rejected.code, 0);
    const rejectedAdd = await mutateSyntheticFixture('add', rejectedCanary);
    assert.equal(rejectedAdd.code, 0);
    const providerRejected = await request();
    assert.equal(providerRejected.detailedState, 'provider_rejected');
    assert.equal(providerRejected.normalizedStatus, 'unhealthy');
    assert.equal(JSON.stringify(providerRejected).includes(rejectedCanary), false);

    const missing = await mutateSyntheticFixture('delete');
    assert.equal(missing.code, 0);
    const credentialMissing = await request();
    assert.equal(credentialMissing.detailedState, 'credential_missing');
    assert.notEqual(credentialMissing.normalizedStatus, 'healthy');
    assert.equal(JSON.stringify(credentialMissing).includes(rejectedCanary), false);
  } finally {
    await mutateSyntheticFixture('delete');
  }
});
