import crypto from 'node:crypto';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { createClaudeCodeAdapter, CLAUDE_CODE_ADAPTER_REVISION } from './claude-code-consumer-adapter.mjs';

const STATES = Object.freeze({ code: 'CODE_V2_DEFAULT_FOR_CLAUDE_CODE', research: 'RESEARCH_V2_DEFAULT_FOR_CLAUDE_CODE' });
const repoRoot = new URL('../..', import.meta.url).pathname;
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }

export function createClaudeCodeDefaultController({ domain, sourceRevision = 'unknown', activationTimestamp = null } = {}) {
  if (!STATES[domain]) throw new Error(`claude_code_default:unsupported_domain:${domain}`);
  return { consumer: 'claude-code', domain, mode: 'DEFAULT', state: 'CANARY_ACCEPTED', defaultActive: false, productionActive: false, activationPerformed: false, sourceRevision, adapterRevision: CLAUDE_CODE_ADAPTER_REVISION, universalContractVersion: '1.0.0', priorPath: `claude-code-current-${domain}-entry`, activationTimestamp, history: [{ from: null, to: 'CANARY_ACCEPTED', reason: 'accepted_canary_input', timestamp: activationTimestamp }] };
}

function transition(controller, nextState, reason, timestamp = null) {
  const valid = (controller.state === 'CANARY_ACCEPTED' && nextState === STATES[controller.domain]) || (controller.state === STATES[controller.domain] && nextState === 'ROLLED_BACK') || (controller.state === 'ROLLED_BACK' && nextState === STATES[controller.domain]);
  if (!valid) throw new Error(`claude_code_default:invalid_transition:${controller.state}->${nextState}`);
  const active = nextState === STATES[controller.domain];
  return { ...clone(controller), state: nextState, defaultActive: active, productionActive: false, activationPerformed: true, history: [...controller.history, { from: controller.state, to: nextState, reason, timestamp: timestamp ?? new Date().toISOString() }] };
}

export function promoteClaudeCodeDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('claude_code_default:preflight_required');
  return transition(controller, STATES[controller.domain], 'sequential rollout stage acceptance and promotion gates passed', timestamp);
}
export function rollbackClaudeCodeDefault(controller, { timestamp = null } = {}) {
  const next = transition(controller, 'ROLLED_BACK', 'independent Claude Code default rollback to prior path', timestamp);
  return { ...next, rollback: { passed: true, priorPath: next.priorPath, v2Invoked: false, automaticReplay: false, manualConfigSurgeryRequired: false } };
}
export function restoreClaudeCodeDefault(controller, { preflight = null, timestamp = null } = {}) {
  if (!preflight?.passed) throw new Error('claude_code_default:restore_preflight_required');
  return transition(controller, STATES[controller.domain], 'post-rollback preflight passed; restore default', timestamp);
}

function fallbackReason(result, controller, failureMode) {
  if (!controller.defaultActive) return 'default_disabled';
  if (failureMode) return `controlled_failure_${failureMode}`;
  if (!result) return 'v2_result_unavailable';
  if (result.status === 'BLOCKED') return 'universal_result_blocked';
  if (result.route?.primaryRouteFamily !== controller.domain) return `outside_${controller.domain}_default_scope`;
  if (['high', 'critical'].includes(result.route?.normalizedRequest?.riskClass)) return 'high_risk_legacy_boundary';
  if (result.continuation?.state !== 'CURRENT') return `continuity_${String(result.continuation?.state ?? 'unavailable').toLowerCase()}`;
  if (result.safety?.providerCalls !== 0 || result.safety?.writesPerformed !== 0 || result.safety?.executionReady) return 'safety_boundary_failure';
  return null;
}

export function runClaudeCodeDefaultInvocation({ controller, prompt = '', fixtureId = 'unlabeled', currentState = {}, failureMode = null, catalog = null, model = 'claude-code-default' } = {}) {
  if (!controller || controller.consumer !== 'claude-code' || controller.mode !== 'DEFAULT') throw new Error('claude_code_default:controller_required');
  const priorPath = { name: controller.priorPath, available: true };
  if (!controller.defaultActive) return { selectedPath: 'legacy', state: 'ROLLED_BACK', reason: 'default_disabled', v2: null, priorPath, receipt: { receiptId: `claude-code-default-${hash(`${fixtureId}:disabled`)}`, fallback: { active: true, reason: 'default_disabled', priorPath: priorPath.name }, rawPromptStored: false, executionPerformed: false, safety: { providerCalls: 0, writesPerformed: 0, executionReady: false } } };
  const adapter = createClaudeCodeAdapter();
  const v2 = adapter.consume({ id: fixtureId, message: prompt, workspace: { boundary: repoRoot, resolved: true }, session: { id: `claude-default-${fixtureId}`, resumable: true } }, { requiredCapabilities: failureMode ? [`brain.failure.${failureMode}`] : [] }, { repoRoot, catalog: catalog ?? createCapabilityCatalog({ repoRoot, sourceRevision: controller.sourceRevision }), currentState });
  const reason = fallbackReason(v2, controller, failureMode);
  const selectedPath = reason ? 'legacy' : 'v2';
  return { selectedPath, state: selectedPath === 'v2' ? STATES[controller.domain] : 'FALLBACK', reason, v2, priorPath, receipt: { receiptId: `claude-code-default-${hash(`${fixtureId}:${prompt}`)}`, brainRevision: controller.sourceRevision, consumer: 'claude-code', domain: controller.domain, mode: 'DEFAULT', defaultState: controller.state, defaultActive: controller.defaultActive, route: v2.receipt.route, qualification: v2.receipt.qualification, taskPacket: v2.receipt.taskPacket, compositionGraph: v2.receipt.compositionGraph, contextRefs: v2.receipt.contextRefs, evidenceRefs: v2.receipt.evidenceRefs, gates: v2.receipt.gates, continuity: v2.receipt.continuity, fallback: selectedPath === 'legacy' ? { active: true, reason, priorPath: priorPath.name } : { active: false, priorPath: priorPath.name }, outcome: selectedPath === 'v2' ? `${controller.domain.toUpperCase()}_V2_DEFAULT_SELECTED` : 'LEGACY_FALLBACK_SELECTED', safety: v2.safety, rawPromptStored: false, executionPerformed: false } };
}

export function claudeCodeDefaultState(controller) { return { consumer: controller.consumer, domain: controller.domain, mode: controller.mode, status: controller.state, defaultActive: controller.defaultActive, productionActive: controller.productionActive, activationPerformed: controller.activationPerformed, priorPath: controller.priorPath, adapterRevision: controller.adapterRevision, history: clone(controller.history) }; }
export const claudeCodeDefaultStates = STATES;
