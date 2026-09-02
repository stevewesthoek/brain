import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import benchmark from '../orchestration/codex-activation-benchmark-v6a.mjs';
import edgeCases from '../orchestration/phase6a-gate-edge-corpus.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';
import { auditKiroProjection, revalidateConsumers } from './phase6a-projection-audit.mjs';
import { activationTelemetry, compareShadowDecisions, createCodexCanary, evaluateCodexCanary, rollbackCodexCanary, validateCanarySpec } from './codex-canary-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const catalog = createCapabilityCatalog({ repoRoot });
const activeNames = fs.readdirSync(path.join(repoRoot, 'ai/skills/active')).filter((name) => !name.startsWith('.')).sort();
const gates = (result) => new Set((result.graph?.nodes ?? []).filter((node) => ['QUALITY_GATE', 'SAFETY_GATE'].includes(node.role)).map((node) => node.capabilityRef.capabilityId));

test('Kiro canonical repository manifest accounts for seven valid entries without live activation', () => {
  const audit = auditKiroProjection({ repoRoot, activeNames });
  assert.equal(audit.entryCount, 7);
  assert.equal(audit.accounted, true);
  assert.equal(audit.repositoryProjection, 'PASS');
  assert.equal(audit.unexplainedDrift, 0);
  assert.equal(audit.liveActivation, 'NOT_PERFORMED');
  assert.equal(audit.inventory.filter((entry) => entry.sourceValid).length, 7);
});

test('expanded activation benchmark and gate-edge corpus remain proportional and execution-free', () => {
  assert.ok(benchmark.length >= 200);
  assert.ok(edgeCases.length >= 30);
  for (const fixture of [...benchmark, ...edgeCases]) {
    const result = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: fixture.id, prompt: fixture.prompt });
    assert.equal(result.safety.providerCalls, 0, fixture.id);
    assert.equal(result.safety.writes, 0, fixture.id);
    assert.equal(result.safety.activationPerformed, false, fixture.id);
    for (const gate of [...(fixture.expected.qualityGates ?? []), ...(fixture.expected.safetyGates ?? [])]) assert.ok(gates(result).has(gate), `${fixture.id}: ${gate}`);
  }
});

test('cross-consumer and canary isolation remain bounded', () => {
  const projections = revalidateConsumers({ repoRoot, activeNames });
  assert.equal(projections.allApplicableHealthy, true);
  const off = evaluateCodexCanary({ contract: createCodexCanary(), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan' });
  const on = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan' });
  const other = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'research', routeClass: 'read-only-plan' });
  const failure = evaluateCodexCanary({ contract: createCodexCanary({ enabled: true }), consumer: 'codex', domain: 'code', routeClass: 'read-only-plan', failureInjected: true });
  assert.equal(off.selectedPath, 'legacy');
  assert.equal(on.selectedPath, 'v2');
  assert.equal(other.selectedPath, 'legacy');
  assert.equal(failure.selectedPath, 'legacy');
  assert.deepEqual(validateCanarySpec(), []);
  assert.equal(rollbackCodexCanary(createCodexCanary({ enabled: true })).rollback.pass, true);
  assert.equal(compareShadowDecisions({ prompts: [{ id: 'one', prompt: 'Analyze the code.' }], v2Decisions: [{ family: 'code' }] }).executionPerformed, false);
  assert.equal(activationTelemetry({ state: on.state, selectedPath: on.selectedPath }).writes, 0);
});
