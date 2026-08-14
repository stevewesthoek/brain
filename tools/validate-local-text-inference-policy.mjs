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

const activeVideoAnalyzer = fs.readFileSync(path.join(ROOT, 'projects/brain-core/services/video-analyzer/analyze.py'), 'utf8').toLowerCase();
for (const forbiddenPattern of ['local_only', 'ollama', '/chat/completions', '127.0.0.1:11434', '127.0.0.1:11435']) {
  assert(!activeVideoAnalyzer.includes(forbiddenPattern), `active video analyzer contains retired local text pattern: ${forbiddenPattern}`);
}
assert(activeVideoAnalyzer.includes('claude-bedrock'), 'active video analyzer must support the Bedrock-primary text route');
assert(activeVideoAnalyzer.includes('codex-cli'), 'active video analyzer must support the Codex-secondary text route');
assert(activeVideoAnalyzer.includes('"fallback_policy": "ordered_strict"'), 'active video analyzer must not widen beyond Bedrock and Codex');
assert(activeVideoAnalyzer.includes('previous_failures'), 'active video analyzer must retry only through selector-declared failures');
assert(activeVideoAnalyzer.includes('report-failure'), 'active video analyzer must report failed managed execution');
assert(activeVideoAnalyzer.includes("'inbox' / 'new'"), 'active video analyzer must write only to canonical Mind inbox/new');
assert(!activeVideoAnalyzer.includes("'capture' / 'inbox'"), 'active video analyzer must not recreate the retired Mind capture/inbox path');

const managedTextExecutor = fs.readFileSync(path.join(ROOT, 'projects/brain-core/src/adapters/managed-text-executor.ts'), 'utf8').toLowerCase();
for (const requiredPattern of ['claude-bedrock', 'codex-cli', 'previousfailures', 'ordered_strict', 'reportaifailure', 'reportaisuccess', 'executemanagedprovider']) {
  assert(managedTextExecutor.includes(requiredPattern), `managed TypeScript text executor is missing safety contract: ${requiredPattern}`);
}
assert(!managedTextExecutor.includes('/chat/completions'), 'managed TypeScript text executor must not assume an Ollama/OpenAI-compatible endpoint');

const managedProviderExecutor = fs.readFileSync(path.join(ROOT, 'projects/brain-core/src/adapters/managed-provider-executor.mjs'), 'utf8').toLowerCase();
for (const requiredPattern of ['--cli-input-json', '0o600', 'pathToFileURL'.toLowerCase(), "cwd: privatedir", 'rmSync'.toLowerCase()]) {
  assert(managedProviderExecutor.includes(requiredPattern), `managed provider executor is missing privacy contract: ${requiredPattern}`);
}
const managedCommandRunner = fs.readFileSync(path.join(ROOT, 'projects/brain-core/src/adapters/managed-command-runner.mjs'), 'utf8').toLowerCase();
for (const requiredPattern of ['sigterm', 'sigkill', "child.on('close'", "child.stdin.on('error'", 'maxoutputbytes']) {
  assert(managedCommandRunner.includes(requiredPattern), `managed command runner is missing termination contract: ${requiredPattern}`);
}

for (const relativePath of [
  'projects/brain-core/src/adapters/video-orchestrator-metadata-generator.ts',
  'projects/brain-core/src/adapters/agent-orchestrator-executor.ts',
]) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').toLowerCase();
  assert(source.includes('executemanagedtext'), `${relativePath} must use the managed TypeScript text executor`);
  for (const forbiddenPattern of ['/chat/completions', 'local-fallback', 'stub-local']) {
    assert(!source.includes(forbiddenPattern), `${relativePath} contains retired or false-success text behavior: ${forbiddenPattern}`);
  }
}

const mindClassifierDist = fs.readFileSync(path.join(ROOT, 'projects/mind-steward/dist/classifier.js'), 'utf8').toLowerCase();
for (const forbiddenPattern of ['selectlocalmodel', 'classifywithlocalmodel', 'local_only', '/chat/completions']) {
  assert(!mindClassifierDist.includes(forbiddenPattern), `tracked Mind Steward dist contains retired local classifier pattern: ${forbiddenPattern}`);
}
assert(mindClassifierDist.includes('bedrock-runtime'), 'tracked Mind Steward dist must execute the private Bedrock route');

const mindPreflight = fs.readFileSync(path.join(ROOT, 'tools/scripts/mind-steward-inbox-classifier-dry-run-report.sh'), 'utf8').toLowerCase();
for (const forbiddenPattern of ['assumed-local-preflight', 'qwen2.5:14b', 'external_provider_disallowed=true', 'offline=true']) {
  assert(!mindPreflight.includes(forbiddenPattern), `Mind classifier preflight contains retired local route pattern: ${forbiddenPattern}`);
}
assert(mindPreflight.includes('not-probed-report-only'), 'Mind classifier preflight must remain non-inferencing');
assert(mindPreflight.includes("'fallbackpolicy': 'none'"), 'Mind classifier preflight must report no fallback');

for (const relativePath of [
  'operations/integrations/save-to-mind/SYSTEM_PROMPT.md',
  'operations/integrations/save-to-mind/openapi.json',
  'operations/integrations/save-to-mind/README.md',
  'operations/runbooks/mind-steward.md',
  'operations/runbooks/n8n-mind-inbox.md',
  'tools/scripts/mind-steward-inbox-dry-run-report.sh',
]) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').toLowerCase();
  assert(!source.includes('capture/inbox'), `${relativePath} still advertises retired capture/inbox`);
  assert(!source.includes('nightly local'), `${relativePath} still advertises nightly local classification`);
  assert(!source.includes('nightly mind steward run classifies'), `${relativePath} still advertises scheduled classification`);
}

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
