import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { TERMINAL_INTAKE_ACTION_RULE, TERMINAL_INTAKE_CONTROLLER_REF, AgentModeDynamicWorkerOrchestrator, type DynamicWorkerOrchestrationResult } from './dynamic-worker-orchestrator.js';
import { BRAIN_TASK_LIFECYCLE_SOURCE, TASK_LIFECYCLE_OBSERVED_EVENT } from './event-source.js';
import { CodexCliAgentRuntime } from './codex-cli-agent-runtime.js';
import { JARVIS_AGENT_ID, canonicalJarvisText, deriveJarvisIntakeId, deriveJarvisIntakeMaterialHash, deriveJarvisRootGoalId } from './jarvis-text-intake.js';
import { JARVIS_TASK_INPUT_RETENTION_CLASS, JARVIS_TASK_INPUT_SCHEMA_VERSION, deriveJarvisTaskInputContentHash, type JarvisTaskInputV1 } from './jarvis-response-sources.js';
import type { SpawnAuthorityFacts } from './spawn-policy.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import type { AgentRuntime } from './runtime-dispatch.js';

export const TERMINAL_INTAKE_SCHEMA_VERSION = 'agent-mode.terminal-intake.v1' as const;
export const TERMINAL_INTAKE_SOURCE = 'terminal' as const;
export const TERMINAL_REPOSITORY_REF_MAX = 256;
export const TERMINAL_GOAL_MAX = 4_000;
export const TERMINAL_OPERATOR_ID_MAX = 128;
export const TERMINAL_MODEL_MAX = 64;
const TERMINAL_TTL_MS = 10 * 60 * 1000;
const TERMINAL_ROOT_STEPS = 1;
const TERMINAL_ROOT_BUDGET = 0;
const ALLOWED_MODELS = new Set(['auto', 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5']);
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;

export type TerminalIntakeCommandV1 = {
  schemaVersion: typeof TERMINAL_INTAKE_SCHEMA_VERSION;
  requestId: string;
  operatorId: string;
  repositoryRef: string;
  repositoryRoot: string;
  model: string;
  text: string;
  receivedAt: string;
};

export type TerminalIntakeReceiptV1 = {
  schemaVersion: typeof TERMINAL_INTAKE_SCHEMA_VERSION;
  status: 'accepted' | 'duplicate';
  intakeId: string;
  rootGoalId: string;
  taskId: string;
  rootRunId: string;
  jarvisAgentId: typeof JARVIS_AGENT_ID;
  repositoryRef: string;
  repositoryRoot: string;
  model: string;
  createdAt: string;
};

export type TerminalIntakeResult =
  | { outcome: 'accepted' | 'duplicate'; receipt: TerminalIntakeReceiptV1 }
  | { outcome: 'conflict' | 'denied'; reasonCode: 'TERMINAL_INTAKE_CONFLICT' | 'TERMINAL_INTAKE_INVALID' | 'REPOSITORY_NOT_ALLOWED' | 'REPOSITORY_INVALID' | 'MODEL_NOT_ADMITTED' | 'TERMINAL_INTAKE_UNAVAILABLE' };

export type TerminalExecutionStatus = {
  schemaVersion: typeof TERMINAL_INTAKE_SCHEMA_VERSION;
  rootGoalId: string;
  taskId: string;
  rootRunId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
  childAgentId: string | null;
  childTaskId: string | null;
  childRunId: string | null;
  attemptId: string | null;
  resultText: string | null;
  resultRef: string | null;
  evidenceRef: string | null;
  reasonCode: string | null;
};

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }
function canonicalRoot(value: string): string { return realpathSync(value); }
function isContained(root: string, allowedRoot: string): boolean { return root === allowedRoot || root.startsWith(`${allowedRoot}${path.sep}`); }

function validateCommand(command: TerminalIntakeCommandV1): void {
  if (command.schemaVersion !== TERMINAL_INTAKE_SCHEMA_VERSION || !validText(command.requestId, 128) || !validText(command.operatorId, TERMINAL_OPERATOR_ID_MAX) || !validText(command.repositoryRef, TERMINAL_REPOSITORY_REF_MAX) || !SAFE_REF.test(command.repositoryRef) || !validText(command.repositoryRoot, 1_024) || !validText(command.model, TERMINAL_MODEL_MAX) || !validText(command.text, TERMINAL_GOAL_MAX) || !Number.isFinite(Date.parse(command.receivedAt))) throw new Error('invalid terminal intake command');
  if (!ALLOWED_MODELS.has(command.model)) throw new Error('model not admitted');
}

function rootRunId(rootGoalId: string): string { return `run:jarvis:${digest({ domain: 'agent-mode.terminal-root-run.v1', rootGoalId }).slice(0, 48)}`; }
function terminalSourceId(repositoryRef: string): string { return `source:terminal-intake:${digest({ repositoryRef }).slice(0, 48)}`; }
function terminalEventId(rootGoalId: string): string { return `event:terminal-intake:${digest({ rootGoalId }).slice(0, 48)}`; }

export class AgentModeTerminalIntakeService {
  private readonly now: () => string;
  private readonly repositoryRoots: readonly string[];
  private readonly runtimeFactory: (store: AgentModeSqliteStateStore) => AgentRuntime;

  constructor(private readonly store: AgentModeSqliteStateStore, options: { now?: () => string; repositoryRoots?: readonly string[]; runtimeFactory?: (store: AgentModeSqliteStateStore) => AgentRuntime } = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.repositoryRoots = (options.repositoryRoots ?? []).map((entry) => canonicalRoot(entry));
    this.runtimeFactory = options.runtimeFactory ?? ((stateStore) => new CodexCliAgentRuntime(stateStore));
  }

  private repositoryRoot(command: TerminalIntakeCommandV1): string {
    let resolved: string;
    try { resolved = canonicalRoot(command.repositoryRoot); } catch { throw new Error('repository invalid'); }
    try { if (!statSync(resolved).isDirectory() || !statSync(path.join(resolved, '.git')).isDirectory() && !statSync(path.join(resolved, '.git')).isFile()) throw new Error('repository invalid'); } catch { throw new Error('repository invalid'); }
    if (!this.repositoryRoots.some((allowed) => isContained(resolved, allowed))) throw new Error('repository not allowed');
    return resolved;
  }

  accept(command: TerminalIntakeCommandV1): TerminalIntakeResult {
    try {
      validateCommand(command);
      const repositoryRoot = this.repositoryRoot(command);
      const intakeId = deriveJarvisIntakeId(command.requestId, 'typed');
      const rootGoalId = deriveJarvisRootGoalId(intakeId);
      const canonicalText = canonicalJarvisText(command.text);
      const createdAt = command.receivedAt;
      const record = {
        intakeId,
        materialHash: digest({ schemaVersion: command.schemaVersion, requestId: command.requestId, repositoryRef: command.repositoryRef, repositoryRoot, model: command.model, text: canonicalText }),
        schemaVersion: 1 as const,
        source: 'typed' as const,
        operatorId: command.operatorId,
        canonicalTextHash: digest(canonicalText),
        rootGoalId,
        taskId: rootGoalId,
        jarvisAgentId: JARVIS_AGENT_ID,
        receivedAt: command.receivedAt,
        createdAt,
        repositoryRef: command.repositoryRef,
        repositoryRoot,
        requestedModel: command.model,
      };
      const taskInput: JarvisTaskInputV1 = { schemaVersion: JARVIS_TASK_INPUT_SCHEMA_VERSION, rootGoalId, taskId: rootGoalId, jarvisAgentId: JARVIS_AGENT_ID, source: 'typed', text: canonicalText, contentHash: deriveJarvisTaskInputContentHash(canonicalText), retentionClass: JARVIS_TASK_INPUT_RETENTION_CLASS, createdAt };
      const persisted = this.store.recordJarvisIntake(record, taskInput);
      if (persisted.result === 'conflict') return { outcome: 'conflict', reasonCode: 'TERMINAL_INTAKE_CONFLICT' };
      const persistedRecord = persisted.record;
      const runId = rootRunId(rootGoalId);
      this.store.createRun({ runId, taskId: rootGoalId, agentId: JARVIS_AGENT_ID, createdAt, status: 'active' });
      this.store.upsertAgent({ ...this.store.getAgent(JARVIS_AGENT_ID)!, rootGoalId, depth: 0, repositoryScope: command.repositoryRef, capabilities: ['repo.read'], status: 'active' });
      const deadline = new Date(Date.parse(createdAt) + TERMINAL_TTL_MS).toISOString();
      const sourceId = terminalSourceId(command.repositoryRef);
      this.store.upsertEventSource({ sourceId, sourceType: BRAIN_TASK_LIFECYCLE_SOURCE, repositoryRef: command.repositoryRef, adapterType: 'brain.task.lifecycle', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null });
      this.store.createSchedulerEvent({ eventId: terminalEventId(rootGoalId), eventType: TASK_LIFECYCLE_OBSERVED_EVENT, source: sourceId, occurredAt: createdAt, receivedAt: createdAt, causationId: persistedRecord.intakeId, correlationId: rootGoalId, deduplicationKey: rootGoalId, payloadVersion: 'k4.0', payload: { rootGoalId, taskId: rootGoalId, operatorId: command.operatorId, requestedModel: command.model }, nextEligibleAt: createdAt, deadline, maxAttempts: 3 });
      return { outcome: persisted.result === 'created' ? 'accepted' : 'duplicate', receipt: { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, status: persisted.result === 'created' ? 'accepted' : 'duplicate', intakeId: persistedRecord.intakeId, rootGoalId: persistedRecord.rootGoalId, taskId: persistedRecord.taskId, rootRunId: runId, jarvisAgentId: JARVIS_AGENT_ID, repositoryRef: command.repositoryRef, repositoryRoot, model: command.model, createdAt: persistedRecord.createdAt } };
    } catch (error) {
      if (error instanceof Error && error.message === 'repository not allowed') return { outcome: 'denied', reasonCode: 'REPOSITORY_NOT_ALLOWED' };
      if (error instanceof Error && error.message === 'repository invalid') return { outcome: 'denied', reasonCode: 'REPOSITORY_INVALID' };
      if (error instanceof Error && error.message === 'invalid terminal intake command') return { outcome: 'denied', reasonCode: 'TERMINAL_INTAKE_INVALID' };
      if (error instanceof Error && error.message.includes('model')) return { outcome: 'denied', reasonCode: 'MODEL_NOT_ADMITTED' };
      return { outcome: 'denied', reasonCode: 'TERMINAL_INTAKE_UNAVAILABLE' };
    }
  }

  private rootFacts(rootGoalId: string, now: string): SpawnAuthorityFacts | undefined {
    const task = this.store.getTask(rootGoalId);
    if (!task?.repositoryRef) return undefined;
    const existing = this.store.getSpawnRootState(rootGoalId);
    const deadline = existing?.deadline ?? new Date(Date.parse(task.createdAt) + TERMINAL_TTL_MS).toISOString();
    return { now, globalKillSwitchDenied: false, rootKillSwitchDenied: false, authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true }, root: { rootGoalId, depth: existing?.depth ?? 0, activeChildren: existing?.activeChildren ?? 0, totalChildCreations: existing?.totalChildCreations ?? 0, cancellation: existing?.cancellation ?? (task.status === 'cancelled' ? 'cancelled' : 'active'), remainingSteps: existing ? existing.maxAggregateChildSteps - existing.reservedChildSteps : TERMINAL_ROOT_STEPS, remainingBudget: existing ? existing.maxAggregateChildCost - existing.reservedChildCost : TERMINAL_ROOT_BUDGET, deadline, delegableCapabilities: existing?.delegableCapabilities ?? ['repo.read'], repositoryScopes: existing?.repositoryScopes ?? [task.repositoryRef], resourceScopes: existing?.resourceScopes ?? [] }, parent: null };
  }

  async execute(rootGoalId: string): Promise<DynamicWorkerOrchestrationResult> {
    const event = this.store.getSchedulerEvent(terminalEventId(rootGoalId));
    if (!event) throw new Error('terminal intake event not found');
    return new AgentModeDynamicWorkerOrchestrator({ store: this.store, runtime: this.runtimeFactory(this.store), actionRules: [TERMINAL_INTAKE_ACTION_RULE], rootFacts: (id, now) => this.rootFacts(id, now), ownerId: 'brain-terminal-intake', controllerRef: TERMINAL_INTAKE_CONTROLLER_REF, now: this.now(), clock: this.now }).handleSchedulerEvent({ event, now: this.now() });
  }

  status(rootGoalId: string): TerminalExecutionStatus {
    const rootRun = rootRunId(rootGoalId);
    const child = this.store.listAgents().filter((agent) => agent.agentKind === 'worker' && agent.rootGoalId === rootGoalId).sort((a, b) => a.agentId.localeCompare(b.agentId))[0];
    const assignment = child ? this.store.getChildAssignment(child.agentId) : undefined;
    const attempt = assignment ? this.store.getAttempt(assignment.attemptId) : undefined;
    const receipt = attempt ? this.store.getRuntimeReceiptForAttempt(attempt.attemptId) : undefined;
    const status: TerminalExecutionStatus['status'] = !child ? 'queued' : attempt?.status === 'completed' ? 'completed' : attempt?.status === 'failed' ? 'failed' : attempt?.status === 'cancelled' ? 'cancelled' : attempt?.status === 'uncertain' ? 'uncertain' : 'running';
    return { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, rootGoalId, taskId: rootGoalId, rootRunId: rootRun, status, childAgentId: child?.agentId ?? null, childTaskId: assignment?.taskId ?? null, childRunId: assignment?.runId ?? null, attemptId: attempt?.attemptId ?? null, resultText: receipt?.resultText ?? null, resultRef: receipt?.resultHash ?? null, evidenceRef: receipt?.evidenceRef ?? null, reasonCode: attempt?.status === 'failed' ? 'WORKER_FAILED' : attempt?.status === 'uncertain' ? 'RUNTIME_UNCERTAIN' : null };
  }
}

export function createTerminalIntakeService(store: AgentModeSqliteStateStore, repositoryRoots: readonly string[]): AgentModeTerminalIntakeService {
  return new AgentModeTerminalIntakeService(store, { repositoryRoots });
}

export function terminalCommandInput(input: Omit<TerminalIntakeCommandV1, 'schemaVersion'>): TerminalIntakeCommandV1 { return { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, ...input }; }
