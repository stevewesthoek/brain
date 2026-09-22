import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import {
  HARDENING_ACTIONS,
  HARDENING_COVERAGE_MATRIX,
  HARDENING_FAULT_CLASSES,
  HARDENING_RESULT_SCHEMA,
  HARDENING_SCENARIO_SCHEMA,
  HardeningLogicalClock,
  evaluateHardeningGate,
  runHardeningScenario,
  validateHardeningResult,
  validateHardeningScenario,
} from './fixtures/agent-mode-hardening-harness.js';
import type { HardeningCounts, HardeningObservation, HardeningScenarioV1 } from './fixtures/agent-mode-hardening-harness.js';

const bounds: HardeningScenarioV1['bounds'] = {
  maxSteps: 10, maxRootGoals: 2, maxAgents: 8, maxTasks: 8, maxRuns: 8, maxAttempts: 8,
  maxRuntimeOperations: 12, maxModelCalls: 4, maxNodeCalls: 4, maxEvents: 40,
  maxFaultInjections: 8, maxEvidenceRefs: 8,
};

function scenario(overrides: Partial<HardeningScenarioV1> = {}): HardeningScenarioV1 {
  return {
    schemaVersion: HARDENING_SCENARIO_SCHEMA,
    scenarioId: 'h0:accelerated-fixture',
    durationModel: 'accelerated',
    logicalDurationMs: 3_600_000,
    seed: 7123,
    bounds,
    requiredLiveness: ['safe_work_terminal', 'recovery_observable'],
    steps: [
      { stepId: 'step:provider-down', atLogicalMs: 1_000, faultClass: 'provider_outage', action: 'provider_unavailable' },
      { stepId: 'step:provider-up', atLogicalMs: 2_000, faultClass: 'provider_outage', action: 'provider_recovered' },
      { stepId: 'step:restart', atLogicalMs: 3_000, faultClass: 'process_crash_restart', action: 'fixture_restart' },
    ],
    ...overrides,
  };
}

const counts: HardeningCounts = {
  rootGoals: 1, agents: 2, tasks: 1, runs: 1, attempts: 1, runtimeOperations: 1,
  modelCalls: 0, nodeCalls: 0, events: 3, evidenceRefs: 1, duplicateDeliveries: 0,
  uncertainEffects: 0, activeAgents: 1, activeLeases: 1, reservedBudget: 0, settledBudget: 0,
};

function observation(overrides: Partial<HardeningObservation> = {}): HardeningObservation {
  return {
    counts,
    budgetCeiling: 10,
    invariantSignals: {},
    liveness: { safe_work_terminal: true, recovery_observable: true },
    auditEvidenceComplete: true,
    evidenceRefs: ['receipt:attempt:1'],
    recoveryState: 'safe_to_resume',
    ...overrides,
  };
}

test('H0 scenario v1 is closed, bounded, ordered, and excludes executable/provider authority', () => {
  const parsed = validateHardeningScenario(scenario());
  assert.equal(parsed.schemaVersion, 'agent-mode.hardening-scenario.v1');
  assert.equal(parsed.steps.length, 3);
  assert.deepEqual(HARDENING_ACTIONS.includes('provider_unavailable'), true);
  assert.throws(() => validateHardeningScenario({ ...scenario(), shellCommand: 'whoami' }), /unknown scenario field/);
  assert.throws(() => validateHardeningScenario({ ...scenario(), providerEndpoint: 'https://example.invalid' }), /unknown scenario field/);
  assert.throws(() => validateHardeningScenario(scenario({ steps: [
    { stepId: 'step:bad', atLogicalMs: 1, faultClass: 'provider_outage', action: 'observe' },
    { stepId: 'step:bad2', atLogicalMs: 0, faultClass: 'provider_outage', action: 'observe' },
  ] })), /step time/);
  assert.throws(() => validateHardeningScenario(scenario({ bounds: { ...bounds, maxSteps: 257 } })), /bound maxSteps/);
  assert.throws(() => validateHardeningScenario(scenario({ steps: [{ stepId: 'step:bad', atLogicalMs: 1, faultClass: 'provider_outage', action: 'exec' as never }] })), /unknown fixture action/);
});

test('H0 controlled clock advances monotonically without sleeping or patching Date', () => {
  const clock = new HardeningLogicalClock(1_000, 20_000);
  assert.equal(clock.nowMs(), 1_000);
  clock.advanceTo(5_000);
  assert.equal(clock.nowMs(), 6_000);
  assert.equal(clock.elapsed(), 5_000);
  assert.throws(() => clock.advanceTo(4_000), /cannot move backwards/);
  assert.throws(() => clock.advanceTo(20_001), /exceed duration/);
});

test('accelerated scenario runner is deterministic and returns bounded safe evidence', async () => {
  const trace: string[] = [];
  const adapter = {
    execute(action: (typeof HARDENING_ACTIONS)[number], context: { logicalNowMs: number; seed: number }): HardeningObservation {
      trace.push(`${action}:${context.logicalNowMs}:${context.seed}`);
      return observation();
    },
  };
  const first = await runHardeningScenario(scenario(), adapter);
  const firstTrace = [...trace];
  trace.length = 0;
  const second = await runHardeningScenario(scenario(), adapter);
  assert.equal(first.schemaVersion, HARDENING_RESULT_SCHEMA);
  assert.equal(first.status, 'passed');
  assert.equal(first.reasonCode, 'SCENARIO_PASSED');
  assert.equal(first.iterations, 3);
  assert.equal(first.logicalDurationMs, 3_000);
  assert.deepEqual(first.faultsInjected, ['provider_outage', 'provider_outage', 'process_crash_restart']);
  assert.deepEqual(firstTrace, trace);
  assert.deepEqual(first, second);
  assert.deepEqual(validateHardeningResult(first), first);
  assert.deepEqual(first.evidenceRefs, ['receipt:attempt:1']);
  assert.equal(first.counts.modelCalls, 0);
  assert.throws(() => validateHardeningResult({ ...first, evidenceRefs: ['prompt:raw'] }), /evidence references/);
});

test('H0 runner drives duplicate delivery and StateStore restart through isolated durable K4 fixtures', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-h0-runner-'));
  const databasePath = path.join(root, 'agent-mode.db');
  let store = new AgentModeSqliteStateStore(databasePath);
  let duplicateCount = 0;
  let fixtureError = '';
  const soak = scenario({
    scenarioId: 'h0:durable-event-restart', logicalDurationMs: 24 * 60 * 60 * 1000,
    bounds: { ...bounds, maxEvents: 32, maxSteps: 32, maxEvidenceRefs: 32, maxFaultInjections: 24 },
    requiredLiveness: [],
    steps: Array.from({ length: 24 }, (_, index) => ({
      stepId: `hour:${index.toString().padStart(2, '0')}`,
      atLogicalMs: (index + 1) * 60 * 60 * 1000,
      faultClass: index === 23 ? 'process_crash_restart' as const : 'duplicate_delivery' as const,
      action: index === 23 ? 'reopen_state_store' as const : 'duplicate_delivery' as const,
    })),
  });
  try {
    const result = await runHardeningScenario(soak, {
      execute(action, context) {
        try {
          if (action === 'duplicate_delivery') {
            const occurredAt = new Date(context.logicalNowMs).toISOString();
            const event = {
              eventType: 'agent_mode.h0.fixture', source: 'h0.fixture', occurredAt, receivedAt: occurredAt,
              causationId: null, correlationId: 'correlation:h0', deduplicationKey: `dedupe:${context.step.stepId}`,
              payloadVersion: 'k4.0', payload: { fixture: true }, nextEligibleAt: occurredAt, deadline: null, maxAttempts: 1,
            } as const;
            assert.equal(store.createSchedulerEvent({ ...event, eventId: `event:${context.step.stepId}` }), 'created');
            assert.equal(store.createSchedulerEvent({ ...event, eventId: `event:${context.step.stepId}:redelivery` }), 'duplicate');
            duplicateCount += 1;
          } else if (action === 'reopen_state_store') {
            store.close();
            store = new AgentModeSqliteStateStore(databasePath);
          }
          const events = store.listSchedulerEvents(32);
          return observation({
            counts: { ...counts, rootGoals: 0, agents: 0, tasks: 0, runs: 0, attempts: 0, runtimeOperations: 0, modelCalls: 0, nodeCalls: 0, events: events.length, evidenceRefs: events.length, duplicateDeliveries: duplicateCount, activeAgents: 0, activeLeases: 0 },
            budgetCeiling: 0,
            evidenceRefs: events.map((item) => `event:${item.eventId}`),
            recoveryState: action === 'reopen_state_store' ? 'already_completed' : 'none',
          });
        } catch (error) {
          fixtureError = error instanceof Error ? error.message : 'unknown fixture error';
          throw error;
        }
      },
    });
    assert.equal(result.status, 'passed', `${JSON.stringify(result)}; fixtureError=${fixtureError}`);
    assert.equal(result.logicalDurationMs, 24 * 60 * 60 * 1000);
    assert.equal(result.iterations, 24);
    assert.equal(result.counts.events, 23);
    assert.equal(result.counts.duplicateDeliveries, 23);
    assert.equal(store.listSchedulerEvents(32).length, 23);
    assert.equal(result.counts.modelCalls, 0);
    assert.equal(result.counts.nodeCalls, 0);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('H0 monitor separates safety, liveness, audit completeness, and fail-closed outcomes', async () => {
  const unsafe = await runHardeningScenario(scenario(), {
    execute: () => observation({
      counts: { ...counts, settledBudget: 11 }, budgetCeiling: 10,
      invariantSignals: { uncertain_replayed: 1 },
      liveness: { safe_work_terminal: false, recovery_observable: true },
      auditEvidenceComplete: false,
      evidenceRefs: ['credential:secret-value'],
    }),
  });
  assert.equal(unsafe.status, 'failed');
  assert.ok(unsafe.invariantFailures.includes('budget_overspend'));
  assert.ok(unsafe.invariantFailures.includes('uncertain_replayed'));
  assert.ok(unsafe.invariantFailures.includes('liveness_timeout'));
  assert.ok(unsafe.invariantFailures.includes('audit_evidence_missing'));
  assert.ok(unsafe.invariantFailures.includes('secret_in_public_projection'));
  const failedAdapter = await runHardeningScenario(scenario(), { execute: () => { throw new Error('do not leak this raw detail'); } });
  assert.equal(failedAdapter.reasonCode, 'FIXTURE_ACTION_FAILED');
  assert.equal(JSON.stringify(failedAdapter).includes('do not leak'), false);
});

test('H0 runner enforces fixture bounds and refuses to call accelerated time a wall-clock soak', async () => {
  const overBound = await runHardeningScenario(scenario({ bounds: { ...bounds, maxAgents: 1 } }), { execute: () => observation() });
  assert.equal(overBound.status, 'failed');
  assert.ok(overBound.invariantFailures.includes('agent_bound_exceeded'));
  const wallClock = await runHardeningScenario(scenario({ durationModel: 'wall_clock' }), { execute: () => { throw new Error('must not run'); } });
  assert.equal(wallClock.status, 'blocked');
  assert.equal(wallClock.reasonCode, 'WALL_CLOCK_NOT_RUN');
  assert.equal(wallClock.iterations, 0);
});

test('H0 fault inventory is complete and fixture coverage cannot close the release gate', () => {
  assert.equal(HARDENING_FAULT_CLASSES.length, 15);
  assert.deepEqual(HARDENING_COVERAGE_MATRIX.map((entry) => entry.faultClass).sort(), [...HARDENING_FAULT_CLASSES].sort());
  for (const entry of HARDENING_COVERAGE_MATRIX) {
    assert.ok(entry.implementationSeam.length > 0);
    assert.ok(entry.existingDeterministicCoverage.length > 0);
    assert.ok(entry.missingCoverage.length > 0);
    assert.ok(entry.safetyInvariant.length > 0);
    assert.ok(entry.livenessInvariant.length > 0);
    assert.ok(entry.auditEvidence.length > 0);
  }
  const entries = HARDENING_FAULT_CLASSES.map((faultClass) => ({ faultClass, status: 'fixture_pass' as const, evidence: [`fixture:${faultClass}`] }));
  const gate = evaluateHardeningGate(entries, { wallClockSoak: 'not_run', securityReview: 'not_run' });
  assert.equal(gate.status, 'INCOMPLETE');
  assert.ok(gate.missing.includes('security_release_review'));
  assert.ok(gate.missing.includes('wall_clock_soak'));
  assert.ok(gate.missing.includes('live_acceptance:host_loss_reconnect'));
  assert.ok(gate.missing.includes('live_acceptance:security'));
  const isolatedWallClock = evaluateHardeningGate(entries, { wallClockSoak: 'wall_clock_pass', securityReview: 'not_run' });
  assert.equal(isolatedWallClock.status, 'INCOMPLETE');
  assert.ok(!isolatedWallClock.missing.includes('wall_clock_soak'));
  assert.ok(isolatedWallClock.missing.includes('security_release_review'));
  const missing = evaluateHardeningGate(entries.slice(1), { wallClockSoak: 'not_run', securityReview: 'not_run' });
  assert.equal(missing.status, 'INCOMPLETE');
  assert.ok(missing.missing.includes('scenario:provider_outage'));
  const failed = evaluateHardeningGate([{ ...entries[0]!, status: 'failed' }, ...entries.slice(1)], { wallClockSoak: 'live_pass', securityReview: 'live_pass' });
  assert.equal(failed.status, 'FAIL');
  const malformed = evaluateHardeningGate([{ ...entries[0]!, status: 'healthy' as never }, ...entries.slice(1)], { wallClockSoak: 'live_pass', securityReview: 'live_pass' });
  assert.equal(malformed.status, 'FAIL');
});
