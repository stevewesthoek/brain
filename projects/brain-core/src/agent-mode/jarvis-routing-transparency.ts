export type JarvisRoutingTransparencyReflex = {
  mode: string;
  status: string;
  recommendationModelRef: string | null;
  actualRouteModelRef: string | null;
  reasonCode: string | null;
};

/** Routing/status questions are Brain-owned facts, not model-authored answers. */
export function isJarvisRoutingQuestion(text: string | undefined): boolean {
  if (!text) return false;
  const normalized = text.trim().replace(/\s+/gu, ' ').toLowerCase();
  return /^(what model(?: are you using)?|which model|what are you using|are you using jev|what is jev|how are you routed|what route|status|health|are you there)[!.?]*$/u.test(normalized);
}

export function hasUnsupportedToolCallText(text: string): boolean {
  return /<\/?(?:minimax:)?tool_call\b|<invoke\b|<function_calls\b/iu.test(text);
}

function modelLabel(modelRef: string | null | undefined): string {
  if (!modelRef) return 'not selected';
  if (modelRef === 'agent-mode/minimax-m2.5') return 'MiniMax M2.5';
  if (modelRef === 'agent-mode/glm-5') return 'GLM-5';
  if (modelRef === 'agent-mode/claude-opus-4.6') return 'Opus 4.6';
  if (modelRef === 'runtime:codex-cli' || modelRef === 'codex-cli') return 'Codex CLI';
  return modelRef;
}

function routeLabel(route: { modelRef?: string | null; runtimeRef: string } | null | undefined): string {
  if (!route) return 'unavailable';
  return `${modelLabel(route.modelRef)} via ${route.runtimeRef.replace(/^runtime:/u, '')}`;
}

export function buildJarvisRoutingDisclosure(input: {
  requestedModel: string | null | undefined;
  route: { modelRef?: string | null; runtimeRef: string } | null | undefined;
  reflex?: JarvisRoutingTransparencyReflex | null;
}): string {
  const requested = input.requestedModel === 'auto' ? 'Auto' : modelLabel(input.requestedModel);
  const reflex = input.reflex
    ? `Jev ${input.reflex.mode} · ${input.reflex.status}${input.reflex.reasonCode ? ` · ${input.reflex.reasonCode}` : ''}`
    : 'Jev not enabled for this turn';
  const recommendation = input.reflex?.recommendationModelRef
    ? ` Recommendation: ${modelLabel(input.reflex.recommendationModelRef)}.`
    : '';
  return `Brain routing: ${requested} selected ${routeLabel(input.route)}. ${reflex}.${recommendation} This routing status is derived from Brain state; the model does not choose or redefine it.`;
}
