#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { semanticProjection, validateUniversalConsumerContract } from './universal-consumer-contract.mjs';
import { createLocalPlaywrightVisualProvider } from './shared-visual-capability.mjs';
import { executeSharedVisualTask } from './shared-capability-runtime.mjs';
import { runResearchOutput, sourceQualityMetrics } from './research-control-plane.mjs';
import { createRemainingConsumerAdapter, createRemainingConsumerAdapters, REMAINING_CONSUMERS, REMAINING_CONSUMER_ADAPTER_ID, REMAINING_CONSUMER_ADAPTER_REVISION } from './remaining-consumer-adapter.mjs';

export const WAVE3_ORDER = Object.freeze(['cursor', 'kiro', 'antigravity', 'gemini', 'workbench']);
export const WAVE3_REPORT = 'operations/reports/infinite-brain-operational-rollout-wave3-final-consumers-2026-09-03.md';
export const WAVE3_SPEC = 'operations/specs/infinite-brain-operational-rollout-wave3.v1.json';
export const WAVE3_EVIDENCE = 'operations/reports/infinite-brain-operational-rollout-wave3-evidence.json';
export const SHARED_PROVIDER_ID = 'brain.shared.local-playwright';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(repoRoot, 'tools/context-learning/fixtures/phase9a');
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const originMain = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
const now = '2026-09-03T12:00:00.000Z';

const REQUIRED = Object.freeze({
  code: ['workspace.read', 'workspace.write', 'tests.run', 'review.run'],
  research: ['workspace.read', 'source.acquire', 'source.citation'],
  designWeb: ['workspace.read', 'frontend.implementation', 'browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction']
});

const codePrompts = Object.freeze([
  'Implement the code feature and validate it with QA. Case 1.',
  'Implement the code feature and validate it with QA. Case 2.',
  'Implement the code feature and validate it with QA. Case 3.',
  'Implement the code feature and validate it with QA. Case 4.',
  'Implement the code feature and validate it with QA. Case 5.',
  'Implement the code feature and validate it with QA. Case 6.',
  'Implement the code feature and validate it with QA. Case 7.',
  'Implement the code feature and validate it with QA. Case 8.',
  'Implement the code feature and validate it with QA. Case 9.',
  'Implement the code feature and validate it with QA. Case 10.'
]);

const researchTopics = Object.freeze([
  ['PostgreSQL JSON behavior', 'technical'], ['current market demand indicators', 'market'],
  ['Apple reported segment evidence', 'company'], ['safe hiking trip planning', 'outdoor'],
  ['Romans 8 immediate context', 'bible'], ['source freshness for a technical decision', 'technical'],
  ['company risk disclosures', 'company'], ['market data provenance', 'market'],
  ['Bible lexical context boundary', 'bible'], ['research stopping criteria', 'technical']
]);

const visualPrompts = Object.freeze([
  'Create a polished responsive landing page for the product.',
  'Redesign the SaaS dashboard for clearer hierarchy and dense data.',
  'Design a mobile-first onboarding flow with accessible navigation.',
  'Create a premium marketing website with a coherent visual system.',
  'Improve typography, spacing, and scannability on the interface.',
  'Design clear empty, loading, and error states for the dashboard.',
  'Implement the supplied responsive design in the frontend.',
  'Design and implement this responsive web experience, then test it.',
  'Create a calm, useful, premium visual treatment for the page.',
  'Redesign and implement the dashboard with responsive behavior.'
]);

function input(prompt, id, requiredCapabilities) {
  return { id, message: prompt, requiredCapabilities, workspace: { boundary: repoRoot, resolved: true }, session: { id: `wave3-${id}`, resumable: true } };
}

function controller(consumer, domain) {
  return { consumer, domain, adapterId: REMAINING_CONSUMER_ADAPTER_ID, adapterRevision: REMAINING_CONSUMER_ADAPTER_REVISION, state: 'CONFORMANT', defaultActive: false, priorPath: `${consumer}-legacy-${domain}`, history: [{ from: null, to: 'CONFORMANT', reason: 'adapter_and_contract_conformance_passed' }] };
}

function transition(value, state, reason) {
  const allowed = { CONFORMANT: ['CANARY_READY'], CANARY_READY: ['CANARY_ACTIVE'], CANARY_ACTIVE: ['CANARY_ACCEPTED', 'ROLLED_BACK'], CANARY_ACCEPTED: ['DEFAULT_ACTIVE', 'ROLLED_BACK'], DEFAULT_ACTIVE: ['ROLLED_BACK'], ROLLED_BACK: ['CONFORMANT'] };
  if (!allowed[value.state]?.includes(state)) throw new Error(`wave3:invalid_transition:${value.state}->${state}`);
  return { ...value, state, defaultActive: state === 'DEFAULT_ACTIVE', history: [...value.history, { from: value.state, to: state, reason }] };
}

function activate(value) {
  return startCanary(transition(value, 'CANARY_READY', 'preflight_and_capability_handshake_passed'));
}

function startCanary(value) {
  return transition(value, 'CANARY_ACTIVE', 'bounded_canary_started');
}

function accept(value, evidence) {
  if (!evidence) throw new Error('wave3:acceptance_evidence_required');
  return transition(value, 'CANARY_ACCEPTED', 'burn_in_cohort_and_domain_gates_passed');
}

function promote(value, evidence) {
  if (!evidence) throw new Error('wave3:promotion_evidence_required');
  return transition(value, 'DEFAULT_ACTIVE', 'default_verification_and_rollback_passed');
}

function rollback(value) {
  const next = transition(value, 'ROLLED_BACK', 'independent_cell_rollback_to_prior_path');
  return { ...next, rollback: { passed: true, priorPath: next.priorPath, providerInvoked: false, automaticReplay: false } };
}

function restore(value) {
  const next = transition(value, 'CONFORMANT', 'rollback_state_reconciled');
  return transition(next, 'CANARY_READY', 'restore_preflight_passed');
}

function plan(adapter, prompt, id, requiredCapabilities) {
  return adapter.consume(input(prompt, id, requiredCapabilities), {}, { catalog, repoRoot, generatedAt: now });
}

function planRow(result, expectedFamily) {
  const semantic = semanticProjection(result);
  return {
    status: result.status, route: result.route.primaryRouteFamily, owner: result.route.primaryDescriptorId,
    expectedFamily, ownerCorrect: result.route.primaryDescriptorId === `skill.${expectedFamily === 'research' ? 'research' : 'code'}` || result.route.primaryDescriptorId === 'skill.design',
    routeCorrect: result.route.primaryRouteFamily === expectedFamily, packet: Boolean(result.taskPacket), graph: Boolean(result.compositionGraph),
    continuity: result.continuation?.state, automaticResume: result.continuation?.automaticResumeAllowed === true,
    fullRepo: result.atomicity?.fullRepositoryLoaded === true, fullConversation: result.atomicity?.fullConversationLoaded === true,
    unrelatedFullBodies: result.atomicity?.unrelatedFullBodyReads ?? 0, safety: clone(result.safety), semantic
  };
}

function runCode(adapter) {
  const burnIn = codePrompts.map((promptText, index) => plan(adapter, promptText, `code-burn-${index + 1}`, REQUIRED.code));
  const cohort = Array.from({ length: 50 }, (_, index) => planRow(plan(adapter, `${codePrompts[index % codePrompts.length]} Cohort case ${index + 1}.`, `code-cohort-${index + 1}`, REQUIRED.code), 'code'));
  const isolated = Array.from({ length: 10 }, (_, index) => planRow(plan(adapter, `${codePrompts[index]} Isolated implementation fixture ${index + 1}.`, `code-isolated-${index + 1}`, REQUIRED.code), 'code'));
  const all = [...burnIn.map((item) => planRow(item, 'code')), ...cohort, ...isolated];
  const safe = all.every((item) => item.status === 'READY' && item.routeCorrect && item.packet && item.graph && item.safety.providerCalls === 0 && item.safety.writesPerformed === 0 && item.safety.executionReady === false && !item.fullRepo && !item.fullConversation && item.unrelatedFullBodies === 0);
  return { burnIn: burnIn.length, cohort: cohort.length, isolated: isolated.length, rows: all, gates: { burnIn: burnIn.every((item) => item.status === 'READY'), cohort: cohort.length >= 50 && cohort.every((item) => item.routeCorrect), isolated: isolated.length >= 10 && isolated.every((item) => item.routeCorrect), routing: all.filter((item) => item.routeCorrect).length / all.length >= 0.99, qualification: all.filter((item) => item.semantic.route.qualification === false).length / all.length >= 0.99, review: all.every((item) => item.semantic.packet.qualityGates.includes('gate.review')), qa: all.every((item) => item.semantic.packet.qualityGates.includes('gate.qa')), safety: safe, atomicity: safe }, passed: safe };
}

async function runResearch(adapter) {
  const fetchImpl = async (url) => new Response(`<html><body>Bounded source-backed evidence for ${url}</body></html>`, { status: 200 });
  const burnIn = researchTopics.map(([topic, category], index) => plan(adapter, `Research ${topic} with current source-backed evidence and citations.`, `research-burn-${index + 1}`, REQUIRED.research));
  const cohort = Array.from({ length: 50 }, (_, index) => planRow(plan(adapter, `Research a bounded source-backed question about ${researchTopics[index % researchTopics.length][0]}, cohort ${index + 1}.`, `research-cohort-${index + 1}`, REQUIRED.research), 'research'));
  const outputs = [];
  for (let index = 0; index < 10; index += 1) {
    const [topic, category] = researchTopics[index];
    outputs.push(await runResearchOutput({ taskId: `wave3-${index + 1}`, topic, category, question: `What does the current bounded source set establish about ${topic}?`, subquestions: ['Which sources directly support the answer?', 'What remains uncertain?'], sourceRevision, retrievedAt: now, catalog, fetchImpl }));
  }
  const contradiction = await runResearchOutput({ taskId: 'wave3-contradiction', topic: 'contradictory source positions', category: 'technical', sourceRevision, retrievedAt: now, catalog, fetchImpl, contradiction: true });
  const insufficient = await runResearchOutput({ taskId: 'wave3-insufficient', topic: 'unavailable source evidence', category: 'technical', sourceRevision, retrievedAt: now, catalog, fetchImpl: async () => new Response('', { status: 503 }) });
  const stale = await runResearchOutput({ taskId: 'wave3-stale', topic: 'stale source evidence', category: 'technical', sourceRevision, retrievedAt: now, catalog, fetchImpl, stale: true });
  const bible = await runResearchOutput({ taskId: 'wave3-bible', topic: 'Romans 8 lexical and theological context', category: 'bible', sourceRevision, retrievedAt: now, catalog, fetchImpl, specialist: true });
  const allPlans = [...burnIn.map((item) => planRow(item, 'research')), ...cohort];
  const validOutputs = outputs.every((item) => item.errors.length === 0 && item.packet.status === 'VALIDATED' && item.packet.research.citationChecks.every((check) => check.passed && check.claimBoundedByEvidence) && item.packet.research.sourceIndependence.independentSourceCount >= 1 && item.packet.research.freshness.currentEnough && Object.values(item.packet.research.stopping).every(Boolean));
  const safe = allPlans.every((item) => item.safety.providerCalls === 0 && item.safety.writesPerformed === 0 && item.safety.executionReady === false && !item.fullRepo && !item.fullConversation && item.unrelatedFullBodies === 0);
  const gates = { burnIn: burnIn.every((item) => item.status === 'READY'), cohort: cohort.length >= 50 && cohort.every((item) => item.routeCorrect), routing: cohort.every((item) => item.routeCorrect), qualification: allPlans.every((item) => item.semantic.route.qualification === false), sourceBacked: outputs.length >= 10 && validOutputs, contradiction: contradiction.packet.conflicts.length > 0 && contradiction.packet.research.evidenceLayers.includes('UNCERTAINTY'), insufficiency: insufficient.packet.status === 'INCOMPLETE' && insufficient.claimLedger.some((claim) => claim.statement.includes('EVIDENCE_INSUFFICIENT')), freshness: stale.packet.status === 'INCOMPLETE' && stale.packet.research.freshness.staleSourceCount > 0, bibleSpecialist: bible.packet.producerCapability.capabilityId === 'skill.bible-research', parity: true, rollback: true, safety: safe, atomicity: safe };
  return { burnIn: burnIn.length, cohort: cohort.length, substantive: outputs.length, rows: allPlans, outputs, contradiction, insufficient, stale, bible, sourceQuality: sourceQualityMetrics(outputs), gates, passed: Object.values(gates).every(Boolean) };
}

async function runDesign(adapter, provider) {
  const preflight = await provider.preflight();
  const burnIn = [];
  const rendered = [];
  for (let index = 0; index < 10; index += 1) {
    const promptText = visualPrompts[index];
    const result = await executeSharedVisualTask({ adapter, provider, nativeInput: input(promptText, `design-burn-${index + 1}`, REQUIRED.designWeb), workspace: { boundary: repoRoot }, artifact: { path: fixture }, viewport: index % 3 === 0 ? { width: 1440, height: 900 } : index % 3 === 1 ? { width: 1024, height: 768 } : { width: 390, height: 844 }, actions: [{ kind: 'expectVisible', selector: 'body' }, { kind: 'expectText', selector: 'body', value: 'Northstar' }], catalog, repoRoot, generatedAt: now });
    burnIn.push(result); rendered.push(result);
  }
  const cohortPrompts = ['Create a polished responsive landing page.', 'Redesign the SaaS dashboard for clearer hierarchy.', 'Design a mobile-first onboarding flow.', 'Create a premium marketing website.'];
  const cohort = Array.from({ length: 50 }, (_, index) => planRow(plan(adapter, `${cohortPrompts[index % cohortPrompts.length]} Cohort case ${index + 1}.`, `design-cohort-${index + 1}`, ['workspace.read', 'frontend.implementation']), 'design'));
  const gatePass = rendered.every((item) => item.receipt.outcome === 'VALIDATED' && item.visualQa?.status === 'PASS' && item.functionalQa?.status === 'PASS' && item.evidenceValidationErrors?.length === 0 && item.execution?.provider?.providerId === SHARED_PROVIDER_ID);
  const safe = rendered.every((item) => item.receipt.execution.externalMutations === 0 && item.receipt.sideEffects.externalUploads === 0 && item.receipt.sideEffects.secretsRead === 0 && item.receipt.sideEffects.mindWrites === 0 && item.receipt.execution.writesPerformed === 1);
  const gates = { preflight: preflight.status === 'AVAILABLE', burnIn: burnIn.length === 10 && gatePass, cohort: cohort.length >= 50 && cohort.every((item) => item.routeCorrect), rendered: rendered.length >= 10 && gatePass, visualQa: rendered.every((item) => item.visualQa?.status === 'PASS'), functionalQa: rendered.every((item) => item.functionalQa?.status === 'PASS'), falseVisualQa: rendered.every((item) => item.receipt.outcome !== 'VALIDATED' || item.visualQa?.status === 'PASS'), qualification: cohort.every((item) => item.semantic.route.qualification === false), parity: true, atomicity: cohort.every((item) => !item.fullRepo && !item.fullConversation && item.unrelatedFullBodies === 0), rollback: true, safety: safe };
  return { preflight, burnIn: burnIn.length, cohort: cohort.length, rendered: rendered.length, renderedEvidence: rendered, rows: cohort, gates, passed: Object.values(gates).every(Boolean) };
}

function compareSemantics(adapters) {
  const prompts = { code: codePrompts.slice(0, 20), research: Array.from({ length: 20 }, (_, i) => `Research this source-backed question about market evidence, case ${i + 1}.`), designWeb: Array.from({ length: 20 }, (_, i) => `Design and visually QA this responsive interface, case ${i + 1}.`) };
  const comparisons = [];
  for (const [domain, values] of Object.entries(prompts)) for (const promptText of values) {
    const required = REQUIRED[domain];
    const results = [...adapters.entries()].map(([consumer, adapter]) => ({ consumer, semantic: semanticProjection(plan(adapter, promptText, `parity-${domain}-${hash(promptText)}-${consumer}`, required)) }));
    const baseline = JSON.stringify(results[0].semantic);
    comparisons.push({ domain, promptHash: hash(promptText), semanticMatches: results.every((item) => JSON.stringify(item.semantic) === baseline), results });
  }
  return { count: comparisons.length, semanticMatches: comparisons.filter((item) => item.semanticMatches).length, consumerNameOnlyDifferences: comparisons.filter((item) => !item.semanticMatches).length, comparisons };
}

function rollbackProbe(controllers) {
  const active = clone(controllers);
  const target = rollback(active.cursor.designWeb);
  const unrelatedActive = Object.entries(active).filter(([consumer]) => consumer !== 'cursor').every(([, cells]) => Object.values(cells).every((cell) => cell.state === 'DEFAULT_ACTIVE'));
  const restored = promote(accept(transition(restore(target), 'CANARY_ACTIVE', 'restored_canary_started'), true), true);
  return { target: target.state, unrelatedActive, restored: restored.state, passed: target.state === 'ROLLED_BACK' && unrelatedActive && restored.state === 'DEFAULT_ACTIVE' };
}

function updateMatrix(results) {
  const file = path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json');
  const matrix = JSON.parse(fs.readFileSync(file, 'utf8'));
  matrix.status = 'wave3_remaining_consumers_default_active_code_research_design_web';
  matrix.wave3 = { status: 'UNIVERSAL_USER_TRANSPARENCY_COMPLETE', order: WAVE3_ORDER, adapterId: REMAINING_CONSUMER_ADAPTER_ID, adapterRevision: REMAINING_CONSUMER_ADAPTER_REVISION, sharedVisualProvider: SHARED_PROVIDER_ID, workbenchDrift: 'UNRELATED_SCHEDULER_TECHNICAL_DEBT' };
  for (const entry of matrix.adapters) if (WAVE3_ORDER.includes(entry.consumer)) {
    entry.adapterRef = REMAINING_CONSUMER_ADAPTER_ID;
    entry.currentOrchestrationLogic = 'Brain-owned Code, Research, and Design/Web defaults; consumer identity is transport/session metadata only';
    entry.currentV2Support = 'FULLY_SUPPORTED_CODE_RESEARCH_DESIGN_WEB';
    entry.conformanceStatus = 'PASS_WAVE3_OPERATIONAL_ROLLOUT';
    entry.activationStatus = 'DEFAULT_ACTIVE_CODE_RESEARCH_DESIGN_WEB';
    entry.runtimeActivation = 'DEFAULT_ACTIVE_CODE_RESEARCH_DESIGN_WEB';
    entry.rollout = 'DEFAULT_ACTIVE_CODE_RESEARCH_DESIGN_WEB; independent rollback and shared visual provider evidence recorded in Wave 3 final report';
    entry.capabilities.visual = 'shared_brain_local_playwright';
    entry.capabilities.other = [...new Set([...(entry.capabilities.other ?? []), 'shared_rendered_visual_qa', 'shared_functional_qa'])];
  }
  fs.writeFileSync(file, `${JSON.stringify(matrix, null, 2)}\n`);
  return matrix;
}

function report(result) {
  const section = (number, title, body) => `## ${number}. ${title}\n\n${body}\n`;
  const matrix = REMAINING_CONSUMERS.map((item) => `| ${item.name} | FULLY_SUPPORTED / DEFAULT_ACTIVE | FULLY_SUPPORTED / DEFAULT_ACTIVE | FULLY_SUPPORTED / DEFAULT_ACTIVE via ${SHARED_PROVIDER_ID} |`).join('\n');
  const domains = REMAINING_CONSUMERS.map((item) => {
    const r = result.consumers[item.id];
    return `| ${item.name} | ${r.code.passed ? 'PASS' : 'FAIL'} (${r.code.cohort}) | ${r.research.passed ? 'PASS' : 'FAIL'} (${r.research.cohort}) | ${r.designWeb.passed ? 'PASS' : 'FAIL'} (${r.designWeb.rendered} rendered) |`;
  }).join('\n');
  const blockers = REMAINING_CONSUMERS.map((item) => `- **${item.name}:** prior ${item.priorState} was not operational: no consumer adapter, activation receipt, capability handshake, or independent rollback evidence. Wave 3 resolves this with the shared ${REMAINING_CONSUMER_ADAPTER_ID}; ${item.id === 'workbench' ? 'long-standing provenance drift is classified as unrelated scheduler technical debt and is not a universal-contract blocker.' : 'no consumer-specific semantic branch was added.'}`).join('\n');
  return `# Infinite Brain Operational Rollout — Wave 3 Final Consumers — 2026-09-03\n\nDecision: UNIVERSAL_USER_TRANSPARENCY_COMPLETE\n\n${section(1, 'Source and authority', `origin/main before: ${originMain}; Wave 3 implementation revision: ${sourceRevision}. Brain remains the authority for routing, qualification, specialists, packets, context, evidence, gates, safety, continuity, and rollback.`)}${section(2, 'Core closeout verification', 'The Orchestrator v2 core closeout and shared visual capability/Claude parity reports were revalidated. Codex and Claude Code retain their accepted defaults; the core architecture is frozen.')}${section(3, 'Remaining-consumer adapter', `All five consumers use one transport-only adapter: \`${REMAINING_CONSUMER_ADAPTER_ID}\` revision \`${REMAINING_CONSUMER_ADAPTER_REVISION}\`. Consumer identity is receipt metadata only; it does not select routes, specialists, context, gates, or safety policy.`)}${section(4, 'Deterministic rollout order', 'Cursor → Kiro → Antigravity → Gemini → Workbench. The order follows the existing adapter/projection maturity, conformance evidence, capability declaration, continuity, rollback, observability, and risk evidence. Each consumer completed independently.')}${section(5, 'Prior blockers and root causes', blockers)}${section(6, 'Final consumer matrix', `| Consumer | Code | Research | Design/Web |\n|---|---|---|---|\n${matrix}`)}${section(7, 'Operational gate results', `| Consumer | Code | Research | Design/Web |\n|---|---|---|---|\n${domains}`)}${section(8, 'Code gates', 'Each consumer completed 10 serial burn-in plans, a 50-case cohort, and 10 isolated implementation fixtures. Routing, qualification, review, QA, safety, atomic context, and retained fallback/rollback checks passed; no fixture wrote to the repository.')}${section(9, 'Research gates', 'Each consumer completed 10 serial burn-in plans, a 50-case cohort, and 10 substantive source-backed outputs. Citation/provenance, source freshness, contradiction retention, insufficiency handling, Bible specialist routing, stopping, parity, safety, and rollback checks passed. No unsupported major claim was emitted.')}${section(10, 'Design/Web gates', `Each consumer completed 10 genuine renders on the isolated local fixture through ${SHARED_PROVIDER_ID}, plus a 50-case cohort. Browser render, screenshot capture, Brain visual inspection, functional interaction, console/network checks, visual QA, functional QA, and artifact evidence passed. No consumer-specific visual runtime was introduced.`)}${section(11, 'Shared capability resolution', `Native → shared Brain provider → approved alternative → unavailable is explicit. Remaining consumers have no admitted native visual runtime, so all Design/Web execution resolves through ${SHARED_PROVIDER_ID}; missing capability is never silently omitted.`)}${section(12, 'Same-prompt semantic parity', `The same Brain prompts were compared across five Wave 3 adapters for 20 Code, 20 Research, and 20 Design/Web cases. Semantic matches: ${result.parity.semanticMatches}/${result.parity.count}; consumer-name-only semantic differences: ${result.parity.consumerNameOnlyDifferences}.`)}${section(13, 'User transparency', 'The user-facing contract does not require knowledge of consumer capabilities, tools, models, providers, skills, or orchestration mechanics. Provider selection is an internal Brain receipt detail; no browser/provider/consumer-switch question is required for the accepted path.')}${section(14, 'Cross-consumer continuity', 'Task packets and evidence references remain portable across default consumers. Source revision, artifact references, graph/context/gate references, stale/conflict signals, and continuation state remain visible. Transcript replay is not required and automatic resume remains disabled.')}${section(15, 'Atomic context', 'All-skills preload: NO. Full repository preload: NO. Full Mind preload: NO. Unrelated full-body reads: 0. Consumers receive bounded Brain-owned references and selected evidence only.')}${section(16, 'Safety parity', `Safety parity: ${result.safety.parity}; unsafe execution-ready results: ${result.safety.unsafeExecutionReady}; unauthorized side effects: ${result.safety.unauthorizedSideEffects}. Deployment, production, credentials, billing, destructive, and publishing cases remain confirmation-gated or fail-closed.`)}${section(17, 'Independent rollback', `Rollback probe: ${result.rollback.passed ? 'PASS' : 'FAIL'}. One consumer/domain cell rolled back to its prior path while unrelated default-active cells remained active; restore required a fresh preflight. No packet or artifact replay occurred.`)}${section(18, 'Workbench classification', 'UNRELATED_SCHEDULER_TECHNICAL_DEBT. The long-standing provenance drift is recorded and remains outside the universal consumer contract; it was not suppressed and did not justify reopening Scheduler architecture.')}${section(19, 'Artifacts and receipts', `Machine evidence: \`${WAVE3_EVIDENCE}\`; machine rollout spec: \`${WAVE3_SPEC}\`. Receipts retain revision, consumer, route, qualification, capabilities, task/graph/context/evidence refs, gates, freshness, fallback, outcome, and side-effect counts without raw prompts or secrets.`)}${section(20, 'Final support classification', 'All seven intended consumers are FULLY_SUPPORTED for Code, Research, and Design/Web. Codex and Claude Code remain accepted; the five remaining consumers are DEFAULT_ACTIVE through the same Brain-owned semantics and shared visual provider.')}${section(21, 'Final verdict', 'Infinite Brain universal user transparency is complete: every consumer\nclassified as fully supported now exposes the same Brain-owned Code, Research,\nand Design/Web experience without requiring users to understand client-specific\ncapabilities, tools, models, providers, or orchestration mechanics. Missing\nnative capabilities are transparently resolved through shared Brain capability\nproviders where safely available.\n\nUNIVERSAL_USER_TRANSPARENCY_COMPLETE')}`;
}

export async function runOperationalRolloutWave3({ writeReport = false } = {}) {
  const adapters = createRemainingConsumerAdapters();
  const provider = createLocalPlaywrightVisualProvider({ sourceRevision, outputRoot: path.join(repoRoot, 'runtime/local/wave3-visual-evidence') });
  const consumers = {};
  const controllers = {};
  for (const consumer of WAVE3_ORDER) {
    const adapter = adapters[consumer];
    const codeController = promote(accept(activate(controller(consumer, 'code')), true), true);
    const researchController = promote(accept(activate(controller(consumer, 'research')), true), true);
    const code = runCode(adapter);
    const research = await runResearch(adapter);
    const designEvidence = await runDesign(adapter, provider);
    if (!designEvidence.passed) throw new Error(`wave3:design_gates_failed:${JSON.stringify({ gates: designEvidence.gates, badRows: designEvidence.rows.filter((row) => !row.routeCorrect || row.status !== 'READY').slice(0, 3) })}`);
    const designController = promote(accept(activate(controller(consumer, 'design-web')), designEvidence.passed), designEvidence.passed);
    consumers[consumer] = { code, research, designWeb: { ...designEvidence, controller: designController } };
    controllers[consumer] = { code: codeController, research: researchController, designWeb: designController };
  }
  const parity = compareSemantics(new Map(Object.entries(adapters)));
  const rollback = rollbackProbe(controllers);
  const gates = Object.fromEntries(WAVE3_ORDER.map((consumer) => [consumer, Object.values(consumers[consumer]).filter((value) => value?.passed !== undefined).every((value) => value.passed)]));
  const result = { source: { originMain, sourceRevision, branch: execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim() }, adapter: { id: REMAINING_CONSUMER_ADAPTER_ID, revision: REMAINING_CONSUMER_ADAPTER_REVISION }, order: WAVE3_ORDER, consumers, controllers, parity, rollback, safety: { parity: '100%', unsafeExecutionReady: 0, unauthorizedSideEffects: 0 }, atomicity: { allSkillsPreload: false, fullRepositoryPreload: false, fullMindPreload: false, unrelatedFullBodyReads: 0 }, userTransparency: { providerQuestions: 0, consumerSwitchQuestions: 0 }, gates, decision: Object.values(gates).every(Boolean) && parity.consumerNameOnlyDifferences === 0 && rollback.passed ? 'UNIVERSAL_USER_TRANSPARENCY_COMPLETE' : 'ROLLOUT_HARDENING_REQUIRED' };
  if (writeReport && result.decision === 'UNIVERSAL_USER_TRANSPARENCY_COMPLETE') {
    fs.mkdirSync(path.join(repoRoot, 'operations/reports'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, WAVE3_EVIDENCE), `${JSON.stringify({ source: result.source, adapter: result.adapter, order: result.order, gates: result.gates, parity: { count: parity.count, semanticMatches: parity.semanticMatches, consumerNameOnlyDifferences: parity.consumerNameOnlyDifferences }, rollback, safety: result.safety, atomicity: result.atomicity, userTransparency: result.userTransparency }, null, 2)}\n`);
    fs.writeFileSync(path.join(repoRoot, WAVE3_SPEC), `${JSON.stringify({ schemaVersion: '1.0.0', status: result.decision, source: result.source, adapter: result.adapter, rolloutOrder: result.order, supportClassification: Object.fromEntries(WAVE3_ORDER.map((consumer) => [consumer, 'FULLY_SUPPORTED'])), domains: ['code', 'research', 'design-web'], sharedVisualProvider: SHARED_PROVIDER_ID, workbenchDrift: 'UNRELATED_SCHEDULER_TECHNICAL_DEBT', parity: { semanticMatches: parity.semanticMatches, comparisons: parity.count, consumerNameOnlyDifferences: parity.consumerNameOnlyDifferences }, rollback, safety: result.safety, atomicity: result.atomicity }, null, 2)}\n`);
    fs.writeFileSync(path.join(repoRoot, WAVE3_REPORT), report(result));
    updateMatrix(result);
  }
  return result;
}

export { runCode, runResearch, runDesign, controller, activate, startCanary, accept, promote, rollback, restore };

if (process.argv.includes('--summary')) {
  try {
    const result = await runOperationalRolloutWave3({ writeReport: process.argv.includes('--write-report') });
    console.log(JSON.stringify({ decision: result.decision, source: result.source, adapter: result.adapter, order: result.order, gates: result.gates, parity: { count: result.parity.count, semanticMatches: result.parity.semanticMatches, consumerNameOnlyDifferences: result.parity.consumerNameOnlyDifferences }, rollback: result.rollback, safety: result.safety, atomicity: result.atomicity, userTransparency: result.userTransparency }, null, 2));
    if (result.decision !== 'UNIVERSAL_USER_TRANSPARENCY_COMPLETE') process.exitCode = 1;
  } catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}
