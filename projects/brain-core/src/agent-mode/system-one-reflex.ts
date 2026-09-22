import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { classifyJarvisTurn, type JarvisTurnComplexity } from './jarvis-runtime-routing.js';

const execFileAsync = promisify(execFile);

export const SYSTEM_ONE_REFLEX_SCHEMA_VERSION = 'brain.system-one.turn-decision.v1' as const;
export const SYSTEM_ONE_REFLEX_MODES = ['OFF', 'SHADOW', 'ACTIVE_PILOT'] as const;
export type SystemOneReflexMode = (typeof SYSTEM_ONE_REFLEX_MODES)[number];

export type ReflexCandidate = {
  id: string;
  label?: string;
};

export type ReflexRuntimeFacts = {
  available: readonly string[];
  policyVersion: string;
};

export type TurnDecisionEnvelopeV1 = {
  schemaVersion: typeof SYSTEM_ONE_REFLEX_SCHEMA_VERSION;
  mode: SystemOneReflexMode;
  status: 'off' | 'recommendation' | 'fallback';
  originalRequestHash: string;
  intent: string | null;
  interactionMode: string | null;
  complexity: string | null;
  clarificationNeed: string | null;
  requiredCapabilities: readonly string[];
  likelySkills: readonly string[];
  contextNeeds: {
    candidateCount: number;
    selectedIds: readonly string[];
  };
  deepReasoningNeed: string | null;
  expensiveModelNeed: string | null;
  candidateModelScores: readonly { modelRef: string; score: number }[];
  riskSignals: readonly string[];
  verificationNeed: string | null;
  confidence: number | null;
  decisionConfidences?: { model: number | null; skill: number | null; context: number | null };
  provider: { providerId: string; model: string } | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  cost: { amountUsd: number; basis: 'provider_reported' | 'token_calculated' | 'conservative_projection' } | null;
  recommendation: {
    modelRef: string | null;
    skillIds: readonly string[];
    contextIds: readonly string[];
  } | null;
  actualRouteModelRef: string | null;
  reasonCode: string | null;
};

export type ReflexDecisionAnswer = {
  type: 'choice' | 'noul' | 'score';
  choice?: string;
  confidence?: number;
  probabilities?: Readonly<Record<string, number>>;
  noul?: number;
  score?: number;
};

export type ReflexDecisionResponse = {
  ok: true;
  model: string;
  answers?: Readonly<Record<string, ReflexDecisionAnswer>>;
  answer?: ReflexDecisionAnswer;
  usage?: { input_tokens: number; output_tokens: number };
  cost?: { amountUsd: number; basis: 'provider_reported' | 'token_calculated' | 'conservative_projection' };
} | { ok: false; reasonCode: string };

export type ReflexDecisionRequest = {
  state: Readonly<Record<string, unknown>>;
  questions: Readonly<Record<string, { type: 'choice'; instructions: string; options: readonly string[] }>>;
};

export type ReflexDecisionClient = (request: ReflexDecisionRequest, surface: 'brain') => Promise<ReflexDecisionResponse>;

export type JevBridgeDecisionClientOptions = {
  bridgePath: string;
  nodePath?: string;
  timeoutMs?: number;
};

export type SystemOneReflexInput = {
  userRequest: string;
  requestedModel?: string;
  sessionSummary?: string;
  candidateModels: readonly ReflexCandidate[];
  candidateSkills: readonly ReflexCandidate[];
  candidateContexts: readonly ReflexCandidate[];
  runtimeFacts: ReflexRuntimeFacts;
  actualRouteModelRef?: string;
  mode: SystemOneReflexMode;
};

export type ReflexEligibilityDecision = {
  eligible: boolean;
  reasonCode: 'REFLEX_ELIGIBLE' | 'REFLEX_SKIPPED_EXPLICIT_ROUTE' | 'REFLEX_SKIPPED_SIMPLE_TURN' | 'REFLEX_SKIPPED_SINGLE_ROUTE' | 'REFLEX_SKIPPED_NO_VALUE_SIGNAL';
  complexity: JarvisTurnComplexity;
  signals: readonly string[];
};

export type ReflexPostflightInput = {
  originalRequestHash: string;
  resultFacts: Readonly<Record<string, unknown>>;
  mode: SystemOneReflexMode;
};

export type ReflexPostflightResult = {
  status: 'off' | 'verified' | 'escalation_advised' | 'fallback';
  originalRequestHash: string;
  confidence: number | null;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  cost: TurnDecisionEnvelopeV1['cost'];
  reasonCode: string | null;
};

export type ReflexReplayTurn = {
  input: SystemOneReflexInput;
  actualModelRef: string | null;
  actualContextCount: number;
  downstreamInputTokens: number;
  baselineDownstreamInputTokens: number;
  downstreamCostUsd?: number;
  baselineDownstreamCostUsd?: number;
  baselineSkillTokens?: number;
  pilotSkillTokens?: number;
};

export type ReflexReplaySummary = {
  sampleCount: number;
  routingAgreement: number;
  contextReduction: number;
  baselineDownstreamTokens: number;
  pilotDownstreamTokens: number;
  downstreamTokenReductionPercent: number;
  baselineDownstreamCostUsd: number;
  pilotDownstreamCostUsd: number;
  netValueUsd: number;
  netValuePositive: boolean;
  baselineSkillTokens: number;
  pilotSkillTokens: number;
  skillTokenReductionPercent: number;
  jevTokens: number;
  jevSpendUsd: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
};

const MAX_TEXT = 1_200;
const MAX_SESSION_SUMMARY = 480;
const MAX_CANDIDATES = 8;
const CONFIDENCE_FLOOR = 0.6;
const MODEL_ECONOMIC_ORDER: Readonly<Record<string, number>> = {
  'agent-mode/minimax-m2.5': 0,
  'agent-mode/glm-5': 1,
  'agent-mode/claude-opus-4.6': 2,
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function boundedText(value: string | undefined, fallback: string, max = MAX_TEXT): string { return (value ?? fallback).trim().replace(/\s+/gu, ' ').slice(0, max); }
function uniqueCandidates(candidates: readonly ReflexCandidate[]): ReflexCandidate[] {
  return [...new Map(candidates.filter((candidate) => /^[a-zA-Z][a-zA-Z0-9._:/-]{0,127}$/u.test(candidate.id)).map((candidate) => [candidate.id, { id: candidate.id, ...(candidate.label ? { label: boundedText(candidate.label, candidate.id).slice(0, 128) } : {}) }])).values()].slice(0, MAX_CANDIDATES);
}
function candidateLabels(candidates: readonly ReflexCandidate[]): Readonly<Record<string, string>> {
  return Object.fromEntries(uniqueCandidates(candidates).filter((candidate) => candidate.label && candidate.label !== candidate.id).map((candidate) => [candidate.id, candidate.label as string]));
}
function options(candidates: readonly ReflexCandidate[]): string[] {
  const ids = uniqueCandidates(candidates).map((candidate) => candidate.id);
  return ids.length > 0 ? [...ids, ...(ids.includes('none') ? [] : ['none'])] : ['none', 'review'];
}
function choice(instructions: string, candidates: readonly ReflexCandidate[]) {
  return { type: 'choice' as const, instructions, options: options(candidates) };
}
function answerFor(answers: Readonly<Record<string, ReflexDecisionAnswer>> | undefined, id: string, fallback: ReflexDecisionAnswer | undefined): ReflexDecisionAnswer | undefined {
  return answers?.[id] ?? fallback;
}
function confidenceOf(answer: ReflexDecisionAnswer | undefined): number | null {
  return typeof answer?.confidence === 'number' && Number.isFinite(answer.confidence) && answer.confidence >= 0 && answer.confidence <= 1 ? answer.confidence : null;
}
function choiceOf(answer: ReflexDecisionAnswer | undefined): string | null { return answer?.type === 'choice' && typeof answer.choice === 'string' ? answer.choice : null; }
function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentileValue))] ?? 0;
}

/**
 * Jev is an economic optimizer, not a mandatory hop. Keep the bypass rule
 * deterministic and conservative: simple/high-confidence turns and turns with
 * only one admitted route do not spend a reflex call. More complex turns are
 * eligible when Jev has a real choice to make or a bounded context/skill set
 * to reduce.
 */
export function deriveReflexEligibility(input: Pick<SystemOneReflexInput, 'userRequest' | 'requestedModel' | 'candidateModels' | 'candidateSkills' | 'candidateContexts' | 'actualRouteModelRef'>): ReflexEligibilityDecision {
  if (input.requestedModel && input.requestedModel !== 'auto') return { eligible: false, reasonCode: 'REFLEX_SKIPPED_EXPLICIT_ROUTE', complexity: classifyJarvisTurn(input.userRequest), signals: ['explicit-route'] };
  const complexity = classifyJarvisTurn(input.userRequest);
  if (complexity === 'simple') return { eligible: false, reasonCode: 'REFLEX_SKIPPED_SIMPLE_TURN', complexity, signals: ['simple-turn'] };
  const modelCount = uniqueCandidates(input.candidateModels).filter((candidate) => !/codex|gpt/iu.test(candidate.id)).length;
  const skillCount = uniqueCandidates(input.candidateSkills).length;
  const contextCount = uniqueCandidates(input.candidateContexts).length;
  const currentRoute = input.actualRouteModelRef;
  const currentRouteOrder = currentRoute ? MODEL_ECONOMIC_ORDER[currentRoute] : undefined;
  const hasCheaperAdmittedModel = currentRouteOrder === undefined || uniqueCandidates(input.candidateModels)
    .some((candidate) => {
      const candidateOrder = MODEL_ECONOMIC_ORDER[candidate.id];
      return !/codex|gpt/iu.test(candidate.id) && candidateOrder !== undefined && currentRouteOrder !== undefined && candidateOrder < currentRouteOrder;
    });
  // A request that explicitly compares or combines every admitted context has
  // no safe context-reduction opportunity. Running Jev there would add cost
  // while the downstream contract still requires the full set.
  const requestsAllContexts = /\b(?:compare|comparison|between|both|each|all|differences?)\b/iu.test(input.userRequest);
  const contextReductionOpportunity = contextCount > 1 && !requestsAllContexts;
  const complexityReductionOpportunity = complexity === 'complex' && (hasCheaperAdmittedModel || contextReductionOpportunity || skillCount > 1 || input.userRequest.trim().length > 1_200);
  const signals = [
    ...(modelCount > 1 && hasCheaperAdmittedModel ? ['multiple-admitted-models'] : []),
    ...(modelCount > 1 && !hasCheaperAdmittedModel ? ['no-cheaper-admitted-model'] : []),
    ...(skillCount > 1 ? ['multiple-authorized-skills'] : []),
    ...(contextReductionOpportunity ? ['multiple-admitted-contexts'] : []),
    ...(complexity === 'unknown' ? ['uncertain-complexity'] : []),
    ...(complexityReductionOpportunity ? ['complexity'] : []),
    ...(input.userRequest.trim().length > 1_200 ? ['large-turn'] : []),
  ];
  if (skillCount === 0 && contextCount <= 1 && complexity !== 'complex' && complexity !== 'unknown' && modelCount <= 1) {
    return { eligible: false, reasonCode: 'REFLEX_SKIPPED_SINGLE_ROUTE', complexity, signals: ['single-route', 'no-reduction-opportunity'] };
  }
  if (skillCount === 0 && !contextReductionOpportunity && complexity !== 'unknown' && modelCount > 1 && !hasCheaperAdmittedModel && !complexityReductionOpportunity) {
    return { eligible: false, reasonCode: 'REFLEX_SKIPPED_NO_VALUE_SIGNAL', complexity, signals: ['no-cheaper-admitted-model', 'no-reduction-opportunity'] };
  }
  if (signals.length === 0) return { eligible: false, reasonCode: 'REFLEX_SKIPPED_NO_VALUE_SIGNAL', complexity, signals: [] };
  return { eligible: true, reasonCode: 'REFLEX_ELIGIBLE', complexity, signals };
}

export function shouldRunReflexPostflight(envelope: Pick<TurnDecisionEnvelopeV1, 'mode' | 'status' | 'complexity' | 'verificationNeed' | 'reasonCode'>): boolean {
  if (envelope.mode === 'OFF' || envelope.status !== 'recommendation') return false;
  if (envelope.reasonCode?.startsWith('REFLEX_SKIPPED_')) return false;
  return envelope.complexity === 'complex' || envelope.verificationNeed === 'recommended' || envelope.verificationNeed === 'required';
}

/**
 * Brain Core's optional process boundary to the Brain Jev bridge. The bridge
 * owns Keychain access, TypeSafe SDK access, and the global ledger; this
 * adapter receives only the bounded response envelope.
 */
export function createJevBridgeDecisionClient(options: JevBridgeDecisionClientOptions): ReflexDecisionClient {
  return async (request) => {
    try {
      const result = await execFileAsync(options.nodePath ?? process.execPath, [options.bridgePath, 'jev', 'decide', '--surface', 'brain', '--request-json', JSON.stringify(request)], { cwd: '/', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME ?? '', USER: process.env.USER ?? '' }, encoding: 'utf8', maxBuffer: 128 * 1024, timeout: options.timeoutMs ?? 120_000 });
      const payload: unknown = JSON.parse(String(result.stdout).trim());
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, reasonCode: 'REFLEX_INVALID_BRIDGE_RESPONSE' };
      const record = payload as Record<string, unknown>;
      if (record.ok !== true || typeof record.model !== 'string') return { ok: false, reasonCode: typeof record.reasonCode === 'string' ? record.reasonCode.slice(0, 96) : 'REFLEX_BRIDGE_FAILED' };
      return {
        ok: true,
        model: record.model,
        ...(record.answers && typeof record.answers === 'object' && !Array.isArray(record.answers) ? { answers: record.answers as Readonly<Record<string, ReflexDecisionAnswer>> } : {}),
        ...(record.answer && typeof record.answer === 'object' && !Array.isArray(record.answer) ? { answer: record.answer as ReflexDecisionAnswer } : {}),
        ...(record.usage && typeof record.usage === 'object' && !Array.isArray(record.usage) ? { usage: record.usage as { input_tokens: number; output_tokens: number } } : {}),
        ...(record.cost && typeof record.cost === 'object' && !Array.isArray(record.cost) ? { cost: record.cost as { amountUsd: number; basis: 'provider_reported' | 'token_calculated' | 'conservative_projection' } } : {}),
      };
    } catch {
      return { ok: false, reasonCode: 'REFLEX_BRIDGE_UNAVAILABLE' };
    }
  };
}

export function normalizeSystemOneReflexMode(value: unknown): SystemOneReflexMode {
  return typeof value === 'string' && (SYSTEM_ONE_REFLEX_MODES as readonly string[]).includes(value) ? value as SystemOneReflexMode : 'OFF';
}

export function buildReflexDecisionRequest(input: SystemOneReflexInput): ReflexDecisionRequest {
  const models = uniqueCandidates(input.candidateModels).filter((candidate) => !/codex|gpt/iu.test(candidate.id));
  const skills = uniqueCandidates(input.candidateSkills);
  const contexts = uniqueCandidates(input.candidateContexts);
  return {
    state: {
      task: boundedText(input.userRequest, 'bounded Jarvis turn'),
      sessionSummary: boundedText(input.sessionSummary, 'no session summary', MAX_SESSION_SUMMARY),
      candidates: {
        models: models.map((candidate) => candidate.id),
        skills: skills.map((candidate) => candidate.id),
        contexts: contexts.map((candidate) => candidate.id),
      },
      candidateLabels: {
        models: candidateLabels(models),
        skills: candidateLabels(skills),
        contexts: candidateLabels(contexts),
      },
      runtime: { available: input.runtimeFacts.available.slice(0, MAX_CANDIDATES), policyVersion: input.runtimeFacts.policyVersion },
    },
    questions: {
      intent: choice('Classify the user intent without rewriting the original request.', [{ id: 'answer' }, { id: 'task' }, { id: 'status' }, { id: 'routing' }]),
      interaction_mode: choice('Choose the smallest interaction mode that fits.', [{ id: 'direct' }, { id: 'task' }, { id: 'review' }, { id: 'clarify' }]),
      complexity: choice('Estimate bounded task complexity.', [{ id: 'simple' }, { id: 'moderate' }, { id: 'complex' }]),
      clarification_need: choice('Is clarification required before Brain can proceed?', [{ id: 'none' }, { id: 'possible' }, { id: 'required' }]),
      deep_reasoning_need: choice('Is deep reasoning required after deterministic policy checks?', [{ id: 'none' }, { id: 'possible' }, { id: 'required' }]),
      expensive_model_need: choice('Is an expensive admitted model likely required?', [{ id: 'none' }, { id: 'possible' }, { id: 'required' }]),
      verification_need: choice('Is explicit postflight verification warranted?', [{ id: 'none' }, { id: 'recommended' }, { id: 'required' }]),
      capability_hint: choice('Annotate a capability need; this is not an authority grant.', [{ id: 'repo.read' }, { id: 'network' }, { id: 'none' }]),
      risk_signal: choice('Annotate a bounded risk signal for Brain policy review.', [{ id: 'none' }, { id: 'ambiguity' }, { id: 'external-side-effect' }, { id: 'sensitive' }]),
      ...(models.length > 1 ? { model_candidate: choice('Select one already-admitted model candidate, or none.', models) } : {}),
      ...(skills.length > 1 ? { skill_candidate: choice('Select one already-authorized skill candidate, or none.', skills) } : {}),
      ...(contexts.length > 1 ? { context_candidate: choice('Select one already-authorized context candidate, or none.', contexts) } : {}),
    },
  };
}

function fallbackEnvelope(input: SystemOneReflexInput, startedAt: number, reasonCode: string): TurnDecisionEnvelopeV1 {
  return {
    schemaVersion: SYSTEM_ONE_REFLEX_SCHEMA_VERSION,
    mode: input.mode,
    status: input.mode === 'OFF' ? 'off' : 'fallback',
    originalRequestHash: digest(input.userRequest),
    intent: null,
    interactionMode: null,
    complexity: null,
    clarificationNeed: null,
    requiredCapabilities: [],
    likelySkills: [],
    contextNeeds: { candidateCount: uniqueCandidates(input.candidateContexts).length, selectedIds: [] },
    deepReasoningNeed: null,
    expensiveModelNeed: null,
    candidateModelScores: [],
    riskSignals: [],
    verificationNeed: null,
    confidence: null,
    provider: null,
    usage: null,
    latencyMs: Math.max(0, Date.now() - startedAt),
    cost: null,
    recommendation: null,
    actualRouteModelRef: input.actualRouteModelRef ?? null,
    reasonCode,
  };
}

export async function runSystemOnePreflight(input: SystemOneReflexInput, client?: ReflexDecisionClient): Promise<TurnDecisionEnvelopeV1> {
  const startedAt = Date.now();
  if (input.mode === 'OFF') return fallbackEnvelope(input, startedAt, 'REFLEX_DISABLED');
  const eligibility = deriveReflexEligibility(input);
  if (!eligibility.eligible) return fallbackEnvelope(input, startedAt, eligibility.reasonCode);
  if (!client) return fallbackEnvelope(input, startedAt, 'REFLEX_CLIENT_UNAVAILABLE');
  const request = buildReflexDecisionRequest(input);
  let response: ReflexDecisionResponse;
  try { response = await client(request, 'brain'); } catch { return fallbackEnvelope(input, startedAt, 'REFLEX_PROVIDER_UNAVAILABLE'); }
  if (!response.ok) return fallbackEnvelope(input, startedAt, response.reasonCode.length <= 96 ? response.reasonCode : 'REFLEX_REQUEST_FAILED');
  const answers = response.answers;
  const intent = choiceOf(answerFor(answers, 'intent', response.answer));
  const modelAnswer = answerFor(answers, 'model_candidate', undefined);
  const selectedModel = choiceOf(modelAnswer);
  const admittedModels = uniqueCandidates(input.candidateModels).filter((candidate) => !/codex|gpt/iu.test(candidate.id));
  const selectedModelIsAdmitted = selectedModel !== null && selectedModel !== 'none' && admittedModels.some((candidate) => candidate.id === selectedModel);
  const skill = choiceOf(answerFor(answers, 'skill_candidate', undefined));
  const context = choiceOf(answerFor(answers, 'context_candidate', undefined));
  const modelConfidence = confidenceOf(modelAnswer);
  const skillConfidence = confidenceOf(answerFor(answers, 'skill_candidate', undefined));
  const contextConfidence = confidenceOf(answerFor(answers, 'context_candidate', undefined));
  const authorizedSkills = uniqueCandidates(input.candidateSkills);
  const authorizedContexts = uniqueCandidates(input.candidateContexts);
  const selectedSkills = skill && skill !== 'none' && authorizedSkills.some((candidate) => candidate.id === skill) ? [skill] : [];
  const selectedContexts = context && context !== 'none' && authorizedContexts.some((candidate) => candidate.id === context) ? [context] : [];
  const contextSelectionSafe = selectedContexts.length > 0 && contextConfidence !== null && contextConfidence >= CONFIDENCE_FLOOR;
  const skillSelectionSafe = selectedSkills.length > 0 && skillConfidence !== null && skillConfidence >= CONFIDENCE_FLOOR;
  const confidenceValues = Object.keys(request.questions).map((id) => confidenceOf(answerFor(answers, id, id === 'intent' ? response.answer : undefined))).filter((value): value is number => value !== null);
  const confidence = confidenceValues.length > 0 ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3)) : null;
  if (confidence !== null && confidence < CONFIDENCE_FLOOR && !contextSelectionSafe && !skillSelectionSafe) return { ...fallbackEnvelope(input, startedAt, 'REFLEX_LOW_CONFIDENCE'), confidence, decisionConfidences: { model: modelConfidence, skill: skillConfidence, context: contextConfidence }, provider: { providerId: 'typesafe', model: response.model }, usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null, cost: response.cost ?? null };
  const modelScores = admittedModels.map((candidate) => ({ modelRef: candidate.id, score: Math.max(0, Math.min(1, modelAnswer?.probabilities?.[candidate.id] ?? (candidate.id === selectedModel ? 1 : 0))) }));
  const capabilityHint = choiceOf(answerFor(answers, 'capability_hint', undefined));
  const riskSignal = choiceOf(answerFor(answers, 'risk_signal', undefined));
  const modelSelectionSafe = selectedModelIsAdmitted && (modelConfidence === null || modelConfidence >= CONFIDENCE_FLOOR);
  return {
    schemaVersion: SYSTEM_ONE_REFLEX_SCHEMA_VERSION,
    mode: input.mode,
    status: modelSelectionSafe || contextSelectionSafe || skillSelectionSafe || admittedModels.length === 0 ? 'recommendation' : 'fallback',
    originalRequestHash: digest(input.userRequest),
    intent,
    interactionMode: choiceOf(answerFor(answers, 'interaction_mode', undefined)),
    complexity: choiceOf(answerFor(answers, 'complexity', undefined)),
    clarificationNeed: choiceOf(answerFor(answers, 'clarification_need', undefined)),
    requiredCapabilities: capabilityHint && capabilityHint !== 'none' ? [capabilityHint] : [],
    likelySkills: selectedSkills,
    contextNeeds: { candidateCount: uniqueCandidates(input.candidateContexts).length, selectedIds: selectedContexts },
    deepReasoningNeed: choiceOf(answerFor(answers, 'deep_reasoning_need', undefined)),
    expensiveModelNeed: choiceOf(answerFor(answers, 'expensive_model_need', undefined)),
    candidateModelScores: modelScores,
    riskSignals: riskSignal && riskSignal !== 'none' ? [riskSignal] : [],
    verificationNeed: choiceOf(answerFor(answers, 'verification_need', undefined)),
    confidence,
    decisionConfidences: { model: modelConfidence, skill: skillConfidence, context: contextConfidence },
    provider: { providerId: 'typesafe', model: response.model },
    usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null,
    latencyMs: Math.max(0, Date.now() - startedAt),
    cost: response.cost ?? null,
    recommendation: { modelRef: modelSelectionSafe ? selectedModel : null, skillIds: skillSelectionSafe ? selectedSkills : [], contextIds: contextSelectionSafe ? selectedContexts : [] },
    actualRouteModelRef: input.actualRouteModelRef ?? null,
    reasonCode: modelSelectionSafe || contextSelectionSafe || skillSelectionSafe || admittedModels.length === 0 ? null : 'REFLEX_RECOMMENDATION_NOT_ADMITTED',
  };
}

export async function runSystemOnePostflight(input: ReflexPostflightInput, client?: ReflexDecisionClient): Promise<ReflexPostflightResult> {
  if (input.mode === 'OFF') return { status: 'off', originalRequestHash: input.originalRequestHash, confidence: null, latencyMs: 0, usage: null, cost: null, reasonCode: 'REFLEX_DISABLED' };
  if (!client) return { status: 'fallback', originalRequestHash: input.originalRequestHash, confidence: null, latencyMs: 0, usage: null, cost: null, reasonCode: 'REFLEX_CLIENT_UNAVAILABLE' };
  const startedAt = Date.now();
  let response: ReflexDecisionResponse;
  try {
    response = await client({ state: { originalRequestHash: input.originalRequestHash, resultFacts: input.resultFacts }, questions: { result_quality: { type: 'choice', instructions: 'Does the bounded result address the original request and contain the required evidence?', options: ['sufficient', 'escalate'] } } }, 'brain');
  } catch { return { status: 'fallback', originalRequestHash: input.originalRequestHash, confidence: null, latencyMs: Date.now() - startedAt, usage: null, cost: null, reasonCode: 'REFLEX_PROVIDER_UNAVAILABLE' }; }
  if (!response.ok) return { status: 'fallback', originalRequestHash: input.originalRequestHash, confidence: null, latencyMs: Date.now() - startedAt, usage: null, cost: null, reasonCode: response.reasonCode.length <= 96 ? response.reasonCode : 'REFLEX_REQUEST_FAILED' };
  const answer = answerFor(response.answers, 'result_quality', response.answer);
  const choiceValue = choiceOf(answer);
  return { status: choiceValue === 'sufficient' ? 'verified' : 'escalation_advised', originalRequestHash: input.originalRequestHash, confidence: confidenceOf(answer), latencyMs: Date.now() - startedAt, usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null, cost: response.cost ?? null, reasonCode: null };
}

export function applyReflexPilotRecommendation(envelope: TurnDecisionEnvelopeV1, admittedModelRefs: readonly string[]): { modelRef: string | null; skillIds: readonly string[]; contextIds: readonly string[] } {
  if (envelope.mode !== 'ACTIVE_PILOT' || envelope.status !== 'recommendation' || !envelope.recommendation) return { modelRef: null, skillIds: [], contextIds: [] };
  const modelConfidence = envelope.decisionConfidences?.model ?? envelope.confidence;
  const skillConfidence = envelope.decisionConfidences?.skill ?? envelope.confidence;
  const contextConfidence = envelope.decisionConfidences?.context ?? envelope.confidence;
  const modelRef = envelope.recommendation.modelRef && admittedModelRefs.includes(envelope.recommendation.modelRef) ? envelope.recommendation.modelRef : null;
  return {
    modelRef: modelConfidence !== null && modelConfidence >= CONFIDENCE_FLOOR ? modelRef : null,
    skillIds: skillConfidence !== null && skillConfidence >= CONFIDENCE_FLOOR ? envelope.recommendation.skillIds : [],
    contextIds: contextConfidence !== null && contextConfidence >= CONFIDENCE_FLOOR ? envelope.recommendation.contextIds : [],
  };
}

export function rankAdmittedModelCandidates(envelope: TurnDecisionEnvelopeV1, admittedModelRefs: readonly string[]): readonly string[] {
  const admitted = new Set(admittedModelRefs.filter((modelRef) => !/codex|gpt/iu.test(modelRef)));
  return [...envelope.candidateModelScores]
    .filter((candidate) => admitted.has(candidate.modelRef))
    .sort((a, b) => b.score - a.score || a.modelRef.localeCompare(b.modelRef))
    .map((candidate) => candidate.modelRef);
}

export function selectAuthorizedCandidates(selectedIds: readonly string[], authorizedIds: readonly string[]): readonly string[] {
  const authorized = new Set(authorizedIds);
  return [...new Set(selectedIds)].filter((id) => authorized.has(id)).slice(0, MAX_CANDIDATES);
}

export async function evaluateShadowReplay(turns: readonly ReflexReplayTurn[], client: ReflexDecisionClient): Promise<ReflexReplaySummary> {
  const samples: Array<{ actualModelRef: string | null; recommendedModelRef: string | null; actualContextCount: number; selectedContextCount: number; baselineDownstreamInputTokens: number; pilotDownstreamInputTokens: number; downstreamCostUsd?: number; baselineDownstreamCostUsd?: number; baselineSkillTokens?: number; pilotSkillTokens?: number; jevTokens: number; jevSpendUsd: number; latencyMs: number }> = [];
  for (const turn of turns) {
    const envelope = await runSystemOnePreflight({ ...turn.input, mode: 'SHADOW' }, client);
    samples.push({
      actualModelRef: turn.actualModelRef,
      recommendedModelRef: envelope.recommendation?.modelRef ?? null,
      actualContextCount: turn.actualContextCount,
      selectedContextCount: envelope.contextNeeds.selectedIds.length,
      baselineDownstreamInputTokens: turn.baselineDownstreamInputTokens,
      pilotDownstreamInputTokens: turn.downstreamInputTokens,
      ...(turn.downstreamCostUsd !== undefined ? { downstreamCostUsd: turn.downstreamCostUsd } : {}),
      ...(turn.baselineDownstreamCostUsd !== undefined ? { baselineDownstreamCostUsd: turn.baselineDownstreamCostUsd } : {}),
      ...(turn.baselineSkillTokens !== undefined ? { baselineSkillTokens: turn.baselineSkillTokens } : {}),
      ...(turn.pilotSkillTokens !== undefined ? { pilotSkillTokens: turn.pilotSkillTokens } : {}),
      jevTokens: (envelope.usage?.inputTokens ?? 0) + (envelope.usage?.outputTokens ?? 0),
      jevSpendUsd: envelope.cost?.amountUsd ?? 0,
      latencyMs: envelope.latencyMs,
    });
  }
  return summarizeReflexReplay(samples);
}

export function summarizeReflexReplay(samples: readonly { actualModelRef: string | null; recommendedModelRef: string | null; actualContextCount: number; selectedContextCount: number; baselineDownstreamInputTokens: number; pilotDownstreamInputTokens: number; downstreamCostUsd?: number; baselineDownstreamCostUsd?: number; baselineSkillTokens?: number; pilotSkillTokens?: number; jevTokens: number; jevSpendUsd: number; latencyMs: number }[]): ReflexReplaySummary {
  const count = samples.length;
  const agreements = samples.filter((sample) => sample.actualModelRef === sample.recommendedModelRef).length;
  const baseline = samples.reduce((sum, sample) => sum + sample.baselineDownstreamInputTokens, 0);
  const pilot = samples.reduce((sum, sample) => sum + sample.pilotDownstreamInputTokens, 0);
  const baselineCost = samples.reduce((sum, sample) => sum + (sample.baselineDownstreamCostUsd ?? 0), 0);
  const pilotCost = samples.reduce((sum, sample) => sum + (sample.downstreamCostUsd ?? 0), 0);
  const baselineSkillTokens = samples.reduce((sum, sample) => sum + (sample.baselineSkillTokens ?? 0), 0);
  const pilotSkillTokens = samples.reduce((sum, sample) => sum + (sample.pilotSkillTokens ?? 0), 0);
  const contextCandidates = samples.reduce((sum, sample) => sum + sample.actualContextCount, 0);
  const contextSelected = samples.reduce((sum, sample) => sum + sample.selectedContextCount, 0);
  const jevTokens = samples.reduce((sum, sample) => sum + sample.jevTokens, 0);
  const jevSpend = samples.reduce((sum, sample) => sum + sample.jevSpendUsd, 0);
  const latencies = samples.map((sample) => sample.latencyMs);
  return {
    sampleCount: count,
    routingAgreement: count === 0 ? 0 : Number((agreements / count).toFixed(3)),
    contextReduction: contextCandidates === 0 ? 0 : Number((1 - contextSelected / contextCandidates).toFixed(3)),
    baselineDownstreamTokens: baseline,
    pilotDownstreamTokens: pilot,
    downstreamTokenReductionPercent: baseline === 0 ? 0 : Number(((1 - pilot / baseline) * 100).toFixed(2)),
    baselineDownstreamCostUsd: Number(baselineCost.toFixed(6)),
    pilotDownstreamCostUsd: Number(pilotCost.toFixed(6)),
    netValueUsd: Number((baselineCost - pilotCost - jevSpend).toFixed(6)),
    netValuePositive: baselineCost - pilotCost - jevSpend > 0,
    baselineSkillTokens,
    pilotSkillTokens,
    skillTokenReductionPercent: baselineSkillTokens === 0 ? 0 : Number(((1 - pilotSkillTokens / baselineSkillTokens) * 100).toFixed(2)),
    jevTokens,
    jevSpendUsd: Number(jevSpend.toFixed(6)),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
  };
}
