import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AgentModeOrganizationDelegationOrchestrator, K5_B_FIXTURE_DELEGATION_RULES } from '../agent-mode/organization-delegation-orchestrator.js';
import { AgentModeOrganizationFinalizer } from '../agent-mode/organization-finalization.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { JarvisReadableResultService, JarvisResponseFinalizer, deriveJarvisResponseFinalizationOperationId } from '../agent-mode/jarvis-response-finalizer.js';
import { JARVIS_READABLE_RESULT_OWNER, JARVIS_READABLE_RESULT_SCHEMA_VERSION, JARVIS_READABLE_RESULT_TYPE, deriveJarvisReadableResultContentHash } from '../agent-mode/jarvis-response-sources.js';
import { JarvisTextIntakeService } from '../agent-mode/jarvis-text-intake.js';
import { MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';
import { createStateSnapshot, importStateSnapshot } from '../agent-mode/state-relocation.js';
import { assessRollbackCompatibility, createBackupManifest, verifyBackupManifest, type BrainAgentReleaseManifest } from '../agent-mode/release-maintenance.js';

const NOW = '2026-09-17T18:10:00.000Z';
const LATER = '2026-09-17T18:11:00.000Z';
const DEADLINE = '2026-09-17T20:00:00.000Z';
const SUPERVISOR = 'agent:jarvis';
const SUPERVISOR_RUN = 'run:jarvis:release-drill';

function rootFacts(rootGoalId: string, now: string) {
  return {
    now,
    globalKillSwitchDenied: false,
    rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1_000, remainingBudget: 2, deadline: DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: rootGoalId, runId: SUPERVISOR_RUN, rootGoalId, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

test('production signing drill fixture preserves representative Brain state across logical backup and restore', async () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-production-signing-fixture-'));
  const databasePath = path.join(root, 'baseline.db');
  const restoredPath = path.join(root, 'restored.db');
  const rollbackPath = path.join(root, 'rollback.db');
  try {
    const store = new AgentModeSqliteStateStore(databasePath);
    const intake = new JarvisTextIntakeService(store, () => NOW).acceptCommand({ schemaVersion: 'agent-mode.jarvis-text-intake.v1', intakeId: 'intake:release-drill', source: 'typed', operatorId: 'operator:release-drill', text: 'Run the bounded release maintenance fixture.', receivedAt: NOW });
    assert.equal(intake.outcome, 'accepted');
    if (intake.outcome !== 'accepted') return;
    const rootGoalId = intake.receipt.rootGoalId;
    store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'release-drill-supervisor', capabilities: ['repo.read'] });
    assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: rootGoalId, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
    const plan = createK5AFixturePlan({ rootGoalId, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: DEADLINE });
    const planId = deriveOrganizationPlanId(plan);
    assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');

    const runtime = new MockAgentRuntime({ runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:fixture', modelRef: 'model:fixture', modelResult: { kind: 'typed-fixture-result', traceId: 'release-drill', intent: { kind: 'no-outbox', relativePath: 'README.md' } } });
    const controller = new AgentModeOrganizationDelegationOrchestrator({ store, runtime, now: NOW, controllerRef: 'controller:release-drill', supervisorTaskId: rootGoalId, supervisorRunId: SUPERVISOR_RUN, rootFacts: (candidate, now) => candidate === rootGoalId ? rootFacts(rootGoalId, now) : undefined, rules: K5_B_FIXTURE_DELEGATION_RULES });
    const firstPass = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.ok(firstPass.outcome === 'ADVANCED' || firstPass.outcome === 'TERMINAL', JSON.stringify(firstPass));
    const secondPass = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.ok(secondPass.outcome === 'ADVANCED' || secondPass.outcome === 'TERMINAL', JSON.stringify(secondPass));
    assert.equal(runtime.dispatchInvocationCount, 3);
    const finalization = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId, now: NOW });
    assert.equal(finalization.outcome, 'FINALIZED', JSON.stringify(finalization));
    const finalResultRef = finalization.finalResult!.organizationFinalResultId;
    const readable = { schemaVersion: JARVIS_READABLE_RESULT_SCHEMA_VERSION, resultRef: finalResultRef, rootGoalId, taskId: rootGoalId, owner: JARVIS_READABLE_RESULT_OWNER, resultType: JARVIS_READABLE_RESULT_TYPE, facts: finalization.finalResult!.workItemResults.map((item) => ({ factId: `fact:${item.workItemKey}`, workItemKey: item.workItemKey, text: `The ${item.workItemKey} stage completed.`, evidenceRefs: [...item.evidenceRefs] })), contentHash: '', createdAt: NOW };
    assert.equal(new JarvisReadableResultService(store).publish({ ...readable, contentHash: deriveJarvisReadableResultContentHash(readable) }).outcome, 'published');
    const response = new JarvisResponseFinalizer(store).finalize({ schemaVersion: 'agent-mode.jarvis-response-finalization.v1', rootGoalId, taskId: rootGoalId, sourceResultRef: finalResultRef, operationId: deriveJarvisResponseFinalizationOperationId({ rootGoalId, taskId: rootGoalId, sourceResultRef: finalResultRef }), requestedAt: NOW });
    assert.equal(response.outcome, 'PUBLISHED');

    const research = store.listOrganizationWorkItems(planId).find((item) => item.workItemKey === 'research')!;
    const assignment = store.getChildAssignment(research.boundChildAgentId!)!;
    const workcellId = 'workcell:release-drill-review';
    assert.equal(store.createWorkcell({ workcellId, taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, repositoryRef: 'fixture:release-drill', repositoryRoot: '/tmp/fixture-repository', worktreePath: '/tmp/fixture-workcell', branch: 'fixture/release-drill', ownerAgent: assignment.childAgentId, baseRef: 'main', createdAt: NOW, updatedAt: NOW, status: 'prepared' }, { receiptId: 'receipt:release-drill-workcell', receiptType: 'WorkcellCreatedReceipt', taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, workcellId, repositoryRef: 'fixture:release-drill', actor: SUPERVISOR, timestamp: NOW, operationHash: 'hash:release-drill-workcell', operation: 'create', resultState: 'prepared' }), 'created');
    const writer = store.grantWorkcellWriterLease({ leaseId: 'lease:release-drill-writer', workcellId, ownerAgent: assignment.childAgentId, ownerAttempt: assignment.attemptId, createdAt: NOW, expiresAt: DEADLINE });
    assert.equal(writer.result, 'granted');
    assert.equal(store.recordWorkcellDiff({ diffId: 'diff:release-drill', taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, workcellId, repositoryRef: 'fixture:release-drill', branch: 'fixture/release-drill', baseRevision: 'base:release-drill', currentRevision: 'head:release-drill', changedFiles: ['README.md'], diffHash: 'hash:release-drill-diff', leaseId: writer.lease!.leaseId, fenceToken: writer.lease!.fenceToken, capturedAt: NOW }, { receiptId: 'receipt:release-drill-diff', receiptType: 'DiffCapturedReceipt', taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, workcellId, leaseId: writer.lease!.leaseId, fenceToken: writer.lease!.fenceToken, timestamp: NOW, operationHash: 'hash:release-drill-diff', resultState: 'captured' }), 'created');
    const validation = store.startWorkcellValidation({ validationId: 'validation:release-drill', workcellId, capability: 'validation.run(workcell)', ownerAgent: assignment.childAgentId, ownerAttempt: assignment.attemptId, leaseId: writer.lease!.leaseId, fenceToken: writer.lease!.fenceToken, repositoryRoot: '/tmp/fixture-repository', worktreePath: '/tmp/fixture-workcell', resourceValid: true, validatorAllowed: true, validatorProfile: 'git.diff.integrity', diffId: 'diff:release-drill', operationHash: 'hash:release-drill-validation', startedAt: NOW });
    assert.equal(validation.result, 'started');
    assert.equal(store.completeWorkcellValidation({ validationId: 'validation:release-drill', evidenceHash: 'hash:release-drill-validation-evidence', evidenceJson: '{"result":"passed"}', result: 'passed', completedAt: LATER }), 'created');
    assert.equal(store.createReviewRequest({ reviewId: 'review:release-drill', workcellId, taskId: assignment.taskId, runId: assignment.runId, attemptId: assignment.attemptId, workerAgentId: assignment.childAgentId, repositoryRef: 'fixture:release-drill', branch: 'fixture/release-drill', baseRevision: 'base:release-drill', currentRevision: 'head:release-drill', diffId: 'diff:release-drill', diffHash: 'hash:release-drill-diff', validationId: 'validation:release-drill', validationEvidenceHash: 'hash:release-drill-validation-evidence', requestingActor: SUPERVISOR, createdAt: LATER, expiresAt: DEADLINE, status: 'pending' }), 'created');

    store.upsertAgent({ agentId: 'agent:uncertain-fixture', agentKind: 'worker', role: 'fixture', displayName: 'Uncertain fixture', policyId: 'policy:fixture', status: 'active', rootGoalId, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 1, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'uncertain-fixture', capabilities: ['repo.read'] });
    store.admitAttempt({ task: { taskId: 'task:uncertain-fixture', taskType: 'fixture', inputHash: 'input:uncertain-fixture', createdAt: NOW }, run: { runId: 'run:uncertain-fixture', taskId: 'task:uncertain-fixture', agentId: 'agent:uncertain-fixture', createdAt: NOW, status: 'active' }, attempt: { attemptId: 'attempt:uncertain-fixture', runId: 'run:uncertain-fixture', agentId: 'agent:uncertain-fixture', runtimeRef: 'runtime:fixture', routeRef: 'route:fixture', modelRef: 'model:fixture', policyVersion: 'policy:fixture', capabilityScopeHash: 'scope:uncertain-fixture', budgetScopeId: 'budget:uncertain-fixture', createdAt: NOW }, budget: { budgetScopeId: 'budget:uncertain-fixture', maxSteps: 2, maxTokens: 10, maxDollars: 1 }, estimate: { reservationId: 'reservation:uncertain-fixture', steps: 1, tokens: 1, dollars: 0.01 }, lease: { leaseId: 'lease:uncertain-fixture', resourceKey: 'resource:uncertain-fixture', ownerId: 'agent:uncertain-fixture', expiresAt: DEADLINE }, now: NOW });
    assert.equal(store.recordEffect({ operationId: 'operation:uncertain-fixture', attemptId: 'attempt:uncertain-fixture', effectKind: 'fixture.external-read', scopeHash: 'scope:uncertain-fixture', status: 'uncertain' }), 'created');
    assert.equal(store.reconcileAgentModeAttention(LATER).createdNotifications, 1);
    assert.equal(store.listAgentModeNotifications().length, 1);
    assert.equal(store.listSchedulerSchedules().length, 0);
    assert.equal(store.createSchedulerSchedule({ scheduleId: 'schedule:release-drill', kind: 'agent_mode.release_drill', dueAt: DEADLINE, createdAt: NOW, deduplicationKey: 'dedupe:release-drill', causationId: null, correlationId: 'correlation:release-drill', payloadVersion: 'k4.0', payload: { fixture: 'release-drill' }, nextEligibleAt: DEADLINE, deadline: null, maxAttempts: 1 }), 'created');
    assert.equal(store.listSchedulerSchedules().length, 1);

    const settledEffect = store.listEffects().find((effect) => effect.status === 'succeeded');
    assert.ok(settledEffect?.leaseFence !== undefined, 'settled K4 effect must retain lease/fence lineage');
    store.close();

    const readOnly = AgentModeSqliteStateStore.openExisting(databasePath)!;
    const snapshot = createStateSnapshot(readOnly, { mode: 'backup/logical-fixture', createdAt: LATER });
    readOnly.close();
    assert.ok((snapshot.counts.tasks ?? 0) >= 4);
    assert.ok((snapshot.counts.runs ?? 0) >= 4);
    assert.ok((snapshot.counts.attempts ?? 0) >= 4);
    assert.ok((snapshot.counts.effects ?? 0) >= 2);
    assert.equal(snapshot.recordFamilies.some((family) => family.family === 'agent_mode_organization_final_results'), true);
    const release: BrainAgentReleaseManifest = { schemaVersion: 'brain-agent-release-v1', releaseVersion: '1.0.0', releaseId: 'brain-agent-release:fixture', sourceRevision: '78c14f46', runtimePackageId: 'fixture-package', runtimePackageManifestHash: 'a'.repeat(64), coreBuildIdentity: 'fixture-core', consoleBuildIdentity: 'fixture-console', stateStoreSchemaVersion: 11, stateSnapshotSchemaVersion: 'brain-state-snapshot-v1', installContractVersion: 'brain-local-install-v1', releaseContractVersion: 'brain-agent-release-contract-v1', nodeRange: '>=22.5.0', buildTimestamp: NOW, supportStatus: 'candidate', previousReleaseVersion: null, provenance: { scheme: 'ed25519-sha256', keyId: 'fixture', signature: 'fixture' } };
    const backup = createBackupManifest({ release, snapshot, createdAt: LATER });
    assert.equal(verifyBackupManifest(backup, snapshot).ok, true);
    assert.equal(importStateSnapshot(snapshot, restoredPath, snapshot.snapshotId).ok, true);
    const restored = AgentModeSqliteStateStore.openExisting(restoredPath)!;
    assert.deepEqual(restored.readPortableRecordFamilies(10_000), snapshot.recordFamilies);
    assert.equal(restored.listOrganizationFinalResults().length, 1);
    assert.equal(restored.listJarvisUserResponses().length, 1);
    assert.equal(restored.listReviewRequests().filter((item) => item.status === 'pending').length, 1);
    assert.equal(restored.listSchedulerSchedules().length, 1);
    assert.equal(restored.listEffects().filter((effect) => effect.status === 'uncertain').length, 1);
    const beforeReplay = restored.listEffects().length;
    assert.equal(restored.recordEffect({ operationId: 'operation:uncertain-fixture', attemptId: 'attempt:uncertain-fixture', effectKind: 'fixture.external-read', scopeHash: 'scope:uncertain-fixture', status: 'uncertain' }), 'duplicate');
    assert.equal(restored.listEffects().length, beforeReplay);
    restored.close();
    assert.equal(importStateSnapshot(snapshot, restoredPath, snapshot.snapshotId).ok, false);
    assert.equal(assessRollbackCompatibility(release, { ...release, releaseVersion: '0.9.0', previousReleaseVersion: null }), 'compatible');
    assert.equal(importStateSnapshot(snapshot, rollbackPath, snapshot.snapshotId).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
