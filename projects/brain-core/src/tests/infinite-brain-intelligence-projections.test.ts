import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readInfiniteBrainIntelligenceProjections } from '../adapters/infinite-brain-intelligence-projections.js';
import { routeRequest } from '../api/routes.js';

const KINDS = ['ingestion', 'review', 'intelligence', 'calibration', 'learning'] as const;

test('all Infinite Brain intelligence projections expose bounded read-only envelopes', () => {
  const projections = readInfiniteBrainIntelligenceProjections(new Date('2026-08-23T12:00:00.000Z'));
  for (const kind of KINDS) {
    const projection = projections[kind];
    assert.equal(projection.contract, 'brain-core-projection-v1', kind);
    assert.equal(projection.authorityOwner, 'derived-runtime', kind);
    assert.ok(['available', 'empty', 'invalid'].includes(projection.availability), kind);
    assert.deepEqual(projection.safety, { readOnly: true, writesToMind: false, executionEnabled: false }, kind);
    assert.equal(projection.data.safety.reportOnly, true, kind);
    assert.equal(projection.data.safety.writesToMind, false, kind);
    assert.equal(projection.data.safety.writesToBrainCanonical, false, kind);
    assert.equal(projection.data.safety.automaticPromotion, false, kind);
    assert.equal(projection.data.safety.automaticDecisions, false, kind);
    assert.equal(projection.data.safety.providerCalls, false, kind);
  }
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

test('projection routes are read-only and return explicit empty or available state', async () => {
  for (const kind of KINDS) {
    const response = await exercise('GET', `/projections/${kind}`);
    const body = JSON.parse(response.body) as Record<string, any>;
    assert.equal(response.statusCode, 200, kind);
    assert.equal(body.contract, 'brain-core-projection-v1', kind);
    assert.equal(body.data.kind, kind, kind);
  }
  const post = await exercise('POST', '/projections/review');
  assert.ok(post.statusCode === 404 || post.statusCode === 405);
});

test('same runtime inputs and captured time produce deterministic projection data', () => {
  const first = readInfiniteBrainIntelligenceProjections(new Date('2026-08-23T12:00:00.000Z'));
  const second = readInfiniteBrainIntelligenceProjections(new Date('2026-08-23T12:00:00.000Z'));
  assert.deepEqual(first, second);
});
