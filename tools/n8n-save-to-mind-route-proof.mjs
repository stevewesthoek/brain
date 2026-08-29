#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

export const DEPLOYMENT_CANDIDATE = 'operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json';

const EXPECTED_NODE_IDS = new Set([
  'webhook-trigger', 'build-gemini-body', 'gemini-classify', 'build-processed-note',
  'check-github-file', 'handle-file-check', 'file-exists-check',
  'save-to-github-create', 'save-to-github-update', 'respond-webhook'
]);
const EXPECTED_NODE_TYPES = new Map([
  ['webhook-trigger', 'n8n-nodes-base.webhook'], ['build-gemini-body', 'n8n-nodes-base.code'],
  ['gemini-classify', ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.code']], ['build-processed-note', 'n8n-nodes-base.code'],
  ['check-github-file', 'n8n-nodes-base.httpRequest'], ['handle-file-check', 'n8n-nodes-base.code'],
  ['file-exists-check', 'n8n-nodes-base.if'], ['save-to-github-create', 'n8n-nodes-base.httpRequest'],
  ['save-to-github-update', 'n8n-nodes-base.httpRequest'], ['respond-webhook', 'n8n-nodes-base.respondToWebhook'],
]);
const WRITE_BOUNDARIES = new Set(['save-to-github-create', 'save-to-github-update']);
const RETIRED_PATHS = ['capture/inbox', 'capture/failed'];

const fail = message => { throw new Error(message); };
const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const nodeById = workflow => new Map((workflow.nodes ?? []).map(node => [node.id, node]));

function edges(workflow) {
  const ids = new Map((workflow.nodes ?? []).map(node => [node.name, node.id]));
  const result = [];
  for (const [sourceName, outputs] of Object.entries(workflow.connections ?? {})) {
    for (const [sourceOutput, groups] of Object.entries(outputs ?? {})) {
      groups.forEach((group, sourceOutputIndex) => group.forEach(target => result.push({
        sourceNodeId: ids.get(sourceName), sourceOutput, sourceOutputIndex,
        targetNodeId: ids.get(target.node), targetInput: target.type ?? 'main', targetInputIndex: target.index ?? 0,
      })));
    }
  }
  return result;
}

function reachable(start, graph) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.filter(item => item.sourceNodeId === current)) {
      if (!seen.has(edge.targetNodeId)) { seen.add(edge.targetNodeId); queue.push(edge.targetNodeId); }
    }
  }
  return seen;
}

function assertExactTopology(nodes, graph) {
  if (nodes.size !== EXPECTED_NODE_IDS.size || [...nodes.keys()].some(id => !EXPECTED_NODE_IDS.has(id))) fail('unexpected_node_set');
  if ([...EXPECTED_NODE_TYPES].some(([id, expected]) => {
    const allowed = Array.isArray(expected) ? expected : [expected];
    return !allowed.includes(nodes.get(id)?.type);
  })) fail('unlisted_node_type_change');
  if ([...nodes.values()].filter(node => String(node.type).toLowerCase().includes('webhook')).length !== 2) fail('webhook_boundary_count_invalid');
  if ([...nodes.values()].some(node => /schedule|cron/i.test(String(node.type)))) fail('schedule_trigger_present');
  if (graph.some(edge => !nodes.has(edge.sourceNodeId) || !nodes.has(edge.targetNodeId))) fail('invalid_graph_edge');
}

function assertDestinationProgram(node) {
  if (!node || node.type !== 'n8n-nodes-base.code' || typeof node.parameters?.jsCode !== 'string') fail('failure_routing_node_missing');
  const code = node.parameters.jsCode;
  const required = [
    /orig\.forceFailure\s*===\s*true/,
    /failureStage\s*=\s*'(?:gemini-classify|claude-haiku-classify)'/,
    /\$env\.MIND_INBOX_PATH\s*\|\|\s*'inbox\/new'/,
    /\$env\.MIND_FAILED_PATH\s*\|\|\s*'inbox\/failed'/,
    /isFailed\s*\?\s*failedPrefix\s*:\s*inboxPrefix/,
  ];
  if (required.some(pattern => !pattern.test(code))) fail('destination_program_contract_missing');
  if (RETIRED_PATHS.some(path => code.includes(path))) fail('retired_destination_present');
}

export function verifySaveToMindRouteProof(workflow) {
  const nodes = nodeById(workflow);
  const graph = edges(workflow);
  assertExactTopology(nodes, graph);
  assertDestinationProgram(nodes.get('build-processed-note'));
  const fromWebhook = reachable('webhook-trigger', graph);
  if (!WRITE_BOUNDARIES.isSubsetOf(fromWebhook)) fail('webhook_does_not_reach_all_write_boundaries');
  if (!fromWebhook.has('build-processed-note')) fail('success_and_failure_router_not_reachable');
  const writes = graph.filter(edge => WRITE_BOUNDARIES.has(edge.targetNodeId));
  if (writes.length !== 2 || writes.some(edge => edge.sourceNodeId !== 'file-exists-check')) fail('extra_or_bypass_external_write_branch');
  if (graph.some(edge => edge.sourceNodeId === 'webhook-trigger' && edge.targetNodeId !== 'build-gemini-body')) fail('second_webhook_route_present');
  return { ok: true, requiredRoutes: ['webhook-trigger→build-processed-note→GitHub write', 'forceFailure→build-processed-note→GitHub write'], forbiddenDestinations: RETIRED_PATHS };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = verifySaveToMindRouteProof(readJson(process.argv[2] ?? DEPLOYMENT_CANDIDATE));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
