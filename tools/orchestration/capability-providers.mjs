import crypto from 'node:crypto';

export const SHARED_BRAIN_RESOLUTION = 'SHARED_BRAIN';
export const NATIVE_CONSUMER_RESOLUTION = 'NATIVE_CONSUMER';
export const APPROVED_ALTERNATIVE_RESOLUTION = 'APPROVED_ALTERNATIVE';
export const UNAVAILABLE_RESOLUTION = 'UNAVAILABLE';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}

function normalizeCapability(item) {
  return {
    capabilityId: String(item?.capabilityId ?? item?.id ?? ''),
    available: item?.available === true,
    quality: String(item?.quality ?? 'canonical'),
    alternativeFor: item?.alternativeFor ? String(item.alternativeFor) : null
  };
}

function normalizeProvider(provider) {
  const descriptor = provider?.descriptor ?? provider;
  const capabilities = Array.isArray(descriptor?.capabilities)
    ? descriptor.capabilities.map(normalizeCapability).filter((item) => item.capabilityId)
    : [];
  return {
    providerId: String(descriptor?.providerId ?? descriptor?.id ?? ''),
    providerRevision: String(descriptor?.providerRevision ?? descriptor?.revision ?? 'unknown'),
    providerKind: String(descriptor?.providerKind ?? 'shared_brain'),
    authority: String(descriptor?.authority ?? 'brain'),
    health: String(descriptor?.health ?? 'unknown'),
    freshness: String(descriptor?.freshness ?? 'unknown'),
    workspacePolicy: String(descriptor?.workspacePolicy ?? 'unknown'),
    capabilities,
    executable: typeof provider?.execute === 'function' ? provider : null
  };
}

function admissible(provider) {
  return provider.providerId
    && provider.providerKind === 'shared_brain'
    && provider.authority === 'brain'
    && provider.health === 'healthy'
    && provider.freshness === 'fresh'
    && provider.workspacePolicy === 'local_workspace_only';
}

export function providerDescriptor(provider) {
  const normalized = normalizeProvider(provider);
  return {
    providerId: normalized.providerId,
    providerRevision: normalized.providerRevision,
    providerKind: normalized.providerKind,
    authority: normalized.authority,
    health: normalized.health,
    freshness: normalized.freshness,
    workspacePolicy: normalized.workspacePolicy,
    capabilities: clone(normalized.capabilities)
  };
}

export function resolveCapabilityProviders({ required = [], optional = [], nativeSelections = [], providers = [] } = {}) {
  const normalizedProviders = providers.map(normalizeProvider);
  const nativeById = new Map(nativeSelections.map((item) => [item.capabilityId, item]));
  const sharedCandidates = (capabilityId) => normalizedProviders
    .filter(admissible)
    .flatMap((provider) => provider.capabilities
      .filter((item) => item.available && (item.capabilityId === capabilityId || item.alternativeFor === capabilityId))
      .map((capability) => ({ provider, capability })));

  const selections = [...required.map((item) => ({ item, required: true })), ...optional.map((item) => ({ item, required: false }))].map(({ item, required: isRequired }) => {
    const capabilityId = String(typeof item === 'string' ? item : item?.capabilityId ?? '');
    const native = nativeById.get(capabilityId);
    if (native?.outcome === 'SUPPORTED' || native?.outcome === 'SUPPORTED_WITH_ALTERNATIVE') {
      return { ...native, resolution: native.outcome === 'SUPPORTED' ? NATIVE_CONSUMER_RESOLUTION : APPROVED_ALTERNATIVE_RESOLUTION, providerId: null, providerRevision: null };
    }
    const candidate = sharedCandidates(capabilityId)[0];
    if (candidate) {
      const shared = candidate.capability.capabilityId === capabilityId;
      return {
        capabilityId,
        selectedCapabilityId: candidate.capability.capabilityId,
        required: isRequired,
        outcome: shared ? 'SUPPORTED_VIA_SHARED_BRAIN' : 'SUPPORTED_WITH_ALTERNATIVE',
        resolution: shared ? SHARED_BRAIN_RESOLUTION : APPROVED_ALTERNATIVE_RESOLUTION,
        providerId: candidate.provider.providerId,
        providerRevision: candidate.provider.providerRevision,
        evidenceRef: `capability-provider://${candidate.provider.providerId}/${candidate.provider.providerRevision}`
      };
    }
    return { ...(native ?? { capabilityId, selectedCapabilityId: null, required: isRequired, outcome: isRequired ? 'UNAVAILABLE' : 'DEGRADED', evidenceRef: null }), resolution: UNAVAILABLE_RESOLUTION, providerId: null, providerRevision: null };
  });
  const blocking = selections.filter((item) => item.required && !['SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE', 'SUPPORTED_VIA_SHARED_BRAIN'].includes(item.outcome));
  return {
    selections,
    status: blocking.length ? 'BLOCKED' : selections.some((item) => !['SUPPORTED', 'SUPPORTED_VIA_SHARED_BRAIN'].includes(item.outcome)) ? 'DEGRADED' : 'SUPPORTED',
    blocking: blocking.map((item) => item.capabilityId),
    noSilentOmission: true,
    providers: normalizedProviders.map((provider) => providerDescriptor(provider)),
    resolutionId: `capability-resolution:${hash(selections)}`
  };
}

export function selectExecutableProvider(selection, providers = []) {
  if (!selection?.providerId) return null;
  return providers.map(normalizeProvider).find((provider) => provider.providerId === selection.providerId && provider.executable)?.executable ?? null;
}
