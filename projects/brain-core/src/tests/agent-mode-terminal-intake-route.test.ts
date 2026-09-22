import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { routeRequest } from '../api/routes.js';
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
  return {
    method: 'POST',
    url: '/agent-mode/terminal/intake',
    headers,
    socket: { remoteAddress: '127.0.0.1' },
    on(event: string, listener: (...args: unknown[]) => void) {
      if (event === 'data') queueMicrotask(() => listener(Buffer.from(body)));
      if (event === 'end') queueMicrotask(() => listener());
      return this;
    },
  } as unknown as IncomingMessage;
}

function signed(body: string, timestamp: string, requestId = 'request:terminal-route:1'): Record<string, string> {
  const contentSha256 = brainServiceContentSha256(body);
  return {
    'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
    'x-brain-service-id': SERVICE_ID,
    'x-brain-request-id': requestId,
    'x-brain-request-timestamp': timestamp,
    'x-brain-content-sha256': contentSha256,
    'x-brain-signature': signBrainServiceRequest({ serviceId: SERVICE_ID, secret: SECRET, method: 'POST', pathname: '/agent-mode/terminal/intake', requestId, timestamp, contentSha256 }),
  };
}

test('terminal intake route authenticates before body/state mutation and rejects non-admitted models', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-terminal-route-'));
  const stateRoot = path.join(root, 'state');
  const repositoryRoot = path.join(root, 'repo');
  const profilePath = path.join(root, 'runtime.json');
  mkdirSync(path.join(repositoryRoot, '.git'), { recursive: true });
  writeFileSync(profilePath, JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', stateRoot, repositoryRoots: [root] }));
  const previous = new Map(['BRAIN_RUNTIME_PROFILE_PATH', 'BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET'].map((key) => [key, process.env[key]]));
  process.env.BRAIN_RUNTIME_PROFILE_PATH = profilePath;
  process.env.BRAIN_CORE_SERVICE_ID = SERVICE_ID;
  process.env.BRAIN_CORE_SERVICE_SECRET = SECRET;
  try {
    const store = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    store.close();
    const body = JSON.stringify({ schemaVersion: 'agent-mode.terminal-intake.v1', requestId: 'request:terminal-route:1', operatorId: 'operator:test', repositoryRef: 'stevewesthoek/brain', repositoryRoot, model: 'minimax-m2.5', text: 'Read the repository.' });
    const unauthenticated = new Response();
    await routeRequest(request(body, {}), unauthenticated);
    assert.equal(unauthenticated.statusCode, 401);

    const denied = new Response();
    await routeRequest(request(body, signed(body, new Date().toISOString())), denied);
    assert.equal(denied.statusCode, 400);
    assert.equal((JSON.parse(denied.body) as { result: { reasonCode: string } }).result.reasonCode, 'AUTO_RUNTIME_UNAVAILABLE');

    const reopened = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    assert.equal(reopened.listJarvisIntakes().length, 0);
    assert.equal(reopened.listTasks().length, 0);
    reopened.close();
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  }
});

test('terminal intake route returns the durable acceptance receipt before K4 execution settles', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-terminal-route-progress-'));
  const stateRoot = path.join(root, 'state');
  const repositoryRoot = path.join(root, 'repo');
  const profilePath = path.join(root, 'runtime.json');
  const fakeCodex = path.join(root, 'fake-codex.sh');
  mkdirSync(path.join(repositoryRoot, '.git'), { recursive: true });
  writeFileSync(fakeCodex, '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "codex-cli 0.153.2\\n"; exit 0; fi\nif [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf "%s\\n" "--json --output-last-message --sandbox --ephemeral --ignore-user-config --skip-git-repo-check"; exit 0; fi\noutput=""\nprevious=""\nfor argument in "$@"; do\n  if [ "$previous" = "--output-last-message" ]; then output="$argument"; fi\n  previous="$argument"\ndone\nsleep 0.25\nprintf "bounded route result" > "$output"\n');
  chmodSync(fakeCodex, 0o755);
  writeFileSync(profilePath, JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', stateRoot, repositoryRoots: [root], execution: { codexCliPath: fakeCodex } }));
  const previous = new Map(['BRAIN_RUNTIME_PROFILE_PATH', 'BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET'].map((key) => [key, process.env[key]]));
  process.env.BRAIN_RUNTIME_PROFILE_PATH = profilePath;
  process.env.BRAIN_CORE_SERVICE_ID = SERVICE_ID;
  process.env.BRAIN_CORE_SERVICE_SECRET = SECRET;
  try {
    const store = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
    store.close();
    const body = JSON.stringify({ schemaVersion: 'agent-mode.terminal-intake.v1', requestId: 'request:terminal-route:progress', operatorId: 'operator:test', repositoryRef: 'stevewesthoek/brain', repositoryRoot, model: 'codex', codexEscalation: { runtime: 'codex-cli', reason: 'approved route fixture', requestedCapability: 'read-only repository inspection', approvalId: 'approval:route-fixture', approvedBy: 'operator:test' }, text: 'Read the repository.' });
    const response = new Response();
    await routeRequest(request(body, signed(body, new Date().toISOString(), 'request:terminal-route:progress')), response);
    assert.equal(response.statusCode, 202);
    const payload = JSON.parse(response.body) as { ok: boolean; status: { status: string; workerCount: number }; result: { receipt: { rootGoalId: string } } };
    assert.equal(payload.ok, true);
    assert.equal(payload.status.status, 'queued');
    assert.equal(payload.status.workerCount, 0);

    const rootGoalId = payload.result.receipt.rootGoalId;
    let completed = false;
    for (let index = 0; index < 20; index += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const reopened = new AgentModeSqliteStateStore(path.join(stateRoot, 'agent-mode', 'agent-mode.db'));
      try { completed = reopened.getAttempt(reopened.listAttempts().find((attempt) => attempt.childAgentId && reopened.getAgent(attempt.agentId)?.rootGoalId === rootGoalId)?.attemptId ?? '')?.status === 'completed'; } finally { reopened.close(); }
      if (completed) break;
    }
    assert.equal(completed, true);
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  }
});
