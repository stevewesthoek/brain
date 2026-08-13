#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const providers = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-providers.json'), 'utf8'));
const taskDocument = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/system-configs/model-selector/config/ai-task-types.json'), 'utf8'));
const tasks = taskDocument.task_types;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const providerIds = providers.providers.map((provider) => provider.id);
for (const forbidden of ['ollama-m4pro', 'ollama-m1', 'mtplx-m4pro']) {
  assert(!providerIds.includes(forbidden), `forbidden local text provider returned: ${forbidden}`);
}

const bedrock = providers.providers.find((provider) => provider.id === 'claude-bedrock');
const codex = providers.providers.find((provider) => provider.id === 'codex-cli');
assert(bedrock?.priority === 1, 'claude-bedrock must be priority 1');
assert(codex?.priority === 2, 'codex-cli must be priority 2');

for (const taskId of ['mind_capture_classification', 'mind_project_decomposition']) {
  const task = tasks[taskId];
  assert(task, `missing private Mind task: ${taskId}`);
  assert(task.privacy_policy === 'private-bedrock-only', `${taskId} must be private-bedrock-only`);
  assert(task.required_provider === 'claude-bedrock', `${taskId} must require claude-bedrock`);
  assert(task.preferred_model === 'us.anthropic.claude-sonnet-4-6', `${taskId} must pin Claude Sonnet 4.6`);
  assert(task.local_required === false, `${taskId} must not require retired local inference`);
}

assert(!Object.prototype.hasOwnProperty.call(tasks, 'codebase_semantic_graph'), 'obsolete codebase_semantic_graph selector task must remain absent');

const routeType = fs.readFileSync(path.join(ROOT, 'projects/brain-core/src/types/api.ts'), 'utf8');
assert(!routeType.includes("'ollama-m4pro'"), 'Brain Core route type must not expose ollama-m4pro');
assert(!routeType.includes("'ollama-m1'"), 'Brain Core route type must not expose ollama-m1');

const graphifyLegacy = fs.readFileSync(path.join(ROOT, 'tools/scripts/graphify-nightly.sh'), 'utf8');
for (const forbiddenPattern of ['launchctl load', 'launchctl kickstart', 'ollama serve', 'mtplx serve', '127.0.0.1:11434', '127.0.0.1:11435']) {
  assert(!graphifyLegacy.toLowerCase().includes(forbiddenPattern), `legacy Graphify stub contains forbidden autostart/runtime pattern: ${forbiddenPattern}`);
}
assert(graphifyLegacy.includes('exit 78'), 'legacy Graphify stub must remain fail-closed');

const qwenLauncher = path.join(ROOT, 'tools/scripts/qwen');
assert(!fs.existsSync(qwenLauncher), 'obsolete tools/scripts/qwen launcher must remain deleted');
assert(!fs.existsSync(path.join(ROOT, 'ai/skills/custom/mtplx/SKILL.md')), 'obsolete MTPLX custom skill must remain deleted');
assert(!fs.existsSync(path.join(ROOT, 'ai/skills/custom/qwen-aider/SKILL.md')), 'obsolete Qwen-Aider custom skill must remain deleted');

const blockedLegacyLaunchAgent = 'operations/system-configs/launchagents/com.office.mtplx.plist';
assert(
  !fs.existsSync(path.join(ROOT, blockedLegacyLaunchAgent)),
  `obsolete always-on MTPLX LaunchAgent source must be deleted: ${blockedLegacyLaunchAgent}`,
);

console.log(JSON.stringify({
  valid: true,
  bedrockPrimary: true,
  codexSecondary: true,
  privateMindPolicy: 'claude-bedrock/us.anthropic.claude-sonnet-4-6',
  graphifyDefaultLocalModel: false,
  obsoleteLocalTextSurfacesPresent: false,
}, null, 2));
