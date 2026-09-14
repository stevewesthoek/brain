import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST as login, GET as sessionCheck, DELETE as logout } from '../app/api/operator/session/route';
import { handleLifecycleControl, handleReviewControl } from './operator-control-server';
import { operatorSessionAuthenticatedResponseSchema, operatorSessionResponseSchema, type AgentModeControlResponse } from './braincore-schemas';
import {
  OPERATOR_SESSION_COOKIE_NAME,
  OPERATOR_SESSION_MAX_AGE_SECONDS,
  createOperatorSession,
  loadOperatorConfiguration,
  operatorSessionCookieOptions,
  serializeOperatorSession,
  verifyOperatorSession,
} from './operator-session-server';

const CONFIG = { operatorId: 'operator:fixture', operatorSecret: 'fixture-operator-secret-0123456789' };
const NOW = Date.parse('2026-09-14T12:00:00.000Z');

function withEnv(callback: () => Promise<void>): Promise<void> {
  const previousId = process.env.BRAIN_CONSOLE_OPERATOR_ID;
  const previousSecret = process.env.BRAIN_CONSOLE_OPERATOR_SECRET;
  process.env.BRAIN_CONSOLE_OPERATOR_ID = CONFIG.operatorId;
  process.env.BRAIN_CONSOLE_OPERATOR_SECRET = CONFIG.operatorSecret;
  return callback().finally(() => {
    if (previousId === undefined) delete process.env.BRAIN_CONSOLE_OPERATOR_ID;
    else process.env.BRAIN_CONSOLE_OPERATOR_ID = previousId;
    if (previousSecret === undefined) delete process.env.BRAIN_CONSOLE_OPERATOR_SECRET;
    else process.env.BRAIN_CONSOLE_OPERATOR_SECRET = previousSecret;
  });
}

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(url, init);
}

function loginBody(operatorId = CONFIG.operatorId, operatorSecret = CONFIG.operatorSecret) {
  return JSON.stringify({ schemaVersion: 'brain-console-operator-v1', operatorId, operatorSecret });
}

function controlRequest(url: string, token: string | undefined, csrfToken: string | undefined, body: unknown, origin = 'http://localhost:4881'): NextRequest {
  return request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(token ? { cookie: `${OPERATOR_SESSION_COOKIE_NAME}=${token}` } : {}),
      ...(csrfToken ? { 'x-brain-console-csrf': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function establishSession(): Promise<{ token: string; csrfToken: string }> {
  const response = await login(request('http://localhost:4881/api/operator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: loginBody() }));
  assert.equal(response.status, 200);
  const body = operatorSessionAuthenticatedResponseSchema.parse(await response.json());
  const setCookie = response.headers.get('set-cookie') ?? '';
  const token = new RegExp(`${OPERATOR_SESSION_COOKIE_NAME}=([^;]+)`, 'u').exec(setCookie)?.[1];
  assert.ok(token);
  return { token, csrfToken: body.csrfToken };
}

test('operator configuration is server-only and session cookie is bounded, signed, and finite', () => {
  const configuration = loadOperatorConfiguration({ ...process.env, BRAIN_CONSOLE_OPERATOR_ID: CONFIG.operatorId, BRAIN_CONSOLE_OPERATOR_SECRET: CONFIG.operatorSecret });
  assert.deepEqual(configuration, CONFIG);
  const session = createOperatorSession({ configuration: CONFIG, now: NOW });
  const token = serializeOperatorSession(session, CONFIG);
  const verified = verifyOperatorSession({ token, configuration: CONFIG, now: NOW + 1_000 });
  assert.equal(verified.authenticated, true);
  if (verified.authenticated) assert.equal(verified.session.operatorId, CONFIG.operatorId);
  const cookie = operatorSessionCookieOptions({ secure: false, expiresAt: session.expiresAt, now: NOW });
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'strict');
  assert.equal(cookie.path, '/api');
  assert.equal(cookie.maxAge, OPERATOR_SESSION_MAX_AGE_SECONDS);
});

test('tampered, expired, malformed, and differently keyed sessions fail closed', () => {
  const session = createOperatorSession({ configuration: CONFIG, now: NOW });
  const token = serializeOperatorSession(session, CONFIG);
  assert.equal(verifyOperatorSession({ token: `${token}x`, configuration: CONFIG, now: NOW }).authenticated, false);
  assert.equal(verifyOperatorSession({ token, configuration: { ...CONFIG, operatorSecret: 'different-secret-0123456789' }, now: NOW }).authenticated, false);
  assert.equal(verifyOperatorSession({ token, configuration: CONFIG, now: session.expiresAt }).authenticated, false);
  assert.equal(verifyOperatorSession({ token: 'malformed-cookie', configuration: CONFIG, now: NOW }).authenticated, false);
});

test('login establishes an authenticated session without returning or persisting the operator secret', async () => {
  await withEnv(async () => {
    const response = await login(request('http://localhost:4881/api/operator/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: loginBody() }));
    assert.equal(response.status, 200);
    const payload = operatorSessionResponseSchema.parse(await response.json());
    assert.equal(payload.authenticated, true);
    const responseText = JSON.stringify(payload);
    assert.equal(responseText.includes(CONFIG.operatorSecret), false);
    const setCookie = response.headers.get('set-cookie') ?? '';
    assert.match(setCookie, new RegExp(`${OPERATOR_SESSION_COOKIE_NAME}=`, 'u'));
    assert.match(setCookie, /HttpOnly/u);
    assert.match(setCookie, /SameSite=strict/ui);
    assert.match(setCookie, /Path=\/api/u);
    assert.match(setCookie, /Max-Age=28800/u);
    assert.equal(setCookie.includes(CONFIG.operatorSecret), false);
  });
});

test('login uses generic bounded failures and missing configuration stays unavailable', async () => {
  await withEnv(async () => {
    const wrongId = await login(request('http://localhost:4881/api/operator/session', { method: 'POST', body: loginBody('operator:wrong') }));
    const wrongSecret = await login(request('http://localhost:4881/api/operator/session', { method: 'POST', body: loginBody(CONFIG.operatorId, 'wrong-secret-0123456789') }));
    assert.equal(wrongId.status, 401);
    assert.equal(wrongSecret.status, 401);
    assert.deepEqual(await wrongId.json(), await wrongSecret.json());
  });
  const previousId = process.env.BRAIN_CONSOLE_OPERATOR_ID;
  const previousSecret = process.env.BRAIN_CONSOLE_OPERATOR_SECRET;
  delete process.env.BRAIN_CONSOLE_OPERATOR_ID;
  delete process.env.BRAIN_CONSOLE_OPERATOR_SECRET;
  try {
    const response = await login(request('http://localhost:4881/api/operator/session', { method: 'POST', body: loginBody() }));
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes(CONFIG.operatorSecret), false);
  } finally {
    if (previousId === undefined) delete process.env.BRAIN_CONSOLE_OPERATOR_ID;
    else process.env.BRAIN_CONSOLE_OPERATOR_ID = previousId;
    if (previousSecret === undefined) delete process.env.BRAIN_CONSOLE_OPERATOR_SECRET;
    else process.env.BRAIN_CONSOLE_OPERATOR_SECRET = previousSecret;
  }
});

test('session check and logout reconstruct and clear the browser session', async () => {
  await withEnv(async () => {
    const { token } = await establishSession();
    const checked = await sessionCheck(request('http://localhost:4881/api/operator/session', { headers: { cookie: `${OPERATOR_SESSION_COOKIE_NAME}=${token}` } }));
    const checkedBody = operatorSessionResponseSchema.parse(await checked.json());
    assert.equal(checkedBody.authenticated, true);
    const cleared = await logout(request('http://localhost:4881/api/operator/session'));
    assert.equal(cleared.status, 200);
    assert.match(cleared.headers.get('set-cookie') ?? '', /Max-Age=0/u);
  });
});

test('proxy requires session, same-origin provenance, and the session-bound CSRF token before Brain Core', async () => {
  await withEnv(async () => {
    let calls = 0;
    const controlRequestStub = async (): Promise<AgentModeControlResponse> => { calls += 1; return { ok: true, result: { outcome: 'completed', reasonCode: 'PAUSE_APPLIED' } }; };
    const body = { schemaVersion: 'agent-mode-control-v1', operationId: 'operation:fixture', action: 'pause', reason: 'operator fixture' };
    const missingSession = await handleLifecycleControl(controlRequest('http://localhost:4881/api/agent-mode/control/run/run:fixture', undefined, undefined, body), 'run:fixture', { controlRequest: controlRequestStub });
    assert.equal(missingSession.status, 401);
    const { token, csrfToken } = await establishSession();
    const missingCsrf = await handleLifecycleControl(request('http://localhost:4881/api/agent-mode/control/run/run:fixture', { method: 'POST', headers: { origin: 'http://localhost:4881', cookie: `${OPERATOR_SESSION_COOKIE_NAME}=${token}` }, body: JSON.stringify(body) }), 'run:fixture', { controlRequest: controlRequestStub });
    assert.equal(missingCsrf.status, 403);
    const foreignOrigin = await handleLifecycleControl(controlRequest('http://localhost:4881/api/agent-mode/control/run/run:fixture', token, csrfToken, body, 'http://evil.example'), 'run:fixture', { controlRequest: controlRequestStub });
    assert.equal(foreignOrigin.status, 403);
    const valid = await handleLifecycleControl(controlRequest('http://localhost:4881/api/agent-mode/control/run/run:fixture', token, csrfToken, body), 'run:fixture', { controlRequest: controlRequestStub });
    assert.equal(valid.status, 200);
    assert.equal(calls, 1);
  });
});

test('proxy rejects unknown actions and extra browser authority fields before Brain Core', async () => {
  await withEnv(async () => {
    const { token, csrfToken } = await establishSession();
    let calls = 0;
    const controlRequestStub = async (): Promise<AgentModeControlResponse> => { calls += 1; return { ok: true, result: { outcome: 'completed', reasonCode: 'UNEXPECTED' } }; };
    const response = await handleLifecycleControl(controlRequest('http://localhost:4881/api/agent-mode/control/run/run:fixture', token, csrfToken, { schemaVersion: 'agent-mode-control-v1', operationId: 'operation:fixture', action: 'spawn', reason: 'bad', actor: 'operator:forged' }), 'run:fixture', { controlRequest: controlRequestStub });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  });
});

test('review proxy forwards only the bounded review decision contract', async () => {
  await withEnv(async () => {
    const { token, csrfToken } = await establishSession();
    let forwarded: unknown;
    const controlRequestStub = async (input: { pathname: string; body: unknown }): Promise<AgentModeControlResponse> => {
      forwarded = input;
      return { ok: true, result: { outcome: 'completed', reasonCode: 'REVIEW_APPROVED' } };
    };
    const response = await handleReviewControl(controlRequest('http://localhost:4881/api/agent-mode/control/review/review:fixture', token, csrfToken, {
      schemaVersion: 'agent-mode-control-v1', operationId: 'operation:review-fixture', decision: 'approved', reason: 'operator fixture', evidenceHash: 'evidence:fixture',
    }), 'review:fixture', { controlRequest: controlRequestStub as typeof import('./braincore-control-server').brainCoreControlRequest });
    assert.equal(response.status, 200);
    assert.deepEqual(forwarded, {
      pathname: '/agent-mode/control/review/review%3Afixture',
      body: { schemaVersion: 'agent-mode-control-v1', operationId: 'operation:review-fixture', decision: 'approved', reason: 'operator fixture', evidenceHash: 'evidence:fixture' },
    });
  });
});
