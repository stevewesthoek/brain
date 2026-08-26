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

function createRequest(method: string, url: string): IncomingMessage {
  return { method, url, socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage;
}

async function request(method: string, url: string): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(method, url), response);
  return response;
}

test('unified infrastructure catalog exposes stable canonical IDs', async () => {
  const response = await request('GET', '/infra/catalog');
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { catalogVersion: string; resources: Array<{ resourceId: string }> };
  assert.equal(body.catalogVersion, '1.3.0');
  const ids = body.resources.map((resource) => resource.resourceId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('host:dokploy-aws'));
  assert.ok(ids.includes('network:tailnet-infrastructure'));
});

test('topology and resource inspection use the same canonical resource ID', async () => {
  const topologyResponse = await request('GET', '/infra/topology');
  const topology = JSON.parse(topologyResponse.body) as { resourceIds: string[] };
  assert.ok(topology.resourceIds.includes('host:vm-supabase'));

  const resourceResponse = await request('GET', '/infra/resources/host%3Avm-supabase');
  assert.equal(resourceResponse.statusCode, 200);
  const resource = JSON.parse(resourceResponse.body) as { resource: { resourceId: string }; relations: unknown[] };
  assert.equal(resource.resource.resourceId, 'host:vm-supabase');
  assert.ok(resource.relations.length > 0);
});

test('unknown resource inspection fails closed', async () => {
  const response = await request('GET', '/infra/resources/host%3Adoes-not-exist');
  assert.equal(response.statusCode, 404);
});

test('credential status is metadata-only and contains no secret-store location', async () => {
  const response = await request('GET', '/infra/credentials/status');
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { containsSecrets: boolean; credentialReferences: Array<Record<string, unknown>> };
  assert.equal(body.containsSecrets, false);
  assert.ok(body.credentialReferences.length > 0);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('secretStoreRef'), false);
  assert.equal(serialized.includes('AZURE_CLIENT_SECRET='), false);
  assert.equal(serialized.includes('CLOUDFLARE_API_TOKEN='), false);
});

test('doctor and health expose missing runtime as explicit UNKNOWN evidence', async () => {
  const doctorResponse = await request('GET', '/infra/doctor');
  const doctor = JSON.parse(doctorResponse.body) as { readOnly: boolean; executionEnabled: boolean; runtime: Record<string, string>; unknowns: string[] };
  assert.equal(doctor.readOnly, true);
  assert.equal(doctor.executionEnabled, false);
  const runtimeHealth = doctor.runtime.health;
  assert.ok(typeof runtimeHealth === 'string');
  assert.ok(['ok', 'missing', 'invalid'].includes(runtimeHealth));
  if (runtimeHealth !== 'ok') assert.ok(doctor.unknowns.some((value) => value.includes('health-state.json')));

  const healthResponse = await request('GET', '/infra/health');
  const health = JSON.parse(healthResponse.body) as { runtimeState: string; observations: unknown[] };
  assert.ok(['ok', 'missing', 'invalid'].includes(health.runtimeState));
  assert.ok(Array.isArray(health.observations));
});

test('backup UNKNOWNs remain visible instead of being normalized away', async () => {
  const response = await request('GET', '/infra/backups');
  const body = JSON.parse(response.body) as { backupPolicies: Array<{ cadence: string; retentionRef: string }> };
  assert.ok(body.backupPolicies.some((policy) => policy.cadence.startsWith('unknown:') || policy.retentionRef.startsWith('unknown:')));
});

test('safety and action receipts preserve non-execution invariants', async () => {
  const safetyResponse = await request('GET', '/infra/safety');
  const safety = JSON.parse(safetyResponse.body) as { executionEnabled: boolean; executionPerformed: boolean; actualEffects: unknown[] };
  assert.equal(safety.executionEnabled, false);
  assert.equal(safety.executionPerformed, false);
  assert.deepEqual(safety.actualEffects, []);

  const receiptsResponse = await request('GET', '/infra/action-receipts');
  const receipts = JSON.parse(receiptsResponse.body) as { executionEnabled: boolean; receipts: unknown[] };
  assert.equal(receipts.executionEnabled, false);
  assert.ok(Array.isArray(receipts.receipts));
});

test('MCP capability descriptors are source-neutral and read-only', async () => {
  const response = await request('GET', '/infra/capabilities');
  const body = JSON.parse(response.body) as { sourceNeutral: boolean; readOnly: boolean; executionExposed: boolean; capabilities: Array<{ riskClass: string; transportRef: string }> };
  assert.equal(body.sourceNeutral, true);
  assert.equal(body.readOnly, true);
  assert.equal(body.executionExposed, false);
  assert.ok(body.capabilities.every((capability) => capability.riskClass === 'read-only' && capability.transportRef.startsWith('brain-core:/infra/')));
});

test('unified infrastructure API rejects mutation methods', async () => {
  for (const path of ['/infra/catalog', '/infra/health', '/infra/doctor']) {
    const response = await request('POST', path);
    assert.ok(response.statusCode === 404 || response.statusCode === 405);
  }
});
