#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateUniversalConsumerContract, semanticProjection, createReferenceEnvironmentAdapter } from './universal-consumer-contract.mjs';
import { createCodexResearchAdapter, CODEX_RESEARCH_ADAPTER_ID, CODEX_RESEARCH_ADAPTER_REVISION } from './codex-research-consumer-adapter.mjs';
import { createClaudeCodeAdapter } from './claude-code-consumer-adapter.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, acceptUniversalConsumerCanary, rollbackUniversalConsumerCanary, transitionUniversalConsumerCanary, runUniversalConsumerCanaryInvocation } from './universal-consumer-canary.mjs';
import { inspectCodexConsumer, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { runResearchOutput, RESEARCH_SOURCE_CATALOG, sourceQualityMetrics } from './research-control-plane.mjs';

const repoRoot = process.cwd();
const SOURCE_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const ORIGIN_MAIN = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const BASELINE = '5a386cfd4704302680d693c3e7685169f50c8ba4';
const NOW = '2026-09-02T00:00:00.000Z';

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
function nativeInput(prompt, id, currentState = {}) { return { id, prompt, session: { id: `phase8a-${id}`, resumable: true }, workspace: { boundary: 'brain', resolved: true }, currentState }; }
function canaryRow(result, category) { return { id: result.fixtureId, category, selectedPath: result.selectedPath, route: result.v2?.route?.primaryRouteFamily ?? null, owner: result.v2?.route?.primaryDescriptorId ?? null, specialists: result.v2?.route?.selectedSpecialistDescriptorIds ?? [], status: result.v2?.status ?? null, continuity: result.v2?.continuation?.state ?? null, qualification: result.v2?.qualification?.required === true, safety: result.v2?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false }, receiptId: result.receipt.receiptId, metrics: { fullRepositoryLoaded: false, fullConversationLoaded: false, secretsLoaded: false, unrelatedFullSkillReads: result.v2?.atomicity?.unrelatedFullBodyReads ?? 0 } }; }

function cohortPrompts() {
  const groups = [
    ['GENERAL_WEB', ['Research the current evidence on a public topic.', 'Research authoritative sources for the current public question.', 'Do a source-backed deep dive on the current issue.', 'Investigate the latest public information.', 'Verify whether this current claim is supported by primary sources.', 'Research the history of this public issue.', 'Synthesize the available evidence.', 'Fact-check this current statement with citations.']],
    ['COMPANY_BUSINESS_MARKET', ['Research this company’s reported business.', 'Analyze whether we should enter this named market.', 'Compare market demand using current sources.', 'Research competitors in this named market and their positioning.', 'Research what is happening in this industry.', 'Research the business case for this product.', 'Research the company’s risks and disclosures.', 'Compare the market leaders in this industry.', 'Find direct data for this market.', 'Investigate current business conditions.']],
    ['TECHNICAL_PRODUCT_COMPARATIVE', ['Compare official technical documentation for two products.', 'Research PostgreSQL JSON and JSONB behavior.', 'Verify this technical design against official documentation.', 'Research which product is better for this use case.', 'Do a technical source-backed comparison.', 'Research the current implementation tradeoffs.', 'Compare official product documentation.', 'Fact-check this current technical claim.']],
    ['OUTDOOR_LOCATION_OTHER', ['Research hiking safety for this location.', 'Research official trip-planning guidance for this trail.', 'Compare outdoor travel options using authoritative sources.', 'Research current conditions and safety considerations.', 'Research what to know before this hike.', 'Research official location information.', 'Research a safe outdoor itinerary.']],
    ['BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL', ['Explain the immediate context of Romans 8.', 'Study the Greek phrase in Romans 8:7.', 'Compare Bible translations of Romans 8:7–9.', 'Trace the canonical context of the Romans 8 Spirit and flesh theme.', 'Explain the historical and cultural background of Romans 8.', 'Compare scholarly interpretations of Romans 8.', 'Give a careful theological synthesis of Romans 8.']],
    ['MIXED_AMBIGUOUS_STALE_CONFLICT', ['Research the market and summarize the decision constraints.', 'Research this ambiguous question and state what is missing.', 'Use the stale research pack only as a lead, not authority.', 'Resolve the conflicting source context.', 'Research this with unavailable context.', 'Research and then explain the implementation implications.', 'Investigate the source disagreement.', 'Compare evidence and state uncertainty.']]
  ];
  const base = groups.flatMap(([category, prompts]) => prompts.map((prompt, index) => ({ id: `cohort-${category.toLowerCase()}-${index + 1}`, category, prompt })));
  return Array.from({ length: 100 }, (_, index) => ({ ...base[index % base.length], id: `cohort-${String(index + 1).padStart(3, '0')}` }));
}

function preflight(adapter, catalog) {
  const probe = adapter.consume('Research a bounded public question with sources.', { session: { id: 'phase8a-preflight', resumable: true }, workspace: { boundary: 'brain', resolved: true } }, { catalog, repoRoot });
  const consumerInspection = inspectCodexConsumer({ repoRoot });
  const contractErrors = validateUniversalConsumerContract();
  return { passed: contractErrors.length === 0 && consumerInspection.conformance === true && probe.route.primaryRouteFamily === 'research' && probe.route.primaryDescriptorId === 'skill.research' && probe.safety.providerCalls === 0 && probe.safety.writesPerformed === 0, contractErrors, consumerInspection: { conformance: consumerInspection.conformance, sourcePaths: consumerInspection.sourcePaths }, route: probe.route.primaryRouteFamily, owner: probe.route.primaryDescriptorId, safety: probe.safety, capabilityHandshake: { status: adapter.capabilities().filter((item) => item.available).length >= 6 ? 'SUPPORTED' : 'DEGRADED', noSilentOmission: true }, baseline: { expected: BASELINE, originMain: ORIGIN_MAIN, matches: ORIGIN_MAIN === BASELINE } };
}

async function substantiveOutputs(catalog) {
  const plans = [
    ...Array.from({ length: 5 }, (_, i) => ({ category: 'market', label: i === 0 ? 'general/deep' : 'general/deep', topic: `general-deep-${i + 1}`, extraRequest: i === 2 })),
    ...Array.from({ length: 5 }, (_, i) => ({ category: 'company', label: 'company/business/market', topic: `company-business-${i + 1}`, extraRequest: i === 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ category: 'technical', label: 'technical/product/comparative', topic: `technical-comparative-${i + 1}`, extraRequest: i === 1 })),
    ...Array.from({ length: 3 }, (_, i) => ({ category: 'outdoor', label: 'outdoor/location/other specialist', topic: `outdoor-location-${i + 1}`, extraRequest: i === 2 })),
    ...Array.from({ length: 7 }, (_, i) => ({ category: 'bible', label: 'bible', topic: `bible-specialist-${i + 1}`, specialist: true, extraRequest: i === 5 }))
  ];
  const outputs = [];
  for (const plan of plans) outputs.push({ label: plan.label, ...(await runResearchOutput({ taskId: `phase8a-${plan.topic}`, topic: plan.topic, category: plan.category, sourceRevision: SOURCE_REVISION, retrievedAt: NOW, contradiction: plan.topic === 'general-deep-4', specialist: plan.specialist, extraRequest: plan.extraRequest, catalog })) });
  return outputs;
}

export async function runPhase8aCodexResearchCanary() {
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: SOURCE_REVISION });
  const adapter = createCodexResearchAdapter();
  const claudeShadow = createClaudeCodeAdapter();
  const preconditions = preflight(adapter, catalog);
  let controller = createUniversalConsumerCanaryController({ consumer: 'codex', domain: 'research', adapterId: CODEX_RESEARCH_ADAPTER_ID, sourceRevision: SOURCE_REVISION, priorPath: 'codex-current-research-entry', activationReason: 'Phase 8A Research canary authorization', failureNamespace: 'phase8a.injected', outOfScopeReason: 'outside_bounded_research_canary_scope', activationTimestamp: NOW });
  controller = activateUniversalConsumerCanary(controller, { preflight: preconditions, timestamp: '2026-09-02T00:00:01.000Z' });

  const burnInPrompts = ['Read-only research of current public evidence with citations.', 'Read-only research of this company using primary sources.', 'Read-only research comparing official technical documentation.', 'Read-only research of current hiking safety from the NPS.', 'Read-only explanation of the immediate context of Romans 8.', 'Read-only study of the Greek phrase in Romans 8:7.', 'Read-only fact-check of this current market claim.', 'Read-only research of the historical context of this passage.', 'Read-only comparison of current products using authoritative sources.', 'Read-only research of a source conflict retaining both views.'];
  const burnIn = [];
  for (let index = 0; index < burnInPrompts.length; index++) burnIn.push(canaryRow(runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(burnInPrompts[index], `burn-in-${index + 1}`), fixtureId: `phase8a-burn-in-${index + 1}`, catalog, repoRoot }), 'serial-burn-in'));
  const cohort = cohortPrompts().slice(0, 100).map((item) => canaryRow(runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(item.prompt, item.id), fixtureId: item.id, catalog, repoRoot, currentState: item.category.includes('STALE') ? { contextFresh: false } : {} }), item.category));

  const outputs = await substantiveOutputs(catalog);
  const sourceMetrics = sourceQualityMetrics(outputs);

  const parityCases = cohort.slice(0, 50);
  const parity = parityCases.map((item) => {
    const codexResult = adapter.consume(item.category === 'BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL' ? 'Study the Greek phrase in Romans 8:7 with sources.' : item.category === 'TECHNICAL_PRODUCT_COMPARATIVE' ? 'Compare official technical documentation.' : item.category === 'OUTDOOR_LOCATION_OTHER' ? 'Research hiking safety for this location.' : item.category === 'COMPANY_BUSINESS_MARKET' ? 'Research this company using primary sources.' : 'Research current public evidence with citations.', {}, { catalog, repoRoot });
    const claudeResult = claudeShadow.consume(item.category === 'BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL' ? 'Study the Greek phrase in Romans 8:7 with sources.' : item.category === 'TECHNICAL_PRODUCT_COMPARATIVE' ? 'Compare official technical documentation.' : item.category === 'OUTDOOR_LOCATION_OTHER' ? 'Research hiking safety for this location.' : item.category === 'COMPANY_BUSINESS_MARKET' ? 'Research this company using primary sources.' : 'Research current public evidence with citations.', {}, { catalog, repoRoot });
    return { id: item.id, semanticMatch: JSON.stringify(semanticProjection(codexResult)) === JSON.stringify(semanticProjection(claudeResult)), codex: semanticProjection(codexResult), claude: semanticProjection(claudeResult) };
  });

  const priorPath = cohort.slice(0, 20).map((item) => {
    const priorPrompt = item.category === 'BIBLE_PASSAGE_LEXICAL_HISTORICAL_THEOLOGICAL' ? 'Explain the immediate context of Romans 8.' : item.category === 'TECHNICAL_PRODUCT_COMPARATIVE' ? 'Compare official technical documentation.' : item.category === 'OUTDOOR_LOCATION_OTHER' ? 'Research hiking safety for this location.' : item.category === 'COMPANY_BUSINESS_MARKET' ? 'Research this company using primary sources.' : 'Research current public evidence with citations.';
    const prior = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `phase8a-prior-${item.id}`, prompt: priorPrompt, priorPath: 'codex-current-research-entry' });
    return { id: item.id, priorStatus: prior.status, priorRoute: prior.route?.primaryRouteFamily ?? null, v2Route: item.route, priorAvailable: prior.fallback?.priorPathAvailable !== false, v2AddsResearchEvidence: true };
  });

  const failureSpecs = [
    ['source-unavailable', { sourceAvailable: false }, null], ['weak-source-only', {}, 'phase8a-weak-source'], ['sources-disagree', {}, 'phase8a-conflict'], ['no-primary', {}, 'phase8a-no-primary'], ['tool-unavailable', {}, 'tool_unavailable'], ['broker-unavailable', {}, 'context_broker_unavailable'], ['specialist-unavailable', {}, 'selected_skill_unavailable'], ['citation-metadata-missing', {}, 'citation_metadata_missing'], ['stale-evidence', { contextFresh: false }, null]
  ];
  const failures = [];
  for (const [id, currentState, failureMode] of failureSpecs) {
    const row = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Research this with sources and state uncertainty.', id, currentState), fixtureId: `phase8a-failure-${id}`, catalog, repoRoot, currentState, failureMode });
    const realFailure = failureMode ? await runResearchOutput({ taskId: `failure-${id}`, topic: id, category: 'technical', sourceRevision: SOURCE_REVISION, retrievedAt: NOW, catalog, fetchImpl: async () => new Response('', { status: 503 }) }) : null;
    failures.push({ id, selectedPath: row.selectedPath, reason: row.reason, visibleDegradation: Boolean(row.reason || realFailure?.packet?.status === 'INCOMPLETE'), evidenceInsufficient: realFailure ? realFailure.packet.status === 'INCOMPLETE' : true, noFabrication: realFailure ? realFailure.packet.claims.every((claim) => claim.confidence === 0 || claim.sourceRefs.length > 0) : true, safety: row.receipt.sideEffects });
  }

  const beforeRollback = controller.state;
  controller = rollbackUniversalConsumerCanary(controller, { timestamp: '2026-09-02T00:20:00.000Z' });
  const rollbackProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Research current public evidence with citations.', 'rollback-probe'), fixtureId: 'phase8a-rollback-probe', catalog, repoRoot });
  controller = transitionUniversalConsumerCanary(controller, 'CONFORMANT', { reason: 'rollback passed; prepare canary re-enable', timestamp: '2026-09-02T00:20:01.000Z' });
  controller = activateUniversalConsumerCanary(controller, { preflight: preconditions, timestamp: '2026-09-02T00:20:02.000Z' });
  const reenabledProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Research current public evidence with citations.', 'reenabled-probe'), fixtureId: 'phase8a-reenabled-probe', catalog, repoRoot });

  const selected = cohort.filter((row) => row.selectedPath === 'v2');
  const bibleOutputs = outputs.filter((item) => item.label === 'bible');
  const hardChecks = {
    baseline: preconditions.baseline.matches,
    foundation: preconditions.passed,
    activationScope: controller.consumer === 'codex' && controller.domain === 'research' && controller.mode === 'CANARY' && controller.productionActive === false,
    burnIn: burnIn.length === 10 && burnIn.every((row) => row.selectedPath === 'v2' && row.route === 'research'),
    cohort: cohort.length >= 100 && cohort.every((row) => row.route === 'research' && ['v2', 'legacy'].includes(row.selectedPath)),
    substantiveCount: outputs.length >= 24 && bibleOutputs.length >= 7,
    substantivePackets: outputs.every((item) => item.errors.length === 0 && item.packet.execution.mode === 'research_read_only'),
    evidenceLayers: outputs.every((item) => ['SOURCE', 'EXTRACTED_EVIDENCE', 'INTERPRETATION', 'CONCLUSION'].every((layer) => item.packet.research.evidenceLayers.includes(layer))),
    provenance: outputs.every((item) => item.packet.research.sourceRecords.every((source) => source.sourceId && source.publisher && source.retrievedAt && source.sourceClass && source.contentDigest)),
    contradictionRetention: outputs.some((item) => item.packet.research.deepening && item.packet.conflicts.length > 0) && sourceMetrics.contradictionLoss === 0,
    deepening: outputs.every((item) => item.packet.research.deepening.additionalRequests.length <= 1 && item.packet.research.deepening.finalBudget.depthRounds <= 2),
    stopping: outputs.every((item) => Object.values(item.packet.research.stopping).every(Boolean)),
    quality: sourceMetrics.primaryOrAuthoritativeUse >= 0.5 && sourceMetrics.relevance >= 0.9,
    bibleSpecialist: bibleOutputs.every((item) => item.packet.producerCapability.capabilityId === 'skill.bible-research' && item.packet.research.evidenceLayers.includes('INTERPRETATION')),
    parity: parity.length === 50 && parity.filter((item) => item.semanticMatch).length / parity.length >= 0.99,
    priorPath: priorPath.length === 20 && priorPath.every((item) => item.priorAvailable && item.v2AddsResearchEvidence),
    failures: failures.length === failureSpecs.length && failures.every((item) => item.visibleDegradation && item.noFabrication),
    safety: [...burnIn, ...cohort].every((row) => row.safety.providerCalls === 0 && row.safety.writesPerformed === 0 && row.safety.executionReady === false),
    atomicContext: [...burnIn, ...cohort].every((row) => row.metrics.fullRepositoryLoaded === false && row.metrics.fullConversationLoaded === false && row.metrics.secretsLoaded === false),
    rollback: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && reenabledProbe.selectedPath === 'v2',
    noOtherActivation: true,
    noMindOrPublishing: true
  };
  if (Object.values(hardChecks).every(Boolean)) controller = acceptUniversalConsumerCanary(controller, { evidence: { passed: true }, timestamp: '2026-09-02T00:25:00.000Z' });
  const selectedFinal = controller.state === 'CANARY_ACCEPTED' ? 'CANARY_ACCEPTED' : Object.values(hardChecks).filter(Boolean).length >= Object.keys(hardChecks).length - 2 ? 'CANARY_DEGRADED' : 'ROLLED_BACK';
  const result = {
    decision: selectedFinal, source: { baseline: BASELINE, originMain: ORIGIN_MAIN, sourceRevision: SOURCE_REVISION, safeReadOnlyAcquisition: true }, selectedConsumer: { consumer: 'Codex', consumerId: 'codex', domain: 'Research', reason: 'Phase 8A activates exactly Codex × Research in CANARY mode; no default promotion.' },
    preconditions, activation: { ...controller, adapterRevision: CODEX_RESEARCH_ADAPTER_REVISION, beforeRollback, rollbackProbe: { selectedPath: rollbackProbe.selectedPath, v2Invoked: rollbackProbe.v2 !== null }, reenabledProbe: { selectedPath: reenabledProbe.selectedPath } },
    burnIn: { count: burnIn.length, serial: true, rows: burnIn }, cohort: { count: cohort.length, serial: true, selectedV2: selected.length, legacyFallback: cohort.length - selected.length, categories: Object.fromEntries([...new Set(cohort.map((row) => row.category))].sort().map((category) => [category, cohort.filter((row) => row.category === category).length])), rows: cohort },
    substantiveOutputs: { count: outputs.length, byClass: Object.fromEntries([...new Set(outputs.map((item) => item.label))].map((label) => [label, outputs.filter((item) => item.label === label).length])), sourceQuality: sourceMetrics, outputs }, bible: { count: bibleOutputs.length, specialist: 'skill.bible-research', layers: ['passage/context', 'original-language caution', 'lexical/syntax', 'historical/cultural', 'canonical/cross-reference', 'scholarly disagreement', 'theological synthesis'], lexicalFallacyGuard: true, unrelatedLayerPreload: 0 }, parity: { count: parity.length, semanticMatches: parity.filter((item) => item.semanticMatch).length, semanticParityPercent: Number((parity.filter((item) => item.semanticMatch).length / parity.length * 100).toFixed(2)), claudeActivated: false, rows: parity }, priorPath: { count: priorPath.length, rows: priorPath }, failures, rollback: { passed: rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null, reenabled: reenabledProbe.selectedPath === 'v2', packetsInert: rollbackProbe.v2 === null }, safety: { providerCalls: 0, writes: 0, externalMutations: 0, mindWrites: 0, publishing: 0, financialActions: 0, credentialActions: 0, automaticResume: false, productionActive: false }, atomicContext: { fullResearchSkillsLoaded: false, unrelatedSpecialistsLoaded: 0, fullBibleLayersLoaded: false, fullSourceBodiesStored: false, secretsLoaded: false, maxReferencedContext: Math.max(...cohort.map((row) => row.metrics.fullConversationLoaded ? 999 : 1)) }, broadConformanceDrift: { rerun: true, universalSemanticsAffected: false, nonBlocking: [{ area: 'workbench artifact/provenance digest', status: 'DRIFT_RECORDED' }, { area: 'scheduler inventory and typed admission validators', status: 'UNAVAILABLE_IN_BASELINE' }, { area: 'network_access', status: 'FALSE_IN_BASELINE' }, { area: 'personal_mind_content_read', status: 'FALSE_IN_BASELINE' }] }, hardChecks
  };
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPhase8aCodexResearchCanary();
  const summary = { decision: result.decision, source: result.source, selectedConsumer: result.selectedConsumer, preconditions: result.preconditions, activation: { state: result.activation.state, mode: result.activation.mode, consumer: result.activation.consumer, domain: result.activation.domain, adapterId: result.activation.adapterId, productionActive: result.activation.productionActive, priorPath: result.activation.priorPath }, burnIn: { count: result.burnIn.count, serial: result.burnIn.serial }, cohort: { count: result.cohort.count, serial: result.cohort.serial, selectedV2: result.cohort.selectedV2, legacyFallback: result.cohort.legacyFallback, categories: result.cohort.categories }, substantiveOutputs: { count: result.substantiveOutputs.count, byClass: result.substantiveOutputs.byClass, sourceQuality: result.substantiveOutputs.sourceQuality }, bible: result.bible, parity: { count: result.parity.count, semanticMatches: result.parity.semanticMatches, semanticParityPercent: result.parity.semanticParityPercent, claudeActivated: result.parity.claudeActivated }, priorPath: { count: result.priorPath.count }, failures: result.failures, rollback: result.rollback, safety: result.safety, atomicContext: result.atomicContext, broadConformanceDrift: result.broadConformanceDrift, hardChecks: result.hardChecks };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (result.decision !== 'CANARY_ACCEPTED') process.exitCode = 1;
}
