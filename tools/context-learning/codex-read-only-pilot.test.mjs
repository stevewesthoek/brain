import assert from 'node:assert/strict';
import test from 'node:test';

import corpus from '../orchestration/codex-pilot-corpus-v5.json' with { type: 'json' };
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { ACTIVATION_STATES, auditConsumerProjections, buildCodexPriorPath, inspectCodexConsumer, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';

const repoRoot = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const catalog = createCapabilityCatalog({ repoRoot });

test('Codex pilot uses the real repository consumer shape without activating it', () => {
  const result = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: 'pilot-shape', prompt: 'Make this page amazing' });
  assert.equal(result.mode, 'CODEX_READ_ONLY_PILOT_MODE');
  assert.equal(result.activationState, 'PILOT-ACTIVE');
  assert.equal(result.activation.productionActive, false);
  assert.equal(result.activation.activationPerformed, false);
  assert.equal(result.universalEntry.conformance, true);
  assert.equal(result.bootstrap.budget.usedTokens <= 800, true);
  assert.equal(result.metrics.contextPackTokens <= 4000, true);
  assert.equal(result.metrics.descriptorListFullBodyReads, 0);
  assert.equal(result.metrics.fullRepositoryLoaded, false);
  assert.equal(result.metrics.fullConversationLoaded, false);
  assert.equal(result.metrics.secretsLoaded, false);
  assert.equal(result.safety.providerCalls, 0);
  assert.equal(result.safety.writes, 0);
  assert.equal(result.safety.executionAttempts, 0);
  assert.equal(result.safety.automaticResume, false);
  assert.equal(JSON.stringify(result.receipt).includes('Make this page amazing'), false);
  assert.equal(result.receipt.privacy.rawPromptStored, false);
});

test('the 120-prompt corpus targets one owner and at most one question', () => {
  assert.ok(corpus.cases.length >= 100);
  let correct = 0;
  let questions = 0;
  let unnecessaryQuestions = 0;
  for (const fixture of corpus.cases) {
    const result = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: fixture.id, prompt: fixture.prompt });
    if (result.route?.primaryRouteFamily === fixture.expected.family && result.route?.primaryDescriptorId === fixture.expected.owner) correct += 1;
    assert.ok((result.qualification?.count ?? 0) <= 1, `${fixture.id} asked more than one question`);
    if (result.qualification?.required) questions += 1;
    if (result.qualification?.required && fixture.expected.question !== true) unnecessaryQuestions += 1;
    assert.equal(result.receipt.safety.providerCalls, 0);
    assert.equal(result.receipt.safety.writes, 0);
    assert.equal(result.receipt.activation.activationPerformed, false);
  }
  assert.equal(correct / corpus.cases.length >= 0.95, true, `owner accuracy ${correct}/${corpus.cases.length}`);
  assert.equal(questions, corpus.cases.filter((fixture) => fixture.expected.question === true).length);
  assert.equal(unnecessaryQuestions / corpus.cases.length <= 0.10, true);
});

test('high-risk routes retain Careful, confirmation, rollback, and no execution readiness', () => {
  for (const prompt of ['Deploy this', 'Delete production data', 'Rotate credentials', 'Publish this']) {
    const result = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `risk-${prompt}`, prompt });
    assert.equal(result.route.primaryDescriptorId, 'skill.careful');
    assert.ok(result.graph.safetyGateNodes.length >= 2);
    assert.equal(result.graph.execution.executionReady, false);
    assert.equal(result.safety.executionAttempts, 0);
  }
});

test('stale, conflict, unavailable, invalid, and disabled states fail closed with prior path fallback', () => {
  const cases = [
    ['catalog_unavailable', 'catalog_unavailable'],
    ['profile_unresolved', 'profile_unresolved'],
    ['selected_source_missing', 'selected_source_missing'],
    ['broker_unavailable', 'broker_unavailable'],
    ['stale_pack', 'continuity_stale'],
    ['continuity_conflict', 'continuity_conflicted'],
    ['invalid_graph', 'invalid_graph'],
    ['capability_unavailable', 'capability_unavailable'],
    ['pilot_disabled', 'pilot_disabled']
  ];
  for (const [failureMode, reason] of cases) {
    const result = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `failure-${failureMode}`, prompt: 'Inspect this safely', enabled: failureMode !== 'pilot_disabled', failureMode });
    assert.equal(result.activationState, 'BLOCKED', failureMode);
    assert.equal(result.fallback.active, true, failureMode);
    assert.equal(result.fallback.rollbackSwitch, 'enabled=false');
    assert.equal(result.fallback.priorPathAvailable, true);
    assert.equal(result.receipt.failure ?? result.fallback.reason, reason);
    assert.equal(result.safety.writes, 0);
    assert.equal(result.safety.providerCalls, 0);
  }
});

test('freshness and conflict states remain distinct', () => {
  const stale = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: 'stale', prompt: 'Research this company', currentState: { contextFresh: false } });
  const conflict = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: 'conflict', prompt: 'Research this company', currentState: { sourceConflict: true } });
  const unavailable = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: 'unavailable', prompt: 'Research this company', currentState: { sourceAvailable: false } });
  assert.equal(stale.continuity.state, 'STALE');
  assert.equal(conflict.continuity.state, 'CONFLICTED');
  assert.equal(unavailable.continuity.state, 'UNAVAILABLE');
  assert.notEqual(stale.continuity.state, conflict.continuity.state);
  assert.notEqual(conflict.continuity.state, unavailable.continuity.state);
});

test('Codex source/projection and prior-path evidence are repository-scoped', () => {
  const inspection = inspectCodexConsumer({ repoRoot });
  assert.equal(inspection.conformance, true);
  assert.equal(inspection.runtimeActivated, false);
  assert.equal(inspection.clientConfigurationChanged, false);
  assert.equal(buildCodexPriorPath({ repoRoot }).available, true);
  const projections = auditConsumerProjections({ repoRoot, activeNames: ['careful', 'code', 'handoff', 'memory', 'qa', 'research', 'review'] });
  assert.equal(projections.codex.healthy, true);
  assert.equal(projections.antigravity.healthy, true);
  assert.equal(projections.kiro.healthy, false);
  assert.equal(projections.workbench.status, 'NOT_APPLICABLE');
  assert.deepEqual(ACTIVATION_STATES, ['CONFORMANT', 'PILOT-READY', 'PILOT-ACTIVE', 'PRODUCTION-ACTIVE', 'DEGRADED', 'BLOCKED']);
});
