import assert from 'node:assert/strict';
import test from 'node:test';
import { agentModeAttentionProjectionSchema, agentModeConsoleDetailResponseSchema, agentModeConsoleProjectionSchema, jarvisTextIntakeResponseSchema, jarvisTranscriptionResponseSchema } from './braincore-schemas';

const emptyProjection = {
  schemaVersion: 'agent-mode-console-v1', generatedAt: '2026-09-13T12:00:00.000Z', source: 'agent-mode-state-store',
  freshness: { status: 'empty', sourceStatus: 'available', generatedAt: '2026-09-13T12:00:00.000Z', stateStorePresent: true, message: 'empty' },
  summary: { activeRootGoalCount: 0, activeAgentCount: 0, runningTaskCount: 0, runningAttemptCount: 0, blockedCount: 0, failedCount: 0, uncertainCount: 0, pendingApprovalCount: 0, activeScheduleCount: 0, reservedCost: 0, settledCost: 0 },
  agents: [], organizations: [], tasks: [], runs: [], attempts: [], runtimes: [], budgets: [], schedules: [], approvals: [],
  evidenceSummary: { evidenceCount: 0, receiptCount: 0, latestEvidenceRefs: [] }, failures: [], modelResources: [], nodeResources: [], rootGoals: [], workcells: [], executionResources: [], controlAudits: [], attentionSummary: { openEscalationCount: 0, pendingReviewCount: 0, uncertainItemCount: 0, deadLetterCount: 0, notificationCount: 0, unreadNotificationCount: null }, escalations: [], notifications: [],
};

const emptyAttention = {
  schemaVersion: 'agent-mode-attention-v1', generatedAt: '2026-09-14T12:00:00.000Z', source: 'agent-mode-state-store',
  freshness: { status: 'empty', sourceStatus: 'available', generatedAt: '2026-09-14T12:00:00.000Z', stateStorePresent: true, message: 'empty' },
  summary: { openEscalationCount: 0, pendingReviewCount: 0, uncertainItemCount: 0, deadLetterCount: 0, notificationCount: 0, unreadNotificationCount: 0 }, escalations: [], notifications: [],
};

test('canonical Agent Mode Console projection parses its empty state', () => {
  assert.equal(agentModeConsoleProjectionSchema.parse(emptyProjection).freshness.status, 'empty');
});

test('Jarvis intake and local transcription contracts are strict and bounded', () => {
  const receipt = { schemaVersion: 'agent-mode.jarvis-text-intake.v1', intakeId: 'intake:one', status: 'accepted', canonicalTextHash: 'a'.repeat(64), rootGoalId: 'root:one', taskId: 'root:one', jarvisAgentId: 'agent:jarvis', createdAt: '2026-09-15T10:00:00.000Z' };
  assert.equal(jarvisTextIntakeResponseSchema.parse({ ok: true, result: { outcome: 'accepted', receipt } }).result.outcome, 'accepted');
  assert.equal(jarvisTextIntakeResponseSchema.safeParse({ ok: true, result: { outcome: 'accepted', receipt: { ...receipt, rootGoalId: 'forged', secret: 'no' } } }).success, false);
  assert.equal(jarvisTranscriptionResponseSchema.parse({ ok: true, voiceRequestId: 'voice:one', transcript: 'Hello Jarvis.', providerId: 'mlx-whisper-local.v1' }).providerId, 'mlx-whisper-local.v1');
});

test('attention projection is strict, bounded, and distinguishes unread notifications', () => {
  assert.equal(agentModeAttentionProjectionSchema.parse(emptyAttention).summary.unreadNotificationCount, 0);
  const notification = { schemaVersion: 'agent-mode-attention-v1', notificationId: 'agent-mode-notification:1', kind: 'uncertain_attempt', severity: 'critical', sourceType: 'attempt', sourceId: 'attempt:1', escalationId: 'agent-mode-escalation:1', reviewId: null, rootGoalId: 'goal:1', agentId: 'agent:1', taskId: 'task:1', runId: 'run:1', attemptId: 'attempt:1', workcellId: null, titleCode: 'AGENT_ATTEMPT_UNCERTAIN', messageCode: 'UNCERTAIN_RUNTIME', createdAt: '2026-09-14T12:00:00.000Z', read: false, readAt: null } as const;
  assert.equal(agentModeAttentionProjectionSchema.parse({ ...emptyAttention, summary: { ...emptyAttention.summary, notificationCount: 1, unreadNotificationCount: 1 }, notifications: [notification] }).notifications[0]?.read, false);
  assert.equal(agentModeAttentionProjectionSchema.safeParse({ ...emptyAttention, notifications: [{ ...notification, severity: 'future' }] }).success, false);
  assert.equal(agentModeAttentionProjectionSchema.safeParse({ ...emptyAttention, notifications: [{ ...notification, rawPrompt: 'must-not-parse' }] }).success, false);
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

test('canonical schema parses root, Workcell, and distinct execution resources', () => {
  const parsed = agentModeConsoleProjectionSchema.parse({
    ...emptyProjection,
    rootGoals: [{ rootGoalId: 'goal:1', jarvisAgentId: 'agent:jarvis', taskId: null, organizationPlanId: 'plan:1', status: 'active', cancellationState: 'active', deadline: null, policyId: 'policy:1', activeChildren: 1, totalChildCreations: 1, reservedCost: 0, settledCost: 0, createdAt: null, updatedAt: null }],
    workcells: [{ workcellId: 'workcell:1', taskId: 'task:1', runId: 'run:1', attemptId: 'attempt:1', repositoryRef: 'brain', branch: 'agent/one', baseRef: 'main', ownerAgent: 'agent:one', status: 'active', createdAt: '2026-09-14T12:00:00.000Z', updatedAt: '2026-09-14T12:00:00.000Z', lease: null, validation: null, diff: null, reviewStatus: null, commitStatus: null, mergeStatus: null }],
    executionResources: [{ resourceId: 'dispatch:1', attemptId: 'attempt:1', taskId: 'task:1', runId: 'run:1', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', modelRef: 'deferred:none', status: 'verified', freshness: 'known', updatedAt: null }],
  });
  assert.equal(parsed.rootGoals[0]?.jarvisAgentId, 'agent:jarvis');
  assert.equal(parsed.workcells[0]?.repositoryRef, 'brain');
  assert.equal(parsed.executionResources[0]?.freshness, 'known');
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, workcells: [{ workcellId: 'workcell:1', taskId: 'task:1', runId: 'run:1', attemptId: 'attempt:1', repositoryRef: '/private/path', branch: 'main', baseRef: 'main', ownerAgent: 'agent:1', status: 'active', createdAt: 'now', updatedAt: 'now', lease: null, validation: null, diff: null, reviewStatus: null, commitStatus: null, mergeStatus: null, unexpected: true }] }).success, false);
});

test('canonical schema parses bounded control audit metadata and rejects unknown control status', () => {
  const audit = { operationId: 'agent-mode-control:fixture', action: 'kill', decision: null, targetType: 'run', targetId: 'run:fixture', actor: 'service:brain-console', serviceActor: 'service:brain-console', operatorId: 'operator:fixture', status: 'completed', reason: 'operator fixture', reasonCode: 'KILL_APPLIED', occurredAt: '2026-09-14T12:00:00.000Z', receiptRef: 'event:control-receipt', processIdentityVerified: true, signalSent: true } as const;
  const parsed = agentModeConsoleProjectionSchema.parse({ ...emptyProjection, controlAudits: [audit] });
  assert.equal(parsed.controlAudits[0]?.operatorId, 'operator:fixture');
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, controlAudits: [{ ...audit, status: 'future' }] }).success, false);
  assert.equal(agentModeConsoleProjectionSchema.safeParse({ ...emptyProjection, controlAudits: [{ ...audit, operatorId: 'operator:fixture', sessionAuditId: 'should-not-be-exposed' }] }).success, false);
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
