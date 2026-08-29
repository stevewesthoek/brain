#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKFLOW_ID = 'FwP5INe9qoo1OwGC';
const ALLOWED_PARAMETER_CHANGES = new Set(['build-gemini-body', 'gemini-classify', 'build-processed-note']);
const REQUIRED_NODE_IDS = new Set([
  'webhook-trigger', 'build-gemini-body', 'gemini-classify', 'build-processed-note',
  'check-github-file', 'handle-file-check', 'respond-webhook', 'file-exists-check',
  'save-to-github-create', 'save-to-github-update',
]);

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

function nodeMap(workflow) {
  return new Map((workflow.nodes ?? []).map(node => [node.id, node]));
}

function fail(message) {
  throw new Error(message);
}

export function validateCandidate(candidate, rollback) {
  if (candidate?.id !== WORKFLOW_ID || rollback?.id !== WORKFLOW_ID) fail('workflow_identity_mismatch');
  if (candidate.name !== 'Save to Mind — Capture for Mind Steward' || candidate.name !== rollback.name) fail('workflow_name_mismatch');
  if (candidate.active !== false || rollback.active !== true) fail('activation_boundary_invalid');

  for (const key of ['settings', 'staticData', 'tags', 'shared', 'credentials']) {
    if (!same(candidate[key] ?? null, rollback[key] ?? null)) fail('protected_workflow_field_changed:' + key);
  }
  if (!same(candidate.connections, rollback.connections)) fail('connection_graph_changed');
  if (candidate.activeVersion) fail('candidate_must_omit_historical_active_version');

  const candidateNodes = nodeMap(candidate);
  const rollbackNodes = nodeMap(rollback);
  if (candidateNodes.size !== REQUIRED_NODE_IDS.size || rollbackNodes.size !== REQUIRED_NODE_IDS.size) fail('node_count_invalid');
  if ([...REQUIRED_NODE_IDS].some(id => !candidateNodes.has(id) || !rollbackNodes.has(id))) fail('node_set_invalid');

  for (const [id, liveNode] of rollbackNodes) {
    const candidateNode = candidateNodes.get(id);
    if (candidateNode.type !== liveNode.type || candidateNode.name !== liveNode.name) fail('node_identity_changed:' + id);
    if (!ALLOWED_PARAMETER_CHANGES.has(id) && !same(candidateNode, liveNode)) fail('unapproved_node_changed:' + id);
  }

  const requestNode = candidateNodes.get('build-gemini-body');
  const classifierNode = candidateNodes.get('gemini-classify');
  const processedNode = candidateNodes.get('build-processed-note');
  if (!requestNode.parameters?.jsCode.includes('classificationRequest')) fail('classification_request_builder_missing');
  if (requestNode.parameters.jsCode.includes('geminiBody')) fail('obsolete_gemini_request_field_present');
  if (!classifierNode.parameters?.url.includes('bedrock-runtime')) fail('bedrock_endpoint_missing');
  if (!classifierNode.parameters.url.includes('us.anthropic.claude-haiku-4-5-20251001-v1:0')) fail('haiku_model_id_missing');
  if (classifierNode.parameters.authentication !== 'predefinedCredentialType' || classifierNode.parameters.nodeCredentialType !== 'aws') fail('aws_predefined_credential_route_missing');
  if (classifierNode.parameters.body !== '={{ $json.classificationRequest }}') fail('bedrock_body_binding_invalid');
  if (classifierNode.parameters.url.includes('generativelanguage.googleapis.com') || JSON.stringify(classifierNode.parameters).includes('GEMINI_API_KEY')) fail('obsolete_gemini_transport_present');
  if (!processedNode.parameters?.jsCode.includes('parseStrictClassification')) fail('strict_classification_parser_missing');
  if (!processedNode.parameters.jsCode.includes('claude-haiku-parse') || !processedNode.parameters.jsCode.includes('claude-haiku-classify')) fail('bounded_failure_stages_missing');
  if (processedNode.parameters.jsCode.includes('capture/inbox') || processedNode.parameters.jsCode.includes('capture/failed')) fail('retired_destination_present');

  const credentialReferencePresent = Boolean(classifierNode.credentials?.aws?.id);
  return {
    workflowId: WORKFLOW_ID,
    candidateSha256: undefined,
    rollbackSha256: undefined,
    nodeCount: candidateNodes.size,
    classifier: 'Amazon Bedrock InvokeModel via n8n AWS (IAM)',
    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    credentialReferencePresent,
    deploymentReady: credentialReferencePresent,
    blocker: credentialReferencePresent ? null : 'existing_n8n_aws_credential_reference_unresolved',
    liveMutationPerformed: false,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [candidatePath = 'operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json', rollbackPath = 'operations/reports/artifacts/save-to-mind-live-rollback-2026-08-29.json', ...extra] = process.argv.slice(2);
  if (extra.length) fail('usage: validate-save-to-mind-bedrock-candidate.mjs [candidate.json] [rollback.json]');
  const result = validateCandidate(readJson(candidatePath), readJson(rollbackPath));
  result.candidateSha256 = sha256(candidatePath);
  result.rollbackSha256 = sha256(rollbackPath);
  console.log(JSON.stringify(result));
  if (!result.deploymentReady) process.exitCode = 2;
}
