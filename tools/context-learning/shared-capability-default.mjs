import { executeSharedVisualTask } from './shared-capability-runtime.mjs';

const ACTIVE = new Set(['CANARY_ACTIVE', 'CANARY_ACCEPTED', 'DEFAULT_ACTIVE']);
const TRANSITIONS = Object.freeze({ CONFORMANT: ['CANARY_ACTIVE'], CANARY_ACTIVE: ['CANARY_ACCEPTED', 'ROLLED_BACK'], CANARY_ACCEPTED: ['DEFAULT_ACTIVE', 'ROLLED_BACK'], DEFAULT_ACTIVE: ['ROLLED_BACK'], ROLLED_BACK: ['CONFORMANT', 'CANARY_ACTIVE', 'DEFAULT_ACTIVE'] });

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function createSharedCapabilityDefaultController({ consumer, domain = 'design-web', adapterId, sourceRevision = 'unknown', providerId, priorPath = `${consumer}-current-${domain}-entry`, activationTimestamp = null } = {}) {
  if (!consumer || !adapterId || !providerId) throw new Error('shared_capability_default:identity_required');
  return { consumer, domain, adapterId, providerId, sourceRevision, priorPath, mode: 'DEFAULT', state: 'CONFORMANT', defaultActive: false, productionActive: false, activationPerformed: false, history: [{ from: null, to: 'CONFORMANT', reason: 'provider_and_adapter_conformance_passed', timestamp: activationTimestamp }] };
}

function transition(controller, nextState, reason, timestamp = null) {
  if (!TRANSITIONS[controller?.state]?.includes(nextState)) throw new Error(`shared_capability_default:invalid_transition:${controller?.state}->${nextState}`);
  const active = ACTIVE.has(nextState) && nextState !== 'CANARY_ACTIVE';
  return { ...clone(controller), state: nextState, defaultActive: active, productionActive: false, activationPerformed: true, history: [...controller.history, { from: controller.state, to: nextState, reason, timestamp: timestamp ?? new Date().toISOString() }] };
}

export function activateSharedCapabilityCanary(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('shared_capability_default:preflight_required');
  return transition(controller, 'CANARY_ACTIVE', 'shared provider preflight and semantic parity passed', timestamp);
}
export function acceptSharedCapabilityCanary(controller, { evidence = null, timestamp = null } = {}) {
  if (!evidence?.passed) throw new Error('shared_capability_default:acceptance_evidence_required');
  return transition(controller, 'CANARY_ACCEPTED', 'burn-in, cohort, rendered QA, parity, safety, and rollback passed', timestamp);
}
export function promoteSharedCapabilityDefault(controller, { evidence = null, timestamp = null } = {}) {
  if (!evidence?.passed) throw new Error('shared_capability_default:promotion_evidence_required');
  return transition(controller, 'DEFAULT_ACTIVE', 'default-path verification and rollback drill passed', timestamp);
}
export function rollbackSharedCapabilityDefault(controller, { timestamp = null } = {}) {
  const next = transition(controller, 'ROLLED_BACK', 'shared capability rollback to prior consumer path', timestamp);
  return { ...next, rollback: { passed: true, priorPath: next.priorPath, providerInvoked: false, automaticReplay: false } };
}
export function restoreSharedCapabilityDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('shared_capability_default:restore_preflight_required');
  return transition(controller, 'DEFAULT_ACTIVE', 'post-rollback provider preflight passed; restore default', timestamp);
}

export async function runSharedCapabilityDefaultInvocation({ controller, adapter, provider, nativeInput, workspace, artifact, viewport, actions, catalog, repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' } = {}) {
  if (!controller || controller.mode !== 'DEFAULT') throw new Error('shared_capability_default:controller_required');
  if (!controller.defaultActive) return { selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'default_disabled', result: null, receipt: { outcome: 'LEGACY_FALLBACK_SELECTED', providerInvoked: false, rawPromptStored: false, transcriptCanonical: false } };
  const result = await executeSharedVisualTask({ adapter, provider, nativeInput, workspace, artifact, viewport, actions, catalog, repoRoot, currentState, generatedAt });
  const selectedPath = result.receipt.outcome === 'VALIDATED' ? 'shared' : 'legacy';
  return { selectedPath, state: selectedPath === 'shared' ? 'DEFAULT_ACTIVE' : 'DEGRADED', reason: selectedPath === 'shared' ? null : result.receipt.failure ?? 'shared_capability_failed', result, receipt: { ...result.receipt, outcome: selectedPath === 'shared' ? 'SHARED_CAPABILITY_DEFAULT_SELECTED' : 'LEGACY_FALLBACK_SELECTED', providerInvoked: selectedPath === 'shared' } };
}
