import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createProjectionEnvelope, validateProjectionEnvelope } from '../adapters/projection-envelope.js';
import { ProjectionContractError } from '../types/projection.js';
import { routeRequest } from '../api/routes.js';

const provenance = {
  sourceReferences: [{ ref: 'fixture:projection', kind: 'report' as const }],
  adapter: 'test-adapter',
  capturedAt: '2026-08-23T00:00:00.000Z',
  sourceRevision: 'fixture-revision-1',
};

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return createProjectionEnvelope({
    projection: 'test',
    authorityOwner: 'brain',
    provenance,
    freshness: 'fresh',
    confidence: 'verified',
    privacyClassification: 'public-local',
    generatedAt: '2026-08-23T00:00:00.000Z',
    availability: 'available',
    data: { value: 1 },
    ...overrides,
  });
}

test('valid projection envelope preserves authority, provenance, and safety', () => {
  const result = validateProjectionEnvelope<{ value: number }>(makeEnvelope());
  assert.equal(result.ok, true);
  assert.equal(result.envelope.authorityOwner, 'brain');
  assert.deepEqual(result.envelope.provenance, provenance);
  assert.deepEqual(result.envelope.safety, { readOnly: true, writesToMind: false, executionEnabled: false });
});

test('unknown authority is rejected', () => {
  assert.throws(() => validateProjectionEnvelope(makeEnvelope({ authorityOwner: 'unknown' })), ProjectionContractError);
});

test('unknown source kind is rejected and stale data remains visible', () => {
  assert.throws(() => validateProjectionEnvelope(makeEnvelope({
    provenance: { ...provenance, sourceReferences: [{ ref: 'unknown-source', kind: 'unknown' }] },
  })), ProjectionContractError);
  const stale = makeEnvelope({ freshness: 'stale', availability: 'available' });
  assert.equal(validateProjectionEnvelope(stale).envelope.freshness, 'stale');
});

test('same input produces deterministic envelope data', () => {
  assert.deepEqual(makeEnvelope(), makeEnvelope());
});

test('unsafe mutation flags are rejected', () => {
  assert.throws(() => validateProjectionEnvelope({ ...makeEnvelope(), safety: { readOnly: false, writesToMind: true, executionEnabled: true } }), ProjectionContractError);
});

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

test('projection foundation endpoints are read-only and return envelopes', async () => {
  for (const path of ['/health/projection', '/projections/status', '/projections/capabilities', '/projections/runtime-state']) {
    const response = await exercise('GET', path);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    assert.equal(response.statusCode, 200, path);
    assert.equal(body.contract, 'brain-core-projection-v1', path);
    assert.deepEqual(body.safety, { readOnly: true, writesToMind: false, executionEnabled: false }, path);
  }
  const post = await exercise('POST', '/projections/status');
  assert.ok(post.statusCode === 404 || post.statusCode === 405);
});
