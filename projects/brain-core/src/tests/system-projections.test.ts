import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  writeHead(statusCode: number, headers?: Record<string, string>): void { this.statusCode = statusCode; this.headers = headers ?? {}; }
  end(chunk?: string): void { this.body = chunk ?? ''; }
}

async function exercise(method: string, url: string): Promise<MockResponse> {
  const request: IncomingMessage = { method, url, socket: { remoteAddress: '127.0.0.1' } };
  const response = new MockResponse();
  await routeRequest(request, response);
  return response;
}

test('system health projection is valid and fails closed on unverified validation evidence', async () => {
  const response = await exercise('GET', '/projections/health');
  const body = JSON.parse(response.body) as Record<string, any>;
  assert.equal(response.statusCode, 200);
  assert.equal(body.contract, 'brain-core-projection-v1');
  assert.equal(body.data.state, 'healthy_with_attention');
  assert.equal(body.data.validation.status, 'unknown');
  assert.equal(body.freshness, 'fresh');
  assert.deepEqual(body.safety, { readOnly: true, writesToMind: false, executionEnabled: false });
});

test('topology projection preserves explicit ownership and does not read Mind content', async () => {
  const response = await exercise('GET', '/projections/topology');
  const body = JSON.parse(response.body) as Record<string, any>;
  const mindNode = body.data.nodes.find((node: Record<string, unknown>) => node.id === 'mind-reference');
  assert.equal(response.statusCode, 200);
  assert.equal(body.contract, 'brain-core-projection-v1');
  assert.equal(mindNode.ownership, 'mind-reference');
  assert.equal(mindNode.status, 'unknown');
  assert.equal(body.data.relationships.some((item: Record<string, unknown>) => item.relationship === 'owns' && item.to === 'mind-reference'), false);
  assert.equal(body.freshness, 'unknown');
});

test('services and contracts projections are bounded and read-only', async () => {
  for (const path of ['/projections/services', '/projections/contracts']) {
    const response = await exercise('GET', path);
    const body = JSON.parse(response.body) as Record<string, any>;
    assert.equal(response.statusCode, 200, path);
    assert.equal(body.contract, 'brain-core-projection-v1', path);
    assert.deepEqual(body.safety, { readOnly: true, writesToMind: false, executionEnabled: false }, path);
  }
});

test('system projection endpoints do not expose mutation methods', async () => {
  for (const path of ['/projections/health', '/projections/topology', '/projections/services', '/projections/contracts']) {
    const response = await exercise('POST', path);
    assert.ok(response.statusCode === 404 || response.statusCode === 405, path);
  }
});
