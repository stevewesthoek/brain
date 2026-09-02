import path from 'node:path';
import { composeShadowRequest } from '../orchestration/composition-graph.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { routeShadowRequest } from '../orchestration/shadow-intent-router.mjs';
import { loadJson, stableJsonHash, validateJsonSchema } from './context-learning-core.mjs';

export const UNIVERSAL_CONTRACT_VERSION = '1.0.0';
export const UNIVERSAL_CONTRACT_ID = 'infinite-brain-universal-consumer.v1';
export const CAPABILITY_OUTCOMES = Object.freeze([
  'SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE', 'DEGRADED',
  'REQUIRES_EXTERNAL_CAPABILITY', 'UNAVAILABLE', 'BLOCKED'
]);
export const UNIVERSAL_STAGES = Object.freeze([
  'BrainRequest', 'BrainRoute', 'TaskPacket', 'CompositionGraph', 'ContextRequest[]',
  'CapabilitySelection[]', 'GateSelection[]', 'EvidencePacket[]', 'BrainResult', 'Continuation'
]);

const repoRoot = path.resolve(import.meta.dirname, '../..');
const contractSchema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-contract.v1.schema.json'));
const adapterMatrixSpec = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json'));
const canonicalCapabilityIds = Object.freeze([
  'brain.contract.v1', 'brain.route', 'brain.packet', 'brain.context', 'brain.receipt', 'brain.continuity'
]);
const optionalCapabilityIds = Object.freeze(['workspace.resolve', 'observations.translate', 'approved.actions', 'continuation.expose']);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function bounded(values, max = 24) { return Array.isArray(values) ? values.slice(0, max) : []; }
function textOf(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.intent ?? value?.prompt ?? value?.message ?? value?.content ?? value?.request ?? '').trim();
}
function hash(value) { return stableJsonHash(value); }
function id(prefix, value) { return `${prefix}:${hash(value).slice(0, 20)}`; }

function normalizeCapabilityReport(report) {
  const values = Array.isArray(report)
    ? report
    : Object.entries(report ?? {}).map(([capabilityId, value]) => ({ capabilityId, ...(typeof value === 'object' ? value : { available: value }) }));
  return values.map((item) => {
    const outcome = CAPABILITY_OUTCOMES.includes(item.outcome) ? item.outcome : null;
    return {
      capabilityId: String(item.capabilityId ?? item.id ?? ''),
      available: item.available !== false && item.status !== 'UNAVAILABLE' && item.status !== 'BLOCKED' && (!outcome || outcome === 'SUPPORTED'),
      outcome,
      alternativeFor: item.alternativeFor ? String(item.alternativeFor) : null,
      evidenceRef: item.evidenceRef ? String(item.evidenceRef) : null,
      mode: item.mode ? String(item.mode) : 'native'
    };
  }).filter((item) => item.capabilityId);
}

export function normalizeEnvironment(environment = {}) {
  const capabilities = normalizeCapabilityReport(environment.capabilities ?? environment.capabilityReport);
  return {
    environmentId: String(environment.environmentId ?? environment.id ?? 'reference-environment'),
    contractVersion: String(environment.contractVersion ?? UNIVERSAL_CONTRACT_VERSION),
    capabilities,
    model: environment.model ? { family: String(environment.model.family ?? 'unspecified'), revision: String(environment.model.revision ?? 'unspecified') } : null,
    workspace: environment.workspace ? { boundary: String(environment.workspace.boundary ?? 'unresolved'), resolved: environment.workspace.resolved === true } : null,
    session: environment.session ? { sessionId: String(environment.session.sessionId ?? environment.session.id ?? 'unidentified'), resumable: environment.session.resumable === true } : null
  };
}

export function createBrainRequest({ intent = '', nativeInput = null, environment = {}, session = null, workspace = null, requiredCapabilities = [], optionalCapabilities = [] } = {}) {
  const resolvedIntent = textOf(intent) || textOf(nativeInput);
  if (!resolvedIntent || resolvedIntent.length > 2000) throw new Error('brain_request:bounded_intent_required');
  const normalizedEnvironment = normalizeEnvironment({ ...environment, session: session ?? environment.session, workspace: workspace ?? environment.workspace });
  if (normalizedEnvironment.contractVersion !== UNIVERSAL_CONTRACT_VERSION) throw new Error('brain_request:unsupported_environment_contract');
  return {
    schemaVersion: UNIVERSAL_CONTRACT_VERSION,
    contractId: UNIVERSAL_CONTRACT_ID,
    requestId: id('brain-request', { resolvedIntent, session: normalizedEnvironment.session?.sessionId ?? null, workspace: normalizedEnvironment.workspace?.boundary ?? null }),
    intent: resolvedIntent,
    nativeInputPresent: nativeInput !== null,
    environment: normalizedEnvironment,
    requiredCapabilities: [...new Set([...canonicalCapabilityIds, ...requiredCapabilities.map(String)])],
    optionalCapabilities: [...new Set([...optionalCapabilityIds, ...optionalCapabilities.map(String)])],
    safety: { executionRequested: false, mutationRequested: false, providerCalls: 0, writesPerformed: 0 },
    authority: { routing: 'brain', qualification: 'brain', context: 'brain', gates: 'brain', continuity: 'brain', conversationCanonical: false }
  };
}

export function negotiateCapabilities({ required = [], optional = [], reported = [] } = {}) {
  const reports = new Map(normalizeCapabilityReport(reported).map((item) => [item.capabilityId, item]));
  const alternatives = new Map(normalizeCapabilityReport(reported).filter((item) => item.alternativeFor).map((item) => [item.alternativeFor, item]));
  const select = (capabilityId, isRequired) => {
    const report = reports.get(capabilityId);
    if (report?.available && (!report.outcome || report.outcome === 'SUPPORTED')) return { capabilityId, selectedCapabilityId: capabilityId, required: isRequired, outcome: 'SUPPORTED', evidenceRef: report.evidenceRef };
    const alternative = alternatives.get(capabilityId);
    if (alternative?.available) return { capabilityId, selectedCapabilityId: alternative.capabilityId, required: isRequired, outcome: 'SUPPORTED_WITH_ALTERNATIVE', evidenceRef: alternative.evidenceRef };
    if (report?.outcome === 'REQUIRES_EXTERNAL_CAPABILITY') return { capabilityId, selectedCapabilityId: null, required: isRequired, outcome: 'REQUIRES_EXTERNAL_CAPABILITY', evidenceRef: report.evidenceRef };
    if (report?.outcome === 'BLOCKED') return { capabilityId, selectedCapabilityId: null, required: isRequired, outcome: 'BLOCKED', evidenceRef: report.evidenceRef };
    return { capabilityId, selectedCapabilityId: null, required: isRequired, outcome: isRequired ? 'UNAVAILABLE' : 'DEGRADED', evidenceRef: report?.evidenceRef ?? null };
  };
  const selections = [...required.map((item) => select(typeof item === 'string' ? item : item.capabilityId, true)), ...optional.map((item) => select(typeof item === 'string' ? item : item.capabilityId, false))];
  const blocking = selections.filter((item) => item.required && !['SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE'].includes(item.outcome));
  return { selections, status: blocking.length ? 'BLOCKED' : selections.some((item) => item.outcome !== 'SUPPORTED') ? 'DEGRADED' : 'SUPPORTED', blocking: blocking.map((item) => item.capabilityId), noSilentOmission: true };
}

export function semanticProjection(result) {
  const route = result?.route ?? {};
  const packet = result?.taskPacket ?? {};
  const graph = result?.compositionGraph ?? {};
  return {
    route: { family: route.primaryRouteFamily ?? null, owner: route.primaryDescriptorId ?? null, specialists: [...(route.selectedSpecialistDescriptorIds ?? [])].sort(), qualification: result?.qualification?.required === true || route.qualification?.required === true, riskClass: route.normalizedRequest?.riskClass ?? route.riskClass ?? null, confirmationClass: route.normalizedRequest?.confirmationClass ?? route.confirmationClass ?? null },
    packet: { status: packet.state?.status ?? null, selected: [...(packet.selectedCapabilityRefs ?? [])].map((item) => `${item.capabilityId}:${item.role}`).sort(), qualityGates: [...(packet.requiredQualityGates ?? [])].map((item) => item.gateRef).sort(), safetyGates: [...(packet.requiredSafetyGates ?? [])].map((item) => item.gateRef).sort(), contextScopes: [...(packet.context?.requiredScopes ?? [])].sort() },
    graph: { owner: graph.primaryOwner?.capabilityId ?? null, nodes: [...(graph.nodes ?? [])].map((item) => `${item.role}:${item.capabilityRef?.capabilityId}`).sort(), qualityGates: [...(graph.qualityGateNodes ?? [])].sort(), safetyGates: [...(graph.safetyGateNodes ?? [])].sort() },
    continuity: { state: result?.continuation?.state ?? null, automaticResumeAllowed: result?.continuation?.automaticResumeAllowed === true },
    safety: { providerCalls: result?.safety?.providerCalls ?? null, writesPerformed: result?.safety?.writesPerformed ?? null, executionReady: result?.safety?.executionReady === true }
  };
}

function buildReceipt({ request, route, qualification, packet, graph, negotiation, continuation, evidencePackets, resultStatus }) {
  const projection = semanticProjection({ route, taskPacket: packet, compositionGraph: graph, continuation, safety: { providerCalls: 0, writesPerformed: 0, executionReady: false } });
  const capabilityReport = bounded(request.environment.capabilities).map((item) => ({
    capabilityId: item.capabilityId,
    available: item.available,
    outcome: item.outcome ?? (item.available ? 'SUPPORTED' : 'UNAVAILABLE'),
    mode: item.mode
  }));
  return {
    schemaVersion: UNIVERSAL_CONTRACT_VERSION,
    receiptId: id('brain-receipt', { requestId: request.requestId, sourceRevision: packet.sourceRevision, resultStatus }),
    contractVersion: UNIVERSAL_CONTRACT_VERSION,
    consumer: request.environment.environmentId,
    consumerCapabilities: capabilityReport,
    brainRevision: packet.sourceRevision,
    requestHash: hash(request.intent),
    sourceRevision: packet.sourceRevision,
    route: projection.route,
    qualification: { required: qualification?.required === true },
    semantic: projection,
    capabilities: negotiation.selections.map((item) => ({ capabilityId: item.capabilityId, selectedCapabilityId: item.selectedCapabilityId, required: item.required, outcome: item.outcome })),
    taskPacket: { taskId: packet.taskId, status: packet.state?.status ?? null, ref: `task://${packet.taskId}` },
    compositionGraph: { graphId: graph.graphId, ref: `graph://${graph.graphId}` },
    contextRefs: bounded(packet.context?.contextPackRefs ?? packet.contextRequests?.map((item) => item.contextPackRef) ?? []),
    evidenceRefs: bounded((evidencePackets ?? []).map((item) => `evidence://${item.evidenceId}`)),
    gates: { quality: bounded(packet.requiredQualityGates?.map((item) => item.gateRef) ?? []), safety: bounded(packet.requiredSafetyGates?.map((item) => item.gateRef) ?? []) },
    risk: { riskClass: route.riskClass ?? null, confirmationClass: route.confirmationClass ?? null },
    freshness: { continuity: continuation?.state ?? 'UNAVAILABLE', sourceRevision: packet.sourceRevision },
    continuity: { continuationId: continuation?.continuationId ?? null, state: continuation?.state ?? 'UNAVAILABLE', automaticResumeAllowed: continuation?.automaticResumeAllowed === true },
    sideEffects: { providerCalls: 0, writesPerformed: 0, executionReady: false },
    outcome: resultStatus,
    degradation: negotiation.blocking.length ? { status: 'BLOCKED', reasons: negotiation.blocking } : { status: negotiation.status, reasons: [] },
    rawPromptStored: false,
    transcriptCanonical: false,
    providerCalls: 0,
    writesPerformed: 0,
    automaticResume: false
  };
}

export function orchestrateBrainRequest(request, { catalog = createCapabilityCatalog(), repoRoot: root = repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' } = {}) {
  if (!request?.intent || request.schemaVersion !== UNIVERSAL_CONTRACT_VERSION || request.contractId !== UNIVERSAL_CONTRACT_ID || request.environment?.contractVersion !== UNIVERSAL_CONTRACT_VERSION) throw new Error('brain_request:unsupported_contract');
  const negotiation = negotiateCapabilities({ required: request.requiredCapabilities, optional: request.optionalCapabilities, reported: request.environment.capabilities });
  const composition = composeShadowRequest(request.intent, { catalog, repoRoot: root, currentState: currentState ?? {}, generatedAt });
  const route = composition.route;
  const packet = composition.taskPacket;
  const graph = composition.graph;
  const continuation = composition.continuationPacket;
  const resultStatus = negotiation.status === 'BLOCKED'
    ? 'BLOCKED'
    : composition.qualification.required
      ? 'NEEDS_QUALIFICATION'
      : packet.state.status === 'CONFIRMATION_REQUIRED'
        ? 'CONFIRMATION_REQUIRED'
        : composition.taskPacket.state.status !== 'PLANNED' && composition.taskPacket.state.status !== 'CURRENT'
          ? 'BLOCKED'
          : composition.validation.valid ? 'READY' : 'BLOCKED';
  const safety = { providerCalls: 0, writesPerformed: 0, executionReady: false, automaticResumeAllowed: false, clientConfigChanges: 0, mindWrites: 0 };
  const result = { schemaVersion: UNIVERSAL_CONTRACT_VERSION, status: resultStatus, route, qualification: composition.qualification, taskPacket: packet, compositionGraph: graph, contextRequests: packet.contextRequests, capabilitySelections: negotiation.selections, gateSelections: [...packet.requiredQualityGates, ...packet.requiredSafetyGates], evidencePackets: composition.evidencePackets, continuation, safety, sourceRevisions: composition.sourceRevisions, validation: composition.validation, budget: composition.budget, atomicity: { ...composition.atomicity, maxSimultaneousActiveContext: composition.metrics.maxSimultaneousActiveContext, totalReferencedContext: composition.metrics.totalReferencedContext, selectedInstructionFullBodyReads: composition.metrics.fullBodies, unrelatedFullBodyReads: composition.atomicity.unrelatedFullBodyReads ?? 0 }, degradation: negotiation.blocking.length ? { status: 'BLOCKED', reasons: negotiation.blocking } : { status: negotiation.status, reasons: [] } };
  result.receipt = buildReceipt({ request, route, qualification: composition.qualification, packet, graph, negotiation, continuation, evidencePackets: composition.evidencePackets, resultStatus });
  return result;
}

export function createReferenceEnvironmentAdapter({ adapterId = 'adapter.reference-environment.v1', environmentId = 'reference-environment', capabilities = null } = {}) {
  const defaultCapabilities = [...canonicalCapabilityIds, ...optionalCapabilityIds].map((capabilityId) => ({ capabilityId, available: true, outcome: 'SUPPORTED', mode: 'reference' }));
  const translate = (nativeInput, metadata = {}) => {
    const nativeObject = nativeInput && typeof nativeInput === 'object' ? nativeInput : {};
    const nativeEnvironment = nativeObject.environment && typeof nativeObject.environment === 'object' ? nativeObject.environment : {};
    const nativeSession = nativeObject.session && typeof nativeObject.session === 'object' ? nativeObject.session : null;
    const nativeWorkspace = nativeObject.workspace && typeof nativeObject.workspace === 'object' ? nativeObject.workspace : null;
    return createBrainRequest({
      nativeInput,
      environment: { environmentId, capabilities: capabilities ?? defaultCapabilities, ...nativeEnvironment, ...metadata.environment },
      session: metadata.session ?? nativeSession,
      workspace: metadata.workspace ?? nativeWorkspace,
      requiredCapabilities: metadata.requiredCapabilities ?? nativeObject.requiredCapabilities ?? [],
      optionalCapabilities: metadata.optionalCapabilities ?? nativeObject.optionalCapabilities ?? []
    });
  };
  return Object.freeze({
    adapterId,
    contractVersion: UNIVERSAL_CONTRACT_VERSION,
    environmentId,
    translate,
    consume(nativeInput, metadata = {}, options = {}) { return orchestrateBrainRequest(translate(nativeInput, metadata), options); },
    render(result) { return { status: result.status, semantic: semanticProjection(result), receiptId: result.receipt.receiptId, continuationId: result.continuation?.continuationId ?? null }; },
    capabilities() { return clone(capabilities ?? defaultCapabilities); }
  });
}

export function consumerAdapterMatrix() {
  return clone(adapterMatrixSpec.adapters).map((entry) => ({ ...entry, adapter: entry.adapterRef, contractVersion: UNIVERSAL_CONTRACT_VERSION, capabilityDriven: true, routingOwner: 'brain', configurationChanged: false }));
}

export function validateUniversalConsumerContract(contract = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-contract.v1.json'))) {
  return validateJsonSchema(contractSchema, contract);
}

export function validateConsumerIndependence(sourceTexts = []) {
  const violations = [];
  const forbidden = [
    { id: 'consumer-conditioned-route', pattern: /(?:if|switch|case|ternary)[^\n]{0,100}\b(?:consumer|client|ide|model)\b[^\n]{0,100}\b(?:route|specialist|gate|context|qualification)\b/i },
    { id: 'client-name-route-branch', pattern: /\b(?:codex|claude|cursor|kiro|antigravity|gemini|workbench)\b[^\n]{0,100}\b(?:route|specialist|gate|context|qualification)\b/i }
  ];
  for (const source of sourceTexts) {
    // Do not let the validator's own rule declarations become findings.
    const text = String(source.text ?? source).split('\n').filter((line) => !/forbidden|pattern:/.test(line)).join('\n');
    for (const rule of forbidden) if (rule.pattern.test(text)) violations.push({ source: source.path ?? 'inline', rule: rule.id });
  }
  return [...new Map(violations.map((item) => [`${item.source}:${item.rule}`, item])).values()];
}

export function universalContractSummary() {
  return { contractId: UNIVERSAL_CONTRACT_ID, schemaVersion: UNIVERSAL_CONTRACT_VERSION, stages: [...UNIVERSAL_STAGES], capabilityOutcomes: [...CAPABILITY_OUTCOMES], adapters: consumerAdapterMatrix(), validationErrors: validateUniversalConsumerContract() };
}
