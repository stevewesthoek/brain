import { createHash } from 'node:crypto';
import {
  deriveOrganizationExecutionProjection,
  deriveOrganizationResultFacts,
  type OrganizationExecutionProjection,
} from './organization-delegation-orchestrator.js';
import {
  ORGANIZATION_ROLE_INDEPENDENT_AUDITOR,
  type DelegatedResultFact,
  type OrganizationPlan,
} from './organization.js';
import type { AgentModeOrganizationWorkItem, AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const ORGANIZATION_FINALIZATION_SCHEMA_VERSION = 1 as const;
export const MAX_ORGANIZATION_FINAL_EVIDENCE_REFS = 64;

export type OrganizationAggregateStatus = 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'uncertain' | 'not_ready';

export type OrganizationAggregateWorkItem = {
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  childAgentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  terminalStatus: 'succeeded' | 'failed' | 'cancelled' | null;
  resultRef: string | null;
  evidenceRefs: readonly string[];
  settledCost: number;
  dependencyKeys: readonly string[];
};

export type OrganizationAggregation = {
  schemaVersion: typeof ORGANIZATION_FINALIZATION_SCHEMA_VERSION;
  organizationPlanId: string;
  planVersion: 1;
  rootGoalId: string;
  supervisorAgentId: string;
  workItems: readonly OrganizationAggregateWorkItem[];
  totalSettledCost: number;
  auditorWorkItemId: string | null;
  auditorStatus: 'succeeded' | 'failed' | 'cancelled' | 'pending' | 'uncertain' | 'absent' | 'ambiguous';
  aggregateStatus: OrganizationAggregateStatus;
};

export type OrganizationFinalResultStatus = 'succeeded' | 'failed' | 'cancelled' | 'expired';

export type OrganizationFinalWorkItemResult = {
  workItemId: string;
  workItemKey: string;
  organizationRoleId: string;
  terminalStatus: 'succeeded' | 'failed' | 'cancelled' | null;
  resultRef: string | null;
  evidenceRefs: readonly string[];
  settledCost: number;
  dependencyKeys: readonly string[];
  childAgentId: string | null;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
};

export type OrganizationFinalResult = {
  schemaVersion: typeof ORGANIZATION_FINALIZATION_SCHEMA_VERSION;
  organizationFinalResultId: string;
  organizationPlanId: string;
  planVersion: 1;
  rootGoalId: string;
  supervisorAgentId: string;
  status: OrganizationFinalResultStatus;
  auditorWorkItemId: string | null;
  auditorResultRef: string | null;
  workItemResults: readonly OrganizationFinalWorkItemResult[];
  totalSettledCost: number;
  aggregateDigest: string;
  finalizedAt: string;
};

export type OrganizationFinalizationOutcome = 'FINALIZED' | 'ALREADY_FINALIZED' | 'NOT_READY' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNCERTAIN' | 'BLOCKED';

export type OrganizationFinalizationResult = {
  outcome: OrganizationFinalizationOutcome;
  organizationPlanId: string;
  reasonCode: OrganizationFinalizationReasonCode;
  finalResult: OrganizationFinalResult | null;
  aggregation: OrganizationAggregation | null;
};

export type OrganizationFinalizationReasonCode =
  | 'FINALIZED'
  | 'ALREADY_FINALIZED'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_ACTIVE'
  | 'NOT_READY'
  | 'AUDITOR_REQUIRED'
  | 'AUDITOR_AMBIGUOUS'
  | 'RESULT_CONTRACT_UNSATISFIED'
  | 'UNCERTAIN_WORKER'
  | 'ROOT_CANCELLED'
  | 'PLAN_EXPIRED'
  | 'KNOWN_FAILURE'
  | 'FINALIZATION_CONFLICT';

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sorted<T extends { workItemKey: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.workItemKey.localeCompare(b.workItemKey));
}

function terminal(status: string | null): status is 'succeeded' | 'failed' | 'cancelled' {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function workItemCost(store: AgentModeSqliteStateStore, item: AgentModeOrganizationWorkItem): number {
  if (!item.boundChildAgentId) return 0;
  const assignment = store.getChildAssignment(item.boundChildAgentId);
  if (!assignment) return 0;
  const reservation = store.getReservation(assignment.reservationId);
  return reservation?.status === 'settled' ? reservation.settledDollars ?? reservation.dollars : 0;
}

function authoritativeWorkItem(
  store: AgentModeSqliteStateStore,
  item: AgentModeOrganizationWorkItem,
  fact: DelegatedResultFact | undefined,
): OrganizationAggregateWorkItem {
  const assignment = item.boundChildAgentId ? store.getChildAssignment(item.boundChildAgentId) : undefined;
  const attempt = assignment ? store.getAttempt(assignment.attemptId) : undefined;
  const status = fact && terminal(fact.status) ? fact.status : null;
  return {
    workItemId: item.workItemId,
    workItemKey: item.workItemKey,
    organizationRoleId: item.organizationRoleId,
    childAgentId: item.boundChildAgentId,
    taskId: item.boundTaskId,
    runId: assignment?.runId ?? null,
    attemptId: assignment?.attemptId ?? attempt?.attemptId ?? null,
    terminalStatus: status,
    resultRef: fact?.status === 'succeeded' ? fact.resultRef ?? null : null,
    evidenceRefs: fact?.status === 'succeeded' ? [...(fact.evidenceRefs ?? [])].sort() : [],
    settledCost: workItemCost(store, item),
    dependencyKeys: [...item.dependencyKeys].sort(),
  };
}

export function organizationAuditorCandidates(plan: OrganizationPlan): OrganizationPlan['workItems'][number][] {
  const nonAuditorKeys = new Set(plan.workItems.filter((item) => item.organizationRoleId !== ORGANIZATION_ROLE_INDEPENDENT_AUDITOR).map((item) => item.workItemKey));
  return plan.workItems.filter((item) => item.organizationRoleId === ORGANIZATION_ROLE_INDEPENDENT_AUDITOR
    && item.dependencyKeys.length === nonAuditorKeys.size
    && item.dependencyKeys.every((key) => nonAuditorKeys.has(key)));
}

function contractSatisfied(planItem: OrganizationPlan['workItems'][number], aggregate: OrganizationAggregateWorkItem): boolean {
  const contract = planItem.resultContract;
  return aggregate.terminalStatus === contract.requiredStatus
    && (!contract.requireResultRef || typeof aggregate.resultRef === 'string')
    && aggregate.evidenceRefs.length >= contract.minEvidenceRefs
    && aggregate.evidenceRefs.length <= contract.maxEvidenceRefs
    && aggregate.evidenceRefs.length <= 16
    && new Set(aggregate.evidenceRefs).size === aggregate.evidenceRefs.length
    && aggregate.evidenceRefs.every((ref) => /^k4:evidence:[A-Za-z0-9._:/-]{1,255}$/.test(ref))
    && (aggregate.resultRef === null || /^k4:runtime:[A-Za-z0-9._:/-]{1,255}$/.test(aggregate.resultRef));
}

export function organizationAggregationMaterial(aggregation: OrganizationAggregation): string {
  return JSON.stringify({
    schemaVersion: aggregation.schemaVersion,
    organizationPlanId: aggregation.organizationPlanId,
    planVersion: aggregation.planVersion,
    rootGoalId: aggregation.rootGoalId,
    supervisorAgentId: aggregation.supervisorAgentId,
    workItems: sorted(aggregation.workItems).map((item) => ({
      workItemId: item.workItemId,
      workItemKey: item.workItemKey,
      organizationRoleId: item.organizationRoleId,
      childAgentId: item.childAgentId,
      taskId: item.taskId,
      runId: item.runId,
      attemptId: item.attemptId,
      terminalStatus: item.terminalStatus,
      resultRef: item.resultRef,
      evidenceRefs: [...item.evidenceRefs].sort(),
      settledCost: item.settledCost,
      dependencyKeys: [...item.dependencyKeys].sort(),
    })),
    totalSettledCost: aggregation.totalSettledCost,
    auditorWorkItemId: aggregation.auditorWorkItemId,
    auditorStatus: aggregation.auditorStatus,
    aggregateStatus: aggregation.aggregateStatus,
  });
}

export function organizationAggregationDigest(aggregation: OrganizationAggregation): string {
  return digest(organizationAggregationMaterial(aggregation));
}

export function organizationFinalResultMaterial(result: OrganizationFinalResult): string {
  return JSON.stringify({
    schemaVersion: result.schemaVersion,
    organizationFinalResultId: result.organizationFinalResultId,
    organizationPlanId: result.organizationPlanId,
    planVersion: result.planVersion,
    rootGoalId: result.rootGoalId,
    supervisorAgentId: result.supervisorAgentId,
    status: result.status,
    auditorWorkItemId: result.auditorWorkItemId,
    auditorResultRef: result.auditorResultRef,
    workItemResults: sorted(result.workItemResults).map((item) => ({
      workItemId: item.workItemId,
      workItemKey: item.workItemKey,
      organizationRoleId: item.organizationRoleId,
      terminalStatus: item.terminalStatus,
      resultRef: item.resultRef,
      evidenceRefs: [...item.evidenceRefs].sort(),
      settledCost: item.settledCost,
      dependencyKeys: [...item.dependencyKeys].sort(),
      childAgentId: item.childAgentId,
      taskId: item.taskId,
      runId: item.runId,
      attemptId: item.attemptId,
    })),
    totalSettledCost: result.totalSettledCost,
    aggregateDigest: result.aggregateDigest,
  });
}

export function organizationFinalResultId(result: Omit<OrganizationFinalResult, 'organizationFinalResultId' | 'finalizedAt'>): string {
  return `organization-final-result:sha256:${digest(organizationFinalResultMaterial({ ...result, organizationFinalResultId: '', finalizedAt: '' })).slice(0, 64)}`;
}

export function validateOrganizationAggregation(aggregation: OrganizationAggregation, plan: OrganizationPlan): { valid: true } | { valid: false; reasonCode: 'AGGREGATION_INVALID' | 'RESULT_CONTRACT_UNSATISFIED' | 'AUDITOR_REQUIRED' | 'AUDITOR_AMBIGUOUS' } {
  if (aggregation.schemaVersion !== 1 || aggregation.planVersion !== plan.planVersion || aggregation.organizationPlanId !== plan.organizationPlanId || aggregation.rootGoalId !== plan.rootGoalId || aggregation.supervisorAgentId !== plan.supervisorAgentId) return { valid: false, reasonCode: 'AGGREGATION_INVALID' };
  if (aggregation.workItems.length === 0 || aggregation.workItems.length > 16 || !Number.isFinite(aggregation.totalSettledCost) || aggregation.totalSettledCost < 0) return { valid: false, reasonCode: 'AGGREGATION_INVALID' };
  if (aggregation.workItems.length !== plan.workItems.length || new Set(aggregation.workItems.map((item) => item.workItemKey)).size !== aggregation.workItems.length) return { valid: false, reasonCode: 'AGGREGATION_INVALID' };
  const planByKey = new Map(plan.workItems.map((item) => [item.workItemKey, item]));
  let evidenceCount = 0;
  for (const item of aggregation.workItems) {
    const planItem = planByKey.get(item.workItemKey);
    if (!planItem || planItem.workItemId !== item.workItemId || !terminal(item.terminalStatus) || item.evidenceRefs.length > 16) return { valid: false, reasonCode: 'AGGREGATION_INVALID' };
    evidenceCount += item.evidenceRefs.length;
    if (!contractSatisfied(planItem, item)) return { valid: false, reasonCode: 'RESULT_CONTRACT_UNSATISFIED' };
  }
  if (evidenceCount > MAX_ORGANIZATION_FINAL_EVIDENCE_REFS) return { valid: false, reasonCode: 'AGGREGATION_INVALID' };
  const candidates = organizationAuditorCandidates(plan);
  if (candidates.length === 0) return { valid: false, reasonCode: 'AUDITOR_REQUIRED' };
  if (candidates.length !== 1 || aggregation.auditorWorkItemId !== candidates[0]!.workItemId) return { valid: false, reasonCode: 'AUDITOR_AMBIGUOUS' };
  return { valid: true };
}

export function deriveOrganizationAggregation(store: AgentModeSqliteStateStore, plan: OrganizationPlan, now: string): OrganizationAggregation {
  const items = sorted(store.listOrganizationWorkItems(plan.organizationPlanId));
  const facts = deriveOrganizationResultFacts(store, plan);
  const factById = new Map(facts.map((fact) => [fact.workItemId, fact]));
  const workItems = items.map((item) => authoritativeWorkItem(store, item, factById.get(item.workItemId)));
  const projection: OrganizationExecutionProjection = deriveOrganizationExecutionProjection(store, plan, now);
  const candidates = organizationAuditorCandidates(plan);
  const auditor = candidates.length === 1 ? workItems.find((item) => item.workItemId === candidates[0]!.workItemId) : undefined;
  const auditorStatus = candidates.length === 0 ? 'absent' : candidates.length > 1 ? 'ambiguous' : projection.uncertainCount > 0 && auditor?.childAgentId ? 'uncertain' : auditor?.terminalStatus ?? 'pending';
  const planReadiness = store.readOrganizationPlanReadiness(plan.organizationPlanId, now, facts);
  const expired = plan.status === 'expired' || planReadiness?.planState === 'expired' || Date.parse(now) >= Date.parse(plan.deadline);
  const cancelled = plan.status === 'cancelled' || planReadiness?.planState === 'cancelled';
  const contractFailure = workItems.some((item) => {
    const planItem = plan.workItems.find((candidate) => candidate.workItemKey === item.workItemKey);
    return terminal(item.terminalStatus) && planItem !== undefined && !contractSatisfied(planItem, item);
  });
  const hasUncertainty = projection.uncertainCount > 0;
  const knownFailure = workItems.some((item) => item.terminalStatus === 'failed' || item.terminalStatus === 'cancelled') || projection.dependencyFailedCount > 0 || contractFailure;
  const allTerminal = projection.terminal;
  const aggregateStatus: OrganizationAggregateStatus = expired ? 'expired'
    : cancelled ? 'cancelled'
      : hasUncertainty ? 'uncertain'
        : knownFailure && allTerminal ? 'failed'
          : !contractFailure && candidates.length === 1 && workItems.length === plan.workItems.length && workItems.every((item) => item.terminalStatus === 'succeeded' && contractSatisfied(plan.workItems.find((candidate) => candidate.workItemKey === item.workItemKey)!, item)) ? 'succeeded'
            : 'not_ready';
  return {
    schemaVersion: 1,
    organizationPlanId: plan.organizationPlanId,
    planVersion: plan.planVersion,
    rootGoalId: plan.rootGoalId,
    supervisorAgentId: plan.supervisorAgentId,
    workItems,
    totalSettledCost: workItems.reduce((total, item) => total + item.settledCost, 0),
    auditorWorkItemId: candidates.length === 1 ? candidates[0]!.workItemId : null,
    auditorStatus,
    aggregateStatus,
  };
}

export function organizationFinalResultFromAggregation(aggregation: OrganizationAggregation, finalizedAt: string): OrganizationFinalResult {
  const resultWithoutId = {
    schemaVersion: 1 as const,
    organizationPlanId: aggregation.organizationPlanId,
    planVersion: aggregation.planVersion,
    rootGoalId: aggregation.rootGoalId,
    supervisorAgentId: aggregation.supervisorAgentId,
    status: aggregation.aggregateStatus as OrganizationFinalResultStatus,
    auditorWorkItemId: aggregation.auditorWorkItemId,
    auditorResultRef: aggregation.workItems.find((item) => item.workItemId === aggregation.auditorWorkItemId)?.resultRef ?? null,
    workItemResults: aggregation.workItems.map((item) => ({ ...item, evidenceRefs: [...item.evidenceRefs], dependencyKeys: [...item.dependencyKeys] })),
    totalSettledCost: aggregation.totalSettledCost,
    aggregateDigest: organizationAggregationDigest(aggregation),
  } satisfies Omit<OrganizationFinalResult, 'organizationFinalResultId' | 'finalizedAt'>;
  return { ...resultWithoutId, organizationFinalResultId: organizationFinalResultId(resultWithoutId), finalizedAt };
}

export class AgentModeOrganizationFinalizer {
  constructor(private readonly store: AgentModeSqliteStateStore, private readonly clock: () => string = () => new Date().toISOString()) {}

  finalizeOrganizationPlanOnce(input: { organizationPlanId: string; now?: string }): OrganizationFinalizationResult {
    const now = input.now ?? this.clock();
    const plan = this.store.getOrganizationPlan(input.organizationPlanId);
    if (!plan) return { outcome: 'BLOCKED', organizationPlanId: input.organizationPlanId, reasonCode: 'PLAN_NOT_FOUND', finalResult: null, aggregation: null };
    const existing = this.store.getOrganizationFinalResult(plan.organizationPlanId);
    if (existing) return { outcome: 'ALREADY_FINALIZED', organizationPlanId: plan.organizationPlanId, reasonCode: 'ALREADY_FINALIZED', finalResult: existing, aggregation: null };
    const aggregation = deriveOrganizationAggregation(this.store, plan, now);
    if (aggregation.aggregateStatus === 'uncertain') return { outcome: 'UNCERTAIN', organizationPlanId: plan.organizationPlanId, reasonCode: 'UNCERTAIN_WORKER', finalResult: null, aggregation };
    if (aggregation.aggregateStatus === 'cancelled') {
      const result = organizationFinalResultFromAggregation(aggregation, now);
      const persisted = this.store.finalizeOrganizationPlan(result);
      return persisted.result === 'created' ? { outcome: 'CANCELLED', organizationPlanId: plan.organizationPlanId, reasonCode: 'ROOT_CANCELLED', finalResult: result, aggregation } : { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'FINALIZATION_CONFLICT', finalResult: null, aggregation };
    }
    if (aggregation.aggregateStatus === 'expired') {
      const result = organizationFinalResultFromAggregation(aggregation, now);
      const persisted = this.store.finalizeOrganizationPlan(result);
      return persisted.result === 'created' ? { outcome: 'EXPIRED', organizationPlanId: plan.organizationPlanId, reasonCode: 'PLAN_EXPIRED', finalResult: result, aggregation } : { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'FINALIZATION_CONFLICT', finalResult: null, aggregation };
    }
    if (plan.status !== 'active') return { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'PLAN_NOT_ACTIVE', finalResult: null, aggregation };
    const candidates = organizationAuditorCandidates(plan);
    if (candidates.length === 0) return { outcome: 'NOT_READY', organizationPlanId: plan.organizationPlanId, reasonCode: 'AUDITOR_REQUIRED', finalResult: null, aggregation };
    if (candidates.length !== 1) return { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'AUDITOR_AMBIGUOUS', finalResult: null, aggregation };
    if (aggregation.aggregateStatus === 'failed') {
      const result = organizationFinalResultFromAggregation(aggregation, now);
      const persisted = this.store.finalizeOrganizationPlan(result);
      if (persisted.result === 'created') return { outcome: 'FAILED', organizationPlanId: plan.organizationPlanId, reasonCode: 'KNOWN_FAILURE', finalResult: result, aggregation };
      if (persisted.result === 'duplicate') return { outcome: 'ALREADY_FINALIZED', organizationPlanId: plan.organizationPlanId, reasonCode: 'ALREADY_FINALIZED', finalResult: persisted.finalResult, aggregation };
      return { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'FINALIZATION_CONFLICT', finalResult: null, aggregation };
    }
    if (aggregation.aggregateStatus === 'not_ready') return { outcome: 'NOT_READY', organizationPlanId: plan.organizationPlanId, reasonCode: 'NOT_READY', finalResult: null, aggregation };
    const validation = validateOrganizationAggregation(aggregation, plan);
    if (!validation.valid) return { outcome: 'FAILED', organizationPlanId: plan.organizationPlanId, reasonCode: validation.reasonCode === 'RESULT_CONTRACT_UNSATISFIED' ? 'RESULT_CONTRACT_UNSATISFIED' : 'NOT_READY', finalResult: null, aggregation };
    const result = organizationFinalResultFromAggregation(aggregation, now);
    const persisted = this.store.finalizeOrganizationPlan(result);
    if (persisted.result === 'created') return { outcome: result.status === 'succeeded' ? 'FINALIZED' : 'FAILED', organizationPlanId: plan.organizationPlanId, reasonCode: 'FINALIZED', finalResult: result, aggregation };
    if (persisted.result === 'duplicate') return { outcome: 'ALREADY_FINALIZED', organizationPlanId: plan.organizationPlanId, reasonCode: 'ALREADY_FINALIZED', finalResult: this.store.getOrganizationFinalResult(plan.organizationPlanId) ?? result, aggregation };
    return { outcome: 'BLOCKED', organizationPlanId: plan.organizationPlanId, reasonCode: 'FINALIZATION_CONFLICT', finalResult: null, aggregation };
  }
}
