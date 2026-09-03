import crypto from 'node:crypto';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateEvidencePacket } from '../orchestration/task-evidence-packets.mjs';
import { evaluateFunctionalQa, evaluateVisualQa } from './visual-qa.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;
const VISUAL_CAPABILITIES = ['browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction'];

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24); }
function ref(refType, value, sourceRevision) { return { refId: `${refType}:${hash(value)}`, refType, value, sourceRevision }; }
function providerCapability(result, capabilityId) { return result.capabilitySelections.find((item) => item.capabilityId === capabilityId); }
function providerDescriptor(catalog) { return catalog.descriptors.find((item) => item.capabilityId === 'adapter.shared-visual-runtime'); }

function executionReceipt({ plan, execution, visualQa, functionalQa, provider, workspace, artifact }) {
  const shared = providerCapability(plan, 'browser.render');
  return {
    schemaVersion: '1.0.0',
    receiptId: `shared-capability-receipt:${hash({ requestHash: plan.receipt.requestHash, executionId: execution?.executionId ?? null })}`,
    brainRevision: plan.taskPacket.sourceRevision,
    consumer: plan.receipt.consumer,
    taskPacketRef: ref('task', `task://${plan.taskPacket.taskId}`, plan.taskPacket.sourceRevision),
    compositionGraphRef: ref('source', `graph://${plan.compositionGraph.graphId}`, plan.taskPacket.sourceRevision),
    requiredCapabilities: VISUAL_CAPABILITIES,
    resolution: { capabilityId: 'browser.render', outcome: shared?.outcome ?? 'UNAVAILABLE', resolution: shared?.resolution ?? 'UNAVAILABLE', providerId: shared?.providerId ?? null, providerRevision: shared?.providerRevision ?? null },
    provider: execution?.provider ?? { providerId: provider?.descriptor?.providerId ?? null, providerRevision: provider?.descriptor?.providerRevision ?? null, authority: 'brain' },
    workspace: { boundaryRef: ref('artifact', `workspace://${hash(workspace?.boundary ?? '')}`, plan.taskPacket.sourceRevision), artifactRef: ref('artifact', `artifact://${hash(artifact?.path ?? '')}`, plan.taskPacket.sourceRevision) },
    execution: { state: execution?.status ?? 'UNAVAILABLE', executionId: execution?.executionId ?? null, providerCalls: execution?.status === 'RENDERED' ? 1 : 0, writesPerformed: execution?.status === 'RENDERED' ? 1 : 0, externalMutations: 0, mindWrites: 0 },
    evidencePacketRef: execution?.evidencePacket ? ref('evidence', `evidence://${execution.evidencePacket.evidenceId}`, plan.taskPacket.sourceRevision) : null,
    gates: { visual: visualQa?.status ?? 'NOT_RUN', functional: functionalQa?.status ?? 'NOT_RUN' },
    sideEffects: { externalUploads: 0, secretsRead: 0, gitAuthorityChanged: false, mindWrites: 0 },
    outcome: execution?.status === 'RENDERED' && visualQa?.status === 'PASS' && functionalQa?.status === 'PASS' ? 'VALIDATED' : execution?.status === 'UNAVAILABLE' ? 'BLOCKED' : 'FAILED',
    failure: execution?.failure ?? null,
    rawPromptStored: false,
    transcriptCanonical: false,
    automaticResume: false
  };
}

function evidencePacket({ plan, execution, visualQa, functionalQa, catalog }) {
  const sourceRevision = plan.taskPacket.sourceRevision;
  const producer = providerDescriptor(catalog);
  const taskRef = ref('task', `task://${plan.taskPacket.taskId}`, sourceRevision);
  const artifactRef = ref('artifact', execution.artifact.ref, sourceRevision);
  const screenshotRef = ref('artifact', execution.screenshot.ref, sourceRevision);
  const visualRef = ref('validation', `visual-qa://${execution.executionId}`, sourceRevision);
  const functionalRef = ref('validation', `functional-qa://${execution.executionId}`, sourceRevision);
  const evidenceId = `evidence:shared-visual:${hash(execution.executionId)}`;
  return {
    schemaVersion: '1.0.0', evidenceId, taskId: plan.taskPacket.taskId, subtaskId: plan.taskPacket.plan.nodes.at(-1)?.nodeId ?? 'design-web',
    producerCapability: { capabilityId: producer.capabilityId, sourceRef: producer.sourceRef, sourceRevision: producer.sourceRevision },
    provider: { providerId: execution.provider.providerId, providerRevision: execution.provider.providerRevision, resolution: 'SHARED_BRAIN', authority: 'brain' },
    sourceRevision, inputRefs: [taskRef, artifactRef], outputRefs: [artifactRef], evidenceRefs: [screenshotRef], validationRefs: [visualRef, functionalRef],
    claims: [{ claimId: `claim:${hash(execution.executionId)}`, type: 'IMPLEMENTATION_RESULT', statement: 'The bounded local artifact was rendered, screenshot evidence was captured, and browser QA was evaluated by Brain.', sourceRefs: [taskRef, artifactRef], evidenceRefs: [screenshotRef], confidence: 1 }],
    uncertainties: [], conflicts: [],
    gateResults: [
      { gateRef: 'gate.visual-qa', status: visualQa.status, blocking: true, evidenceRefs: visualQa.evidenceRefs.map((value) => ref('artifact', value, sourceRevision)), reason: visualQa.reason },
      { gateRef: 'gate.qa', status: functionalQa.status, blocking: true, evidenceRefs: functionalQa.evidenceRefs.map((value) => ref('artifact', value, sourceRevision)), reason: functionalQa.reason }
    ],
    sideEffectsObserved: { declared: ['local_artifact_screenshot'], observed: ['local_artifact_screenshot'], evidenceRefs: [screenshotRef], noneObserved: false },
    continuationRefs: [plan.continuation ? ref('continuation', `continuation://${plan.continuation.continuationId}`, sourceRevision) : ref('continuation', `continuation://${plan.taskPacket.taskId}`, sourceRevision)],
    status: visualQa.status === 'PASS' && functionalQa.status === 'PASS' ? 'VALIDATED' : 'FAILED',
    execution: { mode: 'shared_capability', providerCalls: 1, writesPerformed: 1, mindWrites: 0, externalMutations: 0 }
  };
}

export async function executeSharedVisualTask({ adapter, provider, nativeInput, workspace, artifact, viewport, actions, route = '/', state = 'default', catalog = createCapabilityCatalog(), repoRoot: root = repoRoot, currentState = {}, generatedAt = '2026-09-02T00:00:00Z' } = {}) {
  const plan = adapter.consume(nativeInput, {}, { catalog, repoRoot: root, currentState, generatedAt, capabilityProviders: [provider] });
  const missing = VISUAL_CAPABILITIES.filter((capabilityId) => {
    const selection = providerCapability(plan, capabilityId);
    return !selection || !['SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE', 'SUPPORTED_VIA_SHARED_BRAIN'].includes(selection.outcome);
  });
  if (missing.length) {
    const receipt = executionReceipt({ plan, execution: { status: 'UNAVAILABLE', failure: `required_capabilities_unavailable:${missing.join(',')}` }, provider, workspace, artifact });
    return { plan, execution: null, visualQa: null, functionalQa: null, evidencePacket: null, receipt, missingCapabilities: missing };
  }
  let execution;
  try {
    execution = await provider.execute({ taskPacket: plan.taskPacket, workspace, artifact, viewport, actions, route, state });
  } catch (error) {
    execution = { status: 'FAILED', failure: error instanceof Error ? error.message : String(error), provider: provider.descriptor };
  }
  if (execution.status !== 'RENDERED') {
    const receipt = executionReceipt({ plan, execution, provider, workspace, artifact });
    return { plan, execution, visualQa: null, functionalQa: null, evidencePacket: null, receipt, missingCapabilities: [] };
  }
  const visualQa = evaluateVisualQa(execution);
  const functionalQa = evaluateFunctionalQa(execution);
  const packet = evidencePacket({ plan, execution, visualQa, functionalQa, catalog });
  const packetErrors = validateEvidencePacket(packet, { catalog, taskId: packet.taskId, subtaskId: packet.subtaskId });
  if (packetErrors.length) execution.packetErrors = packetErrors;
  const receipt = executionReceipt({ plan, execution: { ...execution, evidencePacket: packet }, visualQa, functionalQa, provider, workspace, artifact });
  return { plan, execution, visualQa, functionalQa, evidencePacket: packet, evidenceValidationErrors: packetErrors, receipt, missingCapabilities: [] };
}
