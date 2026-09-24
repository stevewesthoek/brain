import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { AmazonBedrockModelGateway } from '../adapters/amazon-bedrock-model-gateway.js';
import { CLAUDE_CODE_RUNTIME_REF, MODEL_GATEWAY_RUNTIME_REF } from './child-assignment.js';
import { deriveJarvisModelAdmissions, JARVIS_AUTO_MODEL_CANDIDATES, type JarvisModelAdmission } from './jarvis-runtime-routing.js';
import type { AdmittedModelRef, ModelAccessEvidence, ModelGateway } from './model-gateway.js';
import { ClaudeCodeAgentRuntime } from './claude-code-agent-runtime.js';
import { ModelGatewayAgentRuntime } from './model-gateway-agent-runtime.js';
import type { AgentRuntime, AgentRuntimeExecutionContext, AgentRuntimeResult, AgentRuntimeReconciliation } from './runtime-dispatch.js';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const JARVIS_UNAVAILABLE_MODEL_REFS_ENV = 'BRAIN_AGENT_MODE_UNAVAILABLE_MODEL_REFS';

export type JarvisProductionRuntimeConfiguration = {
  /** Canonical policy-admitted model set consumed by Auto and Jev. */
  availableModels: ReadonlySet<AdmittedModelRef>;
  /** Runtime discovery only; never sufficient for Auto admission. */
  runtimeAvailableModels?: ReadonlySet<AdmittedModelRef>;
  modelAdmissions?: readonly JarvisModelAdmission[];
  runtimeFactory: (store: AgentModeSqliteStateStore) => AgentRuntime;
};

class RoutedJarvisRuntime implements AgentRuntime {
  constructor(private readonly gatewayRuntime: AgentRuntime | undefined, private readonly claudeRuntime: AgentRuntime | undefined) {}
  run(input: { context: AgentRuntimeExecutionContext; signal: AbortSignal; isCancellationRequested: () => boolean }): Promise<AgentRuntimeResult> {
    const runtime = input.context.runtimeRef === MODEL_GATEWAY_RUNTIME_REF ? this.gatewayRuntime : input.context.runtimeRef === CLAUDE_CODE_RUNTIME_REF ? this.claudeRuntime : undefined;
    if (!runtime) return Promise.resolve({ status: 'failed', runtimeReceiptId: `runtime-receipt:jarvis:unavailable:${input.context.attemptId}`, resultHash: '0'.repeat(64), evidenceRef: null, usage: { steps: 0, tokens: 0, cost: 0 }, failureCode: 'RUNTIME_UNAVAILABLE', traceSummary: ['configured production runtime unavailable'] });
    return runtime.run(input);
  }
  async reconcile(input: { context: AgentRuntimeExecutionContext }): Promise<AgentRuntimeReconciliation> {
    const runtime = input.context.runtimeRef === MODEL_GATEWAY_RUNTIME_REF ? this.gatewayRuntime : input.context.runtimeRef === CLAUDE_CODE_RUNTIME_REF ? this.claudeRuntime : undefined;
    return runtime?.reconcile ? runtime.reconcile(input) : { status: 'unsupported' };
  }
}

function commandAvailable(command: string): boolean {
  if (command.includes('/')) return existsSync(command);
  return spawnSync(command, ['--version'], { env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '' }, timeout: 2_000 }).error === undefined;
}

function parseEvidence(): Partial<Record<AdmittedModelRef, ModelAccessEvidence>> {
  const raw = process.env.BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON;
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    if (typeof record.modelRef === 'string') return { [record.modelRef]: record as unknown as ModelAccessEvidence };
    return Object.fromEntries(Object.entries(record).filter(([key, evidence]) => JARVIS_AUTO_MODEL_CANDIDATES.includes(key as AdmittedModelRef) && evidence && typeof evidence === 'object')) as Partial<Record<AdmittedModelRef, ModelAccessEvidence>>;
  } catch { return {}; }
}

/** Parse a closed, operator-supplied temporary unavailability list. Unknown refs fail closed. */
export function parseUnavailableModelRefs(raw: string | undefined): ReadonlySet<AdmittedModelRef> | undefined {
  if (raw === undefined || raw.trim() === '') return new Set();
  const refs = raw.split(',').map((value) => value.trim());
  if (refs.some((value) => !value || !JARVIS_AUTO_MODEL_CANDIDATES.includes(value as AdmittedModelRef))) return undefined;
  return new Set(refs as AdmittedModelRef[]);
}

/** Production is opt-in: no environment variable means RC23 remains fail-closed. */
export function loadJarvisProductionRuntimeConfiguration(now = new Date().toISOString(), gateway?: ModelGateway): JarvisProductionRuntimeConfiguration | undefined {
  if (process.env.BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME !== '1') return undefined;
  const unavailable = parseUnavailableModelRefs(process.env[JARVIS_UNAVAILABLE_MODEL_REFS_ENV]);
  if (!unavailable) return undefined;
  const evidence = parseEvidence();
  const runtimeAvailable = new Set<AdmittedModelRef>();
  const accountRef = process.env.BRAIN_AGENT_MODE_ACCOUNT_REF;
  const modelGateway = accountRef ? (gateway ?? new AmazonBedrockModelGateway({ accountRef })) : undefined;
  for (const modelRef of ['agent-mode/minimax-m2.5', 'agent-mode/glm-5'] as const) {
    const item = evidence[modelRef];
    if (!unavailable.has(modelRef) && modelGateway && item?.state === 'verified' && item.catalogVisible && item.callable && Date.parse(item.checkedAt) <= Date.parse(now) && Date.parse(now) < Date.parse(item.freshUntil)) runtimeAvailable.add(modelRef);
  }
  const claudeCommand = process.env.BRAIN_CLAUDE_CODE_BIN ?? 'claude';
  if (!unavailable.has('agent-mode/claude-opus-4.6') && process.env.BRAIN_AGENT_MODE_ENABLE_CLAUDE_CODE === '1' && commandAvailable(claudeCommand)) runtimeAvailable.add('agent-mode/claude-opus-4.6');
  if (runtimeAvailable.size === 0) return undefined;
  const callableEvidence = Object.fromEntries(Object.entries(evidence).filter(([modelRef]) => !unavailable.has(modelRef as AdmittedModelRef))) as Partial<Record<AdmittedModelRef, ModelAccessEvidence>>;
  const admissions = deriveJarvisModelAdmissions(runtimeAvailable);
  const available = new Set(admissions.filter((candidate) => candidate.autoAdmitted).map((candidate) => candidate.modelRef));
  return { availableModels: available, runtimeAvailableModels: runtimeAvailable, modelAdmissions: admissions, runtimeFactory: (store) => new RoutedJarvisRuntime(modelGateway ? new ModelGatewayAgentRuntime(store, { gateway: modelGateway, accessEvidence: callableEvidence }) : undefined, runtimeAvailable.has('agent-mode/claude-opus-4.6') ? new ClaudeCodeAgentRuntime(store, claudeCommand) : undefined) };
}
