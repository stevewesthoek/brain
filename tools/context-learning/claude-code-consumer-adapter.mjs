import { createReferenceEnvironmentAdapter, UNIVERSAL_CONTRACT_VERSION } from './universal-consumer-contract.mjs';

export const CLAUDE_CODE_ADAPTER_ID = 'adapter.claude-code.v1';
export const CLAUDE_CODE_ADAPTER_REVISION = 'claude-code-adapter@1.0.0';
export const CLAUDE_CODE_CAPABILITIES = Object.freeze([
  { capabilityId: 'brain.contract.v1', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.route', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.packet', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.context', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.receipt', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.continuity', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'workspace.resolve', available: true, outcome: 'SUPPORTED', mode: 'filesystem' },
  { capabilityId: 'observations.translate', available: true, outcome: 'SUPPORTED', mode: 'shell' },
  { capabilityId: 'approved.actions', available: true, outcome: 'SUPPORTED', mode: 'tool-confirmation' },
  { capabilityId: 'continuation.expose', available: true, outcome: 'SUPPORTED', mode: 'session' }
]);

export function createClaudeCodeAdapter() {
  const universal = createReferenceEnvironmentAdapter({ adapterId: CLAUDE_CODE_ADAPTER_ID, environmentId: 'claude-code', capabilities: CLAUDE_CODE_CAPABILITIES });
  return Object.freeze({
    adapterId: CLAUDE_CODE_ADAPTER_ID, adapterRevision: CLAUDE_CODE_ADAPTER_REVISION, environmentId: 'claude-code', contractVersion: UNIVERSAL_CONTRACT_VERSION,
    translate(nativeInput, metadata = {}) { return universal.translate(nativeInput, { ...metadata, environment: { ...(metadata.environment ?? {}), environmentId: 'claude-code', capabilities: CLAUDE_CODE_CAPABILITIES } }); },
    consume(nativeInput, metadata = {}, options = {}) { return universal.consume(nativeInput, { ...metadata, environment: { ...(metadata.environment ?? {}), environmentId: 'claude-code', capabilities: CLAUDE_CODE_CAPABILITIES } }, options); },
    render(result) { return universal.render(result); },
    capabilities() { return universal.capabilities(); }
  });
}
