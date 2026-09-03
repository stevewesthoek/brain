import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { resolveCapabilityProviders } from '../orchestration/capability-providers.mjs';
import { createClaudeCodeAdapter } from './claude-code-consumer-adapter.mjs';
import { createCodexDesignWebAdapter } from './codex-design-web-consumer-adapter.mjs';
import { executeSharedVisualTask } from './shared-capability-runtime.mjs';
import { createLocalPlaywrightVisualProvider, SHARED_VISUAL_CAPABILITIES } from './shared-visual-capability.mjs';
import { semanticProjection } from './universal-consumer-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixtureSource = path.join(repoRoot, 'tools/context-learning/fixtures/phase9a');
const visualCapabilities = SHARED_VISUAL_CAPABILITIES.map((item) => item.capabilityId);

function fixtureWorkspace() {
  const boundary = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-shared-visual-'));
  const artifact = path.join(boundary, 'artifact');
  fs.cpSync(fixtureSource, artifact, { recursive: true });
  return { boundary, artifact, outputRoot: path.join(boundary, 'evidence') };
}

function input(workspace, id = 'shared-visual') {
  return { id, message: 'Design a polished responsive landing page for this fixture.', requiredCapabilities: visualCapabilities, workspace: { boundary: workspace.boundary, resolved: true }, session: { id, resumable: true } };
}

const actions = [
  { kind: 'click', selector: '.menu-button' },
  { kind: 'expectAttribute', selector: '.menu-button', name: 'aria-expanded', value: 'true' },
  { kind: 'fill', selector: '#email', value: '' },
  { kind: 'click', selector: '#contact-form button' },
  { kind: 'expectAttribute', selector: '#email', name: 'aria-invalid', value: 'true' },
  { kind: 'fill', selector: '#email', value: 'hello@example.com' },
  { kind: 'click', selector: '#contact-form button' },
  { kind: 'expectText', selector: '#form-message', value: 'Thanks' }
];

test('Claude resolves missing native visual capabilities through one shared Brain provider', async () => {
  const workspace = fixtureWorkspace();
  const provider = createLocalPlaywrightVisualProvider({ outputRoot: workspace.outputRoot });
  const preflight = await provider.preflight();
  assert.equal(preflight.status, 'AVAILABLE');
  const result = await executeSharedVisualTask({ adapter: createClaudeCodeAdapter(), provider, nativeInput: input(workspace), workspace, artifact: { path: workspace.artifact }, viewport: { width: 390, height: 844 }, actions, catalog: createCapabilityCatalog({ repoRoot }), repoRoot });
  assert.equal(result.plan.status, 'READY');
  assert(result.plan.capabilitySelections.filter((item) => visualCapabilities.includes(item.capabilityId)).every((item) => item.outcome === 'SUPPORTED_VIA_SHARED_BRAIN'));
  assert.equal(result.plan.capabilityResolution.providers[0].authority, 'brain');
  assert.equal(result.execution.status, 'RENDERED');
  assert.equal(result.visualQa.status, 'PASS');
  assert.equal(result.functionalQa.status, 'PASS');
  assert.deepEqual(result.evidenceValidationErrors, []);
  assert.equal(result.evidencePacket.execution.mode, 'shared_capability');
  assert.equal(result.evidencePacket.execution.externalMutations, 0);
  assert.equal(result.receipt.outcome, 'VALIDATED');
  assert.equal(result.receipt.sideEffects.externalUploads, 0);
  assert.equal(result.receipt.sideEffects.secretsRead, 0);
  assert(fs.statSync(result.execution.screenshot.path).size > 0);
  fs.rmSync(workspace.boundary, { recursive: true, force: true });
});

test('native and shared provider bindings preserve the same Brain semantic graph', () => {
  const workspace = fixtureWorkspace();
  const provider = createLocalPlaywrightVisualProvider({ outputRoot: workspace.outputRoot });
  const claudePlan = createClaudeCodeAdapter().consume(input(workspace, 'claude-plan'), {}, { capabilityProviders: [provider], repoRoot, catalog: createCapabilityCatalog({ repoRoot }) });
  const codexPlan = createCodexDesignWebAdapter().consume(input(workspace, 'codex-plan'), {}, { repoRoot, catalog: createCapabilityCatalog({ repoRoot }) });
  assert.deepEqual(semanticProjection(claudePlan), semanticProjection(codexPlan));
  assert.equal(claudePlan.capabilitySelections.find((item) => item.capabilityId === 'browser.render').outcome, 'SUPPORTED_VIA_SHARED_BRAIN');
  assert.equal(codexPlan.capabilitySelections.find((item) => item.capabilityId === 'browser.render').outcome, 'SUPPORTED');
  fs.rmSync(workspace.boundary, { recursive: true, force: true });
});

test('provider resolution fails closed for inadmissible providers and unsafe artifact paths', async () => {
  const blocked = resolveCapabilityProviders({ required: ['browser.render'], nativeSelections: [{ capabilityId: 'browser.render', required: true, outcome: 'UNAVAILABLE', selectedCapabilityId: null }], providers: [{ providerId: 'external-browser', providerRevision: '1', providerKind: 'shared_brain', authority: 'brain', health: 'healthy', freshness: 'fresh', workspacePolicy: 'external_upload', capabilities: [{ capabilityId: 'browser.render', available: true }] }] });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.selections[0].outcome, 'UNAVAILABLE');
  const workspace = fixtureWorkspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-outside-'));
  const provider = createLocalPlaywrightVisualProvider({ outputRoot: workspace.outputRoot });
  const result = await executeSharedVisualTask({ adapter: createClaudeCodeAdapter(), provider, nativeInput: input(workspace, 'unsafe-path'), workspace, artifact: { path: outside }, catalog: createCapabilityCatalog({ repoRoot }), repoRoot });
  assert.equal(result.receipt.outcome, 'FAILED');
  assert.match(result.receipt.failure, /outside_workspace/);
  fs.rmSync(workspace.boundary, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});
