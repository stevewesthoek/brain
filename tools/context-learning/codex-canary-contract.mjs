import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';
import { runCodexLiveConsumptionPilot } from './codex-live-consumption-pilot.mjs';
import { buildCodexPriorPath, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const specPath = path.join(repoRoot, 'operations/specs/infinite-brain-codex-canary-activation.v1.json');
const schemaPath = path.join(repoRoot, 'operations/specs/infinite-brain-codex-canary-activation.v1.schema.json');
export const CANARY_STATES = Object.freeze(['OFF', 'CANARY', 'DEGRADED', 'FALLBACK']);
export const CANARY_ACTIVATION_STATES = Object.freeze(['DISABLED', 'READY', 'CANARY_ACTIVE', 'DEGRADED', 'ROLLED_BACK', 'CANARY_ACCEPTED', 'PRODUCTION_DEFAULT']);
export const CANARY_SPEC = loadJson(specPath);

const ACTIVATION_TRANSITIONS = Object.freeze({
  DISABLED: ['READY'],
  READY: ['CANARY_ACTIVE', 'DISABLED'],
  CANARY_ACTIVE: ['DEGRADED', 'ROLLED_BACK', 'CANARY_ACCEPTED'],
  DEGRADED: ['ROLLED_BACK'],
  ROLLED_BACK: ['READY', 'CANARY_ACTIVE'],
  CANARY_ACCEPTED: ['ROLLED_BACK'],
  PRODUCTION_DEFAULT: []
});

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

export function createCodexCanaryController({ sourceRevision = 'unknown', selectedDomain = CANARY_SPEC.selectedDomain, allowedRouteClasses = CANARY_SPEC.allowedRouteClasses, activationTimestamp = null } = {}) {
  return {
    consumer: 'codex', domain: selectedDomain, mode: 'CANARY', sourceRevision, allowedRouteClasses: [...allowedRouteClasses],
    state: 'DISABLED', enabled: false, activationTimestamp, productionActive: false, activationPerformed: false,
    legacyPath: 'codex-current-entry', history: [{ from: null, to: 'DISABLED', reason: 'initial_state', timestamp: activationTimestamp }]
  };
}

export function transitionCodexCanary(controller, nextState, { reason = 'explicit_transition', timestamp = null } = {}) {
  if (!CANARY_ACTIVATION_STATES.includes(nextState)) throw new Error(`codex_canary:unknown_state:${nextState}`);
  if (nextState === 'PRODUCTION_DEFAULT') throw new Error('codex_canary:production_default_forbidden');
  if (!ACTIVATION_TRANSITIONS[controller.state]?.includes(nextState)) throw new Error(`codex_canary:invalid_transition:${controller.state}->${nextState}`);
  const enabled = nextState === 'CANARY_ACTIVE' || nextState === 'CANARY_ACCEPTED';
  return { ...clone(controller), state: nextState, enabled, productionActive: false, activationPerformed: false, history: [...(controller.history ?? []), { from: controller.state, to: nextState, reason, timestamp }] };
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

export function runCodexBoundedCanaryInvocation({ repoRoot = process.cwd(), controller, prompt, fixtureId = 'canary-unlabeled', routeClass, source, session, currentState = {}, failureMode = null, catalog = createCapabilityCatalog({ repoRoot }) } = {}) {
  if (!controller || controller.consumer !== 'codex' || controller.domain !== 'code') throw new Error('codex_canary:bounded_codex_code_controller_required');
  const priorPath = buildCodexPriorPath({ repoRoot });
  const active = controller.state === 'CANARY_ACTIVE' || controller.state === 'CANARY_ACCEPTED';
  const livePath = runCodexLiveConsumptionPilot({ source, session, enabled: active && controller.allowedRouteClasses.includes(routeClass), maxItems: 8 });
  // Active canary requests are evaluated by the real v2 stack even when the
  // final selector rejects them. This proves high-risk and other-domain
  // behavior reaches v2 routing without allowing scope leakage.
  const v2 = active ? runCodexReadOnlyPilot({ repoRoot, prompt, fixtureId, catalog, currentState, failureMode }) : null;
  const actualDomain = v2?.route?.primaryRouteFamily === 'code' ? 'code' : v2?.route?.primaryRouteFamily ?? null;
  const scopeMatch = active && actualDomain === controller.domain && controller.allowedRouteClasses.includes(routeClass);
  const v2Failed = !v2 || v2.fallback?.active === true || v2.activation?.productionActive === true || v2.safety?.writes !== 0 || v2.safety?.providerCalls !== 0;
  const decision = evaluateCodexCanary({ contract: { ...createCodexCanary({ enabled: active, selectedDomain: controller.domain, allowedRouteClasses: controller.allowedRouteClasses }), enabled: scopeMatch }, consumer: 'codex', domain: actualDomain, routeClass, legacyPathAvailable: priorPath.available, v2PathAvailable: !v2Failed, currentSource: currentState.repositoryRevision ? currentState.repositoryRevision === v2?.sourceRevision : true, safetyGatesPass: !(v2?.graph?.execution?.executionReady), qualityGatesPass: v2?.validation?.valid !== false, unsafe: Boolean(v2?.safety?.writes || v2?.safety?.providerCalls), failureInjected: Boolean(failureMode) });
  const selectedPath = decision.selectedPath === 'v2' && livePath.live_consumed ? 'v2' : 'legacy';
  const resultState = selectedPath === 'v2' ? 'CANARY_ACTIVE' : decision.state === 'DEGRADED' ? 'DEGRADED' : decision.stop ? 'FALLBACK' : decision.state;
  const receipt = {
    schemaVersion: '1.0.0', receiptId: `codex-canary-${v2?.requestHash ?? fixtureId}`, brainRevision: v2?.sourceRevision ?? source?.head_revision ?? 'unknown', consumer: 'codex', domain: controller.domain, canaryState: resultState, fixtureId,
    route: v2?.route ? { family: v2.route.primaryRouteFamily, owner: v2.route.primaryDescriptorId, routeClass } : null,
    question: v2?.qualification ? { required: v2.qualification.required, count: v2.qualification.count ?? 0 } : null,
    selectedCapabilities: v2?.taskPacket?.selectedCapabilityRefs?.map((item) => item.capabilityId) ?? [], contextRefs: v2?.taskPacket?.continuityRef ? [v2.taskPacket.continuityRef] : [], taskPacketRef: v2?.taskPacket?.taskId ? `task://${v2.taskPacket.taskId}` : null, graphRef: v2?.graph?.graphId ? `graph://${v2.graph.graphId}` : null,
    gates: { quality: v2?.graph?.qualityGateNodes ?? [], safety: v2?.graph?.safetyGateNodes ?? [] }, risk: v2?.route?.normalizedRequest?.riskClass ?? null, freshness: v2?.continuity?.state ?? 'UNAVAILABLE', fallback: selectedPath === 'legacy' ? { active: true, reason: decision.reason, priorPath: priorPath.name } : { active: false }, metrics: v2?.metrics ?? livePath.metrics ?? {}, outcome: selectedPath === 'v2' ? 'V2_CANARY_SELECTED' : decision.stop ? 'SAFE_FALLBACK_OR_BLOCK' : 'OUT_OF_CANARY_SCOPE', writesAttempted: 0, providerCalls: 0, activationScope: { consumer: 'codex', domain: controller.domain, routeClass }, executionPerformed: false
  };
  return { fixtureId, selectedPath, state: resultState, scope: { active, requestedRouteClass: routeClass, actualDomain, matched: scopeMatch }, priorPath, livePath, v2, decision, receipt };
}

export function acceptCodexCanary(controller, { reason = 'acceptance_thresholds_passed', timestamp = null } = {}) {
  return transitionCodexCanary(controller, 'CANARY_ACCEPTED', { reason, timestamp });
}

export function compareShadowDecisions({ prompts, priorPath = { available: true, instrumented: false }, v2Decisions = [] } = {}) {
  const rows = prompts.map((prompt, index) => ({ promptId: prompt.id ?? `prompt-${index + 1}`, prompt: prompt.prompt ?? prompt, prior: { path: 'legacy', available: priorPath.available !== false, instrumented: priorPath.instrumented === true, decision: 'NOT_INSTRUMENTED' }, v2: v2Decisions[index] ?? { decision: 'NOT_RECORDED' }, executionPerformed: false }));
  return { status: priorPath.instrumented ? 'MEASURED' : 'STRUCTURAL_ONLY', priorPath, v2Path: 'codex-v2-shadow', rows, executionPerformed: false, claims: priorPath.instrumented ? 'delta_available' : 'no_quality_delta_claimed' };
}

export function activationTelemetry({ state, selectedPath, route, gates, context, rollback = null } = {}) {
  return { event: 'codex_canary_decision', consumer: 'codex', state, selectedPath, route: { family: route?.family ?? null, domain: route?.domain ?? null, routeClass: route?.routeClass ?? null }, gates: { safetyPass: gates?.safetyPass ?? false, qualityPass: gates?.qualityPass ?? false }, context: { bootstrapTokens: context?.bootstrapTokens ?? 0, selectedSkillTokens: context?.selectedSkillTokens ?? 0, maxSimultaneous: context?.maxSimultaneous ?? 0 }, rollback, executionPerformed: false, writes: 0, providerCalls: 0, productionActive: false };
}
