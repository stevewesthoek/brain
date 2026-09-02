import assert from 'node:assert/strict';
import test from 'node:test';
import { createCapabilityCatalog } from './capability-catalog.mjs';
import {
  assessParallelEligibility,
  buildParallelGroups,
  composeShadowRequest,
  mergeEvidencePackets,
  propagateNodeFailure,
  validateCompositionGraph,
  validateContinuationRef,
} from './composition-graph.mjs';
import fixtures from './composition-fixtures-v4.json' with { type: 'json' };

const root = new URL('../..', import.meta.url).pathname;
const catalog = createCapabilityCatalog({ repoRoot: root });

function plan(prompt, currentState = {}) {
  return composeShadowRequest(prompt, { catalog, repoRoot: root, currentState, generatedAt: '2026-09-02T00:00:00Z' });
}

test('Phase 4 corpus has at least 40 mixed-domain structural scenarios', () => {
  assert.ok(fixtures.cases.length >= 40);
  assert.ok(new Set(fixtures.cases.map((item) => item.id)).size === fixtures.cases.length);
});

test('all corpus graphs have one owner, bounded nodes, explicit failure, and no execution', () => {
  for (const fixture of fixtures.cases) {
    const result = plan(fixture.prompt);
    assert.equal(result.validation.valid, true, `${fixture.id}: ${result.validation.graphErrors.join('; ')}`);
    assert.equal(result.graph.nodes.filter((node) => node.role === 'PRIMARY_OWNER').length, 1, fixture.id);
    assert.equal(result.graph.primaryOwner.capabilityId, fixture.expected.owner, fixture.id);
    assert.ok(result.graph.nodes.length <= result.graph.bounds.maxNodes, fixture.id);
    assert.ok(result.graph.nodes.every((node) => node.outputs.length > 0 && node.failureBehavior), fixture.id);
    assert.equal(result.graph.execution.executionReady, false, fixture.id);
    assert.equal(result.graph.execution.providerCalls, 0, fixture.id);
    assert.equal(result.graph.execution.externalMutations, 0, fixture.id);
    assert.equal(result.graph.metadata.forgeSelection, 'never_auto_select', fixture.id);
    for (const gate of fixture.expected.gates ?? []) assert.ok(result.graph.nodes.some((node) => node.capabilityRef.capabilityId === gate), `${fixture.id}: missing ${gate}`);
    if (fixture.expected.merge) assert.ok(result.graph.mergeNodes.length > 0, `${fixture.id}: merge expected`);
    if (fixture.expected.parallel === 'safe') assert.ok(buildParallelGroups(result.graph).some((group) => group.eligibility === 'ELIGIBLE'), `${fixture.id}: safe parallel group expected`);
    if (fixture.expected.question) assert.equal(result.qualification.required, true, `${fixture.id}: qualification expected`);
  }
});

test('world-class dashboard has Design → evidence → Code → visual review → QA ordering', () => {
  const result = plan('Build me a world-class SaaS dashboard.');
  const graph = result.graph;
  const edge = (from, to) => graph.edges.some((item) => item.from === from && item.to === to);
  assert.equal(graph.primaryOwner.capabilityId, 'skill.design');
  assert.ok(edge('merge-evidence', 'gate-gate.design-review'));
  assert.ok(edge('gate-gate.design-review', 'gate-gate.visual-qa') === false);
  assert.ok(graph.nodes.some((node) => node.nodeId === 'task-code' && node.capabilityRef.capabilityId === 'skill.code'));
  assert.ok(edge('task-code', 'gate-gate.visual-qa'));
  assert.ok(edge('gate-gate.visual-qa', 'gate-gate.review'));
  assert.ok(edge('gate-gate.review', 'gate-gate.qa'));
});

test('market research uses four safe independent branches and a conflict-preserving merge', () => {
  const result = plan('Research whether we should enter this market.');
  const group = result.parallelGroups.find((item) => item.eligibility === 'ELIGIBLE');
  assert.equal(group.nodeIds.length, 4);
  assert.equal(result.mergedEvidence.blindConcatenation, false);
  assert.deepEqual(new Set(result.mergedEvidence.preservedPacketIds), new Set(result.evidencePackets.map((item) => item.evidenceId)));
});

test('merge retains contradictory claims and source revision conflicts', () => {
  const result = plan('Research whether we should enter this market.');
  const [left, right] = result.evidencePackets.slice(0, 2).map((item) => structuredClone(item));
  right.claims[0].claimId = left.claims[0].claimId;
  right.claims[0].statement = 'A deliberately contradictory synthetic claim.';
  right.sourceRevision = 'changed-source-revision';
  const merged = mergeEvidencePackets({ taskId: result.graph.taskId, packets: [left, right], sourceRevision: result.graph.sourceRevision });
  assert.equal(merged.status, 'CONFLICTED');
  assert.ok(merged.conflicts.length >= 2);
  assert.equal(merged.claims.length, left.claims.length + right.claims.length);
  assert.equal(merged.preservedPacketIds.length, 2);
});

test('parallel eligibility fails closed for dependency, mutation, confirmation, and missing merge policy', () => {
  const result = plan('Build this feature.');
  const group = result.graph.parallelGroups[0];
  const unsafe = structuredClone(result.graph);
  unsafe.nodes.find((node) => node.nodeId === group.nodeIds[0]).authorityWrites = ['repository'];
  const assessment = assessParallelEligibility(unsafe, group.nodeIds);
  assert.equal(assessment.eligible, false);
  assert.match(assessment.reasons.join(' '), /mutation/);
  unsafe.nodes.find((node) => node.nodeId === group.nodeIds[0]).authorityWrites = [];
  unsafe.dependencies.push({ from: group.nodeIds[0], to: group.nodeIds[1], reason: 'dependent synthetic branch' });
  assert.equal(assessParallelEligibility(unsafe, group.nodeIds).eligible, false);
});

test('failure propagation never turns a failed node into silent success', () => {
  const result = plan('Research whether we should enter this market.');
  const receipt = propagateNodeFailure(result.graph, 'specialist-market-size', 'GATE_FAILED');
  assert.equal(receipt.silentSuccess, false);
  assert.ok(receipt.skippedDependents.includes('merge-evidence'));
  assert.ok(receipt.skippedDependents.includes('synthesis'));
});

test('validator rejects owner, cycle, unknown capability, unbounded context, unsafe execution, and stale source', () => {
  const result = plan('Build this feature.');
  const invalid = structuredClone(result.graph);
  invalid.nodes[0].role = 'SPECIALIST';
  invalid.nodes[1].capabilityRef.capabilityId = 'skill.unknown';
  invalid.nodes[1].contextLifetime.rawContextLoaded = 1;
  invalid.dependencies.push({ from: 'owner-primary', to: 'owner-primary', reason: 'cycle' });
  invalid.edges.push({ edgeId: 'edge-cycle', from: 'owner-primary', to: 'owner-primary', type: 'DEPENDENCY', semantics: 'cycle', required: true });
  invalid.nodes.find((node) => node.role === 'EXECUTION')?.executionReady;
  invalid.sourceRevision = 'stale';
  const errors = validateCompositionGraph(invalid, { taskPacket: result.taskPacket, catalog, currentSourceRevision: result.graph.sourceRevision });
  assert.ok(errors.some((item) => /primary owner count/.test(item)));
  assert.ok(errors.some((item) => /unknown capability/.test(item)));
  assert.ok(errors.some((item) => /unbounded raw context/.test(item)));
  assert.ok(errors.some((item) => /cycle/.test(item)));
  assert.ok(errors.some((item) => /SOURCE_CHANGED/.test(item)));
});

test('continuation is explicit and blocks stale or conflicted state', () => {
  const result = plan('Pause this task for tomorrow.');
  assert.ok(validateContinuationRef(result.graph, { currentSourceRevision: result.graph.sourceRevision, contextState: 'CURRENT', explicitResume: false }).some((item) => item.includes('automatic resume')));
  assert.ok(validateContinuationRef(result.graph, { currentSourceRevision: 'changed', contextState: 'STALE', explicitResume: true }).length >= 2);
});
