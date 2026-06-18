import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExecutionCandidateKinds,
  getExecutionPlan,
  getExecutionReadiness,
  getWorkflowFeatureFlag,
  isWorkflowFeatureFlagEnabled,
  listExecutionPlans,
  listWorkflowFeatureFlags,
} from '../adapters/execution-plans.js';

function withEnvFlag<T>(flagName: string, value: string | undefined, fn: () => T): T {
  const previous = process.env[flagName];
  if (value === undefined) delete process.env[flagName];
  else process.env[flagName] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[flagName];
    else process.env[flagName] = previous;
  }
}

test('every execution workflow has an explicit disabled feature flag by default', () => {
  const plans = listExecutionPlans();
  const flags = listWorkflowFeatureFlags();

  assert.equal(flags.length, plans.length);
  assert.equal(flags.length, getExecutionCandidateKinds().length);
  assert.equal(new Set(flags.map(flag => flag.workflowId)).size, flags.length);
  assert.equal(new Set(flags.map(flag => flag.flagName)).size, flags.length);
  for (const plan of plans) {
    assert.equal(plan.workflowFeatureFlag.workflowId, plan.kind);
    assert.equal(plan.workflowFeatureFlag.flagName.startsWith('BRAIN_CORE_ENABLE_'), true);
    assert.equal(plan.workflowFeatureFlag.enabled, false);
    assert.equal(plan.workflowFeatureFlag.requiredForExecution, true);
    assert.equal(plan.workflowFeatureFlag.defaultEnabled, false);
    assert.equal(plan.workflowFeatureFlag.writesToMind, false);
    assert.equal(plan.workflowFeatureFlag.externalSideEffects, false);
    assert.equal(plan.executionEnabled, false);
    assert.equal(plan.wouldExecute, false);
    assert.equal(plan.executed, false);
    assert.equal(plan.writesToMind, false);
  }
});

test('one workflow flag can be enabled without enabling execution globally', () => {
  const flag = getWorkflowFeatureFlag('scheduler-run-graphify-preflight-mind');

  withEnvFlag(flag.flagName, 'true', () => {
    const enabledFlag = getWorkflowFeatureFlag('scheduler-run-graphify-preflight-mind');
    const otherFlag = getWorkflowFeatureFlag('scheduler-run-graphify-preflight-brain');
    const plan = getExecutionPlan('scheduler-run-graphify-preflight-mind');
    const readiness = getExecutionReadiness();

    assert.equal(enabledFlag.enabled, true);
    assert.equal(isWorkflowFeatureFlagEnabled('scheduler-run-graphify-preflight-mind'), true);
    assert.equal(otherFlag.enabled, false);
    assert.equal(plan?.workflowFeatureFlag.enabled, true);
    assert.equal(plan?.executionEnabled, false);
    assert.equal(plan?.wouldExecute, false);
    assert.equal(readiness.executionEnabled, false);
    assert.equal(readiness.enabledWorkflowFeatureFlagCount, 1);
    assert.equal(readiness.featureFlaggedWorkflowCount, getExecutionCandidateKinds().length);
    assert.equal(readiness.writesToMind, false);
    assert.equal(readiness.executableActions, false);
  });
});

test('workflow feature flags require exact true values', () => {
  const flag = getWorkflowFeatureFlag('scheduler-run-infinite-brain-report-only-pipeline');

  withEnvFlag(flag.flagName, 'yes', () => {
    assert.equal(isWorkflowFeatureFlagEnabled('scheduler-run-infinite-brain-report-only-pipeline'), false);
  });
  withEnvFlag(flag.flagName, ' TRUE ', () => {
    assert.equal(isWorkflowFeatureFlagEnabled('scheduler-run-infinite-brain-report-only-pipeline'), true);
  });
});

test('unknown workflow kinds never appear enabled', () => {
  assert.equal(isWorkflowFeatureFlagEnabled('scheduler-run-unknown-workflow'), false);
});
