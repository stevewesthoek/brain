import assert from 'node:assert/strict';
import test from 'node:test';
import { agentModeConsoleProjectionSchema } from './braincore-schemas';

const emptyProjection = {
  schemaVersion: 'agent-mode-console-v1', generatedAt: '2026-09-13T12:00:00.000Z', source: 'agent-mode-state-store',
  freshness: { status: 'empty', sourceStatus: 'available', generatedAt: '2026-09-13T12:00:00.000Z', stateStorePresent: true, message: 'empty' },
  summary: { activeRootGoalCount: 0, activeAgentCount: 0, runningTaskCount: 0, runningAttemptCount: 0, blockedCount: 0, failedCount: 0, uncertainCount: 0, pendingApprovalCount: 0, activeScheduleCount: 0, reservedCost: 0, settledCost: 0 },
  agents: [], organizations: [], tasks: [], runs: [], attempts: [], runtimes: [], budgets: [], schedules: [], approvals: [],
  evidenceSummary: { evidenceCount: 0, receiptCount: 0, latestEvidenceRefs: [] }, failures: [], modelResources: [], nodeResources: [],
};

test('canonical Agent Mode Console projection parses its empty state', () => {
  assert.equal(agentModeConsoleProjectionSchema.parse(emptyProjection).freshness.status, 'empty');
});

test('canonical Agent Mode Console schema rejects malformed and unknown critical status', () => {
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, schemaVersion: 'agent-mode-console-v2' }).success, false);
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, freshness: { ...emptyProjection.freshness, status: 'online' } }).success, false);
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, summary: { ...emptyProjection.summary, unexpected: 1 } }).success, false);
});

test('canonical schema keeps uncertainty and K5 final-result metadata explicit', () => {
  const parsed = agentModeConsoleProjectionSchema.parse({
    ...emptyProjection,
    summary: { ...emptyProjection.summary, uncertainCount: 1 },
    organizations: [{ organizationPlanId: 'plan:1', rootGoalId: 'goal:1', supervisorAgentId: 'agent:jarvis', supervisorOrganizationRoleId: 'agent-mode.org-role.jarvis-ceo.v1', status: 'completed', workItemCount: 1, dependencyCount: 0, readyCount: 0, runningCount: 0, succeededCount: 1, failedCount: 0, uncertainCount: 0, auditorStatus: 'succeeded', finalResultId: 'final:1', finalStatus: 'succeeded', aggregateCost: 0, updatedAt: null, workItems: [] }],
  });
  assert.equal(parsed.summary.uncertainCount, 1);
  assert.equal(parsed.organizations[0]?.finalResultId, 'final:1');
});
