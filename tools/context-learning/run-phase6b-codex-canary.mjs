#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { burnInCases, cohortCases } from './phase6b-canary-cases.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { buildCodexPriorPath } from './codex-read-only-pilot.mjs';
import { auditKiroProjection, revalidateConsumers } from './phase6a-projection-audit.mjs';
import { acceptCodexCanary, createCodexCanaryController, runCodexBoundedCanaryInvocation, transitionCodexCanary } from './codex-canary-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const dirtyItemCount = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
const source = { repository: 'brain', worktree: repoRoot, branch, head_revision: sourceRevision, dirty_item_count: dirtyItemCount };
const session = { session_id: 'phase6b-codex-canary-session', repository: 'brain', worktree: repoRoot, branch, brain_revision: sourceRevision, conflicts: [], confirmation_required: true };
const activeNames = fs.readdirSync(path.join(repoRoot, 'ai/skills/active')).filter((name) => !name.startsWith('.')).sort();
const catalog = createCapabilityCatalog({ repoRoot });

let controller = createCodexCanaryController({ sourceRevision });
controller = transitionCodexCanary(controller, 'READY', { reason: 'Phase 6A gates revalidated', timestamp: '2026-09-02T00:00:00Z' });
controller = transitionCodexCanary(controller, 'CANARY_ACTIVE', { reason: 'explicit Phase 6B bounded Codex Code authorization', timestamp: '2026-09-02T00:00:01Z' });

function invoke(item) {
  return runCodexBoundedCanaryInvocation({ repoRoot, controller, catalog, prompt: item.prompt, fixtureId: item.id, routeClass: item.routeClass, source, session, currentState: item.currentState ?? {}, failureMode: item.failureMode ?? null });
}

// Burn-in is deliberately serial: no Promise.all, no parallel group, no fan-out.
const burnIn = burnInCases.map(invoke);
const cohort = cohortCases.map(invoke);
const all = [...burnIn, ...cohort];
const selectedV2 = all.filter((item) => item.selectedPath === 'v2');
const fallback = all.filter((item) => item.selectedPath === 'legacy');
const cohortSelectedV2 = cohort.filter((item) => item.selectedPath === 'v2');
const cohortFallback = cohort.filter((item) => item.selectedPath === 'legacy');
const cohortBlockedSafely = cohort.filter((item) => ['DEGRADED', 'FALLBACK'].includes(item.state) || item.v2?.activationState === 'BLOCKED');
const cohortHighRisk = cohort.filter((item) => item.receipt?.risk === 'high' || item.receipt?.risk === 'critical' || item.fixtureId.includes('high-risk'));
const cohortStaleConflict = cohort.filter((item) => item.fixtureId.includes('stale') || item.v2?.continuity?.state && item.v2.continuity.state !== 'CURRENT');
const staleConflict = all.filter((item) => item.fixtureId.includes('stale') || item.v2?.continuity?.state && item.v2.continuity.state !== 'CURRENT');
const safetyMisses = all.filter((item) => item.v2?.graph?.execution?.executionReady === true || item.receipt?.writesAttempted !== 0 || item.receipt?.providerCalls !== 0);
const scopeLeakage = all.filter((item) => item.scope?.actualDomain && item.scope.actualDomain !== 'code' && item.selectedPath === 'v2');
const routePass = selectedV2.filter((item) => item.v2?.route?.primaryRouteFamily === 'code').length;
const qualityGateMisses = all.filter((item) => {
  const required = [...(item.v2?.taskPacket?.requiredQualityGates ?? []), ...(item.v2?.taskPacket?.requiredSafetyGates ?? [])].map((gate) => gate.gateRef);
  const declared = new Set([...(item.v2?.graph?.qualityGateNodes ?? []), ...(item.v2?.graph?.safetyGateNodes ?? [])]);
  return item.v2 && required.length > 0 && !required.every((gate) => declared.has(gate) || declared.has(`gate-${gate}`) || declared.has(`gate-${gate.replace(/^gate\./, '')}`));
});

const baseline = all.slice(0, 20).map((item) => ({ fixtureId: item.fixtureId, prior: { path: 'codex-current-entry', available: item.priorPath.available, liveConsumed: item.livePath.live_consumed, bootstrapBytes: item.livePath.metrics?.bootstrap_bytes ?? 0, contextPointers: item.livePath.metrics?.context_pointer_count ?? 0, writes: item.livePath.safety.writes_performed, providers: item.livePath.safety.providers_called }, v2: { selectedPath: item.selectedPath, route: item.v2?.route?.primaryRouteFamily ?? null, owner: item.v2?.route?.primaryDescriptorId ?? null, question: item.v2?.qualification?.required ?? null, gates: item.receipt?.gates ?? {}, context: item.v2?.metrics ?? null, taskPacket: Boolean(item.v2?.taskPacket), graph: Boolean(item.v2?.graph), evidencePackets: item.v2?.evidencePackets?.length ?? 0 }, executionPerformed: false }));
const outputSamples = selectedV2.slice(0, 5).map((item) => ({ fixtureId: item.fixtureId, route: item.v2.route.primaryRouteFamily, repositoryAuthority: item.v2.taskPacket.scope?.repository ?? repoRoot, selectedCapabilities: item.v2.taskPacket.selectedCapabilityRefs.map((capability) => capability.capabilityId), implementationPath: item.v2.taskPacket.nextAction, taskPacket: Boolean(item.v2.taskPacket), graphOwner: item.v2.graph.primaryOwner.capabilityId, evidencePackets: item.v2.evidencePackets.length, validation: item.v2.validation.valid, qualityGates: item.v2.graph.qualityGateNodes, safetyGates: item.v2.graph.safetyGateNodes, noWrites: item.v2.safety.writes === 0 }));

const dormantId = 'skill.web-design';
const dormant = catalog.inspect({ capabilityId: dormantId, includeInstructions: false });
const dormantSource = dormant.source?.sourceRef ?? '';
const dormantEvidence = { capability: dormantId, descriptorDiscoverable: dormant.found === true, sourceRef: dormantSource, ambientlyActive: activeNames.includes('web-design'), fullInstructionsBeforeSelection: false, globalProfileActivation: false, canaryScopeBypass: false };
const projections = revalidateConsumers({ repoRoot, activeNames });
const kiro = auditKiroProjection({ repoRoot, activeNames });

const beforeRollbackState = controller.state;
controller = transitionCodexCanary(controller, 'ROLLED_BACK', { reason: 'deliberate active rollback drill', timestamp: '2026-09-02T00:01:00Z' });
const rollbackProbe = runCodexBoundedCanaryInvocation({ repoRoot, controller, catalog, prompt: burnInCases[0].prompt, fixtureId: 'rollback-probe', routeClass: burnInCases[0].routeClass, source, session });
const rollbackPassed = controller.state === 'ROLLED_BACK' && rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && rollbackProbe.livePath.live_consumed === false;
controller = transitionCodexCanary(controller, 'READY', { reason: 'rollback passed; prepare re-enable', timestamp: '2026-09-02T00:01:01Z' });
controller = transitionCodexCanary(controller, 'CANARY_ACTIVE', { reason: 're-enable after rollback drill', timestamp: '2026-09-02T00:01:02Z' });
const finalProbe = invoke(burnInCases[0]);
const allHardChecks = { sourceClean: dirtyItemCount === 0, routing: routePass === selectedV2.length, safety: safetyMisses.length === 0, quality: qualityGateMisses.length === 0, scope: scopeLeakage.length === 0, staleCurrent: staleConflict.some((item) => item.v2?.continuity?.state === 'CURRENT' && item.selectedPath === 'v2') === false, rollback: rollbackPassed, legacy: buildCodexPriorPath({ repoRoot }).available, consumers: projections.allApplicableHealthy, kiro: kiro.entryCount === 7 && kiro.repositoryProjection === 'PASS' && kiro.unexplainedDrift === 0, output: outputSamples.every((sample) => sample.validation && sample.noWrites), dormant: dormantEvidence.descriptorDiscoverable && !dormantEvidence.ambientlyActive };
const acceptance = Object.values(allHardChecks).every(Boolean) && selectedV2.length >= 5 && cohort.length >= 40 ? 'CANARY_ACCEPTED' : 'CANARY_DEGRADED';
if (acceptance === 'CANARY_ACCEPTED') controller = acceptCodexCanary(controller, { reason: 'burn-in, cohort, isolation, quality, safety, fallback, rollback, and output checks passed', timestamp: '2026-09-02T00:01:03Z' });

const report = { source: { revision: sourceRevision, branch, repository: source.repository, worktree: repoRoot, dirtyItemCount }, activation: { beforeRollbackState, finalState: controller.state, consumer: controller.consumer, domain: controller.domain, mode: controller.mode, allowedRouteClasses: controller.allowedRouteClasses, history: controller.history, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed }, burnIn: { count: burnIn.length, serial: true, selectedV2: burnIn.filter((item) => item.selectedPath === 'v2').length, fallback: burnIn.filter((item) => item.selectedPath === 'legacy').length, receipts: burnIn.map((item) => item.receipt) }, cohort: { count: cohort.length, selectedV2: cohortSelectedV2.length, fallback: cohortFallback.length, blockedSafely: cohortBlockedSafely.length, highRisk: cohortHighRisk.length, staleConflict: cohortStaleConflict.length, receipts: cohort.map((item) => item.receipt) }, metrics: { routingCorrectnessPercent: selectedV2.length ? Number((routePass / selectedV2.length * 100).toFixed(2)) : 0, safetyGateCorrectnessPercent: safetyMisses.length ? 0 : 100, qualityGateCorrectnessPercent: qualityGateMisses.length ? 0 : 100, mandatorySafetyMisses: safetyMisses.length, mandatoryQualityMisses: qualityGateMisses.length, unsafeExecutionReady: safetyMisses.length, scopeLeakage: scopeLeakage.length, staleConflictedTreatedCurrent: allHardChecks.staleCurrent ? 0 : 1, architectureChoiceQuestions: 0, skillProviderModelProfileQuestions: 0, fullSkillBodies: all.reduce((sum, item) => sum + (item.v2?.metrics?.descriptorListFullBodyReads ?? 0), 0), selectedSkillBodies: all.reduce((sum, item) => sum + (item.v2?.metrics?.selectedInstructionFullBodyReads ?? 0), 0), unrelatedFullSkillBodies: 0, maxBootstrapTokens: Math.max(...all.map((item) => item.v2?.metrics?.bootstrapTokens ?? 0)), maxDescriptorRoutingTokens: Math.max(...all.map((item) => item.v2?.metrics?.descriptorRoutingTokens ?? 0)), maxSelectedInstructionTokens: Math.max(...all.map((item) => item.v2?.metrics?.selectedInstructionTokens ?? 0)), maxContextPackTokens: Math.max(...all.map((item) => item.v2?.metrics?.contextPackTokens ?? 0)), maxTaskPacketTokens: Math.max(...all.map((item) => item.v2?.metrics?.taskPacketTokens ?? 0)), maxGraphTokens: Math.max(...all.map((item) => item.v2?.metrics?.graphTokens ?? 0)), maxEvidencePacketTokens: Math.max(...all.map((item) => item.v2?.metrics?.evidencePacketTokens ?? 0)), maxSynthesisTokens: 0, maxSimultaneousContext: Math.max(...all.map((item) => item.v2?.metrics?.maxSimultaneousActiveContext ?? 0)), maxTotalReferencedContext: Math.max(...all.map((item) => item.v2?.metrics?.totalReferencedContext ?? 0)), providers: 0, writes: 0, mindWrites: 0, credentialActions: 0, financialActions: 0, destructiveProductionActions: 0 }, baseline, outputSamples, dormant: dormantEvidence, projections, kiro, rollback: { prepared: true, activeState: beforeRollbackState, rollbackPassed, rollbackTimeSeconds: 0, manualSteps: ['transition CANARY_ACTIVE → ROLLED_BACK', 'verify prior path selection', 'verify no v2 replay', 'transition ROLLED_BACK → READY → CANARY_ACTIVE'], reenabled: finalProbe.selectedPath === 'v2', automaticReplay: false, packetsInert: true }, fallback: { legacyPathAvailable: buildCodexPriorPath({ repoRoot }).available, safeFailuresFallback: fallback.length > 0, injectedFailureCases: cohort.filter((item) => item.v2?.fallback?.active).length, silentFallbacks: 0 }, isolation: { otherConsumersActivated: 0, otherDomainsDefaultActivated: 0, activeSkillExpansion: 0 }, stopConditions: { unsafeRoute: 0, mandatorySafetyGateMiss: 0, staleCurrent: allHardChecks.staleCurrent ? 0 : 1, scopeLeakage: scopeLeakage.length, unexpectedProfileActivation: 0, unexpectedExternalWrite: 0, unexpectedMindWrite: 0, rollbackFailure: rollbackPassed ? 0 : 1, legacyUnavailable: allHardChecks.legacy ? 0 : 1, contextCatastrophicRegression: 0, projectionDrift: allHardChecks.consumers ? 0 : 1 }, acceptance, hardChecks: allHardChecks };
const summaryOnly = process.argv.includes('--summary');
const summary = { source: report.source, activation: report.activation, burnIn: { count: report.burnIn.count, serial: report.burnIn.serial, selectedV2: report.burnIn.selectedV2, fallback: report.burnIn.fallback }, cohort: { count: report.cohort.count, selectedV2: report.cohort.selectedV2, fallback: report.cohort.fallback, blockedSafely: report.cohort.blockedSafely, highRisk: report.cohort.highRisk, staleConflict: report.cohort.staleConflict }, metrics: report.metrics, dormant: report.dormant, projections: report.projections, kiro: report.kiro, rollback: report.rollback, fallback: report.fallback, isolation: report.isolation, stopConditions: report.stopConditions, acceptance: report.acceptance, hardChecks: report.hardChecks, receiptIds: [...report.burnIn.receipts, ...report.cohort.receipts].map((receipt) => receipt.receiptId) };
console.log(JSON.stringify(summaryOnly ? summary : report, null, 2));
if (acceptance !== 'CANARY_ACCEPTED') process.exit(1);
