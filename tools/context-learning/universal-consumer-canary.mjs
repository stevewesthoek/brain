import crypto from 'node:crypto';
import { orchestrateBrainRequest, UNIVERSAL_CONTRACT_VERSION } from './universal-consumer-contract.mjs';

const ACTIVE_STATES = new Set(['CANARY_ACTIVE', 'CANARY_ACCEPTED']);
const TRANSITIONS = Object.freeze({
  CONFORMANT: ['CANARY_ACTIVE'],
  CANARY_ACTIVE: ['CANARY_ACCEPTED', 'DEGRADED', 'ROLLED_BACK'],
  DEGRADED: ['ROLLED_BACK'],
  CANARY_ACCEPTED: ['ROLLED_BACK'],
  ROLLED_BACK: ['CONFORMANT', 'CANARY_ACTIVE']
});

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function now(timestamp) { return timestamp ?? new Date().toISOString(); }

export function createUniversalConsumerCanaryController({ consumer, domain = 'code', allowedRouteFamilies = null, adapterId, sourceRevision = 'unknown', activationTimestamp = null, priorPath = `${consumer}-current-entry`, activationReason = `separate consumer ${domain} canary authorization`, failureNamespace = 'universal.canary', outOfScopeReason = `outside_bounded_${domain}_canary_scope` } = {}) {
  if (!consumer || !adapterId) throw new Error('universal_canary:consumer_and_adapter_required');
  return {
    consumer, domain, allowedRouteFamilies: [...new Set(allowedRouteFamilies ?? [domain])], mode: 'CANARY', adapterId, sourceRevision, activationReason, failureNamespace, outOfScopeReason, universalContractVersion: UNIVERSAL_CONTRACT_VERSION,
    state: 'CONFORMANT', enabled: false, activationPerformed: false, productionActive: false, priorPath,
    history: [{ from: null, to: 'CONFORMANT', reason: 'reference_adapter_conformance_passed', timestamp: activationTimestamp }]
  };
}

export function transitionUniversalConsumerCanary(controller, nextState, { reason = 'explicit_transition', timestamp = null } = {}) {
  if (!TRANSITIONS[controller?.state]?.includes(nextState)) throw new Error(`universal_canary:invalid_transition:${controller?.state}->${nextState}`);
  const active = ACTIVE_STATES.has(nextState);
  return { ...clone(controller), state: nextState, enabled: active, activationPerformed: true, productionActive: false, history: [...controller.history, { from: controller.state, to: nextState, reason, timestamp: now(timestamp) }] };
}

export function activateUniversalConsumerCanary(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('universal_canary:preflight_required');
  return transitionUniversalConsumerCanary(controller, 'CANARY_ACTIVE', { reason: controller.activationReason ?? `separate consumer ${controller.domain} canary authorization`, timestamp });
}

export function acceptUniversalConsumerCanary(controller, { evidence = null, timestamp = null } = {}) {
  if (!evidence?.passed) throw new Error('universal_canary:acceptance_evidence_required');
  return transitionUniversalConsumerCanary(controller, 'CANARY_ACCEPTED', { reason: 'burn-in, parity, safety, fallback, and rollback thresholds passed', timestamp });
}

export function rollbackUniversalConsumerCanary(controller, { timestamp = null } = {}) {
  const next = transitionUniversalConsumerCanary(controller, 'ROLLED_BACK', { reason: 'active canary rollback to prior consumer path', timestamp });
  return { ...next, rollback: { passed: true, priorPath: next.priorPath, v2Invoked: false, manualRecovery: 'none', elapsedSeconds: 0 } };
}

function failureReceipt({ controller, fixtureId, selectedPath, reason, requestHash = null, result = null }) {
  return {
    schemaVersion: UNIVERSAL_CONTRACT_VERSION, receiptId: `consumer-canary-${hash(`${controller.consumer}:${fixtureId}:${requestHash ?? reason}`)}`,
    contractVersion: UNIVERSAL_CONTRACT_VERSION, consumer: controller.consumer, domain: controller.domain,
    canaryState: controller.state, adapterId: controller.adapterId, brainRevision: controller.sourceRevision,
    requestHash, route: result?.receipt?.route ?? null, qualification: result?.receipt?.qualification ?? null,
    taskPacket: result?.receipt?.taskPacket ?? null, compositionGraph: result?.receipt?.compositionGraph ?? null,
    contextRefs: result?.receipt?.contextRefs ?? [], evidenceRefs: result?.receipt?.evidenceRefs ?? [],
    gates: result?.receipt?.gates ?? { quality: [], safety: [] }, risk: result?.receipt?.risk ?? null,
    continuity: result?.receipt?.continuity ?? { state: 'UNAVAILABLE', automaticResumeAllowed: false },
    fallback: selectedPath === 'legacy' ? { active: true, reason, priorPath: controller.priorPath } : { active: false, priorPath: controller.priorPath },
    outcome: selectedPath === 'v2' ? 'V2_CANARY_SELECTED' : 'LEGACY_FALLBACK_SELECTED',
    sideEffects: { providerCalls: 0, writesPerformed: 0, executionReady: false }, rawPromptStored: false,
    transcriptCanonical: false, executionPerformed: false
  };
}

function failureModeCapabilities(failureMode = null, namespace = 'universal.canary') {
  return failureMode && failureMode !== 'consumer_adapter_failure' ? [`${namespace}.${failureMode}`] : [];
}

export function runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput, fixtureId = 'unlabeled', currentState = {}, failureMode = null, catalog, repoRoot, generatedAt = '2026-09-02T00:00:00Z', model = null } = {}) {
  if (!controller || !adapter || controller.mode !== 'CANARY' || controller.consumer !== adapter.environmentId) throw new Error('universal_canary:matching_controller_and_adapter_required');
  if (!ACTIVE_STATES.has(controller.state)) {
    const receipt = failureReceipt({ controller, fixtureId, selectedPath: 'legacy', reason: 'canary_disabled' });
    return { fixtureId, selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'canary_disabled', v2: null, receipt, priorPath: controller.priorPath };
  }
  if (failureMode === 'consumer_adapter_failure') {
    const receipt = failureReceipt({ controller, fixtureId, selectedPath: 'legacy', reason: 'consumer_adapter_failure' });
    return { fixtureId, selectedPath: 'legacy', state: 'DEGRADED', reason: 'consumer_adapter_failure', v2: null, receipt, priorPath: controller.priorPath };
  }
  const metadata = { session: nativeInput?.session ?? null, workspace: nativeInput?.workspace ?? null, requiredCapabilities: failureModeCapabilities(failureMode, controller.failureNamespace) };
  const request = adapter.translate(nativeInput, metadata);
  const v2 = orchestrateBrainRequest(request, { catalog, repoRoot, currentState: currentState ?? {}, generatedAt });
  const route = v2.route;
  const risk = route?.riskClass ?? null;
  let reason = null;
  if (v2.taskPacket?.sourceRevision !== controller.sourceRevision) reason = 'source_revision_changed';
  else if (['high', 'critical'].includes(risk)) reason = 'high_risk_legacy_boundary';
  else if (v2.status === 'BLOCKED') reason = 'universal_result_blocked';
  else if (v2.continuation?.state !== 'CURRENT') reason = `continuity_${String(v2.continuation?.state ?? 'unavailable').toLowerCase()}`;
  else if (!(controller.allowedRouteFamilies ?? [controller.domain]).includes(route?.primaryRouteFamily)) reason = controller.outOfScopeReason ?? `outside_bounded_${controller.domain}_canary_scope`;
  else if (v2.safety?.providerCalls !== 0 || v2.safety?.writesPerformed !== 0 || v2.safety?.executionReady) reason = 'safety_boundary_failure';
  const selectedPath = reason ? 'legacy' : 'v2';
  const receipt = failureReceipt({ controller, fixtureId, selectedPath, reason, requestHash: v2.receipt.requestHash, result: v2 });
  return { fixtureId, selectedPath, state: selectedPath === 'v2' ? 'CANARY_ACTIVE' : 'DEGRADED', reason, v2, receipt, priorPath: controller.priorPath, model };
}

export function universalConsumerCanarySnapshot(controller) {
  return { consumer: controller.consumer, domain: controller.domain, allowedRouteFamilies: [...(controller.allowedRouteFamilies ?? [controller.domain])], mode: controller.mode, adapterId: controller.adapterId, sourceRevision: controller.sourceRevision, activationReason: controller.activationReason, failureNamespace: controller.failureNamespace, outOfScopeReason: controller.outOfScopeReason, universalContractVersion: controller.universalContractVersion, status: controller.state, activationPerformed: controller.activationPerformed, productionActive: controller.productionActive, priorPath: controller.priorPath, history: clone(controller.history) };
}
