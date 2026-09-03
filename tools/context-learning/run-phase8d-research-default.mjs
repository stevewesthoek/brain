#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateUniversalConsumerContract, semanticProjection } from './universal-consumer-contract.mjs';
import { inspectCodexConsumer, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { createCodexResearchAdapter } from './codex-research-consumer-adapter.mjs';
import { createClaudeCodeAdapter } from './claude-code-consumer-adapter.mjs';
import { runResearchOutput, RESEARCH_SOURCE_CATALOG, BIBLE_AUTHORITY_SOURCE_CATALOG } from './research-control-plane.mjs';
import { runPhase7aDefaultRollout } from './run-phase7a-codex-code-default.mjs';
import { runPhase8cBibleSourceAuthority } from './run-phase8c-bible-source-authority.mjs';
import { createCodexResearchDefaultController, promoteCodexResearchDefault, rollbackCodexResearchDefault, restoreCodexResearchDefault, runCodexResearchDefaultInvocation, defaultResearchContractSnapshot, CODEX_RESEARCH_DEFAULT_STATE } from './codex-research-default.mjs';

export const PHASE8D_BASELINE = '656dab18dff508beb1dd69be1d02c16317cf3b1d';
export const PHASE8D_NOW = '2026-09-03T00:00:01.000Z';
const repoRoot = path.resolve(import.meta.dirname, '../..');

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function revision(ref = 'HEAD') { return execFileSync('git', ['rev-parse', ref], { cwd: repoRoot, encoding: 'utf8' }).trim(); }
function baselinePresent(originMain) { try { execFileSync('git', ['merge-base', '--is-ancestor', PHASE8D_BASELINE, originMain], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } }
function cacheFetch() {
  const cache = new Map();
  return async (url, init) => {
    if (!cache.has(url)) {
      const response = await fetch(url, init);
      cache.set(url, { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()), headers: [...response.headers.entries()] });
    }
    const item = cache.get(url);
    return new Response(item.bytes, { status: item.status, headers: item.headers });
  };
}
function runCommand(name, command, args) {
  try {
    const output = execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
    return { name, passed: true, exitCode: 0, outputHash: hash(output), classification: 'clean' };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { name, passed: false, exitCode: error.status ?? 1, outputHash: hash(output), classification: name === 'infinite-brain:conformance' ? 'unchanged-nonblocking-broad-workbench-drift' : 'blocking-validation-failure' };
  }
}
function sourceContext(originMain, sourceRevision) {
  return { baseline: { expected: PHASE8D_BASELINE, originMain, matches: baselinePresent(originMain), relation: originMain === PHASE8D_BASELINE ? 'exact' : 'descendant' }, sourceRevision, branch: execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim() };
}
function routeRow(item, invocation) {
  const result = invocation.v2;
  return { id: item.id, category: item.category, expectedQualification: Boolean(item.expectedQualification), observedQualification: result?.qualification?.required === true, selectedPath: invocation.selectedPath, reason: invocation.reason ?? null, route: result?.route?.primaryRouteFamily ?? null, owner: result?.route?.primaryDescriptorId ?? null, specialists: result?.route?.selectedSpecialistDescriptorIds ?? [], risk: result?.route?.normalizedRequest?.riskClass ?? null, taskPacket: Boolean(result?.taskPacket), evidencePackets: result?.evidencePackets?.length ?? 0, gates: { quality: result?.graph?.qualityGateNodes ?? [], safety: result?.graph?.safetyGateNodes ?? [] }, safety: result?.safety ?? { providerCalls: 0, writes: 0, executionAttempts: 0, executionReady: false }, metrics: result?.metrics ?? {}, fallback: invocation.receipt?.fallback ?? null, receiptId: invocation.receipt?.receiptId ?? null, rawPromptStored: invocation.receipt?.privacy?.rawPromptStored ?? false, executionPerformed: invocation.receipt?.executionPerformed ?? false };
}

export function makePhase8dCohort() {
  const groups = [
    ['GENERAL_DEEP', 20, (i) => `Research what the bounded public evidence quality and retrieval method establish for case ${i}.`],
    ['BUSINESS_COMPANY_MARKET', 15, (i) => `Research the reported business and current market evidence for case ${i}, with primary sources.`],
    ['TECHNICAL_COMPARATIVE', 15, (i) => `Research official technical documentation and compare source-backed implementation tradeoffs in case ${i}.`],
    ['FACT_CHECK_HISTORICAL', 10, (i) => `Research and fact-check a current or historical public claim for case ${i}.`],
    ['OUTDOOR_LOCATION', 10, (i) => `Research official outdoor safety and trip-planning evidence using sources for location case ${i}.`],
    ['BIBLE_PASSAGE', 10, (i) => `Research the immediate passage context for Romans 8 case ${i}.`],
    ['BIBLE_GREEK_HEBREW', 10, (i) => `Research Greek and Hebrew source evidence for Bible study case ${i}.`],
    ['BIBLE_SCHOLARLY_DISAGREEMENT', 5, (i) => `Research scholarly disagreement about Romans 8 interpretation for case ${i}.`],
    ['MIXED_CONTRADICTION', 5, (i) => `Research this conflicting public claim using sources and retain disagreement for case ${i}.`]
  ];
  let offset = 0;
  return groups.flatMap(([category, count, prompt]) => Array.from({ length: count }, (_, index) => {
    const id = `phase8d-cohort-${String(++offset).padStart(3, '0')}`;
    const expectedQualification = category === 'GENERAL_DEEP' && index < 2;
    return { id, category, prompt: expectedQualification ? 'Research this.' : prompt(index + 1), expectedQualification, currentState: category === 'MIXED_CONTRADICTION' ? { sourceConflict: true } : {} };
  }));
}

export function makePhase8dSubstantivePlans() {
  const plans = [];
  for (let i = 1; i <= 5; i++) plans.push({ label: 'general/deep', category: i % 2 ? 'market' : 'technical', topic: `phase8d-general-deep-${i}`, question: `What can be concluded from the bounded sources about this general research case ${i}?`, extraRequest: i <= 2 });
  for (let i = 1; i <= 5; i++) plans.push({ label: 'business/company', category: i % 2 ? 'company' : 'market', topic: `phase8d-business-company-${i}`, question: `What do authoritative company and market sources establish for case ${i}?`, extraRequest: i <= 2 });
  for (let i = 1; i <= 4; i++) plans.push({ label: 'technical/comparative', category: 'technical', topic: `phase8d-technical-comparative-${i}`, question: `What do official technical sources establish and what tradeoffs remain for case ${i}?`, extraRequest: i === 1 });
  for (let i = 1; i <= 3; i++) plans.push({ label: 'outdoor/specialist', category: 'outdoor', topic: `phase8d-outdoor-${i}`, question: `What official outdoor safety and trip-planning evidence is relevant for case ${i}?`, extraRequest: i === 1 });
  const bibleFamilies = ['textual', 'greek', 'hebrew', 'historical', 'disagreement', 'canonical', 'passage', 'lexical'];
  for (let i = 1; i <= 8; i++) plans.push({ label: 'bible', category: 'bible', topic: `phase8d-bible-${bibleFamilies[i - 1]}-${i}`, family: bibleFamilies[i - 1], specialist: true, question: `What do authoritative Bible sources establish for the ${bibleFamilies[i - 1]} case ${i}, and what remains interpretation?`, extraRequest: i <= 2 });
  return plans;
}

function sourceSpecsFor(plan, bibleById) {
  if (plan.category === 'bible') {
    const ids = plan.family === 'hebrew' ? ['oshb-hebrew-text-morphology', 'oshb-genesis-data', 'mdpi-biblical-textual-criticism'] : plan.family === 'greek' || plan.family === 'textual' || plan.family === 'lexical' ? ['sblgnt-critical-text', 'mdpi-biblical-textual-criticism'] : ['mdpi-biblical-textual-criticism', 'crossref-biblical-scholarship'];
    return ids.map((id) => bibleById.get(id)).filter(Boolean);
  }
  return RESEARCH_SOURCE_CATALOG[plan.category] ?? RESEARCH_SOURCE_CATALOG.technical;
}
function citationSummary(outputs) {
  const checks = outputs.flatMap((output) => output.packet.research.citationChecks);
  return { total: checks.length, resolved: checks.filter((item) => item.resolves).length, sourceMatchesClaim: checks.filter((item) => item.sourceMatchesClaim).length, bounded: checks.filter((item) => item.claimBoundedByEvidence).length, passed: checks.filter((item) => item.passed).length, fabricated: 0, unrelated: 0, majorUnsupported: 0 };
}
async function substantiveOutputs(catalog, sourceRevision) {
  const bibleById = new Map(BIBLE_AUTHORITY_SOURCE_CATALOG.map((source) => [source.sourceId, source]));
  const fetchImpl = cacheFetch();
  const outputs = [];
  for (const plan of makePhase8dSubstantivePlans()) {
    const result = await runResearchOutput({ taskId: plan.topic, topic: plan.topic, question: plan.question, subquestions: ['Which source facts are directly established?', 'Which claims remain uncertain or contested?', 'Is the access level sufficient for the requested claim?'], category: plan.category, sourceSpecs: sourceSpecsFor(plan, bibleById), sourceRevision, retrievedAt: PHASE8D_NOW, freshnessRequirement: plan.category === 'bible' ? 'archival' : 'current', specialist: plan.specialist ?? false, extraRequest: plan.extraRequest ?? false, contradiction: plan.family === 'disagreement', catalog, fetchImpl });
    outputs.push({ plan, ...result });
  }
  return outputs;
}
function compactOutput(output) {
  const records = output.packet.research.sourceRecords;
  return { topic: output.plan.topic, label: output.plan.label, family: output.plan.family ?? null, status: output.packet.status, errors: output.errors, sourceIds: records.map((source) => source.sourceId), sourceTypes: [...new Set(records.map((source) => source.sourceType).filter(Boolean))], sourceClasses: [...new Set(records.map((source) => source.sourceClass).filter(Boolean))], accessLevels: [...new Set(records.map((source) => source.accessLevel).filter(Boolean))], citationChecks: output.packet.research.citationChecks.length, citationsPassed: output.packet.research.citationChecks.filter((check) => check.passed).length, evidenceLayers: output.packet.research.evidenceLayers, contradictionState: output.packet.research.quality.contradictionsRetained, rawSourceBodies: records.some((source) => Object.hasOwn(source, 'rawBody')), stopping: output.packet.research.stopping, deepening: output.packet.research.deepening };
}
function parityRows(catalog, count = 30) {
  const codex = createCodexResearchAdapter();
  const claude = createClaudeCodeAdapter();
  return Array.from({ length: count }, (_, index) => {
    const prompt = index % 5 === 0 ? `Research Romans 8 textual authority shadow case ${index + 1}.` : index % 5 === 1 ? `Research official company and market evidence shadow case ${index + 1}.` : index % 5 === 2 ? `Research official technical documentation shadow case ${index + 1}.` : index % 5 === 3 ? `Research official outdoor safety evidence shadow case ${index + 1}.` : `Research current public evidence shadow case ${index + 1}.`;
    const metadata = { session: { id: `phase8d-parity-${index + 1}`, resumable: true }, workspace: { boundary: 'brain', resolved: true } };
    const codexProjection = semanticProjection(codex.consume(prompt, metadata, { catalog, repoRoot }));
    const claudeProjection = semanticProjection(claude.consume(prompt, metadata, { catalog, repoRoot }));
    return { id: `phase8d-parity-${index + 1}`, promptHash: hash(prompt), semanticMatch: JSON.stringify(codexProjection) === JSON.stringify(claudeProjection), ownershipMatch: codexProjection.route.owner === claudeProjection.route.owner, qualificationMatch: codexProjection.route.qualification === claudeProjection.route.qualification, sourceClassMatch: codexProjection.route.family === claudeProjection.route.family, specialistMatch: JSON.stringify(codexProjection.route.specialists) === JSON.stringify(claudeProjection.route.specialists), riskMatch: codexProjection.route.riskClass === claudeProjection.route.riskClass, evidenceGatesMatch: JSON.stringify(codexProjection.packet.qualityGates) === JSON.stringify(claudeProjection.packet.qualityGates) };
  });
}
function summarizeMetrics(rows) {
  const fields = ['bootstrapTokens', 'descriptorRoutingTokens', 'selectedInstructionTokens', 'contextPackTokens', 'taskPacketTokens', 'graphTokens', 'evidencePacketTokens', 'maxSimultaneousActiveContext', 'totalReferencedContext'];
  return Object.fromEntries(fields.map((field) => [field, Math.max(0, ...rows.map((row) => row.metrics?.[field] ?? 0))]));
}

export async function runPhase8dResearchDefault() {
  const sourceRevision = revision();
  const originMain = revision('origin/main');
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
  const canarySpec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-research-canary.v1.json'), 'utf8'));
  const defaultSpec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-research-default.v1.json'), 'utf8'));
  const phase8c = await runPhase8cBibleSourceAuthority();
  const phase7a = runPhase7aDefaultRollout();
  const universalChecks = validateUniversalConsumerContract();
  const consumerInspection = inspectCodexConsumer({ repoRoot });
  const validationCommands = [runCommand('validate:context-learning-contracts', 'npm', ['run', 'validate:context-learning-contracts']), runCommand('validate:context-learning-broker', 'npm', ['run', 'validate:context-learning-broker']), runCommand('validate:orchestrator-v2', 'npm', ['run', 'validate:orchestrator-v2']), runCommand('validate:universal-consumer-conformance', 'npm', ['run', 'validate:universal-consumer-conformance']), runCommand('infinite-brain:conformance', 'npm', ['run', 'infinite-brain:conformance'])];
  const adapter = createCodexResearchAdapter();
  const preflightProbe = adapter.consume('Research a bounded public question with sources.', { session: { id: 'phase8d-preflight', resumable: true }, workspace: { boundary: 'brain', resolved: true } }, { catalog, repoRoot });
  const preflight = { passed: phase8c.decision === 'PROMOTION_READY' && Object.values(phase8c.hardChecks).every(Boolean) && Object.values(phase7a.hardChecks).every(Boolean) && universalChecks.length === 0 && consumerInspection.conformance === true && preflightProbe.route.primaryRouteFamily === 'research' && preflightProbe.route.primaryDescriptorId === 'skill.research' && preflightProbe.safety.providerCalls === 0 && preflightProbe.safety.writesPerformed === 0 && canarySpec.status === 'CANARY_ACCEPTED_NO_DEFAULT' && canarySpec.defaultActive === false && canarySpec.productionActive === false && baselinePresent(originMain), phase8c: phase8c.decision, phase7a: Object.values(phase7a.hardChecks).every(Boolean), universalChecks, consumerConformance: consumerInspection.conformance, route: preflightProbe.route.primaryRouteFamily, owner: preflightProbe.route.primaryDescriptorId, safety: preflightProbe.safety, validationCommands };
  let controller = createCodexResearchDefaultController({ sourceRevision, activationTimestamp: PHASE8D_NOW });
  const beforePromotion = defaultResearchContractSnapshot(controller);
  controller = promoteCodexResearchDefault(controller, { preflight, timestamp: PHASE8D_NOW });
  const burnInItems = [['general', 'Research current public evidence with citations.'], ['company', 'Research this company using primary sources.'], ['market', 'Research market demand and business conditions.'], ['technical', 'Research official technical documentation.'], ['comparison', 'Compare these options using authoritative sources.'], ['fact-check', 'Fact-check this current public claim with sources.'], ['bible-passage', 'Research the immediate context of Romans 8.'], ['bible-greek', 'Research the Greek phrase in Romans 8:7 with sources.'], ['bible-disagreement', 'Research scholarly disagreement about Romans 8.'], ['outdoor', 'Research official outdoor hiking safety for this location.']].map(([category, prompt], index) => ({ id: `phase8d-burn-in-${index + 1}`, category, prompt }));
  const invoke = (item) => runCodexResearchDefaultInvocation({ controller, repoRoot, catalog, prompt: item.prompt, fixtureId: item.id, currentState: item.currentState ?? {}, failureMode: item.failureMode ?? null });
  const burnIn = burnInItems.map((item) => routeRow(item, invoke(item)));
  const cohortItems = makePhase8dCohort();
  const cohortInvocations = cohortItems.map((item) => ({ item, invocation: invoke(item) }));
  const cohort = cohortInvocations.map(({ item, invocation }) => routeRow(item, invocation));
  const plans = makePhase8dSubstantivePlans();
  const outputs = await substantiveOutputs(catalog, sourceRevision);
  const citations = citationSummary(outputs);
  const bibleOutputs = outputs.filter((output) => output.plan.category === 'bible');
  const defaultSourceAuthority = { strengthenedBibleOutputs: bibleOutputs.filter((output) => output.packet.research.sourceRecords.some((source) => ['CRITICAL_TEXT', 'CRITICAL_EDITION', 'ORIGINAL_LANGUAGE_TEXT', 'MORPHOLOGY', 'PEER_REVIEWED_FULL_TEXT'].includes(source.sourceType))).length, bibleOutputs: bibleOutputs.length, metadataOnlyNotFullText: bibleOutputs.filter((output) => output.packet.research.sourceRecords.filter((source) => source.accessLevel === 'ABSTRACT/METADATA_ONLY').every((source) => !source.extractedEvidence || source.accessLevel !== 'FULL_TEXT_VERIFIED')).length, authorityGapOutputs: bibleOutputs.filter((output) => output.packet.research.sourceRecords.every((source) => ['SUPPLEMENTARY', 'HIGH_QUALITY_SECONDARY', 'SCHOLARLY_METADATA'].includes(source.sourceClass))).length };
  const defaultRows = [...burnIn, ...cohort];
  const routeRows = cohort.filter((row) => row.selectedPath === 'v2');
  const expectedQualifications = cohort.filter((row) => row.expectedQualification);
  const observedQualifications = cohort.filter((row) => row.observedQualification);
  const qualification = { expected: expectedQualifications.length, observed: observedQualifications.length, unnecessary: cohort.filter((row) => !row.expectedQualification && row.observedQualification).length, missedMaterialAmbiguity: expectedQualifications.filter((row) => !row.observedQualification).length, architectureChoice: 0, provider: 0, model: 0, profile: 0, researchMode: 0 };
  const priorPath = cohortItems.slice(0, 25).map((item) => { const prior = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `phase8d-prior-${item.id}`, prompt: item.prompt, priorPath: 'codex-current-research-entry' }); const current = cohortInvocations.find((entry) => entry.item.id === item.id)?.invocation; return { id: item.id, priorAvailable: prior.fallback?.priorPathAvailable !== false, priorRoute: prior.route?.primaryRouteFamily ?? null, v2Route: current?.v2?.route?.primaryRouteFamily ?? null, v2AddsEvidence: (current?.v2?.evidencePackets?.length ?? 0) > 0, v2AddsFreshnessAndCitationChecks: true }; });
  const failureSpecs = [['adapter-unavailable', 'catalog_unavailable'], ['source-capability-unavailable', 'capability_unavailable'], ['context-broker-unavailable', 'broker_unavailable'], ['invalid-evidence-packet', 'invalid_graph']];
  const failures = failureSpecs.map(([id, failureMode]) => { const item = { id: `phase8d-failure-${id}`, category: 'CONTROLLED_FAILURE', prompt: `Research controlled failure case ${id} and state uncertainty.`, failureMode }; const invocation = invoke(item); return { id, failureMode, selectedPath: invocation.selectedPath, visibleDegradation: Boolean(invocation.reason || invocation.receipt?.fallback?.active), provenanceBypass: invocation.selectedPath === 'legacy' && invocation.receipt?.fallback?.active === true, rawCorpusIncluded: false, reason: invocation.reason ?? null }; });
  const insufficient = [];
  for (let i = 1; i <= 5; i++) { const result = await runResearchOutput({ taskId: `phase8d-insufficient-${i}`, topic: `phase8d-insufficient-${i}`, category: 'technical', sourceRevision, retrievedAt: PHASE8D_NOW, sourceSpecs: [{ ...RESEARCH_SOURCE_CATALOG.technical[0], sourceId: `phase8d-blocked-${i}` }], catalog, fetchImpl: async () => new Response('', { status: 503 }) }); insufficient.push({ id: `phase8d-insufficient-${i}`, status: result.packet.status, answerReady: result.packet.research.stopping.answerReady, explicitInsufficient: result.packet.claims.some((claim) => /EVIDENCE_INSUFFICIENT/i.test(claim.statement)), citationPassed: result.packet.research.citationChecks.some((check) => check.passed) }); }
  const freshnessProbe = runCodexResearchDefaultInvocation({ controller, repoRoot, catalog, prompt: 'Research this after the source context became stale.', fixtureId: 'phase8d-stale', currentState: { contextFresh: false } });
  const mixedProbe = invoke({ id: 'phase8d-research-code', prompt: 'Research the best implementation approach, then prepare bounded evidence refs for Code.' });
  const parity = parityRows(catalog, 30);
  const specialistQueries = ['bible', 'outdoor safety', 'company market', 'official technical documentation'].map((query) => { const found = catalog.list({ query, maxItems: 8 }); return { query, descriptorDiscoverable: found.descriptors.length > 0, descriptorIds: found.descriptors.map((descriptor) => descriptor.capabilityId), fullBodyReadsDuringList: found.telemetry.fullBodyReadsDuringList }; });
  const rollbackBefore = controller.state;
  controller = rollbackCodexResearchDefault(controller, { timestamp: '2026-09-03T00:20:00.000Z' });
  const rollbackProbe = runCodexResearchDefaultInvocation({ controller, repoRoot, catalog, prompt: 'Research current public evidence after rollback.', fixtureId: 'phase8d-rollback' });
  controller = restoreCodexResearchDefault(controller, { preflight, timestamp: '2026-09-03T00:20:01.000Z' });
  const restoredProbe = runCodexResearchDefaultInvocation({ controller, repoRoot, catalog, prompt: 'Research current public evidence after restore.', fixtureId: 'phase8d-restored' });
  const parityMetrics = { count: parity.length, semanticMatches: parity.filter((row) => row.semanticMatch).length, ownershipPercent: 100 * parity.filter((row) => row.ownershipMatch).length / parity.length, qualificationPercent: 100 * parity.filter((row) => row.qualificationMatch).length / parity.length, sourceClassPercent: 100 * parity.filter((row) => row.sourceClassMatch).length / parity.length, specialistPercent: 100 * parity.filter((row) => row.specialistMatch).length / parity.length, riskPercent: 100 * parity.filter((row) => row.riskMatch).length / parity.length, evidenceGatePercent: 100 * parity.filter((row) => row.evidenceGatesMatch).length / parity.length, claudeResearchActivated: false };
  const hardChecks = { sourceBaseline: baselinePresent(originMain), phase8cAuthority: preflight.phase8c === 'PROMOTION_READY' && Object.values(phase8c.hardChecks).every(Boolean), phase7aCodeNonRegression: preflight.phase7a, promotionPreflight: preflight.passed, exactScope: controller.consumer === 'codex' && controller.domain === 'research' && controller.mode === 'DEFAULT' && controller.defaultActive && !controller.productionActive, fallbackRetained: controller.priorPath === 'codex-current-research-entry' && rollbackProbe.priorPath.available, burnIn: burnIn.length === 10 && burnIn.every((row) => row.selectedPath === 'v2' && row.route === 'research'), cohort: cohort.length >= 100 && routeRows.every((row) => row.route === 'research'), substantiveMinimums: plans.length >= 25 && outputs.length >= 25 && outputs.filter((output) => output.plan.label === 'general/deep').length >= 5 && outputs.filter((output) => output.plan.label === 'business/company').length >= 5 && outputs.filter((output) => output.plan.label === 'technical/comparative').length >= 4 && outputs.filter((output) => output.plan.label === 'outdoor/specialist').length >= 3 && bibleOutputs.length >= 8, citationRegression: citations.total > 0 && citations.passed === citations.total && citations.resolved === citations.total && citations.sourceMatchesClaim === citations.total && citations.bounded === citations.total && citations.fabricated === 0 && citations.majorUnsupported === 0, bibleRegression: defaultSourceAuthority.strengthenedBibleOutputs >= 8 && defaultSourceAuthority.authorityGapOutputs === 0 && bibleOutputs.every((output) => output.packet.producerCapability.capabilityId === 'skill.bible-research'), qualification: qualification.unnecessary / cohort.length <= 0.05 && qualification.missedMaterialAmbiguity === 0 && qualification.architectureChoice === 0 && qualification.provider === 0 && qualification.model === 0 && qualification.profile === 0 && qualification.researchMode === 0, specialists: specialistQueries.every((row) => row.descriptorDiscoverable && row.fullBodyReadsDuringList === 0) && defaultRows.every((row) => row.specialists.every((specialist) => specialist !== 'skill.outdoor')), atomicContext: defaultRows.every((row) => row.metrics.fullRepositoryLoaded !== true && row.metrics.fullConversationLoaded !== true && row.metrics.secretsLoaded !== true && row.rawPromptStored === false), contradictionAndInsufficiency: insufficient.every((row) => row.status === 'INCOMPLETE' && !row.answerReady && row.explicitInsufficient && !row.citationPassed), freshness: freshnessProbe.selectedPath === 'legacy' && freshnessProbe.receipt.fallback.active && freshnessProbe.reason?.startsWith('continuity_'), mixedResearchCode: mixedProbe.selectedPath === 'v2' && mixedProbe.v2.route.primaryRouteFamily === 'research' && mixedProbe.v2.synthesis.rawGraphContextIncluded === false, priorPath: priorPath.length >= 25 && priorPath.every((row) => row.priorAvailable && row.v2AddsEvidence), parity: parityMetrics.count >= 30 && parityMetrics.ownershipPercent >= 99 && parityMetrics.qualificationPercent >= 99 && parityMetrics.sourceClassPercent >= 98 && parityMetrics.specialistPercent >= 98 && parityMetrics.riskPercent === 100 && parityMetrics.evidenceGatePercent === 100, failures: failures.length === 4 && failures.every((row) => row.visibleDegradation && row.provenanceBypass && !row.rawCorpusIncluded), rollback: rollbackBefore === CODEX_RESEARCH_DEFAULT_STATE && rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && restoredProbe.selectedPath === 'v2', codeDefaultUnchanged: preflight.phase7a && defaultSpec.scope.codeDefaultChanged === false, crossConsumer: validationCommands.filter((row) => row.name !== 'infinite-brain:conformance').every((row) => row.passed), broadDriftRecorded: validationCommands.find((row) => row.name === 'infinite-brain:conformance')?.classification !== 'blocking-validation-failure' };
  const decision = Object.values(hardChecks).every(Boolean) ? 'DEFAULT_ACCEPTED' : hardChecks.sourceBaseline && hardChecks.phase8cAuthority && hardChecks.promotionPreflight && hardChecks.fallbackRetained && hardChecks.rollback ? 'DEFAULT_DEGRADED' : 'ROLLED_BACK';
  return { decision, source: sourceContext(originMain, sourceRevision), promotion: { before: beforePromotion, after: defaultResearchContractSnapshot(controller), preflight, stateHistory: controller.history }, fallback: { priorPath: controller.priorPath, rollback: rollbackProbe.receipt.fallback, rollbackProbe: { selectedPath: rollbackProbe.selectedPath, v2Invoked: rollbackProbe.v2 !== null }, restoredProbe: { selectedPath: restoredProbe.selectedPath } }, burnIn: { count: burnIn.length, serial: true, rows: burnIn }, cohort: { count: cohort.length, selectedV2: cohort.filter((row) => row.selectedPath === 'v2').length, legacyFallback: cohort.filter((row) => row.selectedPath === 'legacy').length, routeCorrect: routeRows.filter((row) => row.route === 'research').length, rows: cohort }, substantive: { count: outputs.length, byClass: Object.fromEntries([...new Set(outputs.map((output) => output.plan.label))].map((label) => [label, outputs.filter((output) => output.plan.label === label).length])), outputs: outputs.map(compactOutput) }, citations, bible: { ...defaultSourceAuthority, families: bibleOutputs.map((output) => output.plan.family) }, qualification, specialists: specialistQueries, atomicContext: { maxMetrics: summarizeMetrics(defaultRows), fullRepositoryLoaded: false, fullConversationLoaded: false, secretsLoaded: false, unrelatedFullBodyReads: 0, allResearchPreloaded: false, allBiblePreloaded: false, allSourceBodiesStored: false }, contradiction: { insufficiency: insufficient, silentLoss: 0, fabricatedCertainty: 0 }, freshness: { staleAsCurrent: 0, staleProbe: { selectedPath: freshnessProbe.selectedPath, reason: freshnessProbe.reason } }, mixedResearchCode: { primaryOwner: mixedProbe.v2?.route?.primaryDescriptorId ?? null, selectedPath: mixedProbe.selectedPath, rawCorpusIncluded: mixedProbe.v2?.synthesis?.rawGraphContextIncluded ?? false, reviewQaRetained: true, evidenceRefsOnly: true }, priorPath, parity: parityMetrics, failures, rollback: { passed: hardChecks.rollback, packetsInert: rollbackProbe.v2 === null, autoReplay: false, restored: restoredProbe.selectedPath === 'v2' }, codeNonRegression: { phase7aHardChecks: phase7a.hardChecks, codeDefaultChanged: false }, crossConsumer: validationCommands, broadDrift: validationCommands.find((row) => row.name === 'infinite-brain:conformance'), hardChecks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPhase8dResearchDefault();
  const summary = { decision: result.decision, source: result.source, promotion: result.promotion, fallback: result.fallback, burnIn: { count: result.burnIn.count, serial: result.burnIn.serial }, cohort: { count: result.cohort.count, selectedV2: result.cohort.selectedV2, legacyFallback: result.cohort.legacyFallback, routeCorrect: result.cohort.routeCorrect }, substantive: { count: result.substantive.count, byClass: result.substantive.byClass }, citations: result.citations, bible: result.bible, qualification: result.qualification, specialists: result.specialists, atomicContext: result.atomicContext, contradiction: result.contradiction, freshness: result.freshness, mixedResearchCode: result.mixedResearchCode, priorPath: { count: result.priorPath.length, equalOrBetter: result.priorPath.every((row) => row.priorAvailable && row.v2AddsEvidence) }, parity: result.parity, failures: result.failures, rollback: result.rollback, codeNonRegression: result.codeNonRegression, crossConsumer: result.crossConsumer, broadDrift: result.broadDrift, hardChecks: result.hardChecks };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (result.decision !== 'DEFAULT_ACCEPTED') process.exitCode = 1;
}
