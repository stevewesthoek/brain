import { createReferenceEnvironmentAdapter } from './universal-consumer-contract.mjs';

/**
 * The remaining consumers use one transport-only adapter.  Consumer identity
 * is metadata for receipts and continuity; Brain owns route, packet, context,
 * specialist, gate, and safety semantics for every entry below.
 */
export const REMAINING_CONSUMERS = Object.freeze([
  { id: 'cursor', name: 'Cursor', priorState: 'REFERENCE_CONSUMPTION_ONLY', provenance: 'host IDE projection' },
  { id: 'kiro', name: 'Kiro', priorState: 'REPOSITORY_PROJECTION_MANIFESTED', provenance: 'steering/projection manifest' },
  { id: 'antigravity', name: 'Antigravity', priorState: 'TRACKED_PROJECTION', provenance: 'tracked IDE projection' },
  { id: 'gemini', name: 'Gemini', priorState: 'REFERENCE_CONSUMPTION_ONLY', provenance: 'model/config projection' },
  { id: 'workbench', name: 'Workbench', priorState: 'PROVIDER_ACTION_BOUNDARY', provenance: 'provider/action boundary' }
]);

export const REMAINING_CONSUMER_ADAPTER_ID = 'adapter.remaining-consumer.v1';
export const REMAINING_CONSUMER_ADAPTER_REVISION = 'remaining-consumer-adapter@1.0.0';

const BRAIN_CAPABILITIES = Object.freeze([
  'brain.contract.v1', 'brain.route', 'brain.packet', 'brain.context',
  'brain.receipt', 'brain.continuity'
]);

// These are transport capabilities only. Visual/browser capabilities are
// intentionally absent so the shared Brain provider is selected explicitly.
const COMMON_CAPABILITIES = Object.freeze([
  ...BRAIN_CAPABILITIES,
  'workspace.resolve', 'observations.translate', 'continuation.expose',
  'workspace.read', 'workspace.write', 'tests.run', 'review.run',
  'source.acquire', 'source.citation', 'design.intent',
  'frontend.implementation', 'image.reference'
].map((capabilityId) => ({ capabilityId, available: true, outcome: 'SUPPORTED', mode: 'shared-brain-contract' })));

export function createRemainingConsumerAdapter(consumer) {
  const entry = REMAINING_CONSUMERS.find((item) => item.id === consumer || item.name === consumer);
  if (!entry) throw new Error(`remaining_consumer:unknown_consumer:${consumer}`);
  return Object.freeze({
    ...createReferenceEnvironmentAdapter({
      adapterId: REMAINING_CONSUMER_ADAPTER_ID,
      environmentId: entry.id,
      capabilities: COMMON_CAPABILITIES
    }),
    adapterRevision: REMAINING_CONSUMER_ADAPTER_REVISION,
    consumerName: entry.name,
    priorState: entry.priorState,
    provenance: entry.provenance
  });
}

export function createRemainingConsumerAdapters() {
  return Object.fromEntries(REMAINING_CONSUMERS.map((entry) => [entry.id, createRemainingConsumerAdapter(entry.id)]));
}

export function remainingConsumerCapabilitySummary() {
  return REMAINING_CONSUMERS.map((entry) => ({ consumer: entry.id, adapterId: REMAINING_CONSUMER_ADAPTER_ID, adapterRevision: REMAINING_CONSUMER_ADAPTER_REVISION, nativeVisual: false, sharedVisualProviderRequired: true, priorState: entry.priorState }));
}
