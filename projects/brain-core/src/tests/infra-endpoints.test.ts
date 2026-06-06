import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';

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

function createRequest(input: { method?: string; url?: string; remoteAddress?: string }): IncomingMessage {
  const request: IncomingMessage = {
    socket: { remoteAddress: input.remoteAddress ?? '127.0.0.1' },
  };
  if (input.method !== undefined) request.method = input.method;
  if (input.url !== undefined) request.url = input.url;
  return request;
}

async function exercise(input: { method?: string; url?: string; remoteAddress?: string }): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

// ── /health ──────────────────────────────────────────────────────────────────

test('GET /health returns ok:true with service and ts', async () => {
  const response = await exercise({ method: 'GET', url: '/health' });
  const body = JSON.parse(response.body) as { ok: boolean; service: string; ts: string };

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'brain-core');
  assert.ok(typeof body.ts === 'string', 'ts must be a string timestamp');
});

test('POST /health is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/health' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405, 'POST /health must be rejected');
});

// ── /infra/dokploy ────────────────────────────────────────────────────────────

test('GET /infra/dokploy returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/dokploy' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/dokploy ok response includes apps and compose arrays', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/dokploy' });
  const body = JSON.parse(response.body) as { status: string; apps?: unknown[]; compose?: unknown[] };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.apps), 'ok status must include apps array');
    assert.ok(Array.isArray(body.compose), 'ok status must include compose array');
  }
});

test('GET /infra/dokploy not-configured response includes error string', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/dokploy' });
  const body = JSON.parse(response.body) as { status: string; error?: string };

  if (body.status === 'not-configured') {
    assert.ok(typeof body.error === 'string', 'not-configured status must include error string');
  }
});

test('POST /infra/dokploy is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/dokploy' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/scheduler ──────────────────────────────────────────────────────────

test('GET /infra/scheduler returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/scheduler' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/scheduler ok response includes jobs array and report summary', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/scheduler' });
  const body = JSON.parse(response.body) as {
    status: string;
    jobs?: Array<{ planned?: boolean; executed?: boolean; status?: string }>;
    report?: { summary?: string };
  };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.jobs), 'ok status must include jobs array');
    assert.ok(body.jobs.every((job) => typeof job.planned === 'boolean' && typeof job.executed === 'boolean' && typeof job.status === 'string'), 'jobs must include planned, executed, and status fields');
    assert.ok(typeof body.report?.summary === 'string', 'ok status must include report summary');
  }
});

test('POST /infra/scheduler is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/scheduler' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/tunnels ────────────────────────────────────────────────────────────

test('GET /infra/tunnels returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/tunnels' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/tunnels ok response includes tunnels array', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/tunnels' });
  const body = JSON.parse(response.body) as { status: string; tunnels?: Array<{ hostnames?: unknown[] }> };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.tunnels), 'ok status must include tunnels array');
    assert.ok(body.tunnels.every((tunnel) => Array.isArray(tunnel.hostnames)), 'ok status tunnels must include hostnames arrays');
  }
});

test('GET /infra/tunnels ok response hostname items include reachability state', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/tunnels' });
  const body = JSON.parse(response.body) as {
    status: string;
    tunnels?: Array<{ hostnames?: Array<{ online?: boolean | null }> }>;
  };

  if (body.status === 'ok') {
    const hostnames = body.tunnels?.flatMap((tunnel) => tunnel.hostnames ?? []) ?? [];
    assert.ok(hostnames.every((hostname) => typeof hostname.online === 'boolean' || hostname.online === null), 'ok status hostname items must include online boolean|null');
  }
});

test('POST /infra/tunnels is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/tunnels' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/domains ────────────────────────────────────────────────────────────

test('GET /infra/domains returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/domains' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/domains ok response includes domains array sorted by expiry', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/domains' });
  const body = JSON.parse(response.body) as {
    status: string;
    domains?: Array<{ name: string; daysUntilExpiry?: number }>;
  };

  if (body.status === 'ok' && Array.isArray(body.domains) && body.domains.length >= 2) {
    for (let i = 0; i < body.domains.length - 1; i++) {
      const current = body.domains[i]?.daysUntilExpiry ?? Infinity;
      const next = body.domains[i + 1]?.daysUntilExpiry ?? Infinity;
      assert.ok(current <= next, `domains must be sorted soonest-expiry first (index ${i}: ${current} > ${next})`);
    }
  }
});

test('POST /infra/domains is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/domains' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/monitoring (New Relic) ─────────────────────────────────────────────

test('GET /infra/monitoring returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/monitoring' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/monitoring ok response includes hosts and synthetics arrays', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/monitoring' });
  const body = JSON.parse(response.body) as {
    status: string;
    hosts?: Array<{ online?: boolean | null; lastSeenAt?: string | null }>;
    synthetics?: Array<{ online?: boolean | null; lastCheckAt?: string | null; lastResult?: string | null }>;
  };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.hosts), 'ok status must include hosts array');
    assert.ok(Array.isArray(body.synthetics), 'ok status must include synthetics array');
    assert.ok(body.hosts.every((host) => typeof host.online === 'boolean' || host.online === null), 'hosts must include online boolean|null');
    assert.ok(body.hosts.every((host) => typeof host.lastSeenAt === 'string' || host.lastSeenAt === null), 'hosts must include lastSeenAt string|null');
    assert.ok(body.synthetics.every((synthetic) => typeof synthetic.online === 'boolean' || synthetic.online === null), 'synthetics must include online boolean|null');
    assert.ok(body.synthetics.every((synthetic) => typeof synthetic.lastCheckAt === 'string' || synthetic.lastCheckAt === null), 'synthetics must include lastCheckAt string|null');
    assert.ok(body.synthetics.every((synthetic) => typeof synthetic.lastResult === 'string' || synthetic.lastResult === null), 'synthetics must include lastResult string|null');
  }
});

test('GET /infra/monitoring not-configured includes error string', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/monitoring' });
  const body = JSON.parse(response.body) as { status: string; error?: string };

  if (body.status === 'not-configured') {
    assert.ok(typeof body.error === 'string', 'not-configured must include error string');
  }
});

test('POST /infra/monitoring is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/monitoring' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/analytics (Umami) ──────────────────────────────────────────────────

test('GET /infra/analytics returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/analytics' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/analytics ok response includes websites array', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/analytics' });
  const body = JSON.parse(response.body) as { status: string; websites?: unknown[] };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.websites), 'ok status must include websites array');
  }
});

test('POST /infra/analytics is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/analytics' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/google-ads ─────────────────────────────────────────────────────────

test('GET /infra/google-ads returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/google-ads' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/google-ads ok response includes budget fields', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/google-ads' });
  const body = JSON.parse(response.body) as {
    status: string;
    dailyBudgetUSD?: number;
    lastSync?: string;
  };

  if (body.status === 'ok') {
    assert.ok(typeof body.dailyBudgetUSD === 'number', 'ok status must include dailyBudgetUSD');
    assert.ok(typeof body.lastSync === 'string', 'ok status must include lastSync');
  }
});

test('POST /infra/google-ads is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/google-ads' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/stripe ─────────────────────────────────────────────────────────────

test('GET /infra/stripe returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/stripe' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'error',
    `status must be ok|not-configured|error, got ${body.status}`,
  );
});

test('GET /infra/stripe ok response includes accounts array', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/stripe' });
  const body = JSON.parse(response.body) as { status: string; accounts?: unknown[] };

  if (body.status === 'ok') {
    assert.ok(Array.isArray(body.accounts), 'ok status must include accounts array');
    assert.ok(body.accounts.length > 0, 'ok status must have at least one account');
  }
});

test('GET /infra/stripe does not expose raw credentials', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/stripe' });
  const body = response.body;

  assert.ok(!body.includes('sk_live_'), 'must not expose live secret key');
  assert.ok(!body.includes('sk_test_'), 'must not expose test secret key');
  assert.ok(!body.includes('rk_live_'), 'must not expose live restricted key');
});

test('POST /infra/stripe is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/stripe' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

// ── /infra/studio ─────────────────────────────────────────────────────────────

test('GET /infra/studio returns a valid status shape', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/studio' });
  const body = JSON.parse(response.body) as { status: string };

  assert.equal(response.statusCode, 200);
  assert.ok(
    body.status === 'ok' || body.status === 'not-configured' || body.status === 'partial' || body.status === 'error',
    `status must be ok|not-configured|partial|error, got ${body.status}`,
  );
});

test('GET /infra/studio ok or partial response includes viralFlow summary', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/studio' });
  const body = JSON.parse(response.body) as {
    status: string;
    viralFlow?: { accountCount: number; accounts: unknown[] };
  };

  if (body.status === 'ok' || body.status === 'partial') {
    if (body.viralFlow) {
      assert.ok(typeof body.viralFlow.accountCount === 'number', 'viralFlow.accountCount must be a number');
      assert.ok(Array.isArray(body.viralFlow.accounts), 'viralFlow.accounts must be an array');
    }
  }
});

test('GET /infra/studio does not expose credentials or tokens', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/studio' });
  const body = response.body;

  assert.ok(!body.includes('access_token'), 'must not expose access_token');
  assert.ok(!body.includes('refresh_token'), 'must not expose refresh_token');
  assert.ok(!body.includes('"password"'), 'must not expose password field');
});

test('POST /infra/studio is rejected', async () => {
  const response = await exercise({ method: 'POST', url: '/infra/studio' });
  assert.ok(response.statusCode === 404 || response.statusCode === 405);
});

test('GET /infra/studio videoOrchestrator field has correct shape when present', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/studio' });
  const body = JSON.parse(response.body) as {
    status: string;
    videoOrchestrator?: {
      databaseStatus: string;
      totalVideos: number;
      totalAccounts: number;
      pendingJobs: number;
      runningJobs: number;
      failedJobs7d: number;
      completedPackages: number;
      completionRate: number;
    } | null;
  };

  assert.equal(response.statusCode, 200);

  if (body.videoOrchestrator !== null && body.videoOrchestrator !== undefined) {
    const vo = body.videoOrchestrator;
    assert.ok(typeof vo.databaseStatus === 'string', 'databaseStatus must be string');
    assert.ok(typeof vo.totalVideos === 'number', 'totalVideos must be number');
    assert.ok(typeof vo.totalAccounts === 'number', 'totalAccounts must be number');
    assert.ok(typeof vo.pendingJobs === 'number', 'pendingJobs must be number');
    assert.ok(typeof vo.runningJobs === 'number', 'runningJobs must be number');
    assert.ok(typeof vo.failedJobs7d === 'number', 'failedJobs7d must be number');
    assert.ok(typeof vo.completedPackages === 'number', 'completedPackages must be number');
    assert.ok(typeof vo.completionRate === 'number', 'completionRate must be number');
    assert.ok(vo.completionRate >= 0 && vo.completionRate <= 100, 'completionRate must be 0-100');
    assert.ok(!['postgres', 'password', 'secret'].includes(vo.databaseStatus.toLowerCase()),
      'databaseStatus must not leak credentials');
  }
});

test('GET /infra/studio videoOrchestrator does not expose DB credentials', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/studio' });
  const body = response.body;

  assert.ok(!body.includes('"postgres"'), 'must not expose postgres user string in response body');
  assert.ok(!body.includes('5450'), 'must not expose DB port in response body');
  assert.ok(!body.includes('video_orchestrator'), 'must not expose DB name in response body');
});

// ── /infra/video-orchestrator/status ─────────────────────────────────────────

test('GET /infra/video-orchestrator/status returns 200 with ok field', async () => {
  const response = await exercise({ method: 'GET', url: '/infra/video-orchestrator/status' });
  const body = JSON.parse(response.body) as { ok: boolean; error?: string };

  assert.equal(response.statusCode, 200);
  assert.ok(typeof body.ok === 'boolean', 'ok field must be boolean');
});

// ── Cross-cutting: infra endpoints respect non-local rejection ────────────────

test('infra endpoints reject non-local requests', async () => {
  const endpoints = [
    '/infra/dokploy',
    '/infra/tunnels',
    '/infra/domains',
    '/infra/monitoring',
    '/infra/analytics',
    '/infra/google-ads',
    '/infra/stripe',
    '/infra/studio',
  ];

  for (const endpoint of endpoints) {
    const response = await exercise({ method: 'GET', url: endpoint, remoteAddress: '203.0.113.10' });
    const body = JSON.parse(response.body) as { error: { code: string } };
    assert.equal(response.statusCode, 403, `${endpoint} must reject non-local request`);
    assert.equal(body.error.code, 'forbidden_non_local_request', `${endpoint} must return correct error code`);
  }
});

test('infra endpoints do not expose raw env values or secrets', async () => {
  const endpoints = [
    '/infra/dokploy',
    '/infra/tunnels',
    '/infra/domains',
    '/infra/monitoring',
    '/infra/analytics',
    '/infra/google-ads',
    '/infra/stripe',
    '/infra/studio',
  ];

  for (const endpoint of endpoints) {
    const response = await exercise({ method: 'GET', url: endpoint });
    const body = response.body;
    assert.ok(!body.includes('TOKEN='), `${endpoint} must not expose TOKEN=`);
    assert.ok(!body.includes('SECRET='), `${endpoint} must not expose SECRET=`);
    assert.ok(!body.includes('PASSWORD='), `${endpoint} must not expose PASSWORD=`);
    assert.ok(!body.includes('API_KEY='), `${endpoint} must not expose API_KEY=`);
  }
});
