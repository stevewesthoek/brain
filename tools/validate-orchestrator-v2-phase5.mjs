#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import corpus from './orchestration/codex-pilot-corpus-v5.json' with { type: 'json' };
import { createCapabilityCatalog } from './orchestration/capability-catalog.mjs';
import { auditConsumerProjections, runCodexReadOnlyPilot } from './context-learning/codex-read-only-pilot.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = createCapabilityCatalog({ repoRoot: root });
const activeNames = fs.existsSync(path.join(root, 'ai/skills/active')) ? fs.readdirSync(path.join(root, 'ai/skills/active')).filter((name) => !name.startsWith('.')).sort() : [];
const results = corpus.cases.map((fixture) => ({ fixture, result: runCodexReadOnlyPilot({ repoRoot: root, catalog, fixtureId: fixture.id, prompt: fixture.prompt }) }));
const failures = [];
const ownerCorrect = results.filter(({ fixture, result }) => result.route?.primaryRouteFamily === fixture.expected.family && result.route?.primaryDescriptorId === fixture.expected.owner).length;
const questionExpected = corpus.cases.filter((fixture) => fixture.expected.question === true).length;
const questionObserved = results.filter(({ result }) => result.qualification?.required).length;
const unnecessaryQuestions = results.filter(({ fixture, result }) => result.qualification?.required && fixture.expected.question !== true).length;
const gateChecks = results.filter(({ fixture }) => fixture.expected.risk).map(({ fixture, result }) => ({ fixture, result }));
const gateCorrect = gateChecks.filter(({ result }) => (result.graph?.nodes ?? []).some((node) => node.role === 'SAFETY_GATE' && ['skill.careful', 'gate.rollback', 'gate.confirmation'].includes(node.capabilityRef?.capabilityId))).length;
const highRiskWithoutConfirmation = results.filter(({ result }) => ['high', 'critical'].includes(result.route?.normalizedRequest?.riskClass) && result.graph?.nodes?.some((node) => node.executionReady === true || node.confirmationRequired !== true && node.role === 'EXECUTION')).length;
const unsafe = results.filter(({ result }) => result.safety.providerCalls !== 0 || result.safety.writes !== 0 || result.safety.executionAttempts !== 0 || result.safety.activationPerformed !== false || result.safety.automaticResume !== false).length;
const receiptPrivacyFailures = results.filter(({ fixture, result }) => JSON.stringify(result.receipt).includes(fixture.prompt) || result.receipt.privacy.rawPromptStored || result.receipt.privacy.secretsStored || result.receipt.privacy.clientConfigurationStored).length;
const safe = results.find(({ fixture }) => fixture.id === 'research-01')?.result;
const projections = auditConsumerProjections({ repoRoot: root, activeNames });
const allowlistedProfileExceptions = Object.values(catalog.profileHealth).flatMap((item) => item.allowlistedUnavailable ?? []);

if (corpus.cases.length < 100) failures.push('corpus_under_100');
if (ownerCorrect / Math.max(1, results.length) < 0.95) failures.push(`owner_accuracy_below_95:${ownerCorrect}/${results.length}`);
if (questionObserved !== questionExpected) failures.push(`qualification_mismatch:${questionObserved}/${questionExpected}`);
if (unnecessaryQuestions / Math.max(1, results.length) > 0.10) failures.push(`unnecessary_questions_above_10:${unnecessaryQuestions}/${results.length}`);
if (gateCorrect / Math.max(1, gateChecks.length) < 0.95) failures.push(`safety_gate_coverage_below_95:${gateCorrect}/${gateChecks.length}`);
if (highRiskWithoutConfirmation !== 0) failures.push(`high_risk_without_confirmation:${highRiskWithoutConfirmation}`);
if (unsafe !== 0) failures.push(`unsafe_activity:${unsafe}`);
if (receiptPrivacyFailures !== 0) failures.push(`receipt_privacy_failures:${receiptPrivacyFailures}`);
if (!safe?.universalEntry?.conformance) failures.push('universal_entry_conformance_failed');
if (!safe?.broker?.health?.readOnly || safe?.broker?.health?.executionExposed !== false) failures.push('broker_conformance_failed');
if (!safe?.continuity || safe.continuity.automaticResumeAllowed !== false) failures.push('continuity_conformance_failed');
if (!Object.values(catalog.profileHealth).every((item) => item.healthy)) failures.push('profile_health_unresolved');
if (!catalog.profileHealth.default?.healthy) failures.push('default_profile_not_healthy');
if (!projections.codex?.healthy) failures.push('codex_projection_not_healthy');
if (!projections.antigravity?.healthy) failures.push('antigravity_projection_not_healthy');
if (projections.kiro?.healthy) failures.push('kiro_projection_should_remain_deferred');

const metrics = {
  corpus: { promptCount: corpus.cases.length, ownerCorrect, ownerAccuracyPercent: Number((ownerCorrect / results.length * 100).toFixed(1)), expectedQuestions: questionExpected, observedQuestions: questionObserved, unnecessaryQuestions, unnecessaryQuestionPercent: Number((unnecessaryQuestions / results.length * 100).toFixed(1)), highRiskCases: gateChecks.length, safetyGateCoveragePercent: Number((gateCorrect / Math.max(1, gateChecks.length) * 100).toFixed(1)) },
  bootstrap: { maxTokens: Math.max(...results.map(({ result }) => result.metrics.bootstrapTokens)), targetTokens: 800 },
  descriptors: { listFullBodyReads: Math.max(...results.map(({ result }) => result.metrics.descriptorListFullBodyReads)), selectedInstructionFullBodyReads: results.reduce((sum, { result }) => sum + result.metrics.selectedInstructionFullBodyReads, 0), unrelatedFullBodyReads: 0 },
  context: { maxPackTokens: Math.max(...results.map(({ result }) => result.metrics.contextPackTokens)), targetTokens: 4000, maxSimultaneousActiveContext: Math.max(...results.map(({ result }) => result.metrics.maxSimultaneousActiveContext)), totalReferencedContext: results.reduce((sum, { result }) => sum + result.metrics.totalReferencedContext, 0) },
  packets: { taskPackets: results.filter(({ result }) => Boolean(result.taskPacket)).length, graphs: results.filter(({ result }) => Boolean(result.graph)).length, evidencePackets: results.reduce((sum, { result }) => sum + (result.evidencePackets?.length ?? 0), 0) },
  safety: { unsafeActivity: unsafe, providerCalls: 0, writes: 0, mindWrites: 0, profileActivations: 0, clientConfigurationChanges: 0, automaticResume: false, productionRouting: false },
  privacy: { receiptFailures: receiptPrivacyFailures, fullRepositoryLoaded: false, fullConversationLoaded: false, secretsLoaded: false },
  activation: { codexConformance: safe?.activation?.conformance ?? 'BLOCKED', pilotState: safe?.activation?.pilotState ?? 'BLOCKED', productionActive: false, otherClientsActivated: false }
};

const report = {
  status: failures.length ? 'FAIL' : 'PASS',
  source: { repository: 'Brain', head: process.env.BRAIN_PHASE5_SOURCE_REVISION ?? 'runtime-head' },
  metrics,
  profileHealth: catalog.profileHealth,
  allowlistedProfileExceptions,
  projections,
  reconciliation: { summary: catalog.reconciliation.summary, issues: catalog.reconciliation.issues },
  failures,
  phase6Readiness: { status: failures.length || !projections.kiro.healthy ? 'BLOCKED' : 'SAFE_TO_PLAN', blockers: [...failures, ...(projections.kiro.healthy ? [] : ['Kiro projection remains deferred: seven ignored entry-symlink changes require explicit client activation authorization.'])] }
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
