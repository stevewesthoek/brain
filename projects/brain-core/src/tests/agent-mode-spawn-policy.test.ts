import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AGENT_MODE_ROLE_TEMPLATES,
  AGENT_MODE_SPAWN_POLICIES,
  KNOWN_SPAWN_CAPABILITIES,
  SPAWN_POLICY_READ_ONLY,
  SPAWN_ROLE_READ_ONLY,
  evaluateSpawnAdmission,
  evaluateSpawnAdmissionWithDurableControls,
  spawnIntentKey,
  validateRoleTemplateManifest,
  validateSpawnPolicyManifest,
  type SpawnAuthorityFacts,
  type SpawnRequest,
} from '../agent-mode/spawn-policy.js';
import { CI_WORKFLOW_COMPLETED_EVENT, CI_WORKFLOW_RUN_SOURCE, GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY } from '../agent-mode/workcell.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const now = '2026-09-10T10:00:00.000Z';
const deadline = '2026-09-10T11:00:00.000Z';

function request(overrides: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    schemaVersion: 1,
    requestId: 'request:1',
    policyId: SPAWN_POLICY_READ_ONLY,
    policyVersion: 1,
    roleTemplateId: SPAWN_ROLE_READ_ONLY,
    roleTemplateVersion: 1,
    sourceId: 'source:1',
    sourceEventId: 'event:1',
    sourceType: GIT_REPOSITORY_REVISION_SOURCE,
    eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
    eventRootGoalId: 'goal:1',
    eventScope: { repositoryRef: 'brain', resourceRef: null },
    parentAgentId: null,
    parentTaskId: null,
    parentRunId: null,
    rootGoalId: 'goal:1',
    requestedScope: { repositoryRef: 'brain', resourceRef: null },
    requestedCapabilities: [WORKCELL_READ_CAPABILITY],
    requestedTtl: 60_000,
    requestedStepBudget: 10,
    requestedCostBudget: 0.1,
    requestedAt: now,
    deadline,
    requestedDepth: 1,
    ...overrides,
  };
}

function facts(overrides: Partial<SpawnAuthorityFacts> = {}): SpawnAuthorityFacts {
  return {
    now,
    globalKillSwitchDenied: false,
    rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: {
      rootGoalId: 'goal:1',
      depth: 0,
      activeChildren: 0,
      totalChildCreations: 0,
      cancellation: 'active',
      remainingSteps: 100,
      remainingBudget: 1,
      deadline,
      delegableCapabilities: [WORKCELL_READ_CAPABILITY],
      repositoryScopes: ['brain'],
      resourceScopes: [],
    },
    parent: null,
    ...overrides,
  };
}

function denied(input: SpawnRequest, inputFacts: SpawnAuthorityFacts, reasonCode: string): void {
  const decision = evaluateSpawnAdmission(input, inputFacts);
  assert.equal(decision.result, 'DENY');
  assert.equal(decision.reasonCode, reasonCode);
}

test('allows a bounded read-only request', () => assert.equal(evaluateSpawnAdmission(request(), facts()).reasonCode, 'ALLOWED'));
test('intent key is stable when request identity changes', () => assert.equal(spawnIntentKey(request()), spawnIntentKey(request({ requestId: 'request:other' }))));
test('intent key changes for a different logical scope', () => assert.notEqual(spawnIntentKey(request()), spawnIntentKey(request({ requestedScope: { repositoryRef: 'other', resourceRef: null } }))));
test('unknown policy denies', () => denied(request({ policyId: 'policy:unknown' }), facts(), 'POLICY_NOT_FOUND'));
test('unknown policy version denies', () => denied(request({ policyVersion: 2 }), facts(), 'POLICY_NOT_FOUND'));
test('disabled policy denies', () => denied(request({ policyId: 'agent-mode.policy.disabled-fixture.v1' }), facts(), 'POLICY_DISABLED'));
test('source allowlist is explicit', () => denied(request({ sourceType: 'unknown.source' }), facts(), 'SOURCE_NOT_ALLOWED'));
test('event allowlist is explicit', () => denied(request({ eventType: 'unknown.event' }), facts(), 'EVENT_NOT_ALLOWED'));
test('role allowlist is explicit', () => denied(request({ roleTemplateId: 'role:unknown' }), facts(), 'ROLE_NOT_ALLOWED'));
test('missing root goal denies', () => denied(request({ rootGoalId: null, eventRootGoalId: null }), facts(), 'ROOT_GOAL_REQUIRED'));
test('event and request root goals must match', () => denied(request({ eventRootGoalId: 'goal:other' }), facts(), 'ROOT_MISMATCH'));
test('root authority must match the request', () => denied(request(), facts({ root: null }), 'ROOT_MISMATCH'));
test('unknown parent denies', () => denied(request({ parentAgentId: 'agent:1', parentTaskId: 'task:1', parentRunId: 'run:1' }), facts(), 'PARENT_INVALID'));
test('cross-root parent denies', () => denied(request({ parentAgentId: 'agent:1', parentTaskId: 'task:1', parentRunId: 'run:1' }), facts({ parent: { agentId: 'agent:1', taskId: 'task:1', runId: 'run:1', rootGoalId: 'goal:other', depth: 0, cancellation: 'active', delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] } }), 'PARENT_INVALID'));
test('root cancellation denies new children', () => denied(request(), facts({ root: { ...facts().root!, cancellation: 'requested' } }), 'CANCELLED'));
test('parent cancellation denies new children', () => denied(request({ parentAgentId: 'agent:1', parentTaskId: 'task:1', parentRunId: 'run:1' }), facts({ parent: { agentId: 'agent:1', taskId: 'task:1', runId: 'run:1', rootGoalId: 'goal:1', depth: 0, cancellation: 'cancelled', delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] } }), 'CANCELLED'));
test('global kill switch denies', () => denied(request(), facts({ globalKillSwitchDenied: true }), 'GLOBAL_KILL_SWITCH'));
test('root kill switch denies', () => denied(request(), facts({ rootKillSwitchDenied: true }), 'ROOT_KILL_SWITCH'));
test('capability outside role ceiling denies', () => denied(request({ requestedCapabilities: [WORKCELL_WRITE_CAPABILITY] }), facts({ root: { ...facts().root!, delegableCapabilities: [WORKCELL_WRITE_CAPABILITY] } }), 'CAPABILITY_EXCEEDED'));
test('capability outside policy ceiling denies', () => denied(request({ requestedCapabilities: [WORKCELL_WRITE_CAPABILITY] }), facts({ root: { ...facts().root!, delegableCapabilities: [WORKCELL_WRITE_CAPABILITY] } }), 'CAPABILITY_EXCEEDED'));
test('unknown capability denies', () => denied(request({ requestedCapabilities: ['runtime.shell'] }), facts(), 'CAPABILITY_EXCEEDED'));
test('parent delegation ceiling denies', () => denied(request({ parentAgentId: 'agent:1', parentTaskId: 'task:1', parentRunId: 'run:1', requestedCapabilities: [WORKCELL_WRITE_CAPABILITY] }), facts({ parent: { agentId: 'agent:1', taskId: 'task:1', runId: 'run:1', rootGoalId: 'goal:1', depth: 0, cancellation: 'active', delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['brain'], resourceScopes: [] } }), 'CAPABILITY_EXCEEDED'));
test('repository scope must be policy admitted', () => denied(request({ requestedScope: { repositoryRef: 'other', resourceRef: null }, eventScope: { repositoryRef: 'other', resourceRef: null } }), facts({ root: { ...facts().root!, repositoryScopes: ['other'] } }), 'SCOPE_EXCEEDED'));
test('repository scope must match event scope', () => denied(request({ eventScope: { repositoryRef: 'other', resourceRef: null } }), facts(), 'SCOPE_EXCEEDED'));
test('repository scope must be parent admitted', () => denied(request({ parentAgentId: 'agent:1', parentTaskId: 'task:1', parentRunId: 'run:1' }), facts({ parent: { agentId: 'agent:1', taskId: 'task:1', runId: 'run:1', rootGoalId: 'goal:1', depth: 0, cancellation: 'active', delegableCapabilities: [WORKCELL_READ_CAPABILITY], repositoryScopes: ['other'], resourceScopes: [] } }), 'SCOPE_EXCEEDED'));
test('write capability requires a repository scope', () => denied(request({ policyId: 'agent-mode.policy.safe-engineering.v1', roleTemplateId: 'agent-mode.role.safe-engineering.v1', requestedCapabilities: [WORKCELL_WRITE_CAPABILITY], requestedScope: { repositoryRef: null, resourceRef: 'workcell' }, eventScope: { repositoryRef: null, resourceRef: 'workcell' } }), facts({ root: { ...facts().root!, delegableCapabilities: [WORKCELL_WRITE_CAPABILITY], resourceScopes: ['workcell'] } }), 'SCOPE_EXCEEDED'));
test('TTL cannot exceed role ceiling', () => denied(request({ requestedTtl: 20 * 60 * 1000 }), facts(), 'TTL_EXCEEDED'));
test('TTL cannot exceed policy ceiling', () => denied(request({ requestedTtl: 20 * 60 * 1000 }), facts(), 'TTL_EXCEEDED'));
test('TTL must fit request deadline', () => denied(request({ requestedTtl: 90 * 60 * 1000, deadline: '2026-09-10T12:00:00.000Z' }), facts(), 'TTL_EXCEEDED'));
test('expired request deadline denies', () => denied(request({ deadline: '2026-09-10T09:00:00.000Z' }), facts(), 'DEADLINE_EXPIRED'));
test('expired root deadline denies', () => denied(request(), facts({ root: { ...facts().root!, deadline: '2026-09-10T09:00:00.000Z' } }), 'DEADLINE_EXPIRED'));
test('authoritative depth must be used', () => denied(request({ requestedDepth: 2 }), facts(), 'SPAWN_DEPTH_EXCEEDED'));
test('policy depth ceiling denies', () => denied(request({ requestedDepth: 1 }), facts({ root: { ...facts().root!, depth: 1 } }), 'SPAWN_DEPTH_EXCEEDED'));
test('template depth ceiling denies', () => denied(request({ roleTemplateVersion: 2 }), facts(), 'ROLE_NOT_ALLOWED'));
test('concurrency cap denies', () => denied(request(), facts({ root: { ...facts().root!, activeChildren: 4 } }), 'CONCURRENCY_EXCEEDED'));
test('total creation cap denies', () => denied(request(), facts({ root: { ...facts().root!, totalChildCreations: 16 } }), 'TOTAL_CREATIONS_EXCEEDED'));
test('step budget ceiling denies', () => denied(request({ requestedStepBudget: 101 }), facts(), 'STEP_BUDGET_EXCEEDED'));
test('cost budget ceiling denies', () => denied(request({ requestedCostBudget: 0.3 }), facts(), 'BUDGET_EXCEEDED'));
test('root remaining steps deny', () => denied(request({ requestedStepBudget: 101 }), facts({ root: { ...facts().root!, remainingSteps: 50 } }), 'STEP_BUDGET_EXCEEDED'));
test('root remaining budget denies', () => denied(request({ requestedCostBudget: 0.2 }), facts({ root: { ...facts().root!, remainingBudget: 0.15 } }), 'BUDGET_EXCEEDED'));
test('kill-switch authority read failure denies', () => denied(request(), facts({ authority: { ...facts().authority, killSwitch: false } }), 'AUTHORITY_UNAVAILABLE'));
test('root lookup failure denies', () => denied(request(), facts({ authority: { ...facts().authority, rootLookup: false } }), 'AUTHORITY_UNAVAILABLE'));
test('parent lookup failure denies', () => denied(request(), facts({ authority: { ...facts().authority, parentLookup: false } }), 'AUTHORITY_UNAVAILABLE'));
test('cancellation read failure denies', () => denied(request(), facts({ authority: { ...facts().authority, cancellation: false } }), 'AUTHORITY_UNAVAILABLE'));
test('budget read failure denies', () => denied(request(), facts({ authority: { ...facts().authority, budget: false } }), 'AUTHORITY_UNAVAILABLE'));
test('invalid schema denies', () => denied(request({ schemaVersion: 2 as 1 }), facts(), 'INVALID_REQUEST'));
test('invalid negative TTL denies', () => denied(request({ requestedTtl: -1 }), facts(), 'INVALID_REQUEST'));
test('invalid unbounded step budget denies', () => denied(request({ requestedStepBudget: Number.MAX_SAFE_INTEGER + 1 }), facts(), 'INVALID_REQUEST'));
test('invalid shell-like scope denies', () => denied(request({ requestedScope: { repositoryRef: '/tmp/repo', resourceRef: null } }), facts(), 'INVALID_REQUEST'));
test('invalid deadline denies', () => denied(request({ deadline: 'not-a-date' }), facts(), 'INVALID_REQUEST'));
test('role manifest rejects duplicate IDs', () => assert.throws(() => validateRoleTemplateManifest([...AGENT_MODE_ROLE_TEMPLATES, AGENT_MODE_ROLE_TEMPLATES[0]!])));
test('policy manifest rejects duplicate versions', () => assert.throws(() => validateSpawnPolicyManifest([...AGENT_MODE_SPAWN_POLICIES, AGENT_MODE_SPAWN_POLICIES[0]!])));
test('role manifest rejects unknown capabilities', () => assert.throws(() => validateRoleTemplateManifest([{ ...AGENT_MODE_ROLE_TEMPLATES[0]!, capabilities: ['runtime.shell'] as never[] }])));
test('policy manifest rejects wildcard source', () => assert.throws(() => validateSpawnPolicyManifest([{ ...AGENT_MODE_SPAWN_POLICIES[0]!, allowedSourceTypes: ['*'] }])));
test('policy manifest rejects unsafe scope', () => assert.throws(() => validateSpawnPolicyManifest([{ ...AGENT_MODE_SPAWN_POLICIES[0]!, repositoryScopeRules: { allowed: ['/tmp'], requireEventMatch: true } }])));
test('role templates do not contain model identity', () => assert.equal(AGENT_MODE_ROLE_TEMPLATES.some((template) => 'modelRef' in template || JSON.stringify(template).includes('minimax') || JSON.stringify(template).includes('opus')), false));
test('role templates do not grant broad shell or unrestricted execution', () => assert.equal(AGENT_MODE_ROLE_TEMPLATES.flatMap((template) => template.capabilities).some((capability) => /shell|exec|unrestricted/i.test(capability)), false));
test('capability registry is the existing bounded vocabulary', () => assert.deepEqual(KNOWN_SPAWN_CAPABILITIES, [WORKCELL_READ_CAPABILITY, WORKCELL_WRITE_CAPABILITY, 'validation.run(workcell)']));
test('durable controls default open', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawn-policy-'));
  const store = new AgentModeSqliteStateStore(path.join(directory, 'state.db'));
  assert.equal(store.getSpawnAdmissionControls('goal:1').global.denied, false);
  store.close(); rmSync(directory, { recursive: true, force: true });
});
test('global kill switch persists', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawn-policy-')); const databasePath = path.join(directory, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'operator-stop', updatedAt: now }); store.close();
  const reopened = AgentModeSqliteStateStore.openExisting(databasePath)!; assert.equal(reopened.getSpawnAdmissionControls('goal:1').global.denied, true); reopened.close(); rmSync(directory, { recursive: true, force: true });
});
test('root kill switch persists independently', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawn-policy-')); const databasePath = path.join(directory, 'state.db');
  const store = new AgentModeSqliteStateStore(databasePath); store.setSpawnAdmissionControl({ scope: 'root', rootGoalId: 'goal:1', denied: true, reason: 'root-stop', updatedAt: now }); assert.equal(store.getSpawnAdmissionControls('goal:1').root?.denied, true); store.close(); rmSync(directory, { recursive: true, force: true });
});
test('durable control read failure fails closed', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawn-policy-')); const store = new AgentModeSqliteStateStore(path.join(directory, 'state.db')); store.injectSpawnReadFailureOnce('kill-switch');
  const decision = evaluateSpawnAdmissionWithDurableControls(store, request(), facts()); assert.equal(decision.result, 'DENY'); assert.equal(decision.reasonCode, 'AUTHORITY_UNAVAILABLE'); store.close(); rmSync(directory, { recursive: true, force: true });
});
test('durable global control is evaluated before policy execution', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'spawn-policy-')); const store = new AgentModeSqliteStateStore(path.join(directory, 'state.db')); store.setSpawnAdmissionControl({ scope: 'global', rootGoalId: null, denied: true, reason: 'stop', updatedAt: now });
  assert.equal(evaluateSpawnAdmissionWithDurableControls(store, request({ policyId: 'policy:unknown' }), facts()).reasonCode, 'GLOBAL_KILL_SWITCH'); store.close(); rmSync(directory, { recursive: true, force: true });
});
