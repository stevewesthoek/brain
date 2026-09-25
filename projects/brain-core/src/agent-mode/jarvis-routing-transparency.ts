import type { JarvisRuntimeRoute } from './jarvis-runtime-routing.js';

export type JarvisRoutingTransparencyReflex = {
  mode: string;
  status: string;
  recommendationModelRef: string | null;
  actualRouteModelRef: string | null;
  reasonCode: string | null;
};

export type JarvisRoutingFacts = {
  modelRef: string | null;
  modelId: string | null;
  providerId: string | null;
  runtimeRef: string | null;
  selectionReason?: JarvisRuntimeRoute['selectionReason'] | null;
  reflex?: JarvisRoutingTransparencyReflex | null;
};

export function hasJarvisRoutingFacts(facts: JarvisRoutingFacts | null | undefined): facts is JarvisRoutingFacts {
  return Boolean(facts && (facts.modelRef || facts.modelId || facts.providerId || facts.runtimeRef || facts.reflex));
}

/** Routing/status questions are Brain-owned facts, not model-authored answers. */
export function isJarvisRoutingQuestion(text: string | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().replace(/\s+/gu, ' ').replace(/[!.?]+$/u, '').toLowerCase();
  if (normalized.length > 240) return false;
  if (/^how (?:do|can|should) i (?:invoke|use|call|enable|run)\s+(?:jev|system[- ]one reflex)\b/u.test(normalized)) return false;
  const clauses = normalized.split(/[,;?]|\band\b/u).map((clause) => clause.trim());
  const modelIdentityQuestion = clauses.some((clause) => /^(?:(?:what|which) (?:model|llm|provider|runtime|route)(?: are you (?:actually )?(?:using|running)| is (?:this|active|selected|running)| did you use| did auto choose)(?: this turn)?|(?:what|which) model did you use(?: this turn)?|what are you (?:running|powered by|using)|how are you routed|what route|(?:are|were) you (?:currently )?(?:running|using|powered by)(?: on)? (?:claude|opus|codex|glm(?:-?5)?|minimax(?:[- ]m2\.5)?|gpt-[a-z0-9.-]+))$/u.test(clause));
  const namedModelStatusQuestion = clauses.some((clause) => /^did you (?:use|run) (?:the )?(?:agent-mode\/)?(?:claude(?: code)?|opus(?:[ -]4\.6)?|codex(?: cli)?|glm(?:-?5)?|minimax(?:[ -]m2\.5)?|gpt-[a-z0-9.-]+)(?: this turn)?$/u.test(clause));
  const autoChoiceQuestion = clauses.some((clause) => /^(?:what|which) did auto (?:choose|select|pick)(?: for this turn)?$/u.test(clause));
  const jevStatusQuestion = /\b(?:jev|system[- ]one reflex)\b/u.test(normalized)
    && /\b(?:use|using|used|run|ran|call|called|invoke|invoked|active|available|status|participat\w*|work|make use|unavailable|bypass\w*|skip\w*|fallback|confidence|this turn|decid\w*|recommend\w*|choos\w*|select\w*)\b/u.test(normalized);
  return modelIdentityQuestion || namedModelStatusQuestion || autoChoiceQuestion || jevStatusQuestion
    || /^(?:what is jev|what is system[- ]one reflex|are you using jev)$/u.test(normalized)
    || /^(?:what are you using|how are you routed|what route|status|health|are you there)$/u.test(normalized);
}

export function hasUnsupportedToolCallText(text: string): boolean {
  return /<\/?(?:minimax:)?tool_call\b|<invoke\b|<function_calls\b/iu.test(text);
}

function modelLabel(modelRef: string | null | undefined): string {
  if (!modelRef) return 'not selected';
  if (modelRef === 'agent-mode/minimax-m2.5') return 'MiniMax M2.5';
  if (modelRef === 'agent-mode/glm-5') return 'GLM-5';
  if (modelRef === 'agent-mode/claude-opus-4.6') return 'Opus 4.6';
  if (modelRef === 'glm-5') return 'GLM-5';
  if (modelRef === 'minimax-m2.5') return 'MiniMax M2.5';
  if (modelRef === 'opus-4.6') return 'Opus 4.6';
  if (modelRef === 'runtime:codex-cli' || modelRef === 'codex-cli' || modelRef === 'codex') return 'Codex CLI';
  return 'unrecognized model';
}

function runtimeLabel(runtimeRef: string): string {
  if (runtimeRef === 'runtime:model-gateway') return 'model-gateway';
  if (runtimeRef === 'runtime:claude-code') return 'Claude Code';
  if (runtimeRef === 'runtime:codex-cli') return 'Codex CLI';
  if (/^runtime:deepseek-harness:[a-f0-9]{40}$/u.test(runtimeRef)) return 'Restricted Harness';
  if (runtimeRef === 'runtime:mock-k0-4') return 'MockAgentRuntime';
  if (runtimeRef === 'runtime:remote-node-runner') return 'Remote Node Runner';
  return 'runtime not reported';
}

function routeReasonLabel(reason: JarvisRuntimeRoute['selectionReason'] | null | undefined): string | null {
  if (reason === 'fast-path') return 'fast path';
  if (reason === 'admitted-order') return 'admitted candidate order';
  if (reason === 'adaptive-quality-tier') return 'adaptive quality tier';
  if (reason === 'jev-cost-saving') return 'Jev cost-saving recommendation';
  if (reason === 'explicit') return 'explicit model selection';
  if (reason === 'codex-escalation') return 'explicit Codex escalation';
  return null;
}

function routeLabel(route: { modelRef?: string | null; modelId?: string | null; providerId?: string | null; runtimeRef: string; selectionReason?: JarvisRuntimeRoute['selectionReason'] | null } | null | undefined): string {
  if (!route) return 'not recorded';
  if (route.runtimeRef === 'runtime:codex-cli') {
    const reportedCodexModel = route.modelRef && /^gpt-[a-z0-9][a-z0-9.-]{0,63}$/u.test(route.modelRef) ? route.modelRef : null;
    return reportedCodexModel ? `Codex CLI (Brain-reported model ${reportedCodexModel})` : 'Codex CLI runtime (underlying model not reported by Brain)';
  }
  const knownModelIds: Record<string, string> = {
    'agent-mode/minimax-m2.5': 'minimax.minimax-m2.5',
    'agent-mode/glm-5': 'zai.glm-5',
    'agent-mode/claude-opus-4.6': 'anthropic.claude-opus-4-6-v1',
  };
  const exactModel = route.modelRef && route.modelId === knownModelIds[route.modelRef] ? ` [${route.modelId}]` : '';
  const provider = route.providerId === 'amazon-bedrock' ? ' · Amazon Bedrock' : '';
  const reason = routeReasonLabel(route.selectionReason);
  return `${modelLabel(route.modelRef)} via ${runtimeLabel(route.runtimeRef)}${exactModel}${provider}${reason ? ` · ${reason}` : ''}`;
}

export function describeJarvisReflexStatus(reflex: JarvisRoutingTransparencyReflex | null | undefined): string {
  if (!reflex) return 'Jev status not recorded for this turn';
  const reason = reflex.reasonCode;
  if (reflex.mode === 'UNAVAILABLE' || (reason !== null && /^(?:REFLEX_(?:PREFLIGHT|CLIENT|PROVIDER|BRIDGE)_UNAVAILABLE)$/u.test(reason))) {
    return `Jev unavailable${reason ? ` · ${reason}` : ''}`;
  }
  if (reason === 'CREDENTIAL_MISSING' || reason === 'TYPESAFE_UNAVAILABLE' || reason === 'REFLEX_TIMEOUT' || reason === 'TYPESAFE_TIMEOUT') {
    return `Jev unavailable · ${reason}`;
  }
  if (reason === 'JEV_BUDGET_EXHAUSTED') return `Jev skipped by Brain budget gate · ${reason}`;
  if (reason?.startsWith('REFLEX_SKIPPED_')) return `Jev bypassed deterministically · ${reason}`;
  if (reason === 'REFLEX_LOW_CONFIDENCE') return `Jev ran; low-confidence fallback, recommendation not applied · ${reason}`;
  if (reason === 'REFLEX_RECOMMENDATION_NOT_ADMITTED') return `Jev ran; recommendation not admitted, route unchanged · ${reason}`;
  if (reflex.mode === 'OFF') return 'Jev off';
  if (reflex.status === 'fallback') return `Jev failed closed${reason ? ` · ${reason}` : ''}`;
  if (reflex.status === 'recommendation' && reflex.mode === 'SHADOW') return 'Jev participated in SHADOW mode; recommendation observed, route unchanged';
  if (reflex.status === 'recommendation') return 'Jev participated; recommendation recorded';
  return `Jev status ${reflex.status}`;
}

export function buildJarvisRoutingDisclosure(input: {
  requestedModel: string | null | undefined;
  route: { modelRef?: string | null; modelId?: string | null; providerId?: string | null; runtimeRef: string; selectionReason?: JarvisRuntimeRoute['selectionReason'] | null } | null | undefined;
  reflex?: JarvisRoutingTransparencyReflex | null;
}): string {
  const requested = input.route?.runtimeRef === 'runtime:codex-cli'
    ? 'Codex escalation'
    : input.requestedModel === 'auto' ? 'Auto' : modelLabel(input.requestedModel);
  const reflex = describeJarvisReflexStatus(input.reflex);
  const recommendation = input.reflex?.recommendationModelRef
    ? ` Recommendation: ${modelLabel(input.reflex.recommendationModelRef)}.`
    : '';
  return `Brain routing: ${requested} selected ${routeLabel(input.route)}. ${reflex}.${recommendation} This routing status is derived from Brain state; the model does not choose or redefine it.`;
}
