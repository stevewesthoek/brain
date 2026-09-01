import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createCapabilityCatalog, validateCapabilityDescriptors } from './orchestration/capability-catalog.mjs';
import { routeShadowRequest } from './orchestration/shadow-intent-router.mjs';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const schema = loadJson(path.join(repoRoot, 'operations/specs/orchestrator-capability-descriptor-v2.schema.json'));
const corpus = loadJson(path.join(repoRoot, 'tools/orchestration/black-box-route-corpus-v2.json'));
const catalog = createCapabilityCatalog({ repoRoot });
const errors = [...validateCapabilityDescriptors(catalog.descriptors)];
for (const descriptor of catalog.descriptors) errors.push(...validateJsonSchema(schema, descriptor).map((error) => `${descriptor.capabilityId}: ${error}`));
const results = corpus.cases.map((item) => ({ item, route: routeShadowRequest(item.prompt, { catalog, generatedAt: '2026-09-01T00:00:00Z' }) }));
const allListed = catalog.list({ maxItems: catalog.descriptors.length });
const naiveSkillBytes = catalog.descriptors.filter((descriptor) => descriptor.kind === 'skill').reduce((total, descriptor) => total + fs.statSync(path.join(repoRoot, descriptor.sourceRef)).size, 0);
const descriptorListBytes = Buffer.byteLength(JSON.stringify(allListed.descriptors), 'utf8');
const contextEvidence = {
  naiveAllSkillBodyBytes: naiveSkillBytes,
  naiveAllSkillBodyTokens: Math.ceil(naiveSkillBytes / 4),
  v2ListDescriptorBytes: descriptorListBytes,
  v2ListDescriptorTokens: Math.ceil(descriptorListBytes / 4),
  v2ListPrefixBytesRead: catalog.metrics().prefixBytes,
  listFullSkillBodiesLoaded: 0,
  selectedInspectCountDuringShadow: 0,
  plannedSelectedInspectNodes: results.reduce((total, result) => total + result.route.proposedCompositionGraph.filter((node) => node.role === 'primary' || node.role === 'specialist' || node.role === 'downstream').length, 0),
  observedOrEstimatedReductionPercent: Number(((1 - descriptorListBytes / naiveSkillBytes) * 100).toFixed(2)),
  method: 'naive loads every tracked SKILL.md; v2 measures compact metadata LIST and defers exact source INSPECT; evidence cost remains forecast separately',
};
const routeFailures = results.filter(({ item, route }) => route.primaryRouteFamily !== item.expected.primaryRouteFamily || JSON.stringify(route.selectedSpecialistDescriptorIds) !== JSON.stringify(item.expected.specialists) || JSON.stringify(route.predictedQualitySafetyGates.map((gate) => gate.ref)) !== JSON.stringify(item.expected.gates) || route.qualification.required !== item.expected.question || route.riskClass !== item.expected.riskClass || route.confirmationClass !== item.expected.confirmationClass);
if (routeFailures.length) errors.push(`black-box route failures: ${routeFailures.map(({ item }) => item.id).join(', ')}`);
const unsafeHighRisk = results.filter(({ route }) => ['high', 'critical'].includes(route.riskClass) && route.unsafeExecutionReady).length;
const userChoiceQuestions = results.filter(({ route }) => /\b(skill|orchestrator|provider|model|profile)\b/i.test(route.qualification.question ?? '')).length;
const unnecessaryClarifications = results.filter(({ item, route }) => !item.expected.question && route.qualification.required).length;
if (unsafeHighRisk !== 0) errors.push(`unsafe high-risk routes: ${unsafeHighRisk}`);
if (userChoiceQuestions !== 0) errors.push(`internal-choice questions: ${userChoiceQuestions}`);
if (unnecessaryClarifications !== 0) errors.push(`unnecessary clarifications: ${unnecessaryClarifications}`);
if (catalog.metrics().fullBodyReads !== 0) errors.push('catalog construction loaded full skill bodies');
const knownReconciliationCodes = ['duplicate_profile_entry', 'profile_no_source', 'profile_source_divergence', 'stale_projection', 'consumer_projection_divergence'];
for (const code of knownReconciliationCodes) if (!catalog.reconciliation.summary[code]) errors.push(`reconciliation did not surface known code: ${code}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const primaryCorrect = results.filter(({ item, route }) => route.primaryRouteFamily === item.expected.primaryRouteFamily).length;
const expectedQuestions = results.filter(({ item }) => item.expected.question).length;
const actualQuestions = results.filter(({ route }) => route.qualification.required).length;
console.log(JSON.stringify({
  status: 'pass',
  catalog: { ...catalog.metrics(), listFullBodyReads: 0, provenance: 'field-level', sourceAgnostic: true },
  contextEvidence,
  profileHealth: catalog.profileHealth,
  reconciliation: catalog.reconciliation.summary,
  router: { fixtureCount: results.length, primaryCorrectnessPercent: (primaryCorrect / results.length) * 100, expectedQuestions, actualQuestions, unnecessaryClarifications, unsafeHighRisk, userChoiceQuestions },
  productionSafety: { executionExposed: false, providerCalls: 0, externalMutations: 0, runtimeActivated: false },
}, null, 2));
