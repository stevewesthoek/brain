import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createCapabilityCatalog } from './capability-catalog.mjs';
import { routeShadowRequest } from './shadow-intent-router.mjs';
import { loadJson } from '../context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const corpus = loadJson(path.join(repoRoot, 'tools/orchestration/black-box-route-corpus-v2.json'));

function routeCase(catalog, item) {
  return routeShadowRequest(item.prompt, { catalog, generatedAt: '2026-09-01T00:00:00Z' });
}

test('fixed black-box corpus routes ordinary goals deterministically', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const failures = [];
  for (const item of corpus.cases) {
    const route = routeCase(catalog, item);
    const actualSpecialists = route.selectedSpecialistDescriptorIds;
    const actualGates = route.predictedQualitySafetyGates.map((gate) => gate.ref);
    if (route.primaryRouteFamily !== item.expected.primaryRouteFamily) failures.push(`${item.id}: family ${route.primaryRouteFamily} != ${item.expected.primaryRouteFamily}`);
    if (JSON.stringify(actualSpecialists) !== JSON.stringify(item.expected.specialists)) failures.push(`${item.id}: specialists ${JSON.stringify(actualSpecialists)} != ${JSON.stringify(item.expected.specialists)}`);
    if (JSON.stringify(actualGates) !== JSON.stringify(item.expected.gates)) failures.push(`${item.id}: gates ${JSON.stringify(actualGates)} != ${JSON.stringify(item.expected.gates)}`);
    if (route.qualification.required !== item.expected.question) failures.push(`${item.id}: question ${route.qualification.required} != ${item.expected.question}`);
    if (route.riskClass !== item.expected.riskClass) failures.push(`${item.id}: risk ${route.riskClass} != ${item.expected.riskClass}`);
    if (route.confirmationClass !== item.expected.confirmationClass) failures.push(`${item.id}: confirmation ${route.confirmationClass} != ${item.expected.confirmationClass}`);
  }
  assert.deepEqual(failures, []);
});

test('shadow output is explainable, descriptor-first, and execution-free', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const route = routeShadowRequest('Build a premium SaaS landing page, then review and test it.', { catalog });
  assert.equal(route.operation, 'shadow_route');
  assert.equal(route.executionExposed, false);
  assert.equal(route.providerCalls, 0);
  assert.equal(route.externalMutations, 0);
  assert.equal(route.unsafeExecutionReady, false);
  assert.equal(route.contextForecast.selectedInspectCount, 0);
  assert.equal(route.contextForecast.fullSkillBodiesLoadedDuringList, 0);
  assert.ok(route.contextForecast.budget.max >= route.contextForecast.budget.descriptor);
  assert.ok(route.explanation.primary.length > 0);
  assert.ok(route.explanation.context.includes('Descriptor'));
  assert.ok(route.proposedCompositionGraph.length <= 8);
  assert.ok(route.proposedCompositionGraph.some((node) => node.role === 'primary'));
  assert.ok(route.proposedCompositionGraph.some((node) => node.id === 'skill.code'));
});

test('qualification asks at most one bundled material question and never asks internal choices', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const route = routeShadowRequest('Research this.', { catalog });
  assert.equal(route.qualification.required, true);
  assert.equal(route.qualification.count, 1);
  assert.ok(route.qualification.question.length < 220);
  assert.doesNotMatch(route.qualification.question.toLowerCase(), /skill|orchestrator|provider|model|profile/);
  const safeDesign = routeShadowRequest('Make this page look amazing.', { catalog });
  assert.equal(safeDesign.qualification.required, false);
});

test('high-risk requests always predict confirmation and remain unsafe to execute', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  for (const prompt of ['Deploy this to production.', 'Fix the production database migration.', 'Open this website and submit the contact form.']) {
    const route = routeShadowRequest(prompt, { catalog });
    assert.ok(['high', 'critical'].includes(route.riskClass), prompt);
    assert.equal(route.confirmationClass, 'user', prompt);
    assert.equal(route.unsafeExecutionReady, false, prompt);
    assert.equal(route.status, 'needs_confirmation_before_any_execution', prompt);
    assert.ok(route.predictedQualitySafetyGates.some((gate) => gate.ref === 'gate.confirmation'), prompt);
  }
});

test('no fixed corpus case uses an unnecessary clarification question', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const unnecessary = corpus.cases.filter((item) => !item.expected.question).filter((item) => routeCase(catalog, item).qualification.required);
  assert.deepEqual(unnecessary, []);
});

test('router does not call a provider or inspect a skill body', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const before = catalog.metrics();
  const route = routeShadowRequest('Research the current market and cite sources.', { catalog });
  const after = catalog.metrics();
  assert.equal(route.providerCalls, 0);
  assert.equal(after.fullBodyReads, before.fullBodyReads);
  assert.equal(route.contextForecast.selectedInspectCount, 0);
});
