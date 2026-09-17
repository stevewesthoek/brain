import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  H0_E_DENIAL_DECISIONS,
  H0_E_PRODUCTION_INVARIANTS,
  H0_E_SCHEMA_VERSION,
} from './fixtures/agent-mode-h0-e-restricted-topology.js';

const harnessRoot = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const toolsRuntime = readFileSync(join(harnessRoot, 'packages/core/tools/lib/index.js'), 'utf8');
const restrictedRuntime = readFileSync(join(import.meta.dirname, '../../src/agent-mode/restricted-harness-agent-runtime.ts'), 'utf8');
const restrictedProfile = readFileSync(join(import.meta.dirname, '../../src/agent-mode/deepseek-harness-restricted-profile.ts'), 'utf8');

test('H0-E audits the pinned SDK unknown-tool semantics without inventing a tool', () => {
  assert.equal(H0_E_SCHEMA_VERSION, 'agent-mode.h0-e-restricted-topology.v1');
  assert.match(toolsRuntime, /unknown tool/);
  assert.match(toolsRuntime, /UNKNOWN_TOOL/);
  assert.match(toolsRuntime, /register\(definition\)/);
  assert.equal(H0_E_DENIAL_DECISIONS.toolDenial.status, 'not_run');
  assert.equal(H0_E_DENIAL_DECISIONS.toolDenial.reasonCode, 'RESTRICTED_COMPOSITION_HAS_NO_TOOL_SURFACE');
});

test('H0-E proves Brain production composition has no reachable tool or sandbox denial surface', () => {
  assert.match(restrictedRuntime, /inject = \[\"llm\"\]/);
  assert.match(restrictedRuntime, /provider: 'brain-k42-d2-fixture'/);
  assert.doesNotMatch(restrictedRuntime, /tools\.register|tool-call|filesystem/);
  assert.match(restrictedProfile, /allowedToolNames: \['brain_read'\]/);
  assert.match(restrictedProfile, /'sandbox'/);
  assert.equal(H0_E_DENIAL_DECISIONS.sandboxDenial.status, 'not_run');
  assert.equal(H0_E_DENIAL_DECISIONS.sandboxDenial.reasonCode, 'RESTRICTED_COMPOSITION_HAS_NO_SANDBOX_SURFACE');
});

test('H0-E production invariants remain closed and test-only topology is not authority', () => {
  assert.deepEqual(H0_E_PRODUCTION_INVARIANTS, {
    productionAuthorityWidened: false,
    productionDenialInjection: false,
    productionToolRegistration: false,
    productionSandboxRegistration: false,
    providerAccessAdded: false,
    networkAccessAdded: false,
  });
  assert.equal(H0_E_DENIAL_DECISIONS.toolDenial.selectedTopology, 'none');
  assert.equal(H0_E_DENIAL_DECISIONS.sandboxDenial.selectedTopology, 'none');
});
