import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { routeRequest } from '../api/routes.js';
import { AgentModeProductionScheduler } from '../agent-mode/production-scheduler.js';
import { DEFERRED_MODEL_REF, DEFERRED_ROUTE_REF, MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, brainServiceContentSha256, signBrainServiceRequest } from '../security/brain-service-auth.js';

const SERVICE_ID = 'service:brain-console';
const SECRET = 'fixture-only-service-secret';

class Response implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  writeHead(statusCode: number, headers?: Record<string, string>): void { this.statusCode = statusCode; this.headers = headers ?? {}; }
  end(body?: string): void { this.body = body ?? ''; }
}

function request(body: string, headers: Record<string, string>): IncomingMessage {
  return { method: 'POST', url: '/agent-mode/jarvis/intake/v2', headers, socket: { remoteAddress: '127.0.0.1' }, on(event: string, listener: (...args: unknown[]) => void) { if (event === 'data') queueMicrotask(() => listener(Buffer.from(body))); if (event === 'end') queueMicrotask(() => listener()); return this; } } as unknown as IncomingMessage;
}

function signed(body: string, timestamp: string, requestId: string): Record<string, string> {
  const contentSha256 = brainServiceContentSha256(body);
  return { 'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, 'x-brain-service-id': SERVICE_ID, 'x-brain-request-id': requestId, 'x-brain-request-timestamp': timestamp, 'x-brain-content-sha256': contentSha256, 'x-brain-signature': signBrainServiceRequest({ serviceId: SERVICE_ID, secret: SECRET, method: 'POST', pathname: '/agent-mode/jarvis/intake/v2', requestId, timestamp, contentSha256 }) };
}

test('v2 Jarvis context route authenticates before durable admission and persists no-context safely', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-context-route-'));
  const stateRoot = path.join(root, 'state');
  const profilePath = path.join(root, 'runtime.json');
  mkdirSync(stateRoot, { recursive: true });
  const requestId = 'request:jarvis-context-route:1';
  const body = JSON.stringify({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId, operatorId: 'operator:test', model: 'auto', text: 'Inspect no context.', contexts: [] });
  const previous = new Map(['BRAIN_RUNTIME_PROFILE_PATH', 'BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET', 'BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME', 'BRAIN_AGENT_MODE_ACCOUNT_REF', 'BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON'].map((key) => [key, process.env[key]]));
  process.env.BRAIN_RUNTIME_PROFILE_PATH = profilePath;
  process.env.BRAIN_CORE_SERVICE_ID = SERVICE_ID;
  process.env.BRAIN_CORE_SERVICE_SECRET = SECRET;
  process.env.BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME = '1';
  process.env.BRAIN_AGENT_MODE_ACCOUNT_REF = 'account:fixture';
  process.env.BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON = JSON.stringify({ modelRef: 'agent-mode/minimax-m2.5', version: 'fixture-access-v1', accountRef: 'account:fixture', region: 'us-east-1', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-20T00:00:00.000Z', freshUntil: '2099-01-01T00:00:00.000Z', source: 'fixture' });
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(profilePath, JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', stateRoot, eligibleLocalRoots: [root] }));
    const initialStore = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    initialStore.close();
    const denied = new Response();
    await routeRequest(request(body, {}), denied);
    assert.equal(denied.statusCode, 401);
    const response = new Response();
    await routeRequest(request(body, signed(body, new Date().toISOString(), requestId)), response);
    assert.equal(response.statusCode, 201);
    const payload = JSON.parse(response.body) as { ok: boolean; result: { outcome: string; receipt: { rootGoalId: string; rootRunId: string; contextIds: string[] } } };
    assert.equal(payload.ok, true);
    assert.equal(payload.result.outcome, 'accepted');
    assert.match(payload.result.receipt.rootRunId, /^run:jarvis-context:/u);
    assert.deepEqual(payload.result.receipt.contextIds, []);
    const store = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    assert.equal(store.listJarvisContexts(payload.result.receipt.rootGoalId).length, 0);
    store.close();
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  }
});

test('direct authenticated v2 intake is executed by the Core scheduler after the client is gone', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-context-route-scheduler-'));
  const stateRoot = path.join(root, 'state');
  const profilePath = path.join(root, 'runtime.json');
  mkdirSync(stateRoot, { recursive: true });
  const requestId = 'request:jarvis-context-route:scheduler';
  const body = JSON.stringify({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId, operatorId: 'operator:test', model: 'auto', text: 'Inspect no context.', contexts: [] });
  const previous = new Map(['BRAIN_RUNTIME_PROFILE_PATH', 'BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET', 'BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME', 'BRAIN_AGENT_MODE_ACCOUNT_REF', 'BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON'].map((key) => [key, process.env[key]]));
  process.env.BRAIN_RUNTIME_PROFILE_PATH = profilePath;
  process.env.BRAIN_CORE_SERVICE_ID = SERVICE_ID;
  process.env.BRAIN_CORE_SERVICE_SECRET = SECRET;
  process.env.BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME = '1';
  process.env.BRAIN_AGENT_MODE_ACCOUNT_REF = 'account:fixture';
  process.env.BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON = JSON.stringify({ modelRef: 'agent-mode/minimax-m2.5', version: 'fixture-access-v1', accountRef: 'account:fixture', region: 'us-east-1', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-20T00:00:00.000Z', freshUntil: '2099-01-01T00:00:00.000Z', source: 'fixture' });
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(profilePath, JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', stateRoot, eligibleLocalRoots: [root] }));
    const initialStore = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    initialStore.close();
    const response = new Response();
    await routeRequest(request(body, signed(body, new Date().toISOString(), requestId)), response);
    assert.equal(response.statusCode, 201);
    const payload = JSON.parse(response.body) as { result: { receipt: { rootGoalId: string } } };
    const worker = new MockAgentRuntime({ runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: DEFERRED_ROUTE_REF, modelRef: DEFERRED_MODEL_REF, modelResult: { kind: 'typed-fixture-result', traceId: 'route-scheduler', intent: { kind: 'no-outbox', relativePath: 'README.md' } } });
    const scheduler = new AgentModeProductionScheduler({ databasePath: path.join(stateRoot, 'agent-mode', 'agent-mode.db'), home: root, eligibleRoots: [root], writableRoots: [], clock: () => new Date().toISOString(), runtimeFactory: () => worker });
    const tick = await scheduler.runOnce();
    assert.equal(tick?.completed, 1);
    assert.equal(worker.dispatchInvocationCount, 1);
    const store = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    try {
      assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === payload.result.receipt.rootGoalId && agent.agentKind === 'worker').length, 1);
    } finally { store.close(); }
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  }
});
