import { createHash } from 'node:crypto';
import { JARVIS_AGENT_ID, canonicalJarvisText, deriveJarvisRootGoalId } from './jarvis-text-intake.js';
import { JARVIS_TASK_INPUT_RETENTION_CLASS, JARVIS_TASK_INPUT_SCHEMA_VERSION, deriveJarvisTaskInputContentHash, type JarvisTaskInputV1 } from './jarvis-response-sources.js';
import { admitBrainRequestedModel } from './model-admission-policy.js';
import { JARVIS_CONTEXT_ACTION_RULE, JARVIS_CONTEXT_AUTO_TASK_SPEC_REF, JARVIS_CONTEXT_CONTROLLER_REF, AgentModeDynamicWorkerOrchestrator, type DynamicWorkerOrchestrationResult, type SchedulerEventActionRule } from './dynamic-worker-orchestrator.js';
import { BRAIN_JARVIS_CONTEXT_SOURCE, JARVIS_CONTEXT_READY_EVENT, JARVIS_CONTEXT_SOURCE_ID } from './event-source.js';
import type { AgentRuntime } from './runtime-dispatch.js';
import type { SpawnAuthorityFacts } from './spawn-policy.js';
import { admitJarvisContextSet, deriveJarvisContextSetId, deriveJarvisExpansionId, type JarvisContextAdmissionOptions, type JarvisContextExpansionV1, type JarvisContextRequestV1, type JarvisContextSetV1 } from './jarvis-local-context.js';
import type { AgentModeJarvisIntakeRecord, AgentModeSchedulerClaim, AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { resolveJarvisRuntimeRoute, type JarvisCodexEscalationApproval, type JarvisRuntimeRoute } from './jarvis-runtime-routing.js';
import { canonicalJarvisConversationText, deriveJarvisConversationTurnId, JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, type JarvisConversationTurnV1 } from './jarvis-conversation.js';
import { loadJarvisProductionRuntimeConfiguration, type JarvisProductionRuntimeConfiguration } from './jarvis-production-runtime.js';
import { applyJarvisReflexRoute, persistedJarvisReflexRoute, routeFromK4Assignment } from './jarvis-reflex-route.js';
import { MOCK_AGENT_RUNTIME_REF } from './child-assignment.js';
import type { JarvisSystemOneReflexHook } from './jarvis-system-one-reflex.js';
import { asReflexSkillCandidates, listJarvisSkillCandidates } from './jarvis-skill-context.js';
import { shouldRunReflexPostflight, type ReflexPostflightResult, type TurnDecisionEnvelopeV1 } from './system-one-reflex.js';

export const JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION = 'agent-mode.jarvis-intake.v2' as const;
export const JARVIS_CONTEXT_INTAKE_MAX_CONTEXTS = 32;
export const JARVIS_CONTEXT_GOAL_MAX = 4_000;

export type JarvisContextIntakeCommandV2 = {
  schemaVersion: typeof JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION;
  requestId: string;
  operatorId: string;
  model: string;
  text: string;
  contexts: readonly JarvisContextRequestV1[];
  receivedAt: string;
  conversationId?: string;
  codexEscalation?: JarvisCodexEscalationApproval;
};

export type JarvisContextIntakeReceiptV2 = {
  schemaVersion: typeof JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION;
  status: 'accepted' | 'duplicate';
  intakeId: string;
  rootGoalId: string;
  taskId: string;
  rootRunId: string;
  jarvisAgentId: typeof JARVIS_AGENT_ID;
  contextSetId: string;
  contextIds: readonly string[];
  conversationId?: string;
  createdAt: string;
};

export type JarvisContextIntakeResultV2 =
  | { outcome: 'accepted' | 'duplicate'; receipt: JarvisContextIntakeReceiptV2 }
  | { outcome: 'conflict' | 'denied'; reasonCode: string; contextIndex?: number };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function validText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }

export function deriveJarvisContextIntakeId(requestId: string): string {
  return `intake:jarvis-context:sha256:${digest({ domain: JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION, requestId }).slice(0, 48)}`;
}

export function deriveJarvisContextIntakeMaterialHash(command: JarvisContextIntakeCommandV2): string {
  return digest({ schemaVersion: command.schemaVersion, requestId: command.requestId, operatorId: command.operatorId, model: command.model, codexEscalation: command.codexEscalation ?? null, text: canonicalJarvisText(command.text), contexts: command.contexts });
}

function validate(command: JarvisContextIntakeCommandV2): void {
  if (command.schemaVersion !== JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION || !validText(command.requestId, 128) || !validText(command.operatorId, 128) || !validText(command.model, 64) || !validText(command.text, JARVIS_CONTEXT_GOAL_MAX) || !Array.isArray(command.contexts) || command.contexts.length > JARVIS_CONTEXT_INTAKE_MAX_CONTEXTS || !Number.isFinite(Date.parse(command.receivedAt))) throw new Error('invalid Jarvis context intake command');
  if (!admitBrainRequestedModel(command.model) && !['auto', 'minimax-m2.5', 'glm-5', 'opus-4.6', 'agent-mode/minimax-m2.5', 'agent-mode/glm-5', 'agent-mode/claude-opus-4.6', 'codex', 'codex-cli'].includes(command.model)) throw new Error('model not admitted');
}

function receipt(record: AgentModeJarvisIntakeRecord, contextSet: JarvisContextSetV1, status: 'accepted' | 'duplicate'): JarvisContextIntakeReceiptV2 {
  return { schemaVersion: JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION, status, intakeId: record.intakeId, rootGoalId: record.rootGoalId, taskId: record.taskId, rootRunId: contextRootRunId(record.rootGoalId), jarvisAgentId: JARVIS_AGENT_ID, contextSetId: contextSet.contextSetId, contextIds: contextSet.contexts.map((context) => context.contextId), createdAt: record.createdAt };
}

export class JarvisContextIntakeService {
  private readonly runtimeFactory: ((store: AgentModeSqliteStateStore) => AgentRuntime) | undefined;
  private readonly fixtureRuntimeAvailable: boolean;
  private readonly productionRuntimeAvailable: ReadonlySet<import('./model-gateway.js').AdmittedModelRef> | undefined;
  private readonly productionAutoAdmittedModels: ReadonlySet<import('./model-gateway.js').AdmittedModelRef> | undefined;
  private readonly reflex: JarvisSystemOneReflexHook | undefined;

  constructor(private readonly store: AgentModeSqliteStateStore, private readonly admission: JarvisContextAdmissionOptions, private readonly now: () => string = () => new Date().toISOString(), options: { runtimeFactory?: (store: AgentModeSqliteStateStore) => AgentRuntime; productionRuntime?: JarvisProductionRuntimeConfiguration; reflex?: JarvisSystemOneReflexHook } = {}) {
    const productionRuntime = options.productionRuntime ?? loadJarvisProductionRuntimeConfiguration(this.now());
    this.runtimeFactory = options.runtimeFactory ?? productionRuntime?.runtimeFactory;
    this.fixtureRuntimeAvailable = options.runtimeFactory !== undefined;
    this.productionRuntimeAvailable = productionRuntime?.runtimeAvailableModels ?? productionRuntime?.availableModels;
    this.productionAutoAdmittedModels = productionRuntime?.availableModels;
    this.reflex = options.reflex;
  }

  private route(command: JarvisContextIntakeCommandV2): { route: JarvisRuntimeRoute } | { reasonCode: string } {
    const requestedModel = command.model === 'minimax-m2.5' ? 'agent-mode/minimax-m2.5' : command.model === 'glm-5' ? 'agent-mode/glm-5' : command.model === 'opus-4.6' ? 'agent-mode/claude-opus-4.6' : command.model;
    const resolved = resolveJarvisRuntimeRoute({ requestedModel, requestText: command.text, adaptiveRouting: this.reflex?.mode === 'ACTIVE_PILOT', fixtureRuntimeAvailable: this.fixtureRuntimeAvailable, ...(this.productionRuntimeAvailable ? { productionRuntimeAvailable: this.productionRuntimeAvailable } : {}), ...(command.codexEscalation ? { codexEscalation: command.codexEscalation } : {}) });
    return resolved.ok ? resolved : { reasonCode: resolved.reasonCode };
  }

  private actionRule(route: JarvisRuntimeRoute): SchedulerEventActionRule {
    if (route.source === 'codex-escalation') return JARVIS_CONTEXT_ACTION_RULE;
    return { ...JARVIS_CONTEXT_ACTION_RULE, ruleId: 'agent-mode.action.jarvis-context-auto.v1', taskSpecRef: JARVIS_CONTEXT_AUTO_TASK_SPEC_REF, runtimeRef: route.runtimeRef, runtimeProfileRef: route.runtimeProfileRef, requestedCost: route.runtimeRef === MOCK_AGENT_RUNTIME_REF ? 0 : 0.25, ...(route.modelRef ? { modelRef: route.modelRef } : {}) };
  }

  private deniedExecution(eventId: string, reasonCode: string): DynamicWorkerOrchestrationResult {
    return { result: 'DENIED', eventId, ruleId: null, ruleVersion: null, actionRuleApplicationId: null, schedulerFence: null, spawnIntentKey: null, childAgentId: null, assignmentIntentKey: null, taskId: null, runId: null, attemptId: null, operationId: null, dispatchId: null, terminalWorkerOutcome: null, reasonCode };
  }

  private ensureContextEventSource(registeredAt: string): void {
    this.store.upsertEventSource({ sourceId: JARVIS_CONTEXT_SOURCE_ID, sourceType: BRAIN_JARVIS_CONTEXT_SOURCE, repositoryRef: BRAIN_JARVIS_CONTEXT_SOURCE, adapterType: BRAIN_JARVIS_CONTEXT_SOURCE, debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null, registeredAt });
  }

  accept(command: JarvisContextIntakeCommandV2): JarvisContextIntakeResultV2 {
    try {
      validate(command);
      const selected = this.route(command);
      if ('reasonCode' in selected) return { outcome: 'denied', reasonCode: selected.reasonCode };
      const intakeId = deriveJarvisContextIntakeId(command.requestId);
      const rootGoalId = deriveJarvisRootGoalId(intakeId);
      const conversationId = command.conversationId ?? `conversation:jarvis:${intakeId}`;
      const createdAt = command.receivedAt;
      const admitted = admitJarvisContextSet(rootGoalId, command.contexts, { ...this.admission, now: createdAt }, createdAt);
      if (admitted.result === 'denied') return { outcome: 'denied', reasonCode: admitted.reasonCode, contextIndex: admitted.index };
      const contextSet = admitted.contextSet;
      const canonicalText = canonicalJarvisText(command.text);
      const primaryRepository = contextSet.contexts.length === 1 && contextSet.contexts[0]?.kind === 'repository' ? contextSet.contexts[0] : undefined;
      const record: AgentModeJarvisIntakeRecord = {
        intakeId,
        materialHash: deriveJarvisContextIntakeMaterialHash(command),
        schemaVersion: 1,
        source: 'typed',
        operatorId: command.operatorId,
        canonicalTextHash: digest(canonicalText),
        rootGoalId,
        taskId: rootGoalId,
        jarvisAgentId: JARVIS_AGENT_ID,
        receivedAt: command.receivedAt,
        createdAt,
        repositoryRef: primaryRepository?.repositoryRef ?? null,
        repositoryRoot: primaryRepository?.canonicalPath ?? null,
        requestedModel: command.model,
        conversationId,
        ...(command.codexEscalation ? { codexEscalation: command.codexEscalation } : {}),
      };
      const taskInput: JarvisTaskInputV1 = { schemaVersion: JARVIS_TASK_INPUT_SCHEMA_VERSION, rootGoalId, taskId: rootGoalId, jarvisAgentId: JARVIS_AGENT_ID, source: 'typed', text: canonicalText, contentHash: deriveJarvisTaskInputContentHash(canonicalText), retentionClass: JARVIS_TASK_INPUT_RETENTION_CLASS, createdAt };
      const persisted = this.store.recordJarvisIntake(record, taskInput, contextSet);
      if (persisted.result === 'conflict') return { outcome: 'conflict', reasonCode: 'JARVIS_CONTEXT_INTAKE_CONFLICT' };
      if (persisted.result === 'created') {
        const sequence = this.store.listJarvisConversationTurns(conversationId).length + 1;
        const userTurn: JarvisConversationTurnV1 = { schemaVersion: JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, turnId: deriveJarvisConversationTurnId({ conversationId, sequence, speakerRole: 'user', rootGoalId, text: canonicalText }), conversationId, sequence, speakerRole: 'user', text: canonicalJarvisConversationText(canonicalText), status: 'completed', rootGoalId, taskId: rootGoalId, sourceResultRef: null, createdAt };
        this.store.recordJarvisConversationTurn(userTurn);
      }
      const runId = contextRootRunId(rootGoalId);
      this.store.createRun({ runId, taskId: rootGoalId, agentId: JARVIS_AGENT_ID, createdAt, status: 'active' });
      const jarvis = this.store.getAgent(JARVIS_AGENT_ID);
      if (jarvis) this.store.upsertAgent({ ...jarvis, rootGoalId, depth: 0, repositoryScope: null, resourceScope: contextSet.contextSetId, capabilities: ['repo.read'], status: 'active' });
      this.ensureContextEventSource(createdAt);
      this.store.createSchedulerEvent({ eventId: contextEventId(rootGoalId), eventType: JARVIS_CONTEXT_READY_EVENT, source: JARVIS_CONTEXT_SOURCE_ID, occurredAt: createdAt, receivedAt: createdAt, causationId: persisted.record.intakeId, correlationId: rootGoalId, deduplicationKey: rootGoalId, payloadVersion: 'k4.0', payload: { rootGoalId, taskId: rootGoalId, contextSetId: contextSet.contextSetId, contextIds: contextSet.contexts.map((context) => context.contextId), operatorId: command.operatorId, requestedModel: command.model }, nextEligibleAt: createdAt, deadline: new Date(Date.parse(createdAt) + CONTEXT_TTL_MS).toISOString(), maxAttempts: 3 });
      return { outcome: persisted.result === 'created' ? 'accepted' : 'duplicate', receipt: { ...receipt(persisted.record, contextSet, persisted.result === 'created' ? 'accepted' : 'duplicate'), conversationId } };
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid Jarvis context intake command') return { outcome: 'denied', reasonCode: 'JARVIS_CONTEXT_INTAKE_INVALID' };
      if (error instanceof Error && error.message === 'model not admitted') return { outcome: 'denied', reasonCode: 'MODEL_NOT_ADMITTED' };
      return { outcome: 'denied', reasonCode: 'JARVIS_CONTEXT_INTAKE_UNAVAILABLE' };
    }
  }

  private rootFacts(rootGoalId: string, now: string): SpawnAuthorityFacts | undefined {
    const task = this.store.getTask(rootGoalId);
    const contextSetId = `context-set:${digest({ domain: 'agent-mode.jarvis-context.v1', rootGoalId }).slice(0, 48)}`;
    if (!task) return undefined;
    const existing = this.store.getSpawnRootState(rootGoalId);
    const deadline = existing?.deadline ?? new Date(Date.parse(task.createdAt) + CONTEXT_TTL_MS).toISOString();
    return { now, globalKillSwitchDenied: false, rootKillSwitchDenied: false, authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true }, root: { rootGoalId, depth: existing?.depth ?? 0, activeChildren: existing?.activeChildren ?? 0, totalChildCreations: existing?.totalChildCreations ?? 0, cancellation: existing?.cancellation ?? (task.status === 'cancelled' ? 'cancelled' : 'active'), remainingSteps: existing ? existing.maxAggregateChildSteps - existing.reservedChildSteps : 1_000, remainingBudget: existing ? existing.maxAggregateChildCost - existing.reservedChildCost : 2, deadline, delegableCapabilities: existing?.delegableCapabilities ?? ['repo.read'], repositoryScopes: existing?.repositoryScopes ?? [], resourceScopes: existing?.resourceScopes?.length ? existing.resourceScopes : [contextSetId] }, parent: null };
  }

  async execute(rootGoalId: string, eventId = contextEventId(rootGoalId), schedulerClaim?: AgentModeSchedulerClaim): Promise<DynamicWorkerOrchestrationResult> {
    if (!this.runtimeFactory) throw new Error('Jarvis context execution runtime is not configured');
    const event = this.store.getSchedulerEvent(eventId);
    if (!event) throw new Error('Jarvis context event not found');
    const now = this.now();
    const intake = (event.causationId ? this.store.getJarvisIntake(event.causationId) : undefined)
      ?? this.store.getJarvisIntakeForRootGoal(rootGoalId);
    const route = intake ? this.route({ schemaVersion: JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION, requestId: intake.intakeId, operatorId: intake.operatorId, model: intake.requestedModel ?? 'auto', text: this.store.getJarvisTaskInput(rootGoalId)?.text ?? 'resume', contexts: [], receivedAt: intake.receivedAt, ...(intake.codexEscalation ? { codexEscalation: intake.codexEscalation } : {}) }) : { ok: false as const, reasonCode: 'MODEL_NOT_ADMITTED' as const };
    const existingAssignment = this.store.listChildAssignments().find((assignment) => assignment.sourceEventId === eventId);
    const existingRoute = existingAssignment ? routeFromK4Assignment(existingAssignment) : this.storedReflexRoute(rootGoalId);
    const selectedRoute = 'route' in route ? route.route : undefined;
    const reflexStartedAt = this.reflex && !existingRoute && selectedRoute ? this.now() : undefined;
    if (reflexStartedAt) this.recordReflexStarted(rootGoalId, reflexStartedAt);
    const reflexPreflight = this.reflex && !existingRoute && selectedRoute ? await this.runReflexPreflight(rootGoalId, selectedRoute.modelRef) : undefined;
    const reflexCompletedAt = reflexPreflight ? this.now() : undefined;
    const effectiveRoute = reflexPreflight && selectedRoute
      ? applyJarvisReflexRoute({ requestedModel: intake?.requestedModel ?? 'auto', requestText: this.store.getJarvisTaskInput(rootGoalId)?.text ?? '', currentRoute: selectedRoute, envelope: reflexPreflight, ...(this.productionAutoAdmittedModels ? { availableModels: this.productionAutoAdmittedModels } : this.fixtureRuntimeAvailable ? {} : { availableModels: new Set() }), fixtureRuntimeAvailable: this.fixtureRuntimeAvailable })
      : existingRoute ?? selectedRoute;
    if (!effectiveRoute) return this.deniedExecution(event.eventId, 'MODEL_ROUTE_NOT_ADMITTED');
    if (reflexPreflight) {
      if (reflexPreflight.mode === 'ACTIVE_PILOT' && effectiveRoute) this.recordReflexRoute(rootGoalId, effectiveRoute);
      this.recordReflexPreflight(rootGoalId, { ...reflexPreflight, actualRouteModelRef: effectiveRoute?.modelRef ?? reflexPreflight.actualRouteModelRef }, reflexStartedAt, reflexCompletedAt);
    }
    const actionRules = [this.actionRule(effectiveRoute)];
    const result = await new AgentModeDynamicWorkerOrchestrator({ store: this.store, runtime: this.runtimeFactory(this.store), actionRules, rootFacts: (id, currentNow) => this.rootFacts(id, currentNow), ownerId: 'brain-jarvis-context', controllerRef: JARVIS_CONTEXT_CONTROLLER_REF, now, clock: this.now }).handleSchedulerEvent({ event, ...(schedulerClaim ? { schedulerClaim } : {}), now });
    if (reflexPreflight && this.reflex && shouldRunReflexPostflight(reflexPreflight)) {
      const postflight = await this.runReflexPostflight(reflexPreflight.originalRequestHash, result);
      if (postflight) this.recordReflexPostflight(rootGoalId, postflight);
    }
    if (result.attemptId && ['COMPLETED', 'FAILED'].includes(result.result)) {
      const receiptRecord = this.store.getRuntimeReceiptForAttempt(result.attemptId);
      const conversationId = this.store.getJarvisConversationIdForRoot(rootGoalId);
      if (receiptRecord?.resultText && conversationId && this.store.listJarvisConversationTurns(conversationId).every((turn) => turn.rootGoalId !== rootGoalId || turn.speakerRole !== 'jarvis')) {
        const sequence = this.store.listJarvisConversationTurns(conversationId).length + 1;
        const responseText = canonicalJarvisConversationText(receiptRecord.resultText);
        const response: JarvisConversationTurnV1 = { schemaVersion: JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, turnId: deriveJarvisConversationTurnId({ conversationId, sequence, speakerRole: 'jarvis', rootGoalId, text: responseText }), conversationId, sequence, speakerRole: 'jarvis', text: responseText, status: receiptRecord.status === 'succeeded' ? 'completed' : receiptRecord.status, rootGoalId, taskId: rootGoalId, sourceResultRef: `runtime-receipt:${result.attemptId}:${receiptRecord.resultHash}`, createdAt: this.now() };
        this.store.recordJarvisConversationTurn(response);
      }
    }
    return result;
  }

  private deniedExecution(eventId: string, reasonCode: string): DynamicWorkerOrchestrationResult {
    return { result: 'DENIED', eventId, ruleId: null, ruleVersion: null, actionRuleApplicationId: null, schedulerFence: null, spawnIntentKey: null, childAgentId: null, assignmentIntentKey: null, taskId: null, runId: null, attemptId: null, operationId: null, dispatchId: null, terminalWorkerOutcome: null, reasonCode };
  }

  private storedReflexRoute(rootGoalId: string): JarvisRuntimeRoute | undefined {
    const event = this.store.listEvents(rootGoalId).reverse().find((entry) => entry.eventType === 'jarvis_reflex_route');
    const currentlyAdmittedModels = this.productionAutoAdmittedModels ?? (this.fixtureRuntimeAvailable ? undefined : new Set<import('./model-gateway.js').AdmittedModelRef>());
    return persistedJarvisReflexRoute(event?.payload, currentlyAdmittedModels);
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
        // Keep context identity opaque, but give Jev a bounded semantic label
        // so it can distinguish already-admitted candidates. Never pass paths,
        // contents, permissions, or any other filesystem authority here.
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
    this.store.recordEvent({ eventId, entityType: 'jarvis_intake', entityId: rootGoalId, eventType: 'jarvis_reflex_preflight', occurredAt: completedAt ?? this.now(), payload: {
      schemaVersion: envelope.schemaVersion, mode: envelope.mode, status: envelope.status, latencyMs: envelope.latencyMs, provider: envelope.provider,
      usage: envelope.usage, cost: envelope.cost, recommendationModelRef: envelope.recommendation?.modelRef ?? null,
      actualRouteModelRef: envelope.actualRouteModelRef, confidence: envelope.confidence, reasonCode: envelope.reasonCode,
      selectedContextIds: envelope.contextNeeds.selectedIds, selectedSkillIds: envelope.likelySkills,
      reflexStartedAt: startedAt ?? null, reflexCompletedAt: completedAt ?? null,
    } });
  }

  private recordReflexPostflight(rootGoalId: string, result: ReflexPostflightResult): void {
    const eventId = `jarvis-reflex-postflight:${rootGoalId}:${result.originalRequestHash}`;
    if (this.store.listEvents(rootGoalId).some((event) => event.eventId === eventId)) return;
    this.store.recordEvent({ eventId, entityType: 'jarvis_intake', entityId: rootGoalId, eventType: 'jarvis_reflex_postflight', occurredAt: this.now(), payload: {
      originalRequestHash: result.originalRequestHash, status: result.status, latencyMs: result.latencyMs, usage: result.usage,
      cost: result.cost, confidence: result.confidence, reasonCode: result.reasonCode,
    } });
  }

  private async runReflexPostflight(originalRequestHash: string, result: DynamicWorkerOrchestrationResult): Promise<ReflexPostflightResult | undefined> {
    try {
      return await this.reflex!.postflight({ originalRequestHash, resultFacts: { result: result.result, terminalWorkerOutcome: result.terminalWorkerOutcome, childAgentId: result.childAgentId, taskId: result.taskId, runId: result.runId, attemptId: result.attemptId } });
    } catch {
      // Reflex is advisory; K4's durable result remains authoritative.
      return undefined;
    }
  }

  expand(rootGoalId: string, requests: readonly JarvisContextRequestV1[], reasonCode: string, causationRef: string): { outcome: 'accepted' | 'duplicate' | 'denied'; expansion?: JarvisContextExpansionV1; reasonCode?: string } {
    const createdAt = this.now();
    const admitted = admitJarvisContextSet(rootGoalId, requests.map((request) => ({ ...request, origin: 'expansion' as const })), { ...this.admission, now: createdAt }, createdAt);
    if (admitted.result === 'denied') return { outcome: 'denied', reasonCode: admitted.reasonCode };
    const expansion: JarvisContextExpansionV1 = {
      schemaVersion: 'agent-mode.jarvis-context-expansion.v1',
      expansionId: deriveJarvisExpansionId(rootGoalId, requests, causationRef),
      rootGoalId,
      requestedContexts: requests,
      admittedContextIds: admitted.contextSet.contexts.map((context) => context.contextId),
      reasonCode,
      causationRef,
      materialHash: digest({ rootGoalId, requests, reasonCode, causationRef }),
      createdAt,
    };
    try {
      const result = this.store.recordJarvisContextExpansion(expansion, admitted.contextSet.contexts);
      if (result === 'conflict') return { outcome: 'denied', reasonCode: 'CONTEXT_EXPANSION_CONFLICT' };
      const contextSetId = deriveJarvisContextSetId(rootGoalId);
      this.ensureContextEventSource(createdAt);
      this.store.createSchedulerEvent({ eventId: expansionEventId(expansion.expansionId), eventType: JARVIS_CONTEXT_READY_EVENT, source: JARVIS_CONTEXT_SOURCE_ID, occurredAt: createdAt, receivedAt: createdAt, causationId: expansion.causationRef, correlationId: rootGoalId, deduplicationKey: expansion.expansionId, payloadVersion: 'k4.0', payload: { rootGoalId, taskId: rootGoalId, contextSetId, contextIds: expansion.admittedContextIds, expansionId: expansion.expansionId, reasonCode }, nextEligibleAt: createdAt, deadline: new Date(Date.parse(createdAt) + CONTEXT_TTL_MS).toISOString(), maxAttempts: 3 });
      return { outcome: result === 'created' ? 'accepted' : 'duplicate', expansion };
    } catch {
      return { outcome: 'denied', reasonCode: 'CONTEXT_EXPANSION_UNAVAILABLE' };
    }
  }
}

const CONTEXT_TTL_MS = 10 * 60 * 1000;
function contextRootRunId(rootGoalId: string): string { return `run:jarvis-context:${digest({ domain: 'agent-mode.jarvis-context-root-run.v1', rootGoalId }).slice(0, 48)}`; }
function contextEventId(rootGoalId: string): string { return `event:jarvis-context:${digest(rootGoalId).slice(0, 48)}`; }
function expansionEventId(expansionId: string): string { return `event:jarvis-context-expansion:${digest(expansionId).slice(0, 48)}`; }
