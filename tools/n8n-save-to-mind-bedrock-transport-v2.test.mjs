import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { validateTransportCandidate } from './validate-save-to-mind-bedrock-transport-v2.mjs';
import { verifySaveToMindRouteProof } from './n8n-save-to-mind-route-proof.mjs';

const candidatePath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-transport-v2-2026-08-29.json';
const rollbackPath = 'operations/reports/artifacts/save-to-mind-live-pre-bedrock-deploy-2026-08-29.json';
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const rollback = JSON.parse(fs.readFileSync(rollbackPath, 'utf8'));
const node = id => candidate.nodes.find(item => item.id === id);

function runCode(code, { input = {}, output = {}, env = {}, lookup = {} } = {}) {
  const fn = new Function('$input', '$json', '$env', '$', code);
  return fn({ first: () => ({ json: input }) }, output, env, name => ({ first: () => ({ json: lookup[name] ?? {} }) }));
}

test('native Bedrock transport validates against the rolled-back topology', () => {
  const result = validateTransportCandidate(candidate, rollback);
  assert.equal(result.deploymentReady, true);
  assert.equal(result.protectedTopologyPreserved, true);
  assert.equal(result.modelId, 'us.anthropic.claude-haiku-4-5-20251001-v1:0');
  assert.equal(result.routeProof.transport, 'native-bedrock-chat-model');
});

test('native node types and model configuration are explicit', () => {
  assert.equal(node('gemini-classify').type, '@n8n/n8n-nodes-langchain.chainLlm');
  assert.equal(node('bedrock-chat-model').type, '@n8n/n8n-nodes-langchain.lmChatAwsBedrock');
  assert.equal(node('bedrock-chat-model').parameters.modelSource, 'inferenceProfile');
  assert.equal(node('bedrock-chat-model').parameters.model, 'us.anthropic.claude-haiku-4-5-20251001-v1:0');
  assert.deepEqual(node('bedrock-chat-model').credentials.aws, {
    id: 'SneiWxlJXSzYmwtF',
    name: 'AWS Bedrock - Brain',
  });
  const serialized = JSON.stringify(candidate);
  assert.doesNotMatch(serialized, /generativelanguage\\.googleapis\\.com|GEMINI_API_KEY|httpRequestWithAuthentication|service:\\s*['"]bedrock['"]/);
});

test('classification prompt reaches the native chain without a direct HTTP body', () => {
  const built = runCode(node('build-gemini-body').parameters.jsCode, {
    input: { body: { source: 'test', title: 'A capture', content: 'Useful content' } },
  })[0].json;
  assert.match(built.classificationPrompt, /Respond with exactly one JSON object/);
  assert.equal(node('gemini-classify').parameters.text, '={{ $json.classificationPrompt }}');
  assert.equal(Object.hasOwn(built, 'classificationRequest'), false);
});

test('native chain text envelope parses to inbox/new', () => {
  const input = { source: 'test', title: 'A capture', content: 'Useful content', date: '2026-08-29', forceFailure: false };
  const result = runCode(node('build-processed-note').parameters.jsCode, {
    output: { text: JSON.stringify({ title: 'A capture', para_type: 'resource', confidence: 0.9, signal_quality: 0.8, summary: 'A useful summary.', key_points: ['one', 'two', 'three'] }) },
    lookup: { 'Build Classification Prompt': input },
    env: {},
  })[0].json;
  assert.equal(result.filepath, 'inbox/new/2026-08-29-a-capture.md');
  assert.equal(result.isFailed, false);
  assert.equal(result.paraType, 'resource');
});

test('malformed native chain text fails closed to inbox/failed', () => {
  const input = { source: 'test', title: 'A capture', content: 'Useful content', date: '2026-08-29', forceFailure: false };
  const result = runCode(node('build-processed-note').parameters.jsCode, {
    output: { text: '{not-json' },
    lookup: { 'Build Classification Prompt': input },
    env: {},
  })[0].json;
  assert.equal(result.filepath, 'inbox/failed/2026-08-29-a-capture.md');
  assert.equal(result.failureStage, 'claude-haiku-parse');
});

test('route proof includes the required AI model edge', () => {
  assert.equal(verifySaveToMindRouteProof(candidate).ok, true);
});
