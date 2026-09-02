import { createReferenceEnvironmentAdapter, UNIVERSAL_CONTRACT_VERSION } from './universal-consumer-contract.mjs';

export const CODEX_RESEARCH_ADAPTER_ID = 'adapter.codex-research.v1';
export const CODEX_RESEARCH_ADAPTER_REVISION = 'codex-research-adapter@1.0.0';
export const CODEX_RESEARCH_CAPABILITIES = Object.freeze([
  { capabilityId: 'brain.contract.v1', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.route', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.packet', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.context', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.receipt', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.continuity', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'workspace.resolve', available: true, outcome: 'SUPPORTED', mode: 'filesystem' },
  { capabilityId: 'observations.translate', available: true, outcome: 'SUPPORTED', mode: 'shell' },
  { capabilityId: 'approved.actions', available: false, outcome: 'UNAVAILABLE', mode: 'disabled-read-only' },
  { capabilityId: 'continuation.expose', available: true, outcome: 'SUPPORTED', mode: 'session' }
]);

export function createCodexResearchAdapter() {
  const universal = createReferenceEnvironmentAdapter({ adapterId: CODEX_RESEARCH_ADAPTER_ID, environmentId: 'codex', capabilities: CODEX_RESEARCH_CAPABILITIES });
  return Object.freeze({
    adapterId: CODEX_RESEARCH_ADAPTER_ID, adapterRevision: CODEX_RESEARCH_ADAPTER_REVISION, environmentId: 'codex', contractVersion: UNIVERSAL_CONTRACT_VERSION,
    translate(nativeInput, metadata = {}) { return universal.translate(nativeInput, { ...metadata, environment: { ...(metadata.environment ?? {}), environmentId: 'codex', capabilities: CODEX_RESEARCH_CAPABILITIES } }); },
    consume(nativeInput, metadata = {}, options = {}) { return universal.consume(nativeInput, { ...metadata, environment: { ...(metadata.environment ?? {}), environmentId: 'codex', capabilities: CODEX_RESEARCH_CAPABILITIES } }, options); },
    render(result) { return universal.render(result); },
    capabilities() { return universal.capabilities(); }
  });
}
