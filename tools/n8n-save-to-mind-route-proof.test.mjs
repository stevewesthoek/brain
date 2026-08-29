import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { verifySaveToMindRouteProof } from './n8n-save-to-mind-route-proof.mjs';

const candidate = JSON.parse(fs.readFileSync('operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json', 'utf8'));
const bedrockCandidate = JSON.parse(fs.readFileSync('operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json', 'utf8'));
const clone = () => structuredClone(candidate);
const find = (workflow, id) => workflow.nodes.find(node => node.id === id);
const expectFail = (mutate, message) => {
  const workflow = clone();
  mutate(workflow);
  assert.throws(() => verifySaveToMindRouteProof(workflow), new RegExp(message));
};

test('exact approved structural routes pass', () => assert.equal(verifySaveToMindRouteProof(clone()).ok, true));
test('Bedrock classifier candidate preserves the exact write routes', () => assert.equal(verifySaveToMindRouteProof(bedrockCandidate).ok, true));
test('missing success route fails', () => expectFail(workflow => { workflow.connections.Webhook.main[0][0].node = 'Respond'; }, 'webhook_does_not_reach_all_write_boundaries'));
test('missing failure route fails', () => expectFail(workflow => { find(workflow, 'build-processed-note').parameters.jsCode = 'const inboxPrefix = \'inbox/new\';'; }, 'destination_program_contract_missing'));
test('retired success destination fails', () => expectFail(workflow => { find(workflow, 'build-processed-note').parameters.jsCode += "\nconst retired='capture/inbox';"; }, 'retired_destination_present'));
test('retired failure destination fails', () => expectFail(workflow => { find(workflow, 'build-processed-note').parameters.jsCode += "\nconst retired='capture/failed';"; }, 'retired_destination_present'));
test('extra external-write branch fails', () => expectFail(workflow => { workflow.connections.Webhook.main[0].push({ node: find(workflow, 'save-to-github-create').name, type: 'main', index: 0 }); }, 'extra_or_bypass_external_write_branch'));
test('schedule trigger fails', () => expectFail(workflow => { workflow.nodes.push({ id: 'schedule', name: 'Schedule', type: 'n8n-nodes-base.cron', parameters: {} }); }, 'unexpected_node_set'));
test('second webhook fails', () => expectFail(workflow => { workflow.nodes.push({ id: 'webhook-two', name: 'Webhook Two', type: 'n8n-nodes-base.webhook', parameters: {} }); }, 'unexpected_node_set'));
test('unlisted node change fails', () => expectFail(workflow => { find(workflow, 'build-gemini-body').type = 'n8n-nodes-base.set'; }, 'unlisted_node_type_change'));
test('unlisted connection change fails', () => expectFail(workflow => { workflow.connections['Build Gemini Body'].main[0][0].node = 'Respond'; }, 'webhook_does_not_reach_all_write_boundaries|extra_or_bypass_external_write_branch'));
