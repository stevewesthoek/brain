import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readInfiniteBrainEvolutionProjection } from '../adapters/infinite-brain-evolution-projections.js';
import { routeRequest } from '../api/routes.js';

const KINDS = ['evolution', 'promotion', 'transactions', 'receipts'] as const;

test('evolution projections expose bounded state and safety invariants', () => {
  for (const kind of KINDS) {
    const result = readInfiniteBrainEvolutionProjection(kind, new Date('2026-08-23T12:00:00.000Z'));
    assert.equal(result.contract, 'brain-core-projection-v1', kind);
    assert.equal(result.authorityOwner, 'derived-runtime', kind);
    assert.ok(['available', 'empty', 'invalid'].includes(result.availability), kind);
    assert.equal(result.data.kind, kind);
    assert.deepEqual(result.data.safety, { readOnly: true, writesToMind: false, writesToBrainCanonical: false, automaticPromotion: false, automaticDecisions: false, providerCalls: false });
  }
});

class MockResponse implements ServerResponse {
  statusCode = 0; headers: Record<string, string> = {}; body = '';
  writeHead(statusCode: number, headers?: Record<string, string>): void { this.statusCode = statusCode; this.headers = headers ?? {}; }
  end(chunk?: string): void { this.body = chunk ?? ''; }
}

test('evolution endpoints are read-only', async () => {
  for (const kind of KINDS) {
    const request: IncomingMessage = { method: 'GET', url: `/projections/${kind}`, socket: { remoteAddress: '127.0.0.1' } };
    const response = new MockResponse();
    await routeRequest(request, response);
    assert.equal(response.statusCode, 200, kind);
    assert.equal(JSON.parse(response.body).data.kind, kind);
  }
  const post = new MockResponse();
  await routeRequest({ method: 'POST', url: '/projections/promotion', socket: { remoteAddress: '127.0.0.1' } }, post);
  assert.ok(post.statusCode === 404 || post.statusCode === 405);
});

test('evolution projection data is deterministic for a fixed capture time', () => {
  const now = new Date('2026-08-23T12:00:00.000Z');
  assert.deepEqual(readInfiniteBrainEvolutionProjection('evolution', now), readInfiniteBrainEvolutionProjection('evolution', now));
});
