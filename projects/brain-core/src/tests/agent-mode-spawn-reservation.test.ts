import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AGENT_MODE_SPAWN_POLICIES,
  SPAWN_POLICY_READ_ONLY,
  SPAWN_POLICY_SAFE_ENGINEERING,
  SPAWN_ROLE_READ_ONLY,
  SPAWN_ROLE_SAFE_ENGINEERING,
  evaluateSpawnAdmission,
  type SpawnAuthorityFacts,
  type SpawnRequest,
} from '../agent-mode/spawn-policy.js';
import { AgentModeSqliteStateStore, type AgentModeSpawnCreationInput } from '../agent-mode/sqlite-state-store.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { WORKCELL_READ_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY, WORKCELL_WRITE_CAPABILITY } from '../agent-mode/workcell.js';
import { CI_WORKFLOW_COMPLETED_EVENT, CI_WORKFLOW_RUN_SOURCE } from '../agent-mode/event-source.js';

const now = '2026-09-10T10:00:00.000Z';
const deadline = '2026-09-10T11:00:00.000Z';

function makeRequest(rootGoalId: string, sourceEventId: string, overrides: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    schemaVersion: 1, requestId: `request:${sourceEventId}`, policyId: SPAWN_POLICY_READ_ONLY, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, sourceId: 'source:git', sourceEventId,
    sourceType: GIT_REPOSITORY_REVISION_SOURCE, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, eventRootGoalId: rootGoalId,
    eventScope: { repositoryRef: 'brain', resourceRef: null }, parentAgentId: null, parentTaskId: null, parentRunId: null,
    rootGoalId, requestedScope: { repositoryRef: 'brain', resourceRef: null }, requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000, requestedStepBudget: 10, requestedCostBudget: 0.1, requestedAt: now, deadline, requestedDepth: 1, ...overrides,
  };
}

function makeFacts(rootGoalId: string, overrides: Partial<SpawnAuthorityFacts> = {}): SpawnAuthorityFacts {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: {
      rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active', remainingSteps: 1000,
      remainingBudget: 2, deadline, delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [],
    }, parent: null, ...overrides,
  };
}

function admission(rootGoalId: string, eventId: string, requestOverrides: Partial<SpawnRequest> = {}, factOverrides: Partial<SpawnAuthorityFacts> = {}): AgentModeSpawnCreationInput {
  const request = makeRequest(rootGoalId, eventId, requestOverrides);
  const facts = makeFacts(rootGoalId, factOverrides);
  const decision = evaluateSpawnAdmission(request, facts);
  assert.equal(decision.result, 'ALLOW');
  return { request, facts, admission: decision };
}

function engineeringAdmission(rootGoalId: string, eventId: string, requestOverrides: Partial<SpawnRequest> = {}, factOverrides: Partial<SpawnAuthorityFacts> = {}): AgentModeSpawnCreationInput {
  return admission(rootGoalId, eventId, {
    policyId: SPAWN_POLICY_SAFE_ENGINEERING, policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_SAFE_ENGINEERING, roleTemplateVersion: 1,
    sourceId: 'source:ci', sourceEventId: eventId,
    sourceType: CI_WORKFLOW_RUN_SOURCE, eventType: CI_WORKFLOW_COMPLETED_EVENT,
    eventScope: { repositoryRef: 'brain', resourceRef: 'workcell' },
    requestedScope: { repositoryRef: 'brain', resourceRef: 'workcell' },
    requestedCapabilities: [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY],
    requestedStepBudget: 10, requestedCostBudget: 1,
    ...requestOverrides,
  }, {
    root: {
      ...makeFacts(rootGoalId).root!,
      delegableCapabilities: [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY],
      resourceScopes: ['workcell'], remainingBudget: 4,
    },
    ...factOverrides,
  });
}

function withStore<T>(fn: (store: AgentModeSqliteStateStore, databasePath: string, directory: string) => T): T {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42b-spawn-'));
  const databasePath = path.join(directory, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  try { return fn(store, databasePath, directory); } finally { try { store.close(); } catch { /* restart tests close explicitly */ } rmSync(directory, { recursive: true, force: true }); }
}

function created(store: AgentModeSqliteStateStore, input: AgentModeSpawnCreationInput) {
  const result = store.reserveSpawnAndCreateChild(input);
  assert.equal(result.result, 'created');
  if (result.result !== 'created') throw new Error('expected created result');
  return result.receipt;
}

function spawnReason(result: ReturnType<AgentModeSqliteStateStore['reserveSpawnAndCreateChild']>): string {
  if (result.result === 'denied' || result.result === 'conflict') return result.reasonCode;
  throw new Error('expected denied result');
}

test('admitted decision creates one durable child identity', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:1'));
  assert.equal(store.getAgent(receipt.childAgentId)?.status, 'reserved');
}));
test('denied decision cannot create a child', () => withStore((store) => {
  const input = admission('goal:1', 'event:2'); input.admission = { ...input.admission, result: 'DENY', reasonCode: 'CANCELLED' };
  const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(store.listAgents().length, 0);
}));
test('controller owns child identity and ignores event child identity fields', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:3', { requestId: 'requested-child-agent:evil' })); assert.match(receipt.childAgentId, /^agent:child:/); assert.notEqual(receipt.childAgentId, 'requested-child-agent:evil');
}));
test('child persists exact parent and root lineage', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:4')); const child = store.getAgent(receipt.childAgentId)!; assert.equal(child.rootGoalId, 'goal:1'); assert.equal(child.parentAgentId, null); assert.equal(child.parentTaskId, null); assert.equal(child.parentRunId, null); assert.equal(child.depth, 1);
}));
test('child persists role and policy versions', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:5')); const child = store.getAgent(receipt.childAgentId)!; assert.equal(child.roleTemplateId, SPAWN_ROLE_READ_ONLY); assert.equal(child.roleTemplateVersion, 1); assert.equal(child.policyId, SPAWN_POLICY_READ_ONLY); assert.equal(child.policyVersion, 1);
}));
test('child persists capability and scope snapshot', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:6')); const child = store.getAgent(receipt.childAgentId)!; assert.deepEqual(child.capabilities, [WORKCELL_READ_CAPABILITY]); assert.equal(child.repositoryScope, 'brain'); assert.equal(child.resourceScope, null); assert.ok(child.capabilitySetHash);
}));
test('child expiry is finite and derived from admitted TTL', () => withStore((store) => {
  const receipt = created(store, admission('goal:1', 'event:7')); assert.equal(receipt.expiresAt, '2026-09-10T10:01:00.000Z'); assert.ok(Date.parse(receipt.expiresAt) > Date.parse(now));
}));
test('creation does not create child task run or attempt', () => withStore((store) => { created(store, admission('goal:1', 'event:8')); assert.equal(store.listTasks().length, 0); assert.equal(store.listRuns().length, 0); assert.equal(store.listAttempts().length, 0); }));
test('creation appends bounded lifecycle event and durable receipt', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:9')); assert.equal(store.getSpawnCreationReceipt(receipt.spawnIntentKey)?.childAgentId, receipt.childAgentId); assert.equal(store.listRecentEvents(20).filter((event) => event.eventType === 'child_agent_created').length, 1); }));
test('stale prior allow is rechecked against global kill switch', () => withStore((store) => { const input = admission('goal:1', 'event:10'); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'race', updatedAt: now }); const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'GLOBAL_KILL_SWITCH'); assert.equal(store.listAgents().length, 0); }));
test('stale prior allow is rechecked against root kill switch', () => withStore((store) => { const input = admission('goal:1', 'event:11'); created(store, admission('goal:1', 'event:11a')); store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: 'goal:1', denied: true, reason: 'race', updatedAt: now }); const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'ROOT_KILL_SWITCH'); }));
test('stale prior allow is rechecked against root cancellation', () => withStore((store) => { const input = admission('goal:1', 'event:12'); created(store, admission('goal:1', 'event:12a')); store.setSpawnRootCancellation('goal:1', 'requested', now); const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'CANCELLED'); }));
test('stale prior allow is rechecked against root deadline', () => withStore((store) => { const input = admission('goal:1', 'event:13'); created(store, admission('goal:1', 'event:13a')); store.setSpawnRootDeadline('goal:1', '2026-09-10T09:00:00.000Z', now); const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'DEADLINE_EXPIRED'); }));
test('stale prior allow is rechecked against active-child count', () => withStore((store) => { const input = admission('goal:1', 'event:14'); created(store, admission('goal:1', 'event:14a')); created(store, admission('goal:1', 'event:14b')); created(store, admission('goal:1', 'event:14c')); const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'created'); }));
test('duplicate retry returns the same receipt and child', () => withStore((store) => { const input = admission('goal:1', 'event:15'); const first = created(store, input); const second = store.reserveSpawnAndCreateChild(input); assert.equal(second.result, 'duplicate'); if (second.result === 'duplicate') assert.deepEqual(second.receipt, first); }));
test('duplicate retry does not increment total count', () => withStore((store) => { const input = admission('goal:1', 'event:16'); created(store, input); store.reserveSpawnAndCreateChild(input); assert.equal(store.getSpawnRootState('goal:1')?.totalChildCreations, 1); }));
test('duplicate retry does not reserve budget twice', () => withStore((store) => { const input = admission('goal:1', 'event:17'); created(store, input); store.reserveSpawnAndCreateChild(input); assert.equal(store.getSpawnRootState('goal:1')?.reservedChildSteps, 10); assert.equal(store.getSpawnRootState('goal:1')?.reservedChildCost, 0.1); }));
test('same intent with changed immutable material conflicts', () => withStore((store) => { const input = admission('goal:1', 'event:18'); created(store, input); const changed = admission('goal:1', 'event:18', { requestedTtl: 120_000 }); const result = store.reserveSpawnAndCreateChild(changed); assert.equal(result.result, 'conflict'); }));
test('retirement releases active slot and unused allocation', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:19')); assert.equal(store.retireChildAgent(receipt.childAgentId, 'retired', now).result, 'retired'); const root = store.getSpawnRootState('goal:1')!; assert.equal(root.activeChildren, 0); assert.equal(root.reservedChildSteps, 0); assert.equal(root.reservedChildCost, 0); }));
test('retirement does not decrement total creations', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:20')); store.retireChildAgent(receipt.childAgentId, 'retired', now); assert.equal(store.getSpawnRootState('goal:1')?.totalChildCreations, 1); }));
test('retirement is idempotent', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:21')); store.retireChildAgent(receipt.childAgentId, 'retired', now); const again = store.retireChildAgent(receipt.childAgentId, 'retired', now); assert.equal(again.result, 'duplicate'); assert.equal(store.getSpawnRootState('goal:1')?.activeChildren, 0); }));
test('expired child reconciliation releases slot once', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:22')); assert.deepEqual(store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z'), [receipt.childAgentId]); assert.deepEqual(store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z'), []); assert.equal(store.getAgent(receipt.childAgentId)?.status, 'expired'); }));
test('expired child cannot retain active slot forever', () => withStore((store) => { created(store, admission('goal:1', 'event:23')); assert.equal(store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z').length, 1); assert.equal(store.getSpawnRootState('goal:1')?.activeChildren, 0); }));
test('root aggregate state is isolated', () => withStore((store) => { created(store, admission('goal:a', 'event:24a')); created(store, admission('goal:b', 'event:24b')); assert.equal(store.getSpawnRootState('goal:a')?.totalChildCreations, 1); assert.equal(store.getSpawnRootState('goal:b')?.totalChildCreations, 1); }));
test('root-local kill switch does not deny another root', () => withStore((store) => { created(store, admission('goal:a', 'event:25a')); store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: 'goal:a', denied: true, reason: 'stop', updatedAt: now }); assert.equal(created(store, admission('goal:b', 'event:25b')).rootGoalId, 'goal:b'); }));
test('global kill switch denies every root', () => withStore((store) => { created(store, admission('goal:a', 'event:26a')); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'stop', updatedAt: now }); const result = store.reserveSpawnAndCreateChild(admission('goal:b', 'event:26b')); assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'GLOBAL_KILL_SWITCH'); }));
test('retire then recreate preserves monotonic total', () => withStore((store) => { const first = created(store, admission('goal:1', 'event:27a')); store.retireChildAgent(first.childAgentId, 'retired', now); const second = created(store, admission('goal:1', 'event:27b')); assert.equal(store.getSpawnRootState('goal:1')?.activeChildren, 1); assert.equal(store.getSpawnRootState('goal:1')?.totalChildCreations, 2); assert.notEqual(first.childAgentId, second.childAgentId); }));
test('restart preserves active child and allocation', () => withStore((store, databasePath) => { const receipt = created(store, admission('goal:1', 'event:28')); store.close(); const reopened = AgentModeSqliteStateStore.openExisting(databasePath)!; assert.equal(reopened.getAgent(receipt.childAgentId)?.status, 'reserved'); assert.equal(reopened.getSpawnRootState('goal:1')?.reservedChildSteps, 10); reopened.close(); }));
test('restart preserves retired child and aggregate count', () => withStore((store, databasePath) => { const receipt = created(store, admission('goal:1', 'event:29')); store.retireChildAgent(receipt.childAgentId, 'retired', now); store.close(); const reopened = AgentModeSqliteStateStore.openExisting(databasePath)!; assert.equal(reopened.getAgent(receipt.childAgentId)?.status, 'retired'); assert.equal(reopened.getSpawnRootState('goal:1')?.totalChildCreations, 1); reopened.close(); }));
test('restart recovers a lost response by idempotent retry', () => withStore((store, databasePath) => { const input = admission('goal:1', 'event:30'); const first = created(store, input); store.close(); const reopened = new AgentModeSqliteStateStore(databasePath); const second = reopened.reserveSpawnAndCreateChild(input); assert.equal(second.result, 'duplicate'); if (second.result === 'duplicate') assert.equal(second.receipt.childAgentId, first.childAgentId); reopened.close(); }));
test('existing non-spawned agents remain valid and uncounted', () => withStore((store) => { store.upsertAgent({ agentId: 'agent:system', agentKind: 'system', role: 'system', displayName: 'System', policyId: 'policy:system', status: 'active' }); created(store, admission('goal:1', 'event:31')); assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 1); assert.equal(store.getSpawnRootState('goal:1')?.totalChildCreations, 1); assert.equal(store.getAgent('agent:system')?.status, 'active'); }));
test('observer reconstructs bounded child state and root aggregate', () => withStore((store, databasePath) => { const receipt = created(store, admission('goal:1', 'event:32')); const projection = readAgentModeObserver(now, databasePath); assert.equal(projection.agents.find((agent) => agent.agentId === receipt.childAgentId)?.status, 'reserved'); assert.equal(projection.spawnRootStates.find((root) => root.rootGoalId === 'goal:1')?.activeChildren, 1); }));
test('child role does not embed model identity', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:33')); const child = store.getAgent(receipt.childAgentId)!; assert.equal(/minimax|glm|opus|codex/i.test(child.role), false); }));
test('child has no shell capability or main checkout write', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:34')); const child = store.getAgent(receipt.childAgentId)!; assert.equal(child.capabilities?.some((capability) => /shell|main/i.test(capability)), false); }));
test('creation event binds source event without copying payload', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:35')); const event = store.listRecentEvents(20).find((candidate) => candidate.entityId === receipt.childAgentId)!; assert.equal(event.payload.sourceEventId, 'event:35'); assert.equal('prompt' in event.payload, false); assert.equal('payload' in event.payload, false); }));
test('root cancellation setter is durable', () => withStore((store) => { created(store, admission('goal:1', 'event:36')); store.setSpawnRootCancellation('goal:1', 'cancelled', now); assert.equal(store.getSpawnRootState('goal:1')?.cancellation, 'cancelled'); }));
test('root deadline setter is durable', () => withStore((store) => { created(store, admission('goal:1', 'event:37')); store.setSpawnRootDeadline('goal:1', deadline, now); assert.equal(store.getSpawnRootState('goal:1')?.deadline, deadline); }));
test('no partial child remains after failed immutable admission', () => withStore((store) => { const input = admission('goal:1', 'event:38'); input.admission = { ...input.admission, creationMaterialHash: 'wrong' }; const result = store.reserveSpawnAndCreateChild(input); assert.equal(result.result, 'denied'); assert.equal(store.listAgents().length, 0); assert.equal(store.listSpawnRootStates().length, 0); }));
test('root aggregate uses one durable counter source', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:39')); const root = store.getSpawnRootState('goal:1')!; assert.equal(root.activeChildren, 1); assert.equal(root.totalChildCreations, 1); assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === 'goal:1' && agent.status === 'reserved').length, root.activeChildren); assert.ok(receipt); }));
test('receipt is bounded structured data', () => withStore((store) => { const receipt = created(store, admission('goal:1', 'event:40')); assert.ok(JSON.stringify(receipt).length < 8192); assert.equal('prompt' in receipt, false); }));
test('policy registry remains the K4.2-A source of limits', () => assert.equal(AGENT_MODE_SPAWN_POLICIES.some((policy) => policy.policyId === SPAWN_POLICY_READ_ONLY && policy.maxConcurrentChildren === 4), true));
test('total creation ceiling remains monotonic after retirement', () => withStore((store) => {
  for (let index = 0; index < 16; index += 1) {
    const receipt = created(store, admission('goal:total', `event:total-${index}`));
    assert.equal(store.retireChildAgent(receipt.childAgentId, 'retired', now).result, 'retired');
  }
  const result = store.reserveSpawnAndCreateChild(admission('goal:total', 'event:total-overflow'));
  assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'TOTAL_CREATIONS_EXCEEDED');
  assert.equal(store.getSpawnRootState('goal:total')?.totalChildCreations, 16); assert.equal(store.getSpawnRootState('goal:total')?.activeChildren, 0);
}));
test('root budget ceiling is rechecked from the durable aggregate', () => withStore((store) => {
  const first = admission('goal:budget', 'event:budget-1', {}, { root: { ...makeFacts('goal:budget').root!, remainingBudget: 0.15 } });
  const second = admission('goal:budget', 'event:budget-2', {}, { root: { ...makeFacts('goal:budget').root!, remainingBudget: 0.15 } });
  created(store, first); const result = store.reserveSpawnAndCreateChild(second);
  assert.equal(result.result, 'denied'); assert.equal(spawnReason(result), 'BUDGET_EXCEEDED'); assert.equal(store.getSpawnRootState('goal:budget')?.reservedChildCost, 0.1);
}));
test('engineering child reservation snapshots workcell capability and scope', () => withStore((store) => {
  const receipt = created(store, engineeringAdmission('goal:engineering', 'event:engineering-1'));
  const child = store.getAgent(receipt.childAgentId)!;
  assert.deepEqual(child.capabilities, [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, WORKCELL_VALIDATION_CAPABILITY]); assert.equal(child.resourceScope, 'workcell');
}));
test('expiry reconciliation is bounded and leaves later children for the next pass', () => withStore((store) => {
  const receipts = Array.from({ length: 3 }, (_, index) => created(store, admission('goal:expiry-limit', `event:expiry-${index}`)));
  const firstPass = store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z', 2);
  assert.equal(firstPass.length, 2); assert.equal(new Set(firstPass).size, 2);
  assert.equal(store.getSpawnRootState('goal:expiry-limit')?.activeChildren, 1);
  const remaining = receipts.map((receipt) => receipt.childAgentId).find((childAgentId) => !firstPass.includes(childAgentId));
  assert.deepEqual(store.reconcileExpiredChildAgents('2026-09-10T10:02:00.000Z', 2), [remaining]);
  assert.equal(store.getSpawnRootState('goal:expiry-limit')?.activeChildren, 0);
}));

test('two distinct callers racing a final active slot admit exactly one', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42b-race-')); const databasePath = path.join(directory, 'state.db');
  const first = new AgentModeSqliteStateStore(databasePath); const setup = admission('goal:race-slot', 'event:setup');
  created(first, setup); created(first, admission('goal:race-slot', 'event:setup-2')); created(first, admission('goal:race-slot', 'event:setup-3')); first.close();
  const a = new AgentModeSqliteStateStore(databasePath); const b = new AgentModeSqliteStateStore(databasePath);
  const results = await Promise.all([Promise.resolve().then(() => a.reserveSpawnAndCreateChild(admission('goal:race-slot', 'event:race-a'))), Promise.resolve().then(() => b.reserveSpawnAndCreateChild(admission('goal:race-slot', 'event:race-b')))]);
  const createdCount = results.filter((result) => result.result === 'created').length; assert.equal(createdCount, 1); assert.equal(results.filter((result) => result.result === 'denied' && spawnReason(result) === 'CONCURRENCY_EXCEEDED').length, 1); const check = AgentModeSqliteStateStore.openExisting(databasePath)!; assert.equal(check.getSpawnRootState('goal:race-slot')?.activeChildren, 4); a.close(); b.close(); check.close(); rmSync(directory, { recursive: true, force: true });
});
test('two concurrent duplicate callers create one logical child', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'k42b-dup-')); const databasePath = path.join(directory, 'state.db'); const a = new AgentModeSqliteStateStore(databasePath); const b = new AgentModeSqliteStateStore(databasePath); const input = admission('goal:dup', 'event:dup');
  const results = await Promise.all([Promise.resolve().then(() => a.reserveSpawnAndCreateChild(input)), Promise.resolve().then(() => b.reserveSpawnAndCreateChild(input))]); const receipts = results.filter((result): result is Extract<typeof result, { result: 'created' | 'duplicate' }> => result.result === 'created' || result.result === 'duplicate').map((result) => result.receipt); assert.equal(new Set(receipts.map((receipt) => receipt.childAgentId)).size, 1); const check = AgentModeSqliteStateStore.openExisting(databasePath)!; assert.equal(check.getSpawnRootState('goal:dup')?.totalChildCreations, 1); a.close(); b.close(); check.close(); rmSync(directory, { recursive: true, force: true });
});
