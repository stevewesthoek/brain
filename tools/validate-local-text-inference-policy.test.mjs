import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const providers = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-providers.json'), 'utf8'));
const taskDocument = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-task-types.json'), 'utf8'));
const tasks = taskDocument.task_types;

function provider(id) {
  return providers.providers.find((entry) => entry.id === id);
}

test('Bedrock-backed Claude is primary and Codex is secondary', () => {
  assert.equal(provider('claude-bedrock')?.priority, 1);
  assert.equal(provider('codex-cli')?.priority, 2);
});

test('retired local text providers remain absent', () => {
  const ids = new Set(providers.providers.map((entry) => entry.id));
  for (const id of ['ollama-m4pro', 'ollama-m1', 'mtplx-m4pro']) {
    assert.equal(ids.has(id), false, `${id} must remain absent`);
  }
});

test('private Mind tasks are pinned to one approved Bedrock provider/model', () => {
  for (const id of ['mind_capture_classification', 'mind_project_decomposition']) {
    const task = tasks[id];
    assert.equal(task?.privacy_policy, 'private-bedrock-only');
    assert.equal(task?.required_provider, 'claude-bedrock');
    assert.equal(task?.preferred_model, 'us.anthropic.claude-sonnet-4-6');
    assert.equal(task?.local_required, false);
    assert.match(task?.notes ?? '', /fail closed|fallback_policy=none/i);
  }
});

test('obsolete Graphify selector task remains deleted', () => {
  assert.equal(Object.prototype.hasOwnProperty.call(tasks, 'codebase_semantic_graph'), false);
});
