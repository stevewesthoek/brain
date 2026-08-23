#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RELATIVE_PATHS = {
  providers: 'operations/system-configs/model-selector/config/ai-providers.json',
  bedrockModels: 'operations/system-configs/model-selector/config/ai-bedrock-models.json',
  taskTypes: 'operations/system-configs/model-selector/config/ai-task-types.json',
  registry: 'operations/system-configs/model-selector/config/ai-model-registry.json',
  runtimeCore: 'operations/system-configs/model-selector/runtime/core.py',
  runtimeService: 'operations/system-configs/model-selector/runtime/selector_service.py',
};

const PRIVATE_TASK_IDS = [
  'mind_capture_classification',
  'mind_project_decomposition',
  'mind_maintenance_semantic_comparison',
];

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function stable(value) {
  return JSON.stringify(value);
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUnique(values, label) {
  const unique = new Set(values);
  assertCondition(unique.size === values.length, `duplicate ${label}: ${values.join(', ')}`);
}

function assertSetEqual(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  assertCondition(
    actualSet.size === expectedSet.size && [...actualSet].every((value) => expectedSet.has(value)),
    `${label} mismatch: actual=${JSON.stringify([...actualSet].sort())} expected=${JSON.stringify([...expectedSet].sort())}`,
  );
}

function assertSame(actual, expected, label) {
  assertCondition(stable(actual) === stable(expected), `${label} mismatch: actual=${stable(actual)} expected=${stable(expected)}`);
}

function modelKey(providerId, modelId) {
  return `${providerId}/${modelId}`;
}

function registryModelMap(registry) {
  return new Map(registry.models.map((model) => [model.registry_model_id, model]));
}

function validateRegistry(rootDir = ROOT) {
  const providersDocument = readJson(rootDir, RELATIVE_PATHS.providers);
  const bedrockDocument = readJson(rootDir, RELATIVE_PATHS.bedrockModels);
  const taskDocument = readJson(rootDir, RELATIVE_PATHS.taskTypes);
  const registry = readJson(rootDir, RELATIVE_PATHS.registry);

  assertCondition(registry.registry_id === 'ai-model-registry', 'registry_id must be ai-model-registry');
  assertCondition(registry.registry_version === 1, 'registry_version must be 1');
  assertCondition(registry.source_provenance?.mode === 'parity-only', 'registry must remain parity-only in P2.1');
  assertCondition(
    registry.source_provenance?.provider_source === RELATIVE_PATHS.providers,
    'provider source provenance is incorrect',
  );
  assertCondition(
    registry.source_provenance?.bedrock_model_source === RELATIVE_PATHS.bedrockModels,
    'Bedrock model source provenance is incorrect',
  );
  assertCondition(
    registry.source_provenance?.task_policy_source === RELATIVE_PATHS.taskTypes,
    'task policy source provenance is incorrect',
  );

  const sourceProviders = providersDocument.providers;
  const registryProviders = registry.providers;
  const sourceProviderIds = sourceProviders.map((provider) => provider.id);
  const registryProviderIds = registryProviders.map((provider) => provider.provider_id);
  assertUnique(sourceProviderIds, 'source provider IDs');
  assertUnique(registryProviderIds, 'registry provider IDs');
  assertSetEqual(registryProviderIds, sourceProviderIds, 'provider parity');

  const sourceProviderMap = new Map(sourceProviders.map((provider) => [provider.id, provider]));
  const registryProviderMap = new Map(registryProviders.map((provider) => [provider.provider_id, provider]));
  const modelsById = registryModelMap(registry);
  assertUnique(registry.models.map((model) => model.registry_model_id), 'registry model IDs');

  const expectedModelCount = sourceProviders
    .filter((provider) => provider.id !== 'claude-bedrock')
    .reduce((count, provider) => count + provider.models.length, 0) + bedrockDocument.models.length;
  assertCondition(registry.models.length === expectedModelCount, `model count mismatch: ${registry.models.length} != ${expectedModelCount}`);

  for (const sourceProvider of sourceProviders) {
    const provider = registryProviderMap.get(sourceProvider.id);
    assertCondition(provider, `missing registry provider: ${sourceProvider.id}`);
    assertSame(provider.display_name, sourceProvider.label, `${sourceProvider.id} display_name`);
    assertSame(provider.capabilities, sourceProvider.capabilities, `${sourceProvider.id} capabilities`);
    assertSame(provider.selection_metadata.provider_type, sourceProvider.type, `${sourceProvider.id} provider type`);
    assertSame(provider.selection_metadata.priority, sourceProvider.priority, `${sourceProvider.id} priority`);
    assertSame(provider.selection_metadata.cost_per_1k_tokens, sourceProvider.cost_per_1k_tokens, `${sourceProvider.id} cost`);
    assertSame(provider.selection_metadata.schedule_preference, sourceProvider.schedule_preference, `${sourceProvider.id} schedule preference`);

    for (const key of ['binary', 'base_url', 'health_check', 'timeout_connect_sec', 'timeout_inference_sec', 'max_context_tokens', 'notes']) {
      if (Object.prototype.hasOwnProperty.call(sourceProvider, key)) {
        assertSame(provider.runtime_compatibility[key], sourceProvider[key], `${sourceProvider.id} runtime ${key}`);
      }
    }

    if (sourceProvider.id === 'claude-bedrock') {
      assertCondition(
        provider.compatibility_aliases.some((alias) => alias.value === 'bedrock-model-portfolio'),
        'claude-bedrock is missing bedrock-model-portfolio compatibility alias',
      );
    } else {
      for (const sourceModelId of sourceProvider.models) {
        const id = modelKey(sourceProvider.id, sourceModelId);
        const model = modelsById.get(id);
        assertCondition(model, `missing registry model for provider model: ${id}`);
        assertCondition(provider.model_refs.includes(id), `${sourceProvider.id} is missing model reference: ${id}`);
        assertSame(model.provider_id, sourceProvider.id, `${id} provider`);
        assertSame(model.provider_model_binding.model_id, sourceModelId, `${id} binding`);
        assertSame(model.capabilities, sourceProvider.capabilities, `${id} capabilities`);
        assertCondition(
          model.compatibility_aliases.some((alias) => alias.value === sourceModelId),
          `${id} is missing compatibility identifier: ${sourceModelId}`,
        );
        assertCondition(model.legacy_selection_flags.enabled === true, `${id} legacy enabled flag changed`);
      }
    }
  }

  for (const sourceModel of bedrockDocument.models) {
    const id = modelKey('claude-bedrock', sourceModel.id);
    const model = modelsById.get(id);
    assertCondition(model, `missing Bedrock registry model: ${id}`);
    assertCondition(registryProviderMap.get('claude-bedrock').model_refs.includes(id), `${id} is not linked to claude-bedrock`);
    assertSame(model.display_name, sourceModel.label, `${id} label`);
    assertSame(model.provider_id, 'claude-bedrock', `${id} provider`);
    assertSame(model.provider_model_binding.model_id, sourceModel.model_id, `${id} provider model ID`);
    assertSame(model.provider_model_binding.region, sourceModel.region, `${id} region`);
    assertSame(model.capabilities, sourceModel.capabilities, `${id} capabilities`);
    assertSame(model.selection_metadata.priority, sourceModel.priority, `${id} priority`);
    assertSame(model.selection_metadata.roles, sourceModel.roles, `${id} roles`);
    assertSame(model.selection_metadata.task_affinity, sourceModel.task_affinity, `${id} task affinity`);
    assertSame(model.selection_metadata.max_context_tokens, sourceModel.max_context_tokens, `${id} context limit`);
    assertSame(model.selection_metadata.max_output_tokens, sourceModel.max_output_tokens, `${id} output limit`);
    assertSame(model.selection_metadata.quality_score, sourceModel.quality_score, `${id} quality score`);
    assertSame(model.selection_metadata.notes, sourceModel.notes, `${id} notes`);
    assertSame(model.cost_metadata.input_per_1m, sourceModel.price_input_per_1m, `${id} input price`);
    assertSame(model.cost_metadata.output_per_1m, sourceModel.price_output_per_1m, `${id} output price`);
    assertSame(model.legacy_selection_flags.enabled, Boolean(sourceModel.enabled));
    assertSame(model.legacy_selection_flags.upgrade_candidate, Boolean(sourceModel.upgrade_candidate));
    assertSame(model.legacy_selection_flags.access_probe_ttl_hours, sourceModel.access_probe_ttl_hours ?? null, `${id} probe TTL`);
    assertCondition(model.compatibility_aliases.some((alias) => alias.value === sourceModel.id), `${id} missing registry key alias`);
    assertCondition(model.compatibility_aliases.some((alias) => alias.value === sourceModel.model_id), `${id} missing provider model ID alias`);

    const expectedLifecycle = sourceModel.enabled ? 'admitted' : sourceModel.upgrade_candidate ? 'evaluated' : 'retired';
    assertSame(model.lifecycle_state, expectedLifecycle, `${id} lifecycle state`);
  }

  for (const provider of registryProviders) {
    const linkedModels = registry.models.filter((model) => model.provider_id === provider.provider_id).map((model) => model.registry_model_id);
    assertSetEqual(provider.model_refs, linkedModels, `${provider.provider_id} model references`);
  }

  const tasks = taskDocument.task_types;
  for (const taskId of PRIVATE_TASK_IDS) {
    const task = tasks[taskId];
    assertCondition(task, `missing private Mind task: ${taskId}`);
    assertSame(task.privacy_policy, 'private-bedrock-only', `${taskId} privacy policy`);
    assertSame(task.required_provider, 'claude-bedrock', `${taskId} required provider`);
    assertSame(task.preferred_model, 'us.anthropic.claude-sonnet-4-6', `${taskId} preferred model`);
    assertSame(task.local_required, false, `${taskId} local_required`);
    assertCondition(/fail closed/i.test(task.notes ?? ''), `${taskId} must retain fail-closed policy evidence`);
  }
  const sonnet = modelsById.get('claude-bedrock/claude-sonnet-4-6');
  assertCondition(
    sonnet.safety_constraints.private_task_policy === 'private-bedrock-only',
    'Claude Sonnet registry safety constraint does not preserve private Bedrock policy',
  );
  assertSetEqual(sonnet.safety_constraints.private_task_ids, PRIVATE_TASK_IDS, 'private Mind task mapping');

  const core = fs.readFileSync(path.join(rootDir, RELATIVE_PATHS.runtimeCore), 'utf8');
  const service = fs.readFileSync(path.join(rootDir, RELATIVE_PATHS.runtimeService), 'utf8');
  assertCondition(core.includes('from registry_shadow import load_and_compare'), 'runtime/core.py must retain shadow-only registry loading');
  assertCondition(core.includes('REGISTRY_PATH'), 'runtime/core.py must retain the shadow registry path');
  assertCondition(service.includes('/registry/shadow'), 'selector_service.py must expose the shadow report');

  return {
    valid: true,
    registryId: registry.registry_id,
    providerCount: registry.providers.length,
    modelCount: registry.models.length,
    sourceModelCount: expectedModelCount,
    runtimeIntegration: 'shadow-only',
    privateMindPolicy: 'claude-bedrock/us.anthropic.claude-sonnet-4-6',
  };
}

export { validateRegistry };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    console.log(JSON.stringify(validateRegistry(), null, 2));
  } catch (error) {
    console.error(`AI model registry validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
