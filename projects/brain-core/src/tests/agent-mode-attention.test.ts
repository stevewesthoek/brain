import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import test from 'node:test';
import { deriveEscalationId, deriveNotificationId } from '../agent-mode/agent-mode-attention.js';
import { AgentModeSqliteStateStore, type AgentModeAdmission, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';
import type { AgentModeEscalationRequest } from '../agent-mode/model-tier-policy.js';
import { routeRequest } from '../api/routes.js';
import { brainServiceContentSha256, signBrainServiceRequest } from '../security/brain-service-auth.js';

const NOW = '2026-09-14T10:00:00.000Z';
const LATER = '2026-09-14T10:01:00.000Z';

function admission(): AgentModeAdmission {
  return {
    task: { taskId: 'task:attention', taskType: 'fixture.attention', inputHash: 'input:attention', createdAt: NOW },
    run: { runId: 'run:attention', taskId: 'task:attention', agentId: 'agent:attention', createdAt: NOW },
    attempt: { attemptId: 'attempt:attention', runId: 'run:attention', agentId: 'agent:attention', runtimeRef: 'runtime:fixture', routeRef: 'route:fixture', modelRef: 'model:fixture', policyVersion: 'policy:fixture', capabilityScopeHash: 'scope:attention', budgetScopeId: 'budget:attention', createdAt: NOW },
    budget: { budgetScopeId: 'budget:attention', maxSteps: 10, maxTokens: 100, maxDollars: 1 },
    estimate: { reservationId: 'reservation:attention', steps: 1, tokens: 1, dollars: 0 },
    lease: { leaseId: 'lease:attention', resourceKey: 'resource:attention', ownerId: 'owner:attention', expiresAt: '2026-09-14T11:00:00.000Z' },
    now: NOW,
  };
}

function admissionWithSuffix(suffix: string): AgentModeAdmission {
  const base = admission();
  return {
    ...base,
    task: { ...base.task, taskId: `task:attention:${suffix}`, inputHash: `input:attention:${suffix}` },
    run: { ...base.run, runId: `run:attention:${suffix}`, taskId: `task:attention:${suffix}` },
    attempt: { ...base.attempt, attemptId: `attempt:attention:${suffix}`, runId: `run:attention:${suffix}` },
    budget: { ...base.budget, budgetScopeId: `budget:attention:${suffix}` },
    estimate: { ...base.estimate, reservationId: `reservation:attention:${suffix}` },
    lease: { ...base.lease, leaseId: `lease:attention:${suffix}`, resourceKey: `resource:attention:${suffix}`, ownerId: `owner:attention:${suffix}` },
  };
}

function withStore(callback: (store: AgentModeSqliteStateStore, databasePath: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-attention-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const stores: AgentModeSqliteStateStore[] = [];
  try {
    const store = new AgentModeSqliteStateStore(databasePath);
    stores.push(store);
    callback(store, databasePath);
  } finally {
    for (const store of stores) { try { store.close(); } catch { /* already closed */ } }
    rmSync(root, { recursive: true, force: true });
  }
}

test('attention identities are deterministic and model escalation remains untrusted intent', () => {
  assert.equal(deriveEscalationId({ kind: 'uncertain_attempt', sourceType: 'attempt', sourceId: 'attempt:1', reasonCode: 'UNCERTAIN_RUNTIME' }), deriveEscalationId({ kind: 'uncertain_attempt', sourceType: 'attempt', sourceId: 'attempt:1', reasonCode: 'UNCERTAIN_RUNTIME' }));
  assert.notEqual(deriveNotificationId({ kind: 'uncertain_attempt', sourceType: 'attempt', sourceId: 'attempt:1', transitionId: 'one' }), deriveNotificationId({ kind: 'uncertain_attempt', sourceType: 'attempt', sourceId: 'attempt:1', transitionId: 'two' }));
  const request: AgentModeEscalationRequest = { kind: 'escalation_requested', fromTier: 'worker', requestedTier: 'senior', reason: 'context_limit', source: 'model-untrusted' };
  assert.equal(request.source, 'model-untrusted');
  assert.equal('runtimeRef' in request, false);
  assert.equal('capabilityGrant' in request, false);
});

test('attention reconciliation is durable, bounded, idempotent, operator-keyed, and read is not resolve', () => {
  withStore((store, databasePath) => {
    const a = admission();
    assert.equal(store.admitAttempt(a), 'created');
    const database = (store as unknown as { database: { prepare(sql: string): { run(...params: unknown[]): void } } }).database;
    database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ?").run(NOW, a.attempt.attemptId);
    const first = store.reconcileAgentModeAttention(NOW);
    assert.deepEqual(first, { createdEscalations: 1, resolvedEscalations: 0, createdNotifications: 1, existingNotifications: 0 });
    assert.equal(store.reconcileAgentModeAttention(NOW).createdEscalations, 0);
    const publicNotifications = store.listAgentModeNotifications();
    assert.equal(publicNotifications[0]?.read, null);
    assert.equal(store.getAgentModeAttentionSummary()?.openEscalationCount, 1);
    const notificationId = publicNotifications[0]?.notificationId;
    assert.ok(notificationId);
    assert.equal(store.markAgentModeNotificationRead({ notificationId, operatorId: 'operator:one', readAt: LATER }).result, 'created');
    assert.equal(store.markAgentModeNotificationRead({ notificationId, operatorId: 'operator:one', readAt: LATER }).result, 'duplicate');
    assert.equal(store.listAgentModeNotifications(100, 'operator:one')[0]?.read, true);
    assert.equal(store.listAgentModeNotifications(100, 'operator:two')[0]?.read, false);
    assert.equal(store.getAgentModeAttentionSummary('operator:one').unreadNotificationCount, 0);
    assert.equal(store.getAgentModeAttentionSummary('operator:two').unreadNotificationCount, 1);
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    assert.equal(reopened.listAgentModeEscalations()[0]?.status, 'open');
    assert.equal(reopened.listAgentModeNotifications(100, 'operator:one')[0]?.read, true);
    const reopenedDatabase = (reopened as unknown as { database: { prepare(sql: string): { run(...params: unknown[]): void } } }).database;
    reopenedDatabase.prepare("UPDATE attempts SET status = 'completed', updated_at = ? WHERE attempt_id = ?").run(LATER, a.attempt.attemptId);
    const resolved = reopened.reconcileAgentModeAttention(LATER);
    assert.equal(resolved.resolvedEscalations, 1);
    assert.equal(reopened.listAgentModeEscalations()[0]?.status, 'resolved');
    reopened.close();
  });
});

test('bounded attention reconciliation never resolves an active source omitted by the scan window', () => {
  withStore((store) => {
    const database = (store as unknown as { database: { prepare(sql: string): { run(...params: unknown[]): void } } }).database;
    for (const suffix of ['one', 'two']) {
      const current = admissionWithSuffix(suffix);
      assert.equal(store.admitAttempt(current), 'created');
      database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ?").run(NOW, current.attempt.attemptId);
    }
    for (const suffix of ['one', 'two']) {
      assert.equal(store.createSchedulerEvent({
        eventId: `event:attention:${suffix}`, eventType: 'agent_mode.test.noop', source: 'test', occurredAt: NOW, receivedAt: NOW,
        causationId: null, correlationId: `corr:attention:${suffix}`, deduplicationKey: `dedupe:attention:${suffix}`, payloadVersion: 'k4.0', payload: { value: suffix },
        nextEligibleAt: NOW, deadline: null, maxAttempts: 1,
      } satisfies AgentModeSchedulerEventInput), 'created');
      database.prepare("UPDATE agent_mode_scheduler_events SET status = 'dead_letter', dead_lettered_at = ?, last_failure_at = ? WHERE event_id = ?").run(NOW, NOW, `event:attention:${suffix}`);
      database.prepare(`INSERT INTO workcells (workcell_id, task_id, run_id, attempt_id, repository_ref, repository_root, worktree_path, branch, owner_agent, base_ref, created_at, updated_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared')`).run(`workcell:attention:${suffix}`, `task:attention:${suffix}`, `run:attention:${suffix}`, `attempt:attention:${suffix}`, 'repo:attention', '/repo/attention', `/tmp/workcell-attention-${suffix}`, `branch-attention-${suffix}`, 'agent:attention', 'main', NOW, NOW);
      database.prepare(`INSERT INTO workcell_validations (validation_id, task_id, run_id, attempt_id, workcell_id, repository_ref, validator_profile, diff_id, lease_id, fence_token, operation_hash, status, result, started_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'rejected', 'failed', ?, ?)`).run(`validation:attention:${suffix}`, `task:attention:${suffix}`, `run:attention:${suffix}`, `attempt:attention:${suffix}`, `workcell:attention:${suffix}`, 'repo:attention', 'git.diff.integrity', `lease:attention:${suffix}`, 1, `operation:attention:${suffix}`, NOW, NOW);
    }

    assert.equal(store.reconcileAgentModeAttention(NOW, 100).createdEscalations, 6);
    assert.equal(store.listAgentModeEscalations(100).filter((item) => item.status === 'open').length, 6);

    const bounded = store.reconcileAgentModeAttention(LATER, 1);
    assert.equal(bounded.resolvedEscalations, 0);
    assert.equal(store.listAgentModeEscalations(100).filter((item) => item.status === 'open').length, 6);
  });
});

class MockResponse {
  statusCode = 0;
  body = '';
  writeHead(statusCode: number): void { this.statusCode = statusCode; }
  end(chunk?: string): void { this.body = chunk ?? ''; }
}

function signedRequest(method: 'GET' | 'POST', url: string, body = ''): Readable & { method: string; url: string; socket: { remoteAddress: string }; headers: Record<string, string> } {
  const pathname = new URL(url, 'http://127.0.0.1').pathname;
  const serviceId = 'attention-test-service';
  const secret = 'attention-test-secret-which-is-long-enough';
  const timestamp = new Date().toISOString();
  const contentSha256 = brainServiceContentSha256(body);
  const requestId = `attention-test:${Date.now()}:${Math.random()}`;
  const request = Readable.from(body ? [body] : []) as Readable & { method: string; url: string; socket: { remoteAddress: string }; headers: Record<string, string> };
  request.method = method;
  request.url = url;
  request.socket = { remoteAddress: '127.0.0.1' };
  request.headers = {
    'x-brain-auth-version': 'brain-service-auth-v1',
    'x-brain-service-id': serviceId,
    'x-brain-request-id': requestId,
    'x-brain-request-timestamp': timestamp,
    'x-brain-content-sha256': contentSha256,
    'x-brain-signature': signBrainServiceRequest({ serviceId, secret, method, pathname, requestId, timestamp, contentSha256 }),
  };
  return request;
}

test('authenticated notification API uses the narrow service capability and repeated reads are side-effect free', async () => {
  const previousState = process.env.BRAIN_AGENT_MODE_STATE_DIR;
  const previousServiceId = process.env.BRAIN_CORE_SERVICE_ID;
  const previousSecret = process.env.BRAIN_CORE_SERVICE_SECRET;
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-attention-route-'));
  process.env.BRAIN_AGENT_MODE_STATE_DIR = root;
  process.env.BRAIN_CORE_SERVICE_ID = 'attention-test-service';
  process.env.BRAIN_CORE_SERVICE_SECRET = 'attention-test-secret-which-is-long-enough';
  try {
    const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
    const a = admission();
    assert.equal(store.admitAttempt(a), 'created');
    const database = (store as unknown as { database: { prepare(sql: string): { run(...params: unknown[]): void } } }).database;
    database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ?").run(NOW, a.attempt.attemptId);
    store.reconcileAgentModeAttention(NOW);
    const notificationId = store.listAgentModeNotifications()[0]?.notificationId;
    assert.ok(notificationId);
    store.close();

    const unauthenticated = new MockResponse();
    const missingAuth = Readable.from([]) as Readable & { method: string; url: string; socket: { remoteAddress: string }; headers: Record<string, string> };
    missingAuth.method = 'GET'; missingAuth.url = '/agent-mode/notifications?operatorId=operator%3Aone'; missingAuth.socket = { remoteAddress: '127.0.0.1' }; missingAuth.headers = {};
    await routeRequest(missingAuth as never, unauthenticated as never);
    assert.equal(unauthenticated.statusCode, 401);

    const first = new MockResponse();
    await routeRequest(signedRequest('GET', '/agent-mode/notifications?operatorId=operator%3Aone') as never, first as never);
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).summary.unreadNotificationCount, 1);

    const body = JSON.stringify({ schemaVersion: 'agent-mode-notification-read-v1', operatorId: 'operator:one' });
    const read = new MockResponse();
    await routeRequest(signedRequest('POST', `/agent-mode/notifications/${encodeURIComponent(notificationId)}/read`, body) as never, read as never);
    assert.equal(read.statusCode, 200);
    assert.equal(JSON.parse(read.body).result, 'created');
    const second = new MockResponse();
    await routeRequest(signedRequest('GET', '/agent-mode/notifications?operatorId=operator%3Aone') as never, second as never);
    assert.equal(JSON.parse(second.body).summary.unreadNotificationCount, 0);
  } finally {
    if (previousState === undefined) delete process.env.BRAIN_AGENT_MODE_STATE_DIR; else process.env.BRAIN_AGENT_MODE_STATE_DIR = previousState;
    if (previousServiceId === undefined) delete process.env.BRAIN_CORE_SERVICE_ID; else process.env.BRAIN_CORE_SERVICE_ID = previousServiceId;
    if (previousSecret === undefined) delete process.env.BRAIN_CORE_SERVICE_SECRET; else process.env.BRAIN_CORE_SERVICE_SECRET = previousSecret;
    rmSync(root, { recursive: true, force: true });
  }
});
