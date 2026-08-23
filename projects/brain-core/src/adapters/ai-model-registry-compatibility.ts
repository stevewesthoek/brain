import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ModelLifecycleState =
  | 'discovered'
  | 'evaluated'
  | 'admitted'
  | 'preferred'
  | 'deprecated'
  | 'retired';

export interface ModelRegistryProvider {
  provider_id: string;
  lifecycle_state: ModelLifecycleState;
}

export interface ModelRegistryModel {
  registry_model_id: string;
  provider_id: string;
  provider_model_binding: { model_id: string };
  lifecycle_state: ModelLifecycleState;
  compatibility_aliases?: Array<{ value?: string }>;
  replacement_registry_model_id?: string;
}

export interface ModelRegistryDocument {
  registry_id: 'ai-model-registry';
  registry_version: 1;
  providers: ModelRegistryProvider[];
  models: ModelRegistryModel[];
}

export type ModelResolution =
  | {
      ok: true;
      input: string;
      providerId: string;
      registryModelId: string;
      modelId: string;
      lifecycleState: 'admitted' | 'preferred';
    }
  | {
      ok: false;
      input: string;
      reason: string;
    };

export type ProviderResolution =
  | { ok: true; providerId: string }
  | { ok: false; reason: string };

const SELECTABLE_LIFECYCLE_STATES = new Set<ModelLifecycleState>(['admitted', 'preferred']);
const DEFAULT_REGISTRY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
  'operations/system-configs/model-selector/config/ai-model-registry.json',
);

export function defaultModelRegistryPath(): string {
  const repoRoot = process.env.BRAIN_REPO_ROOT;
  return process.env.BRAIN_MODEL_REGISTRY_PATH
    ?? (repoRoot
      ? path.join(repoRoot, 'operations/system-configs/model-selector/config/ai-model-registry.json')
      : DEFAULT_REGISTRY_PATH);
}

export function loadModelRegistry(registryPath = defaultModelRegistryPath()): ModelRegistryDocument {
  const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Partial<ModelRegistryDocument>;
  if (parsed.registry_id !== 'ai-model-registry' || parsed.registry_version !== 1) {
    throw new Error('AI model registry identity/version is unsupported.');
  }
  if (!Array.isArray(parsed.providers) || !Array.isArray(parsed.models)) {
    throw new Error('AI model registry providers/models are missing.');
  }
  return parsed as ModelRegistryDocument;
}

export function resolveProviderReference(
  providerReference: string,
  registry: ModelRegistryDocument,
): ProviderResolution {
  const provider = registry.providers.find((candidate) => candidate.provider_id === providerReference);
  if (!provider) {
    return { ok: false, reason: `Provider reference "${providerReference}" is not present in the model registry.` };
  }
  if (!SELECTABLE_LIFECYCLE_STATES.has(provider.lifecycle_state)) {
    return { ok: false, reason: `Provider "${providerReference}" is not admitted for selection.` };
  }
  return { ok: true, providerId: provider.provider_id };
}

export function resolveModelReference(
  modelReference: string,
  options: { providerIds?: string[] } = {},
  registry: ModelRegistryDocument,
): ModelResolution {
  return resolveModelReferenceInternal(modelReference, options, registry, new Set());
}

function resolveModelReferenceInternal(
  modelReference: string,
  options: { providerIds?: string[] },
  registry: ModelRegistryDocument,
  visited: Set<string>,
): ModelResolution {
  const input = modelReference.trim();
  if (!input) return { ok: false, input: modelReference, reason: 'Model reference must not be empty.' };
  if (visited.has(input)) return { ok: false, input, reason: `Model replacement cycle detected for "${input}".` };
  visited.add(input);

  const providerIds = options.providerIds && options.providerIds.length > 0
    ? new Set(options.providerIds)
    : null;
  const candidates = registry.models.filter((model) => {
    if (providerIds && !providerIds.has(model.provider_id)) return false;
    const aliases = (model.compatibility_aliases ?? []).map((alias) => alias.value).filter((value): value is string => Boolean(value));
    return model.registry_model_id === input
      || model.provider_model_binding.model_id === input
      || aliases.includes(input);
  });

  if (candidates.length === 0) {
    return { ok: false, input, reason: `Model reference "${input}" is not present in the model registry.` };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      input,
      reason: `Model reference "${input}" is ambiguous across providers; specify one provider constraint.`,
    };
  }

  const candidate = candidates[0];
  if (!candidate) return { ok: false, input, reason: `Model reference "${input}" could not be resolved.` };
  if (candidate.lifecycle_state !== 'admitted' && candidate.lifecycle_state !== 'preferred') {
    const replacement = candidate.replacement_registry_model_id;
    if (replacement) {
      return resolveModelReferenceInternal(
        replacement,
        { providerIds: [candidate.provider_id] },
        registry,
        visited,
      );
    }
    return {
      ok: false,
      input,
      reason: `Model reference "${input}" has lifecycle state "${candidate.lifecycle_state}" and is not selectable.`,
    };
  }

  const provider = resolveProviderReference(candidate.provider_id, registry);
  if (!provider.ok) return { ok: false, input, reason: provider.reason };

  return {
    ok: true,
    input,
    providerId: candidate.provider_id,
    registryModelId: candidate.registry_model_id,
    modelId: candidate.provider_model_binding.model_id,
    lifecycleState: candidate.lifecycle_state,
  };
}
