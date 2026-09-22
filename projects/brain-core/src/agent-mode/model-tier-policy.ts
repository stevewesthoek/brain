import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type BedrockRouteKind } from './model-gateway.js';

export const AGENT_MODE_TIER_POLICY_VERSION = 'agent-mode-tier-policy-v2-auto-first';

export function admitManualModelOverride(modelRef: string): { ok: true; policyVersion: string; modelRef: AdmittedModelRef; tier: AgentModeTier } | { ok: false; policyVersion: string; reason: 'unadmitted_model' } {
  if (!(modelRef in AGENT_MODE_MODEL_ROUTES)) return { ok: false, policyVersion: AGENT_MODE_TIER_POLICY_VERSION, reason: 'unadmitted_model' };
  const admitted = modelRef as AdmittedModelRef;
  const tier: AgentModeTier = admitted === 'agent-mode/minimax-m2.5' ? 'worker' : admitted === 'agent-mode/glm-5' ? 'senior' : 'principal';
  return { ok: true, policyVersion: AGENT_MODE_TIER_POLICY_VERSION, modelRef: admitted, tier };
}

export type AgentModeTier = 'worker' | 'senior' | 'principal';
export type AgentModeTaskClass = 'worker' | 'senior' | 'principal';
export type AgentModeSelectionMode = 'auto' | 'manual';
export type AgentModePolicyPhase = 'root' | 'planning' | 'execution';
export type AgentModeHealthState = 'healthy' | 'degraded' | 'unavailable' | 'unknown';
export type AgentModeEscalationReason =
  | 'task_class_requires_senior'
  | 'task_class_requires_principal'
  | 'context_limit'
  | 'output_limit'
  | 'capability_mismatch'
  | 'validated_reasoning_failure'
  | 'repeated_validation_failure'
  | 'principal_review_required'
  | 'max_escalation_depth';

type PricingRecord = {
  inputPerMillionUsd: number | null;
  outputPerMillionUsd: number | null;
  source: string;
  observedAt: string;
  verified: boolean;
};

export const AGENT_MODE_PRICING: Readonly<Record<AdmittedModelRef, PricingRecord>> = {
  'agent-mode/minimax-m2.5': { inputPerMillionUsd: 0.30, outputPerMillionUsd: 1.20, source: 'https://aws.amazon.com/bedrock/pricing/', observedAt: '2026-09-09', verified: true },
  'agent-mode/glm-5': { inputPerMillionUsd: 1.00, outputPerMillionUsd: 3.20, source: 'https://aws.amazon.com/bedrock/pricing/', observedAt: '2026-09-09', verified: true },
  'agent-mode/claude-opus-4.6': { inputPerMillionUsd: null, outputPerMillionUsd: null, source: 'https://aws.amazon.com/bedrock/pricing/', observedAt: '2026-09-09', verified: false },
};

export type RouteEvidence = {
  modelRef: AdmittedModelRef;
  routeKind: BedrockRouteKind;
  routeId: string;
  state: AgentModeHealthState;
  accessState: 'verified' | 'denied' | 'unverified';
  checkedAt: string;
  freshUntil: string;
  evidenceVersion: string;
};

export type PreviousAttempt = {
  tier: AgentModeTier;
  outcome: 'provider_failure' | 'quality_failure' | 'validation_failure' | 'completed';
};

/** A model may suggest escalation, but this value is only an intent signal. */
export type AgentModeEscalationRequest = {
  kind: 'escalation_requested';
  fromTier: AgentModeTier;
  requestedTier: Extract<AgentModeTier, 'senior' | 'principal'>;
  reason: AgentModeEscalationReason;
  source: 'model-untrusted';
};

export type AgentModePolicyInput = {
  taskClass: AgentModeTaskClass;
  requiredContextTokens: number;
  requiredOutputTokens: number;
  requiredCapability?: string;
  budgetScopeId: string;
  rootBudgetScopeId: string;
  parentBudgetScopeId?: string;
  maxDollars: number;
  inputTokens: number;
  outputTokens: number;
  now: string;
  routeEvidence: Readonly<Record<AdmittedModelRef, RouteEvidence>>;
  selectionMode?: AgentModeSelectionMode;
  phase?: AgentModePolicyPhase;
  manualModelRef?: AdmittedModelRef;
  maxEscalationDepth?: number;
  previousAttempt?: PreviousAttempt;
  explicitPrincipalOverride?: { overrideRef: string };
};

export type AgentModePolicyDecision = {
  ok: boolean;
  policyVersion: string;
  modelRef?: AdmittedModelRef;
  route?: { provider: 'amazon-bedrock'; routeKind: BedrockRouteKind; routeId: string; region: 'us-east-1' };
  tier?: AgentModeTier;
  reason: AgentModeEscalationReason | 'initial_selection' | 'route_degraded' | 'cost_unknown' | 'budget_exhausted' | 'evidence_stale' | 'route_unavailable' | 'invalid_scope' | 'unadmitted_model';
  taskClassification: AgentModeTaskClass;
  evidenceVersion?: string;
  estimatedUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  estimatedCostUsd: number | null;
  budgetReservation: { budgetScopeId: string; steps: 1; tokens: number; dollars: number };
  escalationLevel: number;
  escalationCount: number;
  resource: 'amazon-bedrock';
  decidedAt: string;
  explanation: string;
};

/** The principal portfolio is deliberately separate from the future Codex resource. */
export const AGENT_MODE_PRINCIPAL_RESOURCES = {
  opusBedrock: { resource: 'amazon-bedrock', modelRef: 'agent-mode/claude-opus-4.6' as const },
  codexAstra: { resource: 'codex-subscription', availability: 'fixture-only' as const },
} as const;

const TIER_REFS: Readonly<Record<AgentModeTier, AdmittedModelRef>> = {
  worker: 'agent-mode/minimax-m2.5',
  senior: 'agent-mode/glm-5',
  principal: 'agent-mode/claude-opus-4.6',
};

const TIER_ORDER: readonly AgentModeTier[] = ['worker', 'senior', 'principal'];

function invalidInteger(value: number): boolean { return !Number.isSafeInteger(value) || value < 0; }
function fresh(evidence: RouteEvidence, now: string): boolean {
  return Number.isFinite(Date.parse(evidence.checkedAt)) && Number.isFinite(Date.parse(evidence.freshUntil))
    && Date.parse(evidence.checkedAt) <= Date.parse(now) && Date.parse(now) < Date.parse(evidence.freshUntil);
}
export function estimateAgentModeCost(ref: AdmittedModelRef, inputTokens: number, outputTokens: number): number | null {
  const price = AGENT_MODE_PRICING[ref];
  if (!price.verified || price.inputPerMillionUsd === null || price.outputPerMillionUsd === null) return null;
  return Math.round((inputTokens * price.inputPerMillionUsd + outputTokens * price.outputPerMillionUsd)) / 1_000_000;
}
function minimumTier(input: AgentModePolicyInput): AgentModeTier {
  if (input.explicitPrincipalOverride) return 'principal';
  // Auto root/planning admission is always a cheap MiniMax scout. Static task
  // classification can affect later escalation, but never skips the scout.
  if ((input.selectionMode ?? 'auto') === 'auto' && (input.phase ?? 'root') !== 'execution') return 'worker';
  if (input.taskClass === 'principal') return 'principal';
  if (input.taskClass === 'senior') return 'senior';
  return 'worker';
}

export function selectAgentModeModel(input: AgentModePolicyInput): AgentModePolicyDecision {
  const usage = { inputTokens: input.inputTokens, outputTokens: input.outputTokens, totalTokens: input.inputTokens + input.outputTokens };
  const base = { policyVersion: AGENT_MODE_TIER_POLICY_VERSION, taskClassification: input.taskClass, estimatedUsage: usage, estimatedCostUsd: null, budgetReservation: { budgetScopeId: input.budgetScopeId, steps: 1 as const, tokens: usage.totalTokens, dollars: 0 }, escalationLevel: 0, escalationCount: 0, resource: 'amazon-bedrock' as const, decidedAt: input.now };
  if (!input.budgetScopeId || input.budgetScopeId !== input.rootBudgetScopeId || (input.parentBudgetScopeId !== undefined && input.parentBudgetScopeId !== input.rootBudgetScopeId)) return { ...base, ok: false, reason: 'invalid_scope', explanation: 'attempt, escalation, and child admissions must share the root budget scope' };
  if ([input.requiredContextTokens, input.requiredOutputTokens, input.inputTokens, input.outputTokens].some(invalidInteger) || !Number.isFinite(input.maxDollars) || input.maxDollars < 0 || (input.maxEscalationDepth !== undefined && (!Number.isSafeInteger(input.maxEscalationDepth) || input.maxEscalationDepth < 0))) return { ...base, ok: false, reason: 'capability_mismatch', explanation: 'token, escalation, and budget inputs must be bounded non-negative integers' };
  const mode = input.selectionMode ?? (input.manualModelRef ? 'manual' : 'auto');
  const phase = input.phase ?? 'root';
  if (mode === 'manual' && !input.manualModelRef) return { ...base, ok: false, reason: 'unadmitted_model', explanation: 'manual selection requires an admitted model reference' };
  let tier = input.manualModelRef ? (input.manualModelRef === TIER_REFS.worker ? 'worker' : input.manualModelRef === TIER_REFS.senior ? 'senior' : 'principal') : minimumTier(input);
  let reason: AgentModePolicyDecision['reason'] = 'initial_selection';
  let terminalFitReason: 'context_limit' | 'output_limit' = 'context_limit';
  const previous = input.previousAttempt;
  const maxEscalationDepth = input.maxEscalationDepth ?? 2;
  if (mode === 'auto' && previous && previous.outcome !== 'provider_failure' && previous.outcome !== 'completed') {
    if (TIER_ORDER.indexOf(previous.tier) >= maxEscalationDepth) return { ...base, ok: false, tier: previous.tier, reason: 'max_escalation_depth', explanation: 'maximum Brain-owned escalation depth reached; model intent cannot extend the budget' };
    if (previous.tier === 'worker') { tier = 'senior'; reason = previous.outcome === 'validation_failure' ? 'repeated_validation_failure' : 'validated_reasoning_failure'; }
    else if (previous.tier === 'senior') { tier = 'principal'; reason = previous.outcome === 'validation_failure' ? 'repeated_validation_failure' : 'validated_reasoning_failure'; }
  }
  while (TIER_ORDER.indexOf(tier) < TIER_ORDER.length) {
    const ref = TIER_REFS[tier];
    const route = AGENT_MODE_MODEL_ROUTES[ref];
    if (input.requiredContextTokens > route.maxContextTokens) { terminalFitReason = 'context_limit'; if (mode === 'manual' || tier === 'principal') break; tier = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1]!; reason = 'context_limit'; continue; }
    if (input.requiredOutputTokens > route.maxOutputTokens) { terminalFitReason = 'output_limit'; if (mode === 'manual' || tier === 'principal') break; tier = TIER_ORDER[TIER_ORDER.indexOf(tier) + 1]!; reason = 'output_limit'; continue; }
    const evidence = input.routeEvidence[ref];
    if (!evidence || evidence.accessState !== 'verified' || !fresh(evidence, input.now)) return { ...base, ok: false, reason: 'evidence_stale', explanation: 'selection is offline and requires fresh verified K1.1 route evidence' };
    if (evidence.state === 'unavailable' || evidence.state === 'unknown') return { ...base, ok: false, reason: 'route_unavailable', explanation: 'route is unavailable or health evidence is unknown' };
    const admittedRoute = route.routes.find((candidate) => candidate.kind === evidence.routeKind && candidate.id === evidence.routeId);
    if (!admittedRoute) return { ...base, ok: false, modelRef: ref, tier, reason: 'unadmitted_model', explanation: 'route binding is outside the fixed Agent Mode portfolio' };
    if (evidence.state === 'degraded') reason = 'route_degraded';
    const estimatedCostUsd = estimateAgentModeCost(ref, input.inputTokens, input.outputTokens);
    if (estimatedCostUsd === null) return { ...base, ok: false, modelRef: ref, tier, reason: 'cost_unknown', evidenceVersion: evidence.evidenceVersion, explanation: 'automatic dollar admission is denied until current pricing is verified' };
    if (estimatedCostUsd > input.maxDollars) return { ...base, ok: false, modelRef: ref, tier, reason: 'budget_exhausted', estimatedCostUsd, evidenceVersion: evidence.evidenceVersion, explanation: 'estimated cost exceeds the supplied budget' };
    return { ...base, ok: true, modelRef: ref, tier, reason, route: { provider: 'amazon-bedrock', routeKind: evidence.routeKind, routeId: evidence.routeId, region: 'us-east-1' }, evidenceVersion: evidence.evidenceVersion, estimatedCostUsd, budgetReservation: { ...base.budgetReservation, dollars: estimatedCostUsd }, explanation: `deterministically selected ${tier} as the cheapest capable admitted cloud tier` };
  }
  const terminalReason = tier === 'principal' ? terminalFitReason : (reason === 'initial_selection' ? 'capability_mismatch' : reason);
  return { ...base, ok: false, reason: terminalReason, explanation: 'no admitted portfolio tier satisfies the requested fit constraints' };
}

/** Re-admit an execution work package under the normal cheapest-capable ladder. */
export function selectAgentModeExecutionModel(input: AgentModePolicyInput): AgentModePolicyDecision {
  return selectAgentModeModel({ ...input, selectionMode: 'auto', phase: 'execution' });
}

/** Convert an untrusted model suggestion into ordinary Brain-owned evidence. */
export function selectAgentModeAfterEscalationRequest(input: AgentModePolicyInput, request: AgentModeEscalationRequest): AgentModePolicyDecision {
  const outcome: PreviousAttempt['outcome'] = request.reason === 'repeated_validation_failure' ? 'validation_failure' : 'quality_failure';
  return selectAgentModeModel({ ...input, selectionMode: 'auto', previousAttempt: { tier: request.fromTier, outcome } });
}

export type CodexQuotaEvidence = { state: 'available' | 'constrained' | 'exhausted' | 'unknown'; checkedAt: string; freshUntil: string; remainingTokens?: number; manualReserveTokens?: number };
export function admitCodexResource(input: { mode: 'automatic' | 'human_override'; estimatedTokens: number; now: string; evidence: CodexQuotaEvidence; overrideRef?: string }): { ok: boolean; reason: string; resource: 'codex-subscription' } {
  if (!Number.isSafeInteger(input.estimatedTokens) || input.estimatedTokens < 0 || !fresh(input.evidence as RouteEvidence, input.now)) return { ok: false, reason: 'unknown_or_stale_codex_evidence', resource: 'codex-subscription' };
  if (input.mode === 'human_override' && input.overrideRef) return { ok: true, reason: 'bounded_human_override', resource: 'codex-subscription' };
  if (input.evidence.state === 'available') return { ok: true, reason: 'fresh_codex_quota_available', resource: 'codex-subscription' };
  if (input.evidence.state === 'constrained' && input.evidence.remainingTokens !== undefined && input.evidence.manualReserveTokens !== undefined && input.evidence.remainingTokens - input.evidence.manualReserveTokens >= input.estimatedTokens) return { ok: true, reason: 'constrained_quota_honors_manual_reserve', resource: 'codex-subscription' };
  return { ok: false, reason: input.evidence.state === 'exhausted' ? 'codex_quota_exhausted' : 'codex_quota_not_automatically_admitted', resource: 'codex-subscription' };
}
