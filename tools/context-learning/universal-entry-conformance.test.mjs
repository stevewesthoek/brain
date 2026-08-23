import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance, validateUniversalEntryFailureConformance } from './universal-entry-conformance.mjs';

const authority = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }] };
const makeEntry = (overrides = {}) => buildUniversalBrainEntry({ brainRevision: 'conformance-revision', authorityRegistry: authority, ...overrides });

test('all supported client profiles consume the same provider-neutral contract', () => {
  for (const client of ['claude', 'codex', 'workbench', 'future-agent']) {
    const result = validateUniversalEntryConformance({ client, consumption: consumeUniversalBrainEntry({ entry: makeEntry(), environment: client }) });
    assert.equal(result.conformant, true, `${client} should conform`);
    assert.equal(result.authority.client_grants_authority, false);
    assert.equal(result.safety.activation_performed, false);
  }
});

test('stale and conflicting entry consumption is visibly fail-closed', () => {
  const stale = consumeUniversalBrainEntry({ entry: makeEntry({ operatingView: { current_state: { observations: { freshness: ['stale'] } } } }) });
  const conflict = consumeUniversalBrainEntry({ entry: makeEntry({ continuity: { selection: { status: 'conflict' }, conflicts: ['session-a/session-b'] } }) });
  assert.equal(stale.fail_closed, true);
  assert.equal(conflict.fail_closed, true);
  assert.equal(validateUniversalEntryFailureConformance({ consumption: stale }).conformant, true);
  assert.equal(validateUniversalEntryFailureConformance({ consumption: conflict }).conformant, true);
});

test('missing consumption cannot pass conformance or gain authority', () => {
  const result = validateUniversalEntryConformance({ client: 'future-agent' });
  assert.equal(result.conformant, false);
  assert.equal(result.fail_closed, true);
  assert.equal(result.authority, undefined);
});
