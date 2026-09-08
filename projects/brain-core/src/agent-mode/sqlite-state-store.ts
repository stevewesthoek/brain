import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { EffectKind, OperationReceipt } from './agent-mode-contracts.js';

export type AgentModeAgent = {
  agentId: string;
  agentKind: 'jarvis' | 'worker' | 'reviewer' | 'system';
  role: string;
  displayName: string;
  policyId: string;
  status: 'active' | 'paused' | 'retired';
};

export type AgentModeEvent = {
  eventId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type AgentModeTaskStatus = 'pending' | 'admitted' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentModeRunStatus = 'created' | 'active' | 'completed' | 'failed' | 'cancelled';
export type AgentModeAttemptStatus = 'created' | 'admitted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'uncertain' | 'duplicate';

export type AgentModeTask = {
  taskId: string;
  taskType: string;
  inputHash: string;
  createdAt: string;
  status?: AgentModeTaskStatus;
};

export type AgentModeRun = {
  runId: string;
  taskId: string;
  agentId: string;
  createdAt: string;
  status?: AgentModeRunStatus;
};

export type AgentModeBudgetLimits = {
  budgetScopeId: string;
  maxSteps: number;
  maxTokens: number;
  maxDollars: number;
};

export type AgentModeBudgetState = AgentModeBudgetLimits & {
  usedSteps: number;
  reservedSteps: number;
  usedTokens: number;
  reservedTokens: number;
  usedDollars: number;
  reservedDollars: number;
};

export type AgentModeBudgetEstimate = {
  steps: number;
  tokens: number;
  dollars: number;
};

export type AgentModeBudgetReservation = AgentModeBudgetEstimate & {
  reservationId: string;
  budgetScopeId: string;
  attemptId: string;
  status: 'reserved' | 'settled';
  createdAt: string;
  settledAt?: string;
  settledSteps?: number;
  settledTokens?: number;
  settledDollars?: number;
};

export type AgentModeBudgetSettlement = AgentModeBudgetEstimate & {
  reservationId: string;
  settledAt: string;
};

export type AgentModeAttempt = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  reservationId?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseOwnerId?: string;
  leaseFence?: number;
  status: AgentModeAttemptStatus;
  cancellationStatus: 'running' | 'requested' | 'acknowledged' | 'completed';
  cancellationRequestedAt?: string;
  cancellationAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentModeAttemptInput = {
  attemptId: string;
  runId: string;
  agentId: string;
  runtimeRef: string;
  routeRef: string;
  modelRef: string;
  policyVersion: string;
  capabilityScopeHash: string;
  budgetScopeId: string;
  createdAt: string;
  updatedAt?: string;
};

export type AgentModeLease = {
  leaseId: string;
  resourceKey: string;
  ownerId: string;
  fence: number;
  expiresAt: string;
};

export type AgentModeEffect = {
  operationId: string;
  attemptId: string;
  effectKind: string;
  scopeHash: string;
  status: 'reserved' | 'prepared' | 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'succeeded' | 'failed' | 'uncertain';
  receiptJson?: string;
  capabilityId?: string;
  grantId?: string;
  policyVersion?: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline?: string;
  preparedAt?: string;
  dispatchedAt?: string;
  observedAt?: string;
};

export type AgentModeDispatchState = 'dispatchable' | 'dispatched' | 'effect_applied' | 'receipt_recorded' | 'verified' | 'failed' | 'uncertain';

export type AgentModeDispatchOutbox = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  state: AgentModeDispatchState;
  preparedAt: string;
  dispatchedAt?: string;
};

export type AgentModeReceiptState = 'accepted' | 'conflict' | 'stale';

export type AgentModeJournalReceipt = OperationReceipt & {
  receiptId: string;
  state: AgentModeReceiptState;
};

export type AgentModeAdmission = {
  task: AgentModeTask;
  run: AgentModeRun;
  attempt: AgentModeAttemptInput;
  budget: AgentModeBudgetLimits;
  estimate: AgentModeBudgetEstimate & { reservationId: string };
  lease: Omit<AgentModeLease, 'fence'>;
  now: string;
  eventId?: string;
};

export type AgentModePreparedOperation = {
  operationId: string;
  attemptId: string;
  effectKind: EffectKind | string;
  capabilityId: string;
  grantId?: string;
  scopeHash: string;
  policyVersion: string;
  leaseResourceKey?: string;
  leaseId?: string;
  leaseFence?: number;
  deadline: string;
  preparedAt: string;
};

export type AgentModeRecoveryClassification =
  | 'safe_to_resume'
  | 'already_completed'
  | 'duplicate'
  | 'stale_fenced_writer'
  | 'awaiting_receipt_reconciliation'
  | 'uncertain_non_idempotent_effect'
  | 'cancelled_ack_pending'
  | 'terminal_failure';

export type AgentModePersistenceFailurePoint = 'admission' | 'effect-preparation' | 'receipt' | 'budget-settlement';

export type AgentModeOperationResult = 'created' | 'duplicate' | 'conflict';

export type AgentModeCancellationRequest = {
  requestId: string;
  attemptId: string;
  requestedAt: string;
};

export type AgentModeVerification = {
  resultHash: string;
  evidenceRef: string;
  verifiedAt: string;
};

function receiptIdFor(receipt: OperationReceipt): string {
  return `receipt:${createHash('sha256').update(JSON.stringify({
    operationId: receipt.operationId,
    attemptId: receipt.attemptId,
    scopeHash: receipt.scopeHash,
    effectHash: receipt.effectHash,
    status: receipt.status,
  })).digest('hex')}`;
}

export function defaultAgentModeDatabasePath(): string {
  const stateRoot = process.env.BRAIN_AGENT_MODE_STATE_DIR
    ?? path.join(homedir(), '.local', 'brain', 'agent-mode');
  return path.join(stateRoot, 'agent-mode.db');
}

/**
 * SQLite StateStore for the fixture-backed K0 kernel.
 *
 * This is intentionally a domain-specific store, not a generic CRUD wrapper.
 * Transactions own event/effect/lease invariants; callers must not mutate the
 * SQLite file or use an ad-hoc lock as a second authority.
 */
export class AgentModeSqliteStateStore {
  readonly databasePath: string;
  private readonly database: DatabaseSync;
  private transactionDepth = 0;
  private readonly injectedFailures = new Set<AgentModePersistenceFailurePoint>();

  private readonly readOnly: boolean;

  constructor(databasePath = defaultAgentModeDatabasePath(), options: { readOnly?: boolean } = {}) {
    this.databasePath = databasePath;
    this.readOnly = options.readOnly ?? false;
    if (!this.readOnly && databasePath !== ':memory:') mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath, { readOnly: this.readOnly });
    if (this.readOnly) return;
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA synchronous = NORMAL;');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS store_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        agent_kind TEXT NOT NULL,
        role TEXT NOT NULL,
        display_name TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        sequence INTEGER,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leases (
        resource_key TEXT PRIMARY KEY,
        lease_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        fence INTEGER NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS effects (
        operation_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL,
        effect_kind TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        receipt_json TEXT,
        grant_id TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(task_id),
        agent_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        attempt_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(run_id),
        agent_id TEXT NOT NULL,
        runtime_ref TEXT NOT NULL,
        route_ref TEXT NOT NULL,
        model_ref TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        capability_scope_hash TEXT NOT NULL,
        budget_scope_id TEXT NOT NULL,
        reservation_id TEXT,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_owner_id TEXT,
        lease_fence INTEGER,
        status TEXT NOT NULL,
        cancellation_status TEXT NOT NULL,
        cancellation_requested_at TEXT,
        cancellation_acknowledged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budget_scopes (
        budget_scope_id TEXT PRIMARY KEY,
        max_steps INTEGER NOT NULL CHECK (max_steps >= 0),
        used_steps INTEGER NOT NULL DEFAULT 0 CHECK (used_steps >= 0),
        reserved_steps INTEGER NOT NULL DEFAULT 0 CHECK (reserved_steps >= 0),
        max_tokens INTEGER NOT NULL CHECK (max_tokens >= 0),
        used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
        reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
        max_dollars REAL NOT NULL CHECK (max_dollars >= 0),
        used_dollars REAL NOT NULL DEFAULT 0 CHECK (used_dollars >= 0),
        reserved_dollars REAL NOT NULL DEFAULT 0 CHECK (reserved_dollars >= 0)
      );
      CREATE TABLE IF NOT EXISTS budget_reservations (
        reservation_id TEXT PRIMARY KEY,
        budget_scope_id TEXT NOT NULL REFERENCES budget_scopes(budget_scope_id),
        attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
        steps INTEGER NOT NULL CHECK (steps >= 0),
        tokens INTEGER NOT NULL CHECK (tokens >= 0),
        dollars REAL NOT NULL CHECK (dollars >= 0),
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        settled_at TEXT,
        settled_steps INTEGER,
        settled_tokens INTEGER,
        settled_dollars REAL
      );
      CREATE TABLE IF NOT EXISTS dispatch_outbox (
        operation_id TEXT PRIMARY KEY REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        effect_kind TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        grant_id TEXT,
        scope_hash TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        lease_resource_key TEXT,
        lease_id TEXT,
        lease_fence INTEGER,
        deadline TEXT NOT NULL,
        state TEXT NOT NULL,
        prepared_at TEXT NOT NULL,
        dispatched_at TEXT
      );
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL REFERENCES effects(operation_id),
        attempt_id TEXT NOT NULL,
        scope_hash TEXT NOT NULL,
        effect_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        state TEXT NOT NULL,
        receipt_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cancellation_requests (
        request_id TEXT PRIMARY KEY,
        attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
        requested_at TEXT NOT NULL
      );
      INSERT INTO store_meta (key, value) VALUES ('schema_version', '2')
        ON CONFLICT(key) DO NOTHING;
    `);
    this.migrateEventsTable();
    this.migrateEffectsTable();
    this.migrateOutboxTable();
    this.database.prepare("UPDATE store_meta SET value = '2' WHERE key = 'schema_version' AND value = '1'").run();
  }

  static openExisting(databasePath = defaultAgentModeDatabasePath()): AgentModeSqliteStateStore | undefined {
    if (!existsSync(databasePath)) return undefined;
    return new AgentModeSqliteStateStore(databasePath, { readOnly: true });
  }

  private migrateEffectsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(effects)').all() as Array<{ name?: string }>;
    const existing = new Set(columns.map((column) => column.name));
    const additions: Record<string, string> = {
      capability_id: 'TEXT',
      grant_id: 'TEXT',
      policy_version: 'TEXT',
      lease_resource_key: 'TEXT',
      lease_id: 'TEXT',
      lease_fence: 'INTEGER',
      deadline: 'TEXT',
      prepared_at: 'TEXT',
      dispatched_at: 'TEXT',
      observed_at: 'TEXT',
    };
    for (const [name, type] of Object.entries(additions)) {
      if (!existing.has(name)) this.database.exec(`ALTER TABLE effects ADD COLUMN ${name} ${type}`);
    }
  }

  private migrateEventsTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(events)').all() as Array<{ name?: string }>;
    if (columns.some((column) => column.name === 'sequence')) return;
    this.database.exec('ALTER TABLE events ADD COLUMN sequence INTEGER');
    this.database.exec('UPDATE events SET sequence = rowid WHERE sequence IS NULL');
  }

  private migrateOutboxTable(): void {
    const columns = this.database.prepare('PRAGMA table_info(dispatch_outbox)').all() as Array<{ name?: string }>;
    if (!columns.some((column) => column.name === 'grant_id')) this.database.exec('ALTER TABLE dispatch_outbox ADD COLUMN grant_id TEXT');
  }

  get schemaVersion(): number {
    const row = this.database.prepare('SELECT value FROM store_meta WHERE key = ?').get('schema_version') as { value?: string } | undefined;
    return Number(row?.value ?? 0);
  }

  withTransaction<T>(callback: () => T): T {
    if (this.transactionDepth > 0) return callback();
    this.database.exec('BEGIN IMMEDIATE;');
    this.transactionDepth = 1;
    try {
      const result = callback();
      this.database.exec('COMMIT;');
      this.transactionDepth = 0;
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK;');
      this.transactionDepth = 0;
      throw error;
    }
  }

  upsertAgent(agent: AgentModeAgent): void {
    this.database.prepare(`
      INSERT INTO agents (agent_id, agent_kind, role, display_name, policy_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        agent_kind = excluded.agent_kind,
        role = excluded.role,
        display_name = excluded.display_name,
        policy_id = excluded.policy_id,
        status = excluded.status
    `).run(agent.agentId, agent.agentKind, agent.role, agent.displayName, agent.policyId, agent.status);
  }

  getAgent(agentId: string): AgentModeAgent | undefined {
    const row = this.database.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      agentId: String(row.agent_id),
      agentKind: row.agent_kind as AgentModeAgent['agentKind'],
      role: String(row.role),
      displayName: String(row.display_name),
      policyId: String(row.policy_id),
      status: row.status as AgentModeAgent['status'],
    };
  }

  listAgents(): AgentModeAgent[] {
    const rows = this.database.prepare('SELECT * FROM agents ORDER BY agent_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      agentId: String(row.agent_id),
      agentKind: row.agent_kind as AgentModeAgent['agentKind'],
      role: String(row.role),
      displayName: String(row.display_name),
      policyId: String(row.policy_id),
      status: row.status as AgentModeAgent['status'],
    }));
  }

  injectPersistenceFailureOnce(point: AgentModePersistenceFailurePoint): void {
    this.injectedFailures.add(point);
  }

  private failIfInjected(point: AgentModePersistenceFailurePoint): void {
    if (!this.injectedFailures.delete(point)) return;
    throw new Error(`injected persistence failure at ${point}`);
  }

  createTask(task: AgentModeTask): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_type, input_hash, created_at FROM tasks WHERE task_id = ?').get(task.taskId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_type === task.taskType
          && existing.input_hash === task.inputHash
          && existing.created_at === task.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      this.database.prepare('INSERT INTO tasks (task_id, task_type, input_hash, created_at, status) VALUES (?, ?, ?, ?, ?)')
        .run(task.taskId, task.taskType, task.inputHash, task.createdAt, task.status ?? 'pending');
      return 'created';
    });
  }

  getTask(taskId: string): AgentModeTask | undefined {
    const row = this.database.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
    };
  }

  listTasks(): AgentModeTask[] {
    const rows = this.database.prepare('SELECT * FROM tasks ORDER BY created_at, task_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      taskId: String(row.task_id),
      taskType: String(row.task_type),
      inputHash: String(row.input_hash),
      createdAt: String(row.created_at),
      status: row.status as AgentModeTaskStatus,
    }));
  }

  createRun(run: AgentModeRun): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT task_id, agent_id, created_at FROM runs WHERE run_id = ?').get(run.runId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.task_id === run.taskId
          && existing.agent_id === run.agentId
          && existing.created_at === run.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getTask(run.taskId)) throw new Error(`task not found: ${run.taskId}`);
      this.database.prepare('INSERT INTO runs (run_id, task_id, agent_id, created_at, status) VALUES (?, ?, ?, ?, ?)')
        .run(run.runId, run.taskId, run.agentId, run.createdAt, run.status ?? 'created');
      return 'created';
    });
  }

  getRun(runId: string): AgentModeRun | undefined {
    const row = this.database.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
    };
  }

  listRuns(): AgentModeRun[] {
    const rows = this.database.prepare('SELECT * FROM runs ORDER BY created_at, run_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      runId: String(row.run_id),
      taskId: String(row.task_id),
      agentId: String(row.agent_id),
      createdAt: String(row.created_at),
      status: row.status as AgentModeRunStatus,
    }));
  }

  createAttempt(attempt: AgentModeAttemptInput): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === attempt.runId
          && existing.agent_id === attempt.agentId
          && existing.runtime_ref === attempt.runtimeRef
          && existing.route_ref === attempt.routeRef
          && existing.model_ref === attempt.modelRef
          && existing.policy_version === attempt.policyVersion
          && existing.capability_scope_hash === attempt.capabilityScopeHash
          && existing.budget_scope_id === attempt.budgetScopeId
          && existing.created_at === attempt.createdAt;
        return same ? 'duplicate' : 'conflict';
      }
      if (!this.getRun(attempt.runId)) throw new Error(`run not found: ${attempt.runId}`);
      const updatedAt = attempt.updatedAt ?? attempt.createdAt;
      this.database.prepare(`
        INSERT INTO attempts (
          attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
          policy_version, capability_scope_hash, budget_scope_id, status,
          cancellation_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?)
      `).run(
        attempt.attemptId,
        attempt.runId,
        attempt.agentId,
        attempt.runtimeRef,
        attempt.routeRef,
        attempt.modelRef,
        attempt.policyVersion,
        attempt.capabilityScopeHash,
        attempt.budgetScopeId,
        attempt.createdAt,
        updatedAt,
      );
      return 'created';
    });
  }

  getAttempt(attemptId: string): AgentModeAttempt | undefined {
    const row = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(attemptId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapAttempt(row);
  }

  listAttempts(): AgentModeAttempt[] {
    const rows = this.database.prepare('SELECT * FROM attempts ORDER BY created_at, attempt_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapAttempt(row));
  }

  getBudget(budgetScopeId: string): AgentModeBudgetState | undefined {
    const row = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budgetScopeId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      budgetScopeId: String(row.budget_scope_id),
      maxSteps: Number(row.max_steps),
      usedSteps: Number(row.used_steps),
      reservedSteps: Number(row.reserved_steps),
      maxTokens: Number(row.max_tokens),
      usedTokens: Number(row.used_tokens),
      reservedTokens: Number(row.reserved_tokens),
      maxDollars: Number(row.max_dollars),
      usedDollars: Number(row.used_dollars),
      reservedDollars: Number(row.reserved_dollars),
    };
  }

  getReservation(reservationId: string): AgentModeBudgetReservation | undefined {
    const row = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      reservationId: String(row.reservation_id),
      budgetScopeId: String(row.budget_scope_id),
      attemptId: String(row.attempt_id),
      steps: Number(row.steps),
      tokens: Number(row.tokens),
      dollars: Number(row.dollars),
      status: row.status as AgentModeBudgetReservation['status'],
      createdAt: String(row.created_at),
      ...(row.settled_at === null ? {} : { settledAt: String(row.settled_at) }),
      ...(row.settled_steps === null ? {} : { settledSteps: Number(row.settled_steps) }),
      ...(row.settled_tokens === null ? {} : { settledTokens: Number(row.settled_tokens) }),
      ...(row.settled_dollars === null ? {} : { settledDollars: Number(row.settled_dollars) }),
    };
  }

  private mapAttempt(row: Record<string, unknown>): AgentModeAttempt {
    return {
      attemptId: String(row.attempt_id),
      runId: String(row.run_id),
      agentId: String(row.agent_id),
      runtimeRef: String(row.runtime_ref),
      routeRef: String(row.route_ref),
      modelRef: String(row.model_ref),
      policyVersion: String(row.policy_version),
      capabilityScopeHash: String(row.capability_scope_hash),
      budgetScopeId: String(row.budget_scope_id),
      ...(row.reservation_id === null ? {} : { reservationId: String(row.reservation_id) }),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_owner_id === null ? {} : { leaseOwnerId: String(row.lease_owner_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      status: row.status as AgentModeAttemptStatus,
      cancellationStatus: row.cancellation_status as AgentModeAttempt['cancellationStatus'],
      ...(row.cancellation_requested_at === null ? {} : { cancellationRequestedAt: String(row.cancellation_requested_at) }),
      ...(row.cancellation_acknowledged_at === null ? {} : { cancellationAcknowledgedAt: String(row.cancellation_acknowledged_at) }),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  appendEvent(event: AgentModeEvent): void {
    const nextSequence = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM events').get() as { next_sequence?: number };
    this.database.prepare(`
      INSERT INTO events (event_id, sequence, entity_type, entity_id, event_type, occurred_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(event.eventId, nextSequence.next_sequence ?? 1, event.entityType, event.entityId, event.eventType, event.occurredAt, JSON.stringify(event.payload));
  }

  private appendEventIfAbsent(event: AgentModeEvent): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT entity_type, entity_id, event_type, occurred_at, payload_json FROM events WHERE event_id = ?').get(event.eventId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.entity_type === event.entityType
        && existing.entity_id === event.entityId
        && existing.event_type === event.eventType
        && existing.occurred_at === event.occurredAt
        && existing.payload_json === JSON.stringify(event.payload);
      if (!same) throw new Error(`event conflict: ${event.eventId}`);
      return 'duplicate';
    }
    this.appendEvent(event);
    return 'created';
  }

  listEvents(entityId: string): AgentModeEvent[] {
    const rows = this.database.prepare('SELECT * FROM events WHERE entity_id = ? ORDER BY sequence, event_id').all(entityId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      eventId: String(row.event_id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  listRecentEvents(limit = 100): AgentModeEvent[] {
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 500));
    const rows = this.database.prepare('SELECT * FROM events ORDER BY sequence DESC, event_id DESC LIMIT ?').all(boundedLimit) as Array<Record<string, unknown>>;
    return rows.reverse().map((row) => ({
      eventId: String(row.event_id),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      eventType: String(row.event_type),
      occurredAt: String(row.occurred_at),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  recordEvent(event: AgentModeEvent): AgentModeOperationResult {
    return this.withTransaction(() => this.appendEventIfAbsent(event));
  }

  admitAttempt(admission: AgentModeAdmission): AgentModeOperationResult {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT * FROM attempts WHERE attempt_id = ?').get(admission.attempt.attemptId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.run_id === admission.attempt.runId
          && existing.agent_id === admission.attempt.agentId
          && existing.runtime_ref === admission.attempt.runtimeRef
          && existing.route_ref === admission.attempt.routeRef
          && existing.model_ref === admission.attempt.modelRef
          && existing.policy_version === admission.attempt.policyVersion
          && existing.capability_scope_hash === admission.attempt.capabilityScopeHash
          && existing.budget_scope_id === admission.attempt.budgetScopeId
          && existing.reservation_id === admission.estimate.reservationId
          && existing.lease_id === admission.lease.leaseId;
        if (!same) return 'conflict';
        if (existing.status === 'admitted' || existing.status === 'running') return 'duplicate';
      }

      if (this.ensureTask(admission.task) === 'conflict') return 'conflict';
      if (this.ensureRun(admission.run) === 'conflict') return 'conflict';
      if (!existing) {
        this.database.prepare(`
          INSERT INTO attempts (
            attempt_id, run_id, agent_id, runtime_ref, route_ref, model_ref,
            policy_version, capability_scope_hash, budget_scope_id, status,
            cancellation_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', 'running', ?, ?)
        `).run(
          admission.attempt.attemptId,
          admission.attempt.runId,
          admission.attempt.agentId,
          admission.attempt.runtimeRef,
          admission.attempt.routeRef,
          admission.attempt.modelRef,
          admission.attempt.policyVersion,
          admission.attempt.capabilityScopeHash,
          admission.attempt.budgetScopeId,
          admission.now,
          admission.now,
        );
      }

      this.ensureBudgetScope(admission.budget);
      const reservationResult = this.reserveBudgetInternal({
        reservationId: admission.estimate.reservationId,
        budgetScopeId: admission.budget.budgetScopeId,
        attemptId: admission.attempt.attemptId,
        steps: admission.estimate.steps,
        tokens: admission.estimate.tokens,
        dollars: admission.estimate.dollars,
        status: 'reserved',
        createdAt: admission.now,
      });
      if (reservationResult === 'conflict') return 'conflict';

      const lease = this.acquireLeaseAt(admission.lease, admission.now);
      if (!lease) throw new Error(`lease unavailable for ${admission.lease.resourceKey}`);
      this.database.prepare(`
        UPDATE attempts SET
            reservation_id = ?, lease_resource_key = ?, lease_id = ?, lease_owner_id = ?, lease_fence = ?,
          status = 'admitted', updated_at = ?
        WHERE attempt_id = ?
      `).run(
        admission.estimate.reservationId,
        admission.lease.resourceKey,
        admission.lease.leaseId,
        admission.lease.ownerId,
        lease.fence,
        admission.now,
        admission.attempt.attemptId,
      );
      this.database.prepare('UPDATE tasks SET status = \'admitted\' WHERE task_id = ?').run(admission.task.taskId);
      this.database.prepare('UPDATE runs SET status = \'active\' WHERE run_id = ?').run(admission.run.runId);
      this.appendEventIfAbsent({
        eventId: admission.eventId ?? `admission:${admission.attempt.attemptId}`,
        entityType: 'attempt',
        entityId: admission.attempt.attemptId,
        eventType: 'attempt_admitted',
        occurredAt: admission.now,
        payload: {
          taskId: admission.task.taskId,
          runId: admission.run.runId,
          reservationId: admission.estimate.reservationId,
          leaseFence: lease.fence,
        },
      });
      this.failIfInjected('admission');
      return reservationResult === 'duplicate' ? 'duplicate' : 'created';
    });
  }

  private ensureTask(task: AgentModeTask): AgentModeOperationResult {
    return this.createTask(task);
  }

  private ensureRun(run: AgentModeRun): AgentModeOperationResult {
    return this.createRun(run);
  }

  private ensureBudgetScope(budget: AgentModeBudgetLimits): void {
    const existing = this.database.prepare('SELECT * FROM budget_scopes WHERE budget_scope_id = ?').get(budget.budgetScopeId) as Record<string, unknown> | undefined;
    if (existing) {
      if (Number(existing.max_steps) !== budget.maxSteps
        || Number(existing.max_tokens) !== budget.maxTokens
        || Number(existing.max_dollars) !== budget.maxDollars) {
        throw new Error(`budget scope conflict: ${budget.budgetScopeId}`);
      }
      return;
    }
    this.database.prepare(`
      INSERT INTO budget_scopes (
        budget_scope_id, max_steps, max_tokens, max_dollars
      ) VALUES (?, ?, ?, ?)
    `).run(budget.budgetScopeId, budget.maxSteps, budget.maxTokens, budget.maxDollars);
  }

  private reserveBudgetInternal(reservation: AgentModeBudgetReservation): AgentModeOperationResult {
    const existing = this.database.prepare('SELECT * FROM budget_reservations WHERE reservation_id = ?').get(reservation.reservationId) as Record<string, unknown> | undefined;
    if (existing) {
      const same = existing.budget_scope_id === reservation.budgetScopeId
        && existing.attempt_id === reservation.attemptId
        && Number(existing.steps) === reservation.steps
        && Number(existing.tokens) === reservation.tokens
        && Number(existing.dollars) === reservation.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps + ?,
        reserved_tokens = reserved_tokens + ?,
        reserved_dollars = reserved_dollars + ?
      WHERE budget_scope_id = ?
        AND used_steps + reserved_steps + ? <= max_steps
        AND used_tokens + reserved_tokens + ? <= max_tokens
        AND used_dollars + reserved_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
    );
    if (result.changes !== 1) throw new Error(`budget exhausted for ${reservation.budgetScopeId}`);
    this.database.prepare(`
      INSERT INTO budget_reservations (
        reservation_id, budget_scope_id, attempt_id, steps, tokens, dollars,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)
    `).run(
      reservation.reservationId,
      reservation.budgetScopeId,
      reservation.attemptId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      reservation.createdAt,
    );
    return 'created';
  }

  reserveBudget(reservation: AgentModeBudgetReservation, budget: AgentModeBudgetLimits): AgentModeOperationResult {
    return this.withTransaction(() => {
      this.ensureBudgetScope(budget);
      const result = this.reserveBudgetInternal(reservation);
      return result;
    });
  }

  prepareOperation(operation: Omit<AgentModePreparedOperation, 'preparedAt'> & { preparedAt?: string }): AgentModeOperationResult {
    const preparedAt = operation.preparedAt ?? new Date().toISOString();
    return this.withTransaction(() => {
      const attempt = this.getAttempt(operation.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${operation.attemptId}`);
      if (attempt.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${operation.attemptId}`);
      const existing = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operation.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === operation.attemptId
          && existing.effect_kind === operation.effectKind
          && existing.scope_hash === operation.scopeHash
          && existing.capability_id === operation.capabilityId
          && existing.grant_id === (operation.grantId ?? null)
          && existing.policy_version === operation.policyVersion
          && existing.deadline === operation.deadline
          && existing.lease_resource_key === (operation.leaseResourceKey ?? null)
          && existing.lease_id === (operation.leaseId ?? null)
          && existing.lease_fence === (operation.leaseFence ?? null);
        return same ? 'duplicate' : 'conflict';
      }
      if (operation.leaseFence !== undefined) {
        this.assertCurrentLease(operation.attemptId, operation.leaseResourceKey, operation.leaseId, operation.leaseFence, preparedAt);
      } else if (attempt.leaseId) {
        throw new Error('operation missing attempt lease fence');
      }
      this.database.prepare(`
        INSERT INTO effects (
          operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json,
          capability_id, grant_id, policy_version, lease_resource_key, lease_id, lease_fence,
          deadline, prepared_at
        ) VALUES (?, ?, ?, ?, 'prepared', NULL, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.scopeHash,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.database.prepare(`
        INSERT INTO dispatch_outbox (
          operation_id, attempt_id, effect_kind, capability_id, grant_id, scope_hash,
          policy_version, lease_resource_key, lease_id, lease_fence, deadline,
          state, prepared_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatchable', ?)
      `).run(
        operation.operationId,
        operation.attemptId,
        operation.effectKind,
        operation.capabilityId,
        operation.grantId ?? null,
        operation.scopeHash,
        operation.policyVersion,
        operation.leaseResourceKey ?? null,
        operation.leaseId ?? null,
        operation.leaseFence ?? null,
        operation.deadline,
        preparedAt,
      );
      this.appendEventIfAbsent({
        eventId: `operation-prepared:${operation.operationId}`,
        entityType: 'operation',
        entityId: operation.operationId,
        eventType: 'operation_prepared',
        occurredAt: preparedAt,
        payload: { attemptId: operation.attemptId, scopeHash: operation.scopeHash },
      });
      this.failIfInjected('effect-preparation');
      return 'created';
    });
  }

  getOutbox(operationId: string): AgentModeDispatchOutbox | undefined {
    const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
    };
  }

  listOutbox(): AgentModeDispatchOutbox[] {
    const rows = this.database.prepare('SELECT * FROM dispatch_outbox ORDER BY prepared_at, operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      capabilityId: String(row.capability_id),
      ...(row.grant_id === null ? {} : { grantId: String(row.grant_id) }),
      scopeHash: String(row.scope_hash),
      policyVersion: String(row.policy_version),
      ...(row.lease_resource_key === null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id === null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence === null ? {} : { leaseFence: Number(row.lease_fence) }),
      deadline: String(row.deadline),
      state: row.state as AgentModeDispatchState,
      preparedAt: String(row.prepared_at),
      ...(row.dispatched_at === null ? {} : { dispatchedAt: String(row.dispatched_at) }),
    }));
  }

  markDispatched(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT * FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.state === 'dispatched' || row.state === 'effect_applied' || row.state === 'receipt_recorded' || row.state === 'verified' || row.state === 'failed' || row.state === 'uncertain') return 'duplicate';
      const attempt = this.getAttempt(String(row.attempt_id));
      if (attempt?.cancellationStatus !== 'running') throw new Error(`cancellation requested for attempt ${String(row.attempt_id)}`);
      this.assertCurrentLease(
        String(row.attempt_id),
        row.lease_resource_key === null ? undefined : String(row.lease_resource_key),
        row.lease_id === null ? undefined : String(row.lease_id),
        row.lease_fence === null ? undefined : Number(row.lease_fence),
        now,
      );
      this.database.prepare("UPDATE dispatch_outbox SET state = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND state = 'dispatchable'").run(now, operationId);
      this.database.prepare("UPDATE effects SET status = 'dispatched', dispatched_at = ? WHERE operation_id = ? AND status = 'prepared'").run(now, operationId);
      this.appendEventIfAbsent({
        eventId: `operation-dispatched:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_dispatched',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markEffectObserved(operationId: string, now: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      if (row.status === 'effect_applied' || row.status === 'receipt_recorded' || row.status === 'succeeded' || row.status === 'failed' || row.status === 'uncertain') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'effect_applied', observed_at = ? WHERE operation_id = ?").run(now, operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'effect_applied' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `effect-observed:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'effect_observed_without_receipt',
        occurredAt: now,
        payload: { attemptId: String(row.attempt_id) },
      });
      return 'created';
    });
  }

  markOperationVerified(operationId: string, verification: AgentModeVerification): AgentModeOperationResult {
    return this.withTransaction(() => {
      const row = this.database.prepare('SELECT attempt_id, status FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`operation not found: ${operationId}`);
      const outbox = this.database.prepare('SELECT state FROM dispatch_outbox WHERE operation_id = ?').get(operationId) as { state?: string } | undefined;
      if (row.status !== 'receipt_recorded' && row.status !== 'succeeded') throw new Error(`operation is not receipt-recorded: ${operationId}`);
      if (row.status === 'succeeded' && outbox?.state === 'verified') return 'duplicate';
      this.database.prepare("UPDATE effects SET status = 'succeeded' WHERE operation_id = ?").run(operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'verified' WHERE operation_id = ?").run(operationId);
      this.appendEventIfAbsent({
        eventId: `operation-verified:${operationId}`,
        entityType: 'operation',
        entityId: operationId,
        eventType: 'operation_verified',
        occurredAt: verification.verifiedAt,
        payload: {
          attemptId: String(row.attempt_id),
          resultHash: verification.resultHash,
          evidenceRef: verification.evidenceRef,
        },
      });
      return 'created';
    });
  }

  private assertCurrentLease(attemptId: string, resourceKey: string | undefined, leaseId: string | undefined, fence: number | undefined, now: string): void {
    if (!resourceKey || !leaseId || fence === undefined) throw new Error('stale lease fence: incomplete lease identity');
    const attempt = this.getAttempt(attemptId);
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!attempt || attempt.leaseResourceKey !== resourceKey || attempt.leaseId !== leaseId || attempt.leaseFence !== fence
      || !lease || lease.lease_id !== leaseId || Number(lease.fence) !== fence || lease.owner_id !== attempt.leaseOwnerId
      || String(lease.expires_at) <= now) {
      throw new Error(`stale lease fence for attempt ${attemptId}`);
    }
  }

  private isCurrentLeaseForAttempt(attemptId: string, now: string): boolean {
    const attempt = this.getAttempt(attemptId);
    if (!attempt?.leaseResourceKey || !attempt.leaseId || attempt.leaseFence === undefined) return true;
    const lease = this.database.prepare('SELECT lease_id, owner_id, fence, expires_at FROM leases WHERE resource_key = ?').get(attempt.leaseResourceKey) as Record<string, unknown> | undefined;
    return Boolean(lease)
      && lease?.lease_id === attempt.leaseId
      && lease?.owner_id === attempt.leaseOwnerId
      && Number(lease?.fence) === attempt.leaseFence
      && String(lease?.expires_at) > now;
  }

  isCurrentLease(attemptId: string, resourceKey: string, leaseId: string, fence: number, now: string): boolean {
    return this.isCurrentLeaseForAttempt(attemptId, now)
      && (() => {
        try {
          this.assertCurrentLease(attemptId, resourceKey, leaseId, fence, now);
          return true;
        } catch {
          return false;
        }
      })();
  }

  private settleBudgetInternal(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    const reservation = this.getReservation(settlement.reservationId);
    if (!reservation) throw new Error(`reservation not found: ${settlement.reservationId}`);
    if (reservation.status === 'settled') {
      const same = reservation.settledSteps === settlement.steps
        && reservation.settledTokens === settlement.tokens
        && reservation.settledDollars === settlement.dollars;
      return same ? 'duplicate' : 'conflict';
    }
    if ([settlement.steps, settlement.tokens, settlement.dollars].some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error('invalid budget settlement');
    }
    const result = this.database.prepare(`
      UPDATE budget_scopes SET
        reserved_steps = reserved_steps - ?,
        used_steps = used_steps + ?,
        reserved_tokens = reserved_tokens - ?,
        used_tokens = used_tokens + ?,
        reserved_dollars = reserved_dollars - ?,
        used_dollars = used_dollars + ?
      WHERE budget_scope_id = ?
        AND reserved_steps >= ?
        AND reserved_tokens >= ?
        AND reserved_dollars >= ?
        AND used_steps + ? <= max_steps
        AND used_tokens + ? <= max_tokens
        AND used_dollars + ? <= max_dollars
    `).run(
      reservation.steps,
      settlement.steps,
      reservation.tokens,
      settlement.tokens,
      reservation.dollars,
      settlement.dollars,
      reservation.budgetScopeId,
      reservation.steps,
      reservation.tokens,
      reservation.dollars,
      settlement.steps,
      settlement.tokens,
      settlement.dollars,
    );
    if (result.changes !== 1) throw new Error(`invalid budget settlement for ${settlement.reservationId}`);
    this.database.prepare(`
      UPDATE budget_reservations SET
        status = 'settled', settled_at = ?, settled_steps = ?, settled_tokens = ?, settled_dollars = ?
      WHERE reservation_id = ? AND status = 'reserved'
    `).run(settlement.settledAt, settlement.steps, settlement.tokens, settlement.dollars, settlement.reservationId);
    this.appendEventIfAbsent({
      eventId: `budget-settled:${settlement.reservationId}`,
      entityType: 'budget_reservation',
      entityId: settlement.reservationId,
      eventType: 'budget_settled',
      occurredAt: settlement.settledAt,
      payload: {
        attemptId: reservation.attemptId,
        steps: settlement.steps,
        tokens: settlement.tokens,
        dollars: settlement.dollars,
      },
    });
    this.failIfInjected('budget-settlement');
    return 'created';
  }

  settleBudget(settlement: AgentModeBudgetSettlement): AgentModeOperationResult {
    return this.withTransaction(() => this.settleBudgetInternal(settlement));
  }

  getReceipt(operationId: string): AgentModeJournalReceipt | undefined {
    const row = this.database.prepare("SELECT * FROM receipts WHERE operation_id = ? AND state = 'accepted' ORDER BY recorded_at, receipt_id LIMIT 1").get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapReceipt(row);
  }

  listReceipts(operationId: string): AgentModeJournalReceipt[] {
    const rows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ? ORDER BY recorded_at, receipt_id').all(operationId) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapReceipt(row));
  }

  private mapReceipt(row: Record<string, unknown>): AgentModeJournalReceipt {
    const receipt = JSON.parse(String(row.receipt_json)) as OperationReceipt;
    return {
      ...receipt,
      receiptId: String(row.receipt_id),
      state: row.state as AgentModeReceiptState,
    };
  }

  recordReceipt(receipt: OperationReceipt, settlement?: AgentModeBudgetSettlement): 'recorded' | 'duplicate' | 'conflict' | 'stale' {
    return this.withTransaction(() => {
      const effect = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(receipt.operationId) as Record<string, unknown> | undefined;
      if (!effect) throw new Error(`operation not found: ${receipt.operationId}`);
      const sameScope = effect.attempt_id === receipt.attemptId && effect.scope_hash === receipt.scopeHash;
      const existingRows = this.database.prepare('SELECT * FROM receipts WHERE operation_id = ?').all(receipt.operationId) as Array<Record<string, unknown>>;
      const receiptId = receiptIdFor(receipt);
      const sameExisting = existingRows.find((row) => row.receipt_id === receiptId);
      if (sameExisting) return 'duplicate';

      const hasConflict = existingRows.some((row) => row.state === 'accepted' && (
        row.attempt_id !== receipt.attemptId
        || row.scope_hash !== receipt.scopeHash
        || row.effect_hash !== receipt.effectHash
        || row.status !== receipt.status
      ));
      const stale = !sameScope || !this.isCurrentLeaseForAttempt(receipt.attemptId, receipt.recordedAt);
      if (stale) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'stale', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.appendEventIfAbsent({
          eventId: `receipt-stale:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_from_stale_attempt',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'stale';
      }

      if (existingRows.some((row) => row.state === 'conflict') || hasConflict || existingRows.some((row) => row.state === 'accepted' && (
        row.effect_hash !== receipt.effectHash || row.status !== receipt.status
      ))) {
        this.database.prepare(`
          INSERT INTO receipts (
            receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
            recorded_at, state, receipt_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'conflict', ?)
        `).run(
          receiptId,
          receipt.operationId,
          receipt.attemptId,
          receipt.scopeHash,
          receipt.effectHash,
          receipt.status,
          receipt.recordedAt,
          JSON.stringify(receipt),
        );
        this.database.prepare("UPDATE effects SET status = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE dispatch_outbox SET state = 'uncertain' WHERE operation_id = ?").run(receipt.operationId);
        this.database.prepare("UPDATE attempts SET status = 'uncertain', updated_at = ? WHERE attempt_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')").run(receipt.recordedAt, String(effect.attempt_id));
        this.appendEventIfAbsent({
          eventId: `receipt-conflict:${receiptId}`,
          entityType: 'operation',
          entityId: receipt.operationId,
          eventType: 'receipt_conflict',
          occurredAt: receipt.recordedAt,
          payload: { attemptId: receipt.attemptId, effectHash: receipt.effectHash },
        });
        return 'conflict';
      }

      this.database.prepare(`
        INSERT INTO receipts (
          receipt_id, operation_id, attempt_id, scope_hash, effect_hash, status,
          recorded_at, state, receipt_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', ?)
      `).run(
        receiptId,
        receipt.operationId,
        receipt.attemptId,
        receipt.scopeHash,
        receipt.effectHash,
        receipt.status,
        receipt.recordedAt,
        JSON.stringify(receipt),
      );
      this.database.prepare('UPDATE effects SET status = ?, receipt_json = ? WHERE operation_id = ?').run(receipt.status, JSON.stringify(receipt), receipt.operationId);
      this.database.prepare("UPDATE dispatch_outbox SET state = 'receipt_recorded' WHERE operation_id = ?").run(receipt.operationId);
      if (settlement) this.settleBudgetInternal(settlement);
      this.appendEventIfAbsent({
        eventId: `receipt-recorded:${receiptId}`,
        entityType: 'operation',
        entityId: receipt.operationId,
        eventType: 'receipt_recorded',
        occurredAt: receipt.recordedAt,
        payload: { attemptId: receipt.attemptId, status: receipt.status, settled: Boolean(settlement) },
      });
      this.failIfInjected('receipt');
      return 'recorded';
    });
  }

  requestCancellation(request: AgentModeCancellationRequest): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(request.attemptId);
      if (!attempt) throw new Error(`attempt not found: ${request.attemptId}`);
      const existing = this.database.prepare('SELECT attempt_id, requested_at FROM cancellation_requests WHERE request_id = ?').get(request.requestId) as Record<string, unknown> | undefined;
      if (existing) {
        return existing.attempt_id === request.attemptId && existing.requested_at === request.requestedAt ? 'duplicate' : 'conflict';
      }
      if (attempt.cancellationStatus !== 'running') return 'duplicate';
      this.database.prepare('INSERT INTO cancellation_requests (request_id, attempt_id, requested_at) VALUES (?, ?, ?)')
        .run(request.requestId, request.attemptId, request.requestedAt);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'requested', cancellation_requested_at = ?, updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'running'")
        .run(request.requestedAt, request.requestedAt, request.attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-requested:${request.requestId}`,
        entityType: 'attempt',
        entityId: request.attemptId,
        eventType: 'cancellation_requested',
        occurredAt: request.requestedAt,
        payload: { requestId: request.requestId },
      });
      return 'created';
    });
  }

  acknowledgeCancellation(attemptId: string, acknowledgedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.cancellationStatus === 'acknowledged' || attempt.cancellationStatus === 'completed') return 'duplicate';
      if (attempt.cancellationStatus !== 'requested') throw new Error(`cancellation was not requested: ${attemptId}`);
      this.database.prepare("UPDATE attempts SET cancellation_status = 'acknowledged', updated_at = ? WHERE attempt_id = ? AND cancellation_status = 'requested'")
        .run(acknowledgedAt, attemptId);
      this.appendEventIfAbsent({
        eventId: `cancellation-acknowledged:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'cancellation_acknowledged',
        occurredAt: acknowledgedAt,
        payload: {},
      });
      return 'created';
    });
  }

  finishAttempt(attemptId: string, status: 'completed' | 'failed' | 'cancelled', finishedAt: string): AgentModeOperationResult {
    return this.withTransaction(() => {
      const attempt = this.getAttempt(attemptId);
      if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
      if (attempt.status === status) return 'duplicate';
      if (['completed', 'failed', 'cancelled'].includes(attempt.status)) return 'conflict';
      if (status === 'cancelled' && attempt.cancellationStatus !== 'acknowledged') {
        throw new Error('cancellation acknowledgement is required before terminal cancellation');
      }
      this.database.prepare('UPDATE attempts SET status = ?, cancellation_status = ?, updated_at = ? WHERE attempt_id = ?')
        .run(status, status === 'cancelled' ? 'completed' : attempt.cancellationStatus, finishedAt, attemptId);
      const runStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed';
      this.database.prepare('UPDATE runs SET status = ? WHERE run_id = ?').run(runStatus, attempt.runId);
      this.database.prepare('UPDATE tasks SET status = ? WHERE task_id = (SELECT task_id FROM runs WHERE run_id = ?)').run(runStatus, attempt.runId);
      this.appendEventIfAbsent({
        eventId: `attempt-finished:${attemptId}`,
        entityType: 'attempt',
        entityId: attemptId,
        eventType: 'attempt_finished',
        occurredAt: finishedAt,
        payload: { status },
      });
      return 'created';
    });
  }

  classifyRecovery(attemptId: string, now: string): AgentModeRecoveryClassification {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
    if (attempt.status === 'duplicate') return 'duplicate';
    if (attempt.status === 'completed') return 'already_completed';
    if (attempt.status === 'failed') return 'terminal_failure';
    if (attempt.status === 'cancelled') return 'already_completed';
    if (attempt.cancellationStatus === 'requested') return 'cancelled_ack_pending';
    if (!this.isCurrentLeaseForAttempt(attemptId, now)) return 'stale_fenced_writer';
    const effect = this.database.prepare('SELECT status FROM effects WHERE attempt_id = ? ORDER BY COALESCE(prepared_at, rowid) DESC LIMIT 1').get(attemptId) as { status?: string } | undefined;
    if (!effect) return 'safe_to_resume';
    if (effect.status === 'effect_applied' || effect.status === 'uncertain') return 'uncertain_non_idempotent_effect';
    if (effect.status === 'dispatched') return 'awaiting_receipt_reconciliation';
    if (effect.status === 'succeeded') return 'already_completed';
    if (effect.status === 'failed') return 'terminal_failure';
    return 'safe_to_resume';
  }

  acquireLease(input: Omit<AgentModeLease, 'fence'>): AgentModeLease | undefined {
    return this.withTransaction(() => this.acquireLeaseAt(input, new Date().toISOString()));
  }

  getLease(resourceKey: string): AgentModeLease | undefined {
    const row = this.database.prepare('SELECT * FROM leases WHERE resource_key = ?').get(resourceKey) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      resourceKey,
      leaseId: String(row.lease_id),
      ownerId: String(row.owner_id),
      fence: Number(row.fence),
      expiresAt: String(row.expires_at),
    };
  }

  private acquireLeaseAt(input: Omit<AgentModeLease, 'fence'>, now: string): AgentModeLease | undefined {
    const current = this.database.prepare('SELECT fence, expires_at FROM leases WHERE resource_key = ?').get(input.resourceKey) as { fence?: number; expires_at?: string } | undefined;
    const currentExpiresAt = current?.expires_at;
    if (current && currentExpiresAt && currentExpiresAt > now) return undefined;
    const fence = Number(current?.fence ?? 0) + 1;
    this.database.prepare(`
      INSERT INTO leases (resource_key, lease_id, owner_id, fence, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(resource_key) DO UPDATE SET
        lease_id = excluded.lease_id,
        owner_id = excluded.owner_id,
        fence = excluded.fence,
        expires_at = excluded.expires_at
    `).run(input.resourceKey, input.leaseId, input.ownerId, fence, input.expiresAt);
    return { ...input, fence };
  }

  releaseLease(resourceKey: string, leaseId: string, fence: number): boolean {
    // Retain the fence counter after release so a future owner can never reuse
    // an old token, even when the previous lease ended cleanly.
    return this.withTransaction(() => {
      const result = this.database.prepare('UPDATE leases SET expires_at = ? WHERE resource_key = ? AND lease_id = ? AND fence = ?').run(new Date().toISOString(), resourceKey, leaseId, fence);
      return result.changes === 1;
    });
  }

  recordEffect(effect: AgentModeEffect): 'created' | 'duplicate' | 'conflict' {
    return this.withTransaction(() => {
      const existing = this.database.prepare('SELECT attempt_id, effect_kind, scope_hash, status, receipt_json FROM effects WHERE operation_id = ?').get(effect.operationId) as Record<string, unknown> | undefined;
      if (existing) {
        const same = existing.attempt_id === effect.attemptId
          && existing.effect_kind === effect.effectKind
          && existing.scope_hash === effect.scopeHash;
        if (!same) return 'conflict';
        return 'duplicate';
      }
      this.database.prepare(`
        INSERT INTO effects (operation_id, attempt_id, effect_kind, scope_hash, status, receipt_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(effect.operationId, effect.attemptId, effect.effectKind, effect.scopeHash, effect.status, effect.receiptJson ?? null);
      return 'created';
    });
  }

  getEffect(operationId: string): AgentModeEffect | undefined {
    const row = this.database.prepare('SELECT * FROM effects WHERE operation_id = ?').get(operationId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
    };
  }

  listEffects(): AgentModeEffect[] {
    const rows = this.database.prepare('SELECT * FROM effects ORDER BY COALESCE(prepared_at, rowid), operation_id').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      operationId: String(row.operation_id),
      attemptId: String(row.attempt_id),
      effectKind: String(row.effect_kind),
      scopeHash: String(row.scope_hash),
      status: row.status as AgentModeEffect['status'],
      ...(row.receipt_json === null ? {} : { receiptJson: String(row.receipt_json) }),
      ...(row.capability_id == null ? {} : { capabilityId: String(row.capability_id) }),
      ...(row.grant_id == null ? {} : { grantId: String(row.grant_id) }),
      ...(row.policy_version == null ? {} : { policyVersion: String(row.policy_version) }),
      ...(row.lease_resource_key == null ? {} : { leaseResourceKey: String(row.lease_resource_key) }),
      ...(row.lease_id == null ? {} : { leaseId: String(row.lease_id) }),
      ...(row.lease_fence == null ? {} : { leaseFence: Number(row.lease_fence) }),
      ...(row.deadline == null ? {} : { deadline: String(row.deadline) }),
      ...(row.prepared_at == null ? {} : { preparedAt: String(row.prepared_at) }),
      ...(row.dispatched_at == null ? {} : { dispatchedAt: String(row.dispatched_at) }),
      ...(row.observed_at == null ? {} : { observedAt: String(row.observed_at) }),
    }));
  }

  close(): void {
    this.database.close();
  }
}
