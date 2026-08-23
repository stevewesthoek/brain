import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';

const authority = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }] };
function entry(overrides = {}) {
  return buildUniversalBrainEntry({ brainRevision: 'abc123', authorityRegistry: authority, ...overrides });
}

test('produces bounded provider-neutral bootstrap with progressive retrieval', () => {
  const result = consumeUniversalBrainEntry({ entry: entry({ capabilities: ['a', 'b', 'c'] }), environment: 'future-agent', maxItems: 2 });
  assert.equal(result.status, 'ready');
  assert.equal(result.fail_closed, false);
  assert.equal(result.bootstrap.identity.provider_neutral, true);
  assert.equal(result.bootstrap.navigation.brain_authority.length, 2);
  assert.deepEqual(result.retrieval.untouched, ['full_repository', 'full_conversations', 'secrets', 'client_configuration']);
});

test('fails closed for unavailable, stale, conflicting, and unknown authority states', () => {
  assert.equal(consumeUniversalBrainEntry().reason, 'entry_unavailable');
  assert.equal(consumeUniversalBrainEntry({ entry: entry({ operatingView: { current_state: { observations: { freshness: ['stale'] } } } }) }).status, 'blocked');
  assert.equal(consumeUniversalBrainEntry({ entry: entry({ continuity: { selection: { status: 'ambiguous' }, conflicts: ['x'] } }) }).status, 'blocked');
  assert.equal(consumeUniversalBrainEntry({ entry: { ...entry(), identity: { ...entry().identity, authority_registry: '' } } }).reason, 'unknown_authority');
});

test('is deterministic, read-only, and does not grant client or execution authority', () => {
  const original = entry();
  const before = JSON.stringify(original);
  const first = consumeUniversalBrainEntry({ entry: original, environment: 'claude' });
  const second = consumeUniversalBrainEntry({ entry: original, environment: 'claude' });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(original), before);
  assert.equal(first.authority.grants, false);
  assert.equal(first.safety.providers_called, 0);
  assert.equal(first.safety.writes_performed, 0);
});
