import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_STATE_REPORT_WORKER, runTypedCapabilityWorker, TypedCapabilityWorkerError, type TypedCapabilityWorkerInput } from '../adapters/infinite-brain-typed-capability-worker.js';

const baseInput = (): TypedCapabilityWorkerInput => ({
  capabilityId: 'capability-state-report', requestId: 'request-1', idempotencyKey: 'idem-1', requestedAt: '2026-07-16T04:00:00.000Z',
  owner: 'brain-runtime', contractId: 'capability-state-contract', privilege: 'local-read-only', readScope: 'fixture-capability-state', writeScope: 'none',
  operation: 'report', killSwitchEnabled: true,
  snapshot: { repositoryState: 'configured', deploymentState: 'unknown', observationState: 'unknown', verificationState: 'verified', recordCount: 17 },
});
const expectCode = (code: string, fn: () => unknown) => assert.throws(fn, (error: unknown) => error instanceof TypedCapabilityWorkerError && error.code === code);

test('pilot definition is bounded and report-only', () => { assert.equal(CAPABILITY_STATE_REPORT_WORKER.mode, 'report-only'); assert.equal(CAPABILITY_STATE_REPORT_WORKER.writeScope, 'none'); assert.equal(CAPABILITY_STATE_REPORT_WORKER.maxRetries, 2); });
test('valid input returns deterministic typed output and receipt', () => { const a = runTypedCapabilityWorker(baseInput()); const b = runTypedCapabilityWorker(baseInput()); assert.deepEqual(a, b); assert.equal(a.status, 'succeeded'); assert.equal(a.output?.recordCount, 17); assert.equal(a.writesToMind, false); assert.equal(a.externalWrites, false); assert.equal(a.state.deploymentState, 'unknown'); });
test('identical retry is idempotent and does not execute twice', () => { const store = new Map(); const first = runTypedCapabilityWorker(baseInput(), store); const second = runTypedCapabilityWorker(baseInput(), store); assert.equal(first.status, 'succeeded'); assert.equal(second.status, 'idempotent-replay'); assert.equal(second.requestHash, first.requestHash); assert.equal(store.size, 1); });
test('bounded retry succeeds before exhaustion', () => { const input = baseInput(); input.simulation = { failuresBeforeSuccess: 2 }; const receipt = runTypedCapabilityWorker(input); assert.equal(receipt.status, 'succeeded'); assert.equal(receipt.attempts, 3); assert.equal(receipt.maxAttempts, 3); });
test('kill switch disabled produces explicit blocked receipt', () => { const input = baseInput(); input.killSwitchEnabled = false; const receipt = runTypedCapabilityWorker(input); assert.equal(receipt.status, 'blocked'); assert.equal(receipt.killSwitch.enabled, false); assert.equal(receipt.failure?.code, 'kill_switch_disabled'); assert.equal(receipt.output, null); });
test('failure receipt is generated after retry exhaustion', () => { const input = baseInput(); input.simulation = { failuresBeforeSuccess: 3, failureCode: 'fixture_failure' }; const receipt = runTypedCapabilityWorker(input); assert.equal(receipt.status, 'failed'); assert.equal(receipt.attempts, 3); assert.equal(receipt.failure?.exhausted, true); assert.equal(receipt.failure?.code, 'fixture_failure'); });
test('timeout is bounded and reported', () => { const input = baseInput(); input.simulation = { durationMs: 251 }; const receipt = runTypedCapabilityWorker(input); assert.equal(receipt.status, 'failed'); assert.equal(receipt.timedOut, true); assert.equal(receipt.failure?.code, 'timeout'); assert.equal(receipt.attempts, 3); });
test('unknown capability fails closed', () => { const input = baseInput(); input.capabilityId = 'unknown'; expectCode('unknown_capability', () => runTypedCapabilityWorker(input)); });
test('invalid input fails closed', () => { const input = baseInput(); input.snapshot.recordCount = -1; expectCode('invalid_input', () => runTypedCapabilityWorker(input)); });
test('privilege or scope expansion fails closed', () => { const input = baseInput(); input.writeScope = 'mind'; expectCode('scope_expansion', () => runTypedCapabilityWorker(input)); });
test('missing owner or contract fails closed', () => { const input = baseInput(); input.owner = ''; expectCode('missing_owner_or_contract', () => runTypedCapabilityWorker(input)); });
test('model-supplied authority fails closed', () => { const input = baseInput(); input.modelSupplied = { owner: 'model' }; expectCode('model_supplied_authority', () => runTypedCapabilityWorker(input)); });
test('unsupported external mutation request fails closed', () => { const input = { ...baseInput(), operation: 'write' }; expectCode('unsupported_mutation_request', () => runTypedCapabilityWorker(input as unknown as TypedCapabilityWorkerInput)); });
test('same idempotency key with changed request fails closed', () => { const store = new Map(); runTypedCapabilityWorker(baseInput(), store); const changed = baseInput(); changed.snapshot.recordCount = 18; expectCode('idempotency_conflict', () => runTypedCapabilityWorker(changed, store)); });
