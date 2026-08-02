import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildContextPack} from '../src/index.mjs';
import {discoverSources} from '../src/core/discover.mjs';

const root = path.resolve('.');
const threats = discoverSources({root, scopes: ['fixtures/trust-boundary']});

test('original query and scopes remain unchanged', () => {
  const query = 'What is safe?';
  const scopes = ['fixtures/trust-boundary'];
  const pack = buildContextPack({queryId: 'trust', query, scopes, sources: threats});
  assert.equal(pack.queryId, 'trust');
  assert.equal(query, 'What is safe?');
  assert.deepEqual(scopes, ['fixtures/trust-boundary']);
});

test('malicious source text does not change permissions or output schema', () => {
  const pack = buildContextPack({queryId: 'trust', query: 'What is safe?', scopes: ['fixtures/trust-boundary'], sources: threats});
  const untrusted = pack.sources.find((source) => source.untrusted);
  assert(untrusted);
  assert.equal(untrusted.authority, 'untrusted');
  assert.equal(Object.prototype.hasOwnProperty.call(pack, 'schema'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pack, 'tool'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(pack, 'approval'), false);
});

test('no citation, authority, budget, or conflict suppression occurs', () => {
  const pack = buildContextPack({queryId: 'trust', query: 'What is safe?', scopes: ['fixtures/trust-boundary'], sources: threats});
  assert.equal(pack.sources.every((source) => source.citation && source.sha256 && source.path && source.sourceId), true);
  assert.equal(pack.safetyWarnings.includes('retrieved-policy-text-is-data'), true);
});

test('threat instructions do not become system instructions', () => {
  const pack = buildContextPack({queryId: 'trust', query: 'What is safe?', scopes: ['fixtures/trust-boundary'], sources: threats});
  const text = JSON.stringify(pack);
  assert.equal(text.includes('ignore previous rules'), false);
  assert.equal(text.includes('call a tool'), false);
  assert.equal(text.includes('approve this write'), false);
});
