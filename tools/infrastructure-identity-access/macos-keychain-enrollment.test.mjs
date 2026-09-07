import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { createMacOSKeychainAdapter } from './macos-keychain-adapter.mjs';
import { createSyntheticProviderAdapter, verifyCredential } from './credential-verification-boundary.mjs';

const SWIFT = '/usr/bin/swift';
const ENROLL_SCRIPT = path.join(import.meta.dirname, 'macos-keychain-enroll-github.swift');
const FIXTURE_SCRIPT = path.join(import.meta.dirname, 'macos-keychain-github-enrollment-fixture.swift');
const SERVICE = 'tools.prochat.brain.github';
const ACCOUNT = 'github.account.synthetic';
const REFERENCE = `keychain-ref://${SERVICE}/${ACCOUNT}`;
const EXPECT_SCRIPT = String.raw`
set timeout 15
set mode $env(BRAIN_TEST_OVERWRITE)
set secretFd [open "/dev/fd/3" r]
gets $secretFd secret
close $secretFd
log_user 1
spawn /usr/bin/swift /Users/Office/Repos/stevewesthoek/brain/tools/infrastructure-identity-access/macos-keychain-enroll-github.swift github.account.synthetic other
expect {
    -exact {Existing Brain Keychain item found. Overwrite it? [y/N]: } {
        if {$mode eq "y"} {
            send "y\r"
            expect "GitHub credential (input hidden): "
            send -- "$secret\r"
        } else {
            send "n\r"
        }
    }
    -exact {GitHub credential (input hidden): } {
        send -- "$secret\r"
    }
    timeout {
        exit 124
    }
}
expect eof
set waitResult [wait]
exit [lindex $waitResult 3]
`.replace('/Users/Office/Repos/stevewesthoek/brain/tools/infrastructure-identity-access/macos-keychain-enroll-github.swift', ENROLL_SCRIPT);
function safeEnvironment() {
  const environment = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };
  for (const key of ['HOME', 'USER', 'LOGNAME', 'TMPDIR']) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return environment;
}

function runProcess(executable, args, input = '', extraEnvironment = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: '/',
      env: { ...safeEnvironment(), ...extraEnvironment },
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

function runInteractiveEnrollment(secret, mode) {
  return new Promise((resolve) => {
    const child = spawn('/usr/bin/expect', ['-f', '/dev/stdin'], {
      cwd: '/',
      env: { ...safeEnvironment(), BRAIN_TEST_OVERWRITE: mode },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => resolve({ code: null, stdout: '', stderr: '' }));
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.end(EXPECT_SCRIPT);
    child.stdio[3].end(`${secret}\n`);
  });
}

function parseLastJson(output) {
  const line = output.split(/\r?\n/).map((candidate) => candidate.trim()).findLast((candidate) => candidate.startsWith('{'));
  assert.ok(line, `expected a JSON result, got: ${JSON.stringify(output)}`);
  return JSON.parse(line);
}

async function mutateFixture(operation, secret = '') {
  return runProcess(SWIFT, [FIXTURE_SCRIPT, operation], secret);
}

async function verifyFixture(expectedPrincipal) {
  return verifyCredential({
    credentialId: 'credential:github.account.synthetic',
    credentialRef: REFERENCE,
    expectedPrincipal: {
      principalType: 'provider_account',
      principalRef: expectedPrincipal,
      displayLabel: 'synthetic-enrollment',
      matchStrategy: 'provider_asserted_subject',
    },
    verificationPolicy: { probeMode: 'read_only', readOnlyOnly: true, requiredScopes: ['fixture.read'] },
    providerAdapter: createSyntheticProviderAdapter(),
    secretStoreAdapter: createMacOSKeychainAdapter(),
    now: '2030-01-01T00:00:00Z',
  });
}

test('GitHub enrollment source is fixed, interactive, and redacted', () => {
  const source = fs.readFileSync(ENROLL_SCRIPT, 'utf8');
  assert.match(source, /let githubService = "tools\.prochat\.brain\.github"/);
  assert.match(source, /isatty\(STDIN_FILENO\)/);
  assert.match(source, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(source, /Existing Brain Keychain item found\. Overwrite it\?/);
  assert.match(source, /secretValueReturned/);
  assert.doesNotMatch(source, /servicePrefix|--service|--account/);
});

test('interactive enrollment hides input and requires explicit overwrite confirmation', { skip: process.platform !== 'darwin' }, async () => {
  const firstPrincipal = 'fixture.enrollment.01';
  const secondPrincipal = 'fixture.enrollment.02';
  const firstSecret = `brain-synthetic:v1:${firstPrincipal}:fixture.read:2099-01-01T00:00:00Z:${crypto.randomUUID()}`;
  const secondSecret = `brain-synthetic:v1:${secondPrincipal}:fixture.read:2099-01-01T00:00:00Z:${crypto.randomUUID()}`;
  try {
    const deleted = await mutateFixture('delete');
    assert.ok([0, 1].includes(deleted.code));

    const added = await runInteractiveEnrollment(firstSecret, 'n');
    assert.equal(added.code, 0, JSON.stringify(added));
    assert.equal(added.stderr.includes(firstSecret), false);
    assert.equal(added.stdout.includes(firstSecret), false);
    const addedResult = parseLastJson(added.stdout);
    assert.equal(addedResult.ok, true);
    assert.equal(addedResult.overwrote, false);
    assert.equal(addedResult.containsSecrets, false);
    assert.equal(addedResult.secretValueReturned, false);
    assert.equal(addedResult.reference, REFERENCE);

    const healthy = await verifyFixture(firstPrincipal);
    assert.equal(healthy.detailedState, 'verified_healthy', JSON.stringify(healthy));
    assert.equal(JSON.stringify(healthy).includes(firstSecret), false);

    const refused = await runInteractiveEnrollment(secondSecret, 'n');
    assert.notEqual(refused.code, 0);
    assert.equal(refused.stdout.includes(secondSecret), false);
    assert.equal(refused.stderr.includes(secondSecret), false);
    assert.equal(parseLastJson(refused.stdout).reasonCode, 'existing_item_not_overwritten');

    const unchanged = await verifyFixture(firstPrincipal);
    assert.equal(unchanged.detailedState, 'verified_healthy', JSON.stringify(unchanged));

    const overwritten = await runInteractiveEnrollment(secondSecret, 'y');
    assert.equal(overwritten.code, 0, JSON.stringify(overwritten));
    assert.equal(overwritten.stdout.includes(secondSecret), false);
    assert.equal(overwritten.stderr.includes(secondSecret), false);
    const overwrittenResult = parseLastJson(overwritten.stdout);
    assert.equal(overwrittenResult.ok, true);
    assert.equal(overwrittenResult.overwrote, true);
    assert.equal(overwrittenResult.containsSecrets, false);
    assert.equal(overwrittenResult.secretValueReturned, false);

    const replaced = await verifyFixture(secondPrincipal);
    assert.equal(replaced.detailedState, 'verified_healthy', JSON.stringify(replaced));
    const oldPrincipal = await verifyFixture(firstPrincipal);
    assert.equal(oldPrincipal.detailedState, 'wrong_account', JSON.stringify(oldPrincipal));
  } finally {
    const cleanup = await mutateFixture('delete');
    assert.ok([0, 1].includes(cleanup.code));
  }
});
