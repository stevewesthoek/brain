import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { routeRequest } from '../api/routes.js';
import {
  BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY,
  BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
  BrainServiceAuthenticator,
  brainServiceContentSha256,
  signBrainServiceRequest,
} from '../security/brain-service-auth.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const SERVICE_ID = 'service:brain-console';
const SECRET = 'fixture-only-service-secret';
const NOW = '2026-09-14T10:00:00.000Z';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function headersFor(input: { method: string; pathname: string; body: string; serviceId?: string; secret?: string; timestamp?: string }): Record<string, string> {
  const serviceId = input.serviceId ?? SERVICE_ID;
  const secret = input.secret ?? SECRET;
  const timestamp = input.timestamp ?? NOW;
  const contentSha256 = brainServiceContentSha256(input.body);
  return {
    'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
    'x-brain-service-id': serviceId,
    'x-brain-request-id': 'request:fixture:001',
    'x-brain-request-timestamp': timestamp,
    'x-brain-content-sha256': contentSha256,
    'x-brain-signature': signBrainServiceRequest({ serviceId, secret, method: input.method, pathname: input.pathname, requestId: 'request:fixture:001', timestamp, contentSha256 }),
  };
}

function createRequest(input: { method: string; pathname: string; headers?: Record<string, string>; body?: string; onRead?: () => void }): IncomingMessage {
  const body = input.body ?? '';
  return {
    method: input.method,
    url: input.pathname,
    headers: input.headers ?? {},
    socket: { remoteAddress: '127.0.0.1' },
    on(event: string, listener: (...args: unknown[]) => void) {
      input.onRead?.();
      if (event === 'data' && body) queueMicrotask(() => listener(Buffer.from(body)));
      if (event === 'end') queueMicrotask(() => listener());
      return this;
    },
  } as unknown as IncomingMessage;
}

async function route(input: Parameters<typeof createRequest>[0]): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

function withEnv(values: Record<string, string | undefined>, callback: () => Promise<void> | void): Promise<void> | void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const result = callback();
    if (result && typeof (result as Promise<void>).finally === 'function') return (result as Promise<void>).finally(() => restoreEnv(previous));
    restoreEnv(previous);
    return result;
  } catch (error) {
    restoreEnv(previous);
    throw error;
  }
}

function restoreEnv(previous: Map<string, string | undefined>): void {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test('versioned service identity authenticates with timing-safe HMAC material', () => {
  const body = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:auth', action: 'pause', reason: 'fixture' });
  const authenticator = new BrainServiceAuthenticator({
    identities: [{ serviceId: SERVICE_ID, secret: SECRET, allowedCapabilities: [BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY] }],
    clock: () => Date.parse(NOW),
  });
  const result = authenticator.authenticateRequest({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', body }), now: NOW }, BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.identity.serviceId, SERVICE_ID);
});

test('unknown, missing, malformed, stale, future, and tampered authentication fail before body consumption', () => {
  const body = '{}';
  const base = headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', body });
  const authenticator = new BrainServiceAuthenticator({
    identities: [{ serviceId: SERVICE_ID, secret: SECRET, allowedCapabilities: [BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY] }],
    clock: () => Date.parse(NOW),
  });
  const authenticate = (headers: Record<string, string>, method = 'POST', pathname = '/agent-mode/control/run/run:fixture') => authenticator.authenticateRequest({ method, pathname, headers, now: NOW }, BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY);
  assert.deepEqual(authenticate({ ...base, 'x-brain-service-id': 'service:unknown' }), { ok: false, code: 'service_identity_unknown' });
  const missingSignature = { ...base };
  delete missingSignature['x-brain-signature'];
  assert.deepEqual(authenticate(missingSignature), { ok: false, code: 'service_signature_missing' });
  assert.deepEqual(authenticate({ ...base, 'x-brain-signature': `${base['x-brain-signature']!.slice(0, -1)}0` }), { ok: false, code: 'service_signature_invalid' });
  assert.deepEqual(authenticate({ ...base, 'x-brain-request-timestamp': 'not-a-timestamp' }), { ok: false, code: 'service_timestamp_invalid' });
  assert.deepEqual(authenticate({ ...base, 'x-brain-request-timestamp': '2026-09-14T09:58:59.000Z' }), { ok: false, code: 'service_request_expired' });
  assert.deepEqual(authenticate({ ...base, 'x-brain-request-timestamp': '2026-09-14T10:01:01.000Z' }), { ok: false, code: 'service_request_not_yet_valid' });
  assert.deepEqual(authenticate(base, 'PUT'), { ok: false, code: 'service_signature_invalid' });
  assert.deepEqual(authenticate(base, 'POST', '/agent-mode/control/run/run:other'), { ok: false, code: 'service_signature_invalid' });
});

test('capability authorization is explicit and does not accept wildcard authority', () => {
  const body = '{}';
  const headers = headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', body });
  const denied = new BrainServiceAuthenticator({ identities: [{ serviceId: SERVICE_ID, secret: SECRET, allowedCapabilities: [] }], clock: () => Date.parse(NOW) })
    .authenticateRequest({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', headers, now: NOW }, BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY);
  assert.deepEqual(denied, { ok: false, code: 'service_capability_denied' });
  assert.throws(() => new BrainServiceAuthenticator({ identities: [{ serviceId: SERVICE_ID, secret: SECRET, allowedCapabilities: ['*'] }] }), /capability/);
});

test('authenticated Agent Mode pause reaches the control service, derives the service actor, and is idempotent', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-service-auth-route-'));
  const stateDir = path.join(root, 'state');
  const databasePath = path.join(stateDir, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.admitAttempt({
    task: { taskId: 'task:http-auth', taskType: 'agent-mode.fixture', inputHash: 'hash', createdAt: NOW },
    run: { runId: 'run:http-auth', taskId: 'task:http-auth', agentId: 'agent:http-auth', createdAt: NOW },
    attempt: { attemptId: 'attempt:http-auth', runId: 'run:http-auth', agentId: 'agent:http-auth', runtimeRef: 'runtime:fixture', routeRef: 'route:fixture', modelRef: 'model:fixture', policyVersion: 'policy:fixture', capabilityScopeHash: 'scope:fixture', budgetScopeId: 'budget:http-auth', createdAt: NOW },
    budget: { budgetScopeId: 'budget:http-auth', maxSteps: 3, maxTokens: 100, maxDollars: 1 },
    estimate: { reservationId: 'reservation:http-auth', steps: 1, tokens: 10, dollars: 0.01 },
    lease: { leaseId: 'lease:http-auth', resourceKey: 'resource:http-auth', ownerId: 'agent:http-auth', expiresAt: '2026-09-14T11:00:00.000Z' },
    now: NOW,
  });
  store.close();
  const body = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:http-pause', action: 'pause', reason: 'authenticated fixture pause' });
  const requestTimestamp = new Date().toISOString();
  let reads = 0;
  try {
    await withEnv({ BRAIN_AGENT_MODE_STATE_DIR: stateDir, BRAIN_CORE_SERVICE_ID: SERVICE_ID, BRAIN_CORE_SERVICE_SECRET: SECRET }, async () => {
      const input = { method: 'POST', pathname: '/agent-mode/control/run/run:http-auth', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:http-auth', body, timestamp: requestTimestamp }), body, onRead: () => { reads += 1; } };
      const first = await route(input);
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers['access-control-allow-origin'], undefined);
      const firstBody = JSON.parse(first.body) as { ok: boolean; result: { outcome: string; receipt: { actor: string } } };
      assert.equal(firstBody.ok, true);
      assert.equal(firstBody.result.outcome, 'completed');
      assert.equal(firstBody.result.receipt.actor, SERVICE_ID);
      const repeated = await route(input);
      assert.equal(repeated.statusCode, 200);
      assert.equal((JSON.parse(repeated.body) as { result: { outcome: string } }).result.outcome, 'already_applied');
    });
    assert.equal(reads, 6);
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      assert.equal(reopened.getRun('run:http-auth')?.status, 'paused');
      assert.equal(reopened.listEvents('control:http-pause').filter((event) => event.eventType === 'agent_mode_control_receipt').length, 1);
    } finally {
      reopened.close();
    }
  } finally {
    try { store.close(); } catch {}
    rmSync(root, { recursive: true, force: true });
  }
});

test('authenticated request verifies body digest and rejects caller actor or PID fields without mutation', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-service-auth-body-'));
  const stateDir = path.join(root, 'state');
  const databasePath = path.join(stateDir, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.close();
  try {
    await withEnv({ BRAIN_AGENT_MODE_STATE_DIR: stateDir, BRAIN_CORE_SERVICE_ID: SERVICE_ID, BRAIN_CORE_SERVICE_SECRET: SECRET }, async () => {
      const requestTimestamp = new Date().toISOString();
      const signedBody = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:body', action: 'pause', reason: 'fixture' });
      const alteredBody = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:body', action: 'pause', reason: 'altered', pid: 42 });
      const digestMismatch = await route({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', body: signedBody, timestamp: requestTimestamp }), body: alteredBody });
      assert.equal(digestMismatch.statusCode, 400);
      assert.equal((JSON.parse(digestMismatch.body) as { error: { code: string } }).error.code, 'content_digest_mismatch');
      const actorBody = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:actor', action: 'pause', reason: 'fixture', actor: 'operator:forged' });
      const actorResponse = await route({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', body: actorBody, timestamp: requestTimestamp }), body: actorBody });
      assert.equal(actorResponse.statusCode, 400);
      assert.equal((JSON.parse(actorResponse.body) as { error: { code: string } }).error.code, 'control_fields_invalid');
      const unknownActionBody = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:unknown-action', action: 'spawn', reason: 'fixture' });
      const unknownActionResponse = await route({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/run/run:missing', body: unknownActionBody, timestamp: requestTimestamp }), body: unknownActionBody });
      assert.equal(unknownActionResponse.statusCode, 400);
      assert.equal((JSON.parse(unknownActionResponse.body) as { error: { code: string } }).error.code, 'control_fields_invalid');
      const reviewBody = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:review-body', decision: 'approved', reason: 'fixture', evidenceHash: 'hash:fixture', actor: 'operator:forged' });
      const reviewResponse = await route({ method: 'POST', pathname: '/agent-mode/control/review/review:missing', headers: headersFor({ method: 'POST', pathname: '/agent-mode/control/review/review:missing', body: reviewBody, timestamp: requestTimestamp }), body: reviewBody });
      assert.equal(reviewResponse.statusCode, 400);
      assert.equal((JSON.parse(reviewResponse.body) as { error: { code: string } }).error.code, 'control_fields_invalid');
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing service identity fails before body read and a valid service signature does not unlock other contained routes', async () => {
  const body = JSON.stringify({ schemaVersion: 'agent-mode-control-v1', operationId: 'control:missing-auth', action: 'pause', reason: 'fixture' });
  await withEnv({ BRAIN_CORE_SERVICE_ID: undefined, BRAIN_CORE_SERVICE_SECRET: undefined }, async () => {
    let reads = 0;
    const missing = await route({ method: 'POST', pathname: '/agent-mode/control/run/run:fixture', body, onRead: () => { reads += 1; } });
    assert.equal(missing.statusCode, 401);
    assert.equal((JSON.parse(missing.body) as { error: { code: string } }).error.code, 'service_identity_missing');
    assert.equal(reads, 0);
  });

  let reads = 0;
  const credentialPath = '/credentials/project/set';
  const credentialResponse = await route({ method: 'POST', pathname: credentialPath, headers: headersFor({ method: 'POST', pathname: credentialPath, body }), body, onRead: () => { reads += 1; } });
  assert.equal(credentialResponse.statusCode, 503);
  assert.equal((JSON.parse(credentialResponse.body) as { code: string }).code, 'mutable_capability_contained');
  assert.equal(reads, 0);
});
