import { applyReflexPilotRecommendation, type TurnDecisionEnvelopeV1 } from './system-one-reflex.js';
import { JARVIS_AUTO_MODEL_CANDIDATES, resolveJarvisRuntimeRoute, type JarvisRuntimeRoute } from './jarvis-runtime-routing.js';
import type { AdmittedModelRef } from './model-gateway.js';

export type PersistedJarvisReflexRoute = Pick<JarvisRuntimeRoute, 'modelRef' | 'runtimeRef' | 'runtimeProfileRef' | 'source' | 'selectionReason'>;

function admittedModels(availableModels: ReadonlySet<AdmittedModelRef> | undefined): readonly string[] {
  return availableModels ? [...availableModels] : JARVIS_AUTO_MODEL_CANDIDATES;
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
  const recommendation = applyReflexPilotRecommendation(input.envelope, admittedModels(input.availableModels));
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

export function persistedJarvisReflexRoute(value: unknown): JarvisRuntimeRoute | undefined {
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
  return { modelRef: modelRef as AdmittedModelRef, runtimeRef, runtimeProfileRef, source, ...(selectionReason ? { selectionReason } : {}) };
}

export function routeFromK4Assignment(assignment: { modelRef: string; runtimeRef: string; runtimeProfileRef: string }): JarvisRuntimeRoute | undefined {
  if (!(JARVIS_AUTO_MODEL_CANDIDATES as readonly string[]).includes(assignment.modelRef)) return undefined;
  return { modelRef: assignment.modelRef as AdmittedModelRef, runtimeRef: assignment.runtimeRef, runtimeProfileRef: assignment.runtimeProfileRef, source: 'auto', selectionReason: 'admitted-order' };
}
