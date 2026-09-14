import assert from 'node:assert/strict';
import test from 'node:test';
import { agentModeControlResultResponseSchema } from './braincore-schemas';
import { BrainCoreControlError, brainCoreControlRequest, type BrainCoreLifecycleControlBody } from './braincore-control-server';

const SERVICE_ID = 'service:brain-console-test';
const SECRET = 'server-only-fixture-secret';
const NOW = '2026-09-14T12:00:00.000Z';

const successfulResult = {
  ok: true,
  result: {
    outcome: 'completed',
    reasonCode: 'PAUSE_APPLIED',
    receipt: {
      schemaVersion: 'agent-mode-control-v1',
      operationId: 'operation:fixture',
      action: 'pause',
      targetId: 'run:fixture',
      actor: SERVICE_ID,
      status: 'completed',
      previousState: 'running',
      resultingState: 'paused',
      occurredAt: NOW,
      reasonCode: 'PAUSE_APPLIED',
      recoveryCode: null,
      signalState: null,
    },
  },
};

function withEnv(callback: () => Promise<void>): Promise<void> {
  const previousId = process.env.BRAIN_CORE_SERVICE_ID;
  const previousSecret = process.env.BRAIN_CORE_SERVICE_SECRET;
  process.env.BRAIN_CORE_SERVICE_ID = SERVICE_ID;
  process.env.BRAIN_CORE_SERVICE_SECRET = SECRET;
  return callback().finally(() => {
    if (previousId === undefined) delete process.env.BRAIN_CORE_SERVICE_ID;
    else process.env.BRAIN_CORE_SERVICE_ID = previousId;
    if (previousSecret === undefined) delete process.env.BRAIN_CORE_SERVICE_SECRET;
    else process.env.BRAIN_CORE_SERVICE_SECRET = previousSecret;
  });
}

function lifecycleBody() {
  return { schemaVersion: 'agent-mode-control-v1' as const, operationId: 'operation:fixture', action: 'pause' as const, reason: 'operator fixture' };
}

test('server-only control client signs the exact Brain service contract and parses a bounded response', async () => {
  let request: { url: string; init: RequestInit } | undefined;
  await withEnv(async () => {
    const result = await brainCoreControlRequest({
      pathname: '/agent-mode/control/run/run:fixture',
      body: lifecycleBody(),
      requestId: 'request:fixture',
      now: NOW,
      fetchImpl: async (url, init) => {
        request = { url: String(url), init: init ?? {} };
        return new Response(JSON.stringify(successfulResult), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    assert.deepEqual(result, successfulResult);
  });
  assert.equal(request?.url, 'http://localhost:4877/agent-mode/control/run/run:fixture');
  const headers = Object.fromEntries(new Headers(request?.init.headers).entries());
  assert.equal(headers['x-brain-service-id'], SERVICE_ID);
  assert.equal(headers['x-brain-auth-version'], 'brain-service-auth-v1');
  assert.equal(headers['x-brain-request-id'], 'request:fixture');
  assert.equal(headers['x-brain-request-timestamp'], NOW);
  assert.equal(headers['x-brain-signature']?.length, 64);
  assert.equal(headers['x-brain-signature']?.includes(SECRET), false);
  assert.equal(String(request?.init.body).includes(SECRET), false);
  assert.equal(agentModeControlResultResponseSchema.safeParse(successfulResult).success, true);
});

test('server-only control client fails closed without identity, rejects invalid body/path, and rejects malformed responses', async () => {
  const previousId = process.env.BRAIN_CORE_SERVICE_ID;
  const previousSecret = process.env.BRAIN_CORE_SERVICE_SECRET;
  delete process.env.BRAIN_CORE_SERVICE_ID;
  delete process.env.BRAIN_CORE_SERVICE_SECRET;
  let fetchCalls = 0;
  try {
    await assert.rejects(
      () => brainCoreControlRequest({ pathname: '/agent-mode/control/run/run:fixture', body: lifecycleBody(), fetchImpl: async () => { fetchCalls += 1; return new Response('{}'); } }),
      (error: unknown) => error instanceof BrainCoreControlError && error.code === 'service_identity_unavailable',
    );
    assert.equal(fetchCalls, 0);
  } finally {
    if (previousId === undefined) delete process.env.BRAIN_CORE_SERVICE_ID;
    else process.env.BRAIN_CORE_SERVICE_ID = previousId;
    if (previousSecret === undefined) delete process.env.BRAIN_CORE_SERVICE_SECRET;
    else process.env.BRAIN_CORE_SERVICE_SECRET = previousSecret;
  }

  await withEnv(async () => {
    await assert.rejects(
      () => brainCoreControlRequest({ pathname: '/credentials/project/set', body: lifecycleBody(), fetchImpl: async () => new Response('{}') }),
      (error: unknown) => error instanceof BrainCoreControlError && error.code === 'control_path_invalid',
    );
    await assert.rejects(
      () => brainCoreControlRequest({ pathname: '/agent-mode/control/run/run:fixture', body: { ...lifecycleBody(), actor: 'operator:forged' } as BrainCoreLifecycleControlBody, fetchImpl: async () => new Response('{}') }),
      (error: unknown) => error instanceof BrainCoreControlError && error.code === 'control_body_invalid',
    );
    await assert.rejects(
      () => brainCoreControlRequest({ pathname: '/agent-mode/control/run/run:fixture', body: lifecycleBody(), fetchImpl: async () => new Response('{"ok":true,"result":{"outcome":"future"}}', { status: 200 }) }),
      (error: unknown) => error instanceof BrainCoreControlError && error.code === 'control_response_invalid',
    );
  });
});
