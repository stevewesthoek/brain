import assert from 'node:assert/strict';
import test from 'node:test';
import { agentModeConsoleDetailResponseSchema, agentModeConsoleProjectionSchema } from './braincore-schemas';

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

test('detail union parses safe Agent, Organization, and Evidence responses', () => {
  const freshness = { status: 'fresh', sourceStatus: 'available', generatedAt: '2026-09-13T12:00:00.000Z', stateStorePresent: true, message: 'fresh' } as const;
  const evidence = { evidenceRef: 'k4:evidence:fixture', evidenceType: 'runtime-receipt', ownerRootGoalId: 'goal:1', ownerAgentId: 'agent:1', ownerTaskId: 'task:1', ownerRunId: 'run:1', ownerAttemptId: 'attempt:1', receiptType: 'k4-runtime-receipt', verificationStatus: 'verified', createdAt: freshness.generatedAt, contentSize: null, digest: 'digest:1', redactionStatus: 'metadata-only', relatedOperationId: 'operation:1', relatedResultRef: 'k4:runtime:result:1' };
  const parsed = agentModeConsoleDetailResponseSchema.parse({ schemaVersion: 'agent-mode-console-detail-v1', generatedAt: freshness.generatedAt, source: 'agent-mode-state-store', freshness, kind: 'evidence', id: evidence.evidenceRef, status: 'available', detail: { kind: 'evidence', ...evidence } });
  assert.equal(parsed.status, 'available');
  if (parsed.status === 'available') assert.equal(parsed.detail.kind, 'evidence');
});

test('detail schema rejects malformed bodies and unknown discriminants', () => {
  const base = { schemaVersion: 'agent-mode-console-detail-v1', generatedAt: '2026-09-13T12:00:00.000Z', source: 'agent-mode-state-store', freshness: { status: 'fresh', sourceStatus: 'available', generatedAt: '2026-09-13T12:00:00.000Z', stateStorePresent: true, message: 'fresh' }, kind: 'agent', id: 'agent:1', status: 'available' };
  assert.equal(agentModeConsoleDetailResponseSchema.safeParse({ ...base, detail: { kind: 'future', agentId: 'agent:1' } }).success, false);
  assert.equal(agentModeConsoleDetailResponseSchema.safeParse({ ...base, detail: { kind: 'agent', agentId: 'agent:1' } }).success, false);
  assert.equal(agentModeConsoleDetailResponseSchema.safeParse({ ...base, kind: 'future', detail: null, status: 'not_found', reasonCode: 'DETAIL_NOT_FOUND' }).success, false);
});
