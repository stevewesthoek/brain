import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createCapabilityCatalog } from './capability-catalog.mjs';
import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';
import { assessContinuity, AUTHORITY_MODEL, getPacketSchemas, planShadowPacket, validateEvidencePacket, validateTaskPacket } from './task-evidence-packets.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixtures = loadJson(path.join(repoRoot, 'tools/orchestration/packet-fixtures-v3.json'));

function planned(prompt, options = {}) {
  return planShadowPacket(prompt, { catalog: options.catalog ?? createCapabilityCatalog({ repoRoot }), repoRoot, generatedAt: '2026-09-02T00:00:00Z', ...options });
}

test('Task and Evidence Packet schemas are valid and preserve canonical authority boundaries', () => {
  const schemas = getPacketSchemas();
  assert.equal(schemas.task.properties.schemaVersion.const, '1.0.0');
  assert.equal(schemas.evidence.properties.schemaVersion.const, '1.0.0');
  assert.deepEqual(AUTHORITY_MODEL, { repository: 'git', mind: 'mind', taskState: 'task_packet', evidence: 'evidence_packet', context: 'context_pack_or_broker', executionReceipt: 'existing_execution_and_gate_systems', conversation: 'non_canonical' });
});

test('representative domain fixtures generate valid bounded task/evidence packets', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  for (const fixture of fixtures.cases) {
    const result = planned(fixture.prompt, { catalog });
    const expected = fixture.expected;
    assert.equal(result.route.primaryRouteFamily, expected.family, fixture.id);
    assert.equal(result.adapterTrace.primary.adapterId, expected.adapter, fixture.id);
    assert.equal(result.adapterTrace.primary.mode, expected.mode, fixture.id);
    if (expected.safetyAdapter) assert.ok(result.adapterTrace.selected.some((item) => item.adapterId === expected.safetyAdapter), fixture.id);
    if (expected.risk) assert.equal(result.taskPacket.permissions.riskClass, expected.risk, fixture.id);
    assert.equal(result.route.qualification.required, expected.question, fixture.id);
    assert.deepEqual(result.route.selectedSpecialistDescriptorIds, expected.specialists ?? [], fixture.id);
    assert.deepEqual(result.route.predictedQualitySafetyGates.map((gate) => gate.ref), expected.gates, fixture.id);
    assert.equal(result.validation.valid, true, `${fixture.id}: ${JSON.stringify(result.validation)}`);
    assert.deepEqual(validateJsonSchema(getPacketSchemas().task, result.taskPacket), [], fixture.id);
    for (const evidence of result.evidencePackets) assert.deepEqual(validateJsonSchema(getPacketSchemas().evidence, evidence), [], `${fixture.id}:${evidence.subtaskId}`);
  }
});

test('selected source inspection is bounded and does not preload unrelated skill bodies', () => {
  const bible = planned('Study Romans 8.');
  assert.ok(bible.selectedInstructionInspection.fullInstructionReads.some((id) => id === 'skill.bible-research'));
  assert.ok(bible.selectedInstructionInspection.fullInstructionReads.every((id) => !['skill.design', 'skill.video', 'skill.code', 'skill.outdoor'].includes(id)));
  assert.equal(bible.atomicity.unrelatedFullBodyReads, 0);
  assert.equal(bible.atomicity.listFullSkillBodiesLoaded, 0);

  const code = planned('Fix the login bug in this repo.');
  assert.ok(code.selectedInstructionInspection.fullInstructionReads.includes('skill.code'));
  assert.ok(code.selectedInstructionInspection.fullInstructionReads.every((id) => !['skill.bible-research', 'skill.outdoor', 'skill.research'].includes(id)));
  assert.equal(code.selectedInstructionInspection.instructionsEmbeddedInPackets, false);

  const design = planned('Redesign this dashboard.');
  assert.ok(design.selectedInstructionInspection.fullInstructionReads.includes('skill.design'));
  assert.equal(design.atomicity.unrelatedFullBodyReads, 0);
});

test('packet validators fail closed for missing revisions, references, ownership, bounds, gates, and stale state', () => {
  const result = planned('Build a feature in this repo.');
  const broken = structuredClone(result.taskPacket);
  broken.sourceRevision = 'unknown';
  broken.selectedCapabilityRefs[0].capabilityId = 'skill.not-real';
  broken.plan.nodes[0].ownerCapabilityRef = { ...broken.plan.nodes[0].ownerCapabilityRef, capabilityId: 'skill.not-real' };
  broken.contextRequests[0].maxBudget = 4001;
  broken.contextRequests[0].query = '';
  broken.contextRequests[0].exactRefs = [];
  broken.contextRequests[0].resolutionStatus = 'RESOLVED';
  broken.contextRequests[0].contextPackRef = null;
  broken.requiredQualityGates[0].gateRef = 'gate.not-real';
  broken.state.status = 'READY';
  broken.continuityRef.sourceRevision = 'old-revision';
  const errors = validateTaskPacket(broken, { catalog: createCapabilityCatalog({ repoRoot }) });
  for (const expected of ['missing source revision', 'unknown capability ref', 'unknown node owner', 'unbounded context request', 'context request exceeds bounded policy', 'unresolved context ref', 'unresolved gate ref', 'ready packet has', 'continuity points']) assert.ok(errors.some((error) => error.includes(expected)), expected);
});

test('evidence validator rejects unproven success, undeclared producers, invalid refs, conflicts, and mutations', () => {
  const result = planned('Research this company.');
  const source = result.evidencePackets[0];
  const broken = structuredClone(source);
  broken.status = 'VALIDATED';
  broken.validationRefs = [];
  broken.gateResults.push({ gateRef: 'gate.source-provenance', status: 'PASS', blocking: true, evidenceRefs: [], reason: 'bad' });
  broken.producerCapability.capabilityId = 'skill.not-real';
  broken.outputRefs[0].value = 'unresolved-output';
  broken.conflicts.push({ summary: 'two source revisions disagree', sourceRefs: [broken.inputRefs[0], broken.outputRefs[0]], resolutionState: 'OPEN' });
  broken.sideEffectsObserved.observed = ['repository_write'];
  const errors = validateEvidencePacket(broken, { catalog: createCapabilityCatalog({ repoRoot }), taskId: result.taskPacket.taskId, subtaskId: source.subtaskId });
  for (const expected of ['producer undeclared', 'invalid output/evidence ref', 'unproven success', 'conflicting source revisions', 'mutation evidence without side-effect declaration', 'side effects lack evidence']) assert.ok(errors.some((error) => error.includes(expected)), expected);
});

test('continuity distinguishes current, stale, conflicted, and unavailable without automatic resume', () => {
  const base = { packetSourceRevision: 'rev-a', repositoryRevision: 'rev-a' };
  const cases = [
    ['CURRENT', {}],
    ['STALE', { repositoryRevision: 'rev-b' }],
    ['STALE', { worktreeClean: false }],
    ['UNAVAILABLE', { sourceAvailable: false }],
    ['STALE', { mindEvidenceFresh: false }],
    ['CONFLICTED', { contextConflict: true }],
    ['STALE', { capabilityMoved: true }],
    ['UNAVAILABLE', { profileResolution: false }]
  ];
  for (const [state, override] of cases) {
    const result = assessContinuity({ ...base, ...override });
    assert.equal(result.state, state, JSON.stringify(override));
    assert.equal(result.automaticResumeAllowed, false);
    if (state !== 'CURRENT') assert.equal(result.resumeDecision, 'BLOCKED');
  }
});

test('shadow end-to-end result is execution-free and packet references are not duplicated truth', () => {
  const result = planned('Build a polished SaaS dashboard, then review and test it.');
  assert.equal(result.operation, 'shadow_packet_plan');
  assert.equal(result.executionExposed, false);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.externalMutations, 0);
  assert.equal(result.taskPacket.execution.mindWrites, 0);
  assert.equal(result.taskPacket.execution.automaticResumeAllowed, false);
  assert.equal(result.taskPacket.plan.nodes.some((node) => JSON.stringify(node).includes('instructions')), true);
  assert.equal(Object.hasOwn(result.taskPacket.plan.nodes[0], 'instructions'), false);
  assert.equal(result.budget.selectedContextPackTokens, 0);
  assert.ok(result.predictedGatePackets.every((gate) => gate.predictedStatus === 'NOT_RUN'));
  assert.equal(result.validation.valid, true);
});
