#!/usr/bin/env node

import fs from 'node:fs';

const [sourcePath = 'operations/reports/artifacts/save-to-mind-live-rollback-2026-08-29.json', targetPath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json'] = process.argv.slice(2);
const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

if (workflow.id !== 'FwP5INe9qoo1OwGC' || workflow.name !== 'Save to Mind — Capture for Mind Steward') {
  throw new Error('unexpected_save_to_mind_workflow_identity');
}
if (workflow.active !== true || !Array.isArray(workflow.nodes) || workflow.nodes.length !== 10) {
  throw new Error('source_must_be_fresh_active_live_export');
}

const buildRequestCode = String.raw`const raw = $input.first()?.json ?? {};
const b = raw.body && typeof raw.body === 'object' ? raw.body : raw;
const source = typeof b.source === 'string' && b.source.trim() ? b.source.trim() : 'chatgpt';
const title = typeof b.title === 'string' && b.title.trim() ? b.title : 'Untitled';
const content = typeof b.content === 'string' ? b.content : '';
const forceFailure = b.type_hint === 'force-failure-buffer-test';
const date = new Date().toISOString().slice(0, 10);

const prompt = 'You are a GTD/PARA knowledge system processor.\n\n'
  + 'Classify the capture using only these para_type values: project (clear finish line), area (ongoing responsibility), resource (reference), or inbox (unclear).\n'
  + 'Score confidence from 0.0 to 1.0 for the classification.\n'
  + 'Score signal_quality from 0.0 to 1.0 for actionability and value: 0.9+ concrete/actionable/high-impact, 0.5-0.8 somewhat clear, below 0.5 vague/abstract/unclear.\n'
  + 'Summarize in 1-2 sentences and list 3-5 key points.\n\n'
  + 'User context: builds SaaS products, runs ministry, automates workflows.\n\n'
  + 'Respond with exactly one JSON object and no markdown fences, prose, or extra keys:\n'
  + '{"title":"string","para_type":"project|area|resource|inbox","confidence":0.0,"signal_quality":0.0,"summary":"string","key_points":["string","string","string"]}\n\n'
  + 'Content to process:\nSource: ' + source + '\nTitle: ' + title + '\nContent:\n' + content;

const classificationRequest = JSON.stringify({
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 500,
  temperature: 0,
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
});

return [{ json: { classificationRequest, source, title, content, date, forceFailure } }];`;

const processedNoteCode = String.raw`function utf8ToBase64(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code >= 0xd800 && code <= 0xdbff) {
      i++;
      const next = str.charCodeAt(i);
      const fullCode = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(0xf0 | (fullCode >> 18), 0x80 | ((fullCode >> 12) & 0x3f), 0x80 | ((fullCode >> 6) & 0x3f), 0x80 | (fullCode & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    output += chars[a >> 2];
    output += chars[((a & 3) << 4) | ((b ?? 0) >> 4)];
    output += b === undefined ? '=' : chars[((b & 15) << 2) | ((c ?? 0) >> 6)];
    output += c === undefined ? '=' : chars[c & 63];
  }
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, maximum = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function extractModelText(response) {
  if (typeof response === 'string') return response;
  if (!isPlainObject(response)) return '';
  const content = Array.isArray(response.content) ? response.content : [];
  return boundedText(content.find(part => isPlainObject(part) && typeof part.text === 'string')?.text);
}

function hasRemoteError(response) {
  return isPlainObject(response) && (
    isPlainObject(response.error)
    || typeof response.__type === 'string'
    || (typeof response.message === 'string' && !Array.isArray(response.content))
  );
}

function stripMarkdownFence(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('\`\`\`')) return trimmed;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 3 || !lines.at(-1).trim().startsWith('\`\`\`')) return trimmed;
  return lines.slice(1, -1).join('\n').trim();
}

function parseStrictClassification(value) {
  const parsed = JSON.parse(stripMarkdownFence(value));
  if (!isPlainObject(parsed)) throw new Error('classification_not_object');
  const required = ['title', 'para_type', 'confidence', 'signal_quality', 'summary', 'key_points'];
  const keys = Object.keys(parsed).sort();
  if (keys.join('|') !== required.slice().sort().join('|')) throw new Error('classification_schema_mismatch');
  if (typeof parsed.title !== 'string' || parsed.title.trim().length === 0 || parsed.title.length > 240) throw new Error('classification_title_invalid');
  if (!['project', 'area', 'resource', 'inbox'].includes(parsed.para_type)) throw new Error('classification_para_type_invalid');
  for (const key of ['confidence', 'signal_quality']) {
    if (typeof parsed[key] !== 'number' || !Number.isFinite(parsed[key]) || parsed[key] < 0 || parsed[key] > 1) throw new Error('classification_' + key + '_invalid');
  }
  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0 || parsed.summary.length > 4000) throw new Error('classification_summary_invalid');
  if (!Array.isArray(parsed.key_points) || parsed.key_points.length < 3 || parsed.key_points.length > 5 || parsed.key_points.some(point => typeof point !== 'string' || point.trim().length === 0 || point.length > 1000)) throw new Error('classification_key_points_invalid');
  return parsed;
}

const orig = $('Build Gemini Body').first()?.json ?? {};
const response = $json;
const forced = orig.forceFailure === true;
const modelText = extractModelText(response);
const remoteError = hasRemoteError(response);
let paraType = 'inbox';
let confidence = 0;
let signalQuality = 0;
let summary = '';
let keyPoints = [];
let failureStage = '';
let errorSummary = '';

if (forced) {
  failureStage = 'claude-haiku-classify';
  errorSummary = 'Forced failure-buffer verification';
  summary = 'Failed to classify capture; preserved for retry.';
} else if (remoteError || !modelText) {
  failureStage = 'claude-haiku-classify';
  errorSummary = 'Claude Haiku classification failed';
  summary = 'Failed to classify capture; preserved for retry.';
} else {
  try {
    const parsed = parseStrictClassification(modelText);
    paraType = parsed.para_type;
    confidence = parsed.confidence;
    signalQuality = parsed.signal_quality;
    summary = parsed.summary;
    keyPoints = parsed.key_points;
  } catch {
    failureStage = 'claude-haiku-parse';
    errorSummary = 'Claude Haiku returned invalid classification JSON';
    summary = 'Failed to parse Claude Haiku response; preserved for retry.';
  }
}

const title = typeof orig.title === 'string' && orig.title.trim() ? orig.title : 'Untitled Capture';
const content = typeof orig.content === 'string' ? orig.content : '';
const source = typeof orig.source === 'string' && orig.source.trim() ? orig.source : 'chatgpt';
const date = typeof orig.date === 'string' && orig.date ? orig.date : new Date().toISOString().slice(0, 10);
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'untitled-capture';
const isFailed = Boolean(failureStage);
const inboxPrefix = ($env.MIND_INBOX_PATH || 'inbox/new').replace(/^\/+|\/+$/g, '') || 'inbox/new';
const failedPrefix = ($env.MIND_FAILED_PATH || 'inbox/failed').replace(/^\/+|\/+$/g, '') || 'inbox/failed';
const filepath = (isFailed ? failedPrefix : inboxPrefix) + '/' + date + '-' + slug + '.md';
const markdown = '---\n'
  + 'type: ' + (isFailed ? 'failed-capture' : 'capture') + '\n'
  + 'source: ' + source + '\n'
  + 'status: ' + (isFailed ? 'needs-retry' : 'saved') + '\n'
  + 'para_type: ' + paraType + '\n'
  + 'confidence: ' + confidence + '\n'
  + 'signal_quality: ' + signalQuality + '\n'
  + 'title: ' + JSON.stringify(title) + '\n'
  + 'created: ' + new Date().toISOString() + '\n'
  + (isFailed ? 'failure_stage: ' + failureStage + '\nerror_summary: ' + JSON.stringify(errorSummary || 'unknown') + '\n' : '')
  + '---\n\n# ' + title + '\n\n## Summary\n' + summary + '\n\n## Key Points\n'
  + keyPoints.map(point => '- ' + point).join('\n') + '\n\n## Content\n' + content + '\n';
const base64 = utf8ToBase64(markdown);
return [{ json: { ...orig, title, content, source, date, filepath, markdown, base64, paraType, confidence, signalQuality, summary, keyPoints, failureStage, errorSummary, isFailed, forceFailure: forced } }];`;

const requestNode = workflow.nodes.find(node => node.id === 'build-gemini-body');
const classifierNode = workflow.nodes.find(node => node.id === 'gemini-classify');
const processedNode = workflow.nodes.find(node => node.id === 'build-processed-note');
if (!requestNode || !classifierNode || !processedNode) throw new Error('expected_save_to_mind_nodes_missing');

requestNode.parameters.jsCode = buildRequestCode;
classifierNode.parameters = {
  method: 'POST',
  url: "={{ 'https://bedrock-runtime.' + ($env.BEDROCK_REGION || $env.AWS_REGION || 'us-east-1') + '.amazonaws.com/model/us.anthropic.claude-haiku-4-5-20251001-v1:0/invoke' }}",
  authentication: 'predefinedCredentialType',
  nodeCredentialType: 'aws',
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true,
  contentType: 'raw',
  rawContentType: 'application/json',
  body: '={{ $json.classificationRequest }}',
  options: {},
};
processedNode.parameters.jsCode = processedNoteCode;

const connections = {};
for (const [key, value] of Object.entries(workflow.connections)) {
  connections[key] = {
    ...value,
    main: (value.main ?? []).map(group => group.map(edge => ({ ...edge }))),
  };
}
workflow.connections = connections;
workflow.active = false;
// The public update contract transmits only name/nodes/connections/settings/staticData.
// Do not carry the export's old nested activeVersion snapshot into the candidate.
delete workflow.activeVersion;

if (workflow.nodes.some(node => node.credentials)) throw new Error('candidate_must_not_invent_or_copy_credential_material');
fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2) + '\n', { encoding: 'utf8', mode: 0o644 });
console.log(JSON.stringify({
  path: targetPath,
  id: workflow.id,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  classifier: classifierNode.name,
  nodeCredentialType: classifierNode.parameters.nodeCredentialType,
  credentialReferencePresent: Boolean(classifierNode.credentials),
  hasGeminiEndpoint: JSON.stringify(workflow.nodes).includes('generativelanguage.googleapis.com'),
  hasBedrockEndpoint: JSON.stringify(workflow.nodes).includes('bedrock-runtime'),
  historicalActiveVersionOmitted: true,
}));
