import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  HARDENING_COVERAGE_MATRIX,
  HARDENING_FAULT_CLASSES,
  evaluateHardeningGate,
  type HardeningCoverageEntry,
} from './fixtures/agent-mode-hardening-harness.js';
import {
  H0_F_BOUNDARY_TAXONOMY,
  H0_F_STRUCTURAL_EVIDENCE,
  H0_F_STRUCTURAL_EVIDENCE_SCHEMA,
  validateH0FStructuralEvidence,
} from './fixtures/agent-mode-h0-f-structural-gate.js';

const harnessRoot = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const runtimePath = join(import.meta.dirname, '../../src/agent-mode/restricted-harness-agent-runtime.ts');
const profilePath = join(import.meta.dirname, '../../src/agent-mode/deepseek-harness-restricted-profile.ts');
const runtimeSource = readFileSync(runtimePath, 'utf8');
const profileSource = readFileSync(profilePath, 'utf8');

function completeGateEntries(overrides: Partial<Record<(typeof HARDENING_FAULT_CLASSES)[number], HardeningCoverageEntry['status']>> = {}): HardeningCoverageEntry[] {
  return HARDENING_FAULT_CLASSES.map((faultClass) => ({
    faultClass,
    status: overrides[faultClass] ?? (HARDENING_COVERAGE_MATRIX.find((entry) => entry.faultClass === faultClass)?.acceptanceRequirement === 'structural' ? 'structural_pass' : HARDENING_COVERAGE_MATRIX.find((entry) => entry.faultClass === faultClass)?.acceptanceRequirement === 'live' ? 'live_pass' : 'fixture_pass'),
    evidence: [`h0-f:${faultClass}`],
  }));
}

test('H0-F defines the closed denial taxonomy and validates bounded structural evidence', () => {
  assert.deepEqual(H0_F_BOUNDARY_TAXONOMY, ['RUNTIME_DENIAL', 'STRUCTURAL_ABSENCE', 'POLICY_DENIAL', 'NOT_APPLICABLE']);
  assert.equal(H0_F_STRUCTURAL_EVIDENCE_SCHEMA, 'agent-mode.h0-f-structural-evidence.v1');
  assert.equal(H0_F_STRUCTURAL_EVIDENCE.length, 2);
  let allEdges = H0_F_STRUCTURAL_EVIDENCE.flatMap((evidence) => evidence.attackGraph);
  for (const evidence of H0_F_STRUCTURAL_EVIDENCE) {
    assert.equal(validateH0FStructuralEvidence(evidence).status, 'structural_pass');
    assert.equal(evidence.classification, 'STRUCTURAL_ABSENCE');
    assert.ok(evidence.attackGraph.some((edge) => edge.status === 'absent'));
    assert.ok(evidence.attackGraph.some((edge) => edge.status === 'unreachable'));
  }
  assert.ok(allEdges.some((edge) => edge.status === 'present'));
  assert.ok(allEdges.some((edge) => edge.status === 'test-only' || edge.status === 'policy-gated'));
});

test('H0-F audits the exact pinned SDK surfaces and Brain production composition', () => {
  assert.equal(existsSync(join(harnessRoot, 'packages/sdk/client/lib/index.js')), true);
  const client = readFileSync(join(harnessRoot, 'packages/sdk/client/lib/index.js'), 'utf8');
  const tools = readFileSync(join(harnessRoot, 'packages/core/tools/lib/index.js'), 'utf8');
  assert.match(client, /resolveDshNodeLaunchFromManifests/);
  assert.match(client, /patches\.flatMap/);
  assert.match(client, /spawn\(this\.runtime\.command/);
  assert.match(tools, /RUN_CODE_NAME = "run_code"/);
  assert.match(tools, /UNKNOWN_TOOL/);
  assert.match(tools, /register\(definition\)/);
  assert.match(tools, /run_code/);
  assert.match(runtimeSource, /inject = \["llm"\]/);
  assert.match(runtimeSource, /allowedToolNames: \[\]/);
  assert.match(runtimeSource, /verifyRestrictedTopology/);
  assert.doesNotMatch(runtimeSource, /tools\.register|tool-call|sandboxApi|filesystemService|subprocessService/);
  assert.match(profileSource, /allowedToolNames: \['brain_read'\]/);
  for (const denied of ['sandbox', 'sandbox-policy', 'subprocess', 'terminal-bash', 'terminal-pwsh', 'fs-local', 'persistent-bash', 'jobs', 'subagents']) assert.match(profileSource, new RegExp(`['"]${denied}['"]`));
});

test('H0-F proves caller-controlled inputs cannot widen the audited production topology', () => {
  assert.match(runtimeSource, /validateHarnessRoot\(this\.options\.harnessRoot\)/);
  assert.match(runtimeSource, /path\.basename\(root\) !== DEEPSEEK_HARNESS_PIN\.commit/);
  assert.match(runtimeSource, /manifests\.some\(.*DEEPSEEK_HARNESS_PIN\.version/);
  assert.match(runtimeSource, /patches: \[files\.patchPath\]/);
  assert.match(runtimeSource, /provider: 'brain-k42-d2-fixture'/);
  assert.match(runtimeSource, /env: childEnv/);
  assert.doesNotMatch(runtimeSource, /this\.options\.(allowedToolNames|tools|sandbox|profile|providerIds|allowedProviders)/);
  assert.ok(H0_F_STRUCTURAL_EVIDENCE.every((evidence) => evidence.callerControlChecks.length === 5));
});

test('H0-F structural acceptance is explicit and missing evidence remains incomplete', () => {
  assert.deepEqual(HARDENING_COVERAGE_MATRIX.filter((entry) => entry.acceptanceRequirement === 'structural').map((entry) => entry.faultClass), ['sandbox_denial', 'tool_denial']);
  const accepted = evaluateHardeningGate(completeGateEntries(), { wallClockSoak: 'wall_clock_pass', securityReview: 'live_pass' });
  assert.equal(accepted.status, 'PASS');
  const missingStructural = evaluateHardeningGate(completeGateEntries({ sandbox_denial: 'not_run' }), { wallClockSoak: 'wall_clock_pass', securityReview: 'live_pass' });
  assert.equal(missingStructural.status, 'INCOMPLETE');
  assert.ok(missingStructural.missing.includes('scenario:sandbox_denial'));
  const wrongMode = evaluateHardeningGate(completeGateEntries({ tool_denial: 'live_pass' }), { wallClockSoak: 'wall_clock_pass', securityReview: 'live_pass' });
  assert.equal(wrongMode.status, 'INCOMPLETE');
  assert.ok(wrongMode.missing.includes('structural_acceptance:tool_denial'));
  const providerStillBlocked = evaluateHardeningGate(completeGateEntries({ provider_outage: 'fixture_pass' }), { wallClockSoak: 'wall_clock_pass', securityReview: 'live_pass' });
  assert.equal(providerStillBlocked.status, 'INCOMPLETE');
  assert.ok(providerStillBlocked.missing.includes('live_acceptance:provider_outage'));
});
