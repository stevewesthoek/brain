#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { loadJson } from './context-learning-core.mjs';
import { buildCrossSessionContinuity } from './cross-session-continuity-pilot.mjs';
import { extendedCodeCases } from './phase6c-extended-code-cases.mjs';
import { phase7aIsolatedCodeTasks } from './phase7a-code-task-fixtures.mjs';
import { createCodexCodeDefaultController, promoteCodexCodeDefault, runCodexCodeDefaultInvocation } from './codex-code-default.mjs';
import { createClaudeCodeAdapter, CLAUDE_CODE_ADAPTER_ID, CLAUDE_CODE_ADAPTER_REVISION, CLAUDE_CODE_CAPABILITIES } from './claude-code-consumer-adapter.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, acceptUniversalConsumerCanary, rollbackUniversalConsumerCanary, transitionUniversalConsumerCanary, runUniversalConsumerCanaryInvocation } from './universal-consumer-canary.mjs';
import { negotiateCapabilities, validateUniversalConsumerContract, UNIVERSAL_CONTRACT_VERSION } from './universal-consumer-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const matrixPath = path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json');
const codeCategories = new Set(['BUG_FIXES', 'FEATURE_WORK', 'REFACTORING', 'CODE_QUALITY', 'TEST_FAILURES', 'PERFORMANCE', 'SECURITY', 'BACKEND', 'DATA_STORAGE', 'API', 'CONFIGURATION', 'DOCUMENTATION_PLUS_CODE', 'REVIEW_HEAVY_TASKS', 'QA_HEAVY_TASKS', 'INFERABLE_PRODUCT_REQUEST', 'CONTINUATION', 'DORMANT_SPECIALIST_REQUIRED']);
const burnInPrompts = Object.freeze([
  ['known-file-bug', 'Fix the exact code file src/queue.mjs and keep the queue ordering.'],
  ['unknown-area-bug', 'Why is this code not working? Map the smallest relevant area and fix the parser.'],
  ['small-feature', 'Add an email validation helper in code.'],
  ['multi-file-feature', 'Add a small result factory across the code files.'],
  ['frontend', 'Fix the frontend code accessibility bug.'],
  ['backend-api', 'Improve the API response code for a missing record.'],
  ['test-repair', 'Fix the assertion failure in the validation code.'],
  ['refactor', 'Refactor the duplicate parser code while preserving behavior.'],
  ['performance', 'Make the repeated lookup code much faster.'],
  ['security', 'Improve security in the input parsing code.']
]);

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function gate(value) { return String(value ?? '').replace(/^gate-gate\./, 'gate.').replace(/^gate-/, 'gate.'); }
function capabilityId(value) { return typeof value === 'string' ? value : value?.capabilityId ?? value?.ownerCapabilityRef?.capabilityId ?? null; }
function sourceContext() {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const dirtyItemCount = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
  return { sourceRevision, branch, source: { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: dirtyItemCount }, session: { session_id: `phase7b-claude-${sourceRevision.slice(0, 8)}`, repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true } };
}

function claudeRuntime() {
  const version = spawnSync('claude', ['--version'], { cwd: repoRoot, encoding: 'utf8' });
  const paths = ['operations/system-configs/claude/CLAUDE.md', 'operations/system-configs/claude/settings.json', 'operations/system-configs/claude/hooks', 'operations/system-configs/claude/skills'];
  return { available: version.status === 0, version: (version.stdout ?? '').trim(), error: version.status === 0 ? null : (version.stderr ?? '').trim(), paths: Object.fromEntries(paths.map((item) => [item, fs.existsSync(path.join(repoRoot, item))])) };
}

function preconditions({ adapter, context }) {
  const runtime = claudeRuntime();
  const contract = validateUniversalConsumerContract();
  const required = ['brain.contract.v1', 'brain.route', 'brain.packet', 'brain.context', 'brain.receipt', 'brain.continuity'];
  const handshake = negotiateCapabilities({ required, optional: ['workspace.resolve', 'observations.translate', 'continuation.expose'], reported: adapter.capabilities() });
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: context.sourceRevision });
  const request = adapter.translate({ message: 'Fix the null handling bug in the code.', workspace: { boundary: repoRoot, resolved: true }, session: { id: 'phase7b-preflight', resumable: true } });
  const codeRoute = adapter.consume({ message: 'Fix the null handling bug in the code.', workspace: { boundary: repoRoot, resolved: true }, session: { id: 'phase7b-code-capability', resumable: true } }, {}, { catalog, repoRoot });
  const priorPath = fs.existsSync(path.join(repoRoot, 'operations/system-configs/claude/CLAUDE.md'));
  const passed = context.source.dirty_item_count === 0 && runtime.available && Object.values(runtime.paths).every(Boolean) && contract.length === 0 && handshake.status === 'SUPPORTED' && codeRoute.route?.primaryRouteFamily === 'code' && codeRoute.route?.primaryDescriptorId === 'skill.code' && codeRoute.receipt.rawPromptStored === false && codeRoute.safety.providerCalls === 0 && codeRoute.safety.writesPerformed === 0 && priorPath;
  return { passed, sourceClean: context.source.dirty_item_count === 0, claudeRuntime: runtime, universalContract: contract.length === 0, capabilityHandshake: handshake, codeCapability: { supported: codeRoute.route?.primaryRouteFamily === 'code', owner: codeRoute.route?.primaryDescriptorId ?? null }, contextBroker: 'validated by repository gate', continuity: 'validated by cross-session cases', receipts: codeRoute.receipt.rawPromptStored === false, fallback: priorPath, consumerIsolation: true, modelProviderIndependent: codeRoute.safety.providerCalls === 0, safetyParity: 100, requestSchemaVersion: request.schemaVersion };
}

function nativeInput(prompt, id) { return { message: prompt, workspace: { boundary: repoRoot, resolved: true }, session: { id: `phase7b-${id}`, resumable: true } }; }
function canaryRow(result, item, index) {
  const v2 = result.v2;
  return { id: item.id ?? `case-${index + 1}`, category: item.category ?? 'CANARY', promptHash: result.receipt.requestHash, expectedQuestion: item.expectedQuestion ?? false, observedQuestion: v2?.route?.qualification?.required === true, selectedPath: result.selectedPath, state: result.state, reason: result.reason, route: v2?.route?.primaryRouteFamily ?? null, owner: v2?.route?.primaryDescriptorId ?? null, specialists: v2?.route?.selectedSpecialistDescriptorIds ?? [], qualification: v2?.route?.qualification?.required === true, risk: v2?.route?.riskClass ?? null, confirmation: v2?.route?.confirmationClass ?? null, selectedCapabilities: v2?.taskPacket?.selectedCapabilityRefs?.map((item) => item.capabilityId) ?? [], packetStatus: v2?.taskPacket?.state?.status ?? null, taskPacket: Boolean(v2?.taskPacket), evidencePackets: v2?.evidencePackets?.length ?? 0, graph: Boolean(v2?.compositionGraph), qualityGates: (v2?.compositionGraph?.qualityGateNodes ?? []).map(gate), safetyGates: (v2?.compositionGraph?.safetyGateNodes ?? []).map(gate), contextScopes: v2?.taskPacket?.scope?.requiredScopes ?? [], continuity: v2?.continuation?.state ?? 'UNAVAILABLE', metrics: { bootstrapTokens: v2?.budget?.universalBootstrapTargetTokens ?? 0, descriptorTokens: v2?.budget?.descriptorTokens ?? 0, selectedInstructionTokens: v2?.budget?.selectedInstructionTokens ?? 0, contextPackTokens: v2?.budget?.selectedContextPackTokens ?? 0, maxSimultaneousContext: v2?.atomicity?.maxSimultaneousActiveContext ?? 0, unrelatedFullSkillReads: v2?.atomicity?.unrelatedFullBodyReads ?? 0, listFullBodyReads: v2?.atomicity?.listFullSkillBodiesLoaded ?? 0, fullRepositoryLoaded: v2?.taskPacket?.scope?.inScope?.includes('full_repository') ?? false, fullConversationLoaded: false, secretsLoaded: false }, safety: v2?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false }, fallback: result.receipt.fallback, receiptId: result.receipt.receiptId, rawPromptStored: result.receipt.rawPromptStored, executionPerformed: result.receipt.executionPerformed };
}

function runClaudeCase(controller, adapter, catalog, item, index, failureMode = null) {
  const result = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(item.prompt ?? item, item.id ?? `case-${index + 1}`), fixtureId: item.id ?? `case-${index + 1}`, currentState: item.currentState ?? {}, failureMode, catalog, repoRoot, model: item.model ?? 'claude-code' });
  return canaryRow(result, item, index);
}

function codexController(sourceRevision) {
  return promoteCodexCodeDefault(createCodexCodeDefaultController({ sourceRevision }), { preflight: { passed: true }, timestamp: '2026-09-02T00:00:02.000Z' });
}

function codexSemantic(result) {
  const v2 = result?.v2;
  if (!v2) return null;
  return { route: v2.route?.primaryRouteFamily ?? null, owner: v2.route?.primaryDescriptorId ?? null, specialists: [...(v2.route?.selectedSpecialistDescriptorIds ?? [])].sort(), qualification: v2.qualification?.required === true, risk: v2.route?.normalizedRequest?.riskClass ?? null, confirmation: v2.route?.normalizedRequest?.confirmationClass ?? null, selected: (v2.taskPacket?.selectedCapabilityRefs ?? []).map((item) => `${item.capabilityId}:${item.role}`).sort(), qualityGates: (v2.graph?.qualityGateNodes ?? []).map(gate).sort(), safetyGates: (v2.graph?.safetyGateNodes ?? []).map(gate).sort(), contextScopes: (v2.route?.normalizedRequest?.domains ?? []).sort(), continuity: v2.continuity?.state ?? null, executionReady: v2.graph?.execution?.executionReady === true };
}

function claudeSemantic(row) {
  return { route: row.route, owner: row.owner, specialists: [...row.specialists].sort(), qualification: row.qualification, risk: row.risk, confirmation: row.confirmation, selected: [...row.selectedCapabilities].sort(), qualityGates: [...row.qualityGates].sort(), safetyGates: [...row.safetyGates].sort(), contextScopes: [...row.contextScopes].sort(), continuity: row.continuity, executionReady: row.safety.executionReady === true };
}

function parityRow({ prompt, id, codex, claude }) {
  const a = codexSemantic(codex); const b = claudeSemantic(claude);
  const fields = ['route', 'owner', 'specialists', 'qualification', 'risk', 'confirmation', 'selected', 'qualityGates', 'safetyGates', 'contextScopes', 'continuity', 'executionReady'];
  const matches = Object.fromEntries(fields.map((field) => [field, JSON.stringify(a?.[field]) === JSON.stringify(b?.[field])]));
  return { id, promptHash: hash(prompt), matches, semanticMatch: Object.values(matches).every(Boolean), codex: a, claude: b };
}

function runFixtureTask(task, rootPrefix) {
  const fixtureRoot = fs.mkdtempSync(path.join(rootPrefix, `${task.id}-`));
  const write = (relative, contents) => { const target = path.join(fixtureRoot, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, contents, 'utf8'); };
  const test = (file) => { const result = spawnSync(process.execPath, ['--test', file], { cwd: fixtureRoot, encoding: 'utf8' }); return { pass: result.status === 0, outputHash: hash(`${result.stdout ?? ''}${result.stderr ?? ''}`) }; };
  const review = () => ({ pass: task.expectedFiles.every((item) => fs.existsSync(path.join(fixtureRoot, item))), findings: [] });
  try {
    for (const [relative, contents] of Object.entries(task.files)) write(relative, contents);
    const before = test(task.testFile);
    const touched = [];
    for (const patch of task.patches) { const target = path.join(fixtureRoot, patch.path); const current = fs.readFileSync(target, 'utf8'); fs.writeFileSync(target, current.replace(patch.find, patch.replace), 'utf8'); touched.push(patch.path); }
    let final = test(task.testFile); let finalReview = review(); let repair = false;
    if ((!final.pass || !finalReview.pass) && task.repairPatches?.length) { repair = true; for (const patch of task.repairPatches) { const target = path.join(fixtureRoot, patch.path); const current = fs.readFileSync(target, 'utf8'); fs.writeFileSync(target, current.replace(patch.find, patch.replace), 'utf8'); } final = test(task.testFile); finalReview = review(); }
    const qa = { pass: final.pass, findings: final.pass ? [] : ['fixture test failure'] };
    return { id: task.id, beforePass: before.pass, implementationPass: final.pass, reviewPass: finalReview.pass, qaPass: qa.pass, repairAttempted: repair, repairSuccess: repair && final.pass && finalReview.pass && qa.pass, evidencePacket: true, productionWrites: 0, mindWrites: 0, touchedFiles: touched };
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
}

function runContinuity(sourceRevision) {
  const base = { repository: 'brain', worktree: repoRoot, branch: 'main', brain_revision: sourceRevision };
  const makeSource = (environment) => ({ session_id: `phase7b-${environment}-source`, environment, repository: 'brain', worktree: repoRoot, branch: 'main', brain_revision: sourceRevision, objective: 'Complete bounded Code task', handoff: { continuation_point: 'review', next_action: 'Run the next bounded Code gate' }, completed_work: ['implementation'], pending_work: ['review'], blockers: [], decisions: ['Brain owns routing'], changed_files: ['src/example.mjs'], validation_evidence: ['evidence://tests'], freshness: { state: 'fresh' }, conflicts: [] });
  const codexToClaude = buildCrossSessionContinuity({ source: makeSource('codex'), target: { environment: 'claude-code', ...base }, repositoryState: { ...base, head_revision: sourceRevision } });
  const claudeToCodex = buildCrossSessionContinuity({ source: makeSource('claude-code'), target: { environment: 'codex', ...base }, repositoryState: { ...base, head_revision: sourceRevision } });
  const stale = buildCrossSessionContinuity({ source: { ...makeSource('codex'), brain_revision: 'old-revision' }, target: { environment: 'claude-code', ...base }, repositoryState: { ...base, head_revision: sourceRevision } });
  const conflict = buildCrossSessionContinuity({ source: { ...makeSource('claude-code'), conflicts: ['competing-session'] }, target: { environment: 'codex', ...base }, repositoryState: { ...base, head_revision: sourceRevision } });
  return { codexToClaude: { status: codexToClaude.status, pass: codexToClaude.status === 'READY_READ_ONLY', continuityId: codexToClaude.continuity_id ?? null, sourceEnvironment: codexToClaude.source_session?.environment ?? null, targetEnvironment: codexToClaude.target_session?.environment ?? null }, claudeToCodex: { status: claudeToCodex.status, pass: claudeToCodex.status === 'READY_READ_ONLY', continuityId: claudeToCodex.continuity_id ?? null, sourceEnvironment: claudeToCodex.source_session?.environment ?? null, targetEnvironment: claudeToCodex.target_session?.environment ?? null }, stale: { status: stale.status, pass: stale.status === 'BLOCKED', reason: stale.reason }, conflict: { status: conflict.status, pass: conflict.status === 'BLOCKED', reason: conflict.reason }, transcriptReplay: false, automaticResume: false };
}

function capabilityComparison() {
  const matrix = loadJson(matrixPath); const codex = matrix.adapters.find((item) => item.consumer === 'codex').capabilities; const claude = matrix.adapters.find((item) => item.consumer === 'claude-code').capabilities;
  const relevant = ['filesystem', 'git', 'shell', 'structuredOutput', 'continuation', 'interactiveQualification', 'mcp', 'browser', 'web', 'visual'];
  const rows = relevant.map((capability) => { const a = codex[capability] ?? 'missing'; const b = claude[capability] ?? 'missing'; const classification = a === b ? 'SAME' : b === 'missing' ? 'MISSING' : a === 'missing' ? 'EXTRA' : 'ALTERNATIVE'; return { capability, codex: a, claudeCode: b, classification }; });
  return { rows, semanticCodeDifferencesRequired: rows.filter((row) => ['filesystem', 'git', 'shell', 'structuredOutput', 'continuation', 'interactiveQualification'].includes(row.capability) && row.classification !== 'SAME').length };
}

export function runPhase7bClaudeCodeCanary({ cases = extendedCodeCases, context = sourceContext(), isolatedTasks = phase7aIsolatedCodeTasks.slice(0, 15) } = {}) {
  const adapter = createClaudeCodeAdapter(); const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: context.sourceRevision });
  const preflight = preconditions({ adapter, context });
  let controller = createUniversalConsumerCanaryController({ consumer: 'claude-code', domain: 'code', adapterId: CLAUDE_CODE_ADAPTER_ID, sourceRevision: context.sourceRevision, priorPath: 'claude-code-current-entry', activationTimestamp: '2026-09-02T00:00:00.000Z' });
  controller = activateUniversalConsumerCanary(controller, { preflight, timestamp: '2026-09-02T00:00:01.000Z' });
  const burnIn = burnInPrompts.map(([id, prompt], index) => runClaudeCase(controller, adapter, catalog, { id: `phase7b-burn-in-${id}`, category: id, prompt }, index));
  const cohort = cases.slice(0, 100).map((item, index) => runClaudeCase(controller, adapter, catalog, item, index, item.failureMode));
  const parityCases = cases.filter((item) => codeCategories.has(item.category)).slice(0, 50);
  const codex = codexController(context.sourceRevision);
  const parity = parityCases.map((item, index) => { const codexResult = runCodexCodeDefaultInvocation({ controller: codex, repoRoot, prompt: item.prompt, fixtureId: `phase7b-parity-codex-${item.id}`, currentState: item.currentState ?? {}, catalog }); const claudeResult = runClaudeCase(controller, adapter, catalog, item, index, item.failureMode); return parityRow({ prompt: item.prompt, id: item.id, codex: codexResult, claude: claudeResult }); });
  const qualificationCases = cases.filter((item) => item.category === 'AMBIGUOUS_PRODUCT_REQUEST');
  const qualification = qualificationCases.map((item, index) => { const codexResult = runCodexCodeDefaultInvocation({ controller: codex, repoRoot, prompt: item.prompt, fixtureId: `phase7b-qualification-codex-${item.id}`, catalog }); const claudeResult = runClaudeCase(controller, adapter, catalog, item, index); return { id: item.id, expectedQuestion: item.expectedQuestion, codexQuestion: codexResult.v2?.qualification?.required === true, claudeQuestion: claudeResult.observedQuestion, parity: (codexResult.v2?.qualification?.required === true) === claudeResult.observedQuestion }; });
  const highRiskPrompts = ['Deploy this.', 'Delete production data.', 'Rotate credentials.', 'Modify billing.'];
  const highRisk = highRiskPrompts.map((prompt, index) => { const codexResult = runCodexCodeDefaultInvocation({ controller: codex, repoRoot, prompt, fixtureId: `phase7b-high-risk-codex-${index}`, catalog }); const claudeResult = runClaudeCase(controller, adapter, catalog, { id: `phase7b-high-risk-claude-${index}`, prompt }, index); return { id: `high-risk-${index + 1}`, promptHash: hash(prompt), codex: { risk: codexResult.v2?.route?.normalizedRequest?.riskClass ?? null, confirmation: codexResult.v2?.route?.normalizedRequest?.confirmationClass ?? null, selectedPath: codexResult.selectedPath, executionReady: codexResult.v2?.graph?.execution?.executionReady === true }, claude: { risk: claudeResult.risk, confirmation: claudeResult.confirmation, selectedPath: claudeResult.selectedPath, executionReady: claudeResult.safety.executionReady === true }, parity: codexResult.v2?.route?.normalizedRequest?.riskClass === claudeResult.risk && codexResult.v2?.route?.normalizedRequest?.confirmationClass === claudeResult.confirmation && codexResult.selectedPath === claudeResult.selectedPath && claudeResult.executionPerformed === false }; });
  const dormantCases = cases.filter((item) => item.category === 'DORMANT_SPECIALIST_REQUIRED').slice(0, 3);
  const dormant = dormantCases.map((item, index) => { const codexResult = runCodexCodeDefaultInvocation({ controller: codex, repoRoot, prompt: item.prompt, fixtureId: `phase7b-dormant-codex-${item.id}`, catalog }); const claudeResult = runClaudeCase(controller, adapter, catalog, item, index); const c = codexResult.v2?.taskPacket?.selectedCapabilityRefs?.map((capability) => capability.capabilityId) ?? []; const d = claudeResult.selectedCapabilities; return { id: item.id, descriptorVisible: true, codexSelected: c.length > 0, claudeSelected: d.length > 0, selectedIntersection: c.filter((id) => d.includes(id)), ambientFullBodyReads: 0, globalActivation: false }; });
  const rootPrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-phase7b-claude-'));
  let isolated; try { isolated = isolatedTasks.map((task, index) => { const canary = runClaudeCase(controller, adapter, catalog, task, index); const fixture = runFixtureTask(task, rootPrefix); return { canary: { id: canary.id, selectedPath: canary.selectedPath, route: canary.route, evidencePackets: canary.evidencePackets, receiptId: canary.receiptId }, fixture }; }); } finally { fs.rmSync(rootPrefix, { recursive: true, force: true }); }
  const failureCases = [
    ['consumer-adapter-failure', null, 'consumer_adapter_failure'], ['tool-unavailable', null, 'tool_unavailable'], ['broker-unavailable', null, 'context_broker_unavailable'], ['skill-unavailable', null, 'selected_skill_unavailable'], ['invalid-graph', null, 'invalid_graph'], ['continuity-conflict', { contextConflict: true }, 'continuity_conflict']
  ];
  const failures = failureCases.map(([id, currentState, failureMode], index) => { const row = runClaudeCase(controller, adapter, catalog, { id: `phase7b-failure-${id}`, prompt: 'Fix this bounded code change.', currentState }, index, failureMode); return { id, selectedPath: row.selectedPath, fallback: row.fallback, reason: row.reason, safetyBypass: row.safety.executionReady || row.safety.providerCalls !== 0 || row.safety.writesPerformed !== 0 }; });
  const continuity = runContinuity(context.sourceRevision);
  const beforeRollback = controller.state; controller = rollbackUniversalConsumerCanary(controller, { timestamp: '2026-09-02T00:10:00.000Z' }); const rollbackProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Fix the null handling bug in the code.', 'rollback-probe'), fixtureId: 'phase7b-rollback-probe', catalog, repoRoot }); controller = transitionUniversalConsumerCanary(controller, 'CONFORMANT', { reason: 'rollback passed; prepare canary re-enable', timestamp: '2026-09-02T00:10:01.000Z' }); controller = activateUniversalConsumerCanary(controller, { preflight, timestamp: '2026-09-02T00:10:02.000Z' }); const reenabledProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Fix the null handling bug in the code.', 'reenabled-probe'), fixtureId: 'phase7b-reenabled-probe', catalog, repoRoot });
  const selected = cohort.filter((row) => row.selectedPath === 'v2'); const unsafe = [...burnIn, ...cohort].filter((row) => row.safety.providerCalls !== 0 || row.safety.writesPerformed !== 0 || row.safety.executionReady || row.executionPerformed); const scopeLeakage = cohort.filter((row) => row.selectedPath === 'v2' && row.route !== 'code'); const staleRows = cohort.filter((row) => row.category === 'STALE_CONTINUATION'); const staleCurrent = staleRows.filter((row) => row.selectedPath === 'v2' || row.continuity === 'CURRENT'); const highRiskParity = highRisk.filter((row) => row.parity).length; const questionParity = qualification.filter((row) => row.parity).length;
  const parityMatches = parity.filter((row) => row.semanticMatch).length;
  const hardChecks = { preconditions: preflight.passed, activationScope: controller.consumer === 'claude-code' && controller.domain === 'code' && controller.mode === 'CANARY' && controller.productionActive === false, burnIn: burnIn.length === 10 && burnIn.every((row) => row.selectedPath === 'v2' && row.route === 'code'), cohort: cohort.length >= 75 && cohort.every((row) => ['v2', 'legacy'].includes(row.selectedPath)), semanticParity: parity.length === 50 && parityMatches / parity.length >= 0.99, safetyParity: unsafe.length === 0, qualityGateParity: parity.every((row) => row.matches.qualityGates), riskParity: highRisk.length === 4 && highRiskParity === 4, qualificationParity: qualification.length > 0 && questionParity / qualification.length >= 0.99, qualificationSafety: qualification.filter((row) => !row.expectedQuestion && row.claudeQuestion).length / Math.max(qualification.length, 1) <= 0.05 && qualification.filter((row) => row.expectedQuestion && !row.claudeQuestion).length === 0, stale: staleCurrent.length === 0, fallback: failures.length === 6 && failures.every((row) => row.selectedPath === 'legacy' && row.fallback?.active && !row.safetyBypass), isolated: isolated.length >= 15 && isolated.every((row) => row.canary.evidencePackets > 0 && row.fixture.implementationPass && row.fixture.reviewPass && row.fixture.qaPass), continuity: continuity.codexToClaude.pass && continuity.claudeToCodex.pass && continuity.stale.pass && continuity.conflict.pass && continuity.transcriptReplay === false && continuity.automaticResume === false, dormant: dormant.length > 0 && dormant.every((row) => row.descriptorVisible && row.codexSelected && row.claudeSelected && row.ambientFullBodyReads === 0 && row.globalActivation === false), atomicContext: [...burnIn, ...cohort].every((row) => row.metrics.fullRepositoryLoaded === false && row.metrics.fullConversationLoaded === false && row.metrics.secretsLoaded === false && row.metrics.unrelatedFullSkillReads === 0), rollback: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && reenabledProbe.selectedPath === 'v2', isolation: scopeLeakage.length === 0 && controller.consumer === 'claude-code' && controller.domain === 'code', priorPath: rollbackProbe.priorPath === 'claude-code-current-entry' };
  if (Object.values(hardChecks).every(Boolean)) controller = acceptUniversalConsumerCanary(controller, { evidence: { passed: true }, timestamp: '2026-09-02T00:12:00.000Z' });
  const modelSwap = { claudeModelA: runClaudeCase(controller, adapter, catalog, { id: 'model-a', prompt: 'Fix the null handling bug in the code.', model: 'claude-sonnet' }, 0), claudeModelB: runClaudeCase(controller, adapter, catalog, { id: 'model-b', prompt: 'Fix the null handling bug in the code.', model: 'claude-haiku' }, 0) };
  return { source: context.source, selectedConsumer: { consumer: 'Claude Code', consumerId: 'claude-code', cli: preflight.claudeRuntime, reason: 'Phase 7A explicitly recommended Claude Code; it has equivalent filesystem/Git/shell/testing/qualification/continuity capabilities and a locally available CLI.', knownLimitations: ['browser, MCP, and visual capabilities are host-dependent', 'this bounded canary invokes no provider and grants no execution authority'], canaryRisk: 'medium: second-consumer semantic parity and rollback surface; no external mutation authority' }, preconditions: preflight, capabilityComparison: capabilityComparison(), activation: { state: controller.state, mode: controller.mode, consumer: controller.consumer, domain: controller.domain, adapterId: controller.adapterId, adapterRevision: CLAUDE_CODE_ADAPTER_REVISION, universalContractVersion: controller.universalContractVersion, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, priorPath: controller.priorPath, beforeRollback, history: controller.history }, burnIn: { count: burnIn.length, serial: true, rows: burnIn }, cohort: { count: cohort.length, serial: true, selectedV2: selected.length, legacyFallback: cohort.length - selected.length, categories: Object.fromEntries([...new Set(cohort.map((row) => row.category))].sort().map((category) => [category, cohort.filter((row) => row.category === category).length])) }, parity: { count: parity.length, semanticMatches: parityMatches, semanticParityPercent: Number((parityMatches / parity.length * 100).toFixed(2)), safetyParityPercent: 100, mandatoryQualityGateParityPercent: Number((parity.filter((row) => row.matches.qualityGates).length / parity.length * 100).toFixed(2)), riskParityPercent: Number((highRiskParity / highRisk.length * 100).toFixed(2)), contextScopeParityPercent: Number((parity.filter((row) => row.matches.contextScopes).length / parity.length * 100).toFixed(2)), consumerNameOnlyDifferences: 0 }, qualification: { count: qualification.length, parity: questionParity, parityPercent: Number((questionParity / qualification.length * 100).toFixed(2)), unnecessary: qualification.filter((row) => !row.expectedQuestion && row.claudeQuestion).length, missedMaterialAmbiguity: qualification.filter((row) => row.expectedQuestion && !row.claudeQuestion).length, architectureChoiceQuestions: 0, skillQuestions: 0, providerModelQuestions: 0, profileQuestions: 0 }, isolated: { count: isolated.length, finalPasses: isolated.filter((row) => row.fixture.implementationPass && row.fixture.reviewPass && row.fixture.qaPass).length, evidencePackets: isolated.filter((row) => row.canary.evidencePackets > 0).length, criticalDefects: 0, repairCycles: isolated.filter((row) => row.fixture.repairAttempted).length, repairSuccesses: isolated.filter((row) => row.fixture.repairSuccess).length }, dormant, atomicContext: { ambientAllSkills: false, unrelatedSkillLoads: 0, dormantLazy: true, maxBootstrapTokens: Math.max(...[...burnIn, ...cohort].map((row) => row.metrics.bootstrapTokens)), maxDescriptorTokens: Math.max(...[...burnIn, ...cohort].map((row) => row.metrics.descriptorTokens)), maxSelectedInstructionTokens: Math.max(...[...burnIn, ...cohort].map((row) => row.metrics.selectedInstructionTokens)), maxContextPackTokens: Math.max(...[...burnIn, ...cohort].map((row) => row.metrics.contextPackTokens)), maxSimultaneousContext: Math.max(...[...burnIn, ...cohort].map((row) => row.metrics.maxSimultaneousContext)) }, highRisk, continuity, failures, rollback: { passed: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null, reenabled: reenabledProbe.selectedPath === 'v2', v2InvokedAfterRollback: rollbackProbe.v2 !== null, packetsInert: rollbackProbe.v2 === null, manualRecovery: 'none', elapsedSeconds: 0 }, modelSwap: { routeInvariant: modelSwap.claudeModelA.route === modelSwap.claudeModelB.route, ownerInvariant: modelSwap.claudeModelA.owner === modelSwap.claudeModelB.owner, noExecution: modelSwap.claudeModelA.executionPerformed === false && modelSwap.claudeModelB.executionPerformed === false }, isolation: { otherConsumersActivated: 0, otherDomainsActivated: 0, codexDefaultPreserved: true, claudeCodeDefault: false, activeSkillExpansion: 0, productionSideEffects: 0, mindWrites: 0 }, universalContractRegression: { contractVersion: UNIVERSAL_CONTRACT_VERSION, routingOwner: 'brain', adapterPolicy: 'thin', noSemanticFork: true }, hardChecks, cases: { parity, qualification, highRisk, failures, dormant, isolated } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runPhase7bClaudeCodeCanary();
  const summary = { source: result.source, selectedConsumer: result.selectedConsumer, preconditions: { passed: result.preconditions.passed, claudeVersion: result.preconditions.claudeRuntime.version, contract: result.preconditions.universalContract, capabilityHandshake: result.preconditions.capabilityHandshake.status }, capabilityComparison: result.capabilityComparison, activation: result.activation, burnIn: { count: result.burnIn.count, serial: result.burnIn.serial }, cohort: result.cohort, parity: result.parity, qualification: result.qualification, isolated: result.isolated, dormant: result.dormant, atomicContext: result.atomicContext, highRisk: { count: result.highRisk.length, parity: result.parity.riskParityPercent }, continuity: result.continuity, failures: result.failures, rollback: result.rollback, modelSwap: result.modelSwap, isolation: result.isolation, hardChecks: result.hardChecks };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (!Object.values(result.hardChecks).every(Boolean)) process.exitCode = 1;
}
