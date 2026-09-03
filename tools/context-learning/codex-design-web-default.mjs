import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { createCodexDesignWebAdapter, CODEX_DESIGN_WEB_ADAPTER_REVISION } from './codex-design-web-consumer-adapter.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
export const CODEX_DESIGN_WEB_DEFAULT_STATE = 'DESIGN_WEB_V2_DEFAULT_FOR_CODEX';
export const CODEX_DESIGN_WEB_DEFAULT_CONTRACT_VERSION = '1.0.0';
export const CODEX_DESIGN_WEB_DEFAULT_SPEC = Object.freeze({
  activationId: 'codex-design-web-v2-default', consumer: 'codex', domain: 'design-web', mode: 'DEFAULT',
  universalConsumerContractVersion: CODEX_DESIGN_WEB_DEFAULT_CONTRACT_VERSION,
  adapterRevision: CODEX_DESIGN_WEB_ADAPTER_REVISION, priorPath: 'codex-current-design-web-entry'
});

export function validateCodexDesignWebDefaultSpec(spec) {
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-design-web-default.v1.schema.json'), 'utf8'));
  const required = schema.required.filter((key) => !(key in spec));
  const constants = [['schemaVersion', '1.0.0'], ['consumer', 'codex'], ['domain', 'design-web'], ['mode', 'DEFAULT'], ['universalConsumerContractVersion', '1.0.0'], ['productionActive', false]];
  const constantMismatches = constants.filter(([key, value]) => spec[key] !== value).map(([key]) => key);
  return { valid: required.length === 0 && constantMismatches.length === 0, required, constantMismatches, schemaVersion: schema.$schema };
}

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function timestampOrNow(timestamp) { return timestamp ?? new Date().toISOString(); }

export function createCodexDesignWebDefaultController({ sourceRevision = 'unknown', activationTimestamp = null } = {}) {
  return { ...clone(CODEX_DESIGN_WEB_DEFAULT_SPEC), sourceRevision, state: 'CANARY_ACCEPTED', enabled: false, defaultActive: false, productionActive: false, activationPerformed: false, activationTimestamp,
    history: [{ from: null, to: 'CANARY_ACCEPTED', reason: 'accepted_canary_input', timestamp: activationTimestamp }] };
}

function transition(controller, nextState, reason, timestamp) {
  const valid = (controller.state === 'CANARY_ACCEPTED' && nextState === CODEX_DESIGN_WEB_DEFAULT_STATE)
    || (controller.state === CODEX_DESIGN_WEB_DEFAULT_STATE && nextState === 'ROLLED_BACK')
    || (controller.state === 'ROLLED_BACK' && nextState === CODEX_DESIGN_WEB_DEFAULT_STATE);
  if (!valid) throw new Error(`codex_design_web_default:invalid_transition:${controller.state}->${nextState}`);
  const active = nextState === CODEX_DESIGN_WEB_DEFAULT_STATE;
  return { ...clone(controller), state: nextState, enabled: active, defaultActive: active, productionActive: false, activationPerformed: true,
    history: [...controller.history, { from: controller.state, to: nextState, reason, timestamp: timestampOrNow(timestamp) }] };
}

export function promoteCodexDesignWebDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_design_web_default:preflight_required');
  return transition(controller, CODEX_DESIGN_WEB_DEFAULT_STATE, 'Phase 9A CANARY_ACCEPTED and PROMOTION_READY gates passed', timestamp);
}
export function rollbackCodexDesignWebDefault(controller, { timestamp = null } = {}) {
  const next = transition(controller, 'ROLLED_BACK', 'live Design/Web default rollback: restore prior Codex entry', timestamp);
  return { ...next, selectedPath: 'legacy', rollback: { passed: true, legacyPath: next.priorPath, v2Invoked: false, manualConfigSurgeryRequired: false, elapsedSeconds: 0 } };
}
export function restoreCodexDesignWebDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('codex_design_web_default:restore_preflight_required');
  return transition(controller, CODEX_DESIGN_WEB_DEFAULT_STATE, 'post-rollback Design/Web preflight passed; restore default', timestamp);
}

function fallbackReason(result, controller, failureMode) {
  if (!controller.defaultActive) return 'default_disabled';
  if (failureMode) return `controlled_failure_${failureMode}`;
  if (!result) return 'v2_result_unavailable';
  if (result.sourceRevisions?.some?.((item) => item !== controller.sourceRevision)) return 'source_revision_changed';
  if (result.status === 'BLOCKED') return 'universal_result_blocked';
  if (!['design', 'mixed'].includes(result.route?.primaryRouteFamily)) return 'outside_design_web_default_scope';
  if (['high', 'critical'].includes(result.route?.normalizedRequest?.riskClass)) return 'high_risk_legacy_boundary';
  if (result.continuation?.state !== 'CURRENT') return `continuity_${String(result.continuation?.state ?? 'unavailable').toLowerCase()}`;
  if (result.safety?.providerCalls !== 0 || result.safety?.writesPerformed !== 0 || result.safety?.executionReady) return 'safety_boundary_failure';
  if (result.validation?.valid === false) return 'validation_failure';
  return null;
}

function receipt(controller, result, prompt, fixtureId, selectedPath, reason, model) {
  return { schemaVersion: CODEX_DESIGN_WEB_DEFAULT_CONTRACT_VERSION, receiptId: `codex-design-web-default-${hash(`${fixtureId}:${prompt}`)}`,
    brainRevision: controller.sourceRevision, universalConsumerContractVersion: controller.universalConsumerContractVersion, adapterRevision: controller.adapterRevision,
    consumer: controller.consumer, domain: controller.domain, mode: controller.mode, defaultState: controller.state, defaultActive: controller.defaultActive,
    requestHash: hash(prompt), fixtureId, model, route: result?.receipt?.route ?? null, qualification: result?.receipt?.qualification ?? null,
    taskPacket: result?.receipt?.taskPacket ?? null, graph: result?.receipt?.compositionGraph ?? null, contextRefs: result?.receipt?.contextRefs ?? [],
    evidenceRefs: result?.receipt?.evidenceRefs ?? [], gates: result?.receipt?.gates ?? { quality: [], safety: [] }, continuity: result?.receipt?.continuity ?? null,
    fallback: selectedPath === 'legacy' ? { active: true, reason, priorPath: controller.priorPath } : { active: false, priorPath: controller.priorPath },
    outcome: selectedPath === 'v2' ? 'DESIGN_WEB_V2_DEFAULT_SELECTED' : 'LEGACY_FALLBACK_SELECTED',
    safety: result?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false }, executionPerformed: false, productionActive: false,
    privacy: { rawPromptStored: false, rawContextStored: false, secretsStored: false, transcriptsStored: false } };
}

export function runCodexDesignWebDefaultInvocation({ controller, prompt = '', fixtureId = 'phase9b-unlabeled', currentState = {}, failureMode = null, catalog = null, repoRoot: root = repoRoot, model = 'codex-design-web-default' } = {}) {
  if (!controller || controller.consumer !== 'codex' || controller.domain !== 'design-web' || controller.mode !== 'DEFAULT') throw new Error('codex_design_web_default:controller_required');
  const adapter = createCodexDesignWebAdapter();
  if (!controller.defaultActive) return { selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'default_disabled', v2: null, priorPath: { name: controller.priorPath, available: true }, receipt: receipt(controller, null, prompt, fixtureId, 'legacy', 'default_disabled', model) };
  const nativeInput = { id: fixtureId, message: prompt, requiredCapabilities: ['workspace.read', 'workspace.write', 'frontend.implementation', 'browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction', 'image.reference', 'tests.run'], workspace: { boundary: root, resolved: true }, session: { id: `phase9b-${fixtureId}`, resumable: true } };
  const requiredCapabilities = failureMode ? [`brain.failure.${failureMode}`] : [];
  const v2 = adapter.consume(nativeInput, { requiredCapabilities }, { repoRoot: root, catalog: catalog ?? createCapabilityCatalog({ repoRoot: root, sourceRevision: controller.sourceRevision }), currentState });
  const reason = fallbackReason(v2, controller, failureMode);
  const selectedPath = reason ? 'legacy' : 'v2';
  return { selectedPath, state: selectedPath === 'v2' ? CODEX_DESIGN_WEB_DEFAULT_STATE : 'FALLBACK', reason, v2, priorPath: { name: controller.priorPath, available: true }, receipt: receipt(controller, v2, prompt, fixtureId, selectedPath, reason, model) };
}

export function defaultDesignWebContractSnapshot(controller) { return { schemaVersion: CODEX_DESIGN_WEB_DEFAULT_CONTRACT_VERSION, ...clone(CODEX_DESIGN_WEB_DEFAULT_SPEC), sourceRevision: controller.sourceRevision, status: controller.state, defaultActive: controller.defaultActive, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, history: clone(controller.history) }; }
