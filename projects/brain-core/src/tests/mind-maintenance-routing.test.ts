import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMindMaintenanceJobRouter,
  MIND_MAINTENANCE_SCHEDULER_JOB,
} from '../adapters/mind-maintenance-routing.js';
import type { AiModelSelectionRequest } from '../adapters/ai-model-selector-service.js';
import type { MindMaintenancePilotRunnerInput } from '../mind-maintenance-pilot/pilot-runner.js';

function createHarness() {
  let selectorCalls = 0;
  let receivedSelectionRequest: AiModelSelectionRequest | null = null;
  let receivedPilotInput: MindMaintenancePilotRunnerInput | null = null;

  const route = createMindMaintenanceJobRouter({
    selectModel: async (request) => {
      selectorCalls += 1;
      receivedSelectionRequest = request;
      return {
        outcome: 'selected',
        ok: true,
        selectedModel: 'test-model',
        provider: 'test-provider',
        reason: 'bounded routing test',
      };
    },
    pilot: {
      now: () => new Date('2026-06-17T12:00:00.000Z'),
      resolveMindRoot: (value) => value || '/tmp/mind',
      resolveSourceCommit: async () => 'abc1234',
      listChangedPaths: async () => [],
      runPilot: async (input) => {
        receivedPilotInput = input;
        return {
          ok: true,
          status: 'completed',
          mode: 'report-only',
          reportId: 'maintenance-test',
          sourceCommit: input.sourceCommit,
          filesConsidered: 5,
          findingsTotal: 0,
          detectorErrors: 0,
          decisionStatistics: {
            loaded: 0,
            matched: 0,
            unmatched: 0,
            accepted: 0,
            suppressed: 0,
          },
          reports: ['system/reports/maintenance-latest.json', 'system/reports/maintenance-latest.md'],
          sourceFilesChanged: 0,
          integrity: {
            ok: true,
            changedPaths: [],
            changedSourcePaths: [],
            allowedOutputPaths: [
              'system/reports/maintenance-latest.json',
              'system/reports/maintenance-latest.md',
            ],
            unexpectedChangedPaths: [],
          },
          nextAction: 'Review the Markdown report.',
        };
      },
    },
  });

  return {
    route,
    getSelectorCalls: () => selectorCalls,
    getSelectionRequest: () => receivedSelectionRequest,
    getReceivedPilotInput: () => receivedPilotInput,
  };
}

test('routes report-only maintenance through Brain Core, scheduler, and Mind Steward without selector use for zero ambiguous checks', async () => {
  const harness = createHarness();
  const routed = await harness.route({
    enabled: true,
    mindRoot: '/tmp/mind',
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-17T12:00:00.000Z',
    ambiguousSemanticChecks: 0,
  });

  assert.equal(MIND_MAINTENANCE_SCHEDULER_JOB.id, 'mind-maintenance-report-only');
  assert.equal(routed.route.runtime, 'brain-core');
  assert.equal(routed.route.owner, 'mind-steward');
  assert.equal(routed.route.schedulerJob.mutationRequired, false);
  assert.equal(routed.route.modelSelector.consulted, false);
  assert.equal(harness.getSelectorCalls(), 0);
  assert.equal(routed.result.mode, 'report-only');
  assert.equal(routed.result.ok && routed.result.sourceFilesChanged, 0);
  assert.equal(harness.getReceivedPilotInput()?.generatedBy, 'brain-core/scheduler/mind-steward');
});

test('consults AI Model Selector only when ambiguous semantic checks are present', async () => {
  const harness = createHarness();
  const routed = await harness.route({
    enabled: true,
    mindRoot: '/tmp/mind',
    sourceCommit: 'abc1234',
    generatedAt: '2026-06-17T12:00:00.000Z',
    ambiguousSemanticChecks: 2,
  });

  assert.equal(routed.route.modelSelector.consulted, true);
  assert.equal(harness.getSelectorCalls(), 1);
  assert.deepEqual(harness.getSelectionRequest(), {
    task_type: 'mind_maintenance_semantic_comparison',
    taskMetadata: {
      private: true,
      sensitive: true,
      allowed_providers: ['claude-bedrock'],
      allowed_models: ['us.anthropic.claude-sonnet-4-6'],
      preferred_providers: ['claude-bedrock'],
      preferred_models: ['us.anthropic.claude-sonnet-4-6'],
      fallback_policy: 'none',
    },
  });
  assert.equal(routed.route.modelSelector.selection?.selectedModel, 'test-model');
});

test('resolves omitted pilot values through shared bounded dependencies', async () => {
  const harness = createHarness();
  await harness.route({
    enabled: true,
    ambiguousSemanticChecks: 0,
  });

  const input = harness.getReceivedPilotInput();
  assert.equal(input?.mindRoot, '/tmp/mind');
  assert.equal(input?.sourceCommit, 'abc1234');
  assert.equal(input?.generatedAt, '2026-06-17T12:00:00.000Z');
  assert.deepEqual(await input?.listChangedPaths(), []);
});

test('rejects negative ambiguous semantic check counts before routing', async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.route({
      enabled: true,
      ambiguousSemanticChecks: -1,
    }),
    /non-negative ambiguousSemanticChecks count/,
  );
  assert.equal(harness.getSelectorCalls(), 0);
  assert.equal(harness.getReceivedPilotInput(), null);
});
