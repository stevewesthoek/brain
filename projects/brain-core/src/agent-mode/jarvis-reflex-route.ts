import { applyReflexPilotRecommendation, type TurnDecisionEnvelopeV1 } from './system-one-reflex.js';
import { classifyJarvisTurn, deriveJarvisModelAdmissions, JARVIS_AUTO_MODEL_CANDIDATES, resolveJarvisRuntimeRoute, type JarvisRuntimeRoute } from './jarvis-runtime-routing.js';
import type { AdmittedModelRef } from './model-gateway.js';
import { admitAgentModeAutoCandidateCost } from './model-tier-policy.js';

export type PersistedJarvisReflexRoute = Pick<JarvisRuntimeRoute, 'modelRef' | 'runtimeRef' | 'runtimeProfileRef' | 'source' | 'selectionReason'>;

function admittedModels(availableModels: ReadonlySet<AdmittedModelRef> | undefined, fixtureRuntimeAvailable: boolean): readonly string[] {
  const runtimeAvailable = availableModels ?? (fixtureRuntimeAvailable ? new Set(JARVIS_AUTO_MODEL_CANDIDATES) : new Set<AdmittedModelRef>());
  return deriveJarvisModelAdmissions(runtimeAvailable).filter((candidate) => candidate.autoAdmitted).map((candidate) => candidate.modelRef);
}

/**
 * Applies only a bounded ACTIVE_PILOT model recommendation. K4 still admits
 * the resulting route; SHADOW/OFF and explicit model requests remain intact.
 */
export function applyJarvisReflexRoute(input: {
  requestedModel: string;
  requestText: string;
  currentRoute: JarvisRuntimeRoute;
  envelope: TurnDecisionEnvelopeV1;
  availableModels?: ReadonlySet<AdmittedModelRef>;
  fixtureRuntimeAvailable: boolean;
}): JarvisRuntimeRoute {
  if (input.requestedModel !== 'auto') return input.currentRoute;
  // Trivial turns are resolved before Jev. Even a stale or synthetic Jev
  // envelope cannot replace the deterministic cheapest-capable fast path.
  if (classifyJarvisTurn(input.requestText) === 'simple') return input.currentRoute;
  const recommendation = applyReflexPilotRecommendation(input.envelope, admittedModels(input.availableModels, input.fixtureRuntimeAvailable));
  if (!recommendation.modelRef || recommendation.modelRef === input.currentRoute.modelRef) return input.currentRoute;
  const resolved = resolveJarvisRuntimeRoute({
    requestedModel: recommendation.modelRef,
    requestText: input.requestText,
    fixtureRuntimeAvailable: input.fixtureRuntimeAvailable,
    ...(input.availableModels ? { productionRuntimeAvailable: input.availableModels } : {}),
  });
  return resolved.ok
    ? { ...resolved.route, source: input.currentRoute.source, selectionReason: 'jev-cost-saving' }
    : input.currentRoute;
}

export function persistedJarvisReflexRoute(value: unknown, currentlyAdmittedModels?: ReadonlySet<AdmittedModelRef>): JarvisRuntimeRoute | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const modelRef = record.modelRef;
  const runtimeRef = record.runtimeRef;
  const runtimeProfileRef = record.runtimeProfileRef;
  const source = record.source;
  const selectionReason = record.selectionReason;
  if (typeof modelRef !== 'string' || !(JARVIS_AUTO_MODEL_CANDIDATES as readonly string[]).includes(modelRef)
    || typeof runtimeRef !== 'string' || typeof runtimeProfileRef !== 'string'
    || (source !== 'auto' && source !== 'explicit')
    || (selectionReason !== undefined && selectionReason !== 'fast-path' && selectionReason !== 'admitted-order' && selectionReason !== 'adaptive-quality-tier' && selectionReason !== 'jev-cost-saving' && selectionReason !== 'explicit')) return undefined;
  const admittedModelRef = modelRef as AdmittedModelRef;
  if (!admitAgentModeAutoCandidateCost(admittedModelRef).ok || (currentlyAdmittedModels && !currentlyAdmittedModels.has(admittedModelRef))) return undefined;
  const canonicalRoute = resolveJarvisRuntimeRoute({ requestedModel: admittedModelRef, fixtureRuntimeAvailable: currentlyAdmittedModels === undefined, ...(currentlyAdmittedModels ? { productionRuntimeAvailable: currentlyAdmittedModels } : {}) });
  if (!canonicalRoute.ok || canonicalRoute.route.runtimeRef !== runtimeRef || canonicalRoute.route.runtimeProfileRef !== runtimeProfileRef) return undefined;
  return { modelRef: admittedModelRef, runtimeRef, runtimeProfileRef, source, ...(selectionReason ? { selectionReason } : {}) };
}

export function routeFromK4Assignment(assignment: { modelRef: string; runtimeRef: string; runtimeProfileRef: string }): JarvisRuntimeRoute | undefined {
  if (!(JARVIS_AUTO_MODEL_CANDIDATES as readonly string[]).includes(assignment.modelRef)) return undefined;
  return { modelRef: assignment.modelRef as AdmittedModelRef, runtimeRef: assignment.runtimeRef, runtimeProfileRef: assignment.runtimeProfileRef, source: 'auto', selectionReason: 'admitted-order' };
}
