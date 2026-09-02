import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from './capability-catalog.mjs';
import { routeShadowRequest } from './shadow-intent-router.mjs';
import { adapterForRoute, getDomainAdapter, ADAPTER_SOURCE } from './domain-adapters.mjs';
import { loadJson, stableJsonHash, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

export const TASK_PACKET_SCHEMA_VERSION = '1.0.0';
export const EVIDENCE_PACKET_SCHEMA_VERSION = '1.0.0';
export const MAX_CONTEXT_PACK_TOKENS = 4000;
export const FAILURE_OUTCOMES = Object.freeze([
  'NEEDS_QUALIFICATION', 'CAPABILITY_UNAVAILABLE', 'CONTEXT_MISSING', 'CONTEXT_STALE',
  'CONTEXT_CONFLICT', 'AUTHORITY_AMBIGUOUS', 'CONFIRMATION_REQUIRED', 'GATE_FAILED',
  'DEPENDENCY_FAILED', 'EVIDENCE_INSUFFICIENT', 'SOURCE_CHANGED', 'UNSAFE_TO_PROCEED'
]);
export const CONTINUITY_STATES = Object.freeze(['CURRENT', 'STALE', 'CONFLICTED', 'UNAVAILABLE']);

const repoRoot = path.resolve(import.meta.dirname, '../..');
const taskSchema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-task-packet.v1.schema.json'));
const evidenceSchema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-evidence-packet.v1.schema.json'));

export const AUTHORITY_MODEL = Object.freeze({
  repository: 'git', mind: 'mind', taskState: 'task_packet', evidence: 'evidence_packet',
  context: 'context_pack_or_broker', executionReceipt: 'existing_execution_and_gate_systems', conversation: 'non_canonical'
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function id(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || 'item'; }
function hashId(prefix, value) { return `${prefix}:${stableJsonHash(value).slice(0, 16)}`; }
function ref(refType, value, sourceRevision = null) { return { refId: hashId(refType, value), refType, value: String(value), sourceRevision }; }
function currentRevision(root) {
  try { return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}
function descriptor(catalog, capabilityId) { return catalog.descriptors.find((item) => item.capabilityId === capabilityId) ?? null; }
function adapterRef(adapter) { return { adapterId: adapter.adapterId, sourceRef: adapter.sourceRef, sourceRevision: adapter.sourceRevision, mode: adapter.mode }; }
function capabilityRole(capabilityId, route) {
  if (capabilityId.startsWith('gate.confirmation') || capabilityId === 'gate.rollback') return 'SAFETY_GATE';
  if (capabilityId.startsWith('gate.')) return 'QUALITY_GATE';
  if (route.primaryDescriptorId === capabilityId || (route.primaryRouteFamily === 'mixed' && capabilityId === 'skill.design')) return 'PRIMARY_OWNER';
  if (route.proposedCompositionGraph.some((node) => node.id === capabilityId && node.role === 'downstream')) return 'DEPENDENCY';
  return 'SPECIALIST';
}
function capabilityRef(catalog, capabilityId, route) {
  const item = descriptor(catalog, capabilityId);
  if (!item) return null;
  return { capabilityId, role: capabilityRole(capabilityId, route), sourceRef: item.sourceRef, sourceRevision: item.sourceRevision };
}
function sourceRevisionMap(catalog, ids) {
  return Object.fromEntries(unique(ids).sort().map((item) => [item, descriptor(catalog, item)?.sourceRevision ?? null]));
}

function gateContract(gateRef, domain, riskClass) {
  const safety = gateRef === 'gate.confirmation' || gateRef === 'gate.rollback';
  const contracts = {
    'gate.review': ['exact current diff and bounded scope', 'Review findings with severity and source evidence', 'Block meaningful defects before ship'],
    'gate.qa': ['targeted test plan and environment baseline', 'Observable pass/fail evidence', 'Block unverified behavioral changes'],
    'gate.design-review': ['design brief and target artifact', 'Visual/design findings with rationale', 'Block applicable quality defects'],
    'gate.visual-qa': ['rendered interface or visual artifact', 'Screenshots or visual verification evidence', 'Block only when visual output is in scope'],
    'gate.source-provenance': ['source ledger and authority metadata', 'Primary/source-backed evidence', 'Block unsupported research claims'],
    'gate.citation-completeness': ['claims and source references', 'Citations, unknowns, and exclusions', 'Block uncited material claims'],
    'gate.memory-authority': ['memory source and capture intent', 'Authority/provenance classification', 'Block implicit Mind mutation'],
    'gate.continuity': ['identity, revisions, freshness, conflicts, next action', 'Current or explicitly reconciled continuation', 'Block stale or conflicted resume'],
    'gate.browser-evidence': ['named target and observable browser result', 'Response, screenshot, or issue evidence', 'Block unverifiable browser claims'],
    'gate.confirmation': ['exact target, scope, risk, authorization', 'Explicit confirmation receipt', 'Block execution until confirmation'],
    'gate.rollback': ['rollback/recovery plan and affected boundary', 'Recoverability evidence', 'Block materially risky execution without rollback']
  };
  const [inputRequired, expectedOutput, failureBehavior] = contracts[gateRef] ?? ['bounded task output', 'Gate result with evidence', 'Stop progression on blocking failure'];
  return { gateRef, inputRequired: [inputRequired], scope: `${domain} task`, expectedOutput, semantics: ['PASS', 'FAIL', 'ADVISORY', 'NOT_RUN'], evidenceRequired: ['gate result', 'source or artifact reference'], failureBehavior, blocking: safety || !['gate.visual-qa'].includes(gateRef) || riskClass === 'critical' };
}

function riskConfirmation(route) {
  const riskClass = route.riskClass;
  const confirmationClass = route.confirmationClass;
  const confirmationState = confirmationClass === 'none' ? 'not_required' : 'required';
  return { riskClass, confirmationClass, confirmationState };
}

function contextAuthority(scope) {
  if (scope === 'repository' || scope === 'exact-source' || scope === 'git') return 'git';
  if (scope.startsWith('mind')) return 'mind';
  if (scope.startsWith('brain') || scope === 'risk' || scope === 'confirmation' || scope === 'rollback') return 'brain';
  if (scope.startsWith('session') || scope === 'continuity') return 'session_continuity';
  return 'context_broker';
}

function makeContextRequests(taskId, route, nodes, normalized, sourceRevision) {
  const requests = [];
  for (const node of nodes) {
    const scopes = unique(node.ownerDescriptor?.requiredContextScopes ?? route.selectedContextScopes).slice(0, 6);
    const scope = scopes[0] ?? 'brain-policy';
    const requestId = id(`context-request-${node.nodeId}`);
    const pack = ref('context_pack', `context://planned/${taskId}/${node.nodeId}`, sourceRevision);
    requests.push({
      requestId, contextScope: scope, authority: contextAuthority(scope),
      query: normalized.goal.slice(0, 1000), exactRefs: normalized.scope,
      freshnessRequirement: normalized.constraints.includes('freshness_required') ? 'fresh' : 'current',
      maxBudget: Math.min(900, MAX_CONTEXT_PACK_TOKENS), required: true,
      conflictPolicy: ['mind', 'session_continuity'].includes(contextAuthority(scope)) ? 'block' : 'surface',
      fallback: 'exact_source', resolutionStatus: 'PLANNED', contextPackRef: pack
    });
  }
  return requests;
}

function continuationState(currentState, packetRevision) {
  return assessContinuity({ packetSourceRevision: packetRevision, ...currentState });
}

export function assessContinuity({ packetSourceRevision, repositoryRevision = packetSourceRevision, worktreeClean = true, sourceAvailable = true, capabilityAvailable = true, profileResolution = true, mindEvidenceFresh = true, contextFresh = true, contextConflict = false, sourceConflict = false, capabilityMoved = false } = {}) {
  const reasons = [];
  if (!sourceAvailable) reasons.push('source_missing');
  if (!capabilityAvailable) reasons.push('capability_unavailable');
  if (!profileResolution) reasons.push('profile_resolution_failed');
  if (contextConflict || sourceConflict) reasons.push('authority_conflict');
  if (capabilityMoved) reasons.push('capability_moved');
  if (repositoryRevision !== packetSourceRevision) reasons.push('repository_advanced');
  if (!worktreeClean) reasons.push('worktree_changed');
  if (!mindEvidenceFresh) reasons.push('mind_evidence_stale');
  if (!contextFresh) reasons.push('context_stale');
  let state = 'CURRENT';
  if (!sourceAvailable || !capabilityAvailable || !profileResolution) state = 'UNAVAILABLE';
  else if (contextConflict || sourceConflict) state = 'CONFLICTED';
  else if (reasons.length) state = 'STALE';
  return { state, reasons, automaticResumeAllowed: false, resumeDecision: state === 'CURRENT' ? 'EXPLICIT_CONTINUATION_REQUIRED' : 'BLOCKED', reconciliationRequired: state !== 'CURRENT' };
}

export function buildContinuationPacket({ taskPacket, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' }) {
  const check = continuationState(currentState, taskPacket.sourceRevision);
  const continuationId = id(`continuation-${taskPacket.taskId}`);
  return {
    schemaVersion: '1.0.0', continuationId, taskId: taskPacket.taskId,
    sourceRevision: taskPacket.sourceRevision, repositoryRevision: currentState.repositoryRevision ?? taskPacket.sourceRevision,
    state: check.state, reasons: check.reasons, automaticResumeAllowed: false,
    resumeDecision: check.resumeDecision, reconciliationRequired: check.reconciliationRequired,
    continuationPoint: taskPacket.state.pending[0] ?? taskPacket.nextAction,
    nextAction: check.state === 'CURRENT' ? taskPacket.nextAction : 'Reconcile the recorded source, worktree, context, and conflicts before selecting the next node.',
    taskRef: ref('task', `task://${taskPacket.taskId}`, taskPacket.sourceRevision),
    selectedCapabilityRefs: taskPacket.selectedCapabilityRefs.map((item) => ({ capabilityId: item.capabilityId, sourceRevision: item.sourceRevision })),
    evidenceRefs: taskPacket.evidenceRefs,
    validationRefs: taskPacket.validationRefs,
    generatedAt
  };
}

function makeNodes(route, catalog, normalized, packetRisk, taskId, sourceRevision) {
  let graph = route.proposedCompositionGraph.length ? route.proposedCompositionGraph : [{ id: 'skill.code', role: 'primary', dependsOn: [] }];
  if (route.primaryRouteFamily === 'careful') {
    graph = [
      { id: 'skill.code', role: 'primary', dependsOn: [] },
      { id: 'skill.careful', role: 'safety_gate', dependsOn: ['skill.code'] },
      ...route.predictedQualitySafetyGates.filter((gate) => ['gate.confirmation', 'gate.rollback'].includes(gate.ref)).map((gate) => ({ id: gate.ref, role: 'safety_gate', dependsOn: ['skill.careful'] }))
    ];
  }
  return graph.map((graphNode, index) => {
    const ownerDescriptor = descriptor(catalog, graphNode.id) ?? descriptor(catalog, 'skill.code');
    const nodeId = id(`node-${graphNode.id}`);
    const role = graphNode.role === 'primary' ? 'PRIMARY_OWNER' : graphNode.role === 'specialist' ? 'SPECIALIST' : graphNode.role === 'safety_gate' ? 'SAFETY_GATE' : 'QUALITY_GATE';
    const gate = graphNode.id.startsWith('gate.') ? gateContract(graphNode.id, route.primaryRouteFamily ?? 'task', packetRisk.riskClass) : null;
    const contextRef = { refId: id(`context-request-${nodeId}`), refType: 'context_request', value: id(`context-request-${nodeId}`), sourceRevision };
    return {
      nodeId, nodeRole: role, ownerCapabilityRef: capabilityRef(catalog, ownerDescriptor.capabilityId, route),
      ownerDescriptor, action: gate ? `Predict ${graphNode.id} for the bounded ${route.primaryRouteFamily ?? 'task'} step.` : `Select and prepare the ${route.primaryRouteFamily ?? 'code'} step owned by ${ownerDescriptor.capabilityId}.`,
      instructionRefs: [ref('source', `instructions://${ownerDescriptor.capabilityId}`, ownerDescriptor.sourceRevision)],
      contextRequestRefs: [contextRef], expectedOutput: gate?.expectedOutput ?? `Bounded ${route.primaryRouteFamily ?? 'task'} output reference`,
      evidenceRequirements: gate?.evidenceRequired ?? ['bounded output reference', 'source/revision provenance', 'validation or explicit unknown'],
      qualityGateRefs: gate && role === 'QUALITY_GATE' ? [gate] : [], safetyGateRefs: gate && role === 'SAFETY_GATE' ? [gate] : [],
      dependsOn: (graphNode.dependsOn ?? []).map((value) => id(`node-${value}`)),
      nextOnSuccess: index < graph.length - 1 ? id(`node-${graph[index + 1].id}`) : null,
      nextOnFailure: gate?.failureBehavior ?? 'Stop progression and emit the matching failure outcome.',
      mergePoint: route.primaryRouteFamily === 'mixed' && index === graph.length - 1 ? 'merge-design-code-evidence' : null,
      riskClass: packetRisk.riskClass, failureBehavior: gate?.failureBehavior ?? 'Stop on missing scope, stale authority, insufficient evidence, or unsafe conditions.'
    };
  });
}

export function validateTaskPacket(packet, { catalog = createCapabilityCatalog(), evidencePacketIds = [], currentState = {} } = {}) {
  const errors = validateJsonSchema(taskSchema, packet);
  const known = new Map(catalog.descriptors.map((item) => [item.capabilityId, item]));
  const knownEvidence = new Set(evidencePacketIds);
  const validStatuses = new Set(['PLANNED', 'NEEDS_QUALIFICATION', 'CONFIRMATION_REQUIRED', 'READY', 'BLOCKED', 'STALE', 'CONFLICTED', 'UNAVAILABLE', 'COMPLETE']);
  if (packet.sourceRevision === 'unknown') errors.push('missing source revision');
  if (packet.state?.status === 'READY' && packet.sourceRevision === 'unknown') errors.push('ready packet has unavailable continuity');
  if (!validStatuses.has(packet.state?.status)) errors.push('ambiguous status');
  const selected = [...(packet.selectedCapabilityRefs ?? []), ...(packet.route?.selectedCapabilities ?? [])];
  for (const item of selected) {
    const actual = known.get(item.capabilityId);
    if (!actual) errors.push(`unknown capability ref: ${item.capabilityId}`);
    else if (actual.sourceRevision !== item.sourceRevision) errors.push(`capability source revision mismatch: ${item.capabilityId}`);
  }
  const adapter = getDomainAdapter(packet.primaryAdapter?.adapterId?.replace(/^adapter\./, ''));
  if (!adapter) errors.push(`unknown primary adapter: ${packet.primaryAdapter?.adapterId ?? 'missing'}`);
  if (!packet.plan?.nodes?.some((node) => node.nodeRole === 'PRIMARY_OWNER')) errors.push('missing primary owner');
  const gateRefs = new Set([...((packet.requiredQualityGates ?? []).map((gate) => gate.gateRef)), ...((packet.requiredSafetyGates ?? []).map((gate) => gate.gateRef))]);
  for (const gateRef of gateRefs) if (!known.has(gateRef)) errors.push(`unresolved gate ref: ${gateRef}`);
  for (const node of packet.plan?.nodes ?? []) {
    if (!known.has(node.ownerCapabilityRef?.capabilityId)) errors.push(`unknown node owner: ${node.ownerCapabilityRef?.capabilityId}`);
    for (const gate of [...(node.qualityGateRefs ?? []), ...(node.safetyGateRefs ?? [])]) {
      gateRefs.add(gate.gateRef);
      if (!known.has(gate.gateRef)) errors.push(`unresolved gate ref: ${gate.gateRef}`);
    }
  }
  for (const request of packet.contextRequests ?? []) {
    if (request.required && !request.query && !request.exactRefs.length) errors.push(`unbounded context request: ${request.requestId}`);
    if (request.maxBudget > MAX_CONTEXT_PACK_TOKENS) errors.push(`context request exceeds bounded policy: ${request.requestId}`);
    if (!request.contextPackRef || request.contextPackRef.refType !== 'context_pack') errors.push(`unresolved context ref: ${request.requestId}`);
    if (request.resolutionStatus === 'STALE' && !['STALE', 'BLOCKED'].includes(packet.state.status)) errors.push(`stale context treated as current: ${request.requestId}`);
    if (request.resolutionStatus === 'CONFLICTED' && !['CONFLICTED', 'BLOCKED'].includes(packet.state.status)) errors.push(`conflicted context treated as current: ${request.requestId}`);
  }
  for (const item of packet.evidenceRefs ?? []) if (knownEvidence.size && !knownEvidence.has(item.refId)) errors.push(`unresolved evidence ref: ${item.refId}`);
  if (['high', 'critical'].includes(packet.permissions?.riskClass) && packet.permissions.confirmationClass === 'none') errors.push('high-risk packet lacks confirmation class');
  if (packet.permissions?.confirmationClass !== 'none' && packet.permissions?.confirmationState === 'not_required') errors.push('confirmation state contradicts confirmation class');
  const continuity = packet.continuityRef;
  if (continuity?.sourceRevision && continuity.sourceRevision !== packet.sourceRevision && !['STALE', 'CONFLICTED', 'UNAVAILABLE', 'BLOCKED'].includes(packet.state.status)) errors.push('continuity points to stale source without conflict state');
  if (currentState && packet.state?.status === 'READY') {
    const check = assessContinuity({ packetSourceRevision: packet.sourceRevision, ...currentState });
    if (check.state !== 'CURRENT') errors.push(`ready packet has ${check.state.toLowerCase()} continuity`);
  }
  return [...new Set(errors)];
}

export function validateEvidencePacket(packet, { catalog = createCapabilityCatalog(), taskId = packet.taskId, subtaskId = packet.subtaskId } = {}) {
  const errors = validateJsonSchema(evidenceSchema, packet);
  const producer = descriptor(catalog, packet.producerCapability?.capabilityId);
  if (!producer) errors.push(`producer undeclared: ${packet.producerCapability?.capabilityId}`);
  else if (producer.sourceRevision !== packet.producerCapability.sourceRevision) errors.push(`producer source revision mismatch: ${packet.producerCapability.capabilityId}`);
  if (packet.taskId !== taskId || packet.subtaskId !== subtaskId) errors.push('missing or mismatched task/subtask identity');
  const allRefs = [...(packet.inputRefs ?? []), ...(packet.outputRefs ?? []), ...(packet.evidenceRefs ?? []), ...(packet.validationRefs ?? []), ...(packet.continuationRefs ?? [])];
  for (const item of allRefs) {
    if (!item?.refId || !item?.value || /unresolved|missing|invalid/i.test(`${item.refId} ${item.value}`)) errors.push(`invalid output/evidence ref: ${item?.refId ?? 'missing'}`);
  }
  if (['VALIDATED'].includes(packet.status) && (!packet.validationRefs.length || !packet.gateResults.some((gate) => gate.status === 'PASS'))) errors.push('unproven success');
  for (const gate of packet.gateResults ?? []) if (gate.status === 'PASS' && gate.evidenceRefs.length === 0) errors.push(`invalid gate result: ${gate.gateRef}`);
  if ((packet.conflicts ?? []).length && packet.status !== 'CONFLICTED') errors.push('conflicting source revisions lack explicit conflict state');
  if (packet.sideEffectsObserved.observed.length && !packet.sideEffectsObserved.declared.length) errors.push('mutation evidence without side-effect declaration');
  if (packet.sideEffectsObserved.observed.length && !packet.sideEffectsObserved.evidenceRefs.length) errors.push('side effects lack evidence');
  return [...new Set(errors)];
}

function buildEvidencePackets(taskPacket, nodes, continuationRef, sourceRevision) {
  return nodes.map((node) => {
    const evidenceId = id(`evidence-${taskPacket.taskId}-${node.nodeId}`);
    const output = ref('artifact', `shadow-fixture://output/${taskPacket.taskId}/${node.nodeId}`, sourceRevision);
    const evidence = ref('evidence', `evidence://${evidenceId}`, sourceRevision);
    const validation = ref('validation', `shadow-fixture://validation/${evidenceId}`, sourceRevision);
    const context = taskPacket.contextRequests.find((item) => item.requestId === node.contextRequestRefs[0].refId) ?? taskPacket.contextRequests[0];
    const inputRefs = [ref('task', `task://${taskPacket.taskId}`, sourceRevision), context?.contextPackRef ?? ref('context_pack', `context://planned/${taskPacket.taskId}`, sourceRevision)];
    const type = taskPacket.primaryDomain === 'research' ? (taskPacket.route.specialization === 'bible-research' ? 'SOURCE_EVIDENCE' : 'EXTRACTED_CLAIM') : taskPacket.primaryDomain === 'memory' ? 'MEMORY_SOURCE' : taskPacket.primaryDomain === 'code' ? 'REPO_EVIDENCE' : 'OUTPUT';
    return {
      schemaVersion: EVIDENCE_PACKET_SCHEMA_VERSION, evidenceId, taskId: taskPacket.taskId, subtaskId: node.nodeId,
      producerCapability: { capabilityId: node.ownerCapabilityRef.capabilityId, sourceRef: node.ownerCapabilityRef.sourceRef, sourceRevision: node.ownerCapabilityRef.sourceRevision },
      sourceRevision, inputRefs, outputRefs: [output], evidenceRefs: [evidence], validationRefs: [validation],
      claims: [{ claimId: id(`claim-${evidenceId}`), type, statement: `Shadow planning produced a bounded ${node.nodeRole.toLowerCase()} output reference; no domain execution occurred.`, sourceRefs: inputRefs.filter((item) => item.refType !== 'task'), evidenceRefs: [evidence], confidence: 1 }],
      uncertainties: ['This is synthetic fixture evidence; no provider, external, repository, or Mind action was executed.'], conflicts: [],
      gateResults: [...(node.qualityGateRefs ?? []), ...(node.safetyGateRefs ?? [])].map((gate) => ({ gateRef: gate.gateRef, status: 'NOT_RUN', blocking: gate.blocking, evidenceRefs: [], reason: 'Predicted by shadow planning; execution is disabled.' })),
      sideEffectsObserved: { declared: [], observed: [], evidenceRefs: [], noneObserved: true }, continuationRefs: [continuationRef], status: 'OBSERVED',
      execution: { mode: 'shadow_fixture', providerCalls: 0, writesPerformed: 0, mindWrites: 0, externalMutations: 0 }
    };
  });
}

export function buildTaskPacket({ route, catalog = createCapabilityCatalog(), repoRoot: root = repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' }) {
  const sourceRevision = currentRevision(root);
  const normalized = route.normalizedRequest;
  const adapters = adapterForRoute(route, normalized);
  const risk = riskConfirmation(route);
  const family = route.primaryRouteFamily ?? 'unclassified';
  const graphCapabilityIds = route.proposedCompositionGraph.map((node) => node.id).filter((item) => descriptor(catalog, item));
  const selectedIds = unique([route.primaryDescriptorId ?? 'skill.code', ...(route.primaryRouteFamily === 'careful' ? ['skill.code', 'skill.careful'] : []), ...route.selectedSpecialistDescriptorIds, ...graphCapabilityIds, ...route.predictedQualitySafetyGates.map((gate) => gate.ref)]).filter(Boolean);
  const selectedCapabilityRefs = selectedIds.map((item) => capabilityRef(catalog, item, route)).filter(Boolean);
  const primaryAdapter = { ...adapters.selected[0], sourceRevision: sourceRevisionMap(catalog, ['adapter.code'])[`adapter.code`] ?? sourceRevision };
  primaryAdapter.sourceRevision = descriptor(catalog, primaryAdapter.adapterId)?.sourceRevision ?? sourceRevision;
  const taskId = id(`task-${stableJsonHash({ rawIntent: normalized.rawIntent, sourceRevision }).slice(0, 20)}`);
  const preliminaryNodes = makeNodes(route, catalog, normalized, risk, taskId, sourceRevision);
  const contextRequests = makeContextRequests(taskId, route, preliminaryNodes, normalized, sourceRevision);
  const requestRefByNode = new Map(preliminaryNodes.map((node, index) => [node.nodeId, ref('context_request', contextRequests[index].requestId, sourceRevision)]));
  const nodes = preliminaryNodes.map(({ ownerDescriptor, ...node }) => ({ ...node, contextRequestRefs: [requestRefByNode.get(node.nodeId)] }));
  const qualityGateRefs = unique(route.predictedQualitySafetyGates.filter((gate) => !['gate.confirmation', 'gate.rollback'].includes(gate.ref)).map((gate) => gate.ref));
  const safetyGateRefs = unique(route.predictedQualitySafetyGates.filter((gate) => ['gate.confirmation', 'gate.rollback'].includes(gate.ref)).map((gate) => gate.ref));
  const qualityGates = qualityGateRefs.map((gate) => gateContract(gate, family, risk.riskClass));
  const safetyGates = safetyGateRefs.map((gate) => gateContract(gate, family, risk.riskClass));
  const taskPacket = {
    schemaVersion: TASK_PACKET_SCHEMA_VERSION, taskId, sourceRevision, request: normalized,
    route: { routeId: id(`route-${taskId}`), routeFamily: family, primaryAdapter: adapterRef(primaryAdapter), selectedCapabilities: selectedCapabilityRefs, rejectedAlternatives: route.rejectedAlternatives.map((item) => ({ id: item.routeFamily, reason: item.reason })), rationale: [route.explanation.primary, route.explanation.context, route.explanation.risk], specialization: adapters.specialization },
    primaryAdapter: adapterRef(primaryAdapter), selectedCapabilityRefs, requiredQualityGates: qualityGates, requiredSafetyGates: safetyGates, contextRequests,
    scope: { repository: root, inScope: unique([...(normalized.scope ?? []), family]), outOfScope: ['provider execution', 'external mutation', 'Mind writes', 'profile/client configuration changes'] },
    context: { bootstrapRef: ref('context_pack', `context://bootstrap/${taskId}`, sourceRevision), contextPackRefs: contextRequests.map((item) => item.contextPackRef), requiredScopes: route.selectedContextScopes.length ? route.selectedContextScopes : ['brain-policy'], budget: { maxTokens: MAX_CONTEXT_PACK_TOKENS, usedTokens: 0 } },
    qualification: { questionAsked: route.qualification.required, questionRef: route.qualification.question ? ref('source', `qualification://${taskId}`, sourceRevision) : null, assumptions: route.safeDefaults.slice(0, 3) },
    permissions: risk, plan: { nodes, currentNode: nodes[0]?.nodeId ?? null },
    state: { status: route.qualification.required ? 'NEEDS_QUALIFICATION' : ['high', 'critical'].includes(risk.riskClass) ? 'CONFIRMATION_REQUIRED' : 'PLANNED', completed: [], pending: [nodes[0]?.nodeId ?? 'qualification'], blockers: [], decisions: [] },
    evidenceRefs: [], artifactRefs: [], validationRefs: [], stateRefs: [ref('task', `git://${root}`, sourceRevision)], continuityRef: ref('continuation', `continuation://${taskId}`, sourceRevision),
    nextAction: route.qualification.required ? route.qualification.question : ['high', 'critical'].includes(risk.riskClass) ? 'Obtain explicit confirmation after target, scope, rollback, and risk are verified.' : `Inspect only the selected ${family} source instructions and resolve each declared context request.`,
    failurePolicy: { outcomes: [...new Set([...(route.qualification.required ? ['NEEDS_QUALIFICATION'] : []), ...(['high', 'critical'].includes(risk.riskClass) ? ['CONFIRMATION_REQUIRED', 'UNSAFE_TO_PROCEED'] : []), 'CAPABILITY_UNAVAILABLE', 'CONTEXT_MISSING', 'CONTEXT_STALE', 'CONTEXT_CONFLICT', 'GATE_FAILED', 'EVIDENCE_INSUFFICIENT', 'SOURCE_CHANGED'])], stopOn: ['stale or conflicted authority', 'missing required context', 'failed blocking gate', 'unsafe execution boundary'], optionalFallback: 'Return a bounded partial packet with explicit unknowns and one next action.' },
    authority: { taskState: 'task_packet', evidence: 'evidence_packet', context: 'context_pack_or_broker', execution: 'existing_execution_and_gate_systems', conversationCanonical: false },
    execution: { mode: 'shadow', providerCalls: 0, externalMutations: 0, mindWrites: 0, profileActivations: 0, clientConfigChanges: 0, automaticResumeAllowed: false }
  };
  const continuity = assessContinuity({ packetSourceRevision: sourceRevision, ...currentState });
  taskPacket.state.status = route.qualification.required ? 'NEEDS_QUALIFICATION' : continuity.state === 'CURRENT' ? taskPacket.state.status : continuity.state;
  if (continuity.state !== 'CURRENT') taskPacket.state.blockers.push(...continuity.reasons);
  return { taskPacket, adapters, selectedIds, sourceRevision, nodes, route, normalized, continuity };
}

export function planShadowPacket(input, { catalog = createCapabilityCatalog(), repoRoot: root = repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' } = {}) {
  const route = routeShadowRequest(input, { catalog, generatedAt });
  const before = catalog.metrics();
  const built = buildTaskPacket({ route, catalog, repoRoot: root, currentState, generatedAt });
  const shouldInspect = !route.qualification.required;
  const inspectIds = shouldInspect ? built.selectedIds : [];
  const inspections = inspectIds.map((capabilityId) => catalog.inspect({ capabilityId, includeInstructions: true }));
  const after = catalog.metrics();
  const continuationRef = built.taskPacket.continuityRef;
  const continuationPacket = buildContinuationPacket({ taskPacket: built.taskPacket, currentState, generatedAt });
  const evidencePackets = buildEvidencePackets(built.taskPacket, built.nodes, continuationRef, built.sourceRevision);
  built.taskPacket.evidenceRefs = evidencePackets.map((packet) => ref('evidence', `evidence://${packet.evidenceId}`, built.sourceRevision));
  const packetValidation = validateTaskPacket(built.taskPacket, { catalog, evidencePacketIds: evidencePackets.map((packet) => packet.evidenceRefs[0].refId) });
  const evidenceValidation = evidencePackets.map((packet) => ({ evidenceId: packet.evidenceId, errors: validateEvidencePacket(packet, { catalog, taskId: built.taskPacket.taskId, subtaskId: packet.subtaskId }) }));
  const selectedSet = new Set(inspectIds);
  return {
    operation: 'shadow_packet_plan', executionExposed: false, providerCalls: 0, externalMutations: 0, mindWrites: 0,
    route, taskPacket: built.taskPacket, evidencePackets, continuationPacket,
    predictedGatePackets: [...built.taskPacket.requiredQualityGates, ...built.taskPacket.requiredSafetyGates].map((gate) => ({ ...gate, predictedStatus: 'NOT_RUN' })),
    adapterTrace: { primary: built.adapters.selected[0], selected: built.adapters.selected, role: built.adapters.role, specialization: built.adapters.specialization },
    selectedInstructionInspection: { candidateIds: route.candidateDescriptorIds, selectedIds: inspectIds, rejectedCandidates: route.candidateDescriptorIds.filter((candidate) => !selectedSet.has(candidate)), fullInstructionReads: inspections.filter((item) => item.instructionsIncluded).map((item) => item.capabilityId), instructionsEmbeddedInPackets: false },
    contextRequestPlan: built.taskPacket.contextRequests, continuity: built.continuity,
    validation: { taskPacketErrors: packetValidation, evidencePackets: evidenceValidation, valid: packetValidation.length === 0 && evidenceValidation.every((item) => item.errors.length === 0) },
    atomicity: { listFullSkillBodiesLoaded: route.catalogTelemetry?.listOperationFullBodyReads ?? 0, fullBodyReadsBefore: before.fullBodyReads, fullBodyReadsAfter: after.fullBodyReads, selectedFullBodyReads: inspections.filter((item) => item.instructionsIncluded).length, unrelatedFullBodyReads: 0, selectedIds: inspectIds },
    budget: { universalBootstrapTargetTokens: 800, descriptorTokens: route.contextForecast.budget.descriptor, selectedInstructionTokens: inspections.reduce((sum, item) => sum + Math.ceil(String(item.instructions ?? '').length / 4), 0), taskPacketTokens: Math.ceil(JSON.stringify(built.taskPacket).length / 4), evidencePacketTokens: evidencePackets.map((item) => Math.ceil(JSON.stringify(item).length / 4)), continuationPacketTokens: Math.ceil(JSON.stringify(continuationPacket).length / 4), selectedContextPackTokens: 0, selectedContextPackPolicy: MAX_CONTEXT_PACK_TOKENS },
    sourceRevisions: sourceRevisionMap(catalog, built.selectedIds), safety: { profileActivations: 0, clientConfigChanges: 0, providerCalls: 0, externalMutations: 0, mindWrites: 0, automaticResumeAllowed: false }
  };
}

export function getPacketSchemas() { return { task: clone(taskSchema), evidence: clone(evidenceSchema) }; }
