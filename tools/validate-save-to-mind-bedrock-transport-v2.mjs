#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifySaveToMindRouteProof } from './n8n-save-to-mind-route-proof.mjs';

const WORKFLOW_ID = 'FwP5INe9qoo1OwGC';
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const CREDENTIAL_DISPLAY_NAME = 'AWS Bedrock - Brain';
const CREDENTIAL_ID = 'SneiWxlJXSzYmwtF';
const CHANGED_NODE_IDS = new Set(['build-gemini-body', 'gemini-classify', 'build-processed-note']);
const REQUIRED_NODE_IDS = new Set([
  'webhook-trigger', 'build-gemini-body', 'gemini-classify', 'build-processed-note',
  'check-github-file', 'handle-file-check', 'respond-webhook', 'file-exists-check',
  'save-to-github-create', 'save-to-github-update', 'bedrock-chat-model',
]);
const PROTECTED_NODE_IDS = [...REQUIRED_NODE_IDS].filter(id => !CHANGED_NODE_IDS.has(id) && id !== 'bedrock-chat-model');
const PROTECTED_CONNECTION_NAMES = [
  'Build Processed Note',
  'Check Existing GitHub File',
  'Handle File Check Result',
  'File Exists?',
  'Save to GitHub - Create',
  'Save to GitHub - Update',
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fail(message) {
  throw new Error(message);
}

function nodeMap(workflow) {
  return new Map((workflow.nodes ?? []).map(node => [node.id, node]));
}

function connection(workflow, name) {
  return workflow.connections?.[name];
}

export function validateTransportCandidate(candidate, rollback) {
  if (candidate?.id !== WORKFLOW_ID || rollback?.id !== WORKFLOW_ID) fail('workflow_identity_mismatch');
  if (candidate.name !== 'Save to Mind — Capture for Mind Steward' || candidate.name !== rollback.name) fail('workflow_name_mismatch');
  if (candidate.active !== false || rollback.active !== true) fail('activation_boundary_invalid');
  if (candidate.activeVersion) fail('candidate_must_omit_historical_active_version');

  for (const key of ['settings', 'staticData', 'tags', 'shared', 'credentials']) {
    if (!same(candidate[key] ?? null, rollback[key] ?? null)) fail('protected_workflow_field_changed:' + key);
  }

  const candidateNodes = nodeMap(candidate);
  const rollbackNodes = nodeMap(rollback);
  if (candidateNodes.size !== REQUIRED_NODE_IDS.size || rollbackNodes.size !== 10) fail('node_count_invalid');
  if ([...REQUIRED_NODE_IDS].some(id => !candidateNodes.has(id)) || rollbackNodes.size !== 10) fail('node_set_invalid');

  for (const id of PROTECTED_NODE_IDS) {
    if (!same(candidateNodes.get(id), rollbackNodes.get(id))) fail('protected_node_changed:' + id);
  }

  const webhook = candidateNodes.get('webhook-trigger');
  if (webhook.type !== 'n8n-nodes-base.webhook' || !same(webhook.parameters, rollbackNodes.get('webhook-trigger').parameters)) {
    fail('webhook_contract_changed');
  }

  const requestNode = candidateNodes.get('build-gemini-body');
  if (requestNode.type !== 'n8n-nodes-base.code' || requestNode.typeVersion !== rollbackNodes.get('build-gemini-body').typeVersion) {
    fail('classification_prompt_node_invalid');
  }
  if (!requestNode.parameters?.jsCode.includes('classificationPrompt')) fail('classification_prompt_missing');
  if (requestNode.parameters.jsCode.includes('classificationRequest')) fail('obsolete_direct_request_builder_present');
  if (/generativelanguage\\.googleapis\\.com|GEMINI_API_KEY|httpRequestWithAuthentication|service:\\s*['"]bedrock['"]/.test(requestNode.parameters.jsCode)) {
    fail('obsolete_classifier_transport_present');
  }

  const classifier = candidateNodes.get('gemini-classify');
  if (classifier.name !== 'Bedrock Classify' || classifier.type !== '@n8n/n8n-nodes-langchain.chainLlm' || classifier.typeVersion !== 1.9) {
    fail('native_chain_node_invalid');
  }
  if (classifier.parameters?.promptType !== 'define' || classifier.parameters?.text !== '={{ $json.classificationPrompt }}') {
    fail('native_chain_prompt_binding_invalid');
  }
  if (classifier.credentials) fail('native_chain_must_not_have_credentials');

  const model = candidateNodes.get('bedrock-chat-model');
  if (model.name !== 'AWS Bedrock Chat Model' || model.type !== '@n8n/n8n-nodes-langchain.lmChatAwsBedrock' || model.typeVersion !== 1.1) {
    fail('native_bedrock_node_invalid');
  }
  if (model.parameters?.modelSource !== 'inferenceProfile' || model.parameters?.model !== MODEL_ID) {
    fail('native_bedrock_model_selection_invalid');
  }
  if (model.parameters?.options?.maxTokensToSample !== 500 || model.parameters?.options?.temperature !== 0) {
    fail('native_bedrock_options_invalid');
  }
  if (!same(model.credentials, { aws: { id: CREDENTIAL_ID, name: CREDENTIAL_DISPLAY_NAME } })) {
    fail('native_bedrock_credential_reference_invalid');
  }

  const processed = candidateNodes.get('build-processed-note');
  if (!processed.parameters?.jsCode.includes('parseStrictClassification')
    || !processed.parameters.jsCode.includes("typeof response.text === 'string'")
    || !processed.parameters.jsCode.includes('claude-haiku-parse')
    || !processed.parameters.jsCode.includes('claude-haiku-classify')) {
    fail('native_response_parser_boundary_invalid');
  }
  if (processed.parameters.jsCode.includes('capture/inbox') || processed.parameters.jsCode.includes('capture/failed')) {
    fail('retired_destination_present');
  }

  const serialized = JSON.stringify(candidate);
  if (/generativelanguage\\.googleapis\\.com|GEMINI_API_KEY|httpRequestWithAuthentication|service:\\s*['"]bedrock['"]/.test(serialized)) {
    fail('obsolete_transport_present');
  }

  for (const name of PROTECTED_CONNECTION_NAMES) {
    if (!same(connection(candidate, name), connection(rollback, name))) fail('protected_connection_changed:' + name);
  }
  if (connection(candidate, 'Webhook')?.main?.[0]?.[0]?.node !== 'Build Classification Prompt') fail('webhook_transport_route_invalid');
  if (connection(candidate, 'Build Classification Prompt')?.main?.[0]?.[0]?.node !== 'Bedrock Classify') fail('prompt_transport_route_invalid');
  if (connection(candidate, 'Bedrock Classify')?.main?.[0]?.[0]?.node !== 'Build Processed Note') fail('classifier_downstream_route_invalid');
  if (!connection(candidate, 'AWS Bedrock Chat Model')?.ai_languageModel?.[0]?.[0]
    || connection(candidate, 'AWS Bedrock Chat Model').ai_languageModel[0][0].node !== 'Bedrock Classify') {
    fail('model_transport_route_invalid');
  }

  const routeProof = verifySaveToMindRouteProof(candidate);
  return {
    workflowId: WORKFLOW_ID,
    candidateSha256: undefined,
    rollbackSha256: undefined,
    nodeCount: candidateNodes.size,
    classifier: 'Basic LLM Chain + AWS Bedrock Chat Model',
    classifierType: classifier.type,
    modelNodeType: model.type,
    modelSource: model.parameters.modelSource,
    modelId: MODEL_ID,
    credentialDisplayName: CREDENTIAL_DISPLAY_NAME,
    credentialReferencePresent: true,
    protectedTopologyPreserved: true,
    routeProof,
    deploymentReady: true,
    liveMutationPerformed: false,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [
    candidatePath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-transport-v2-2026-08-29.json',
    rollbackPath = 'operations/reports/artifacts/save-to-mind-live-pre-bedrock-deploy-2026-08-29.json',
    ...extra
  ] = process.argv.slice(2);
  if (extra.length) fail('usage: validate-save-to-mind-bedrock-transport-v2.mjs [candidate.json] [rollback.json]');
  const result = validateTransportCandidate(readJson(candidatePath), readJson(rollbackPath));
  result.candidateSha256 = sha256(candidatePath);
  result.rollbackSha256 = sha256(rollbackPath);
  console.log(JSON.stringify(result));
}
