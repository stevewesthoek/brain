import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const candidatePath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json';
const workflow = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const node = id => workflow.nodes.find(item => item.id === id);

function runCode(code, { input = {}, output = {}, env = {}, lookup = {} } = {}) {
  const fn = new Function('$input', '$json', '$env', '$', code);
  return fn({ first: () => ({ json: input }) }, output, env, name => ({ first: () => ({ json: lookup[name] ?? {} }) }));
}

test('Bedrock request builder emits Anthropic InvokeModel JSON without Gemini transport', () => {
  const request = runCode(node('build-gemini-body').parameters.jsCode, {
    input: { body: { source: 'test', title: 'A capture', content: 'Useful content' } },
  });
  const body = JSON.parse(request[0].json.classificationRequest);
  assert.equal(body.anthropic_version, 'bedrock-2023-05-31');
  assert.equal(body.temperature, 0);
  assert.equal(body.messages[0].role, 'user');
  assert.match(body.messages[0].content[0].text, /Respond with exactly one JSON object/);
  assert.doesNotMatch(node('gemini-classify').parameters.url, /generativelanguage\.googleapis\.com|GEMINI_API_KEY/);
});

test('strict response parsing preserves canonical success and failure destinations', () => {
  const input = { source: 'test', title: 'A capture', content: 'Useful content', date: '2026-08-29', forceFailure: false };
  const success = runCode(node('build-processed-note').parameters.jsCode, {
    output: { content: [{ type: 'text', text: JSON.stringify({ title: 'A capture', para_type: 'resource', confidence: 0.9, signal_quality: 0.8, summary: 'A useful summary.', key_points: ['one', 'two', 'three'] }) }] },
    lookup: { 'Build Gemini Body': input },
    env: {},
  })[0].json;
  assert.equal(success.filepath, 'inbox/new/2026-08-29-a-capture.md');
  assert.equal(success.isFailed, false);
  assert.equal(success.paraType, 'resource');

  const failure = runCode(node('build-processed-note').parameters.jsCode, {
    output: { content: [{ type: 'text', text: '{not-json' }] },
    lookup: { 'Build Gemini Body': input },
    env: {},
  })[0].json;
  assert.equal(failure.filepath, 'inbox/failed/2026-08-29-a-capture.md');
  assert.equal(failure.failureStage, 'claude-haiku-parse');
  assert.equal(failure.errorSummary, 'Claude Haiku returned invalid classification JSON');
});
