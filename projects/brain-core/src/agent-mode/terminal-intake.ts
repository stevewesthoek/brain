import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TERMINAL_INTAKE_ACTION_RULE, TERMINAL_INTAKE_AUTO_TASK_SPEC_REF, TERMINAL_INTAKE_CONTROLLER_REF, AgentModeDynamicWorkerOrchestrator, type DynamicWorkerOrchestrationResult, type SchedulerEventActionRule } from './dynamic-worker-orchestrator.js';
import { BRAIN_TASK_LIFECYCLE_SOURCE, TASK_LIFECYCLE_OBSERVED_EVENT } from './event-source.js';
import { CodexCliAgentRuntime } from './codex-cli-agent-runtime.js';
import { admitCodexModel } from './codex-model-policy.js';
import { JARVIS_AGENT_ID, canonicalJarvisText, deriveJarvisIntakeId, deriveJarvisIntakeMaterialHash, deriveJarvisRootGoalId } from './jarvis-text-intake.js';
import { JARVIS_TASK_INPUT_RETENTION_CLASS, JARVIS_TASK_INPUT_SCHEMA_VERSION, deriveJarvisTaskInputContentHash, type JarvisTaskInputV1 } from './jarvis-response-sources.js';
import type { SpawnAuthorityFacts } from './spawn-policy.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import type { AgentRuntime } from './runtime-dispatch.js';
import type { AgentModeExecutionTelemetry, AgentModeTelemetryEvent } from './execution-telemetry.js';
import { admitJarvisContextSet } from './jarvis-local-context.js';
import { resolveJarvisRuntimeRoute, type JarvisCodexEscalationApproval, type JarvisRuntimeRoute } from './jarvis-runtime-routing.js';
import { buildJarvisRoutingDisclosure, isJarvisRoutingQuestion } from './jarvis-routing-transparency.js';
import { applyJarvisReflexRoute, persistedJarvisReflexRoute, routeFromK4Assignment } from './jarvis-reflex-route.js';
import { canonicalJarvisConversationText, deriveJarvisConversationTurnId, JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, type JarvisConversationTurnV1 } from './jarvis-conversation.js';
import { loadJarvisProductionRuntimeConfiguration, type JarvisProductionRuntimeConfiguration } from './jarvis-production-runtime.js';
import { MOCK_AGENT_RUNTIME_REF } from './child-assignment.js';
import type { JarvisSystemOneReflexHook } from './jarvis-system-one-reflex.js';
import { asReflexSkillCandidates, listJarvisSkillCandidates } from './jarvis-skill-context.js';
import { shouldRunReflexPostflight, type ReflexPostflightResult, type TurnDecisionEnvelopeV1 } from './system-one-reflex.js';

export const TERMINAL_INTAKE_SCHEMA_VERSION = 'agent-mode.terminal-intake.v1' as const;
export const TERMINAL_INTAKE_SOURCE = 'terminal' as const;
export const TERMINAL_REPOSITORY_REF_MAX = 256;
export const TERMINAL_GOAL_MAX = 4_000;
export const TERMINAL_OPERATOR_ID_MAX = 128;
export const TERMINAL_MODEL_MAX = 64;
const TERMINAL_TTL_MS = 10 * 60 * 1000;
const TERMINAL_ROOT_STEPS = 1;
const TERMINAL_ROOT_BUDGET = 0;
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
  conversationId?: string;
  codexEscalation?: JarvisCodexEscalationApproval;
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
  conversationId?: string;
  createdAt: string;
};

export type TerminalIntakeResult =
  | { outcome: 'accepted' | 'duplicate'; receipt: TerminalIntakeReceiptV1 }
  | { outcome: 'conflict' | 'denied'; reasonCode: 'TERMINAL_INTAKE_CONFLICT' | 'TERMINAL_INTAKE_INVALID' | 'REPOSITORY_NOT_ALLOWED' | 'REPOSITORY_INVALID' | 'MODEL_NOT_ADMITTED' | 'AUTO_RUNTIME_UNAVAILABLE' | 'CODEX_ESCALATION_REQUIRED' | 'CODEX_ESCALATION_INVALID' | 'TERMINAL_INTAKE_UNAVAILABLE' };

export type TerminalReflexStatus = {
  mode: 'OFF' | 'SHADOW' | 'ACTIVE_PILOT' | 'UNAVAILABLE';
  status: 'off' | 'recommendation' | 'fallback';
  latencyMs: number;
  recommendationModelRef: string | null;
  actualRouteModelRef: string | null;
  confidence: number | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  cost: { amountUsd: number; basis: string } | null;
  reasonCode: string | null;
  postflightStatus: 'off' | 'verified' | 'escalation_advised' | 'fallback' | null;
};

export type TerminalReflexPhase = 'preflight' | 'completed' | 'fallback';

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
  workerCount: number;
  runtimeRef: string | null;
  runtimeProfileRef: string | null;
  modelRef: string | null;
  requestedModel: string | null;
  repositoryRef: string | null;
  startedAt: string | null;
  elapsedMs: number | null;
  safeActivity: string | null;
  lastActivityAt: string | null;
  activity: readonly AgentModeTelemetryEvent[];
  telemetry: AgentModeExecutionTelemetry | null;
  reflex?: TerminalReflexStatus;
  reflexPhase?: TerminalReflexPhase;
  phaseTimings?: {
    submittedAt: string | null;
    intakeAcceptedAt: string | null;
    reflexStartedAt: string | null;
    reflexCompletedAt: string | null;
    runtimeStartedAt: string | null;
    firstRuntimeEventAt: string | null;
    resultCompletedAt: string | null;
  };
  updatedAt: string | null;
  conversationId?: string | null;
  conversationHistory?: readonly { turnId: string; sequence: number; speakerRole: 'user' | 'jarvis'; text: string; status: string; createdAt: string }[];
};

function digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }
function canonicalRoot(value: string): string { return realpathSync(value); }
function isContained(root: string, allowedRoot: string): boolean { return root === allowedRoot || root.startsWith(`${allowedRoot}${path.sep}`); }

function validateCommand(command: TerminalIntakeCommandV1): void {
  if (command.schemaVersion !== TERMINAL_INTAKE_SCHEMA_VERSION || !validText(command.requestId, 128) || !validText(command.operatorId, TERMINAL_OPERATOR_ID_MAX) || !validText(command.repositoryRef, TERMINAL_REPOSITORY_REF_MAX) || !SAFE_REF.test(command.repositoryRef) || !validText(command.repositoryRoot, 1_024) || !validText(command.model, TERMINAL_MODEL_MAX) || !validText(command.text, TERMINAL_GOAL_MAX) || !Number.isFinite(Date.parse(command.receivedAt))) throw new Error('invalid terminal intake command');
  if (!admitCodexModel(command.model) && command.model !== 'auto' && !['minimax-m2.5', 'glm-5', 'opus-4.6', 'agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6', 'codex', 'codex-cli'].includes(command.model)) throw new Error('model not admitted');
}

function rootRunId(rootGoalId: string): string { return `run:jarvis:${digest({ domain: 'agent-mode.terminal-root-run.v1', rootGoalId }).slice(0, 48)}`; }
function terminalSourceId(repositoryRef: string): string { return `source:terminal-intake:${digest({ repositoryRef }).slice(0, 48)}`; }
function terminalEventId(rootGoalId: string): string { return `event:terminal-intake:${digest({ rootGoalId }).slice(0, 48)}`; }

export class AgentModeTerminalIntakeService {
  private readonly now: () => string;
  private readonly repositoryRoots: readonly string[];
  private readonly runtimeFactory: (store: AgentModeSqliteStateStore) => AgentRuntime;
  private readonly fixtureRuntimeAvailable: boolean;
  private readonly productionRuntimeAvailable: ReadonlySet<import('./model-gateway.js').AdmittedModelRef> | undefined;
  private readonly reflex: JarvisSystemOneReflexHook | undefined;

  constructor(private readonly store: AgentModeSqliteStateStore, options: { now?: () => string; repositoryRoots?: readonly string[]; codexCommand?: string; runtimeFactory?: (store: AgentModeSqliteStateStore) => AgentRuntime; productionRuntime?: JarvisProductionRuntimeConfiguration; reflex?: JarvisSystemOneReflexHook } = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.repositoryRoots = [...new Set((options.repositoryRoots ?? []).flatMap((entry) => {
      try { return [canonicalRoot(entry)]; } catch { return []; }
    }))];
    const productionRuntime = options.productionRuntime ?? loadJarvisProductionRuntimeConfiguration(this.now());
    this.fixtureRuntimeAvailable = options.runtimeFactory !== undefined;
    this.productionRuntimeAvailable = productionRuntime?.availableModels;
    this.reflex = options.reflex;
    this.runtimeFactory = options.runtimeFactory ?? productionRuntime?.runtimeFactory ?? ((stateStore) => new CodexCliAgentRuntime(stateStore, options.codexCommand));
  }

  private route(command: TerminalIntakeCommandV1): { route: JarvisRuntimeRoute } | { reasonCode: string } {
    const requestedModel = command.model === 'minimax-m2.5' ? 'agent-mode/minimax-m2.5' : command.model === 'glm-5' ? 'agent-mode/glm-5' : command.model === 'opus-4.6' ? 'agent-mode/claude-opus-4.6' : command.model;
    const resolved = resolveJarvisRuntimeRoute({ requestedModel, requestText: command.text, adaptiveRouting: this.reflex?.mode === 'ACTIVE_PILOT', fixtureRuntimeAvailable: this.fixtureRuntimeAvailable, ...(this.productionRuntimeAvailable ? { productionRuntimeAvailable: this.productionRuntimeAvailable } : {}), ...(command.codexEscalation ? { codexEscalation: command.codexEscalation } : {}) });
    return resolved.ok ? resolved : { reasonCode: resolved.reasonCode };
  }

  private actionRule(route: JarvisRuntimeRoute): SchedulerEventActionRule {
    if (route.source === 'codex-escalation') return TERMINAL_INTAKE_ACTION_RULE;
    return { ...TERMINAL_INTAKE_ACTION_RULE, ruleId: 'agent-mode.action.terminal-intake-auto.v1', taskSpecRef: TERMINAL_INTAKE_AUTO_TASK_SPEC_REF, runtimeRef: route.runtimeRef, runtimeProfileRef: route.runtimeProfileRef, requestedCost: route.runtimeRef === MOCK_AGENT_RUNTIME_REF ? 0 : 0.25, ...(route.modelRef ? { modelRef: route.modelRef } : {}) };
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
      const selected = this.route(command);
      if ('reasonCode' in selected) return { outcome: 'denied', reasonCode: selected.reasonCode as 'MODEL_NOT_ADMITTED' | 'AUTO_RUNTIME_UNAVAILABLE' | 'CODEX_ESCALATION_REQUIRED' | 'CODEX_ESCALATION_INVALID' };
      const repositoryRoot = this.repositoryRoot(command);
      const intakeId = deriveJarvisIntakeId(command.requestId, 'typed');
      const rootGoalId = deriveJarvisRootGoalId(intakeId);
      const conversationId = command.conversationId ?? `conversation:jarvis:${intakeId}`;
      const canonicalText = canonicalJarvisText(command.text);
      const createdAt = command.receivedAt;
      const record = {
        intakeId,
        materialHash: digest({ schemaVersion: command.schemaVersion, requestId: command.requestId, repositoryRef: command.repositoryRef, repositoryRoot, model: command.model, conversationId: command.conversationId ?? null, codexEscalation: command.codexEscalation ?? null, text: canonicalText }),
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
        conversationId,
        ...(command.codexEscalation ? { codexEscalation: command.codexEscalation } : {}),
      };
      const taskInput: JarvisTaskInputV1 = { schemaVersion: JARVIS_TASK_INPUT_SCHEMA_VERSION, rootGoalId, taskId: rootGoalId, jarvisAgentId: JARVIS_AGENT_ID, source: 'typed', text: canonicalText, contentHash: deriveJarvisTaskInputContentHash(canonicalText), retentionClass: JARVIS_TASK_INPUT_RETENTION_CLASS, createdAt };
      const contextSet = admitJarvisContextSet(rootGoalId, [{ kind: 'repository', path: repositoryRoot, repositoryRef: command.repositoryRef, requestedAccess: 'read', recursive: true, origin: 'repos-client' }], { home: os.homedir(), eligibleRoots: this.repositoryRoots, writableRoots: [], now: createdAt }, createdAt);
      if (contextSet.result === 'denied') return { outcome: 'denied', reasonCode: contextSet.reasonCode === 'REPOSITORY_INVALID' ? 'REPOSITORY_INVALID' : 'REPOSITORY_NOT_ALLOWED' };
      const persisted = this.store.recordJarvisIntake(record, taskInput, contextSet.contextSet);
      if (persisted.result === 'conflict') return { outcome: 'conflict', reasonCode: 'TERMINAL_INTAKE_CONFLICT' };
      const persistedRecord = persisted.record;
      if (persisted.result === 'created') {
        const sequence = this.store.listJarvisConversationTurns(conversationId).length + 1;
        const userTurn: JarvisConversationTurnV1 = { schemaVersion: JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, turnId: deriveJarvisConversationTurnId({ conversationId, sequence, speakerRole: 'user', rootGoalId, text: canonicalText }), conversationId, sequence, speakerRole: 'user', text: canonicalJarvisConversationText(canonicalText), status: 'completed', rootGoalId, taskId: rootGoalId, sourceResultRef: null, createdAt };
        this.store.recordJarvisConversationTurn(userTurn);
      }
      const runId = rootRunId(rootGoalId);
      this.store.createRun({ runId, taskId: rootGoalId, agentId: JARVIS_AGENT_ID, createdAt, status: 'active' });
      this.store.upsertAgent({ ...this.store.getAgent(JARVIS_AGENT_ID)!, rootGoalId, depth: 0, repositoryScope: command.repositoryRef, capabilities: ['repo.read'], status: 'active' });
      const deadline = new Date(Date.parse(createdAt) + TERMINAL_TTL_MS).toISOString();
      const sourceId = terminalSourceId(command.repositoryRef);
      this.store.upsertEventSource({ sourceId, sourceType: BRAIN_TASK_LIFECYCLE_SOURCE, repositoryRef: command.repositoryRef, adapterType: 'brain.task.lifecycle', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null });
      this.store.createSchedulerEvent({ eventId: terminalEventId(rootGoalId), eventType: TASK_LIFECYCLE_OBSERVED_EVENT, source: sourceId, occurredAt: createdAt, receivedAt: createdAt, causationId: persistedRecord.intakeId, correlationId: rootGoalId, deduplicationKey: rootGoalId, payloadVersion: 'k4.0', payload: { rootGoalId, taskId: rootGoalId, operatorId: command.operatorId, requestedModel: command.model }, nextEligibleAt: createdAt, deadline, maxAttempts: 3 });
      return { outcome: persisted.result === 'created' ? 'accepted' : 'duplicate', receipt: { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, status: persisted.result === 'created' ? 'accepted' : 'duplicate', intakeId: persistedRecord.intakeId, rootGoalId: persistedRecord.rootGoalId, taskId: persistedRecord.taskId, rootRunId: runId, jarvisAgentId: JARVIS_AGENT_ID, repositoryRef: command.repositoryRef, repositoryRoot, model: selected.route.modelRef ?? 'codex-cli', conversationId, createdAt: persistedRecord.createdAt } };
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
    const modelBudget = task.requestedModel === 'auto' || task.requestedModel === 'minimax-m2.5' || task.requestedModel === 'glm-5' || task.requestedModel === 'opus-4.6' || task.requestedModel === 'agent-mode/minimax-m2.5' || task.requestedModel === 'agent-mode/glm-5' || task.requestedModel === 'agent-mode/claude-opus-4.6' ? 0.25 : TERMINAL_ROOT_BUDGET;
    return { now, globalKillSwitchDenied: false, rootKillSwitchDenied: false, authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true }, root: { rootGoalId, depth: existing?.depth ?? 0, activeChildren: existing?.activeChildren ?? 0, totalChildCreations: existing?.totalChildCreations ?? 0, cancellation: existing?.cancellation ?? (task.status === 'cancelled' ? 'cancelled' : 'active'), remainingSteps: existing ? existing.maxAggregateChildSteps - existing.reservedChildSteps : TERMINAL_ROOT_STEPS, remainingBudget: existing ? existing.maxAggregateChildCost - existing.reservedChildCost : modelBudget, deadline, delegableCapabilities: existing?.delegableCapabilities ?? ['repo.read'], repositoryScopes: existing?.repositoryScopes ?? [task.repositoryRef], resourceScopes: existing?.resourceScopes ?? [] }, parent: null };
  }

  async execute(rootGoalId: string): Promise<DynamicWorkerOrchestrationResult> {
    const event = this.store.getSchedulerEvent(terminalEventId(rootGoalId));
    if (!event) throw new Error('terminal intake event not found');
    const intake = event.causationId ? this.store.getJarvisIntake(event.causationId) : undefined;
    const selected = intake ? this.route({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: intake.intakeId, operatorId: intake.operatorId, repositoryRef: intake.repositoryRef ?? '', repositoryRoot: intake.repositoryRoot ?? '', model: intake.requestedModel ?? 'auto', text: this.store.getJarvisTaskInput(rootGoalId)?.text ?? 'resume', receivedAt: intake.receivedAt, ...(intake.conversationId ? { conversationId: intake.conversationId } : {}), ...(intake.codexEscalation ? { codexEscalation: intake.codexEscalation } : {}) }) : { route: undefined as JarvisRuntimeRoute | undefined };
    const selectedRoute = 'route' in selected ? selected.route : undefined;
    const existingAssignment = this.store.listChildAssignments().find((assignment) => assignment.sourceEventId === event.eventId);
    const existingRoute = existingAssignment ? routeFromK4Assignment(existingAssignment) : this.storedReflexRoute(rootGoalId);
    const reflexStartedAt = this.reflex && !existingRoute ? this.now() : undefined;
    if (reflexStartedAt) this.recordReflexStarted(rootGoalId, reflexStartedAt);
    const reflexPreflight = this.reflex && !existingRoute ? await this.runReflexPreflight(rootGoalId, selectedRoute?.modelRef) : undefined;
    const reflexCompletedAt = reflexPreflight ? this.now() : undefined;
    const effectiveRoute = reflexPreflight && selectedRoute
      ? applyJarvisReflexRoute({ requestedModel: intake?.requestedModel ?? 'auto', requestText: this.store.getJarvisTaskInput(rootGoalId)?.text ?? '', currentRoute: selectedRoute, envelope: reflexPreflight, ...(this.productionRuntimeAvailable ? { availableModels: this.productionRuntimeAvailable } : {}), fixtureRuntimeAvailable: this.fixtureRuntimeAvailable })
      : existingRoute ?? selectedRoute;
    if (reflexPreflight) {
      if (reflexPreflight.mode === 'ACTIVE_PILOT' && effectiveRoute) this.recordReflexRoute(rootGoalId, effectiveRoute);
      this.recordReflexPreflight(rootGoalId, { ...reflexPreflight, actualRouteModelRef: effectiveRoute?.modelRef ?? reflexPreflight.actualRouteModelRef }, reflexStartedAt, reflexCompletedAt);
    }
    const actionRules = effectiveRoute ? [this.actionRule(effectiveRoute)] : [TERMINAL_INTAKE_ACTION_RULE];
    const result = await new AgentModeDynamicWorkerOrchestrator({ store: this.store, runtime: this.runtimeFactory(this.store), actionRules, rootFacts: (id, now) => this.rootFacts(id, now), ownerId: 'brain-terminal-intake', controllerRef: TERMINAL_INTAKE_CONTROLLER_REF, now: this.now(), clock: this.now }).handleSchedulerEvent({ event, now: this.now() });
    if (reflexPreflight && this.reflex && shouldRunReflexPostflight(reflexPreflight)) {
      const postflight = await this.runReflexPostflight(reflexPreflight.originalRequestHash, result);
      if (postflight) this.recordReflexPostflight(rootGoalId, postflight);
    }
    if (result.attemptId && ['COMPLETED', 'FAILED'].includes(result.result)) {
      const receipt = this.store.getRuntimeReceiptForAttempt(result.attemptId);
      const conversationId = this.store.getJarvisConversationIdForRoot(rootGoalId);
      if (receipt?.resultText && conversationId && this.store.listJarvisConversationTurns(conversationId).every((turn) => turn.rootGoalId !== rootGoalId || turn.speakerRole !== 'jarvis')) {
        const sequence = this.store.listJarvisConversationTurns(conversationId).length + 1;
        const status = receipt.status === 'succeeded' ? 'completed' : receipt.status;
        const responseText = canonicalJarvisConversationText(isJarvisRoutingQuestion(this.store.getJarvisTaskInput(rootGoalId)?.text)
          ? buildJarvisRoutingDisclosure({ requestedModel: intake?.requestedModel ?? null, route: effectiveRoute ?? null, reflex: reflexPreflight ? { mode: reflexPreflight.mode, status: reflexPreflight.status, recommendationModelRef: reflexPreflight.recommendation?.modelRef ?? null, actualRouteModelRef: effectiveRoute?.modelRef ?? reflexPreflight.actualRouteModelRef, reasonCode: reflexPreflight.reasonCode } : null })
          : receipt.resultText);
        const response: JarvisConversationTurnV1 = { schemaVersion: JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, turnId: deriveJarvisConversationTurnId({ conversationId, sequence, speakerRole: 'jarvis', rootGoalId, text: responseText }), conversationId, sequence, speakerRole: 'jarvis', text: responseText, status, rootGoalId, taskId: rootGoalId, sourceResultRef: `runtime-receipt:${result.attemptId}:${receipt.resultHash}`, createdAt: this.now() };
        this.store.recordJarvisConversationTurn(response);
      }
    }
    return result;
  }

  private storedReflexRoute(rootGoalId: string): JarvisRuntimeRoute | undefined {
    const events = this.store.listEvents(rootGoalId);
    const routeEvent = [...events].reverse().find((event) => event.eventType === 'jarvis_reflex_route');
    return persistedJarvisReflexRoute(routeEvent?.payload);
  }

  private recordReflexStarted(rootGoalId: string, startedAt: string): void {
    const eventId = `jarvis-reflex-started:${rootGoalId}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({ eventId, entityType: 'jarvis_intake', entityId: rootGoalId, eventType: 'jarvis_reflex_started', occurredAt: startedAt, payload: { status: 'started' } });
  }

  private recordReflexRoute(rootGoalId: string, route: JarvisRuntimeRoute): void {
    const eventId = `jarvis-reflex-route:${rootGoalId}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({ eventId, entityType: 'jarvis_intake', entityId: rootGoalId, eventType: 'jarvis_reflex_route', occurredAt: this.now(), payload: { modelRef: route.modelRef, runtimeRef: route.runtimeRef, runtimeProfileRef: route.runtimeProfileRef, source: route.source, selectionReason: route.selectionReason ?? null } });
  }

  private async runReflexPreflight(rootGoalId: string, actualRouteModelRef: string | undefined) {
    try {
      const skills = await listJarvisSkillCandidates();
      return await this.reflex!.preflight({
        text: this.store.getJarvisTaskInput(rootGoalId)?.text ?? 'resume bounded Jarvis execution',
        requestedModel: this.store.getTask(rootGoalId)?.requestedModel ?? 'auto',
        sessionSummary: `root:${rootGoalId}`,
        candidateSkills: asReflexSkillCandidates(skills),
        candidateContexts: this.store.listJarvisContexts(rootGoalId).slice(0, 32).map((context) => ({ id: context.contextId, label: context.repositoryRef ?? context.kind })),
        ...(actualRouteModelRef ? { actualRouteModelRef } : {}),
      });
    } catch {
      this.recordReflexFallback(rootGoalId, 'REFLEX_PREFLIGHT_UNAVAILABLE');
      return undefined;
    }
  }

  private recordReflexFallback(rootGoalId: string, reasonCode: string): void {
    const eventId = `jarvis-reflex-fallback:${rootGoalId}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({ eventId, entityType: 'jarvis_intake', entityId: rootGoalId, eventType: 'jarvis_reflex_fallback', occurredAt: this.now(), payload: {
      mode: 'UNAVAILABLE', status: 'fallback', latencyMs: 0, recommendationModelRef: null, actualRouteModelRef: null,
      confidence: null, usage: null, cost: null, reasonCode, postflightStatus: 'fallback',
    } });
  }

  private recordReflexPreflight(rootGoalId: string, envelope: TurnDecisionEnvelopeV1, startedAt?: string, completedAt?: string): void {
    const eventId = `jarvis-reflex-preflight:${rootGoalId}:${envelope.originalRequestHash}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({
      eventId,
      entityType: 'jarvis_intake',
      entityId: rootGoalId,
      eventType: 'jarvis_reflex_preflight',
      occurredAt: completedAt ?? this.now(),
      payload: {
        schemaVersion: envelope.schemaVersion,
        mode: envelope.mode,
        status: envelope.status,
        latencyMs: envelope.latencyMs,
        provider: envelope.provider,
        usage: envelope.usage,
        cost: envelope.cost,
        recommendationModelRef: envelope.recommendation?.modelRef ?? null,
        actualRouteModelRef: envelope.actualRouteModelRef,
        confidence: envelope.confidence,
        reasonCode: envelope.reasonCode,
        selectedContextIds: envelope.contextNeeds.selectedIds,
        selectedSkillIds: envelope.likelySkills,
        reflexStartedAt: startedAt ?? null,
        reflexCompletedAt: completedAt ?? null,
      },
    });
  }

  private recordReflexPostflight(rootGoalId: string, result: ReflexPostflightResult): void {
    const eventId = `jarvis-reflex-postflight:${rootGoalId}:${result.originalRequestHash}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({
      eventId,
      entityType: 'jarvis_intake',
      entityId: rootGoalId,
      eventType: 'jarvis_reflex_postflight',
      occurredAt: this.now(),
      payload: {
        originalRequestHash: result.originalRequestHash,
        status: result.status,
        latencyMs: result.latencyMs,
        usage: result.usage,
        cost: result.cost,
        confidence: result.confidence,
        reasonCode: result.reasonCode,
      },
    });
  }

  private async runReflexPostflight(originalRequestHash: string, result: DynamicWorkerOrchestrationResult): Promise<ReflexPostflightResult | undefined> {
    try {
      return await this.reflex!.postflight({ originalRequestHash, resultFacts: { result: result.result, terminalWorkerOutcome: result.terminalWorkerOutcome, childAgentId: result.childAgentId, taskId: result.taskId, runId: result.runId, attemptId: result.attemptId } });
    } catch {
      // Reflex is advisory; K4's durable result remains authoritative.
      return undefined;
    }
  }

  status(rootGoalId: string): TerminalExecutionStatus {
    // Terminal and v2 Jarvis intake share the same child lifecycle shape, but
    // use different deterministic root-run namespaces. Resolve the durable
    // root run by its task/owner first so the read-only status projection can
    // follow either entry point without creating a second execution path.
    const rootRunRecord = this.store.listRuns().find((run) => run.taskId === rootGoalId && run.agentId === JARVIS_AGENT_ID);
    const rootRun = rootRunRecord?.runId ?? rootRunId(rootGoalId);
    const workers = this.store.listAgents().filter((agent) => agent.agentKind === 'worker' && agent.rootGoalId === rootGoalId).sort((a, b) => a.agentId.localeCompare(b.agentId));
    const child = workers[0];
    const assignment = child ? this.store.getChildAssignment(child.agentId) : undefined;
    const attempt = assignment ? this.store.getAttempt(assignment.attemptId) : undefined;
    const receipt = attempt ? this.store.getRuntimeReceiptForAttempt(attempt.attemptId) : undefined;
    const rootRunState = rootRunRecord ?? this.store.getRun(rootRun);
    const task = this.store.getTask(rootGoalId);
    const telemetryEvents = attempt ? this.store.listEvents(attempt.attemptId).filter((event) => event.eventType === 'runtime_telemetry').flatMap((event) => {
      const payload = event.payload as { event?: AgentModeTelemetryEvent; telemetry?: AgentModeExecutionTelemetry };
      return payload.event ? [{ event: payload.event, telemetry: payload.telemetry ?? null }] : [];
    }) : [];
    const latestTelemetry = receipt?.telemetry ?? telemetryEvents.at(-1)?.telemetry ?? null;
    const activity = telemetryEvents.map((entry) => entry.event).slice(-32);
    const rootEvents = this.store.listEvents(rootGoalId);
    const preflightEvent = [...rootEvents].reverse().find((event) => event.eventType === 'jarvis_reflex_preflight');
    const postflightEvent = [...rootEvents].reverse().find((event) => event.eventType === 'jarvis_reflex_postflight');
    const fallbackEvent = [...rootEvents].reverse().find((event) => event.eventType === 'jarvis_reflex_fallback');
    const reflexStartedEvent = [...rootEvents].reverse().find((event) => event.eventType === 'jarvis_reflex_started');
    const preflightPayload = (preflightEvent ?? fallbackEvent)?.payload as Partial<TerminalReflexStatus> & { provider?: unknown; recommendationModelRef?: unknown; actualRouteModelRef?: unknown; usage?: unknown; cost?: unknown; confidence?: unknown; reflexStartedAt?: unknown; reflexCompletedAt?: unknown } | undefined;
    const postflightPayload = postflightEvent?.payload as { status?: unknown } | undefined;
    const attemptEvents = attempt ? this.store.listEvents(attempt.attemptId) : [];
    const firstEventAt = (events: readonly { eventType: string; occurredAt: string }[], eventTypes: readonly string[]): string | null => events.find((event) => eventTypes.includes(event.eventType))?.occurredAt ?? null;
    const phaseTimings = {
      submittedAt: task?.createdAt ?? null,
      intakeAcceptedAt: task?.createdAt ?? null,
      reflexStartedAt: typeof (preflightPayload as Record<string, unknown> | undefined)?.reflexStartedAt === 'string' ? String((preflightPayload as Record<string, unknown>).reflexStartedAt) : reflexStartedEvent?.occurredAt ?? null,
      reflexCompletedAt: typeof (preflightPayload as Record<string, unknown> | undefined)?.reflexCompletedAt === 'string' ? String((preflightPayload as Record<string, unknown>).reflexCompletedAt) : preflightEvent?.occurredAt ?? null,
      runtimeStartedAt: firstEventAt(attemptEvents, ['runtime_started']),
      firstRuntimeEventAt: firstEventAt(attemptEvents, ['runtime_telemetry']),
      resultCompletedAt: firstEventAt(attemptEvents, ['runtime_completed', 'runtime_failed', 'runtime_cancelled', 'runtime_uncertain']),
    };
    const reflex: TerminalReflexStatus | undefined = preflightPayload && typeof preflightPayload.mode === 'string' && typeof preflightPayload.status === 'string'
      ? {
        mode: preflightPayload.mode as TerminalReflexStatus['mode'],
        status: preflightPayload.status as TerminalReflexStatus['status'],
        latencyMs: typeof preflightPayload.latencyMs === 'number' ? preflightPayload.latencyMs : 0,
        recommendationModelRef: typeof preflightPayload.recommendationModelRef === 'string' ? preflightPayload.recommendationModelRef : null,
        actualRouteModelRef: typeof preflightPayload.actualRouteModelRef === 'string' ? preflightPayload.actualRouteModelRef : null,
        confidence: typeof preflightPayload.confidence === 'number' ? preflightPayload.confidence : null,
        usage: preflightPayload.usage && typeof preflightPayload.usage === 'object' ? preflightPayload.usage as TerminalReflexStatus['usage'] : null,
        cost: preflightPayload.cost && typeof preflightPayload.cost === 'object' && typeof (preflightPayload.cost as Record<string, unknown>).amountUsd === 'number' ? { amountUsd: Number((preflightPayload.cost as Record<string, unknown>).amountUsd), basis: String((preflightPayload.cost as Record<string, unknown>).basis ?? 'unknown') } : null,
        reasonCode: typeof preflightPayload.reasonCode === 'string' ? preflightPayload.reasonCode : null,
        postflightStatus: typeof postflightPayload?.status === 'string' ? postflightPayload.status as TerminalReflexStatus['postflightStatus'] : fallbackEvent ? 'fallback' : null,
      }
      : undefined;
    const reflexPhase: TerminalReflexPhase | undefined = preflightEvent ? 'completed' : fallbackEvent ? 'fallback' : reflexStartedEvent ? 'preflight' : undefined;
    const updatedAt = attempt?.updatedAt ?? assignment?.updatedAt ?? rootRunState?.createdAt ?? null;
    const startedAt = attempt?.createdAt ?? (child?.childCreatedAt ?? null);
    const nowMs = Date.parse(this.now());
    const startMs = startedAt ? Date.parse(startedAt) : NaN;
    const elapsedMs = Number.isFinite(startMs) && Number.isFinite(nowMs) && nowMs >= startMs ? nowMs - startMs : latestTelemetry?.elapsedMs ?? null;
    const status: TerminalExecutionStatus['status'] = !child ? 'queued' : attempt?.status === 'completed' ? 'completed' : attempt?.status === 'failed' ? 'failed' : attempt?.status === 'cancelled' ? 'cancelled' : attempt?.status === 'uncertain' ? 'uncertain' : 'running';
    const persistedRoute = this.storedReflexRoute(rootGoalId);
    const conversationId = this.store.getJarvisConversationIdForRoot(rootGoalId) ?? null;
    const conversationHistory = conversationId ? this.store.listJarvisConversationTurns(conversationId) : [];
    const conversationResult = [...conversationHistory].reverse().find((turn) => turn.speakerRole === 'jarvis' && turn.rootGoalId === rootGoalId);
    return {
      schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION,
      rootGoalId,
      taskId: rootGoalId,
      rootRunId: rootRun,
      status,
      childAgentId: child?.agentId ?? null,
      childTaskId: assignment?.taskId ?? null,
      childRunId: assignment?.runId ?? null,
      attemptId: attempt?.attemptId ?? null,
      resultText: conversationResult?.text ?? receipt?.resultText ?? null,
      resultRef: receipt?.resultHash ?? null,
      evidenceRef: receipt?.evidenceRef ?? null,
      reasonCode: attempt?.status === 'failed' ? 'WORKER_FAILED' : attempt?.status === 'uncertain' ? 'RUNTIME_UNCERTAIN' : null,
      workerCount: workers.length,
      runtimeRef: attempt?.runtimeRef ?? assignment?.runtimeRef ?? persistedRoute?.runtimeRef ?? null,
      runtimeProfileRef: attempt?.runtimeProfileRef ?? assignment?.runtimeProfileRef ?? persistedRoute?.runtimeProfileRef ?? null,
      modelRef: attempt?.modelRef ?? persistedRoute?.modelRef ?? null,
      requestedModel: task?.requestedModel ?? null,
      repositoryRef: task?.repositoryRef ?? null,
      startedAt,
      elapsedMs,
      safeActivity: latestTelemetry?.safeActivity ?? (reflexPhase === 'preflight' ? 'Jev preflight' : status === 'queued' ? 'Auto → evaluating' : status === 'running' ? 'Starting agent' : null),
      lastActivityAt: activity.at(-1)?.occurredAt ?? latestTelemetry?.updatedAt ?? null,
      activity,
      telemetry: latestTelemetry,
      ...(reflex ? { reflex } : {}),
      ...(reflexPhase ? { reflexPhase } : {}),
      phaseTimings,
      updatedAt: attempt?.updatedAt ?? assignment?.updatedAt ?? rootRunState?.createdAt ?? null,
      conversationId,
      conversationHistory,
    };
  }
}

export function createTerminalIntakeService(store: AgentModeSqliteStateStore, repositoryRoots: readonly string[]): AgentModeTerminalIntakeService {
  return new AgentModeTerminalIntakeService(store, { repositoryRoots });
}

export function terminalCommandInput(input: Omit<TerminalIntakeCommandV1, 'schemaVersion'>): TerminalIntakeCommandV1 { return { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, ...input }; }
