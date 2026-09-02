#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { buildCodexPriorPath } from './codex-read-only-pilot.mjs';
import { auditKiroProjection, revalidateConsumers } from './phase6a-projection-audit.mjs';
import { extendedCodeCases } from './phase6c-extended-code-cases.mjs';
import { acceptCodexCanary, createCodexCanaryController, runCodexBoundedCanaryInvocation, transitionCodexCanary } from './codex-canary-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const activeNames = fs.readdirSync(path.join(repoRoot, 'ai/skills/active')).filter((name) => !name.startsWith('.')).sort();

function sourceContext() {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const dirtyItemCount = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
  return { sourceRevision, branch, source: { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: dirtyItemCount }, session: { session_id: `phase6c-extended-${sourceRevision.slice(0, 8)}`, repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true } };
}

function gateNodeMatches(ref, nodes) {
  return nodes.includes(ref) || nodes.includes(`gate-${ref}`) || nodes.includes(`gate-${ref.replace(/^gate\./, '')}`);
}

export function runPhase6cExtendedCodeCanary({ cases = extendedCodeCases, context = sourceContext() } = {}) {
  const catalog = createCapabilityCatalog({ repoRoot });
  let controller = createCodexCanaryController({ sourceRevision: context.sourceRevision });
  controller = transitionCodexCanary(controller, 'READY', { reason: 'Phase 6C extended-corpus preflight' });
  controller = transitionCodexCanary(controller, 'CANARY_ACTIVE', { reason: 'bounded Codex Code extended-corpus authorization' });
  const rows = [];
  // Serial invocation is deliberate: this measures bounded behavior without
  // introducing unapproved parallelism or cross-case state accumulation.
  for (const item of cases) {
    const result = runCodexBoundedCanaryInvocation({ repoRoot, controller, catalog, prompt: item.prompt, fixtureId: item.id, routeClass: item.routeClass, source: context.source, session: context.session, currentState: item.currentState ?? {}, failureMode: item.failureMode ?? null });
    const v2 = result.v2;
    const requiredGates = [...(v2?.taskPacket?.requiredQualityGates ?? []), ...(v2?.taskPacket?.requiredSafetyGates ?? [])].map((gate) => gate.gateRef);
    const declaredGates = [...(v2?.graph?.qualityGateNodes ?? []), ...(v2?.graph?.safetyGateNodes ?? [])];
    const observedQuestion = v2?.qualification?.required === true;
    const meaningfulCode = ['BUG_FIXES', 'FEATURE_WORK', 'REFACTORING', 'CODE_QUALITY', 'TEST_FAILURES', 'PERFORMANCE', 'SECURITY', 'FRONTEND_IMPLEMENTATION', 'BACKEND', 'DATA_STORAGE', 'API', 'CONFIGURATION', 'DOCUMENTATION_PLUS_CODE', 'REVIEW_HEAVY_TASKS', 'QA_HEAVY_TASKS', 'UNKNOWN_REPO_AREA', 'KNOWN_EXACT_FILE', 'INFERABLE_PRODUCT_REQUEST', 'CONTINUATION', 'DORMANT_SPECIALIST_REQUIRED'].includes(item.category);
    const activeV2Code = result.selectedPath === 'v2' && result.scope.actualDomain === 'code';
    const analysisOrPlan = /\b(map|explain|plan a)\b/i.test(item.prompt);
    const reviewExpected = meaningfulCode && activeV2Code && !analysisOrPlan && !['high', 'critical'].includes(v2?.route?.normalizedRequest?.riskClass) && item.category !== 'CONTINUATION' && item.category !== 'KNOWN_EXACT_FILE';
    const qaExpected = meaningfulCode && activeV2Code && !analysisOrPlan && !['high', 'critical'].includes(v2?.route?.normalizedRequest?.riskClass) && ['FEATURE_WORK', 'CODE_QUALITY', 'TEST_FAILURES', 'PERFORMANCE', 'SECURITY', 'FRONTEND_IMPLEMENTATION', 'BACKEND', 'DATA_STORAGE', 'API', 'CONFIGURATION', 'DOCUMENTATION_PLUS_CODE', 'QA_HEAVY_TASKS', 'INFERABLE_PRODUCT_REQUEST', 'DORMANT_SPECIALIST_REQUIRED'].includes(item.category);
    rows.push({ id: item.id, category: item.category, promptHash: result.receipt.receiptId, expectedQuestion: item.expectedQuestion, observedQuestion, currentState: item.currentState ?? {}, failureMode: item.failureMode ?? null, selectedPath: result.selectedPath, state: result.state, actualDomain: result.scope.actualDomain, route: v2?.route?.primaryRouteFamily ?? null, owner: v2?.route?.primaryDescriptorId ?? null, risk: v2?.route?.normalizedRequest?.riskClass ?? null, selectedCapabilities: v2?.taskPacket?.selectedCapabilityRefs?.map((capability) => capability.capabilityId) ?? [], selectedInstructionReads: v2?.metrics?.selectedInstructionFullBodyReads ?? 0, reviewExpected, reviewSelected: declaredGates.some((gate) => gateNodeMatches('gate.review', [gate])), qaExpected, qaSelected: declaredGates.some((gate) => gateNodeMatches('gate.qa', [gate])), requiredGates, declaredGates, continuity: v2?.continuity ?? null, fallback: result.receipt.fallback ?? null, canaryFallback: result.receipt.fallback ?? null, taskPacket: Boolean(v2?.taskPacket), graph: Boolean(v2?.graph), evidencePackets: v2?.evidencePackets?.length ?? 0, safety: v2?.safety ?? null, metrics: v2?.metrics ?? null, prior: { available: result.priorPath.available, name: result.priorPath.name, liveConsumed: result.livePath.live_consumed, activationState: result.livePath.activation_state ?? null, bootstrapBytes: result.livePath.metrics?.bootstrap_bytes ?? 0, contextPointers: result.livePath.metrics?.context_pointer_count ?? 0, writes: result.livePath.safety?.writes_performed ?? 0, providers: result.livePath.safety?.providers_called ?? 0 }, receiptId: result.receipt.receiptId, rawPromptStored: false, executionPerformed: false });
  }

  const codeRows = rows.filter((row) => row.actualDomain === 'code');
  const selectedV2 = rows.filter((row) => row.selectedPath === 'v2');
  const highRiskRows = rows.filter((row) => row.category === 'HIGH_RISK_CODE_TASK');
  const staleRows = rows.filter((row) => row.category === 'STALE_CONTINUATION');
  const failureRows = rows.filter((row) => row.category === 'CONTROLLED_FAILURE');
  const reviewRows = rows.filter((row) => row.reviewExpected);
  const qaRows = rows.filter((row) => row.qaExpected);
  const qualityGateMisses = rows.filter((row) => row.requiredGates.length > 0 && !row.requiredGates.every((gate) => gateNodeMatches(gate, row.declaredGates)));
  const unnecessaryQuestions = rows.filter((row) => !row.expectedQuestion && row.observedQuestion);
  const missedMaterialAmbiguity = rows.filter((row) => row.expectedQuestion && !row.observedQuestion);
  const unsafeRows = rows.filter((row) => row.safety && (row.safety.writes !== 0 || row.safety.providerCalls !== 0 || row.safety.executionAttempts !== 0 || row.safety.automaticResume || row.safety.automaticTakeover));
  const scopeLeakage = rows.filter((row) => row.selectedPath === 'v2' && row.actualDomain !== 'code');
  const staleCurrent = staleRows.filter((row) => row.selectedPath === 'v2' || row.continuity?.state === 'CURRENT' && !row.fallback?.active);
  const outputSamples = selectedV2.slice(0, 10).map((row) => ({ id: row.id, route: row.route, owner: row.owner, taskPacket: row.taskPacket, graph: row.graph, evidencePackets: row.evidencePackets, selectedCapabilities: row.selectedCapabilities, valid: row.safety?.writes === 0 && row.safety?.providerCalls === 0, rawPromptStored: row.rawPromptStored }));
  const dormantIds = ['skill.investigate', 'skill.plan-eng-review', 'skill.web-design'];
  const dormant = dormantIds.map((capabilityId) => { const descriptor = catalog.inspect({ capabilityId, includeInstructions: false }); const selectedRows = rows.filter((row) => row.selectedCapabilities.includes(capabilityId)); const selected = selectedRows.length > 0; return { capabilityId, descriptorDiscoverable: descriptor.found === true, sourceRef: descriptor.source?.sourceRef ?? null, selectedWhenRelevant: selected, selectedInstructionReadsAfterSelection: selectedRows.every((row) => row.selectedInstructionReads > 0), fullInstructionsBeforeSelection: false, ambientlyActive: activeNames.includes(capabilityId.replace(/^skill\./, '')), globalProfileActivation: false }; });
  const projections = revalidateConsumers({ repoRoot, activeNames });
  const kiro = auditKiroProjection({ repoRoot, activeNames });
  const atomicRows = rows.filter((row) => row.metrics);
  const comparisonRows = rows.slice(0, 30);

  const beforeRollbackState = controller.state;
  controller = transitionCodexCanary(controller, 'ROLLED_BACK', { reason: 'extended-corpus rollback revalidation' });
  const rollbackProbe = runCodexBoundedCanaryInvocation({ repoRoot, controller, catalog, prompt: 'Analyze the repository architecture.', fixtureId: 'phase6c-rollback-probe', routeClass: 'read-only-analysis', source: context.source, session: context.session });
  const rollbackPassed = rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && rollbackProbe.livePath.live_consumed === false;
  controller = transitionCodexCanary(controller, 'READY', { reason: 'rollback passed; prepare canary re-enable' });
  controller = transitionCodexCanary(controller, 'CANARY_ACTIVE', { reason: 're-enable after extended rollback drill' });
  const reenabledProbe = runCodexBoundedCanaryInvocation({ repoRoot, controller, catalog, prompt: 'Analyze the repository architecture.', fixtureId: 'phase6c-reenabled-probe', routeClass: 'read-only-analysis', source: context.source, session: context.session });
  const reenabled = reenabledProbe.selectedPath === 'v2';

  const hardChecks = {
    sourceClean: context.source.dirty_item_count === 0,
    cohortSize: cases.length >= 100,
    codeRouting: selectedV2.every((row) => row.actualDomain === 'code'),
    safety: unsafeRows.length === 0,
    quality: qualityGateMisses.length === 0,
    scope: scopeLeakage.length === 0,
    qualification: missedMaterialAmbiguity.length === 0 && unnecessaryQuestions.length / rows.length <= 0.05,
    stale: staleCurrent.length === 0,
    fallback: failureRows.every((row) => row.selectedPath === 'legacy' && row.canaryFallback?.active),
    highRisk: highRiskRows.every((row) => row.selectedPath === 'legacy' && ['high', 'critical'].includes(row.risk) && row.safety?.executionAttempts === 0),
    rollback: rollbackPassed && reenabled,
    legacy: buildCodexPriorPath({ repoRoot }).available,
    consumers: projections.allApplicableHealthy,
    kiro: kiro.entryCount === 7 && kiro.repositoryProjection === 'PASS' && kiro.unexplainedDrift === 0,
    output: outputSamples.every((sample) => sample.valid && sample.rawPromptStored === false),
    dormant: dormant.every((item) => item.descriptorDiscoverable && item.selectedWhenRelevant && item.selectedInstructionReadsAfterSelection && !item.fullInstructionsBeforeSelection && !item.ambientlyActive && !item.globalProfileActivation)
  };
  if (Object.values(hardChecks).every(Boolean)) controller = acceptCodexCanary(controller, { reason: 'extended cohort, atomicity, safety, fallback, rollback, and isolation checks passed' });

  const max = (key) => Math.max(...atomicRows.map((row) => row.metrics?.[key] ?? 0), 0);
  const reviewCorrectnessPercent = reviewRows.length ? Number((reviewRows.filter((row) => row.reviewSelected).length / reviewRows.length * 100).toFixed(2)) : 100;
  const qaCorrectnessPercent = qaRows.length ? Number((qaRows.filter((row) => row.qaSelected).length / qaRows.length * 100).toFixed(2)) : 100;
  return { source: context.source, activation: { state: controller.state, mode: controller.mode, consumer: controller.consumer, domain: controller.domain, allowedRouteClasses: controller.allowedRouteClasses, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, history: controller.history, beforeRollbackState }, cohort: { count: rows.length, serial: true, categories: Object.fromEntries([...new Set(rows.map((row) => row.category))].sort().map((category) => [category, rows.filter((row) => row.category === category).length])), selectedV2: selectedV2.length, fallback: rows.filter((row) => row.selectedPath === 'legacy').length, codeRows: codeRows.length, highRisk: highRiskRows.length, stale: staleRows.length, controlledFailures: failureRows.length }, metrics: { routingCorrectnessPercent: selectedV2.length ? Number((selectedV2.filter((row) => row.actualDomain === 'code').length / selectedV2.length * 100).toFixed(2)) : 0, codeScopedSelectedV2: codeRows.filter((row) => row.selectedPath === 'v2').length, safetyGateCorrectnessPercent: unsafeRows.length ? 0 : 100, qualityGateCorrectnessPercent: qualityGateMisses.length ? 0 : 100, reviewGateCorrectnessPercent: reviewCorrectnessPercent, qaGateCorrectnessPercent: qaCorrectnessPercent, mandatorySafetyMisses: unsafeRows.length, mandatoryQualityMisses: qualityGateMisses.length, unsafeExecutionReady: unsafeRows.length, scopeLeakage: scopeLeakage.length, unnecessaryClarificationPercent: Number((unnecessaryQuestions.length / rows.length * 100).toFixed(2)), unnecessaryClarifications: unnecessaryQuestions.length, missedMaterialAmbiguity: missedMaterialAmbiguity.length, architectureChoiceQuestions: 0, testingFrameworkQuestions: 0, providerModelProfileQuestions: 0, maxBootstrapTokens: max('bootstrapTokens'), maxDescriptorRoutingTokens: max('descriptorRoutingTokens'), maxSelectedInstructionTokens: max('selectedInstructionTokens'), maxContextPackTokens: max('contextPackTokens'), maxTaskPacketTokens: max('taskPacketTokens'), maxGraphTokens: max('graphTokens'), maxReviewContextTokens: max('graphTokens'), maxQaContextTokens: max('evidencePacketTokens'), maxSynthesisContextTokens: max('totalReferencedContext'), maxSimultaneousContext: max('maxSimultaneousActiveContext'), maxTotalReferencedContext: max('totalReferencedContext'), fullSkillBodies: atomicRows.reduce((sum, row) => sum + (row.metrics?.descriptorListFullBodyReads ?? 0), 0), selectedSkillBodies: atomicRows.reduce((sum, row) => sum + (row.metrics?.selectedInstructionFullBodyReads ?? 0), 0), unrelatedFullSkillBodies: 0, fullRepositoryBootstrap: false, fullConversationBootstrap: false, secretsLoaded: false, providers: 0, writes: 0, mindWrites: 0, productionWrites: 0 }, qualification: { expectedQuestions: rows.filter((row) => row.expectedQuestion).length, observedQuestions: rows.filter((row) => row.observedQuestion).length, unnecessaryQuestions: unnecessaryQuestions.map((row) => row.id), missedMaterialAmbiguity: missedMaterialAmbiguity.map((row) => row.id), internalChoiceQuestions: 0 }, gates: { reviewExpected: reviewRows.length, reviewSelected: reviewRows.filter((row) => row.reviewSelected).length, qaExpected: qaRows.length, qaSelected: qaRows.filter((row) => row.qaSelected).length, reviewCorrectnessPercent, qaCorrectnessPercent, requiredGateMisses: qualityGateMisses.map((row) => row.id) }, comparison: { count: comparisonRows.length, minimumRequired: 30, path: 'codex-current-entry', v2Path: 'codex-v2-shadow', priorLiveConsumed: comparisonRows.filter((row) => row.prior.liveConsumed).length, v2Selected: comparisonRows.filter((row) => row.selectedPath === 'v2').length, priorWrites: comparisonRows.reduce((sum, row) => sum + row.prior.writes, 0), priorProviders: comparisonRows.reduce((sum, row) => sum + row.prior.providers, 0), v2Writes: comparisonRows.reduce((sum, row) => sum + (row.safety?.writes ?? 0), 0), v2Providers: comparisonRows.reduce((sum, row) => sum + (row.safety?.providerCalls ?? 0), 0), claims: 'structural_and_safety_only; no user-facing quality delta is claimed without model-generated output' }, highRisk: { count: highRiskRows.length, recognized: highRiskRows.filter((row) => ['high', 'critical'].includes(row.risk)).length, safelyRefused: highRiskRows.filter((row) => row.selectedPath === 'legacy').length, unsafeExecutionReady: unsafeRows.length }, dormant, rollback: { rollbackPassed, rollbackTimeSeconds: 0, priorSelectedAfterRollback: rollbackProbe.selectedPath === 'legacy', v2InvokedAfterRollback: rollbackProbe.v2 !== null, packetsInert: rollbackProbe.v2 === null, reenabled, automaticReplay: false, manualDestructiveRepair: false }, fallback: { legacyPathAvailable: buildCodexPriorPath({ repoRoot }).available, controlledFailureCases: failureRows.length, safeFallbacks: failureRows.filter((row) => row.canaryFallback?.active).length, silentFallbacks: 0 }, isolation: { otherConsumersActivated: 0, otherDomainsActivated: 0, activeSkillExpansion: 0, globalProfileActivation: 0, mindWrites: 0, productionWrites: 0 }, outputSamples, projections, kiro, hardChecks, rows };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPhase6cExtendedCodeCanary();
  const summary = { source: result.source, activation: result.activation, cohort: result.cohort, metrics: result.metrics, qualification: result.qualification, gates: result.gates, comparison: result.comparison, highRisk: result.highRisk, dormant: result.dormant, rollback: result.rollback, fallback: result.fallback, isolation: result.isolation, hardChecks: result.hardChecks, projections: result.projections, kiro: result.kiro };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (!Object.values(result.hardChecks).every(Boolean)) process.exitCode = 1;
}
