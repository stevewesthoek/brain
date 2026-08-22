import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { evaluateInfrastructureActionSafety } from '../adapters/infrastructure-action-safety.mjs';
import {
  buildInfrastructureActionRuntimeReceipt,
  DEFAULT_ACTION_RECEIPT_STATE_PATH,
  persistInfrastructureActionReceipt,
  pruneInfrastructureActionReceipts,
  readInfrastructureActionReceiptSnapshot,
} from '../adapters/infrastructure-action-receipt-runtime.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-action-fixtures-v1.json'), 'utf8'));
const clone = (value) => structuredClone(value);
const base = (name) => clone(fixtures.plans[name]);

function evaluate(actionPlan) {
  return evaluateInfrastructureActionSafety({
    actionPlan,
    resources: fixtures.resources,
    relations: fixtures.relations,
    safetyPolicies: fixtures.safetyPolicies,
    incidents: [],
    canonicalPolicyCatalogVersion: fixtures.policyCatalogVersion,
    now: fixtures.now,
  });
}

function withTempRoot(run) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp4-action-receipts-'));
  try {
    return run(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

test('builds a bounded durable receipt from a preflight-ready evaluation', () => {
  const plan = base('highRiskApproved');
  const receipt = buildInfrastructureActionRuntimeReceipt({ actionPlan: plan, evaluation: evaluate(plan) });
  assert.equal(receipt.actionId, plan.actionId);
  assert.equal(receipt.idempotencyKey, plan.idempotencyKey);
  assert.equal(receipt.policyCatalogVersion, fixtures.policyCatalogVersion);
  assert.equal(receipt.decision, 'preflight_ready');
  assert.equal(receipt.executionEnabled, false);
  assert.equal(receipt.executionPerformed, false);
  assert.deepEqual(receipt.actualEffects, []);
  assert.equal(receipt.containsSecrets, false);
  assert.deepEqual(receipt.postCheckRequirements, plan.postCheckPlan);
  assert.equal('approvalRef' in receipt, false);
  assert.equal('providerAvailability' in receipt, false);
});

test('persists atomically under runtime/local/infrastructure with owner-only mode', () => withTempRoot((tempRoot) => {
  const plan = base('highRiskApproved');
  const result = persistInfrastructureActionReceipt({ actionPlan: plan, evaluation: evaluate(plan) }, { root: tempRoot, now: fixtures.now });
  assert.equal(result.persisted, true);
  assert.equal(result.replayed, false);
  assert.ok(result.path.endsWith(DEFAULT_ACTION_RECEIPT_STATE_PATH));
  assert.equal(fs.statSync(result.path).mode & 0o777, 0o600);
  assert.equal(result.snapshot.receipts.length, 1);
  assert.equal(fs.existsSync(`${result.path}.tmp-${process.pid}`), false);
}));

test('exact idempotent replay returns the stored receipt without duplication', () => withTempRoot((tempRoot) => {
  const plan = base('highRiskApproved');
  const evaluation = evaluate(plan);
  const first = persistInfrastructureActionReceipt({ actionPlan: plan, evaluation }, { root: tempRoot, now: fixtures.now });
  const second = persistInfrastructureActionReceipt({ actionPlan: plan, evaluation }, { root: tempRoot, now: fixtures.now });
  assert.equal(first.persisted, true);
  assert.equal(second.persisted, false);
  assert.equal(second.replayed, true);
  assert.equal(second.snapshot.receipts.length, 1);
  assert.deepEqual(second.receipt, first.receipt);
}));

test('idempotency key reuse with a different action hash fails closed', () => withTempRoot((tempRoot) => {
  const plan = base('highRiskApproved');
  persistInfrastructureActionReceipt({ actionPlan: plan, evaluation: evaluate(plan) }, { root: tempRoot, now: fixtures.now });
  const changed = base('highRiskApproved');
  changed.preconditions.expectedRevisions[0].expectedRevision = 'rev-high-conflict';
  assert.throws(
    () => persistInfrastructureActionReceipt({ actionPlan: changed, evaluation: evaluate(changed) }, { root: tempRoot, now: fixtures.now }),
    /idempotency key is already bound to a different action hash/,
  );
}));

test('same actionId cannot be duplicated under a different idempotency key', () => withTempRoot((tempRoot) => {
  const plan = base('highRiskApproved');
  persistInfrastructureActionReceipt({ actionPlan: plan, evaluation: evaluate(plan) }, { root: tempRoot, now: fixtures.now });
  const changed = base('highRiskApproved');
  changed.idempotencyKey = 'fixture-high-risk-second-key';
  assert.throws(
    () => persistInfrastructureActionReceipt({ actionPlan: changed, evaluation: evaluate(changed) }, { root: tempRoot, now: fixtures.now }),
    /actionId is already bound/,
  );
}));

test('mismatched action hash fails before persistence', () => withTempRoot((tempRoot) => {
  const plan = base('highRiskApproved');
  const evaluation = evaluate(plan);
  evaluation.receipt.actionHash = '0'.repeat(64);
  assert.throws(() => persistInfrastructureActionReceipt({ actionPlan: plan, evaluation }, { root: tempRoot, now: fixtures.now }), /actionHash mismatch/);
  assert.equal(fs.existsSync(path.join(tempRoot, DEFAULT_ACTION_RECEIPT_STATE_PATH)), false);
}));

test('execution-enabled or actual-effect evaluations cannot be persisted', () => {
  const plan = base('highRiskApproved');
  const enabled = evaluate(plan);
  enabled.executionEnabled = true;
  assert.throws(() => buildInfrastructureActionRuntimeReceipt({ actionPlan: plan, evaluation: enabled }), /cannot enable execution/);

  const effects = evaluate(plan);
  effects.actualEffects = [{ effectType: 'mutation' }];
  assert.throws(() => buildInfrastructureActionRuntimeReceipt({ actionPlan: plan, evaluation: effects }), /cannot contain actual effects/);
});

test('read-only evaluations are receipted without creating mutation authority', () => {
  const plan = base('readOnly');
  const receipt = buildInfrastructureActionRuntimeReceipt({ actionPlan: plan, evaluation: evaluate(plan) });
  assert.equal(receipt.decision, 'allowed_read_only');
  assert.equal(receipt.executionEnabled, false);
  assert.equal(receipt.executionPerformed, false);
  assert.deepEqual(receipt.actualEffects, []);
});

test('denied evaluations can be retained as fail-closed audit evidence', () => {
  const plan = base('highRiskApproved');
  plan.preconditions.currentRevisions[0].expectedRevision = 'stale-current-revision';
  const evaluation = evaluate(plan);
  assert.equal(evaluation.decision, 'denied');
  const receipt = buildInfrastructureActionRuntimeReceipt({ actionPlan: plan, evaluation });
  assert.equal(receipt.decision, 'denied');
  assert.equal(receipt.executionPerformed, false);
});

test('receipt paths cannot escape runtime/local/infrastructure', () => withTempRoot((tempRoot) => {
  const plan = base('readOnly');
  assert.throws(
    () => persistInfrastructureActionReceipt(
      { actionPlan: plan, evaluation: evaluate(plan) },
      { root: tempRoot, now: fixtures.now, outputPath: path.join('runtime', 'elsewhere', 'receipts.json') },
    ),
    /must remain under runtime\/local\/infrastructure/,
  );
}));

test('malformed existing runtime state fails closed', () => withTempRoot((tempRoot) => {
  const statePath = path.join(tempRoot, DEFAULT_ACTION_RECEIPT_STATE_PATH);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, '{"runtimeSchemaVersion":"wrong"}\n');
  assert.throws(() => readInfrastructureActionReceiptSnapshot({ root: tempRoot }), /failed validation/);
}));

test('retention is count bounded', () => {
  const highPlan = base('highRiskApproved');
  const readPlan = base('readOnly');
  const high = buildInfrastructureActionRuntimeReceipt({ actionPlan: highPlan, evaluation: evaluate(highPlan) });
  const read = buildInfrastructureActionRuntimeReceipt({ actionPlan: readPlan, evaluation: evaluate(readPlan) });
  const retained = pruneInfrastructureActionReceipts([high, read], { now: fixtures.now, maxReceipts: 1, maxAgeSeconds: 60 * 60 });
  assert.equal(retained.length, 1);
});
