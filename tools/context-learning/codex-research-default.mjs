import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { buildCodexPriorPath, runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { CODEX_RESEARCH_ADAPTER_REVISION } from './codex-research-consumer-adapter.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
export const CODEX_RESEARCH_DEFAULT_STATE = Object.freeze('RESEARCH_V2_DEFAULT_FOR_CODEX');
export const CODEX_RESEARCH_DEFAULT_CONTRACT_VERSION = '1.0.0';
export const CODEX_RESEARCH_DEFAULT_SPEC = Object.freeze({
  activationId: 'codex-research-v2-default', consumer: 'codex', domain: 'research', mode: 'DEFAULT',
  universalConsumerContractVersion: CODEX_RESEARCH_DEFAULT_CONTRACT_VERSION,
  adapterRevision: CODEX_RESEARCH_ADAPTER_REVISION, priorPath: 'codex-current-research-entry'
});
const DEFAULT_STATES = Object.freeze(['CANARY_ACCEPTED', CODEX_RESEARCH_DEFAULT_STATE, 'ROLLED_BACK']);

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function timestampOrNow(timestamp) { return timestamp ?? new Date().toISOString(); }

export function validateCodexResearchDefaultSpec(spec) {
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-research-default.v1.schema.json'), 'utf8'));
  const required = schema.required.filter((key) => !(key in spec));
  const constants = [['schemaVersion', '1.0.0'], ['consumer', 'codex'], ['domain', 'research'], ['mode', 'DEFAULT'], ['universalConsumerContractVersion', '1.0.0'], ['productionActive', false]];
  const constantMismatches = constants.filter(([key, value]) => spec[key] !== value).map(([key]) => key);
  return { valid: required.length === 0 && constantMismatches.length === 0, required, constantMismatches, schemaVersion: schema.$schema };
}

export function createCodexResearchDefaultController({ sourceRevision = 'unknown', adapterRevision = CODEX_RESEARCH_DEFAULT_SPEC.adapterRevision, activationTimestamp = null } = {}) {
  return {
    activationId: CODEX_RESEARCH_DEFAULT_SPEC.activationId, consumer: 'codex', domain: 'research', mode: 'DEFAULT',
    sourceRevision, universalConsumerContractVersion: CODEX_RESEARCH_DEFAULT_CONTRACT_VERSION, adapterRevision,
    state: 'CANARY_ACCEPTED', enabled: false, defaultActive: false, productionActive: false, activationPerformed: false,
    priorPath: 'codex-current-research-entry', activationTimestamp,
    history: [{ from: null, to: 'CANARY_ACCEPTED', reason: 'accepted_canary_input', timestamp: activationTimestamp }]
  };
}

function transition(controller, nextState, { reason, timestamp } = {}) {
  const valid = nextState === CODEX_RESEARCH_DEFAULT_STATE && controller.state === 'CANARY_ACCEPTED'
    || nextState === 'ROLLED_BACK' && controller.state === CODEX_RESEARCH_DEFAULT_STATE
    || nextState === CODEX_RESEARCH_DEFAULT_STATE && controller.state === 'ROLLED_BACK';
  if (!valid) throw new Error(`codex_research_default:invalid_transition:${controller.state}->${nextState}`);
  const active = nextState === CODEX_RESEARCH_DEFAULT_STATE;
  return { ...clone(controller), state: nextState, enabled: active, defaultActive: active, productionActive: false, activationPerformed: true, history: [...controller.history, { from: controller.state, to: nextState, reason: reason ?? 'explicit_transition', timestamp: timestampOrNow(timestamp) }] };
}

export function promoteCodexResearchDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_research_default:preflight_required');
  return transition(controller, CODEX_RESEARCH_DEFAULT_STATE, { reason: 'Phase 8C authority gate and Phase 8D promotion authorization passed', timestamp });
}

export function rollbackCodexResearchDefault(controller, { timestamp = null } = {}) {
  const next = transition(controller, 'ROLLED_BACK', { reason: 'live Research default rollback: restore prior Codex Research entry', timestamp });
  return { ...next, selectedPath: 'legacy', rollback: { passed: true, legacyPath: next.priorPath, v2Invoked: false, manualConfigSurgeryRequired: false, elapsedSeconds: 0 } };
}

export function restoreCodexResearchDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_research_default:restore_preflight_required');
  return transition(controller, CODEX_RESEARCH_DEFAULT_STATE, { reason: 'post-rollback Research preflight passed; restore default', timestamp });
}

function fallbackReason(result, controller, priorPath, failureMode) {
  if (!controller.defaultActive) return 'default_disabled';
  if (!priorPath.available) return 'legacy_path_unavailable';
  if (failureMode) return `controlled_failure_${failureMode}`;
  if (!result) return 'v2_result_unavailable';
  if (result.sourceRevision !== controller.sourceRevision) return 'source_revision_changed';
  if (result.fallback?.active) return result.fallback.reason ?? 'v2_fallback';
  if (result.route?.primaryRouteFamily !== 'research') return 'outside_research_default_scope';
  if (['high', 'critical'].includes(result.route?.normalizedRequest?.riskClass)) return 'high_risk_legacy_boundary';
  if (result.continuity?.state !== 'CURRENT') return `continuity_${String(result.continuity?.state ?? 'unavailable').toLowerCase()}`;
  if (result.safety?.writes !== 0 || result.safety?.providerCalls !== 0 || result.safety?.executionAttempts !== 0 || result.safety?.executionReady) return 'safety_gate_failure';
  if (result.validation?.valid === false) return 'validation_failure';
  return null;
}

function makeReceipt({ controller, result, prompt, fixtureId, selectedPath, reason, priorPath, sourceRevision, model = 'codex-research-default' }) {
  const route = result?.route;
  return {
    schemaVersion: CODEX_RESEARCH_DEFAULT_CONTRACT_VERSION,
    receiptId: `codex-research-default-${hash(`${fixtureId}:${sourceRevision}:${prompt}`)}`,
    brainRevision: sourceRevision, universalConsumerContractVersion: controller.universalConsumerContractVersion,
    adapterRevision: controller.adapterRevision, consumer: 'codex', domain: 'research', mode: 'DEFAULT',
    defaultState: controller.state, defaultActive: controller.defaultActive, activationPerformed: controller.activationPerformed,
    requestHash: hash(prompt), fixtureId, model,
    route: route ? { family: route.primaryRouteFamily, owner: route.primaryDescriptorId ?? null, specialists: route.selectedSpecialistDescriptorIds ?? [], riskClass: route.normalizedRequest?.riskClass ?? null } : null,
    qualification: result?.qualification ? { required: result.qualification.required, count: result.qualification.count ?? 0, questionHash: result.qualification.question ? hash(result.qualification.question) : null } : null,
    taskPacket: result?.taskPacket ? { taskId: result.taskPacket.taskId, status: result.taskPacket.state?.status ?? null } : null,
    evidencePackets: result?.evidencePackets?.map((item) => item.evidenceId) ?? [],
    contextRequests: result?.contextRequests?.map((item) => item.requestId ?? item.contextPackRef ?? null).filter(Boolean) ?? [],
    gates: { quality: result?.taskPacket?.requiredQualityGates?.map((item) => item.gateRef) ?? [], safety: result?.taskPacket?.requiredSafetyGates?.map((item) => item.gateRef) ?? [] },
    continuity: result?.continuation?.state ?? 'UNAVAILABLE', metrics: result?.metrics ?? {},
    fallback: selectedPath === 'legacy' ? { active: true, reason, priorPath: priorPath.name } : { active: false, priorPath: priorPath.name },
    outcome: selectedPath === 'v2' ? 'RESEARCH_V2_DEFAULT_SELECTED' : 'LEGACY_FALLBACK_SELECTED',
    safety: result?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false },
    executionPerformed: false, productionActive: false,
    privacy: { rawPromptStored: false, rawContextStored: false, secretsStored: false, transcriptsStored: false }
  };
}

export function runCodexResearchDefaultInvocation({ controller, repoRoot: root = repoRoot, prompt = '', fixtureId = 'phase8d-unlabeled', currentState = {}, failureMode = null, catalog = null, model = 'codex-research-default' } = {}) {
  if (!controller || controller.consumer !== 'codex' || controller.domain !== 'research' || controller.mode !== 'DEFAULT') throw new Error('codex_research_default:codex_research_default_controller_required');
  const priorPath = buildCodexPriorPath({ repoRoot: root, name: 'codex-current-research-entry' });
  const sourceRevision = controller.sourceRevision;
  if (!controller.defaultActive) return { selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'default_disabled', v2: null, priorPath, receipt: makeReceipt({ controller, prompt, fixtureId, selectedPath: 'legacy', reason: 'default_disabled', priorPath, sourceRevision, model }) };
  const v2 = runCodexReadOnlyPilot({ repoRoot: root, prompt, fixtureId, catalog: catalog ?? createCapabilityCatalog({ repoRoot: root, sourceRevision }), currentState, priorPath: priorPath.name, failureMode });
  const reason = fallbackReason(v2, controller, priorPath, failureMode);
  const selectedPath = reason ? 'legacy' : 'v2';
  return { selectedPath, state: selectedPath === 'v2' ? CODEX_RESEARCH_DEFAULT_STATE : 'FALLBACK', reason, v2, priorPath, receipt: makeReceipt({ controller, result: v2, prompt, fixtureId, selectedPath, reason, priorPath, sourceRevision: v2?.sourceRevision ?? sourceRevision, model }) };
}

export function defaultResearchContractSnapshot(controller) {
  return { schemaVersion: CODEX_RESEARCH_DEFAULT_CONTRACT_VERSION, ...clone(CODEX_RESEARCH_DEFAULT_SPEC), sourceRevision: controller.sourceRevision, adapterRevision: controller.adapterRevision, status: controller.state, defaultActive: controller.defaultActive, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, history: clone(controller.history) };
}

export const codexResearchDefaultStates = DEFAULT_STATES;
