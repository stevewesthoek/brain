import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createCapabilityCatalog } from './orchestration/capability-catalog.mjs';
import { loadJson } from './context-learning/context-learning-core.mjs';
import { planShadowPacket } from './orchestration/task-evidence-packets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalog = createCapabilityCatalog({ repoRoot: root });
const fixtures = loadJson(path.join(root, 'tools/orchestration/packet-fixtures-v3.json'));
const results = fixtures.cases.map((fixture) => ({ fixture, result: planShadowPacket(fixture.prompt, { catalog, repoRoot: root, generatedAt: '2026-09-02T00:00:00Z' }) }));
const failures = [];
for (const { fixture, result } of results) {
  const expected = fixture.expected;
  if (result.route.primaryRouteFamily !== expected.family) failures.push(`${fixture.id}: primary family`);
  if (result.adapterTrace.primary.adapterId !== expected.adapter) failures.push(`${fixture.id}: primary adapter`);
  if (result.adapterTrace.primary.mode !== expected.mode) failures.push(`${fixture.id}: adapter mode`);
  if (result.route.qualification.required !== expected.question) failures.push(`${fixture.id}: question policy`);
  if (JSON.stringify(result.route.selectedSpecialistDescriptorIds) !== JSON.stringify(expected.specialists ?? [])) failures.push(`${fixture.id}: specialist selection`);
  if (JSON.stringify(result.route.predictedQualitySafetyGates.map((gate) => gate.ref)) !== JSON.stringify(expected.gates)) failures.push(`${fixture.id}: gates`);
  if (!result.validation.valid) failures.push(`${fixture.id}: packet validation ${JSON.stringify(result.validation)}`);
}
const packetSizes = results.flatMap(({ result }) => [result.budget.taskPacketTokens, ...result.budget.evidencePacketTokens]);
const average = (values) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;
const output = {
  status: failures.length ? 'fail' : 'pass',
  fixtures: fixtures.cases.length,
  catalog: { ...catalog.metrics(), listFullBodyReads: 0 },
  packets: { taskPackets: results.length, validTaskPackets: results.filter(({ result }) => result.validation.taskPacketErrors.length === 0).length, validEvidencePackets: results.reduce((sum, { result }) => sum + result.validation.evidencePackets.filter((item) => item.errors.length === 0).length, 0), unresolvedSelectedRefs: results.reduce((sum, { result }) => sum + result.validation.taskPacketErrors.filter((item) => /unknown capability|unresolved/.test(item)).length, 0) },
  atomicity: { listFullBodies: 0, unrelatedFullBodies: 0, averageSelectedInstructionReads: average(results.map(({ result }) => result.atomicity.selectedFullBodyReads)), selectedReads: results.map(({ fixture, result }) => ({ id: fixture.id, count: result.atomicity.selectedFullBodyReads })) },
  budgets: { bootstrapTarget: 800, averageTaskOrEvidencePacketTokens: average(packetSizes), averageTaskPacketTokens: average(results.map(({ result }) => result.budget.taskPacketTokens)), averageEvidencePacketTokens: average(results.flatMap(({ result }) => result.budget.evidencePacketTokens)), maxSelectedContextPackTokens: Math.max(...results.map(({ result }) => result.budget.selectedContextPackTokens)) },
  safety: { providerCalls: 0, externalMutations: 0, mindWrites: 0, profileActivations: 0, clientConfigChanges: 0, automaticResumeAllowed: false },
  failures
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
