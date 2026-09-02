import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { buildCodexPriorPath, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
export const CODEX_CODE_DEFAULT_STATE = Object.freeze('CODE_V2_DEFAULT_FOR_CODEX');
export const CODEX_CODE_DEFAULT_CONTRACT_VERSION = '1.0.0';
export const CODEX_CODE_DEFAULT_SPEC = Object.freeze({
  activationId: 'codex-code-v2-default', consumer: 'codex', domain: 'code', mode: 'DEFAULT',
  universalConsumerContractVersion: CODEX_CODE_DEFAULT_CONTRACT_VERSION,
  adapterRevision: 'codex-canary-contract@1.0.0', priorPath: 'codex-current-entry'
});
const DEFAULT_STATES = Object.freeze(['CANARY_ACCEPTED', CODEX_CODE_DEFAULT_STATE, 'ROLLED_BACK']);

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function timestampOrNow(timestamp) { return timestamp ?? new Date().toISOString(); }

export function validateCodexCodeDefaultSpec(spec) {
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-code-default.v1.schema.json'), 'utf8'));
  const required = schema.required.filter((key) => !(key in spec));
  const constants = [['schemaVersion', '1.0.0'], ['consumer', 'codex'], ['domain', 'code'], ['mode', 'DEFAULT'], ['universalConsumerContractVersion', '1.0.0'], ['productionActive', false]];
  const constantMismatches = constants.filter(([key, value]) => spec[key] !== value).map(([key]) => key);
  return { valid: required.length === 0 && constantMismatches.length === 0, required, constantMismatches, schemaVersion: schema.$schema };
}

export function createCodexCodeDefaultController({ sourceRevision = 'unknown', adapterRevision = CODEX_CODE_DEFAULT_SPEC.adapterRevision, activationTimestamp = null } = {}) {
  return {
    activationId: CODEX_CODE_DEFAULT_SPEC.activationId, consumer: 'codex', domain: 'code', mode: 'DEFAULT',
    sourceRevision, universalConsumerContractVersion: CODEX_CODE_DEFAULT_CONTRACT_VERSION, adapterRevision,
    state: 'CANARY_ACCEPTED', enabled: false, defaultActive: false, productionActive: false, activationPerformed: false,
    priorPath: 'codex-current-entry', activationTimestamp,
    history: [{ from: null, to: 'CANARY_ACCEPTED', reason: 'accepted_canary_input', timestamp: activationTimestamp }]
  };
}

function transition(controller, nextState, { reason, timestamp } = {}) {
  const valid = nextState === CODEX_CODE_DEFAULT_STATE && controller.state === 'CANARY_ACCEPTED'
    || nextState === 'ROLLED_BACK' && controller.state === CODEX_CODE_DEFAULT_STATE
    || nextState === CODEX_CODE_DEFAULT_STATE && controller.state === 'ROLLED_BACK';
  if (!valid) throw new Error(`codex_code_default:invalid_transition:${controller.state}->${nextState}`);
  const active = nextState === CODEX_CODE_DEFAULT_STATE;
  return { ...clone(controller), state: nextState, enabled: active, defaultActive: active, productionActive: false, activationPerformed: true, history: [...controller.history, { from: controller.state, to: nextState, reason: reason ?? 'explicit_transition', timestamp: timestampOrNow(timestamp) }] };
}

export function promoteCodexCodeDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_code_default:preflight_required');
  return transition(controller, CODEX_CODE_DEFAULT_STATE, { reason: 'Phase 7A preflight and promotion gates passed', timestamp });
}

export function rollbackCodexCodeDefault(controller, { timestamp = null } = {}) {
  const next = transition(controller, 'ROLLED_BACK', { reason: 'live rollback drill: restore legacy Codex entry', timestamp });
  return { ...next, selectedPath: 'legacy', rollback: { passed: true, legacyPath: next.priorPath, v2Invoked: false, manualConfigSurgeryRequired: false, elapsedSeconds: 0 } };
}

export function restoreCodexCodeDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_code_default:restore_preflight_required');
  return transition(controller, CODEX_CODE_DEFAULT_STATE, { reason: 'post-rollback preflight passed; restore default', timestamp });
}

function fallbackReason(result, controller, priorPath, failureMode) {
  if (!controller.defaultActive) return 'default_disabled';
  if (!priorPath.available) return 'legacy_path_unavailable';
  if (failureMode) return `controlled_failure_${failureMode}`;
  if (!result) return 'v2_result_unavailable';
  if (result.sourceRevision !== controller.sourceRevision) return 'source_revision_changed';
  if (result.fallback?.active) return result.fallback.reason ?? 'v2_fallback';
  if (result.route?.primaryRouteFamily !== 'code') return 'outside_code_default_scope';
  if (['high', 'critical'].includes(result.route?.normalizedRequest?.riskClass)) return 'high_risk_legacy_boundary';
  if (result.continuity?.state !== 'CURRENT') return `continuity_${String(result.continuity?.state ?? 'unavailable').toLowerCase()}`;
  if (result.safety?.writes !== 0 || result.safety?.providerCalls !== 0 || result.safety?.executionAttempts !== 0) return 'safety_gate_failure';
  if (result.validation?.valid === false) return 'validation_failure';
  return null;
}

function makeReceipt({ controller, result, prompt, fixtureId, selectedPath, reason, priorPath, sourceRevision, model = 'codex-default' }) {
  const route = result?.route;
  return {
    schemaVersion: CODEX_CODE_DEFAULT_CONTRACT_VERSION,
    receiptId: `codex-code-default-${hash(`${fixtureId}:${sourceRevision}:${prompt}`)}`,
    brainRevision: sourceRevision, universalConsumerContractVersion: controller.universalConsumerContractVersion,
    adapterRevision: controller.adapterRevision, consumer: 'codex', domain: 'code', mode: 'DEFAULT',
    defaultState: controller.state, defaultActive: controller.defaultActive, activationPerformed: controller.activationPerformed,
    requestHash: hash(prompt), fixtureId, model,
    route: route ? { family: route.primaryRouteFamily, owner: route.primaryDescriptorId ?? null, riskClass: route.normalizedRequest?.riskClass ?? null } : null,
    qualification: result?.qualification ? { required: result.qualification.required, count: result.qualification.count ?? 0, questionHash: result.qualification.questionHash ?? null } : null,
    selectedCapabilities: result?.taskPacket?.selectedCapabilityRefs?.map((item) => item.capabilityId) ?? [],
    contextRefs: result?.taskPacket?.continuityRef ? [result.taskPacket.continuityRef] : [],
    taskPacketRef: result?.taskPacket?.taskId ? `task://${result.taskPacket.taskId}` : null,
    graphRef: result?.graph?.graphId ? `graph://${result.graph.graphId}` : null,
    gates: { quality: result?.graph?.qualityGateNodes ?? [], safety: result?.graph?.safetyGateNodes ?? [] },
    risk: route?.normalizedRequest?.riskClass ?? null, continuity: result?.continuity?.state ?? 'UNAVAILABLE',
    fallback: selectedPath === 'legacy' ? { active: true, reason, priorPath: priorPath.name } : { active: false, priorPath: priorPath.name },
    metrics: result?.metrics ?? {}, outcome: selectedPath === 'v2' ? 'CODE_V2_DEFAULT_SELECTED' : 'LEGACY_FALLBACK_SELECTED',
    safety: result?.safety ?? { writes: 0, providerCalls: 0, executionAttempts: 0 },
    executionPerformed: false, productionActive: false,
    privacy: { rawPromptStored: false, rawContextStored: false, secretsStored: false, transcriptsStored: false }
  };
}

export function runCodexCodeDefaultInvocation({ controller, repoRoot: root = repoRoot, prompt = '', fixtureId = 'phase7a-unlabeled', currentState = {}, failureMode = null, catalog = null, model = 'codex-default' } = {}) {
  if (!controller || controller.consumer !== 'codex' || controller.domain !== 'code' || controller.mode !== 'DEFAULT') throw new Error('codex_code_default:codex_code_default_controller_required');
  const priorPath = buildCodexPriorPath({ repoRoot: root });
  const sourceRevision = controller.sourceRevision;
  if (!controller.defaultActive) return { selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'default_disabled', v2: null, priorPath, receipt: makeReceipt({ controller, prompt, fixtureId, selectedPath: 'legacy', reason: 'default_disabled', priorPath, sourceRevision, model }) };
  const v2 = runCodexReadOnlyPilot({ repoRoot: root, prompt, fixtureId, catalog: catalog ?? createCapabilityCatalog({ repoRoot: root, sourceRevision }), currentState, priorPath: priorPath.name, failureMode });
  const reason = fallbackReason(v2, controller, priorPath, failureMode);
  const selectedPath = reason ? 'legacy' : 'v2';
  const result = { selectedPath, state: selectedPath === 'v2' ? CODEX_CODE_DEFAULT_STATE : 'FALLBACK', reason, v2, priorPath, receipt: makeReceipt({ controller, result: v2, prompt, fixtureId, selectedPath, reason, priorPath, sourceRevision: v2?.sourceRevision ?? sourceRevision, model }) };
  return result;
}

export function defaultContractSnapshot(controller) {
  return { schemaVersion: CODEX_CODE_DEFAULT_CONTRACT_VERSION, ...clone(CODEX_CODE_DEFAULT_SPEC), sourceRevision: controller.sourceRevision, adapterRevision: controller.adapterRevision, status: controller.state, defaultActive: controller.defaultActive, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, history: clone(controller.history) };
}

export const codexCodeDefaultStates = DEFAULT_STATES;
