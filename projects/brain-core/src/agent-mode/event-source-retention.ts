import { createHash } from 'node:crypto';
import {
  AgentModeSqliteStateStore,
  MAX_ACTIVE_EVENT_SOURCE_REGISTRATIONS,
  type AgentModeEventSourceRetirementAssessment,
} from './sqlite-state-store.js';

export const EVENT_SOURCE_RETENTION_PLAN_SCHEMA_VERSION = 'agent-mode.event-source-retention-plan-v1' as const;

export type EventSourceRetentionPlan = {
  schemaVersion: typeof EVENT_SOURCE_RETENTION_PLAN_SCHEMA_VERSION;
  generatedAt: string;
  sourceCountBefore: number;
  activeSourceCountBefore: number;
  assessments: readonly AgentModeEventSourceRetirementAssessment[];
  eligibleSourceIds: readonly string[];
  planDigest: string;
};

export type EventSourceRetentionApplyResult = {
  planDigest: string;
  sourceCountBefore: number;
  activeSourceCountBefore: number;
  sourceCountAfter: number;
  activeSourceCountAfter: number;
  retiredSourceIds: readonly string[];
  alreadyRetiredSourceIds: readonly string[];
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }

function counts(store: AgentModeSqliteStateStore): { sourceCount: number; activeSourceCount: number } {
  const sources = store.listEventSources();
  return { sourceCount: sources.length, activeSourceCount: sources.filter((source) => source.lifecycleState === 'active').length };
}

/**
 * Deterministic, bounded retention planning. The plan is advisory until an
 * explicitly supplied plan is applied to a writable isolated store.
 */
export function planEventSourceRetention(store: AgentModeSqliteStateStore, generatedAt: string): EventSourceRetentionPlan {
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('event source retention timestamp is invalid');
  const before = counts(store);
  const assessments = store.listEventSources()
    .slice(0, MAX_ACTIVE_EVENT_SOURCE_REGISTRATIONS)
    .map((source) => store.assessEventSourceRetirement(source.sourceId, generatedAt));
  const eligibleSourceIds = assessments.filter((assessment) => assessment.eligible).map((assessment) => assessment.sourceId).sort();
  const material = { schemaVersion: EVENT_SOURCE_RETENTION_PLAN_SCHEMA_VERSION, generatedAt, sourceCountBefore: before.sourceCount, activeSourceCountBefore: before.activeSourceCount, assessments, eligibleSourceIds };
  return { ...material, planDigest: `event-source-retention:sha256:${digest(material)}` };
}

/**
 * Applies only the plan's closed set of eligible IDs. The StateStore
 * re-evaluates every source inside one transaction, so a stale plan fails
 * closed without a partial retirement.
 */
export function applyEventSourceRetentionPlan(store: AgentModeSqliteStateStore, plan: EventSourceRetentionPlan, retiredAt: string): EventSourceRetentionApplyResult {
  if (plan.schemaVersion !== EVENT_SOURCE_RETENTION_PLAN_SCHEMA_VERSION || !Number.isFinite(Date.parse(retiredAt)) || plan.eligibleSourceIds.length > MAX_ACTIVE_EVENT_SOURCE_REGISTRATIONS) throw new Error('event source retention plan is invalid');
  const before = counts(store);
  const result = store.retireEventSources(plan.eligibleSourceIds, retiredAt);
  const after = counts(store);
  return { planDigest: plan.planDigest, sourceCountBefore: before.sourceCount, activeSourceCountBefore: before.activeSourceCount, sourceCountAfter: after.sourceCount, activeSourceCountAfter: after.activeSourceCount, retiredSourceIds: result.retiredSourceIds, alreadyRetiredSourceIds: result.alreadyRetiredSourceIds };
}
