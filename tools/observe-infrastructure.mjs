#!/usr/bin/env node

import path from 'node:path';

import { loadAndValidateReferenceCatalog } from './infrastructure-catalog/catalog-core.mjs';
import {
  buildOnboardingBacklog,
  planCandidateAdmission,
  runObservationAdapter,
} from './infrastructure-catalog/observation-core.mjs';
import { createCodexRuntimeObserver } from './infrastructure-catalog/codex-runtime-adapter.mjs';
import { discoverLocalRuntime } from './infrastructure-catalog/local-runtime-observer.mjs';
import { validateInfrastructureGovernance } from './infrastructure-catalog/governance-core.mjs';
import { loadJson } from './context-learning/context-learning-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const observationSchema = loadJson(path.join(root, 'operations/specs/infrastructure-observation-v1.schema.json'));
const candidateSchema = loadJson(path.join(root, 'operations/specs/infrastructure-candidate-v1.schema.json'));
const now = new Date();

function relevantProcess(commandIdentity) {
  return /codex|tunnel-client|bun/i.test(commandIdentity ?? '');
}

function safeObservation(observation) {
  return {
    observationId: observation.observationId,
    resourceId: observation.resourceId,
    providerId: observation.providerId,
    observationKind: observation.observationKind,
    status: observation.status,
    freshness: observation.freshness,
    conditionCodes: observation.conditionCodes,
    metricsSummary: observation.metricsSummary,
    environment: observation.environment,
    runtimeIdentity: observation.runtimeIdentity,
    processEvidence: observation.processEvidence,
    endpointEvidence: observation.endpointEvidence,
    ownershipEvidence: observation.ownershipEvidence,
    routeOwnershipEvidence: observation.routeOwnershipEvidence,
    dependencyEvidence: observation.dependencyEvidence,
    identityBindingEvidence: observation.identityBindingEvidence,
    healthCapability: observation.healthCapability,
    lifecycleCapability: observation.lifecycleCapability,
    isolationEvidence: observation.isolationEvidence,
    redaction: observation.redaction,
  };
}

function safeCandidate(candidate, plan) {
  return {
    candidateId: candidate.candidateId,
    proposedResourceId: candidate.proposedResourceId,
    resourceClass: candidate.resourceClass,
    resourceKind: candidate.resourceKind,
    admissionState: candidate.admissionState,
    identityStability: candidate.identityStability,
    freshness: candidate.freshness,
    observationIds: candidate.observationIds,
    evidence: candidate.evidence,
    binding: candidate.binding ?? null,
    admissionDecision: plan.decision,
    admissionReasons: plan.reasons,
  };
}

const localRuntime = discoverLocalRuntime({
  now,
  includeProcess: (entry) => relevantProcess(entry.commandIdentity),
  includeListener: (entry) => entry.hostClass === 'loopback' && relevantProcess(entry.commandIdentity),
});
const adapter = createCodexRuntimeObserver();
const live = await runObservationAdapter(adapter, {
  now,
  localRuntime,
  observationSchema,
  candidateSchema,
});
const plans = live.candidates.map((candidate) => planCandidateAdmission({ candidate, now }));
const catalog = loadAndValidateReferenceCatalog(root, now);
const governance = validateInfrastructureGovernance({ bundle: catalog.bundle, now });
const canonicalBacklog = buildOnboardingBacklog({ catalog: catalog.bundle, governanceReport: governance, now });
const healthGate = live.observations.every((observation) => observation.status === 'healthy') ? 'OK' : 'NOT_OK';

console.log(JSON.stringify({
  status: live.observations.some((observation) => observation.status === 'unhealthy') ? 'NOT_OK' : 'OBSERVED',
  healthGate,
  observedAt: live.observedAt,
  observer: live.adapter,
  sourceAvailability: live.sourceAvailability,
  localRuntime: {
    processCount: localRuntime.processes.length,
    listenerCount: localRuntime.listeners.length,
    processes: localRuntime.processes,
    listeners: localRuntime.listeners,
  },
  observations: live.observations.map(safeObservation),
  candidates: live.candidates.map((candidate, index) => safeCandidate(candidate, plans[index])),
  canonicalBacklog: {
    resourceCount: catalog.bundle.resources.length,
    itemCount: canonicalBacklog.items.length,
    counts: canonicalBacklog.counts,
    itemIds: canonicalBacklog.items.map((item) => item.itemId),
  },
  executionEnabled: false,
  executionPerformed: false,
  actualEffects: [],
  containsSecrets: false,
}, null, 2));
