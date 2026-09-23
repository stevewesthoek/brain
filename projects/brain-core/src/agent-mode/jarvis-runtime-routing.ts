import {
  CODEX_CLI_RUNTIME_PROFILE_REF,
  CODEX_CLI_RUNTIME_REF,
  MOCK_AGENT_RUNTIME_PROFILE_REF,
  MOCK_AGENT_RUNTIME_REF,
} from './child-assignment.js';
import type { AdmittedModelRef } from './model-gateway.js';
import { admitAgentModeAutoCandidateCost } from './model-tier-policy.js';
import { CLAUDE_CODE_RUNTIME_PROFILE_REF, CLAUDE_CODE_RUNTIME_REF, MODEL_GATEWAY_RUNTIME_PROFILE_REF, MODEL_GATEWAY_RUNTIME_REF } from './child-assignment.js';

/**
 * Jarvis Auto is deliberately smaller than the general Agent Mode model
 * portfolio. Codex is an escalation runtime, never an Auto candidate.
 */
export const JARVIS_AUTO_MODEL_CANDIDATES: readonly AdmittedModelRef[] = Object.freeze([
  'agent-mode/minimax-m2.5',
  'agent-mode/glm-5',
  'agent-mode/claude-opus-4.6',
]);

export type JarvisModelAdmission = {
  modelRef: AdmittedModelRef;
  runtimeAvailable: boolean;
  autoAdmitted: boolean;
  reasonCode: 'runtime_unavailable' | 'cost_unknown' | null;
};

/** Keep runtime discovery distinct from the Brain-owned policy-admitted set. */
export function deriveJarvisModelAdmissions(runtimeAvailableModels: ReadonlySet<AdmittedModelRef>): readonly JarvisModelAdmission[] {
  return JARVIS_AUTO_MODEL_CANDIDATES.map((modelRef) => {
    const runtimeAvailable = runtimeAvailableModels.has(modelRef);
    const costAdmission = admitAgentModeAutoCandidateCost(modelRef);
    const autoAdmitted = runtimeAvailable && costAdmission.ok;
    return {
      modelRef,
      runtimeAvailable,
      autoAdmitted,
      reasonCode: !runtimeAvailable ? 'runtime_unavailable' : !costAdmission.ok ? costAdmission.reason : null,
    };
  });
}

export type JarvisCodexEscalationApproval = {
  runtime: 'codex-cli';
  reason: string;
  requestedCapability: string;
  approvalId: string;
  approvedBy: string;
};

export type JarvisRuntimeRoute = {
  /** Effective model label when an admitted model route exists. Codex escalation is runtime-owned. */
  modelRef?: AdmittedModelRef;
  runtimeRef: string;
  runtimeProfileRef: string;
  source: 'auto' | 'explicit' | 'codex-escalation';
  selectionReason?: 'fast-path' | 'admitted-order' | 'adaptive-quality-tier' | 'jev-cost-saving' | 'explicit' | 'codex-escalation';
};

export type JarvisRouteResolution =
  | { ok: true; route: JarvisRuntimeRoute }
  | { ok: false; reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' | 'AUTO_COST_ADMISSION_DENIED' | 'CODEX_ESCALATION_REQUIRED' | 'CODEX_ESCALATION_INVALID' | 'MODEL_NOT_ADMITTED' | 'MODEL_COST_UNKNOWN' };

export type JarvisRouteResolutionInput = {
  requestedModel: string;
  requestText?: string;
  /** True only for an injected deterministic fixture runtime. */
  fixtureRuntimeAvailable?: boolean;
  /** Explicit production availability proven by configuration/evidence. */
  productionRuntimeAvailable?: ReadonlySet<AdmittedModelRef>;
  /** Candidate-only adaptive baseline. K4 still performs final admission. */
  adaptiveRouting?: boolean;
  codexEscalation?: JarvisCodexEscalationApproval;
};

export type JarvisTurnComplexity = 'simple' | 'moderate' | 'complex' | 'unknown';

/** Deterministic UX hint; it never grants capability or chooses a provider. */
export function classifyJarvisTurn(text: string | undefined): JarvisTurnComplexity {
  if (!text || text.trim().length === 0) return 'unknown';
  const normalized = text.trim().replace(/\s+/gu, ' ').toLowerCase();
  if (/^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)[!.?]*$/u.test(normalized)) return 'simple';
  if (/^(what model(?: are you using)?|which model|what are you using|are you using jev|what is jev|status|health|are you there)[!.?]*$/u.test(normalized)) return 'simple';
  if (normalized.length <= 160 && /^(show|list|inspect|read|check)\b/u.test(normalized) && !/\b(implement|change|write|deploy|delete|modify)\b/u.test(normalized)) return 'moderate';
  if (/\b(architect|design|implement|refactor|migrate|debug|investigate|deploy)\b/u.test(normalized) || normalized.length > 800) return 'complex';
  return 'moderate';
}

function fixtureRoute(modelRef: AdmittedModelRef, source: JarvisRuntimeRoute['source']): JarvisRuntimeRoute {
  return { modelRef, runtimeRef: MOCK_AGENT_RUNTIME_REF, runtimeProfileRef: MOCK_AGENT_RUNTIME_PROFILE_REF, source, selectionReason: source === 'auto' ? 'admitted-order' : 'explicit' };
}

function productionRoute(modelRef: AdmittedModelRef, source: JarvisRuntimeRoute['source']): JarvisRuntimeRoute {
  return modelRef === 'agent-mode/claude-opus-4.6'
    ? { modelRef, runtimeRef: CLAUDE_CODE_RUNTIME_REF, runtimeProfileRef: CLAUDE_CODE_RUNTIME_PROFILE_REF, source, selectionReason: source === 'auto' ? 'admitted-order' : 'explicit' }
    : { modelRef, runtimeRef: MODEL_GATEWAY_RUNTIME_REF, runtimeProfileRef: MODEL_GATEWAY_RUNTIME_PROFILE_REF, source, selectionReason: source === 'auto' ? 'admitted-order' : 'explicit' };
}

function isCodexRequest(value: string): boolean {
  return value === 'codex' || value === 'codex-cli' || value.startsWith('gpt-');
}

function validEscalation(approval: JarvisCodexEscalationApproval | undefined): boolean {
  return Boolean(approval
    && approval.runtime === 'codex-cli'
    && approval.reason.trim().length > 0 && approval.reason.length <= 512
    && approval.requestedCapability.trim().length > 0 && approval.requestedCapability.length <= 128
    && approval.approvalId.trim().length > 0 && approval.approvalId.length <= 128
    && approval.approvedBy.trim().length > 0 && approval.approvedBy.length <= 128);
}

function selectAutoCandidate(candidates: readonly AdmittedModelRef[], complexity: JarvisTurnComplexity, adaptiveRouting: boolean): { candidate: AdmittedModelRef; adaptive: boolean } | undefined {
  if (candidates.length === 0) return undefined;
  if (!adaptiveRouting || complexity === 'simple' || complexity === 'unknown') return { candidate: candidates[0]!, adaptive: false };
  // Adaptive mode creates a measurable cheaper-route opportunity at the
  // known-priced senior tier. Opus remains an explicit Brain-owned escalation
  // outcome, never the default Auto baseline.
  const preferred = ['agent-mode/glm-5', 'agent-mode/minimax-m2.5', 'agent-mode/claude-opus-4.6'];
  const candidate = preferred.find((modelRef) => candidates.includes(modelRef as AdmittedModelRef)) as AdmittedModelRef | undefined;
  return candidate ? { candidate, adaptive: candidate !== candidates[0] } : { candidate: candidates[0]!, adaptive: false };
}

export function resolveJarvisRuntimeRoute(input: JarvisRouteResolutionInput): JarvisRouteResolution {
  const requested = input.requestedModel;
  if (requested === 'auto') {
    const complexity = classifyJarvisTurn(input.requestText);
    const eligibleCandidates = complexity === 'simple'
      ? JARVIS_AUTO_MODEL_CANDIDATES.filter((candidate) => candidate !== 'agent-mode/claude-opus-4.6')
      : JARVIS_AUTO_MODEL_CANDIDATES;
    const runtimeAvailable = input.fixtureRuntimeAvailable
      ? new Set(JARVIS_AUTO_MODEL_CANDIDATES)
      : input.productionRuntimeAvailable ?? new Set<AdmittedModelRef>();
    const admissions = deriveJarvisModelAdmissions(runtimeAvailable);
    const admitted = new Set(admissions.filter((candidate) => candidate.autoAdmitted).map((candidate) => candidate.modelRef));
    const candidates = eligibleCandidates.filter((candidate) => admitted.has(candidate));
    const denialReason = admissions.some((candidate) => candidate.runtimeAvailable && candidate.reasonCode === 'cost_unknown')
      ? 'AUTO_COST_ADMISSION_DENIED' as const
      : 'AUTO_RUNTIME_UNAVAILABLE' as const;
    if (input.fixtureRuntimeAvailable) {
      const selected = selectAutoCandidate(candidates, complexity, input.adaptiveRouting ?? false);
      if (!selected) return { ok: false, reasonCode: denialReason };
      return { ok: true, route: { ...fixtureRoute(selected.candidate, 'auto'), selectionReason: complexity === 'simple' ? 'fast-path' : selected.adaptive ? 'adaptive-quality-tier' : 'admitted-order' } };
    }
    const selected = selectAutoCandidate(candidates, complexity, input.adaptiveRouting ?? false);
    if (!selected) return { ok: false, reasonCode: denialReason };
    return { ok: true, route: { ...productionRoute(selected.candidate, 'auto'), selectionReason: complexity === 'simple' ? 'fast-path' : selected.adaptive ? 'adaptive-quality-tier' : 'admitted-order' } };
  }
  if (isCodexRequest(requested)) {
    if (!validEscalation(input.codexEscalation)) {
      return { ok: false, reasonCode: input.codexEscalation ? 'CODEX_ESCALATION_INVALID' : 'CODEX_ESCALATION_REQUIRED' };
    }
    return {
      ok: true,
      route: { runtimeRef: CODEX_CLI_RUNTIME_REF, runtimeProfileRef: CODEX_CLI_RUNTIME_PROFILE_REF, source: 'codex-escalation', selectionReason: 'codex-escalation' },
    };
  }
  if (!(JARVIS_AUTO_MODEL_CANDIDATES as readonly string[]).includes(requested)) return { ok: false, reasonCode: 'MODEL_NOT_ADMITTED' };
  const modelRef = requested as AdmittedModelRef;
  const runtimeAvailable = input.fixtureRuntimeAvailable || input.productionRuntimeAvailable?.has(modelRef) === true;
  if (!runtimeAvailable) return { ok: false, reasonCode: 'AUTO_RUNTIME_UNAVAILABLE' };
  const costAdmission = admitAgentModeAutoCandidateCost(modelRef);
  if (!costAdmission.ok) return { ok: false, reasonCode: 'MODEL_COST_UNKNOWN' };
  if (input.fixtureRuntimeAvailable) return { ok: true, route: fixtureRoute(modelRef, 'explicit') };
  return { ok: true, route: productionRoute(modelRef, 'explicit') };
}
