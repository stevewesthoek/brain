import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRegistry } from './validate-ai-model-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('MRU0-P2.1 registry preserves provider and model parity', () => {
  const result = validateRegistry(ROOT);
  assert.equal(result.valid, true);
  assert.equal(result.providerCount, 4);
  assert.equal(result.modelCount, 16);
  assert.equal(result.sourceModelCount, 16);
  assert.equal(result.runtimeIntegration, 'shadow-only');
});

test('MRU0-P2.2 integrates the registry only for shadow reporting', () => {
  const core = fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/runtime/core.py'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/runtime/selector_service.py'), 'utf8');
  assert.match(core, /from registry_shadow import load_and_compare/);
  assert.match(core, /REGISTRY_PATH/);
  assert.match(service, /\/registry\/shadow/);
});

test('private Mind routing remains explicit Bedrock-only and fail-closed', () => {
  const tasks = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-task-types.json'), 'utf8')).task_types;
  for (const taskId of ['mind_capture_classification', 'mind_project_decomposition', 'mind_maintenance_semantic_comparison']) {
    assert.equal(tasks[taskId].privacy_policy, 'private-bedrock-only');
    assert.equal(tasks[taskId].required_provider, 'claude-bedrock');
    assert.equal(tasks[taskId].preferred_model, 'us.anthropic.claude-sonnet-4-6');
    assert.match(tasks[taskId].notes, /fail closed/i);
  }
});

test('video frame analysis has an admitted Bedrock vision model', () => {
  const providers = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-providers.json'), 'utf8')).providers;
  const bedrock = providers.find((provider) => provider.id === 'claude-bedrock');
  assert.ok(bedrock?.capabilities.includes('image/analyze'));

  const taskTypes = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-task-types.json'), 'utf8')).task_types;
  assert.equal(taskTypes.video_frame_analysis.capability, 'image/analyze');

  const visionModels = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-bedrock-models.json'), 'utf8')).models
    .filter((model) => model.enabled !== false && model.capabilities.includes('image/analyze'));
  assert.ok(visionModels.length > 0, 'at least one enabled Bedrock model must be admitted for video frame analysis');
});
