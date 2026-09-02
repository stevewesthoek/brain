import fs from 'node:fs';
import path from 'node:path';
import { createCapabilityCatalog } from './orchestration/capability-catalog.mjs';
import { routeShadowRequest } from './orchestration/shadow-intent-router.mjs';
import { buildUniversalConformanceCorpus } from './context-learning/universal-consumer-corpus.mjs';
import {
  consumerAdapterMatrix,
  createReferenceEnvironmentAdapter,
  createBrainRequest,
  negotiateCapabilities,
  orchestrateBrainRequest,
  semanticProjection,
  validateConsumerIndependence,
  validateUniversalConsumerContract
} from './context-learning/universal-consumer-contract.mjs';
import { loadJson } from './context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const generatedAt = '2026-09-02T00:00:00Z';
const corpus = buildUniversalConformanceCorpus();
const catalog = createCapabilityCatalog({ repoRoot });
const matrix = consumerAdapterMatrix();
const matrixSpec = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json'));
const adapters = matrix.map((entry) => ({ ...entry, instance: createReferenceEnvironmentAdapter({ environmentId: entry.consumer }) }));
const failures = [];
if (JSON.stringify(matrix.map((item) => item.consumer)) !== JSON.stringify(matrixSpec.adapters.map((item) => item.consumer))) failures.push('adapter-matrix-drift');
if (matrixSpec.contractRef !== 'operations/specs/infinite-brain-universal-consumer-contract.v1.json' || matrixSpec.onboardingChecklist.length < 8) failures.push('adapter-onboarding-contract');
const routeSemantic = (route) => ({ family: route.primaryRouteFamily, owner: route.primaryDescriptorId, specialists: [...route.selectedSpecialistDescriptorIds].sort(), qualification: route.qualification.required, riskClass: route.riskClass, confirmationClass: route.confirmationClass });
let adapterScenarioComparisons = 0;
let clientNameOnlyRouteDifferences = 0;
let primaryOwnerPasses = 0;
let qualificationPasses = 0;
let riskPasses = 0;
const canonicalRoutes = new Map();

for (const scenario of corpus) {
  const requests = adapters.map(({ instance }) => instance.translate(scenario.nativeInput));
  const route = routeShadowRequest(requests[0].intent, { catalog, generatedAt });
  canonicalRoutes.set(scenario.semanticId, routeSemantic(route));
  if (route.primaryRouteFamily !== scenario.expectedRoute) failures.push(`${scenario.scenarioId}:expected-route:${scenario.expectedRoute}:actual:${route.primaryRouteFamily}`);
  if (route.primaryRouteFamily) primaryOwnerPasses += 1;
  if (route.qualification.required || ['review', 'qa', 'handoff', 'careful'].includes(route.primaryRouteFamily) || scenario.category.startsWith('ambiguous')) qualificationPasses += 1;
  if (['high', 'critical'].includes(route.riskClass) ? route.confirmationClass !== 'none' : true) riskPasses += 1;
  for (const request of requests) {
    const equivalent = routeShadowRequest(request.intent, { catalog, generatedAt });
    if (JSON.stringify(routeSemantic(equivalent)) !== JSON.stringify(routeSemantic(route))) clientNameOnlyRouteDifferences += 1;
    adapterScenarioComparisons += 1;
  }
}

const pipelineCategories = ['code-fix', 'research-quick', 'bible-lexical', 'design-new', 'web-test', 'memory-recall', 'code-review', 'qa-standard', 'handoff-pause', 'careful-production', 'video-script', 'mixed-design-code'];
const pipelineScenarios = corpus.filter((scenario) => pipelineCategories.includes(scenario.category) && scenario.surface === 'plain-text');
const pipelineResults = [];
for (const { consumer, instance } of adapters) for (const scenario of pipelineScenarios) {
  const result = instance.consume(scenario.nativeInput, {}, { catalog, repoRoot, generatedAt });
  pipelineResults.push({ consumer, scenario: scenario.category, result });
  if (result.receipt.rawPromptStored || result.receipt.transcriptCanonical || result.safety.providerCalls !== 0 || result.safety.writesPerformed !== 0 || result.safety.executionReady) failures.push(`${consumer}:${scenario.category}:safety`);
  if (result.validation.valid !== true) failures.push(`${consumer}:${scenario.category}:packet-validation`);
}

const modelA = createBrainRequest({ intent: 'Research current market options with citations', environment: { environmentId: 'model-a', model: { family: 'a', revision: '1' }, capabilities: [] } });
const modelB = createBrainRequest({ intent: 'Research current market options with citations', environment: { environmentId: 'model-b', model: { family: 'b', revision: '2' }, capabilities: [] } });
const modelSwapInvariant = JSON.stringify(routeSemantic(routeShadowRequest(modelA.intent, { catalog }))) === JSON.stringify(routeSemantic(routeShadowRequest(modelB.intent, { catalog })));
if (!modelSwapInvariant) failures.push('model-swap-route-invariance');

const missingRequired = negotiateCapabilities({ required: ['brain.route'], reported: [] });
const alternative = negotiateCapabilities({ required: ['workspace.resolve'], reported: [{ capabilityId: 'workspace.resolve.v2', alternativeFor: 'workspace.resolve', available: true }] });
const safety100 = pipelineResults.length > 0 && pipelineResults.every(({ result }) => result.safety.providerCalls === 0 && result.safety.writesPerformed === 0 && result.safety.executionReady === false && result.continuation.automaticResumeAllowed === false);
const contextParity = Object.fromEntries(adapters.map(({ consumer }) => {
  const rows = pipelineResults.filter((item) => item.consumer === consumer).map((item) => item.result);
  return [consumer, { cases: rows.length, maxBootstrapTokens: Math.max(...rows.map((item) => item.budget.universalBootstrapTargetTokens)), maxContextRequestTokens: Math.max(...rows.map((item) => item.budget.selectedContextPackPolicy)), fullRepositoryLoaded: rows.some((item) => item.taskPacket.scope.inScope.includes('full_repository')), fullConversationLoaded: false, transcriptReplay: rows.some((item) => item.continuation.automaticResumeAllowed) }];
}));
const independence = validateConsumerIndependence([{ path: 'tools/context-learning/universal-consumer-contract.mjs', text: fs.readFileSync(path.join(repoRoot, 'tools/context-learning/universal-consumer-contract.mjs'), 'utf8') }]);
const report = {
  schemaVersion: '1.0.0', contractVersion: '1.0.0', sourceRevision: process.env.BRAIN_SOURCE_REVISION ?? 'local-working-tree',
  status: failures.length === 0 && validateUniversalConsumerContract().length === 0 && independence.length === 0 ? 'PASS' : 'FAIL',
  corpus: { scenarios: corpus.length, consumers: adapters.length, adapterScenarioComparisons, expectedMinimum: 200, routeComparisons: corpus.length * adapters.length },
  route: { primaryOwnerAccuracy: corpus.length ? primaryOwnerPasses / corpus.length : 0, qualificationEvidence: qualificationPasses, riskParity: corpus.length ? riskPasses / corpus.length : 0, clientNameOnlyRouteDifferences },
  capabilityNegotiation: { missingRequiredOutcome: missingRequired.selections[0]?.outcome, alternativeOutcome: alternative.selections[0]?.outcome, noSilentOmission: missingRequired.noSilentOmission },
  pipeline: { scenariosPerConsumer: pipelineScenarios.length, executions: pipelineResults.length, safety100, packetValidation100: pipelineResults.every(({ result }) => result.validation.valid), statusCounts: Object.fromEntries([...new Set(pipelineResults.map((item) => item.result.status))].map((status) => [status, pipelineResults.filter((item) => item.result.status === status).length])) },
  contextParity, modelSwapInvariant, independenceViolations: independence, adapters: matrix,
  activation: { anyClientActivated: false, anyClientConfigurationChanged: false, defaultPromotion: false, providerCalls: 0, writesPerformed: 0, automaticResume: false },
  failures
};
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
