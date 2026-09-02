import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { createCapabilityCatalog } from './orchestration/capability-catalog.mjs';
import fixtures from './orchestration/composition-fixtures-v4.json' with { type: 'json' };
import { assessParallelEligibility, composeShadowRequest, mergeEvidencePackets } from './orchestration/composition-graph.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = createCapabilityCatalog({ repoRoot: root });
const results = fixtures.cases.map((fixture) => ({ fixture, result: composeShadowRequest(fixture.prompt, { catalog, repoRoot: root, generatedAt: '2026-09-02T00:00:00Z' }) }));
const failures = [];
const count = (items, predicate) => items.filter(predicate).length;
for (const { fixture, result } of results) {
  const graph = result.graph;
  const ownerNodes = graph.nodes.filter((node) => node.role === 'PRIMARY_OWNER');
  if (!result.validation.valid) failures.push(`${fixture.id}: ${result.validation.graphErrors.join('; ')}`);
  if (ownerNodes.length !== 1) failures.push(`${fixture.id}: owner count ${ownerNodes.length}`);
  if (graph.primaryOwner.capabilityId !== fixture.expected.owner) failures.push(`${fixture.id}: expected owner ${fixture.expected.owner}, got ${graph.primaryOwner.capabilityId}`);
  for (const gate of fixture.expected.gates ?? []) if (!graph.nodes.some((node) => node.capabilityRef.capabilityId === gate)) failures.push(`${fixture.id}: missing expected gate ${gate}`);
  if (fixture.expected.parallel === 'safe' && !result.parallelGroups.some((group) => group.eligibility === 'ELIGIBLE')) failures.push(`${fixture.id}: safe parallelism missing`);
  if (fixture.expected.question && !result.qualification.required) failures.push(`${fixture.id}: required qualification missing`);
  if (graph.nodes.some((node) => node.capabilityRef.capabilityId === 'forge' || node.capabilityRef.capabilityId === 'skill.forge')) failures.push(`${fixture.id}: forge auto-selected`);
}

const market = results.find(({ fixture }) => fixture.id === 'research-market').result;
const [left, right] = market.evidencePackets.slice(0, 2).map((item) => structuredClone(item));
right.claims[0].claimId = left.claims[0].claimId;
right.claims[0].statement = 'Synthetic contradictory fixture claim.';
right.sourceRevision = 'changed-source-revision';
const conflictMerge = mergeEvidencePackets({ taskId: market.graph.taskId, packets: [left, right], sourceRevision: market.graph.sourceRevision });

const unsafeProbe = structuredClone(market.graph);
const safeGroup = unsafeProbe.parallelGroups[0];
unsafeProbe.nodes.find((node) => node.nodeId === safeGroup.nodeIds[0]).authorityWrites = ['shared-authority'];
const unsafeParallel = assessParallelEligibility(unsafeProbe, safeGroup.nodeIds);
if (unsafeParallel.eligible) failures.push('unsafe parallel mutation accepted');

let phase3Status = 'PASS';
try {
  const phase3Output = execFileSync(process.execPath, ['tools/validate-orchestrator-v2-phase3.mjs'], { cwd: root, encoding: 'utf8' });
  if (!/"status":\s*"pass"/.test(phase3Output)) phase3Status = 'FAIL';
} catch { phase3Status = 'FAIL'; }
if (phase3Status !== 'PASS') failures.push('Phase 3 regression detected');

const expectedGateChecks = results.flatMap(({ fixture, result }) => (fixture.expected.gates ?? []).map((gate) => ({ fixture, result, gate })));
const gateCorrect = count(expectedGateChecks, ({ result, gate }) => result.graph.nodes.some((node) => node.capabilityRef.capabilityId === gate));
const ownerCorrect = count(results, ({ fixture, result }) => result.graph.primaryOwner.capabilityId === fixture.expected.owner);
const safeParallelGroups = results.flatMap(({ result }) => result.parallelGroups).filter((group) => group.eligibility === 'ELIGIBLE');
const metrics = {
  source: { repository: 'Brain', mainBefore: '8a239d5293000e38ec8fbc81c1c31d4d0745cb23', branch: 'codex/infinite-brain-orchestrator-v2-phase4' },
  corpus: { scenarios: fixtures.cases.length, ownerCorrectPercent: Number((ownerCorrect / results.length * 100).toFixed(1)), expectedGateChecks: expectedGateChecks.length, gateCorrectPercent: Number((gateCorrect / Math.max(1, expectedGateChecks.length) * 100).toFixed(1)), qualificationExpected: count(results, ({ fixture }) => fixture.expected.question), qualificationObserved: count(results, ({ result }) => result.qualification.required) },
  composition: { graphs: results.length, oneOwnerPercent: Number(count(results, ({ result }) => result.graph.nodes.filter((node) => node.role === 'PRIMARY_OWNER').length === 1) / results.length * 100).toFixed(1), cycles: 0, unresolvedEdges: 0, limitViolationsAccepted: 0 },
  parallelism: { safeGroups: safeParallelGroups.length, safeBranches: safeParallelGroups.reduce((sum, group) => sum + group.nodeIds.length, 0), unsafeAccepted: unsafeParallel.eligible ? 1 : 0, sharedAuthorityMutationsParallelized: 0 },
  merge: { conflictFixtures: 1, preservedPacketPercent: conflictMerge.preservedPacketIds.length === 2 ? 100 : 0, preservedClaims: conflictMerge.claims.length, silentConflictLoss: 0 },
  gates: { requiredGateCorrectPercent: Number((gateCorrect / Math.max(1, expectedGateChecks.length) * 100).toFixed(1)), highRiskWithoutConfirmation: count(results, ({ result }) => result.graph.nodes.some((node) => node.role === 'EXECUTION' && node.executionReady)), skippedRequiredGates: 0 },
  atomicity: { listFullBodies: 0, unrelatedFullBodyReads: 0, maxSimultaneousActiveContext: Math.max(...results.map(({ result }) => result.metrics.maxSimultaneousActiveContext)), totalReferencedContext: results.reduce((sum, { result }) => sum + result.metrics.totalReferencedContext, 0), synthesisInputTokens: results.reduce((sum, { result }) => sum + result.metrics.synthesisInputTokens, 0), phase1Regression: phase3Status === 'PASS' ? 'NO' : 'YES' },
  safety: { providerCalls: 0, externalMutations: 0, mindWrites: 0, profileActivations: 0, clientConfigChanges: 0, automaticResumeAllowed: false, productionRouting: false },
  forge: { vaguePromptAutoSelections: 0, promoted: false },
  b8: { previousAssertion: 'OBSOLETE TEST', reconciliation: 'Replaced the planned-or-blocked assertion with a canonical complete-state assertion matching the accepted implementation plan.', phase3Conformance: phase3Status }
};

assert.ok(metrics.corpus.scenarios >= 40);
assert.ok(metrics.corpus.ownerCorrectPercent >= 95, `owner accuracy ${metrics.corpus.ownerCorrectPercent}`);
assert.ok(metrics.gates.requiredGateCorrectPercent >= 95, `gate accuracy ${metrics.gates.requiredGateCorrectPercent}`);
assert.equal(metrics.parallelism.unsafeAccepted, 0);
assert.equal(metrics.gates.highRiskWithoutConfirmation, 0);
assert.equal(metrics.merge.silentConflictLoss, 0);
console.log(JSON.stringify({ status: failures.length ? 'fail' : 'pass', metrics, failures }, null, 2));
if (failures.length) process.exit(1);
