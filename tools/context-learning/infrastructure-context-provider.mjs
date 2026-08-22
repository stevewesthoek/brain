import {
  buildInfrastructureContextDescriptor,
  getInfrastructureMcpCapabilities,
  resolveInfrastructureContext,
} from '../../projects/brain-core/src/adapters/infrastructure-plane.mjs';

export const INFRASTRUCTURE_CONTEXT_PROVIDER_ID = 'infrastructure-plane';

export function createInfrastructureContextProvider({ root, clock = () => new Date() } = {}) {
  const descriptor = buildInfrastructureContextDescriptor({ root, now: clock() });
  return {
    providerId: INFRASTRUCTURE_CONTEXT_PROVIDER_ID,
    providerKind: descriptor.providerKind,
    contextRole: descriptor.contextRole,
    sourceRevision: descriptor.sourceRevision,
    health: descriptor.health,
    freshness: descriptor.freshness,
    summary: descriptor.summary,
    authoritative: true,
    readOnly: true,
    resolve({ query, maxItems = 8, maxTokens = 1200 } = {}) {
      return resolveInfrastructureContext(query, {
        root,
        now: clock(),
        maxItems,
        maxTokens,
      });
    },
  };
}

export function createInfrastructureMcpCapabilityProvider({ root, clock = () => new Date() } = {}) {
  return {
    providerId: 'infrastructure-plane-mcp',
    providerKind: 'capability_catalog',
    sourceRevision: buildInfrastructureContextDescriptor({ root, now: clock() }).sourceRevision,
    health: 'healthy',
    freshness: buildInfrastructureContextDescriptor({ root, now: clock() }).freshness,
    list() {
      return getInfrastructureMcpCapabilities({ root, now: clock() }).capabilities;
    },
    inspect({ capabilityId } = {}) {
      return getInfrastructureMcpCapabilities({ root, now: clock() }).capabilities.find((entry) => entry.capabilityId === capabilityId) ?? null;
    },
  };
}
