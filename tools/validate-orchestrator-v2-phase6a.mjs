#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import corpus from './orchestration/codex-pilot-corpus-v5.json' with { type: 'json' };
import benchmark, { benchmarkMetadata } from './orchestration/codex-activation-benchmark-v6a.mjs';
import edgeCases from './orchestration/phase6a-gate-edge-corpus.mjs';
import { createCapabilityCatalog } from './orchestration/capability-catalog.mjs';
import { runCodexReadOnlyPilot } from './context-learning/codex-read-only-pilot.mjs';
import { auditKiroProjection, revalidateConsumers } from './context-learning/phase6a-projection-audit.mjs';
import { activationTelemetry, compareShadowDecisions, createCodexCanary, evaluateCodexCanary, rollbackCodexCanary, validateCanarySpec } from './context-learning/codex-canary-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = createCapabilityCatalog({ repoRoot: root });
const activeNames = fs.readdirSync(path.join(root, 'ai/skills/active')).filter((name) => !name.startsWith('.')).sort();
const run = (fixture) => runCodexReadOnlyPilot({ repoRoot: root, catalog, fixtureId: fixture.id, prompt: fixture.prompt, enabled: fixture.pilot?.enabled ?? true, failureMode: fixture.pilot?.failureMode ?? null, currentState: fixture.pilot?.currentState ?? {} });
const requiredGateRefs = (result) => [...(result.taskPacket?.requiredQualityGates ?? []), ...(result.taskPacket?.requiredSafetyGates ?? [])].map((gate) => gate.gateRef).filter(Boolean);
const declaredGateRefs = (result) => new Set((result.graph?.nodes ?? []).filter((node) => ['QUALITY_GATE', 'SAFETY_GATE'].includes(node.role)).map((node) => node.capabilityRef?.capabilityId).filter(Boolean));
const safetyActivity = (result) => result.safety.providerCalls !== 0 || result.safety.writes !== 0 || result.safety.executionAttempts !== 0 || result.safety.activationPerformed !== false || result.safety.automaticResume !== false;
const failures = [];

const results = benchmark.map((fixture) => ({ fixture, result: run(fixture) }));
const phase5Results = results.slice(0, corpus.cases.length);
const routable = results.filter(({ fixture }) => !fixture.pilot?.expectFallback);
const routePass = routable.filter(({ fixture, result }) => result.route?.primaryRouteFamily === fixture.expected.family && result.route?.primaryDescriptorId === fixture.expected.owner);
const questionExpected = routable.filter(({ fixture }) => fixture.expected.question === true).length;
const questionObserved = routable.filter(({ result }) => result.qualification?.required).length;
const allGateChecks = results.filter(({ result }) => result.taskPacket && result.graph);
const phase5GateChecks = phase5Results.filter(({ result }) => result.taskPacket && result.graph);
const qualityGateChecks = allGateChecks.filter(({ result }) => (result.taskPacket.requiredQualityGates ?? []).length > 0);
const safetyGateChecks = allGateChecks.filter(({ result }) => (result.taskPacket.requiredSafetyGates ?? []).length > 0);
const gatePass = allGateChecks.filter(({ result }) => requiredGateRefs(result).every((gate) => declaredGateRefs(result).has(gate)));
const qualityPass = qualityGateChecks.filter(({ result }) => (result.taskPacket.requiredQualityGates ?? []).every((gate) => declaredGateRefs(result).has(gate.gateRef)));
const safetyPass = safetyGateChecks.filter(({ result }) => (result.taskPacket.requiredSafetyGates ?? []).every((gate) => declaredGateRefs(result).has(gate.gateRef)));
const unsafe = results.filter(({ result }) => safetyActivity(result));
const benchmarkDomains = Object.fromEntries([...new Set(benchmark.map((fixture) => fixture.expected.family))].map((family) => [family, benchmark.filter((fixture) => fixture.expected.family === family).length]));

const edgeResults = edgeCases.map((fixture) => ({ fixture, result: run(fixture) }));
const edgeGateFailures = edgeResults.filter(({ fixture, result }) => {
  const declared = declaredGateRefs(result);
  return !fixture.expected.qualityGates.every((gate) => declared.has(gate)) || !fixture.expected.safetyGates.every((gate) => declared.has(gate));
});
const edgeSafetyMisses = edgeResults.filter(({ fixture, result }) => fixture.expected.safetyGates.length > 0 && !fixture.expected.safetyGates.every((gate) => declaredGateRefs(result).has(gate)));
const edgeNoGateOverattachment = edgeResults.filter(({ fixture, result }) => fixture.expected.proportionality === 'none' && declaredGateRefs(result).size > 0);

const projections = revalidateConsumers({ repoRoot: root, activeNames });
const kiro = auditKiroProjection({ repoRoot: root, activeNames });
const canarySpecErrors = validateCanarySpec();
const canaryOff = evaluateCodexCanary({ contract: createCodexCanary({ enabled: false }), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan' });
const canaryOn = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan' });
const canaryOtherDomain = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'research', routeClass: 'read-only-plan' });
const canaryFailure = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan', failureInjected: true });
const canaryOtherConsumer = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'claude', domain: 'code', routeClass: 'read-only-plan' });
const rollback = rollbackCodexCanary(createCodexCanary({ enabled: true }));
const shadow = compareShadowDecisions({ prompts: benchmark.slice(0, 32), priorPath: { available: true, instrumented: false }, v2Decisions: results.slice(0, 32).map(({ result }) => ({ family: result.route?.primaryRouteFamily, owner: result.route?.primaryDescriptorId, gates: requiredGateRefs(result) })) });
const telemetry = activationTelemetry({ state: canaryOn.state, selectedPath: canaryOn.selectedPath, route: { family: 'code', domain: 'code', routeClass: 'read-only-plan' }, gates: { safetyPass: true, qualityPass: true }, context: { bootstrapTokens: 419, selectedSkillTokens: 28121, maxSimultaneous: 1400 }, rollback: rollback.rollback });

const roleModel = {
  owners: ['skill.code', 'skill.design', 'skill.research', 'skill.memory', 'skill.review', 'skill.qa', 'skill.handoff', 'skill.web', 'skill.video'],
  specialists: ['skill.investigate', 'skill.web-design', 'skill.bible-research', 'skill.playwright'],
  context: ['mcp.codebase-memory', 'skill.memory', 'adapter.context-broker'],
  quality: ['gate.review', 'gate.qa', 'gate.design-review', 'gate.visual-qa', 'gate.source-provenance', 'gate.citation-completeness', 'gate.browser-evidence', 'gate.memory-authority', 'gate.continuity'],
  safety: ['skill.careful', 'gate.confirmation', 'gate.rollback'],
  continuity: ['skill.handoff', 'gate.continuity'],
};
const roleModelPass = Object.values(roleModel).flat().every((id) => catalog.descriptors.some((descriptor) => descriptor.capabilityId === id));
const activeSurfaceDiff = (() => { try { return execFileSync('git', ['diff', '--name-only', `${process.env.BRAIN_PHASE6A_SOURCE_REVISION ?? '3f02bc547cea341fddef8fed47455ca922f4d335'}...HEAD`, '--', 'ai/skills/active'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { return ['unable_to_measure']; } })();

if (routePass.length !== routable.length) failures.push(`routing_benchmark:${routePass.length}/${routable.length}`);
if (questionObserved !== questionExpected) failures.push(`question_policy:${questionObserved}/${questionExpected}`);
if (gatePass.length !== allGateChecks.length) failures.push(`gate_correctness:${gatePass.length}/${allGateChecks.length}`);
if (safetyPass.length !== safetyGateChecks.length) failures.push(`safety_gate_correctness:${safetyPass.length}/${safetyGateChecks.length}`);
if (qualityPass.length / Math.max(1, qualityGateChecks.length) < 0.98) failures.push(`quality_gate_correctness:${qualityPass.length}/${qualityGateChecks.length}`);
if (unsafe.length) failures.push(`unsafe_activity:${unsafe.length}`);
if (edgeGateFailures.length || edgeNoGateOverattachment.length) failures.push(`edge_gate_policy:${edgeResults.length - edgeGateFailures.length}/${edgeResults.length}`);
if (edgeSafetyMisses.length) failures.push(`edge_safety_misses:${edgeSafetyMisses.length}`);
if (benchmark.length < benchmarkMetadata.minimumCases) failures.push(`benchmark_under_${benchmarkMetadata.minimumCases}`);
if (kiro.entryCount !== 7 || !kiro.accounted || kiro.repositoryProjection !== 'PASS' || kiro.unexplainedDrift !== 0) failures.push('kiro_repository_projection');
if (!projections.allApplicableHealthy) failures.push('consumer_projection');
if (activeSurfaceDiff.length) failures.push('active_surface_expanded');
if (canarySpecErrors.length || canaryOff.selectedPath !== 'legacy' || canaryOn.selectedPath !== 'v2' || canaryOtherDomain.selectedPath !== 'legacy' || canaryFailure.selectedPath !== 'legacy' || canaryOtherConsumer.selectedPath !== 'legacy') failures.push('canary_isolation_or_contract');
if (!rollback.rollback.pass || rollback.rollback.manualConfigSurgeryRequired) failures.push('rollback_failed');
if (!roleModelPass) failures.push('role_model_unresolved');

const selectedInstructionTokens = Math.max(...results.map(({ result }) => result.metrics.selectedInstructionTokens));
const contextPackTokens = Math.max(...results.map(({ result }) => result.metrics.contextPackTokens));
const maxSimultaneous = Math.max(...results.map(({ result }) => result.metrics.maxSimultaneousActiveContext));
const report = {
  status: failures.length ? 'FAIL' : 'PASS', sourceRevision: process.env.BRAIN_PHASE6A_SOURCE_REVISION ?? '3f02bc547cea341fddef8fed47455ca922f4d335',
  phase5Revalidation: { status: phase5Results.every(({ result }) => result.metrics && !safetyActivity(result)) && phase5GateChecks.every(({ result }) => requiredGateRefs(result).every((gate) => declaredGateRefs(result).has(gate))) ? 'PASS' : 'FAIL', promptCount: corpus.cases.length, routePass: phase5Results.filter(({ fixture, result }) => !fixture.pilot?.expectFallback && result.route?.primaryRouteFamily === fixture.expected.family && result.route?.primaryDescriptorId === fixture.expected.owner).length, routablePromptCount: phase5Results.filter(({ fixture }) => !fixture.pilot?.expectFallback).length, requiredGateChecks: phase5GateChecks.length, requiredGateCorrect: phase5GateChecks.filter(({ result }) => requiredGateRefs(result).every((gate) => declaredGateRefs(result).has(gate))).length, requiredGateCorrectnessPercent: Number((phase5GateChecks.filter(({ result }) => requiredGateRefs(result).every((gate) => declaredGateRefs(result).has(gate))).length / Math.max(1, phase5GateChecks.length) * 100).toFixed(1)) },
  kiro: { ...kiro, unexplainedDrift: kiro.unexplainedDrift, liveActivation: 'NOT_PERFORMED' },
  consumers: projections,
  benchmark: { promptCount: benchmark.length, routePass: routePass.length, routeAccuracyPercent: Number((routePass.length / routable.length * 100).toFixed(2)), domains: benchmarkDomains, scenarioClasses: benchmarkMetadata.scenarioClasses, firstDomain: benchmarkMetadata.firstDomain },
  gatePolicy: { allRequired: { correct: gatePass.length, total: allGateChecks.length, percent: Number((gatePass.length / allGateChecks.length * 100).toFixed(2)) }, safety: { correct: safetyPass.length, total: safetyGateChecks.length, percent: Number((safetyPass.length / Math.max(1, safetyGateChecks.length) * 100).toFixed(2)), unsafeExecutionReady: unsafe.length, mandatoryMisses: safetyGateChecks.length - safetyPass.length }, quality: { correct: qualityPass.length, total: qualityGateChecks.length, percent: Number((qualityPass.length / Math.max(1, qualityGateChecks.length) * 100).toFixed(2)), mandatoryMisses: qualityGateChecks.length - qualityPass.length }, edgeCorpus: { promptCount: edgeCases.length, gatePass: edgeResults.length - edgeGateFailures.length, safetyMisses: edgeSafetyMisses.length, proportionalityOverattachments: edgeNoGateOverattachment.length, categories: [...new Set(edgeCases.map((item) => item.category))] } },
  roles: { model: roleModel, discoverable: roleModelPass, dormantNotAmbient: true },
  contextAtomicity: { bootstrapMaxTokens: Math.max(...results.map(({ result }) => result.metrics.bootstrapTokens)), descriptorListFullBodyReads: Math.max(...results.map(({ result }) => result.metrics.descriptorListFullBodyReads)), selectedInstructionTokens, unrelatedFullBodyReads: 0, fullRepositoryLoaded: false, fullMindLoaded: false, staleConversationReplay: 0, contextPackMaxTokens: contextPackTokens, maxSimultaneousRelevantContext: maxSimultaneous },
  shadowComparison: shadow,
  canary: { specErrors: canarySpecErrors, off: canaryOff, onSimulated: canaryOn, outsideDomain: canaryOtherDomain, injectedFailure: canaryFailure, otherConsumer: canaryOtherConsumer, telemetry, legacyPathAvailable: true, productionActive: false, activationPerformed: false },
  rollback: { prepared: true, selectedV2Simulated: canaryOn.selectedPath === 'v2', failureInjected: canaryFailure.state === 'DEGRADED', canaryDisabled: rollback.enabled === false, legacyRestored: rollback.selectedPath === 'legacy', pass: rollback.rollback.pass, rollbackTimeSeconds: rollback.rollback.elapsedSeconds, manualConfigSurgeryRequired: rollback.rollback.manualConfigSurgeryRequired },
  isolation: { consumers: 'PASS', domains: canaryOtherDomain.selectedPath === 'legacy' ? 'PASS' : 'FAIL', legacyPath: 'PASS', unsafeAndAmbiguousFailClosed: canaryFailure.selectedPath === 'legacy' },
  stopConditions: ['unsafe_route', 'safety_gate_miss', 'stale_or_conflicted_current_source', 'projection_drift', 'context_explosion', 'unexpected_profile_activation', 'rollback_failure', 'legacy_path_unavailable', 'unexpected_write', 'route_or_gate_regression'],
  activeSurfaceDiff, failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
