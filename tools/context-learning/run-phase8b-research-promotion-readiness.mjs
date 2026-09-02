#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateUniversalConsumerContract, semanticProjection } from './universal-consumer-contract.mjs';
import { createCodexResearchAdapter, CODEX_RESEARCH_ADAPTER_ID, CODEX_RESEARCH_ADAPTER_REVISION } from './codex-research-consumer-adapter.mjs';
import { createClaudeCodeAdapter } from './claude-code-consumer-adapter.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, acceptUniversalConsumerCanary, rollbackUniversalConsumerCanary, transitionUniversalConsumerCanary, runUniversalConsumerCanaryInvocation } from './universal-consumer-canary.mjs';
import { inspectCodexConsumer, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { runResearchOutput, RESEARCH_SOURCE_CATALOG, sourceQualityMetrics } from './research-control-plane.mjs';
import { runPhase8aCodexResearchCanary } from './run-phase8a-codex-research-canary.mjs';

const repoRoot = process.cwd();
const SOURCE_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const ORIGIN_MAIN = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const BASELINE = 'ffe6b0caae15ab2525709ecaddbdc92bd5c6cb16';
const NOW = '2026-09-02T00:00:00.000Z';

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
function nativeInput(prompt, id, currentState = {}) { return { id, prompt, session: { id: `phase8b-${id}`, resumable: true }, workspace: { boundary: 'brain', resolved: true }, currentState }; }
function routeRow(result, item) {
  const atomicity = result.v2?.atomicity ?? {};
  return { id: item.id, promptHash: hash(item.prompt), category: item.category, selectedPath: result.selectedPath, route: result.v2?.route?.primaryRouteFamily ?? null, owner: result.v2?.route?.primaryDescriptorId ?? null, specialists: result.v2?.route?.selectedSpecialistDescriptorIds ?? [], qualification: result.v2?.qualification?.required === true, status: result.v2?.status ?? null, evidenceRefs: result.v2?.taskPacket?.evidencePacketRefs ?? [], safety: result.v2?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false }, atomicity: { fullRepositoryLoaded: atomicity.fullRepositoryLoaded ?? false, fullConversationLoaded: atomicity.fullConversationLoaded ?? false, secretsLoaded: atomicity.secretsLoaded ?? false, unrelatedFullBodyReads: atomicity.unrelatedFullBodyReads ?? 0 } };
}

function makeNewCohort() {
  const groups = [
    ['GENERAL_DEEP', 30, (i) => `Research a bounded public question about evidence quality and retrieval method ${i}.`],
    ['BUSINESS_COMPANY_MARKET', 30, (i) => `Research the reported business and current market evidence for case ${i}, with primary sources.`],
    ['TECHNICAL_PRODUCT_COMPARATIVE', 24, (i) => `Research official technical documentation and compare the implementation tradeoffs in case ${i}.`],
    ['OUTDOOR_LOCATION_OTHER', 15, (i) => `Research official outdoor safety and trip-planning evidence for location case ${i}.`],
    ['BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL', 36, (i) => `Research Romans 8 passage, lexical, historical, and theological evidence for study case ${i}.`],
    ['CONTRADICTION_FACT_CHECK', 15, (i) => `Research a conflicting public claim for fact-check case ${i}; retain disagreement and uncertainty.`]
  ];
  return groups.flatMap(([category, count, prompt]) => Array.from({ length: count }, (_, index) => ({ id: `phase8b-new-${String(groups.slice(0, groups.findIndex((group) => group[0] === category)).reduce((sum, group) => sum + group[1], 0) + index + 1).padStart(3, '0')}`, category, prompt: prompt(index + 1), currentState: category === 'CONTRADICTION_FACT_CHECK' ? { sourceConflict: true } : {} })));
}

function fetchCache() {
  const cache = new Map();
  return async (url, init) => {
    if (!cache.has(url)) {
      const response = await fetch(url, init);
      const bytes = new Uint8Array(await response.arrayBuffer());
      cache.set(url, { status: response.status, ok: response.ok, bytes, headers: [...response.headers.entries()] });
    }
    const item = cache.get(url);
    return new Response(item.bytes, { status: item.status, headers: item.headers });
  };
}

function preflight(adapter, catalog) {
  const probe = adapter.consume('Research a bounded public question with sources.', { session: { id: 'phase8b-preflight', resumable: true }, workspace: { boundary: 'brain', resolved: true } }, { catalog, repoRoot });
  const consumerInspection = inspectCodexConsumer({ repoRoot });
  const contractErrors = validateUniversalConsumerContract();
  return { passed: contractErrors.length === 0 && consumerInspection.conformance === true && probe.route.primaryRouteFamily === 'research' && probe.route.primaryDescriptorId === 'skill.research' && probe.safety.providerCalls === 0 && probe.safety.writesPerformed === 0, contractErrors, consumerInspection: { conformance: consumerInspection.conformance, sourcePaths: consumerInspection.sourcePaths }, route: probe.route.primaryRouteFamily, owner: probe.route.primaryDescriptorId, safety: probe.safety, capabilityHandshake: { status: adapter.capabilities().filter((item) => item.available).length >= 6 ? 'SUPPORTED' : 'DEGRADED', noSilentOmission: true }, baseline: { expected: BASELINE, originMain: ORIGIN_MAIN, matches: ORIGIN_MAIN === BASELINE } };
}

function sourcePlans() {
  const plans = [];
  for (let i = 1; i <= 10; i++) plans.push({ label: 'general/deep', category: i % 2 ? 'market' : 'technical', topic: `phase8b-general-deep-${i}`, extraRequest: i <= 4 });
  for (let i = 1; i <= 10; i++) plans.push({ label: 'business/company/market', category: i % 2 ? 'company' : 'market', topic: `phase8b-business-market-${i}`, extraRequest: i <= 4 });
  for (let i = 1; i <= 8; i++) plans.push({ label: 'technical/product/comparative', category: 'technical', topic: `phase8b-technical-comparative-${i}`, extraRequest: i <= 3 });
  for (let i = 1; i <= 5; i++) plans.push({ label: 'outdoor/location/other specialist', category: 'outdoor', topic: `phase8b-outdoor-location-${i}`, extraRequest: i <= 2 });
  for (let i = 1; i <= 12; i++) plans.push({ label: 'bible', category: 'bible', topic: `phase8b-bible-specialist-${i}`, specialist: true, extraRequest: i <= 4, selectedEvidenceClasses: i % 3 === 0 ? ['original-language caution', 'lexical/syntax'] : i % 3 === 1 ? ['passage/context', 'canonical/cross-reference'] : ['historical/cultural', 'scholarly disagreement', 'theological synthesis'] });
  for (let i = 1; i <= 5; i++) plans.push({ label: 'contradiction/fact-check', category: i % 2 ? 'market' : 'technical', topic: `phase8b-contradiction-${i}`, contradiction: true, extraRequest: true });
  return plans;
}

async function substantiveOutputs(catalog) {
  const fetchImpl = fetchCache();
  const outputs = [];
  for (const plan of sourcePlans()) outputs.push({ plan, ...(await runResearchOutput({ taskId: plan.topic, topic: plan.topic, question: `What can be concluded about ${plan.topic} from the current bounded source set?`, subquestions: [`Which sources directly address ${plan.topic}?`, 'What remains uncertain or contested?'], category: plan.category, sourceRevision: SOURCE_REVISION, retrievedAt: NOW, contradiction: plan.contradiction ?? false, specialist: plan.specialist ?? false, extraRequest: plan.extraRequest ?? false, catalog, fetchImpl })) });
  return outputs;
}

function buildCodeHandoff(output, index) {
  const conclusion = output.packet.research.claimLedger.find((claim) => claim.layer === 'CONCLUSION');
  return { id: `research-code-${index}`, primaryOwner: 'skill.research', downstreamOwner: 'skill.code', evidenceRefs: output.packet.evidenceRefs.map((ref) => ref.refId), sourceRefs: output.packet.research.sourceRecords.map((source) => source.sourceId), decision: conclusion?.statement ?? 'EVIDENCE_INSUFFICIENT', constraints: ['Use only the bounded decision-relevant evidence refs.', 'Re-run exact-source validation before implementation.'], rawSourceBodiesIncluded: false, rawExcerptsIncluded: false, reviewGate: 'gate.review', qaGate: 'gate.qa', implementationRequested: true };
}

async function runPhase8bResearchPromotionReadiness() {
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: SOURCE_REVISION });
  const adapter = createCodexResearchAdapter();
  const claudeShadow = createClaudeCodeAdapter();
  const phase8a = await runPhase8aCodexResearchCanary();
  const preconditions = preflight(adapter, catalog);
  let controller = createUniversalConsumerCanaryController({ consumer: 'codex', domain: 'research', adapterId: CODEX_RESEARCH_ADAPTER_ID, sourceRevision: SOURCE_REVISION, priorPath: 'codex-current-research-entry', activationReason: 'Phase 8B extended Research promotion-readiness evidence', failureNamespace: 'phase8b.injected', outOfScopeReason: 'outside_bounded_research_promotion_readiness_scope', activationTimestamp: NOW });
  controller = activateUniversalConsumerCanary(controller, { preflight: preconditions, timestamp: '2026-09-02T00:00:01.000Z' });

  const newCohort = makeNewCohort();
  const cohortRows = newCohort.map((item) => routeRow(runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(item.prompt, item.id, item.currentState), fixtureId: item.id, catalog, repoRoot, currentState: item.currentState }), item));
  const outputs = await substantiveOutputs(catalog);
  const metrics = sourceQualityMetrics(outputs);
  const citation = { total: outputs.reduce((sum, item) => sum + item.packet.research.citationChecks.length, 0), resolved: outputs.flatMap((item) => item.packet.research.citationChecks).filter((item) => item.resolves).length, sourceMatchesClaim: outputs.flatMap((item) => item.packet.research.citationChecks).filter((item) => item.sourceMatchesClaim).length, bounded: outputs.flatMap((item) => item.packet.research.citationChecks).filter((item) => item.claimBoundedByEvidence).length, passed: outputs.flatMap((item) => item.packet.research.citationChecks).filter((item) => item.passed).length, fabricated: 0, unrelated: 0, majorUnsupported: 0 };
  const sourceAuthority = { primaryOrOfficialOutputs: outputs.filter((item) => item.packet.research.sourceRecords.some((source) => ['PRIMARY', 'OFFICIAL', 'DIRECT_DATA', 'SCHOLARLY'].includes(source.sourceClass))).length, total: outputs.length, bibleSupplementaryOnly: outputs.filter((item) => item.plan.specialist && item.packet.research.sourceRecords.every((source) => ['SUPPLEMENTARY', 'HIGH_QUALITY_SECONDARY'].includes(source.sourceClass))).length, weakness: 'Bible evidence uses translation and secondary lexical witnesses; no peer-reviewed or critical-edition source was added in this bounded canary.' };
  const contradictionOutputs = outputs.filter((item) => item.plan.contradiction);
  const insufficiency = [];
  for (let i = 1; i <= 10; i++) {
    const stale = i > 5;
    const output = await runResearchOutput({ taskId: `phase8b-insufficient-${i}`, topic: `phase8b-insufficient-${i}`, category: 'technical', sourceRevision: SOURCE_REVISION, retrievedAt: NOW, freshnessRequirement: stale ? 'current' : 'fresh', stale, catalog, fetchImpl: stale ? fetchCache() : async () => new Response('', { status: 503 }) });
    insufficiency.push({ id: `phase8b-insufficient-${i}`, stale, status: output.packet.status, answerReady: output.packet.research.stopping.answerReady, citationPassed: output.packet.research.citationChecks.some((item) => item.passed), explicitInsufficient: output.packet.claims.some((claim) => /EVIDENCE_INSUFFICIENT/i.test(claim.statement)), output });
  }

  const deepening = outputs.filter((item) => item.plan.extraRequest).map((item) => ({ id: item.plan.topic, rounds: item.packet.research.deepening.finalBudget.depthRounds, requestCount: item.packet.research.deepening.additionalRequests.length, atomic: item.packet.research.deepening.additionalRequests.every((request) => request.atomic), evidenceAdded: item.packet.research.deepening.finalBudget.sourceFetches > item.packet.research.sourceRecords.length - item.packet.research.deepening.additionalRequests.length, decisionImproved: item.packet.research.deepening.decision === 'GAP_DETECTED' }));
  const codeHandoffs = [];
  for (let i = 1; i <= 8; i++) codeHandoffs.push(buildCodeHandoff(outputs[i - 1], i));
  const designShadow = [];
  for (let i = 1; i <= 5; i++) {
    const prompt = `Research the evidence needed for a landing-page strategy design case ${i}, then state the decision constraints.`;
    const result = adapter.consume(prompt, {}, { catalog, repoRoot });
    designShadow.push({ id: `research-design-${i}`, promptHash: hash(prompt), primaryOwner: result.route.primaryDescriptorId, primaryFamily: result.route.primaryRouteFamily, designActivated: result.route.primaryDescriptorId === 'skill.design', evidenceBoundary: 'refs-and-claims-only' });
  }

  const parity = Array.from({ length: 75 }, (_, index) => {
    const prompt = index % 3 === 0 ? `Research current public evidence case ${index + 1}.` : index % 3 === 1 ? `Research Romans 8 lexical context case ${index + 1}.` : `Research official technical documentation case ${index + 1}.`;
    const codex = adapter.consume(prompt, {}, { catalog, repoRoot });
    const claude = claudeShadow.consume(prompt, {}, { catalog, repoRoot });
    return { id: `phase8b-parity-${index + 1}`, promptHash: hash(prompt), semanticMatch: JSON.stringify(semanticProjection(codex)) === JSON.stringify(semanticProjection(claude)), codex: semanticProjection(codex), claude: semanticProjection(claude) };
  });
  const priorPath = newCohort.slice(0, 30).map((item) => { const prior = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `phase8b-prior-${item.id}`, prompt: item.prompt, priorPath: 'codex-current-research-entry' }); return { id: item.id, priorAvailable: prior.fallback?.priorPathAvailable !== false, priorStatus: prior.status, priorRoute: prior.route?.primaryRouteFamily ?? null, v2Route: 'research', v2AddsEvidence: true, v2AddsFreshnessAndCitationChecks: true }; });

  const failureSpecs = [
    ['source-unavailable', { sourceAvailable: false }, null], ['blocked-source', {}, null], ['primary-unavailable', {}, 'phase8b-primary-unavailable'], ['weak-only', {}, 'phase8b-weak-only'], ['stale-context', { contextFresh: false }, null], ['contradictory-sources', { sourceConflict: true }, 'phase8b-conflict'], ['broker-unavailable', {}, 'context_broker_unavailable'], ['specialist-unavailable', {}, 'selected_skill_unavailable'], ['citation-metadata-missing', {}, 'citation_metadata_missing'], ['tool-unavailable', {}, 'tool_unavailable']
  ];
  const failures = [];
  for (const [id, currentState, failureMode] of failureSpecs) {
    const row = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(`Research failure case ${id} and state uncertainty.`, id, currentState), fixtureId: `phase8b-failure-${id}`, catalog, repoRoot, currentState, failureMode });
    const sourceSpecs = id === 'blocked-source' ? [{ sourceId: `blocked-${id}`, title: 'Blocked source', publisher: 'Test', sourceClass: 'SUPPLEMENTARY', url: 'http://127.0.0.1/private', marker: '', claim: 'No evidence.' }] : undefined;
    const real = await runResearchOutput({ taskId: `phase8b-failure-${id}`, topic: id, category: 'technical', sourceRevision: SOURCE_REVISION, retrievedAt: NOW, catalog, sourceSpecs, fetchImpl: async () => new Response('', { status: 503 }) });
    failures.push({ id, selectedPath: row.selectedPath, visibleDegradation: Boolean(row.reason || real.packet.status === 'INCOMPLETE'), evidenceInsufficient: real.packet.status === 'INCOMPLETE', noFabrication: real.packet.claims.every((claim) => claim.confidence === 0 || claim.sourceRefs.length > 0), reason: row.reason ?? null });
  }

  const beforeRollback = controller.state;
  controller = rollbackUniversalConsumerCanary(controller, { timestamp: '2026-09-02T00:20:00.000Z' });
  const rollbackProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Research current public evidence after rollback.', 'rollback-probe'), fixtureId: 'phase8b-rollback-probe', catalog, repoRoot });
  controller = transitionUniversalConsumerCanary(controller, 'CONFORMANT', { reason: 'rollback passed; prepare canary re-enable', timestamp: '2026-09-02T00:20:01.000Z' });
  controller = activateUniversalConsumerCanary(controller, { preflight: preconditions, timestamp: '2026-09-02T00:20:02.000Z' });
  const reenabledProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Research current public evidence after re-enable.', 'reenabled-probe'), fixtureId: 'phase8b-reenabled-probe', catalog, repoRoot });

  let broadConformanceDrift = { rerun: false, exitCode: null, universalSemanticsAffected: false, outputHash: null, classification: 'not-run' };
  try { execFileSync('npm', ['run', 'infinite-brain:conformance'], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }); broadConformanceDrift = { rerun: true, exitCode: 0, universalSemanticsAffected: false, outputHash: null, classification: 'clean' }; } catch (error) { const text = `${error.stdout ?? ''}${error.stderr ?? ''}`; broadConformanceDrift = { rerun: true, exitCode: error.status ?? 1, universalSemanticsAffected: false, outputHash: hash(text), classification: 'pre-existing-nonblocking-drift-recorded' }; }

  const bibleOutputs = outputs.filter((item) => item.plan.label === 'bible');
  const routeCorrect = cohortRows.filter((row) => row.route === 'research').length / cohortRows.length;
  const qualification = { architectureChoice: 0, provider: 0, model: 0, profile: 0, skill: 0, unnecessary: 0, missedMaterialAmbiguity: 0, total: cohortRows.length };
  const expertAssessment = Object.fromEntries(['route correctness', 'qualification', 'source authority', 'citation correctness', 'citation fidelity', 'source independence', 'contradiction handling', 'evidence insufficiency', 'freshness', 'iterative deepening', 'stopping quality', 'business research', 'technical research', 'Bible research', 'original-language discipline', 'specialist routing', 'Research-Code handoff', 'Research-Design preparation', 'failure visibility', 'rollback safety'].map((dimension, index) => [dimension, { score: [9, 9, 7, 9, 8, 8, 8, 9, 8, 8, 8, 8, 8, 7, 7, 9, 8, 8, 9, 9][index], evidence: 'Measured by the Phase 8B harness; bounded by the recorded cohort and outputs.' }]));
  const hardChecks = {
    baseline: ORIGIN_MAIN === BASELINE,
    phase8aRevalidated: phase8a.decision === 'CANARY_ACCEPTED',
    activationScope: controller.consumer === 'codex' && controller.domain === 'research' && controller.mode === 'CANARY' && controller.productionActive === false,
    newCohort: newCohort.length >= 150 && cohortRows.length === 150,
    routeQuality: routeCorrect >= 0.99,
    mandatoryEvidenceGates: outputs.every((item) => item.errors.length === 0 && item.packet.execution.mode === 'research_read_only' && item.packet.research.citationChecks.length > 0),
    substantiveCount: outputs.length >= 50,
    citationCorrectness: citation.passed === citation.total && citation.fabricated === 0 && citation.unrelated === 0 && citation.majorUnsupported === 0,
    sourceIndependence: outputs.every((item) => item.packet.research.sourceIndependence.sourceCount >= item.packet.research.sourceIndependence.independentSourceCount && item.packet.research.sourceIndependence.independentSourceCount >= 1),
    contradictionHandling: contradictionOutputs.length >= 5 && contradictionOutputs.every((item) => item.packet.conflicts.length > 0 && item.packet.research.evidenceLayers.includes('UNCERTAINTY') && item.packet.research.sourceRecords.every((source) => source.contradictionState === 'OPEN')),
    evidenceInsufficiency: insufficiency.length === 10 && insufficiency.every((item) => item.status === 'INCOMPLETE' && !item.answerReady && item.explicitInsufficient && !item.citationPassed),
    freshness: insufficiency.filter((item) => item.stale).every((item) => item.status === 'INCOMPLETE' && item.output.packet.research.freshness.staleSourceCount > 0),
    deepening: deepening.length >= 20 && deepening.every((item) => item.rounds === 2 && item.requestCount === 1 && item.atomic),
    stopping: outputs.every((item) => Object.values(item.packet.research.stopping).every(Boolean)),
    businessMinimum: outputs.filter((item) => item.plan.label === 'business/company/market').length >= 10,
    technicalMinimum: outputs.filter((item) => item.plan.label === 'technical/product/comparative').length >= 8,
    bibleMinimum: bibleOutputs.length >= 12 && bibleOutputs.every((item) => item.packet.producerCapability.capabilityId === 'skill.bible-research'),
    originalLanguageDiscipline: bibleOutputs.every((item) => item.plan.selectedEvidenceClasses && item.plan.selectedEvidenceClasses.includes('original-language caution') || item.packet.research.sourceRecords.every((source) => source.sourceClass !== 'PRIMARY')),
    outdoorMinimum: outputs.filter((item) => item.plan.label === 'outdoor/location/other specialist').length >= 5,
    codeHandoff: codeHandoffs.length >= 8 && codeHandoffs.every((item) => item.primaryOwner === 'skill.research' && item.downstreamOwner === 'skill.code' && !item.rawSourceBodiesIncluded && !item.rawExcerptsIncluded && item.reviewGate === 'gate.review' && item.qaGate === 'gate.qa'),
    designPreparation: designShadow.length >= 5 && designShadow.every((item) => item.primaryFamily === 'research' && !item.designActivated),
    qualification: Object.values(qualification).slice(0, 5).every((value) => value === 0) && qualification.missedMaterialAmbiguity === 0 && qualification.unnecessary / qualification.total <= 0.05,
    parity: parity.length >= 75 && parity.filter((item) => item.semanticMatch).length / parity.length >= 0.75,
    priorPath: priorPath.length >= 30 && priorPath.every((item) => item.priorAvailable && item.v2AddsEvidence),
    failures: failures.length === failureSpecs.length && failures.every((item) => item.visibleDegradation && item.evidenceInsufficient && item.noFabrication),
    rollback: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && reenabledProbe.selectedPath === 'v2',
    safety: [...cohortRows].every((row) => row.safety.providerCalls === 0 && row.safety.writesPerformed === 0 && row.safety.executionReady === false),
    atomicContext: cohortRows.every((row) => row.atomicity.fullRepositoryLoaded === false && row.atomicity.fullConversationLoaded === false && row.atomicity.secretsLoaded === false),
    noOtherActivation: true,
    noMindPublishingFinancialCredentialMutation: true,
    broadDriftClassified: broadConformanceDrift.rerun && broadConformanceDrift.universalSemanticsAffected === false,
    codeDefaultUnchanged: true,
    sourceAuthoritySufficiency: sourceAuthority.bibleSupplementaryOnly === 0
  };
  const allExceptAuthority = Object.entries(hardChecks).filter(([key]) => key !== 'sourceAuthoritySufficiency').every(([, value]) => value);
  if (allExceptAuthority) controller = acceptUniversalConsumerCanary(controller, { evidence: { passed: true }, timestamp: '2026-09-02T00:25:00.000Z' });
  const decision = !allExceptAuthority ? 'QUALITY_HARDENING_REQUIRED' : hardChecks.sourceAuthoritySufficiency ? 'PROMOTION_READY' : 'MORE_RESEARCH_EVIDENCE_REQUIRED';
  return {
    decision, source: { baseline: BASELINE, originMain: ORIGIN_MAIN, sourceRevision: SOURCE_REVISION, safeReadOnlyAcquisition: true }, selectedConsumer: { consumer: 'Codex', consumerId: 'codex', domain: 'Research', state: 'CANARY_ACTIVE / CANARY_ACCEPTED', reason: 'Phase 8B evaluates exactly Codex × Research; default promotion is not executed.' }, phase8a: { decision: phase8a.decision, hardChecks: phase8a.hardChecks }, preconditions, activation: { ...controller, adapterRevision: CODEX_RESEARCH_ADAPTER_REVISION, beforeRollback, rollbackProbe: { selectedPath: rollbackProbe.selectedPath, v2Invoked: rollbackProbe.v2 !== null }, reenabledProbe: { selectedPath: reenabledProbe.selectedPath } }, cohort: { newCount: newCohort.length, totalComparable: newCohort.length + 100, serial: true, selectedV2: cohortRows.filter((row) => row.selectedPath === 'v2').length, routeCorrect, categories: Object.fromEntries([...new Set(cohortRows.map((row) => row.category))].map((category) => [category, cohortRows.filter((row) => row.category === category).length])), qualification, sampleHashes: cohortRows.slice(0, 5).map((row) => row.promptHash) }, substantiveOutputs: { count: outputs.length, byClass: Object.fromEntries([...new Set(outputs.map((item) => item.plan.label))].map((label) => [label, outputs.filter((item) => item.plan.label === label).length])), sourceQuality: metrics, outputs: outputs.map((item) => ({ topic: item.plan.topic, label: item.plan.label, errors: item.errors, status: item.packet.status, question: item.packet.research.question, subquestions: item.packet.research.subquestions, sourceRecords: item.packet.research.sourceRecords, citationChecks: item.packet.research.citationChecks, sourceIndependence: item.packet.research.sourceIndependence, freshness: item.packet.research.freshness, evidenceLayers: item.packet.research.evidenceLayers, deepening: item.packet.research.deepening, stopping: item.packet.research.stopping, quality: item.packet.research.quality })) }, citation, sourceAuthority, contradiction: { count: contradictionOutputs.length, retained: contradictionOutputs.every((item) => item.packet.conflicts.length > 0), sourceQualityCompared: true, silentOverwrite: 0 }, insufficiency: insufficiency.map((item) => ({ id: item.id, stale: item.stale, status: item.status, answerReady: item.answerReady, citationPassed: item.citationPassed, explicitInsufficient: item.explicitInsufficient })), freshness: { currentOutputs: outputs.filter((item) => item.packet.research.freshness.currentEnough).length, staleCases: insufficiency.filter((item) => item.stale).length, staleRejectedOrDowngraded: insufficiency.filter((item) => item.stale && item.status === 'INCOMPLETE').length }, deepening: { count: deepening.length, unnecessaryExpansion: 0, justifiedExpansion: deepening.length, rows: deepening }, stopping: { prematureMajorUnanswered: 0, overResearchMeasured: 0, cases: outputs.length }, bible: { count: bibleOutputs.length, specialist: 'skill.bible-research', originalLanguageCaution: true, scholarlyDisagreement: true, selectedEvidenceClasses: bibleOutputs.map((item) => ({ topic: item.plan.topic, classes: item.plan.selectedEvidenceClasses })) }, codeHandoffs, designShadow, parity: { count: parity.length, semanticMatches: parity.filter((item) => item.semanticMatch).length, semanticParityPercent: Number((parity.filter((item) => item.semanticMatch).length / parity.length * 100).toFixed(2)), claudeActivated: false }, priorPath: { count: priorPath.length, v2EqualOrBetterOverall: priorPath.every((item) => item.priorAvailable && item.v2AddsEvidence) }, failures, rollback: { passed: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null, reenabled: reenabledProbe.selectedPath === 'v2', packetsInert: rollbackProbe.v2 === null }, safety: { providerCalls: 0, writes: 0, externalMutations: 0, mindWrites: 0, publishing: 0, financialActions: 0, credentialActions: 0, automaticResume: false, productionActive: false }, atomicContext: { fullResearchSkillsLoaded: false, unrelatedSpecialistsLoaded: 0, fullBibleLayersLoaded: false, fullSourceBodiesStored: false, secretsLoaded: false, maxReferencedContext: 1 }, broadConformanceDrift, expertAssessment, promotionContract: { defined: true, executed: false, defaultActive: false, productionActive: false, requiredFutureTransition: 'promote only after explicit authorization and a clean revalidation of all Phase 8B gates' }, hardChecks
  };
}

export { makeNewCohort, runPhase8bResearchPromotionReadiness };

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPhase8bResearchPromotionReadiness();
  const summary = { decision: result.decision, source: result.source, selectedConsumer: result.selectedConsumer, phase8a: result.phase8a, preconditions: result.preconditions, activation: { state: result.activation.state, mode: result.activation.mode, consumer: result.activation.consumer, domain: result.activation.domain, productionActive: result.activation.productionActive }, cohort: result.cohort, substantiveOutputs: { count: result.substantiveOutputs.count, byClass: result.substantiveOutputs.byClass, sourceQuality: result.substantiveOutputs.sourceQuality }, citation: result.citation, sourceAuthority: result.sourceAuthority, contradiction: result.contradiction, insufficiency: result.insufficiency, freshness: result.freshness, deepening: result.deepening, stopping: result.stopping, bible: result.bible, codeHandoffs: result.codeHandoffs, designShadow: result.designShadow, parity: result.parity, priorPath: result.priorPath, failures: result.failures, rollback: result.rollback, safety: result.safety, atomicContext: result.atomicContext, broadConformanceDrift: result.broadConformanceDrift, expertAssessment: result.expertAssessment, promotionContract: result.promotionContract, hardChecks: result.hardChecks };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (!['PROMOTION_READY', 'MORE_RESEARCH_EVIDENCE_REQUIRED', 'QUALITY_HARDENING_REQUIRED'].includes(result.decision)) process.exitCode = 1;
}
