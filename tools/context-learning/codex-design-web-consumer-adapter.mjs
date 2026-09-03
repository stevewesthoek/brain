import { createReferenceEnvironmentAdapter, UNIVERSAL_CONTRACT_VERSION } from './universal-consumer-contract.mjs';

export const CODEX_DESIGN_WEB_ADAPTER_ID = 'adapter.codex-design-web.v1';
export const CODEX_DESIGN_WEB_ADAPTER_REVISION = 'codex-design-web-adapter@1.0.0';

// These are environment facts, not routing policy. The Brain still owns route
// selection, qualification, packet decomposition, context, gates, and risk.
export const CODEX_DESIGN_WEB_CAPABILITIES = Object.freeze([
  { capabilityId: 'brain.contract.v1', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.route', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.packet', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.context', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.receipt', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'brain.continuity', available: true, outcome: 'SUPPORTED', mode: 'native' },
  { capabilityId: 'workspace.read', available: true, outcome: 'SUPPORTED', mode: 'filesystem' },
  { capabilityId: 'workspace.write', available: true, outcome: 'SUPPORTED', mode: 'isolated-fixture-only' },
  { capabilityId: 'frontend.implementation', available: true, outcome: 'SUPPORTED', mode: 'isolated-fixture-only' },
  { capabilityId: 'browser.render', available: true, outcome: 'SUPPORTED', mode: 'codex-in-app-browser' },
  { capabilityId: 'screenshot.capture', available: true, outcome: 'SUPPORTED', mode: 'codex-in-app-browser' },
  { capabilityId: 'visual.inspection', available: true, outcome: 'SUPPORTED', mode: 'codex-in-app-browser' },
  { capabilityId: 'functional.interaction', available: true, outcome: 'SUPPORTED', mode: 'codex-in-app-browser' },
  { capabilityId: 'image.reference.external', available: false, outcome: 'UNAVAILABLE', mode: 'external-reference-disabled' },
  { capabilityId: 'image.reference', available: true, outcome: 'SUPPORTED', alternativeFor: 'image.reference.external', mode: 'local-fixture-reference' },
  { capabilityId: 'tests.run', available: true, outcome: 'SUPPORTED', mode: 'shell' },
  { capabilityId: 'observations.translate', available: true, outcome: 'SUPPORTED', mode: 'shell' },
  { capabilityId: 'approved.actions', available: false, outcome: 'UNAVAILABLE', mode: 'disabled-read-only' },
  { capabilityId: 'continuation.expose', available: true, outcome: 'SUPPORTED', mode: 'session' }
]);

export function createCodexDesignWebAdapter() {
  const universal = createReferenceEnvironmentAdapter({
    adapterId: CODEX_DESIGN_WEB_ADAPTER_ID,
    environmentId: 'codex',
    capabilities: CODEX_DESIGN_WEB_CAPABILITIES
  });
  return Object.freeze({
    adapterId: CODEX_DESIGN_WEB_ADAPTER_ID,
    adapterRevision: CODEX_DESIGN_WEB_ADAPTER_REVISION,
    environmentId: 'codex',
    contractVersion: UNIVERSAL_CONTRACT_VERSION,
    translate(nativeInput, metadata = {}) {
      return universal.translate(nativeInput, {
        ...metadata,
        environment: { ...(metadata.environment ?? {}), environmentId: 'codex', capabilities: CODEX_DESIGN_WEB_CAPABILITIES }
      });
    },
    consume(nativeInput, metadata = {}, options = {}) {
      return universal.consume(nativeInput, {
        ...metadata,
        environment: { ...(metadata.environment ?? {}), environmentId: 'codex', capabilities: CODEX_DESIGN_WEB_CAPABILITIES }
      }, options);
    },
    render(result) { return universal.render(result); },
    capabilities() { return universal.capabilities(); }
  });
}
