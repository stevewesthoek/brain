import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const specPath = path.join(repoRoot, 'operations/specs/infinite-brain-codex-canary-activation.v1.json');
const schemaPath = path.join(repoRoot, 'operations/specs/infinite-brain-codex-canary-activation.v1.schema.json');
export const CANARY_STATES = Object.freeze(['OFF', 'CANARY', 'DEGRADED', 'FALLBACK']);
export const CANARY_SPEC = loadJson(specPath);

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function validateCanarySpec(spec = CANARY_SPEC) {
  return validateJsonSchema(loadJson(schemaPath), spec);
}

export function createCodexCanary({ enabled = false, selectedDomain = CANARY_SPEC.selectedDomain, allowedRouteClasses = CANARY_SPEC.allowedRouteClasses } = {}) {
  return {
    consumer: 'codex', selectedDomain, allowedRouteClasses: [...allowedRouteClasses], enabled,
    state: enabled ? 'CANARY' : 'OFF', v2PathAvailable: true, legacyPathAvailable: true,
    activationPerformed: false, productionActive: false
  };
}

export function evaluateCodexCanary({ contract = createCodexCanary(), consumer = 'codex', domain, routeClass, legacyPathAvailable = true, v2PathAvailable = true, currentSource = true, safetyGatesPass = true, qualityGatesPass = true, unsafe = false, failureInjected = false } = {}) {
  const scopeMatch = consumer === contract.consumer && domain === contract.selectedDomain && contract.allowedRouteClasses.includes(routeClass);
  const failClosed = unsafe || !currentSource || !safetyGatesPass || !qualityGatesPass || failureInjected || !v2PathAvailable;
  if (!legacyPathAvailable) return { state: 'FALLBACK', selectedPath: 'none', reason: 'legacy_path_unavailable', stop: true, failClosed: true };
  if (!contract.enabled) return { state: 'OFF', selectedPath: 'legacy', reason: 'canary_disabled', stop: false, failClosed: false };
  if (!scopeMatch) return { state: 'FALLBACK', selectedPath: 'legacy', reason: 'outside_bounded_canary_scope', stop: false, failClosed: true };
  if (failClosed) return { state: failureInjected ? 'DEGRADED' : 'FALLBACK', selectedPath: 'legacy', reason: failureInjected ? 'injected_canary_failure' : unsafe ? 'unsafe_or_gate_failure' : 'v2_unavailable_or_stale', stop: true, failClosed: true };
  return { state: 'CANARY', selectedPath: 'v2', reason: 'bounded_scope_and_preflight_passed', stop: false, failClosed: false };
}

export function rollbackCodexCanary(contract = createCodexCanary()) {
  return { ...clone(contract), enabled: false, state: 'FALLBACK', selectedPath: 'legacy', rollback: { pass: contract.legacyPathAvailable !== false, manualConfigSurgeryRequired: false, elapsedSeconds: 0, measurement: 'deterministic simulated drill' } };
}

export function compareShadowDecisions({ prompts, priorPath = { available: true, instrumented: false }, v2Decisions = [] } = {}) {
  const rows = prompts.map((prompt, index) => ({ promptId: prompt.id ?? `prompt-${index + 1}`, prompt: prompt.prompt ?? prompt, prior: { path: 'legacy', available: priorPath.available !== false, instrumented: priorPath.instrumented === true, decision: 'NOT_INSTRUMENTED' }, v2: v2Decisions[index] ?? { decision: 'NOT_RECORDED' }, executionPerformed: false }));
  return { status: priorPath.instrumented ? 'MEASURED' : 'STRUCTURAL_ONLY', priorPath, v2Path: 'codex-v2-shadow', rows, executionPerformed: false, claims: priorPath.instrumented ? 'delta_available' : 'no_quality_delta_claimed' };
}

export function activationTelemetry({ state, selectedPath, route, gates, context, rollback = null } = {}) {
  return { event: 'codex_canary_decision', consumer: 'codex', state, selectedPath, route: { family: route?.family ?? null, domain: route?.domain ?? null, routeClass: route?.routeClass ?? null }, gates: { safetyPass: gates?.safetyPass ?? false, qualityPass: gates?.qualityPass ?? false }, context: { bootstrapTokens: context?.bootstrapTokens ?? 0, selectedSkillTokens: context?.selectedSkillTokens ?? 0, maxSimultaneous: context?.maxSimultaneous ?? 0 }, rollback, executionPerformed: false, writes: 0, providerCalls: 0, productionActive: false };
}
