import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance } from './universal-entry-conformance.mjs';
import { createContextBroker, estimateTokens } from './context-broker.mjs';
import { assessContinuity } from '../orchestration/task-evidence-packets.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { composeShadowRequest } from '../orchestration/composition-graph.mjs';

export const CODEX_PILOT_MODE = 'CODEX_READ_ONLY_PILOT_MODE';
export const ACTIVATION_STATES = Object.freeze([
  'CONFORMANT', 'PILOT-READY', 'PILOT-ACTIVE', 'PRODUCTION-ACTIVE', 'DEGRADED', 'BLOCKED'
]);
const PILOT_VERSION = '1.0.0';
const DEFAULT_BRAIN_POINTERS = Object.freeze([
  'AGENTS.md',
  '00-start-here.md',
  '00-current-context.md',
  '00-memory-map.md',
  'operations/specs/infinite-brain-orchestrator-v2.md',
  'tools/context-learning/universal-brain-entry.mjs',
  'tools/context-learning/context-broker.mjs',
  'tools/orchestration/capability-catalog.mjs',
  'tools/orchestration/task-evidence-packets.mjs',
  'tools/orchestration/composition-graph.mjs',
  'operations/specs/context-learning/session-continuity.v1.schema.json'
]);
const CODEX_SOURCE_REFS = Object.freeze({
  entrypoint: 'operations/system-configs/codex/AGENTS.md',
  config: 'operations/system-configs/codex/config.toml',
  projection: 'operations/system-configs/codex/skills/user',
  universalEntry: 'tools/context-learning/universal-brain-entry.mjs',
  entryConsumer: 'tools/context-learning/universal-entry-consumer.mjs',
  broker: 'tools/context-learning/context-broker.mjs',
  continuity: 'operations/specs/context-learning/session-continuity.v1.schema.json',
  taskPacket: 'operations/specs/infinite-brain-task-packet.v1.schema.json',
  evidencePacket: 'operations/specs/infinite-brain-evidence-packet.v1.schema.json',
  graph: 'operations/specs/infinite-brain-composition-graph.v1.schema.json'
});
const SENSITIVE = /(?:^|[\s/])(?:\.env(?:\.|$)|auth\.json|private[_-]?key|secret|token|cookie|session(?:s)?|transcript|client[_-]?config)/i;
const REDACT_KEYS = new Set(['rawIntent', 'prompt', 'query', 'instructions', 'transcript', 'clientConfiguration', 'client_config', 'secretValue', 'tokenValue']);

function hash(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function bounded(values, max = 12) {
  return Array.isArray(values) ? values.slice(0, max) : [];
}

function safePath(repoRoot, relativePath) {
  const resolved = path.resolve(repoRoot, relativePath);
  const relative = path.relative(path.resolve(repoRoot), resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? resolved : null;
}

function revision(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function redactedString(value) {
  const text = String(value ?? '');
  return SENSITIVE.test(text) ? '[redacted-sensitive-reference]' : text;
}

export function redactPilotValue(value) {
  if (typeof value === 'string') return redactedString(value);
  if (Array.isArray(value)) return value.map(redactPilotValue);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (REDACT_KEYS.has(key)) output[key] = '[redacted-sensitive-field]';
    else output[key] = redactPilotValue(item);
  }
  return output;
}

function projectionState(repoRoot, relativePath, expectedRelativeTarget = null) {
  const fullPath = safePath(repoRoot, relativePath);
  if (!fullPath || !fs.existsSync(fullPath)) return { path: relativePath, exists: false, status: 'UNAVAILABLE', target: null, entryCount: 0 };
  const stat = fs.lstatSync(fullPath);
  let target = null;
  let targetKind = 'directory';
  if (stat.isSymbolicLink()) {
    target = fs.readlinkSync(fullPath);
    targetKind = target.startsWith('/') ? 'absolute' : 'relative';
  }
  const names = fs.readdirSync(fullPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name).sort();
  const targetMatches = expectedRelativeTarget ? target === expectedRelativeTarget : null;
  return {
    path: relativePath,
    exists: true,
    status: targetMatches === false ? 'DEGRADED' : 'CONFORMANT',
    target: target ? redactedString(target) : null,
    targetKind,
    expectedTarget: expectedRelativeTarget,
    entryCount: names.length,
    entryNames: bounded(names, 20)
  };
}

export function inspectCodexConsumer({ repoRoot = process.cwd() } = {}) {
  const projection = projectionState(repoRoot, CODEX_SOURCE_REFS.projection, '../../../../ai/skills/active');
  const sourcePaths = Object.fromEntries(Object.entries(CODEX_SOURCE_REFS).map(([key, value]) => [key, { path: value, exists: Boolean(safePath(repoRoot, value) && fs.existsSync(safePath(repoRoot, value))) }]));
  const requiredSourceMissing = Object.entries(sourcePaths).filter(([key, item]) => ['entrypoint', 'config', 'projection', 'universalEntry', 'broker', 'continuity', 'taskPacket', 'evidencePacket', 'graph'].includes(key) && !item.exists).map(([key]) => key);
  return {
    consumer: 'codex',
    sourcePaths,
    projection,
    conformance: requiredSourceMissing.length === 0 && projection.status === 'CONFORMANT',
    requiredSourceMissing,
    runtimeActivated: false,
    clientConfigurationChanged: false
  };
}

function compactBootstrap({ entry, consumption, brokerBootstrap, descriptorIds, sourceRevision }) {
  const bootstrap = {
    schemaVersion: PILOT_VERSION,
    mode: CODEX_PILOT_MODE,
    brainRevision: sourceRevision,
    authorityRegistry: entry.identity.authority_registry,
    universalEntryRef: CODEX_SOURCE_REFS.universalEntry,
    contextBrokerRef: CODEX_SOURCE_REFS.broker,
    continuityRef: CODEX_SOURCE_REFS.continuity,
    descriptorCatalog: bounded(descriptorIds, 8),
    navigation: {
      brain: bounded(entry.navigation.brain_authority, 12),
      context: bounded(entry.navigation.context, 6),
      session: bounded(entry.navigation.session_continuity, 6)
    },
    freshness: bounded(consumption.bootstrap.operating_status.freshness, 8),
    conflicts: bounded(consumption.bootstrap.operating_status.conflicts, 8),
    brokerOperation: brokerBootstrap.operation,
    safety: { readOnly: true, providersCalled: 0, writesPerformed: 0, automaticResume: false, activation: false }
  };
  const usedTokens = estimateTokens(JSON.stringify(bootstrap));
  if (usedTokens > 800) throw new Error(`pilot_bootstrap_budget_exceeded:${usedTokens}`);
  return { ...bootstrap, budget: { maxTokens: 800, usedTokens } };
}

function localBroker({ catalog, sourceRevision, contextFreshness = 'fresh', brokerUnavailable = false }) {
  if (brokerUnavailable) return null;
  const capabilityProvider = {
    providerId: 'brain-capability-catalog',
    providerKind: 'capability_catalog',
    sourceRevision,
    health: 'healthy',
    freshness: contextFreshness === 'fresh' ? 'fresh' : 'stale',
    list: ({ query, maxItems }) => catalog.list({ query, maxItems }).descriptors.map((descriptor) => ({
      capabilityId: descriptor.capabilityId,
      capabilityKind: descriptor.kind === 'skill' ? 'skill' : 'validator',
      summary: descriptor.summary,
      sourceRevision: descriptor.sourceRevision,
      requiredContextScopes: descriptor.requiredContextScopes,
      riskClass: descriptor.riskClass,
      confirmationClass: descriptor.confirmationClass,
      instructionsRef: descriptor.sourceRef
    })),
    inspect: ({ capabilityId }) => {
      const result = catalog.inspect({ capabilityId, includeInstructions: false });
      if (!result.found) return null;
      return { capabilityId, capabilityKind: result.descriptor.kind === 'skill' ? 'skill' : 'validator', summary: result.descriptor.summary, sourceRevision: result.descriptor.sourceRevision, riskClass: result.descriptor.riskClass, confirmationClass: result.descriptor.confirmationClass, instructionsRef: result.source.sourceRef };
    }
  };
  const contextProvider = {
    providerId: 'brain-selected-policy',
    providerKind: 'brain_source',
    contextRole: 'human_authority',
    sourceRevision,
    health: 'healthy',
    freshness: contextFreshness,
    authoritative: true,
    summary: 'Exact Brain policy and selected source pointers; no full repository or conversation context.',
    resolve: () => ({ items: [{ itemId: 'brain-policy', summary: 'Use Brain authority, descriptor-first routing, bounded Context Broker retrieval, explicit gates, and no automatic execution.', citation: 'ai/policy/routing.md', freshness: contextFreshness, authority: 'canonical' }] })
  };
  return createContextBroker({ contextProviders: [contextProvider], capabilityProviders: [capabilityProvider], clock: () => new Date('2026-09-02T00:00:00.000Z') });
}

function failureResult({ fixtureId, prompt, priorPath, reason, consumer, sourceRevision, consumerInspection = null, details = [] }) {
  const result = {
    schemaVersion: PILOT_VERSION,
    mode: CODEX_PILOT_MODE,
    status: 'BLOCKED',
    activationState: 'BLOCKED',
    consumer,
    fixtureId,
    requestHash: hash(prompt),
    sourceRevision,
    fallback: { active: true, reason, priorPath, pilotPath: CODEX_PILOT_MODE, rollbackSwitch: 'enabled=false', destructiveMigration: false, priorPathAvailable: true },
    details: bounded(details, 8),
    consumerConformance: consumerInspection,
    safety: { executionAttempts: 0, providerCalls: 0, writes: 0, mindWrites: 0, profileActivations: 0, clientConfigurationChanges: 0, automaticResume: false, automaticTakeover: false, activationPerformed: false },
    metrics: { bootstrapTokens: 0, descriptorRoutingTokens: 0, selectedInstructionTokens: 0, descriptorListFullBodyReads: 0, selectedInstructionFullBodyReads: 0, contextPackTokens: 0, taskPacketTokens: 0, graphTokens: 0, evidencePacketTokens: 0, graphNodes: 0, maxSimultaneousActiveContext: 0, totalReferencedContext: 0, fullRepositoryLoaded: false, fullConversationLoaded: false, secretsLoaded: false }
  };
  result.receipt = receipt({ result, prompt, fixtureId, sourceRevision, consumerInspection, failure: reason });
  return result;
}

function receipt({ result, prompt, fixtureId, sourceRevision, route, qualification, brokerPack, packet, graph, continuity, consumerInspection, bootstrap, failure = null }) {
  const receipt = {
    schemaVersion: PILOT_VERSION,
    receiptId: `codex-pilot-${hash(`${fixtureId}:${sourceRevision}:${prompt}`).slice(0, 24)}`,
    brainRevision: sourceRevision,
    consumer: 'codex',
    mode: CODEX_PILOT_MODE,
    fixtureId,
    requestHash: hash(prompt),
    route: route ? { family: route.primaryRouteFamily, owner: route.primaryDescriptorId ?? graph?.primaryOwner?.capabilityId, graphOwner: graph?.primaryOwner?.capabilityId ?? null, candidateCount: route.candidateDescriptorIds.length, selectedSpecialists: bounded(route.selectedSpecialistDescriptorIds, 8) } : null,
    qualification: qualification ? { required: qualification.required, count: qualification.count ?? 0, questionHash: qualification.question ? hash(qualification.question) : null } : null,
    capabilities: { listed: true, inspectedSelectedOnly: true, selectedIds: bounded(packet?.selectedInstructionInspection?.selectedIds, 16), unrelatedFullBodyReads: 0 },
    context: brokerPack ? { packRef: `context://${brokerPack.packId}`, freshness: brokerPack.freshness, returnedItems: brokerPack.items.length, exclusions: bounded(brokerPack.excluded, 8), conflicts: bounded(brokerPack.conflicts, 8), unknowns: bounded(brokerPack.unknowns, 8), usedTokens: brokerPack.budget.usedTokens, maxTokens: 4000 } : null,
    packets: packet ? { taskRef: `task://${packet.taskPacket.taskId}`, evidenceRefs: bounded(packet.evidencePackets.map((item) => `evidence://${item.evidenceId}`), 12), continuationRef: `continuation://${packet.taskPacket.taskId}` } : null,
    graph: graph ? { graphRef: `graph://${graph.graphId}`, nodeCount: graph.nodes.length, primaryOwner: graph.primaryOwner.capabilityId, qualityGates: bounded(graph.qualityGateNodes, 12), safetyGates: bounded(graph.safetyGateNodes, 12), executionReady: graph.execution.executionReady } : null,
    gates: graph ? { required: bounded([...graph.qualityGateNodes, ...graph.safetyGateNodes], 16), executed: 0, status: 'DECLARED_NOT_RUN' } : null,
    risk: route?.normalizedRequest ? { riskClass: route.normalizedRequest.riskClass, confirmationClass: route.normalizedRequest.confirmationClass } : null,
    freshness: { continuity: continuity?.state ?? 'UNAVAILABLE', context: brokerPack?.freshness?.toUpperCase() ?? 'UNAVAILABLE', conflicts: bounded([...(continuity?.reasons ?? []), ...(brokerPack?.conflicts ?? [])], 10) },
    metrics: result.metrics,
    safety: result.safety,
    activation: { conformance: consumerInspection?.conformance ? 'CONFORMANT' : 'DEGRADED', pilotState: result.activationState, activated: false, productionActive: false, activationPerformed: false },
    fallback: result.fallback ?? null,
    failure,
    privacy: { rawPromptStored: false, rawContextStored: false, secretsStored: false, clientConfigurationStored: false, transcriptsStored: false }
  };
  return redactPilotValue(receipt);
}

export function runCodexReadOnlyPilot({ repoRoot = process.cwd(), prompt = '', fixtureId = 'unlabeled', enabled = true, catalog = null, broker = null, currentState = {}, priorPath = 'codex-current-entry', failureMode = null } = {}) {
  const sourceRevision = revision(repoRoot);
  const consumerInspection = inspectCodexConsumer({ repoRoot });
  if (!enabled) return failureResult({ fixtureId, prompt, priorPath, reason: 'pilot_disabled', consumer: 'codex', sourceRevision, consumerInspection });
  if (failureMode === 'catalog_unavailable') return failureResult({ fixtureId, prompt, priorPath, reason: 'catalog_unavailable', consumer: 'codex', sourceRevision, consumerInspection });
  if (failureMode === 'broker_unavailable') return failureResult({ fixtureId, prompt, priorPath, reason: 'broker_unavailable', consumer: 'codex', sourceRevision, consumerInspection });
  if (failureMode === 'capability_unavailable') return failureResult({ fixtureId, prompt, priorPath, reason: 'capability_unavailable', consumer: 'codex', sourceRevision, consumerInspection });
  if (!consumerInspection.conformance) return failureResult({ fixtureId, prompt, priorPath, reason: 'codex_projection_not_conformant', consumer: 'codex', sourceRevision, consumerInspection });

  const activeCatalog = catalog ?? createCapabilityCatalog({ repoRoot, sourceRevision });
  const defaultProfile = activeCatalog.profileHealth?.default;
  if (failureMode === 'profile_unresolved' || !defaultProfile?.healthy) return failureResult({ fixtureId, prompt, priorPath, reason: 'profile_unresolved', consumer: 'codex', sourceRevision, consumerInspection, details: defaultProfile?.unresolved ?? [] });
  const effectiveState = { ...currentState, contextFresh: failureMode === 'stale_pack' ? false : currentState.contextFresh };
  const contextFreshness = effectiveState.contextFresh === false || effectiveState.descriptorFresh === false ? 'stale' : 'fresh';
  const activeBroker = broker ?? localBroker({ catalog: activeCatalog, sourceRevision, contextFreshness, brokerUnavailable: failureMode === 'broker_unavailable' });
  if (!activeBroker) return failureResult({ fixtureId, prompt, priorPath, reason: 'broker_unavailable', consumer: 'codex', sourceRevision, consumerInspection });
  const authority = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }, { id: 'mind', owner: 'mind' }] };
  const descriptorList = activeCatalog.list({ query: prompt, maxItems: 8 });
  const entry = buildUniversalBrainEntry({
    brainRevision: sourceRevision,
    authorityRegistry: authority,
    capabilities: descriptorList.descriptors.map((item) => ({ capabilityId: item.capabilityId, kind: item.kind, summary: item.summary, sourceRevision: item.sourceRevision })),
    navigation: { brain: DEFAULT_BRAIN_POINTERS, context: [CODEX_SOURCE_REFS.broker, CODEX_SOURCE_REFS.graph, CODEX_SOURCE_REFS.taskPacket, CODEX_SOURCE_REFS.evidencePacket], session: [CODEX_SOURCE_REFS.continuity, '.ai/current.md'] },
    maxItems: 8
  });
  const consumption = consumeUniversalBrainEntry({ entry, environment: 'codex', maxItems: 8 });
  const conformance = validateUniversalEntryConformance({ consumption, client: 'codex' });
  const brokerBootstrap = activeBroker.bootstrap({ maxTokens: 800 });
  const bootstrap = compactBootstrap({ entry, consumption, brokerBootstrap, descriptorIds: descriptorList.descriptors.map((item) => item.capabilityId), sourceRevision });
  const brokerPack = activeBroker.resolve({ query: prompt, maxItems: 8, maxTokens: 4000 });
  const continuity = assessContinuity({
    packetSourceRevision: sourceRevision,
    repositoryRevision: effectiveState.repositoryRevision ?? sourceRevision,
    worktreeClean: effectiveState.worktreeClean ?? true,
    sourceAvailable: effectiveState.sourceAvailable ?? true,
    capabilityAvailable: effectiveState.capabilityAvailable ?? true,
    profileResolution: effectiveState.profileResolution ?? true,
    mindEvidenceFresh: effectiveState.mindEvidenceFresh ?? true,
    contextFresh: effectiveState.contextFresh ?? true,
    contextConflict: effectiveState.contextConflict ?? false,
    sourceConflict: effectiveState.sourceConflict ?? effectiveState.mindSourceConflict ?? false,
    capabilityMoved: effectiveState.capabilityMoved ?? false
  });
  if (failureMode === 'continuity_conflict') continuity.state = 'CONFLICTED';
  if (failureMode === 'selected_source_missing') return failureResult({ fixtureId, prompt, priorPath, reason: 'selected_source_missing', consumer: 'codex', sourceRevision, consumerInspection });
  if (failureMode === 'descriptor_stale') return failureResult({ fixtureId, prompt, priorPath, reason: 'descriptor_stale', consumer: 'codex', sourceRevision, consumerInspection });
  if (failureMode === 'invalid_graph') return failureResult({ fixtureId, prompt, priorPath, reason: 'invalid_graph', consumer: 'codex', sourceRevision, consumerInspection });

  let composition;
  try {
    composition = composeShadowRequest(prompt, { catalog: activeCatalog, repoRoot, currentState, generatedAt: '2026-09-02T00:00:00Z' });
  } catch (error) {
    return failureResult({ fixtureId, prompt, priorPath, reason: 'composition_failed', consumer: 'codex', sourceRevision, consumerInspection, details: [error instanceof Error ? error.message : String(error)] });
  }
  const selectedCapability = composition.taskPacket.selectedCapabilityRefs.at(0)?.capabilityId;
  if (selectedCapability && contextFreshness === 'fresh') activeBroker.capabilitiesInspect({ providerId: 'brain-capability-catalog', capabilityId: selectedCapability, includeInstructions: false, relevance: 'metadata' });
  const metrics = {
    bootstrapTokens: bootstrap.budget.usedTokens,
    descriptorRoutingTokens: estimateTokens(JSON.stringify(descriptorList.descriptors)),
    selectedInstructionTokens: composition.budget?.selectedInstructionTokens ?? 0,
    descriptorListFullBodyReads: descriptorList.telemetry.fullBodyReadsDuringList,
    selectedInstructionFullBodyReads: composition.metrics.fullBodies,
    contextPackTokens: brokerPack.budget.usedTokens,
    taskPacketTokens: composition.metrics.taskPacketTokens,
    graphTokens: estimateTokens(JSON.stringify(composition.graph)),
    evidencePacketTokens: (composition.budget?.evidencePacketTokens ?? []).reduce((sum, tokens) => sum + tokens, 0),
    graphNodes: composition.graph.nodes.length,
    maxSimultaneousActiveContext: composition.metrics.maxSimultaneousActiveContext,
    totalReferencedContext: composition.metrics.totalReferencedContext,
    fullRepositoryLoaded: false,
    fullConversationLoaded: false,
    secretsLoaded: false
  };
  const safety = { executionAttempts: 0, providerCalls: 0, writes: 0, mindWrites: 0, profileActivations: 0, clientConfigurationChanges: 0, automaticResume: false, automaticTakeover: false, activationPerformed: false };
  const blocked = !conformance.conformant || continuity.state !== 'CURRENT' || brokerPack.freshness === 'stale' || brokerPack.freshness === 'unknown' || composition.validation.valid === false;
  const activationState = blocked ? 'BLOCKED' : 'PILOT-ACTIVE';
  const result = {
    schemaVersion: PILOT_VERSION,
    mode: CODEX_PILOT_MODE,
    status: blocked ? 'BLOCKED' : composition.qualification.required ? 'NEEDS_QUALIFICATION' : 'READY',
    activationState,
    consumer: 'codex',
    fixtureId,
    requestHash: hash(prompt),
    sourceRevision,
    bootstrap,
    universalEntry: { mode: entry.mode, entryId: entry.entry_id, conformance: conformance.conformant, consumptionStatus: consumption.status },
    broker: { health: activeBroker.health(), bootstrapOperation: brokerBootstrap.operation, packRef: `context://${brokerPack.packId}`, freshness: brokerPack.freshness },
    route: { primaryRouteFamily: composition.route.primaryRouteFamily, primaryDescriptorId: composition.route.primaryDescriptorId, candidateDescriptorIds: bounded(composition.route.candidateDescriptorIds, 16), selectedSpecialistDescriptorIds: bounded(composition.route.selectedSpecialistDescriptorIds, 8), predictedQualitySafetyGates: bounded(composition.route.predictedQualitySafetyGates, 12), qualification: { required: composition.route.qualification.required }, normalizedRequest: { domains: bounded(composition.route.normalizedRequest.domains, 8), riskClass: composition.route.normalizedRequest.riskClass, confirmationClass: composition.route.normalizedRequest.confirmationClass, outputExpectations: bounded(composition.route.normalizedRequest.outputExpectations, 8) } },
    qualification: { required: composition.qualification.required, count: composition.qualification.count ?? 0, questionHash: composition.qualification.question ? hash(composition.qualification.question) : null },
    taskPacket: { taskId: composition.taskPacket.taskId, sourceRevision: composition.taskPacket.sourceRevision, status: composition.taskPacket.state.status, selectedCapabilityRefs: composition.taskPacket.selectedCapabilityRefs, requiredQualityGates: composition.taskPacket.requiredQualityGates, requiredSafetyGates: composition.taskPacket.requiredSafetyGates, continuityRef: composition.taskPacket.continuityRef, nextAction: '[bounded next action]' },
    evidencePackets: composition.evidencePackets.map((item) => ({ evidenceId: item.evidenceId, taskId: item.taskId, subtaskId: item.subtaskId, status: item.status, validationRefs: item.validationRefs, safety: item.safety })),
    graph: { graphId: composition.graph.graphId, taskId: composition.graph.taskId, sourceRevision: composition.graph.sourceRevision, primaryOwner: composition.graph.primaryOwner, nodes: composition.graph.nodes.map((node) => ({ nodeId: node.nodeId, role: node.role, capabilityRef: node.capabilityRef, riskClass: node.riskClass, confirmationRequired: node.confirmationRequired, executionReady: node.executionReady })), qualityGateNodes: composition.graph.qualityGateNodes, safetyGateNodes: composition.graph.safetyGateNodes, execution: composition.graph.execution },
    synthesis: { synthesisId: composition.synthesis.synthesisId, taskId: composition.synthesis.taskId, status: composition.synthesis.status, inputEvidenceRefs: composition.synthesis.inputEvidenceRefs, contextLifetime: composition.synthesis.contextLifetime, rawGraphContextIncluded: false },
    continuity,
    validation: composition.validation,
    metrics,
    safety,
    fallback: blocked ? { active: true, reason: continuity.state !== 'CURRENT' ? `continuity_${continuity.state.toLowerCase()}` : composition.validation.valid ? 'context_or_conformance_blocked' : 'invalid_graph', priorPath, pilotPath: CODEX_PILOT_MODE, rollbackSwitch: 'enabled=false', destructiveMigration: false, priorPathAvailable: true } : { active: false, priorPath, pilotPath: CODEX_PILOT_MODE, rollbackSwitch: 'enabled=false', destructiveMigration: false, priorPathAvailable: true },
    comparison: { priorPath, priorInstrumented: false, qualityDelta: 'NOT_CLAIMED_WITHOUT_PRIOR_INSTRUMENTATION', pilotMeasured: metrics },
    activation: { conformance: conformance.conformant ? 'CONFORMANT' : 'DEGRADED', pilotState: activationState, activated: false, productionActive: false, activationPerformed: false },
    consumerInspection,
    receipt: null
  };
  result.receipt = receipt({ result, prompt, fixtureId, sourceRevision, route: composition.route, qualification: composition.qualification, brokerPack, packet: { taskPacket: composition.taskPacket, evidencePackets: composition.evidencePackets }, graph: composition.graph, continuity, consumerInspection, bootstrap });
  return redactPilotValue(result);
}

export function buildCodexPriorPath({ repoRoot = process.cwd(), name = 'codex-current-entry' } = {}) {
  const inspection = inspectCodexConsumer({ repoRoot });
  return { name, mode: 'NORMAL_CURRENT', sourceRef: CODEX_SOURCE_REFS.entrypoint, available: inspection.sourcePaths.entrypoint.exists, pilotSwitch: 'enabled=false' };
}

export function auditConsumerProjections({ repoRoot = process.cwd(), activeNames = [] } = {}) {
  const expected = new Set(activeNames);
  const paths = {
    claude: 'operations/system-configs/claude/skills',
    codex: 'operations/system-configs/codex/skills/user',
    gemini: 'operations/system-configs/gemini/skills',
    cursor: 'operations/system-configs/cursor/skills',
    antigravity: 'operations/system-configs/gemini/antigravity/skills',
    kiro: 'operations/system-configs/kiro/skills'
  };
  const audit = Object.fromEntries(Object.entries(paths).map(([consumer, target]) => {
    const state = projectionState(repoRoot, target, consumer === 'codex' ? '../../../../ai/skills/active' : null);
    const names = new Set(state.entryNames ?? []);
    const missing = [...expected].filter((name) => !names.has(name)).sort();
    const extra = [...names].filter((name) => !expected.has(name)).sort();
    return [consumer, { ...state, expectedCount: expected.size, missing, extra, healthy: state.exists && missing.length === 0 && extra.length === 0 && state.status !== 'DEGRADED' }];
  }));
  audit.workbench = { path: 'operations/system-configs/mcp/workbench', status: 'NOT_APPLICABLE', healthy: true, reason: 'Workbench is a provider/action boundary, not a shared skill-export consumer; its action surface remains inactive for this pilot.' };
  return audit;
}
