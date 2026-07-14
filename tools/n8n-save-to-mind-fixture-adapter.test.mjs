import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FIXED_REQUEST, createFixtureEvidenceInspector, executeFixture, validateFixtureEvidence } from './n8n-save-to-mind-fixture-adapter.mjs';

const success = 'b1-0a-success-fixture-20260714T120000Z';
const failure = 'b1-0a-failure-fixture-20260714T120000Z';
test('fixed fixture request has one request, zero retries, and rejects replay', async () => {
  const calls = [], replayStore = new Set();
  const result = await executeFixture({ kind: 'success', fixtureId: success }, { replayStore, request: async invocation => { calls.push(invocation); return { status: 201, receiptId: 'receipt-1' }; } });
  assert.equal(result.classification, 'succeeded'); assert.equal(result.requestCount, 1); assert.equal(result.retries, 0); assert.deepEqual(calls[0], { ...FIXED_REQUEST, payload: { contractVersion: 1, fixtureId: success, fixtureKind: 'success', source: 'brain-to-mind-b1-0a-fixture-v1', forceFailure: false } });
  await assert.rejects(() => executeFixture({ kind: 'success', fixtureId: success }, { replayStore, request: async () => ({ status: 201 }) }), /fixture_replay_rejected/);
});
test('caller-controlled transport or content is rejected before a request', async () => {
  let called = false;
  await assert.rejects(() => executeFixture({ kind: 'failure', fixtureId: failure, url: 'x' }, { request: async () => { called = true; } }), /fixture_input_not_allowed/);
  assert.equal(called, false);
});
test('ambiguous client failure remains bounded and content-free', async () => {
  const result = await executeFixture({ kind: 'failure', fixtureId: failure }, { request: async () => { throw new Error('network'); } });
  assert.deepEqual(result, { contractVersion: 1, fixtureId: failure, fixtureKind: 'failure', classification: 'ambiguous', requestCount: 1, retries: 0, rawResponseEmitted: false });
});
test('content-free success and failure evidence passes only at canonical destinations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b1-0a-evidence-'));
  try {
    fs.mkdirSync(path.join(root, 'inbox/new'), { recursive: true }); fs.mkdirSync(path.join(root, 'inbox/failed'), { recursive: true });
    fs.writeFileSync(path.join(root, 'inbox/new', `${success}.md`), 'not read'); fs.writeFileSync(path.join(root, 'inbox/failed', `${failure}.md`), 'not read');
    const inspect = createFixtureEvidenceInspector({ rootResolver: () => root });
    validateFixtureEvidence(inspect({ kind: 'success', fixtureId: success }));
    validateFixtureEvidence({ ...inspect({ kind: 'failure', fixtureId: failure }), failureStage: 'gemini-classify' });
    fs.writeFileSync(path.join(root, 'inbox/new', `duplicate-${success}.md`), 'not read');
    assert.throws(() => inspect({ kind: 'success', fixtureId: success }), /fixture_destination_count_invalid/);
    fs.writeFileSync(path.join(root, 'capture-inbox-' + success + '.md'), 'ignored');
    validateFixtureEvidence({ contractVersion: 1, fixtureId: success, fixtureKind: 'success', repositoryRelativePath: `inbox/new/${success}.md`, destination: 'inbox/new', createdFileCount: 1, overwrite: false, retiredPathWrite: false });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('wrong, retired, duplicate, and content-bearing evidence fails', () => {
  const base = { contractVersion: 1, fixtureId: success, fixtureKind: 'success', repositoryRelativePath: `inbox/new/${success}.md`, destination: 'inbox/new', createdFileCount: 1, overwrite: false, retiredPathWrite: false };
  assert.throws(() => validateFixtureEvidence({ ...base, destination: 'inbox/failed' }), /fixture_evidence_policy_failed/);
  assert.throws(() => validateFixtureEvidence({ ...base, repositoryRelativePath: `capture/inbox/${success}.md` }), /fixture_evidence_policy_failed/);
  assert.throws(() => validateFixtureEvidence({ ...base, createdFileCount: 2 }), /fixture_evidence_policy_failed/);
  assert.throws(() => validateFixtureEvidence({ ...base, fileContents: 'x' }), /fixture_evidence_field_not_allowed/);
  assert.throws(() => validateFixtureEvidence({ ...base, authorization: 'secret-like' }), /fixture_evidence_field_not_allowed/);
});
test('committed synthetic evidence remains content-free and valid', () => {
  for (const name of ['success-evidence.json', 'failure-evidence.json']) {
    const evidence = JSON.parse(fs.readFileSync(`tests/fixtures/save-to-mind-adapter/${name}`, 'utf8'));
    assert.equal(validateFixtureEvidence(evidence), true);
  }
});
