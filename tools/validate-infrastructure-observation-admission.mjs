#!/usr/bin/env node

import path from 'node:path';

import { loadAndValidateReferenceCatalog } from './infrastructure-catalog/catalog-core.mjs';
import {
  buildOnboardingBacklog,
  candidateFromObservation,
  createObservationAdapter,
  planCandidateAdmission,
  runObservationAdapter,
  validateObservationContract,
} from './infrastructure-catalog/observation-core.mjs';
import {
  createCodexRuntimeObserver,
  safeBundleMetadata,
  safeDevStatusResult,
  safeDoctorResult,
  safeNativeLoginResult,
} from './infrastructure-catalog/codex-runtime-adapter.mjs';
import { parseListeningSockets, parseProcessList } from './infrastructure-catalog/local-runtime-observer.mjs';
import { validateInfrastructureGovernance } from './infrastructure-catalog/governance-core.mjs';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const observationSchema = loadJson(path.join(root, 'operations/specs/infrastructure-observation-v1.schema.json'));
const candidateSchema = loadJson(path.join(root, 'operations/specs/infrastructure-candidate-v1.schema.json'));
const synthetic = loadJson(path.join(root, 'operations/fixtures/infrastructure-runtime-observation-synthetic-v1.json'));
const now = new Date('2026-09-05T00:00:00.000Z');
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function schemaErrors(definition, value, label) {
  return validateJsonSchema(definition, value, candidateSchema, label);
}

function safeAdapterFor(observations, candidates) {
  return createObservationAdapter({
    observerId: 'synthetic-observer',
    adapterKind: 'synthetic-runtime',
    adapterVersion: '1.0.0',
    discover: async () => ({ observations, candidates }),
    observe: async (candidate) => candidates.find((entry) => entry.candidateId === candidate?.candidateId) ?? null,
    verifyRelationship: async ({ sourceId, targetId } = {}) => ({
      relationId: `relationship:${sourceId ?? 'unknown'}:${targetId ?? 'unknown'}`,
      sourceId: sourceId ?? null,
      targetId: targetId ?? null,
      state: 'unknown',
      provenance: { source: 'synthetic-observer', readOnly: true, authority: 'local-observation' },
    }),
  });
}

const observationBefore = JSON.stringify(synthetic.observations);
for (const observation of synthetic.observations) {
  const errors = validateObservationContract({
    observation,
    schema: observationSchema,
    label: observation.observationId,
  });
  assert(errors.length === 0, `${observation.observationId} observation errors: ${errors.join('; ')}`);
}

const candidates = synthetic.observations.map((observation) => candidateFromObservation(observation, {
  proposedResourceId: observation.resourceId,
  resourceKind: observation.runtimeIdentity.runtimeKind,
  provenanceOwner: 'synthetic-admission-test',
}));
const adapter = safeAdapterFor(synthetic.observations, candidates);
const adapterResult = await runObservationAdapter(adapter, { observationSchema, candidateSchema });
assert(adapterResult.adapter.capabilities.includes('discover'), 'adapter contract must expose discover');
assert(adapterResult.adapter.capabilities.includes('observe'), 'adapter contract must expose observe');
assert(adapterResult.adapter.capabilities.includes('verify_relationship'), 'adapter contract must expose verifyRelationship');
assert(JSON.stringify(synthetic.observations) === observationBefore, 'observation discovery must not mutate source evidence');

const plans = candidates.map((candidate) => planCandidateAdmission({ candidate, now }));
for (const plan of plans) {
  const errors = schemaErrors(candidateSchema.$defs.admissionPlan, plan, `$.${plan.candidateId}.admissionPlan`);
  assert(errors.length === 0, `${plan.candidateId} admission-plan errors: ${errors.join('; ')}`);
}

const planByCandidate = new Map(plans.map((plan) => [plan.candidateId, plan]));
assert(planByCandidate.get('candidate:synthetic-alpha-consumer')?.decision === 'admit', 'application-managed clean consumer must be admissible');
assert(planByCandidate.get('candidate:synthetic-beta-consumer')?.decision === 'admit', 'Brain-managed clean consumer must be admissible');
assert(planByCandidate.get('candidate:synthetic-gamma-consumer')?.decision === 'remain_candidate', 'unknown ownership must remain a candidate');
assert(planByCandidate.get('candidate:synthetic-delta-consumer')?.decision === 'reject', 'conflicting ownership must be rejected');
assert(candidates.find((candidate) => candidate.candidateId === 'candidate:synthetic-alpha-consumer')?.evidence.credentialCustody === 'confirmed', 'application custody must bind to candidate evidence');
assert(synthetic.observations.find((observation) => observation.resourceId === 'service:beta-consumer')?.identityBindingEvidence.custody === 'orchestrator', 'Brain-managed custody must bind to orchestrator evidence');
assert(synthetic.observations.find((observation) => observation.resourceId === 'service:beta-consumer')?.dependencyEvidence.dependencies[0].resourceRef === 'database:beta-store', 'required dependency must remain explicit');
assert(synthetic.observations.filter((observation) => observation.isolationEvidence.state === 'confirmed').length >= 2, 'isolation boundaries must be represented');

const rawFieldErrors = validateObservationContract({
  observation: { ...synthetic.observations[0], token: 'REDACTED_TEST_SENTINEL' },
  schema: observationSchema,
  label: 'synthetic-raw-field-negative-test',
});
assert(rawFieldErrors.some((error) => error.includes('forbidden raw-access field')), 'raw access fields must be rejected');

const processFixture = parseProcessList(' 101 1 /usr/local/bin/alpha-client S\n 202 1 beta-runner R\n');
const listenerFixture = parseListeningSockets('p101\ncalpha-client\nPTCP\nn127.0.0.1:18001\n');
assert(processFixture.length === 2 && processFixture[0].commandIdentity === 'alpha-client', 'local process observer must parse allowlisted process identity');
assert(listenerFixture.length === 1 && listenerFixture[0].port === 18001 && listenerFixture[0].hostClass === 'loopback', 'local runtime observer must parse loopback listeners');

const fakeDoctor = safeDoctorResult({
  ok: true,
  status: 0,
  stdout: JSON.stringify({
    ok: true,
    mode: 'full',
    checks: [
      { id: 'config', status: 'ok' }, { id: 'browser-host', status: 'ok' }, { id: 'codex', status: 'ok' },
      { id: 'service', status: 'ok' }, { id: 'proxy', status: 'ok' }, { id: 'tunnel-binary', status: 'ok' },
      { id: 'tunnel-key', status: 'ok' }, { id: 'tunnel-service', status: 'ok' }, { id: 'tunnel-runtime', status: 'ok' },
      { id: 'connector', status: 'warning' },
    ],
  }),
});
const fakeDev = safeDevStatusResult({
  ok: true,
  status: 0,
  stdout: JSON.stringify({
    config: { configured: true, mode: 'full', purpose: 'dev-harness' },
    launcher: { running: false, profile: 'development' },
    mcpRuntime: { required: true, ready: false },
    features: { biggerContext: false },
  }),
});
const fakeNativeLogin = safeNativeLoginResult({ ok: true, status: 0, stdout: 'Authenticated\n', stderr: '' });
const fakeBundle = safeBundleMetadata({ ok: true, stdout: '5.0.2\ncom.openai.codexwebgpt\n' });
const codexAdapter = createCodexRuntimeObserver();
const codexResult = await runObservationAdapter(codexAdapter, {
  now,
  doctor: fakeDoctor,
  dev: fakeDev,
  nativeLogin: fakeNativeLogin,
  bundle: fakeBundle,
  nativeBundle: { state: 'confirmed', bundleId: 'com.openai.codex', version: '26.901.31953' },
  localRuntime: {
    processes: [
      { pid: 26157, parentPid: 1, commandIdentity: 'codex-web-gpt', state: 'S' },
      { pid: 26186, parentPid: 1, commandIdentity: 'tunnel-client', state: 'S' },
      { pid: 26194, parentPid: 26157, commandIdentity: 'bun', state: 'S' },
      { pid: 63129, parentPid: 1, commandIdentity: 'codex', state: 'S' },
    ],
    listeners: [{ ownerProcessId: 26194, commandIdentity: 'bun', protocol: 'tcp', hostClass: 'loopback', port: 17841, reachability: 'listening' }],
  },
  observationSchema,
  candidateSchema,
});
assert(codexResult.observations.length === 5, 'Codex adapter must produce production, bridge, tunnel, native, and development observations');
assert(codexResult.observations.find((observation) => observation.resourceId === 'service:codex-web-gpt-production-runtime')?.status === 'degraded', 'connector attachment uncertainty must remain degraded');
assert(codexResult.observations.find((observation) => observation.resourceId === 'service:codex-web-gpt-development-runtime')?.status === 'unknown', 'non-running DEV must remain unknown');
assert(codexResult.observations.every((observation) => observation.redaction.secretsExcluded === true), 'Codex observations must exclude secrets');
assert(codexResult.containsSecrets === false && codexResult.executionPerformed === false, 'Codex observation must be read-only');
assert((await codexAdapter.observe(codexResult.candidates[0]))?.candidateId === codexResult.candidates[0].candidateId, 'adapter observe() must return the latest candidate');

const canonical = loadAndValidateReferenceCatalog(root, now);
const governance = validateInfrastructureGovernance({ bundle: canonical.bundle, now });
assert(governance.errors.length === 0, `canonical governance errors: ${governance.errors.join('; ')}`);
const backlog = buildOnboardingBacklog({ catalog: canonical.bundle, governanceReport: governance, now });
const backlogErrors = schemaErrors(candidateSchema.$defs.backlog, backlog, '$.backlog');
assert(backlogErrors.length === 0, `canonical onboarding backlog errors: ${backlogErrors.join('; ')}`);
assert(backlog.items.length === canonical.bundle.resources.length, 'backlog must account for every canonical resource');
assert(backlog.counts.governanceUnknown === 46, 'current canonical catalog must expose all 46 governance-unknown resources');
assert(backlog.items.every((item) => item.status === 'governance_unknown'), 'ungoverned canonical resources must remain backlog items');
assert(backlog.items.every((item) => item.reasons.includes('owner_unknown') && item.reasons.includes('environment_unknown')), 'backlog items must name ownership and environment gaps');

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'OK',
  genericContract: {
    adapterContractVersion: '1.0.0',
    syntheticObservations: synthetic.observations.length,
    syntheticCandidates: candidates.length,
    decisions: Object.fromEntries(plans.map((plan) => [plan.candidateId, plan.decision])),
    custodyProof: { application: 'confirmed', brain: 'confirmed' },
    dependencyProof: 'database:beta-store',
    isolationProof: ['boundary:synthetic-alpha', 'boundary:synthetic-beta'],
  },
  localRuntimeParser: { processRecords: processFixture.length, listenerRecords: listenerFixture.length },
  codexAdapter: {
    observations: codexResult.observations.length,
    production: codexResult.summary.production.status,
    development: codexResult.summary.development.status,
    accountIdentity: 'unknown_by_design',
    connectorAttachment: 'unknown_by_local_evidence',
  },
  canonicalBacklog: { resources: canonical.bundle.resources.length, items: backlog.items.length, governanceUnknown: backlog.counts.governanceUnknown },
  executionEnabled: false,
  executionPerformed: false,
  containsSecrets: false,
}, null, 2));
