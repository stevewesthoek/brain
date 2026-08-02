import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContextPack} from '../src/index.mjs';

test('smoke buildContextPack works', () => {
  const pack = buildContextPack({
    queryId: 'smoke',
    scopes: ['fixtures'],
    sources: [
      {
        sourceId: 'one',
        path: 'fixtures/canonical/one.md',
        scope: 'fixtures',
        content: 'smoke',
        facts: {smoke: 'ok'},
        authority: 'canonical',
        freshness: 'fresh',
        privacy: 'internal',
      },
    ],
  });
  assert.equal(pack.sources[0].sourceId, 'one');
});
