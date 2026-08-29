#!/usr/bin/env node

import fs from 'node:fs';

const [
  sourcePath = 'operations/reports/artifacts/save-to-mind-live-pre-bedrock-deploy-2026-08-29.json',
  previousCandidatePath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json',
  targetPath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-transport-v2-2026-08-29.json',
] = process.argv.slice(2);

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const previousCandidate = JSON.parse(fs.readFileSync(previousCandidatePath, 'utf8'));
const workflowId = 'FwP5INe9qoo1OwGC';
const modelId = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const credentialId = 'SneiWxlJXSzYmwtF';

if (workflow.id !== workflowId || workflow.name !== 'Save to Mind — Capture for Mind Steward') {
  throw new Error('unexpected_save_to_mind_workflow_identity');
}
if (workflow.active !== true || !Array.isArray(workflow.nodes) || workflow.nodes.length !== 10) {
  throw new Error('source_must_be_fresh_active_live_export');
}

const node = id => workflow.nodes.find(item => item.id === id);
const requestNode = node('build-gemini-body');
const classifierNode = node('gemini-classify');
const processedNode = node('build-processed-note');
if (!requestNode || !classifierNode || !processedNode) {
  throw new Error('expected_save_to_mind_nodes_missing');
}

const buildRequestCode = [
  "const raw = $input.first()?.json ?? {};",
  "const b = raw.body && typeof raw.body === 'object' ? raw.body : raw;",
  "const source = typeof b.source === 'string' && b.source.trim() ? b.source.trim() : 'chatgpt';",
  "const title = typeof b.title === 'string' && b.title.trim() ? b.title : 'Untitled';",
  "const content = typeof b.content === 'string' ? b.content : '';",
  "const forceFailure = b.type_hint === 'force-failure-buffer-test';",
  "const date = new Date().toISOString().slice(0, 10);",
  "",
  "const classificationPrompt = [",
  "  'You are a GTD/PARA knowledge system processor.',",
  "  '',",
  "  'Classify the capture using only these para_type values: project (clear finish line), area (ongoing responsibility), resource (reference), or inbox (unclear).',",
  "  'Score confidence from 0.0 to 1.0 for the classification.',",
  "  'Score signal_quality from 0.0 to 1.0 for actionability and value: 0.9+ concrete/actionable/high-impact, 0.5-0.8 somewhat clear, below 0.5 vague/abstract/unclear.',",
  "  'Summarize in 1-2 sentences and list 3-5 key points.',",
  "  '',",
  "  'User context: builds SaaS products, runs ministry, automates workflows.',",
  "  '',",
  "  'Respond with exactly one JSON object and no markdown fences, prose, or extra keys:',",
  "  '{\\\"title\\\":\\\"string\\\",\\\"para_type\\\":\\\"project|area|resource|inbox\\\",\\\"confidence\\\":0.0,\\\"signal_quality\\\":0.0,\\\"summary\\\":\\\"string\\\",\\\"key_points\\\":[\\\"string\\\",\\\"string\\\",\\\"string\\\"]}',",
  "  '',",
  "  'Content to process:',",
  "  'Source: ' + source,",
  "  'Title: ' + title,",
  "  'Content:',",
  "  content,",
  "].join(String.fromCharCode(10));",
  "",
  "return [{ json: { classificationPrompt, source, title, content, date, forceFailure } }];",
].join(String.fromCharCode(10));

const priorProcessedNoteCode = previousCandidate.nodes.find(item => item.id === 'build-processed-note')?.parameters?.jsCode;
if (typeof priorProcessedNoteCode !== 'string' || !priorProcessedNoteCode.includes('parseStrictClassification')) {
  throw new Error('previous_strict_parser_missing');
}
let processedNoteCode = priorProcessedNoteCode.replaceAll('Build Gemini Body', 'Build Classification Prompt');
processedNoteCode = processedNoteCode.replace(
  "  if (typeof response === 'string') return response;\n  if (!isPlainObject(response)) return '';",
  "  if (typeof response === 'string') return response;\n  if (!isPlainObject(response)) return '';\n  if (typeof response.text === 'string') return boundedText(response.text);\n  if (typeof response.output === 'string') return boundedText(response.output);",
);

requestNode.name = 'Build Classification Prompt';
requestNode.parameters = { jsCode: buildRequestCode };

classifierNode.name = 'Bedrock Classify';
classifierNode.type = '@n8n/n8n-nodes-langchain.chainLlm';
classifierNode.typeVersion = 1.9;
classifierNode.parameters = {
  promptType: 'define',
  text: '={{ $json.classificationPrompt }}',
  hasOutputParser: false,
  needsFallback: false,
  messages: { messageValues: [] },
};
delete classifierNode.credentials;
processedNode.parameters.jsCode = processedNoteCode;

workflow.nodes.push({
  id: 'bedrock-chat-model',
  name: 'AWS Bedrock Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
  typeVersion: 1.1,
  position: [448, 256],
  parameters: {
    modelSource: 'inferenceProfile',
    model: modelId,
    options: {
      maxTokensToSample: 500,
      temperature: 0,
    },
  },
  credentials: {
    aws: {
      id: credentialId,
      name: 'AWS Bedrock - Brain',
    },
  },
});

const connections = structuredClone(workflow.connections);
const renameConnection = (oldName, newName) => {
  if (!connections[oldName]) throw new Error('connection_source_missing:' + oldName);
  connections[newName] = connections[oldName];
  delete connections[oldName];
};
renameConnection('Build Gemini Body', 'Build Classification Prompt');
renameConnection('Gemini Classify', 'Bedrock Classify');
connections.Webhook.main[0][0].node = 'Build Classification Prompt';
connections['Build Classification Prompt'].main[0][0].node = 'Bedrock Classify';
connections['Bedrock Classify'].main[0][0].node = 'Build Processed Note';
connections['AWS Bedrock Chat Model'] = {
  ai_languageModel: [[{
    node: 'Bedrock Classify',
    type: 'ai_languageModel',
    index: 0,
  }]],
};
workflow.connections = connections;
workflow.active = false;
delete workflow.activeVersion;

for (const item of workflow.nodes) {
  if (item.id !== 'bedrock-chat-model' && item.credentials) {
    throw new Error('candidate_must_not_copy_unapproved_node_credentials');
  }
}

fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2) + '\n', { encoding: 'utf8', mode: 0o644 });
console.log(JSON.stringify({
  path: targetPath,
  id: workflow.id,
  active: workflow.active,
  nodeCount: workflow.nodes.length,
  classifier: classifierNode.name,
  classifierType: classifierNode.type,
  modelNode: 'AWS Bedrock Chat Model',
  modelNodeType: '@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
  modelSource: 'inferenceProfile',
  modelId,
  credentialDisplayName: 'AWS Bedrock - Brain',
  historicalActiveVersionOmitted: true,
}));
