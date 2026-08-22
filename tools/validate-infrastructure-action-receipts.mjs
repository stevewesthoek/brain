import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { evaluateInfrastructureActionSafety } from '../projects/brain-core/src/adapters/infrastructure-action-safety.mjs';
import {
  buildInfrastructureActionRuntimeReceipt,
  DEFAULT_ACTION_RECEIPT_STATE_PATH,
  persistInfrastructureActionReceipt,
} from '../projects/brain-core/src/adapters/infrastructure-action-receipt-runtime.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-action-fixtures-v1.json'), 'utf8'));
const adapterText = fs.readFileSync(path.join(root, 'projects/brain-core/src/adapters/infrastructure-action-receipt-runtime.mjs'), 'utf8');
const errors = [];

const evaluate = (actionPlan) => evaluateInfrastructureActionSafety({
  actionPlan,
  resources: fixtures.resources,
  relations: fixtures.relations,
  safetyPolicies: fixtures.safetyPolicies,
  incidents: [],
  canonicalPolicyCatalogVersion: fixtures.policyCatalogVersion,
  now: fixtures.now,
});

if (DEFAULT_ACTION_RECEIPT_STATE_PATH !== path.join('runtime', 'local', 'infrastructure', 'action-receipts.json')) {
  errors.push('receipt persistence path must stay under runtime/local/infrastructure');
}
for (const forbiddenPattern of ['node:child_process', 'node:http', 'node:https', 'node:net', 'fetch(', 'spawn(', 'execFile(']) {
  if (adapterText.includes(forbiddenPattern)) errors.push(`receipt runtime contains forbidden execution/network capability: ${forbiddenPattern}`);
}

const highRiskPlan = structuredClone(fixtures.plans.highRiskApproved);
const highRiskEvaluation = evaluate(highRiskPlan);
const receipt = buildInfrastructureActionRuntimeReceipt({ actionPlan: highRiskPlan, evaluation: highRiskEvaluation });
if (receipt.decision !== 'preflight_ready') errors.push('high-risk approved fixture receipt must remain preflight_ready');
if (receipt.executionEnabled !== false || receipt.executionPerformed !== false || receipt.actualEffects.length !== 0) {
  errors.push('receipt must remain non-executing with no actual effects');
}
if (receipt.containsSecrets !== false) errors.push('receipt must explicitly contain no secrets');
if (receipt.policyCatalogVersion !== fixtures.policyCatalogVersion) errors.push('receipt must bind the current policy catalog version');
if (JSON.stringify(receipt.postCheckRequirements) !== JSON.stringify(highRiskPlan.postCheckPlan)) errors.push('receipt must persist post-check requirements');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ikhp4-action-receipt-validator-'));
try {
  const first = persistInfrastructureActionReceipt({ actionPlan: highRiskPlan, evaluation: highRiskEvaluation }, { root: tempRoot, now: fixtures.now });
  const replay = persistInfrastructureActionReceipt({ actionPlan: highRiskPlan, evaluation: highRiskEvaluation }, { root: tempRoot, now: fixtures.now });
  if (!first.persisted || first.replayed) errors.push('first receipt persistence must create bounded runtime state');
  if (replay.persisted || !replay.replayed || replay.snapshot.receipts.length !== 1) errors.push('exact replay must deduplicate without a second receipt');
  if ((fs.statSync(first.path).mode & 0o777) !== 0o600) errors.push('receipt runtime file mode must be 0600');
  if (!first.path.startsWith(path.join(tempRoot, 'runtime', 'local', 'infrastructure') + path.sep)) errors.push('receipt escaped bounded runtime directory');
} catch (error) {
  errors.push(`runtime receipt validation failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const executionProbe = evaluate(highRiskPlan);
executionProbe.executionPerformed = true;
try {
  buildInfrastructureActionRuntimeReceipt({ actionPlan: highRiskPlan, evaluation: executionProbe });
  errors.push('executionPerformed=true must fail closed');
} catch {
  // Expected fail-closed behavior.
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('infrastructure-action-receipts-valid runtimeVersion=1.0.0 path=runtime/local/infrastructure/action-receipts.json executionEnabled=false executionPerformed=false');
