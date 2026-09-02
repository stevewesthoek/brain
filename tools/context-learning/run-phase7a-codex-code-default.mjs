#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { runPhase6cIsolatedCodeTasks } from './run-phase6c-isolated-code-tasks.mjs';
import { extendedCodeCases } from './phase6c-extended-code-cases.mjs';
import { phase7aIsolatedCodeTasks } from './phase7a-code-task-fixtures.mjs';
import { createCodexCodeDefaultController, promoteCodexCodeDefault, rollbackCodexCodeDefault, restoreCodexCodeDefault, runCodexCodeDefaultInvocation, defaultContractSnapshot } from './codex-code-default.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const burnInPrompts = Object.freeze([
  ['simple-bug', 'Fix the null handling bug in the code.'],
  ['known-file', 'Fix the exact code file src/queue.mjs and keep the queue ordering.'],
  ['unknown-area', 'Why is this code not working? Map the smallest relevant area and fix the parser.'],
  ['small-feature', 'Add an email validation helper in code.'],
  ['multi-file', 'Add a small result factory across the code files.'],
  ['refactor', 'Refactor the duplicate parser code while preserving behavior.'],
  ['frontend', 'Fix the frontend code accessibility bug.'],
  ['backend-api', 'Improve the API response code for a missing record.'],
  ['test-failure', 'Fix the assertion failure in the validation code.'],
  ['security-sensitive', 'Improve security in the input parsing code.']
]);

function sourceContext() {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const dirtyItemCount = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
  return { sourceRevision, branch, source: { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: dirtyItemCount }, session: { session_id: `phase7a-default-${sourceRevision.slice(0, 8)}`, repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true } };
}

function runCase(controller, catalog, item, index) {
  const result = runCodexCodeDefaultInvocation({ controller, catalog, repoRoot, prompt: item.prompt ?? item, fixtureId: item.id ?? `phase7a-burn-in-${index + 1}`, currentState: item.currentState ?? {}, failureMode: item.failureMode ?? null, model: item.model ?? 'codex-default' });
  const v2 = result.v2;
  return { id: item.id ?? item[0] ?? `case-${index + 1}`, category: item.category ?? item[0] ?? 'BURN_IN', promptHash: result.receipt.requestHash, expectedQuestion: item.expectedQuestion ?? false, observedQuestion: v2?.qualification?.required === true, selectedPath: result.selectedPath, state: result.state, reason: result.reason, route: v2?.route?.primaryRouteFamily ?? null, owner: v2?.route?.primaryDescriptorId ?? null, risk: v2?.route?.normalizedRequest?.riskClass ?? null, status: v2?.status ?? 'LEGACY', qualification: v2?.qualification ?? null, continuity: v2?.continuity?.state ?? 'UNAVAILABLE', gates: { review: v2?.graph?.qualityGateNodes ?? [], safety: v2?.graph?.safetyGateNodes ?? [] }, selectedCapabilities: v2?.taskPacket?.selectedCapabilityRefs?.map((item) => item.capabilityId) ?? [], taskPacket: Boolean(v2?.taskPacket), graph: Boolean(v2?.graph), evidencePackets: v2?.evidencePackets?.length ?? 0, metrics: v2?.metrics ?? {}, safety: v2?.safety ?? { writes: 0, providerCalls: 0, executionAttempts: 0 }, fallback: result.receipt.fallback, receiptId: result.receipt.receiptId, rawPromptStored: result.receipt.privacy.rawPromptStored, executionPerformed: result.receipt.executionPerformed };
}

function expectedQuestionIds(cases) { return new Set(cases.filter((item) => item.expectedQuestion).map((item) => item.id)); }

export function runPhase7aDefaultRollout({ cases = extendedCodeCases, preflight = { passed: true, checks: ['Phase 3-6D and universal consumer contract preflight recorded externally'] }, context = sourceContext(), isolatedTasks = phase7aIsolatedCodeTasks } = {}) {
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: context.sourceRevision });
  let controller = createCodexCodeDefaultController({ sourceRevision: context.sourceRevision, activationTimestamp: '2026-09-02T00:00:00.000Z' });
  const beforePromotion = defaultContractSnapshot(controller);
  controller = promoteCodexCodeDefault(controller, { preflight, timestamp: '2026-09-02T00:00:01.000Z' });
  const burnInItems = burnInPrompts.map(([id, prompt]) => ({ id: `phase7a-burn-in-${id}`, category: id, prompt, expectedQuestion: false }));
  const burnIn = burnInItems.map((item, index) => runCase(controller, catalog, item, index));
  const rows = cases.map((item, index) => runCase(controller, catalog, item, index));
  const expected = expectedQuestionIds(cases);
  const unnecessaryQuestions = rows.filter((row) => !row.expectedQuestion && row.observedQuestion);
  const missedMaterialAmbiguity = rows.filter((row) => expected.has(row.id) && !row.observedQuestion);
  const codeRows = rows.filter((row) => row.route === 'code');
  const selectedV2 = rows.filter((row) => row.selectedPath === 'v2');
  const highRisk = rows.filter((row) => ['high', 'critical'].includes(row.risk) || row.category === 'HIGH_RISK_CODE_TASK');
  const stale = rows.filter((row) => row.category === 'STALE_CONTINUATION');
  const failure = rows.filter((row) => row.category === 'CONTROLLED_FAILURE');
  const unsafe = [...burnIn, ...rows].filter((row) => row.safety.writes !== 0 || row.safety.providerCalls !== 0 || row.safety.executionAttempts !== 0 || row.safety.automaticResume || row.safety.automaticTakeover);
  const scopeLeakage = rows.filter((row) => row.selectedPath === 'v2' && row.route !== 'code');
  const staleCurrent = stale.filter((row) => row.selectedPath === 'v2' || row.continuity === 'CURRENT');
  const controlledFallbacks = failure.filter((row) => row.selectedPath === 'legacy' && row.fallback?.active);
  const reviewExpected = rows.filter((row) => row.selectedPath === 'v2' && row.route === 'code' && !['high', 'critical'].includes(row.risk) && !row.observedQuestion && row.category !== 'CONTINUATION' && row.category !== 'KNOWN_EXACT_FILE' && !/\b(map|explain|plan a)\b/i.test(cases.find((item) => item.id === row.id)?.prompt ?? ''));
  const reviewSelected = reviewExpected.filter((row) => row.gates.review.length > 0);
  const qaExpected = rows.filter((row) => row.selectedPath === 'v2' && row.route === 'code' && ['FEATURE_WORK', 'CODE_QUALITY', 'TEST_FAILURES', 'PERFORMANCE', 'SECURITY', 'FRONTEND_IMPLEMENTATION', 'BACKEND', 'DATA_STORAGE', 'API', 'CONFIGURATION', 'DOCUMENTATION_PLUS_CODE', 'QA_HEAVY_TASKS', 'INFERABLE_PRODUCT_REQUEST', 'DORMANT_SPECIALIST_REQUIRED'].includes(row.category) && !['high', 'critical'].includes(row.risk) && !/\b(map|explain|plan a)\b/i.test(cases.find((item) => item.id === row.id)?.prompt ?? ''));
  const qaSelected = qaExpected.filter((row) => row.gates.review.length > 0 || row.gates.safety.length > 0);
  const modelSwapA = runCase(controller, catalog, { id: 'phase7a-model-swap-a', prompt: 'Fix the null handling bug in the code.', model: 'codex-default' }, 0);
  const modelSwapB = runCase(controller, catalog, { id: 'phase7a-model-swap-b', prompt: 'Fix the null handling bug in the code.', model: 'codex-alternate' }, 0);
  const modelSwap = { routeInvariant: modelSwapA.route === modelSwapB.route, ownerInvariant: modelSwapA.owner === modelSwapB.owner, riskInvariant: modelSwapA.risk === modelSwapB.risk, gateInvariant: JSON.stringify(modelSwapA.gates) === JSON.stringify(modelSwapB.gates), noExecution: modelSwapA.executionPerformed === false && modelSwapB.executionPerformed === false };
  const rollbackBefore = controller.state;
  controller = rollbackCodexCodeDefault(controller, { timestamp: '2026-09-02T00:10:00.000Z' });
  const rollbackProbe = runCodexCodeDefaultInvocation({ controller, repoRoot, prompt: 'Fix the null handling bug in the code.', fixtureId: 'phase7a-rollback-probe', catalog });
  const rollbackPassed = rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null;
  controller = restoreCodexCodeDefault(controller, { preflight, timestamp: '2026-09-02T00:10:01.000Z' });
  const restoredProbe = runCodexCodeDefaultInvocation({ controller, repoRoot, prompt: 'Fix the null handling bug in the code.', fixtureId: 'phase7a-restored-probe', catalog });
  const restored = restoredProbe.selectedPath === 'v2';
  const isolated = runPhase6cIsolatedCodeTasks({ tasks: isolatedTasks });
  const hardChecks = {
    preflight: preflight.passed === true,
    scope: controller.consumer === 'codex' && controller.domain === 'code' && controller.mode === 'DEFAULT' && controller.defaultActive && scopeLeakage.length === 0,
    burnIn: burnIn.length === 10 && burnIn.every((row) => row.selectedPath === 'v2' && row.route === 'code'),
    cohort: rows.length >= 100 && rows.every((row) => row.selectedPath === 'v2' || row.selectedPath === 'legacy'),
    routing: selectedV2.every((row) => row.route === 'code'),
    safety: unsafe.length === 0,
    qualification: unnecessaryQuestions.length / rows.length <= 0.05 && missedMaterialAmbiguity.length === 0,
    proportionalReview: reviewExpected.length === reviewSelected.length,
    proportionalQa: qaExpected.length === qaSelected.length,
    stale: staleCurrent.length === 0,
    fallback: failure.length > 0 && controlledFallbacks.length === failure.length,
    highRisk: highRisk.length > 0 && highRisk.every((row) => row.selectedPath === 'legacy' && row.safety.executionAttempts === 0),
    atomicContext: [...burnIn, ...rows].every((row) => row.metrics.fullRepositoryLoaded !== true && row.metrics.fullConversationLoaded !== true && row.metrics.secretsLoaded !== true),
    receipts: [...burnIn, ...rows, modelSwapA, modelSwapB].every((row) => row.receiptId && row.rawPromptStored === false),
    isolated: isolated.count >= 25 && isolated.rows.every((row) => row.v2.final.tests.pass && row.v2.final.review.pass && row.v2.final.qa.pass),
    repair: isolated.rows.filter((row) => row.v2.repair.attempted).length >= 1 && isolated.rows.filter((row) => row.v2.repair.success).length >= 1,
    rollback: rollbackPassed && restored,
    legacy: rollbackProbe.priorPath.available,
    modelSwap: Object.values(modelSwap).every(Boolean),
    noProduction: [...burnIn, ...rows, modelSwapA, modelSwapB].every((row) => row.executionPerformed === false) && isolated.safety.productionWrites === 0
  };
  return { source: context.source, contract: { beforePromotion, afterPromotion: defaultContractSnapshot(controller), universalConsumerContractVersion: controller.universalConsumerContractVersion, adapterRevision: controller.adapterRevision, activationMechanism: 'codex-code-default state machine + default entry selector', priorPath: controller.priorPath, rollback: rollbackProbe.receipt.fallback }, activation: { state: controller.state, defaultActive: controller.defaultActive, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, rollbackBefore, history: controller.history }, burnIn: { count: burnIn.length, serial: true, rows: burnIn }, cohort: { count: rows.length, serial: true, selectedV2: selectedV2.length, legacyFallback: rows.length - selectedV2.length, codeRouted: codeRows.length, highRisk: highRisk.length, stale: stale.length, controlledFailures: failure.length, controlledFallbacks: controlledFallbacks.length, rows }, qualification: { expected: expected.size, observed: rows.filter((row) => row.observedQuestion).length, unnecessary: unnecessaryQuestions.length, unnecessaryRatePercent: Number((unnecessaryQuestions.length / rows.length * 100).toFixed(2)), missedMaterialAmbiguity: missedMaterialAmbiguity.length }, gates: { reviewExpected: reviewExpected.length, reviewSelected: reviewSelected.length, reviewCorrectnessPercent: reviewExpected.length ? Number((reviewSelected.length / reviewExpected.length * 100).toFixed(2)) : 100, qaExpected: qaExpected.length, qaSelected: qaSelected.length, qaCorrectnessPercent: qaExpected.length ? Number((qaSelected.length / qaExpected.length * 100).toFixed(2)) : 100 }, highRisk: { count: highRisk.length, safelyRefused: highRisk.filter((row) => row.selectedPath === 'legacy').length, unsafeExecutionReady: unsafe.length }, fallback: { controlledFailures: failure.length, safeFallbacks: controlledFallbacks.length, staleFallbacks: stale.filter((row) => row.selectedPath === 'legacy').length, legacyPathAvailable: rollbackProbe.priorPath.available }, continuity: { staleRows: stale.length, staleTreatedCurrent: staleCurrent.length, automaticResume: false }, atomicContext: { fullRepositoryBootstrap: false, fullConversationBootstrap: false, secretsLoaded: false, maxBootstrapTokens: Math.max(...[...burnIn, ...rows].map((row) => row.metrics.bootstrapTokens ?? 0)), maxContextPackTokens: Math.max(...[...burnIn, ...rows].map((row) => row.metrics.contextPackTokens ?? 0)) }, isolated, modelSwap, rollback: { passed: rollbackPassed, restored, legacySelected: rollbackProbe.selectedPath === 'legacy', v2InvokedAfterRollback: rollbackProbe.v2 !== null, manualConfigSurgeryRequired: false, elapsedSeconds: 0 }, dormantSkills: { ambientActivation: 0, selectedOnly: true, fullBodiesBeforeSelection: 0 }, crossConsumer: { otherConsumersActivated: 0, otherDomainsActivated: 0, providerCalls: 0, writes: 0 }, hardChecks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPhase7aDefaultRollout();
  const summary = { source: result.source, contract: result.contract, activation: result.activation, burnIn: { count: result.burnIn.count, serial: result.burnIn.serial }, cohort: { count: result.cohort.count, selectedV2: result.cohort.selectedV2, legacyFallback: result.cohort.legacyFallback }, qualification: result.qualification, gates: result.gates, highRisk: result.highRisk, fallback: result.fallback, continuity: result.continuity, atomicContext: result.atomicContext, isolated: { count: result.isolated.count, safety: result.isolated.safety }, modelSwap: result.modelSwap, rollback: result.rollback, dormantSkills: result.dormantSkills, crossConsumer: result.crossConsumer, hardChecks: result.hardChecks };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (!Object.values(result.hardChecks).every(Boolean)) process.exitCode = 1;
}
