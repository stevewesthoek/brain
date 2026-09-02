import path from 'node:path';
import { createCapabilityCatalog } from './capability-catalog.mjs';
import { planShadowPacket } from './task-evidence-packets.mjs';
import { loadJson, stableJsonHash, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const graphSchema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-composition-graph.v1.schema.json'));

export const COMPOSITION_GRAPH_SCHEMA_VERSION = '1.0.0';
export const GRAPH_ROLES = Object.freeze(['PRIMARY_OWNER', 'SPECIALIST', 'CONTEXT_ACQUISITION', 'EXECUTION', 'QUALITY_GATE', 'SAFETY_GATE', 'MERGE', 'SYNTHESIS', 'CONTINUATION']);
export const EDGE_TYPES = Object.freeze(['DEPENDENCY', 'GATE', 'EVIDENCE', 'CONFIRMATION', 'FAILURE']);
export const FAILURE_OUTCOMES = Object.freeze(['BLOCK_GRAPH', 'SKIP_DEPENDENTS', 'CONTINUE_INDEPENDENT', 'DEGRADE_WITH_WARNING', 'NEEDS_QUALIFICATION', 'CONFIRMATION_REQUIRED', 'GATE_FAILED', 'SOURCE_CHANGED', 'CONTEXT_CONFLICT']);
export const DEFAULT_GRAPH_BOUNDS = Object.freeze({ maxDepth: 10, maxNodes: 24, maxSpecialistsPerPhase: 6, maxParallelWidth: 4, maxRepairEdges: 2, maxMergeFanIn: 8 });
export const GRAPH_AUTHORITY_MODEL = Object.freeze({ task: 'task_packet', evidence: 'evidence_packet', context: 'context_pack_or_broker', repository: 'git', mind: 'mind', execution: 'existing_execution_and_gate_systems', conversationCanonical: false });

const QUALITY_GATES = new Set(['gate.review', 'gate.qa', 'gate.design-review', 'gate.visual-qa', 'gate.source-provenance', 'gate.citation-completeness', 'gate.browser-evidence', 'gate.continuity', 'gate.memory-authority']);
const SAFETY_GATES = new Set(['gate.confirmation', 'gate.rollback']);
const MUTATION_WORDS = /\b(deploy|production|delete|destroy|clean up|publish|credential(?:s)?|secret(?:s)?|database|billing|payment(?:s)?|merge|push)\b/i;
const RESEARCH_WORDS = /\b(research|market|competitor|demand|enter this market|sources?|study|investigate)\b/i;
const DESIGN_WORDS = /\b(design|beautiful|amazing|premium|dashboard|website|landing page|redesign|visual|ui|page)\b/i;
const CODE_WORDS = /\b(build|building|feature|code|fix|debug|bug|login|auth|authentication|implement|refactor|backend|api|repository|app)\b/i;
const BIBLE_WORDS = /\b(bible|scripture|romans|psalm|covenant|greek|hebrew|passage|theology|yeshua)\b/i;
const MEMORY_WORDS = /\b(remember|recall|decided|yesterday|discussed|continue building|what did we)\b/i;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function id(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'node'; }
function ref(refType, value, sourceRevision) { return { refId: id(`${refType}-${value}`), refType, value: String(value), sourceRevision }; }
function descriptor(catalog, capabilityId) { return catalog.descriptors.find((item) => item.capabilityId === capabilityId) ?? null; }
function capabilityRef(catalog, capabilityId, fallbackRevision) {
  const item = descriptor(catalog, capabilityId);
  return item ? { capabilityId, sourceRef: item.sourceRef, sourceRevision: item.sourceRevision } : { capabilityId, sourceRef: 'unresolved', sourceRevision: fallbackRevision };
}
function taskRef(taskId, subtaskId, sourceRevision) { return { taskId, subtaskId: id(subtaskId), packetRef: `task://${taskId}/subtask/${id(subtaskId)}`, sourceRevision }; }
function sourceRevision(taskPacket, fallback = 'unknown') { return taskPacket?.sourceRevision ?? fallback; }
function textOf(route, taskPacket) { return String(route?.normalizedRequest?.normalizedText ?? taskPacket?.request?.rawIntent ?? '').toLowerCase(); }
function outputRef(taskId, nodeId, source) { return ref('output', `shadow://output/${taskId}/${nodeId}`, source); }
function contextLifetime(phase, inputs, maxTokens) { return { phase, inputRefs: inputs.map((item) => id(item)), maxTokens: Math.min(4000, Math.max(1, maxTokens)), rawContextLoaded: 0 }; }

function isMeaningfulCode(text) { return /\b(build|building|feature|fix|debug|bug|implement|refactor|change|ship|publish|make|improve|authentication)\b/i.test(text) && !/\b(read-only|without changing|analyze|explain|plan a)\b/i.test(text); }
function isMixedResearchBuild(text) { return RESEARCH_WORDS.test(text) && (CODE_WORDS.test(text) || DESIGN_WORDS.test(text)); }

export function selectPrimaryOwner({ normalized = {}, route = {}, taskPacket = {}, catalog = createCapabilityCatalog() } = {}) {
  const text = String(normalized.normalizedText ?? normalized.rawIntent ?? taskPacket.request?.rawIntent ?? '').toLowerCase();
  let capabilityId = route.primaryDescriptorId ?? 'skill.code';
  let rationale = 'Inherited the Phase 3 deterministic route and selected exactly one owner.';
  // Code/Web/Mixed route ownership is authoritative. Re-inferring ownership
  // from outcome words there caused verification words such as "test" to
  // steal the domain owner and made graph gates disagree with the packet.
  // Research/design legacy mixed composition keeps its established final-
  // artifact owner until the router itself is deliberately revised.
  if (route.primaryRouteFamily === 'careful' || capabilityId === 'skill.careful') {
    capabilityId = 'skill.code';
    rationale = 'Careful guards the technical mutation but does not own its domain work.';
  } else if (route.primaryDescriptorId && ['code', 'web', 'mixed'].includes(route.primaryRouteFamily)) {
    rationale = `Inherited the routed owner ${route.primaryDescriptorId}; specialists and gates remain separate graph roles.`;
  } else if (MUTATION_WORDS.test(text) && !(/\bvideo\b/i.test(text) && !/\b(deploy|database|production|credential|secret)\b/i.test(text))) {
    capabilityId = 'skill.code'; rationale = 'Technical work owns the requested mutation; Careful is a required safety gate.';
  } else if (/\b(review|critique|audit|preflight|diff)\b/i.test(text)) { capabilityId = 'skill.review'; rationale = 'The requested outcome is a review report, so Review owns the graph.'; }
  else if (/\b(make sure it works|run qa|qa|test|verify)\b/i.test(text)) { capabilityId = 'skill.qa'; rationale = 'The requested outcome is verification, so QA owns the graph.'; }
  else if (MEMORY_WORDS.test(text) && CODE_WORDS.test(text)) { capabilityId = 'skill.code'; rationale = 'Memory supplies read-only continuity context; Code owns the requested build outcome.'; }
  else if (MEMORY_WORDS.test(text) && RESEARCH_WORDS.test(text)) { capabilityId = 'skill.research'; rationale = 'Memory supplies read-only continuity context; Research owns the requested evidence outcome.'; }
  else if (MEMORY_WORDS.test(text) && DESIGN_WORDS.test(text)) { capabilityId = 'skill.design'; rationale = 'Memory supplies read-only continuity context; Design owns the requested visual outcome.'; }
  else if (isMixedResearchBuild(text)) {
    capabilityId = DESIGN_WORDS.test(text) ? 'skill.design' : 'skill.code';
    rationale = 'The final desired outcome determines the owner; research is a bounded specialist branch.';
  } else if (RESEARCH_WORDS.test(text) && !CODE_WORDS.test(text) && !DESIGN_WORDS.test(text)) {
    capabilityId = 'skill.research'; rationale = 'The requested outcome is evidence acquisition or synthesis, so Research owns the graph.';
  } else if (BIBLE_WORDS.test(text)) { capabilityId = 'skill.research'; rationale = 'Bible work is research-owned with Bible and Scripture source specialists.'; }
  if (!descriptor(catalog, capabilityId)) capabilityId = 'skill.code';
  return { capabilityId, ...capabilityRef(catalog, capabilityId, taskPacket.sourceRevision ?? 'unknown'), rationale };
}

function node({ taskPacket, catalog, nodeId, role, capabilityId, branch = null, dependsOn = [], source, riskClass = 'read-only', authorityReads = [], authorityWrites = [], maxTokens = 500, phase = 'NODE_EXECUTION', confirmationRequired = false, failureBehavior = 'Emit explicit failure and skip dependents; independent branches may continue.', mergePolicy = null, status = 'PLANNED', executionReady = false }) {
  const output = outputRef(taskPacket.taskId, nodeId, source);
  const inputs = dependsOn.map((item) => ref('dependency', `graph://${taskPacket.taskId}/${item}`, source));
  return { nodeId, role, taskRef: taskRef(taskPacket.taskId, nodeId, source), capabilityRef: capabilityRef(catalog, capabilityId, source), branch, inputs, outputs: [output], authorityReads: unique(authorityReads), authorityWrites: unique(authorityWrites), contextBudget: Math.min(4000, maxTokens), contextLifetime: contextLifetime(phase, inputs.map((item) => item.refId), maxTokens), riskClass, failureBehavior, confirmationRequired, executionReady, mergePolicy, status };
}

function addDependency(edges, dependencies, from, to, type = 'DEPENDENCY', semantics = 'The predecessor must complete before the dependent node can run.') {
  edges.push({ edgeId: id(`edge-${from}-${to}-${type}`), from, to, type, semantics, required: true });
  dependencies.push({ from, to, reason: semantics });
}

function gateCapability(gateRef) { return gateRef; }
function requiredGateRefs(text, owner, riskClass) {
  const quality = [];
  if (owner === 'skill.code' && isMeaningfulCode(text)) quality.push('gate.review', 'gate.qa');
  if (owner === 'skill.review') quality.push('gate.review');
  if (owner === 'skill.design' || DESIGN_WORDS.test(text)) quality.push('gate.design-review', 'gate.visual-qa');
  if (owner === 'skill.research' || RESEARCH_WORDS.test(text)) quality.push('gate.source-provenance', 'gate.citation-completeness');
  if (owner === 'skill.web') quality.push('gate.browser-evidence');
  if (owner === 'skill.memory') quality.push('gate.memory-authority');
  if (owner === 'skill.handoff') quality.push('gate.continuity');
  if (owner === 'skill.video' && /\b(render|edit|compose|produce|publish|script)\b/i.test(text)) quality.push('gate.qa');
  if (riskClass === 'high' || riskClass === 'critical') if (/\bdeploy\b/i.test(text)) quality.push('gate.qa');
  return { quality: unique(quality), safety: riskClass === 'high' || riskClass === 'critical' ? ['gate.rollback', 'gate.confirmation'] : [] };
}

function branchPlan({ text, owner, taskPacket }) {
  const branches = [];
  if (RESEARCH_WORDS.test(text) && /\b(market|enter this market|competitor|demand)\b/i.test(text)) {
    for (const branch of ['market-size', 'competitors', 'demand', 'primary-source']) branches.push({ capabilityId: 'skill.research', branch, maxTokens: 350 });
  } else if (BIBLE_WORDS.test(text)) {
    branches.push({ capabilityId: 'skill.bible-research', branch: 'passage-and-immediate-context', maxTokens: 450 });
    if (/\b(greek|hebrew|lexical|syntax|translation(?:s)?|original-language)\b/i.test(text)) branches.push({ capabilityId: 'skill.scripture-sources', branch: 'original-language-and-lexical-syntax', maxTokens: 450 });
    if (/\b(covenant|trace|through scripture|canonical)\b/i.test(text)) branches.push({ capabilityId: 'skill.bible-research', branch: 'canonical-trace', maxTokens: 450 });
  } else if (owner === 'skill.design') {
    if (DESIGN_WORDS.test(text)) branches.push({ capabilityId: 'skill.web-design', branch: 'implementation-ready-design-evidence', maxTokens: 450 });
    if (/\b(tokens|component|design system|spacing|typography)\b/i.test(text)) branches.push({ capabilityId: 'skill.design-system', branch: 'design-system', maxTokens: 350 });
  } else if (owner === 'skill.code') {
    if (/\b(build this feature|this feature|make this code|much better|architecture|unknown|thing)\b/i.test(text)) {
      branches.push({ capabilityId: 'mcp.codebase-memory', branch: 'bounded-structural-navigation', maxTokens: 350, role: 'CONTEXT_ACQUISITION' });
      branches.push({ capabilityId: 'mcp.codebase-memory', branch: 'bounded-test-impact', maxTokens: 300, role: 'CONTEXT_ACQUISITION' });
    }
    if (/\b(fix|debug|broken|root cause|login|auth)\b/i.test(text)) branches.push({ capabilityId: 'skill.investigate', branch: 'root-cause', maxTokens: 400 });
  } else if (owner === 'skill.video') {
    branches.push({ capabilityId: 'skill.design', branch: 'thumbnail-or-visual-direction', maxTokens: 350 });
  }
  if (MEMORY_WORDS.test(text) && owner !== 'skill.memory') branches.unshift({ capabilityId: 'skill.memory', branch: 'read-only-continuity-context', maxTokens: 350, role: 'CONTEXT_ACQUISITION' });
  return branches.slice(0, 6);
}

function isMutationRoute(text, riskClass) { return riskClass === 'high' || riskClass === 'critical' || MUTATION_WORDS.test(text); }

export function buildCompositionGraph({ taskPacket, evidencePackets = [], route = {}, normalized = route.normalizedRequest ?? {}, catalog = createCapabilityCatalog(), bounds = DEFAULT_GRAPH_BOUNDS } = {}) {
  if (!taskPacket?.taskId) throw new Error('taskPacket.taskId is required');
  const source = sourceRevision(taskPacket);
  const text = textOf(route, taskPacket);
  const mutationRequested = MUTATION_WORDS.test(text);
  const routedRisk = normalized.riskClass ?? taskPacket.permissions?.riskClass;
  const riskClass = ['high', 'critical'].includes(routedRisk)
    ? routedRisk
    : mutationRequested
      ? (['critical', 'delete', 'destroy', 'production'].some((x) => text.includes(x)) ? 'critical' : 'high')
      : (taskPacket.permissions?.riskClass === 'read-only' ? 'read-only' : 'medium');
  const primary = selectPrimaryOwner({ normalized, route, taskPacket, catalog });
  const nodes = [];
  const edges = [];
  const dependencies = [];
  const add = (options) => { const item = node({ taskPacket, catalog, source, ...options }); nodes.push(item); return item.nodeId; };
  const ownerId = add({ nodeId: 'owner-primary', role: 'PRIMARY_OWNER', capabilityId: primary.capabilityId, maxTokens: 650, riskClass: riskClass === 'read-only' ? 'read-only' : 'medium', authorityReads: ['git', 'brain'], authorityWrites: primary.capabilityId === 'skill.code' ? ['repository'] : [] });
  const branchIds = [];
  for (const branch of branchPlan({ text, owner: primary.capabilityId, taskPacket })) {
    const branchId = add({ nodeId: `specialist-${id(branch.branch)}`, role: branch.role ?? 'SPECIALIST', capabilityId: branch.capabilityId, branch: branch.branch, dependsOn: branch.role === 'CONTEXT_ACQUISITION' ? [] : [ownerId], maxTokens: branch.maxTokens, riskClass: branch.capabilityId === 'mcp.codebase-memory' ? 'medium' : 'read-only', authorityReads: branch.capabilityId === 'skill.memory' ? ['mind'] : ['git', 'brain'] });
    branchIds.push(branchId);
    if (branch.role === 'CONTEXT_ACQUISITION') addDependency(edges, dependencies, branchId, ownerId, 'EVIDENCE', 'Context acquisition evidence is required before the primary owner selects exact source scope.');
    else if (branch.capabilityId !== 'skill.web-design' && primary.capabilityId === 'skill.design') addDependency(edges, dependencies, ownerId, branchId, 'DEPENDENCY', 'The owner defines the bounded specialist brief.');
  }
  const researchMergeNeeded = branchIds.filter((item) => item.startsWith('specialist-market') || item.startsWith('specialist-primary-source')).length > 0;
  const designCode = primary.capabilityId === 'skill.design' && isMeaningfulCode(text);
  let mergeId = null;
  if (researchMergeNeeded || designCode || branchIds.length >= 2) {
    const mergeInputs = unique([...(branchIds.length ? branchIds : []), ...(branchIds.some((item) => item.startsWith('specialist-bounded')) ? [ownerId] : [])]);
    mergeId = add({ nodeId: 'merge-evidence', role: 'MERGE', capabilityId: 'adapter.context-broker', dependsOn: mergeInputs.length ? mergeInputs : [ownerId], maxTokens: 500, riskClass: 'read-only', authorityReads: ['evidence_packet', 'git'], mergePolicy: 'preserve_provenance_and_conflicts; no blind concatenation' });
    for (const branchId of mergeInputs.length ? mergeInputs : [ownerId]) addDependency(edges, dependencies, branchId, mergeId, 'EVIDENCE', 'Evidence packets feed a deterministic merge that preserves provenance, revisions, claims, uncertainty, and conflicts.');
  }
  let codeId = null;
  if (designCode) {
    const designEvidence = mergeId ?? branchIds.at(-1) ?? ownerId;
    codeId = add({ nodeId: 'task-code', role: 'SPECIALIST', capabilityId: 'skill.code', branch: 'implementation-task', dependsOn: [designEvidence], maxTokens: 650, riskClass: 'medium', authorityReads: ['git'], authorityWrites: ['repository'] });
    addDependency(edges, dependencies, designEvidence, codeId, 'EVIDENCE', 'Design evidence is an input to the bounded Code task.');
  }
  const policyGateRefs = requiredGateRefs(text, primary.capabilityId, riskClass);
  const packetGateRefs = {
    quality: (taskPacket.requiredQualityGates ?? []).map((gate) => gate.gateRef),
    safety: (taskPacket.requiredSafetyGates ?? []).map((gate) => gate.gateRef)
  };
  // Task-packet gates are the routed policy contract. The local graph policy
  // may add an applicable domain gate, but it cannot drop a declared gate.
  const gateRefs = {
    quality: unique([...packetGateRefs.quality, ...policyGateRefs.quality]),
    safety: unique([...packetGateRefs.safety, ...policyGateRefs.safety])
  };
  if (designCode) gateRefs.quality = unique(['gate.design-review', 'gate.visual-qa', 'gate.review', 'gate.qa', ...(RESEARCH_WORDS.test(text) ? ['gate.source-provenance', 'gate.citation-completeness'] : [])]);
  const gateIds = [];
  const implementationTail = codeId ?? mergeId ?? branchIds.at(-1) ?? ownerId;
  for (const [gateIndex, gateRef] of gateRefs.quality.entries()) {
    let gateInput = implementationTail;
    if (designCode) {
      if (gateRef === 'gate.design-review') gateInput = mergeId ?? branchIds.at(-1) ?? ownerId;
      if (gateRef === 'gate.visual-qa') gateInput = codeId;
      if (gateRef === 'gate.review') gateInput = `gate-${id('gate.visual-qa')}`;
      if (gateRef === 'gate.qa') gateInput = `gate-${id('gate.review')}`;
    }
    const gateId = add({ nodeId: `gate-${id(gateRef)}`, role: 'QUALITY_GATE', capabilityId: gateCapability(gateRef), dependsOn: [gateInput], maxTokens: 300, riskClass: 'read-only', authorityReads: ['evidence_packet'], failureBehavior: 'GATE_FAILED: block dependent nodes and preserve the failed gate evidence.' });
    gateIds.push(gateId);
    addDependency(edges, dependencies, gateInput, gateId, 'GATE', `Required ${gateRef} gate cannot be bypassed.`);
  }
  for (let i = 1; i < gateIds.length; i += 1) {
    const previous = gateIds[i - 1];
    const current = gateIds[i];
    const priorRef = gateRefs.quality[i - 1];
    const currentRef = gateRefs.quality[i];
    if ((priorRef === 'gate.review' && currentRef === 'gate.qa') || (priorRef === 'gate.source-provenance' && currentRef === 'gate.citation-completeness')) addDependency(edges, dependencies, previous, current, 'GATE', `${priorRef} must pass before ${currentRef}.`);
  }
  if (designCode) addDependency(edges, dependencies, `gate-${id('gate.design-review')}`, codeId, 'GATE', 'Design evidence must pass its design review before the Code task begins.');
  let safetyTail = gateIds.at(-1) ?? implementationTail;
  if (isMutationRoute(text, riskClass)) {
    const carefulId = add({ nodeId: 'gate-careful', role: 'SAFETY_GATE', capabilityId: 'skill.careful', dependsOn: [safetyTail], maxTokens: 450, riskClass: 'read-only', authorityReads: ['brain', 'git'], failureBehavior: 'BLOCK_GRAPH: careful preflight must pass before confirmation.', confirmationRequired: true });
    addDependency(edges, dependencies, safetyTail, carefulId, 'GATE', 'Careful preflight is required before any high-risk mutation path.');
    const rollbackId = add({ nodeId: 'gate-rollback', role: 'SAFETY_GATE', capabilityId: 'gate.rollback', dependsOn: [carefulId], maxTokens: 300, riskClass: 'read-only', authorityReads: ['brain'], failureBehavior: 'BLOCK_GRAPH: no rollback evidence means no execution.', confirmationRequired: true });
    addDependency(edges, dependencies, carefulId, rollbackId, 'GATE', 'Rollback evidence precedes confirmation.');
    const confirmationId = add({ nodeId: 'gate-confirmation', role: 'SAFETY_GATE', capabilityId: 'gate.confirmation', dependsOn: [rollbackId], maxTokens: 300, riskClass: 'read-only', authorityReads: ['brain'], failureBehavior: 'CONFIRMATION_REQUIRED: remain not execution-ready until explicit confirmation.', confirmationRequired: true });
    addDependency(edges, dependencies, rollbackId, confirmationId, 'CONFIRMATION', 'Explicit confirmation is required after careful and rollback gates.');
    const executionId = add({ nodeId: 'execution-shadow', role: 'EXECUTION', capabilityId: primary.capabilityId, dependsOn: [confirmationId], maxTokens: 300, riskClass, authorityReads: ['git', 'brain'], authorityWrites: ['external_state', 'repository'], failureBehavior: 'CONFIRMATION_REQUIRED: execution is represented but disabled in shadow mode.', confirmationRequired: true, executionReady: false, status: 'BLOCKED' });
    addDependency(edges, dependencies, confirmationId, executionId, 'CONFIRMATION', 'Mutation execution may only follow a satisfied confirmation gate; this shadow graph never satisfies it.');
    safetyTail = executionId;
  }
  const synthesisInputs = unique([...(evidencePackets ?? []).map((item) => item.evidenceId), ...nodes.filter((item) => ['SPECIALIST', 'MERGE', 'QUALITY_GATE', 'SAFETY_GATE'].includes(item.role)).map((item) => item.nodeId)]);
  const synthesisId = add({ nodeId: 'synthesis', role: 'SYNTHESIS', capabilityId: 'adapter.context-broker', dependsOn: [safetyTail], maxTokens: 600, phase: 'SYNTHESIS', authorityReads: ['evidence_packet', 'task_packet'], failureBehavior: 'CONTEXT_CONFLICT: preserve conflicts and request further bounded evidence.', status: 'PLANNED' });
  addDependency(edges, dependencies, safetyTail, synthesisId, 'EVIDENCE', 'Selected Evidence Packets, criteria, gate results, conflicts, and uncertainty feed synthesis.');
  const continuationId = add({ nodeId: 'continuation', role: 'CONTINUATION', capabilityId: 'workflow.universal-brain-entry', dependsOn: [synthesisId], maxTokens: 250, phase: 'CONTINUATION', authorityReads: ['task_packet', 'session_continuity'], failureBehavior: 'SOURCE_CHANGED: stale or conflicted continuation blocks resume.' });
  addDependency(edges, dependencies, synthesisId, continuationId, 'DEPENDENCY', 'Continuation stores compact references and never auto-resumes.');
  const parallelCandidates = [];
  if (researchMergeNeeded) parallelCandidates.push(...branchIds.filter((item) => item.startsWith('specialist-market') || item.startsWith('specialist-competitors') || item.startsWith('specialist-demand') || item.startsWith('specialist-primary-source')));
  if (primary.capabilityId === 'skill.code' && branchIds.some((item) => item.startsWith('specialist-root-cause'))) parallelCandidates.push(...branchIds.filter((item) => item.startsWith('specialist-root-cause')));
  if (primary.capabilityId === 'skill.code') parallelCandidates.push(...branchIds.filter((item) => item.startsWith('specialist-bounded-')));
  const parallelGroups = parallelCandidates.length > 1 ? [{ groupId: 'parallel-independent-evidence', nodeIds: parallelCandidates, eligibility: 'ELIGIBLE', reason: 'Branches are read-only, have independent inputs, bounded context, explicit failure behavior, and a deterministic merge policy.', mergeNodeId: mergeId }] : [];
  const failureEdges = [];
  for (const item of nodes) {
    if (item.role === 'PRIMARY_OWNER' || item.role === 'SPECIALIST' || item.role === 'CONTEXT_ACQUISITION') {
      failureEdges.push({ from: item.nodeId, to: synthesisId, outcome: 'SKIP_DEPENDENTS', semantics: 'Failed node is never treated as success; dependent synthesis sees the failure while independent branches may continue.' });
    }
  }
  const graph = {
    schemaVersion: COMPOSITION_GRAPH_SCHEMA_VERSION, graphId: id(`graph-${stableJsonHash({ taskId: taskPacket.taskId, source, text }).slice(0, 20)}`), taskId: taskPacket.taskId, sourceRevision: source,
    primaryOwner: { capabilityId: primary.capabilityId, sourceRef: primary.sourceRef, sourceRevision: primary.sourceRevision }, nodes, edges, dependencies, parallelGroups, mergeNodes: mergeId ? [mergeId] : [], qualityGateNodes: gateIds, safetyGateNodes: nodes.filter((item) => item.role === 'SAFETY_GATE').map((item) => item.nodeId), terminalNode: continuationId, failureEdges,
    continuationRef: ref('continuation', `continuation://${taskPacket.taskId}`, source), bounds: { ...DEFAULT_GRAPH_BOUNDS, ...bounds },
    execution: { mode: 'shadow', providerCalls: 0, externalMutations: 0, mindWrites: 0, profileActivations: 0, clientConfigChanges: 0, automaticResumeAllowed: false, executionReady: false },
    metadata: { ownerRationale: primary.rationale, selectedEvidenceRefs: synthesisInputs, selectedContextPolicy: 'references_only_reload_on_demand', forgeSelection: 'never_auto_select', orchestratePolicy: 'internal_bounded_policy_only' }
  };
  // Graph control nodes add composition structure, but every node still points
  // at an already planned Phase 3 atomic subtask; the graph never embeds a skill body.
  const packetNodes = taskPacket.plan?.nodes ?? [];
  const usedPacketNodes = new Set();
  for (const graphNode of graph.nodes) {
    const sameCapability = packetNodes.filter((item) => item.ownerCapabilityRef?.capabilityId === graphNode.capabilityRef.capabilityId);
    const match = sameCapability.find((item) => !usedPacketNodes.has(item.nodeId)) ?? sameCapability[0] ?? packetNodes.find((item) => !usedPacketNodes.has(item.nodeId)) ?? packetNodes[0];
    if (match) {
      usedPacketNodes.add(match.nodeId);
      graphNode.taskRef = taskRef(taskPacket.taskId, match.nodeId, source);
    }
  }
  return graph;
}

function graphNodes(graph) { return new Map((graph?.nodes ?? []).map((item) => [item.nodeId, item])); }
function topologicalDepths(graph) {
  const nodes = graphNodes(graph); const depths = new Map();
  const visit = (nodeId, stack = new Set()) => {
    if (depths.has(nodeId)) return depths.get(nodeId);
    if (stack.has(nodeId)) return Infinity;
    const deps = (graph.dependencies ?? []).filter((item) => item.to === nodeId).map((item) => item.from);
    const depth = deps.length ? 1 + Math.max(...deps.map((dep) => visit(dep, new Set([...stack, nodeId])))) : 1;
    depths.set(nodeId, depth); return depth;
  };
  for (const nodeId of nodes.keys()) visit(nodeId);
  return depths;
}

export function validateCompositionGraph(graph, { taskPacket = null, catalog = createCapabilityCatalog(), currentSourceRevision = graph?.sourceRevision } = {}) {
  const errors = validateJsonSchema(graphSchema, graph);
  const nodes = graphNodes(graph); const ids = new Set(nodes.keys());
  const ownerNodes = (graph?.nodes ?? []).filter((item) => item.role === 'PRIMARY_OWNER');
  if (ownerNodes.length !== 1) errors.push(`primary owner count ${ownerNodes.length}; expected exactly one`);
  if (!graph?.primaryOwner?.capabilityId) errors.push('missing primary owner reference');
  else if (!descriptor(catalog, graph.primaryOwner.capabilityId)) errors.push(`unknown primary owner capability: ${graph.primaryOwner.capabilityId}`);
  if (graph?.primaryOwner?.sourceRevision !== descriptor(catalog, graph.primaryOwner.capabilityId)?.sourceRevision) errors.push('primary owner source revision mismatch');
  if (graph?.sourceRevision !== currentSourceRevision) errors.push('SOURCE_CHANGED: graph source revision is stale');
  const packetNodeIds = new Set((taskPacket?.plan?.nodes ?? []).map((item) => item.nodeId));
  for (const item of graph?.nodes ?? []) {
    if (!GRAPH_ROLES.includes(item.role)) errors.push(`unknown node role: ${item.role}`);
    if (!item.taskRef?.taskId || !item.taskRef?.subtaskId || !item.taskRef?.packetRef) errors.push(`missing task reference: ${item.nodeId}`);
    if (taskPacket && item.taskRef?.taskId !== taskPacket.taskId) errors.push(`task reference mismatch: ${item.nodeId}`);
    if (taskPacket && !packetNodeIds.has(item.taskRef?.subtaskId)) errors.push(`node does not reference an existing atomic Phase 3 subtask: ${item.nodeId}`);
    const known = descriptor(catalog, item.capabilityRef?.capabilityId);
    if (!known) errors.push(`unknown capability: ${item.capabilityRef?.capabilityId}`);
    else if (known.sourceRevision !== item.capabilityRef.sourceRevision) errors.push(`capability source revision mismatch: ${item.nodeId}`);
    if (item.taskRef?.sourceRevision !== graph.sourceRevision) errors.push(`task reference source revision mismatch: ${item.nodeId}`);
    if (!item.outputs?.length) errors.push(`missing output: ${item.nodeId}`);
    if (!item.failureBehavior) errors.push(`missing failure behavior: ${item.nodeId}`);
    if (item.contextLifetime?.rawContextLoaded !== 0) errors.push(`unbounded raw context: ${item.nodeId}`);
    if ((item.confirmationRequired || item.authorityWrites?.length) && item.role === 'EXECUTION' && item.executionReady) errors.push(`confirmation-required mutation execution-ready: ${item.nodeId}`);
  }
  for (const edge of graph?.edges ?? []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push(`unknown edge node: ${edge.edgeId}`);
    if (edge.from === edge.to) errors.push(`self dependency: ${edge.edgeId}`);
    if (!EDGE_TYPES.includes(edge.type)) errors.push(`unknown edge type: ${edge.edgeId}`);
  }
  for (const dependency of graph?.dependencies ?? []) {
    if (!ids.has(dependency.from) || !ids.has(dependency.to)) errors.push(`missing dependency node: ${dependency.from}->${dependency.to}`);
    if (!graph.edges.some((edge) => edge.from === dependency.from && edge.to === dependency.to)) errors.push(`implicit ordering without edge: ${dependency.from}->${dependency.to}`);
  }
  const depths = topologicalDepths(graph);
  if ([...depths.values()].some((item) => !Number.isFinite(item))) errors.push('cycle detected');
  if ([...depths.values()].some((item) => item > graph.bounds.maxDepth)) errors.push('graph depth exceeds limit');
  if (graph.nodes.length > graph.bounds.maxNodes) errors.push('node count exceeds limit');
  const specialistCount = graph.nodes.filter((item) => ['SPECIALIST', 'CONTEXT_ACQUISITION'].includes(item.role)).length;
  if (specialistCount > graph.bounds.maxSpecialistsPerPhase) errors.push('specialist count exceeds limit');
  for (const group of graph.parallelGroups ?? []) {
    if (group.nodeIds.length > graph.bounds.maxParallelWidth) errors.push(`parallel width exceeds limit: ${group.groupId}`);
    const groupNodes = group.nodeIds.map((item) => nodes.get(item)).filter(Boolean);
    if (groupNodes.some((item) => item.authorityWrites.length || item.confirmationRequired || ['high', 'critical'].includes(item.riskClass))) errors.push(`unsafe parallel group: ${group.groupId}`);
    if (group.eligibility === 'ELIGIBLE' && !group.mergeNodeId) errors.push(`parallel group lacks merge policy: ${group.groupId}`);
    for (const left of groupNodes) for (const right of groupNodes) if (left !== right && left.authorityWrites.some((write) => right.authorityWrites.includes(write))) errors.push(`parallel mutation collision: ${group.groupId}`);
  }
  for (const mergeId of graph.mergeNodes ?? []) {
    const merge = nodes.get(mergeId);
    if (!merge?.mergePolicy || !/preserve.*conflict|conflict.*preserve/i.test(merge.mergePolicy)) errors.push(`merge without conflict policy: ${mergeId}`);
    const fanIn = (graph.edges ?? []).filter((edge) => edge.to === mergeId).length;
    if (fanIn > graph.bounds.maxMergeFanIn) errors.push(`merge fan-in exceeds limit: ${mergeId}`);
  }
  for (const gateId of graph.qualityGateNodes ?? []) if (!nodes.get(gateId)?.role || nodes.get(gateId).role !== 'QUALITY_GATE') errors.push(`invalid quality gate node: ${gateId}`);
  for (const gateId of graph.safetyGateNodes ?? []) if (!nodes.get(gateId)?.role || nodes.get(gateId).role !== 'SAFETY_GATE') errors.push(`invalid safety gate node: ${gateId}`);
  const text = textOf(null, taskPacket);
  const required = requiredGateRefs(text, graph.primaryOwner?.capabilityId, graph.nodes.some((item) => item.riskClass === 'critical' || item.riskClass === 'high') ? 'high' : 'medium');
  const caps = new Set(graph.nodes.map((item) => item.capabilityRef.capabilityId));
  for (const gate of required.quality) if (!graph.nodes.some((item) => item.capabilityRef.capabilityId === gate)) errors.push(`missing required gate: ${gate}`);
  for (const gate of required.safety) if (!graph.nodes.some((item) => item.capabilityRef.capabilityId === gate)) errors.push(`missing required safety gate: ${gate}`);
  const hasPath = (fromCapability, toCapability) => {
    const starts = graph.nodes.filter((item) => item.capabilityRef.capabilityId === fromCapability).map((item) => item.nodeId);
    const targets = new Set(graph.nodes.filter((item) => item.capabilityRef.capabilityId === toCapability).map((item) => item.nodeId));
    const seen = new Set(starts); const queue = [...starts];
    while (queue.length) { const current = queue.shift(); if (targets.has(current)) return true; for (const edge of graph.edges) if (edge.from === current && !seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); } }
    return false;
  };
  if (graph.nodes.some((item) => item.capabilityRef.capabilityId === 'skill.code') && isMeaningfulCode(text)) {
    if (!hasPath('gate.review', 'gate.qa')) errors.push('required gate ordering missing: review must precede QA');
  }
  if (graph.nodes.some((item) => item.capabilityRef.capabilityId === 'skill.design') && graph.nodes.some((item) => item.capabilityRef.capabilityId === 'skill.code') && isMeaningfulCode(text)) {
    if (!hasPath('gate.design-review', 'skill.code')) errors.push('required gate ordering missing: design evidence must precede Code');
    if (!hasPath('skill.code', 'gate.visual-qa')) errors.push('required gate ordering missing: Code must precede visual QA');
  }
  if (graph.nodes.some((item) => item.capabilityRef.capabilityId === 'skill.research') && RESEARCH_WORDS.test(text)) {
    if (!hasPath('gate.source-provenance', 'gate.citation-completeness')) errors.push('required gate ordering missing: source gate must precede citation gate');
  }
  if (graph.safetyGateNodes.length > 0) {
    if (!hasPath('skill.careful', 'gate.confirmation')) errors.push('required safety ordering missing: Careful must precede confirmation');
    if (graph.nodes.some((item) => item.role === 'EXECUTION') && !graph.edges.some((edge) => edge.from === 'gate-confirmation' && edge.to === 'execution-shadow')) errors.push('required safety ordering missing: confirmation must precede execution');
  }
  if (caps.has('forge') || caps.has('skill.forge')) errors.push('forge must not be auto-selected by composition');
  if (graph.execution?.automaticResumeAllowed !== false || graph.execution?.executionReady !== false) errors.push('unsafe execution or auto-resume flag');
  return [...new Set(errors)];
}

export function assessParallelEligibility(graph, nodeIds) {
  const nodes = graphNodes(graph); const selected = nodeIds.map((item) => nodes.get(item)).filter(Boolean);
  const reasons = [];
  if (selected.length !== nodeIds.length) reasons.push('unknown node');
  if (selected.length < 2) reasons.push('parallelism requires at least two nodes');
  if (selected.some((item) => item.authorityWrites.length)) reasons.push('authority mutation is not parallel-safe');
  if (selected.some((item) => item.confirmationRequired || ['high', 'critical'].includes(item.riskClass))) reasons.push('confirmation or high risk blocks parallelism');
  if (selected.some((item) => item.contextLifetime.rawContextLoaded !== 0)) reasons.push('unbounded context');
  const selectedSet = new Set(nodeIds);
  for (const dep of graph.dependencies ?? []) if (selectedSet.has(dep.from) && selectedSet.has(dep.to)) reasons.push('nodes have an unresolved dependency');
  if (!graph.mergeNodes?.length) reasons.push('no deterministic merge node');
  return { eligible: reasons.length === 0, reasons, nodeIds: [...nodeIds] };
}

export function buildParallelGroups(graph) {
  return (graph.parallelGroups ?? []).map((group) => ({ ...group, ...assessParallelEligibility(graph, group.nodeIds), eligibility: assessParallelEligibility(graph, group.nodeIds).eligible ? 'ELIGIBLE' : 'INELIGIBLE' }));
}

function packetRevision(packet) { return packet?.sourceRevision ?? packet?.producerCapability?.sourceRevision ?? 'unknown'; }
function claimKey(claim) { return String(claim?.claimId ?? claim?.statement ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); }

export function mergeEvidencePackets({ taskId, packets = [], mergeNodeId = 'merge-evidence', sourceRevision: expectedRevision = null } = {}) {
  const sourceRevisions = unique(packets.map(packetRevision));
  const conflicts = [];
  if (expectedRevision && sourceRevisions.some((item) => item !== expectedRevision)) conflicts.push({ summary: 'Source revision mismatch makes merged evidence stale/conflicted.', sourceRefs: packets.map((item) => ref('evidence', `evidence://${item.evidenceId}`, packetRevision(item))), resolutionState: 'BLOCKING' });
  const claims = packets.flatMap((item) => (item.claims ?? []).map((claim) => ({ ...clone(claim), sourcePacketId: item.evidenceId })));
  const byKey = new Map();
  for (const claim of claims) { const key = claimKey(claim); if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(claim); }
  for (const [key, candidates] of byKey) if (candidates.length > 1 && new Set(candidates.map((item) => item.statement)).size > 1) conflicts.push({ summary: `Contradictory claims retained for ${key}.`, sourceRefs: candidates.flatMap((item) => item.sourceRefs ?? []).slice(0, 8), resolutionState: 'OPEN' });
  const failures = packets.filter((item) => ['FAILED', 'BLOCKED', 'CONFLICTED', 'INCOMPLETE', 'PARTIAL'].includes(item.status)).map((item) => ({ evidenceId: item.evidenceId, status: item.status, uncertainties: item.uncertainties ?? [] }));
  return { schemaVersion: COMPOSITION_GRAPH_SCHEMA_VERSION, mergeId: id(`${taskId}-${mergeNodeId}`), taskId, mergeNodeId, sourceRevisions, provenance: packets.map((item) => ({ evidenceId: item.evidenceId, subtaskId: item.subtaskId, producer: item.producerCapability, sourceRevision: packetRevision(item) })), claims, uncertainties: packets.flatMap((item) => item.uncertainties ?? []), conflicts, validationRefs: packets.flatMap((item) => item.validationRefs ?? []), failureReceipts: failures, status: conflicts.length ? 'CONFLICTED' : failures.length ? 'PARTIAL' : 'MERGED', outcome: conflicts.length ? 'CONTEXT_CONFLICT' : failures.length ? 'DEGRADE_WITH_WARNING' : 'CONTINUE_INDEPENDENT', preservedPacketIds: packets.map((item) => item.evidenceId), blindConcatenation: false };
}

export function propagateNodeFailure(graph, nodeId, outcome = 'BLOCK_GRAPH') {
  if (!FAILURE_OUTCOMES.includes(outcome)) throw new Error(`unknown failure outcome: ${outcome}`);
  const dependentIds = new Set(); const queue = [nodeId];
  while (queue.length) { const current = queue.shift(); for (const edge of graph.dependencies ?? []) if (edge.from === current && !dependentIds.has(edge.to)) { dependentIds.add(edge.to); queue.push(edge.to); } }
  const independent = graph.nodes.filter((item) => !dependentIds.has(item.nodeId) && item.nodeId !== nodeId).map((item) => item.nodeId);
  return { failedNodeId: nodeId, outcome, failed: [nodeId], skippedDependents: [...dependentIds], continuingIndependent: outcome === 'CONTINUE_INDEPENDENT' ? independent : [], silentSuccess: false, nextAction: outcome === 'CONFIRMATION_REQUIRED' ? 'Obtain explicit confirmation before any mutation.' : 'Preserve the failure receipt and resolve or qualify the blocked dependency.' };
}

export function buildSynthesisPacket({ graph, evidencePackets = [], mergedEvidence = null, successCriteria = [], gateResults = [], decisions = [] } = {}) {
  const conflicts = mergedEvidence?.conflicts ?? evidencePackets.flatMap((item) => item.conflicts ?? []);
  const uncertainties = unique([...(mergedEvidence?.uncertainties ?? []), ...evidencePackets.flatMap((item) => item.uncertainties ?? [])]);
  const failedGates = gateResults.filter((item) => item.status === 'FAIL');
  const blocked = conflicts.some((item) => item.resolutionState === 'BLOCKING') || failedGates.some((item) => item.blocking);
  return { schemaVersion: COMPOSITION_GRAPH_SCHEMA_VERSION, synthesisId: id(`synthesis-${graph.taskId}`), taskId: graph.taskId, inputEvidenceRefs: unique([...(mergedEvidence?.preservedPacketIds ?? []), ...evidencePackets.map((item) => item.evidenceId)]), successCriteria, gateResults, conflicts, uncertainties, decisions, contextLifetime: { phase: 'SYNTHESIS', maxTokens: 1000, rawContextLoaded: 0, rawGraphContextLoaded: 0 }, status: blocked ? 'BLOCKED' : 'READY', nextAction: blocked ? 'Resolve the surfaced conflict or failed blocking gate with one bounded evidence or qualification node.' : 'Synthesize only the selected Evidence Packets and record the next bounded continuation.', rawGraphContextIncluded: false };
}

export function validateContinuationRef(graph, { currentSourceRevision = graph?.sourceRevision, contextState = 'CURRENT', explicitResume = false } = {}) {
  const errors = [];
  if (!graph?.continuationRef?.value) errors.push('invalid continuation');
  if (graph?.continuationRef?.sourceRevision !== currentSourceRevision) errors.push('SOURCE_CHANGED: continuation source revision is stale');
  if (contextState !== 'CURRENT') errors.push(`context state ${contextState} blocks continuation`);
  if (!explicitResume) errors.push('automatic resume is forbidden; explicit continuation is required');
  return errors;
}

export function composeShadowRequest(input, { catalog = createCapabilityCatalog(), repoRoot: root = repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z', bounds = DEFAULT_GRAPH_BOUNDS } = {}) {
  const packetPlan = planShadowPacket(input, { catalog, repoRoot: root, currentState, generatedAt });
  const graph = buildCompositionGraph({ taskPacket: packetPlan.taskPacket, evidencePackets: packetPlan.evidencePackets, route: packetPlan.route, normalized: packetPlan.route.normalizedRequest, catalog, bounds });
  const graphErrors = validateCompositionGraph(graph, { taskPacket: packetPlan.taskPacket, catalog, currentSourceRevision: graph.sourceRevision });
  const mergedEvidence = graph.mergeNodes.length ? mergeEvidencePackets({ taskId: graph.taskId, packets: packetPlan.evidencePackets, mergeNodeId: graph.mergeNodes[0], sourceRevision: graph.sourceRevision }) : null;
  const synthesis = buildSynthesisPacket({ graph, evidencePackets: packetPlan.evidencePackets, mergedEvidence, successCriteria: packetPlan.route.normalizedRequest.outputExpectations ?? [], gateResults: graph.qualityGateNodes.concat(graph.safetyGateNodes).map((nodeId) => ({ gateRef: graphNodes(graph).get(nodeId)?.capabilityRef.capabilityId, status: 'NOT_RUN', blocking: true, evidenceRefs: [], reason: 'Shadow graph declaration; no gate executed.' })) });
  const normalizedText = packetPlan.route.normalizedRequest.normalizedText;
  const materialRiskQuestion = packetPlan.route.primaryRouteFamily !== 'web'
    && ['high', 'critical'].includes(packetPlan.route.normalizedRequest.riskClass)
    && /\b(this|old|production|the)\b/i.test(normalizedText);
  const qaTargetQuestion = graph.primaryOwner.capabilityId === 'skill.qa' && !/\b(on|against|the|this)\s+[a-z0-9]/i.test(normalizedText);
  const combinedBuildVerificationQuestion = packetPlan.route.primaryRouteFamily === 'code'
    && /\b(build|create|implement)\b.*\b(test|verify)\b/i.test(normalizedText)
    && !/\b(this|the|my|repo|repository)\b/i.test(normalizedText);
  const memoryPayloadQuestion = graph.primaryOwner.capabilityId === 'skill.memory' && /\bremember this\b/i.test(normalizedText);
  const inferableSafeQualification = packetPlan.route.qualification.required && /\b(authentication|auth|market demand|demand for this product|primary sources?|greek phrase|continue building|map the architecture|safe code analysis)\b/i.test(normalizedText) && !materialRiskQuestion;
  const qualification = (packetPlan.route.qualification.required && !inferableSafeQualification) || materialRiskQuestion || qaTargetQuestion || combinedBuildVerificationQuestion || memoryPayloadQuestion ? { required: true, question: packetPlan.route.qualification.question ?? (memoryPayloadQuestion ? 'What exact decision or fact should I remember, and should it be durable? Why: the memory payload and authority are material.' : 'What exact target and safe outcome should I use? Why: the target is material to a bounded or safe plan.'), count: 1 } : { required: false, question: null, reason: inferableSafeQualification ? 'The target is inferable and the next step is bounded, read-only, or locally reversible.' : packetPlan.route.qualification.reason };
  graph.metadata.qualificationRequired = qualification.required;
  return { operation: 'shadow_composition_plan', executionExposed: false, providerCalls: 0, externalMutations: 0, mindWrites: 0, profileActivations: 0, clientConfigChanges: 0, automaticResumeAllowed: false, route: packetPlan.route, qualification, taskPacket: packetPlan.taskPacket, evidencePackets: packetPlan.evidencePackets, selectedInstructionInspection: packetPlan.selectedInstructionInspection, budget: packetPlan.budget, graph, mergedEvidence, synthesis, validation: { phase3: packetPlan.validation, graphErrors, valid: packetPlan.validation.valid && graphErrors.length === 0 }, parallelGroups: buildParallelGroups(graph), continuity: { ref: graph.continuationRef, errors: validateContinuationRef(graph, { currentSourceRevision: graph.sourceRevision, contextState: packetPlan.continuity.state, explicitResume: false }) }, metrics: compositionMetrics({ graph, packetPlan, synthesis }) };
}

export function compositionMetrics({ graph, packetPlan = null, synthesis = null } = {}) {
  const groupLoads = (graph.parallelGroups ?? []).filter((item) => item.eligibility === 'ELIGIBLE').map((group) => group.nodeIds.map((nodeId) => graphNodes(graph).get(nodeId)?.contextBudget ?? 0).reduce((sum, item) => sum + item, 0));
  return { descriptorCandidates: packetPlan?.route?.candidateDescriptorIds?.length ?? 0, selectedCapabilities: packetPlan?.taskPacket?.selectedCapabilityRefs?.length ?? 0, fullBodies: packetPlan?.selectedInstructionInspection?.fullInstructionReads?.length ?? 0, contextPacks: graph.nodes.length, taskPacketTokens: packetPlan?.budget?.taskPacketTokens ?? 0, evidencePacketTokens: packetPlan?.budget?.evidencePacketTokens ?? [], maxSimultaneousActiveContext: Math.max(0, ...groupLoads, ...graph.nodes.map((item) => item.contextBudget)), totalReferencedContext: graph.nodes.reduce((sum, item) => sum + item.contextBudget, 0), synthesisInputTokens: synthesis ? Math.ceil(JSON.stringify(synthesis).length / 4) : 0, parallelBranchCount: (graph.parallelGroups ?? []).filter((item) => item.eligibility === 'ELIGIBLE').reduce((sum, item) => sum + item.nodeIds.length, 0), unrelatedBodies: 0, rawEvidenceLoaded: 0 };
}

export function getCompositionGraphSchema() { return clone(graphSchema); }
