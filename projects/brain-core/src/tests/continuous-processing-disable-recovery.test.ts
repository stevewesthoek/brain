import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContinuousProcessingDisableRecoveryView } from '../adapters/continuous-processing-disable-recovery.js';
import { requestOnDemandRun } from '../adapters/on-demand-runs.js';
import { requestAction, decideApproval } from '../adapters/actions.js';
import { listSchedulerJobs } from '../adapters/scheduler.js';
import { getExecutionKillSwitch, getExecutionReadiness } from '../adapters/execution-plans.js';
import { enforceMindStewardInboxQueuePolicy } from '../adapters/mind-steward-inbox-queue.js';

test('disable/recovery view provides complete disable procedure', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  assert.equal(view.id, 'continuous-processing-disable-recovery-view');
  assert.equal(view.status, 'available');
  assert.equal(view.source, 'brain-core-documentation');
  assert.equal(view.killSwitchFlagName, 'BRAIN_CORE_EXECUTION_KILL_SWITCH');
  assert.equal(view.continuousProcessingEnabled, false);
  assert.equal(view.watcherEnabled, false);
  assert(view.disableProcedure.steps.length >= 2);
  assert.equal(view.disableProcedure.steps[0]?.order, 1);
  assert(view.disableProcedure.steps.every(s => s.reversible === true));
  assert.equal(typeof view.disableProcedure.immediateEffect, 'string');
  assert.equal(typeof view.disableProcedure.dataIntegrity, 'string');
});

test('disable/recovery view provides complete recovery procedure', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  assert(view.recoveryProcedure.steps.length >= 4);
  assert.equal(view.recoveryProcedure.steps[0]?.order, 1);
  assert(view.recoveryProcedure.steps.some(s => s.requiresApproval === true));
  assert(view.recoveryProcedure.steps.some(s => s.requiresApproval === false));
  assert.equal(typeof view.recoveryProcedure.dataIntegrity, 'string');
});

test('disable/recovery view reports kill switch state', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  assert.equal(typeof view.killSwitchEnabled, 'boolean');
  assert.equal(view.killSwitchFlagName, 'BRAIN_CORE_EXECUTION_KILL_SWITCH');
});

test('disable/recovery view is read-only and does not disable or enable anything', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.writesToMind, false);
  assert.equal(view.safety.movesCaptures, false);
  assert.equal(view.safety.deletesCaptures, false);
  assert.equal(view.safety.writesKanban, false);
  assert.equal(view.safety.createsSchedulerJob, false);
  assert.equal(view.safety.startsBackgroundDaemon, false);
  assert.equal(view.safety.runsWorkflowNow, false);
  assert.equal(view.safety.watcherEnabled, false);
  assert.equal(view.safety.disablesContinuousProcessing, false);
  assert.equal(view.blockers.length, 0);
});

test('disable/recovery view confirms system can be disabled at verified boundaries', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  const firstStep = view.disableProcedure.steps[0];
  assert(firstStep);
  assert(firstStep.action.includes('BRAIN_CORE_EXECUTION_KILL_SWITCH'));
  assert(firstStep.effect.includes('Prevents newly requested execution'));
  assert(firstStep.effect.includes('gated boundaries'));
  assert.equal(firstStep.reversible, true);
  assert.equal(firstStep.mutatesState, true);
});

// --- Helper for kill switch env toggle ---
function withKillSwitch<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  if (value === undefined) delete process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  else process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
    else process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = previous;
  }
}

// --- All referenced routes are reachable ---
test('all documented endpoints exist as registered routes', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  const disableEndpoints = view.disableProcedure.steps
    .map(s => s.endpoint)
    .filter(Boolean) as string[];
  const recoveryEndpoints = view.recoveryProcedure.steps
    .map(s => s.endpoint)
    .filter(Boolean) as string[];

  assert(disableEndpoints.includes('/execution/readiness'));
  assert(disableEndpoints.includes('/scheduler/continuous-processing/selection'));
  assert(recoveryEndpoints.includes('/scheduler/mind-steward/failed-items'));
  assert(recoveryEndpoints.includes('/scheduler/mind-steward/recovery'));
  assert(recoveryEndpoints.some(e => e.includes('/execution/on-demand-runs/')));
  assert(recoveryEndpoints.includes('/execution/readiness'));
});

// --- Kill switch active state appears accurately ---
test('kill switch active state appears accurately in the view', () => {
  withKillSwitch('true', () => {
    const view = getContinuousProcessingDisableRecoveryView();
    assert.equal(view.killSwitchEnabled, true);
  });

  withKillSwitch(undefined, () => {
    const view = getContinuousProcessingDisableRecoveryView();
    assert.equal(view.killSwitchEnabled, false);
  });
});

// --- On-demand request is blocked under kill switch ---
test('on-demand request is blocked under kill switch', () => {
  withKillSwitch('true', () => {
    const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');
    assert.equal(result.accepted, false);
    assert.equal(result.executed, false);
    assert(result.message.includes('BRAIN_CORE_EXECUTION_KILL_SWITCH'));
  });
});

// --- Approved execution is blocked under kill switch ---
test('approved execution is blocked under kill switch', () => {
  withKillSwitch('true', () => {
    const request = requestAction('scheduler-run-mind-steward-dry-run');
    assert(request.approval);
    const decision = decideApproval(request.approval.id, 'approve');
    assert.equal(decision.executed, false);
    assert.equal(decision.execution?.status, 'blocked');
    assert(decision.execution?.message.includes('BRAIN_CORE_EXECUTION_KILL_SWITCH'));
  });
});

// --- Scheduler job eligibility is blocked under kill switch ---
test('scheduler job eligibility is blocked under kill switch', () => {
  withKillSwitch('true', () => {
    const jobs = listSchedulerJobs();
    const eligible = jobs.filter(j => j.schedulerEligible);
    assert.equal(eligible.length, 0, 'No jobs should be scheduler-eligible while kill switch is active');
    assert(jobs.every(j => j.blockers.includes('executionKillSwitchEnabled')));
  });
});

// --- Queue policy remains feature-flag and stability gated ---
test('queue policy remains feature-flag and stability gated independently of kill switch', () => {
  const mockState = {
    schemaVersion: '1.0' as const,
    queueId: 'test-queue',
    generatedAt: '2026-06-18T12:00:00Z',
    source: 'brain-runtime' as const,
    mindRoot: '/tmp/test',
    inboxPath: '/tmp/test/capture/inbox',
    status: 'ready' as const,
    settings: { maxConcurrentJobs: 1, maxFilesPerRun: 3, debounceSeconds: 30, maxRetries: 2, largeFileThresholdMb: 2, minimumSecondsBetweenRuns: 300, localOnly: true as const },
    items: [{
      id: 'test-item',
      path: 'capture/inbox/test.md',
      status: 'pending' as const,
      sizeBytes: 100,
      contentSha256: 'abc123',
      modifiedAt: '2026-06-18T10:00:00Z',
      firstSeenAt: '2026-06-18T10:00:00Z',
      lastCheckedAt: '2026-06-18T12:00:00Z',
      stableFile: true,
      stableAt: '2026-06-18T10:00:30Z',
      debounceSeconds: 30,
      debounceUntil: null,
      attemptCount: 0,
      lastError: null,
      nextRetryAfter: null,
      failureRoute: null,
      largeFile: false,
      selectedForSample: true,
      selectorStatus: 'unknown' as const,
    }],
    summary: { total: 1, pending: 1, blocked: 0, failed: 0, selectedForSample: 1, stableFile: 1, debouncing: 0, largeFile: 0, done: 0 },
    blockers: [],
    safety: { writesToMind: false as const, movesCaptures: false as const, deletesCaptures: false as const, writesKanban: false as const, stateOwnedBy: 'brain' as const, statePath: '/tmp/state.json' },
  };

  const result = enforceMindStewardInboxQueuePolicy({
    state: mockState,
    featureFlagEnabled: false,
    now: new Date('2026-06-18T12:00:00Z'),
  });
  assert(result.blockers.includes('queueWorkflowFeatureFlagRequired'));
  assert.equal(result.canStartRun, false);
});

// --- Procedure does not claim in-flight cancellation ---
test('procedure does not claim in-flight cancellation', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  assert(!view.disableProcedure.immediateEffect.includes('cancels'));
  assert(!view.disableProcedure.immediateEffect.includes('in-flight'));
  assert(!view.disableProcedure.immediateEffect.includes('all execution paths'));
  assert(!view.disableProcedure.immediateEffect.includes('zero data loss'));
  assert(view.disableProcedure.immediateEffect.includes('Does not cancel'));
});

// --- Recovery steps reference existing surfaces ---
test('recovery steps reference existing surfaces', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  const knownEndpoints = [
    '/scheduler/mind-steward/failed-items',
    '/scheduler/mind-steward/recovery',
    '/execution/on-demand-runs/:kind/request',
    '/execution/readiness',
  ];

  for (const step of view.recoveryProcedure.steps) {
    if (step.endpoint) {
      assert(
        knownEndpoints.some(e => step.endpoint!.includes(e.replace(':kind', '')) || step.endpoint === e),
        `Endpoint ${step.endpoint} is not a known surface`,
      );
    }
  }
});

// --- Calling the view causes no state mutation ---
test('calling the view or route causes no state mutation', () => {
  const envBefore = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  const view1 = getContinuousProcessingDisableRecoveryView();
  const view2 = getContinuousProcessingDisableRecoveryView();
  const envAfter = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;

  assert.equal(envBefore, envAfter);
  assert.deepEqual(view1, view2);
});

// --- Kill switch off does not by itself enable execution ---
test('kill switch off does not by itself enable execution', () => {
  withKillSwitch(undefined, () => {
    const readiness = getExecutionReadiness();
    assert.equal(readiness.executionEnabled, false);
    assert(readiness.blockers.length > 0);
    assert(readiness.blockers.some(b => b.includes('approval') || b.includes('audit') || b.includes('rollback')));
  });
});

// --- Missing runtime evidence is represented with blockers ---
test('missing runtime evidence is represented with blockers not silence', () => {
  const view = getContinuousProcessingDisableRecoveryView();

  for (const step of view.recoveryProcedure.steps) {
    if (step.endpoint && step.endpoint !== '/execution/on-demand-runs/:kind/request') {
      assert.notEqual(step.blockerIfUnavailable, null);
      assert(typeof step.blockerIfUnavailable === 'string');
      assert(step.blockerIfUnavailable.length > 0);
    }
  }
});

// --- Mutation classification: disable procedure distinguishes operator actions from read-only verification ---
test('disable procedure: kill-switch and feature-flag steps have mutatesState: true', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const killSwitchStep = view.disableProcedure.steps.find(s => s.action.includes('BRAIN_CORE_EXECUTION_KILL_SWITCH=true'));
  const featureFlagStep = view.disableProcedure.steps.find(s => s.action.includes('Unset workflow feature flag'));
  assert(killSwitchStep);
  assert(featureFlagStep);
  assert.equal(killSwitchStep.mutatesState, true, 'Setting kill switch env var mutates operational configuration');
  assert.equal(featureFlagStep.mutatesState, true, 'Unsetting feature flag mutates operational configuration');
});

test('disable procedure: GET/read-only verification steps have mutatesState: false', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const verifySteps = view.disableProcedure.steps.filter(s => s.action.startsWith('Verify'));
  assert(verifySteps.length >= 2, 'At least two verification steps exist');
  for (const step of verifySteps) {
    assert.equal(step.mutatesState, false, `Verification step "${step.action}" must not mutate state`);
    assert(step.endpoint, 'Verification steps reference a GET endpoint');
  }
});

// --- Mutation classification: recovery procedure distinguishes read-only review from state-mutating actions ---
test('recovery procedure: read-only review steps have mutatesState: false', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const reviewSteps = view.recoveryProcedure.steps.filter(s => s.action.startsWith('Review'));
  assert(reviewSteps.length >= 2, 'At least two review steps exist');
  for (const step of reviewSteps) {
    assert.equal(step.mutatesState, false, `Review step "${step.action}" must not mutate state`);
    assert.equal(step.requiresApproval, false, 'Read-only review does not require approval');
  }
});

test('recovery procedure: on-demand request step has mutatesState: true', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const requestStep = view.recoveryProcedure.steps.find(s => s.endpoint?.includes('/on-demand-runs/'));
  assert(requestStep);
  assert.equal(requestStep.mutatesState, true, 'POST request creates an action record — mutates Brain runtime state');
  assert.equal(requestStep.requiresApproval, true);
});

test('recovery procedure: kill-switch removal step has mutatesState: true', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const removeStep = view.recoveryProcedure.steps.find(s => s.action.includes('Remove BRAIN_CORE_EXECUTION_KILL_SWITCH'));
  assert(removeStep);
  assert.equal(removeStep.mutatesState, true, 'Removing kill switch mutates operational configuration');
  assert.equal(removeStep.requiresApproval, true);
});

test('recovery procedure: feature-flag re-enable step is separate and has mutatesState: true', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const featureFlagStep = view.recoveryProcedure.steps.find(s => s.action.includes('re-enable the workflow feature flag'));
  assert(featureFlagStep);
  assert.equal(featureFlagStep.mutatesState, true, 'Re-enabling feature flag mutates operational configuration');
  assert.equal(featureFlagStep.requiresApproval, true);
});

test('recovery procedure: verify remaining gates step is read-only', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const verifyStep = view.recoveryProcedure.steps.find(s => s.action.includes('Verify remaining gates'));
  assert(verifyStep);
  assert.equal(verifyStep.mutatesState, false, 'Verification step does not mutate');
  assert.equal(verifyStep.requiresApproval, false);
  assert.equal(verifyStep.endpoint, '/execution/readiness');
});

// --- The procedure does not execute those actions itself ---
test('procedure documents operator actions without executing them', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  assert.equal(view.safety.readOnly, true, 'The view invocation itself is read-only');
  assert.equal(view.safety.disablesContinuousProcessing, false, 'The view does not disable anything');
  assert.equal(view.safety.runsWorkflowNow, false, 'The view does not run workflows');
  const mutatingDisableSteps = view.disableProcedure.steps.filter(s => s.mutatesState);
  assert(mutatingDisableSteps.length >= 2, 'Procedure documents at least 2 mutating operator actions');
  const mutatingRecoverySteps = view.recoveryProcedure.steps.filter(s => s.mutatesState);
  assert(mutatingRecoverySteps.length >= 2, 'Recovery documents at least 2 mutating operator actions');
});

// --- Accepted request does not imply approval granted ---
test('accepted on-demand request does not imply approval is granted', () => {
  withKillSwitch(undefined, () => {
    const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');
    if (result.accepted) {
      assert.equal(result.executed, false, 'accepted:true does not mean executed');
      assert(result.message.includes('does not execute') || result.message.includes('approval') || result.message.includes('recorded'),
        'Message should indicate action is recorded, not that approval was granted');
    }
  });
});

// --- Accepted request still has executed:false ---
test('accepted on-demand request has executed:false', () => {
  withKillSwitch(undefined, () => {
    const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');
    assert.equal(result.executed, false, 'On-demand request always returns executed:false');
  });
});

// --- Active kill switch blocks the on-demand request (already tested above, explicit here) ---
test('active kill switch blocks on-demand request returning accepted:false', () => {
  withKillSwitch('true', () => {
    const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');
    assert.equal(result.accepted, false);
    assert.equal(result.executed, false);
  });
});

// --- Unsupported workflow blocks the request ---
test('unsupported workflow kind blocks on-demand request', () => {
  withKillSwitch(undefined, () => {
    const result = requestOnDemandRun('nonexistent-workflow-kind');
    assert.equal(result.accepted, false);
    assert.equal(result.executed, false);
    assert(result.message.includes('Unsupported'));
  });
});

// --- Removing kill switch does not by itself enable execution (separate from earlier test) ---
test('removing kill switch does not enable execution — feature flag and other gates remain', () => {
  withKillSwitch(undefined, () => {
    const readiness = getExecutionReadiness();
    assert.equal(readiness.executionEnabled, false, 'Kill switch off alone does not enable execution');
    assert(readiness.blockers.length > 0, 'Other blockers remain active');
  });
});

// --- Feature flag state is represented separately from kill switch ---
test('feature flag state is independent of kill switch state', () => {
  withKillSwitch(undefined, () => {
    const policy = enforceMindStewardInboxQueuePolicy({
      state: {
        schemaVersion: '1.0' as const,
        queueId: 'test-queue',
        generatedAt: '2026-06-18T12:00:00Z',
        source: 'brain-runtime' as const,
        mindRoot: '/tmp/test',
        inboxPath: '/tmp/test/capture/inbox',
        status: 'ready' as const,
        settings: { maxConcurrentJobs: 1, maxFilesPerRun: 3, debounceSeconds: 30, maxRetries: 2, largeFileThresholdMb: 2, minimumSecondsBetweenRuns: 300, localOnly: true as const },
        items: [],
        summary: { total: 0, pending: 0, blocked: 0, failed: 0, selectedForSample: 0, stableFile: 0, debouncing: 0, largeFile: 0, done: 0 },
        blockers: [],
        safety: { writesToMind: false as const, movesCaptures: false as const, deletesCaptures: false as const, writesKanban: false as const, stateOwnedBy: 'brain' as const, statePath: '/tmp/state.json' },
      },
      featureFlagEnabled: false,
      now: new Date('2026-06-18T12:00:00Z'),
    });
    assert(policy.blockers.includes('queueWorkflowFeatureFlagRequired'), 'Feature flag blocker is present even with kill switch off');
  });
});

// --- Read-only steps remain non-mutating ---
test('recovery read-only steps do not mutate state', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const readOnlySteps = view.recoveryProcedure.steps.filter(s => !s.mutatesState);
  assert(readOnlySteps.length >= 2, 'At least 2 read-only recovery steps exist');
  for (const step of readOnlySteps) {
    assert.equal(step.requiresApproval, false, `Read-only step "${step.action}" should not require approval`);
  }
});

// --- Environment/configuration actions remain mutating ---
test('recovery environment/configuration actions are marked as mutating', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  const killSwitchRemoval = view.recoveryProcedure.steps.find(s => s.action.includes('Remove BRAIN_CORE_EXECUTION_KILL_SWITCH'));
  const featureFlagStep = view.recoveryProcedure.steps.find(s => s.action.includes('re-enable the workflow feature flag'));
  const onDemandStep = view.recoveryProcedure.steps.find(s => s.endpoint?.includes('/on-demand-runs/'));
  assert(killSwitchRemoval);
  assert(featureFlagStep);
  assert(onDemandStep);
  assert.equal(killSwitchRemoval.mutatesState, true);
  assert.equal(featureFlagStep.mutatesState, true);
  assert.equal(onDemandStep.mutatesState, true);
});

// --- The view itself executes none of the documented actions ---
test('view invocation does not execute any documented recovery action', () => {
  const envBefore = { ...process.env };
  getContinuousProcessingDisableRecoveryView();
  assert.equal(process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH, envBefore.BRAIN_CORE_EXECUTION_KILL_SWITCH);
});

// --- Blocker semantics match static documentation design ---
test('blocker semantics: view returns static empty blockers (documentation design)', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  assert.deepEqual(view.blockers, [], 'Static documentation view has no dynamic blockers — endpoint-specific availability is checked when each endpoint is called');
});

// --- No absolute no-data-loss claim remains ---
test('no absolute no-data-loss claim in recovery dataIntegrity', () => {
  const view = getContinuousProcessingDisableRecoveryView();
  assert(!view.recoveryProcedure.dataIntegrity.includes('No data is lost'), 'Absolute no-data-loss claim must not appear');
  assert(!view.recoveryProcedure.dataIntegrity.includes('no data is lost'), 'Absolute no-data-loss claim must not appear (lowercase)');
  assert(view.recoveryProcedure.dataIntegrity.includes('does not mutate state'), 'Factual non-mutation wording is present');
  assert(view.recoveryProcedure.dataIntegrity.includes('executed:false'), 'POST request returns executed:false');
});
