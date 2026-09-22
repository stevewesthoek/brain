import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { routeRequest } from '../api/routes.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, brainServiceContentSha256, signBrainServiceRequest } from '../security/brain-service-auth.js';

const SERVICE_ID = 'service:brain-console'; const SECRET = 'fixture-only-service-secret';
class Response implements ServerResponse { statusCode = 0; headers: Record<string, string> = {}; body = ''; writeHead(statusCode: number, headers?: Record<string, string>): void { this.statusCode = statusCode; this.headers = headers ?? {}; } end(body?: string): void { this.body = body ?? ''; } }
function request(body: string, headers: Record<string, string>): IncomingMessage { return { method: 'POST', url: '/agent-mode/jarvis/intake', headers, socket: { remoteAddress: '127.0.0.1' }, on(event: string, listener: (...args: unknown[]) => void) { if (event === 'data') queueMicrotask(() => listener(Buffer.from(body))); if (event === 'end') queueMicrotask(() => listener()); return this; } } as unknown as IncomingMessage; }
function signed(body: string, timestamp: string): Record<string, string> { const requestId = 'request:jarvis:1'; const contentSha256 = brainServiceContentSha256(body); return { 'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, 'x-brain-service-id': SERVICE_ID, 'x-brain-request-id': requestId, 'x-brain-request-timestamp': timestamp, 'x-brain-content-sha256': contentSha256, 'x-brain-signature': signBrainServiceRequest({ serviceId: SERVICE_ID, secret: SECRET, method: 'POST', pathname: '/agent-mode/jarvis/intake', requestId, timestamp, contentSha256 }) }; }

test('authenticated Jarvis intake route is narrow, durable, and idempotent', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-route-')); const stateDir = path.join(root, 'state'); const timestamp = new Date().toISOString();
  try {
    const store = new AgentModeSqliteStateStore(path.join(stateDir, 'agent-mode.db')); store.close();
    const body = JSON.stringify({ schemaVersion: 'agent-mode.jarvis-text-intake.v1', intakeId: 'intake:route', source: 'typed', operatorId: 'operator:session', text: 'Create a bounded root.' });
    const env = { BRAIN_AGENT_MODE_STATE_DIR: stateDir, BRAIN_CORE_SERVICE_ID: SERVICE_ID, BRAIN_CORE_SERVICE_SECRET: SECRET };
    const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]])); Object.entries(env).forEach(([key, value]) => { process.env[key] = value; });
    try {
      const firstResponse = new Response(); await routeRequest(request(body, signed(body, timestamp)), firstResponse); assert.equal(firstResponse.statusCode, 201); const first = JSON.parse(firstResponse.body) as { ok: boolean; result: { receipt: { rootGoalId: string; taskId: string } } }; assert.equal(first.ok, true); assert.equal(first.result.receipt.rootGoalId, first.result.receipt.taskId);
      const duplicateResponse = new Response(); await routeRequest(request(body, signed(body, timestamp)), duplicateResponse); assert.equal(duplicateResponse.statusCode, 200);
      const forged = JSON.stringify({ ...JSON.parse(body) as object, rootGoalId: 'forged-root' }); const forgedResponse = new Response(); await routeRequest(request(forged, signed(forged, timestamp)), forgedResponse); assert.equal(forgedResponse.statusCode, 400);
      assert.equal(new AgentModeSqliteStateStore(path.join(stateDir, 'agent-mode.db')).listJarvisIntakes().length, 1);
    } finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
