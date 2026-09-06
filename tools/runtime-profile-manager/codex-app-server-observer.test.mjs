import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  observeCodexAppServerAccount,
  redactCodexAccountRead,
} from './codex-app-server-observer.mjs';
import { createPrivateIdentityMatcher } from './private-identity-matcher.mjs';

test('account/read observation keeps identity bounded and excludes secret fields', () => {
  const observation = redactCodexAccountRead({
    response: {
      result: {
        account: {
          type: 'chatgpt',
          email: 'account@example.invalid',
          planType: 'plus',
          accessToken: 'must-not-escape',
        },
        requiresOpenaiAuth: false,
        unexpectedProviderField: 'ignored',
      },
    },
  });

  assert.equal(observation.status, 'authenticated');
  assert.equal(observation.emailPresent, true);
  assert.equal(observation.planType, 'plus');
  assert.equal(observation.observedPrincipalRef, null);
  assert.equal(observation.refreshTokenRequested, false);
  assert.equal(observation.secretsExcluded, true);
  assert.equal('email' in observation, false);
  assert.equal('accessToken' in observation, false);
  assert.match(observation.limitation, /stable_non_personal_principal/);
});

test('account/read reports required reauthentication without treating it as a transport failure', () => {
  const observation = redactCodexAccountRead({
    response: { result: { account: null, requiresOpenaiAuth: true } },
  });
  assert.equal(observation.state, 'confirmed');
  assert.equal(observation.status, 'not_authenticated');
  assert.equal(observation.requiresOpenaiAuth, true);
  assert.equal(observation.refreshTokenRequested, false);
});

test('app-server observer performs initialize then read without refresh', async () => {
  const child = new EventEmitter();
  const stdout = new EventEmitter();
  const writes = [];
  child.stdout = stdout;
  child.stdin = {
    write(value) {
      const message = JSON.parse(value);
      writes.push(message);
      if (message.method === 'initialize') {
        queueMicrotask(() => stdout.emit('data', `${JSON.stringify({ id: 1, result: {} })}\n`));
      }
      if (message.method === 'account/read') {
        queueMicrotask(() => stdout.emit('data', `${JSON.stringify({
          id: 2,
          result: {
            account: { type: 'chatgpt', email: 'hidden@example.invalid', planType: 'pro', refreshToken: 'secret' },
            requiresOpenaiAuth: false,
          },
        })}\n`));
      }
    },
    end() {},
  };
  child.kill = () => {};

  const observation = await observeCodexAppServerAccount({
    root: '/tmp/synthetic-codex-profile',
    executable: 'codex',
    spawnProcess: () => child,
    timeoutMs: 1_000,
  });

  assert.deepEqual(writes.map((message) => message.method), ['initialize', 'initialized', 'account/read']);
  assert.equal(writes.at(-1).params.refreshToken, false);
  assert.equal(observation.status, 'authenticated');
  assert.equal(observation.emailPresent, true);
  assert.equal(observation.observedPrincipalRef, null);
  assert.equal(observation.secretsExcluded, true);
  assert.equal(observation.observationRoot, 'ephemeral');
  assert.equal(observation.targetRootMutation, false);
});

test('app-server observer never starts in the target root or leaves runtime residue', async () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-observer-source-'));
  const sourceAuth = path.join(sourceRoot, 'auth.json');
  fs.writeFileSync(sourceAuth, 'synthetic-auth-placeholder', { mode: 0o600 });
  let spawnedHome = null;
  let spawnedExecutable = null;
  let spawnedArgs = null;
  const child = new EventEmitter();
  const stdout = new EventEmitter();
  child.stdout = stdout;
  child.stdin = {
    write(value) {
      const message = JSON.parse(value);
      if (message.method === 'initialize') queueMicrotask(() => stdout.emit('data', `${JSON.stringify({ id: 1, result: {} })}\n`));
      if (message.method === 'account/read') queueMicrotask(() => stdout.emit('data', `${JSON.stringify({ id: 2, result: { account: { type: 'chatgpt' }, requiresOpenaiAuth: false } })}\n`));
    },
    end() {},
  };
  child.kill = () => {};

  const observation = await observeCodexAppServerAccount({
    root: sourceRoot,
    spawnProcess: (executable, args, options) => {
      spawnedExecutable = executable;
      spawnedArgs = args;
      spawnedHome = options.env.CODEX_HOME;
      assert.notEqual(spawnedHome, sourceRoot);
      assert.equal(fs.lstatSync(path.join(spawnedHome, 'auth.json')).isSymbolicLink(), true);
      return child;
    },
    timeoutMs: 1_000,
  });

  assert.equal(observation.status, 'authenticated');
  if (process.platform === 'darwin') {
    assert.equal(spawnedExecutable, '/usr/bin/sandbox-exec');
    assert.equal(spawnedArgs[2], 'codex');
    assert.match(spawnedArgs[1], /deny file-write\*/);
    assert.match(spawnedArgs[1], new RegExp(sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(fs.existsSync(spawnedHome), false);
  assert.equal(fs.readFileSync(sourceAuth, 'utf8'), 'synthetic-auth-placeholder');
  fs.rmSync(sourceRoot, { recursive: true, force: true });
});

test('private identity matcher can bind an account without returning provider PII', () => {
  const matcher = createPrivateIdentityMatcher({
    providerId: 'openai',
    resolveExpectedIdentity: () => ({ accountId: 'account:openai.01', email: 'private@example.invalid' }),
  });
  const result = redactCodexAccountRead({
    response: { result: { account: { type: 'chatgpt', planType: 'plus', email: 'private@example.invalid' } } },
    identityMatcher: matcher,
  });
  assert.equal(result.canonicalAccountId, 'account:openai.01');
  assert.equal(result.identityMatch, 'matched');
  assert.equal(result.emailPresent, true);
  assert.equal(Object.hasOwn(result, 'email'), false);
  assert.doesNotMatch(JSON.stringify(result), /private@example\.invalid/);
});

test('provider subject is retained only as an opaque match signal', () => {
  const observation = redactCodexAccountRead({
    response: { result: { account: { type: 'chatgpt', subject: 'provider-subject://openai/account-01', email: 'hidden@example.invalid' } } },
    expectedPrincipal: { principalRef: 'provider-subject://openai/account-01', matchStrategy: 'provider_asserted_id' },
  });
  assert.equal(observation.observedPrincipalRef, 'provider-subject://openai/account-01');
  assert.equal(observation.expectedPrincipalMatch, 'verified');
  assert.doesNotMatch(JSON.stringify(observation), /hidden@example\.invalid/);
});
