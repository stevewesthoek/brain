import fs from 'node:fs';
import process from 'node:process';

const WORKFLOW_ID = 'FwP5INe9qoo1OwGC';
const DEFAULT_CANDIDATE = 'operations/automations/n8n/workflows/mind-inbox-fixed.json';
const DEFAULT_MANIFEST = 'operations/automations/n8n/save-to-mind-topology-migration.json';
const ALLOWED_CODE_NODE_ID = 'build-processed-note';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertWorkflowId(workflow, label) {
  if (workflow?.id !== WORKFLOW_ID) {
    fail(`${label} workflow id must be ${WORKFLOW_ID}`);
  }
}

function readCandidateState() {
  const manifest = readJson(DEFAULT_MANIFEST, 'topology migration manifest');
  const state = manifest?.candidateState;
  const expected = {
    repositoryCandidate: true,
    deploymentPlanned: 'conditional',
    deployed: 'unverified',
    observedCanonicalSuccessRouting: 'stored-rollback-partial-evidence',
    observedCanonicalFailureRouting: 'unverified',
    activation: 'not_asserted',
    schedule: 'not_asserted',
    liveVersion: 'not_asserted',
    verified: false,
    paused: true,
    retired: false,
    b1_0a: 'incomplete',
  };
  if (!state || Object.entries(expected).some(([key, value]) => state[key] !== value)) {
    fail('topology manifest candidate state is incomplete or unsafe');
  }
  return state;
}

function printCandidateState(state) {
  console.log('repository_candidate=true');
  console.log(`deployment_planned=${state.deploymentPlanned}`);
  console.log(`deployed=${state.deployed}`);
  console.log(`observed_canonical_success_routing=${state.observedCanonicalSuccessRouting}`);
  console.log(`observed_canonical_failure_routing=${state.observedCanonicalFailureRouting}`);
  console.log(`activation_state=${state.activation}`);
  console.log(`schedule_state=${state.schedule}`);
  console.log(`live_version=${state.liveVersion}`);
  console.log(`verified=${state.verified}`);
  console.log(`paused=${state.paused}`);
  console.log(`retired=${state.retired}`);
  console.log(`b1_0a=${state.b1_0a}`);
}

function assertCanonicalPaths(workflow, label) {
  const raw = JSON.stringify(workflow);
  for (const token of ['inbox/new', 'inbox/failed']) {
    if (!raw.includes(token)) fail(`${label} is missing ${token}`);
  }
  for (const token of ['capture/inbox', 'capture/failed']) {
    if (raw.includes(token)) fail(`${label} contains retired path ${token}`);
  }
}

function nodeMap(nodes) {
  return new Map((nodes ?? []).map((node) => [node.id, node]));
}

function assertNodeBoundary(candidateNodes, rollbackNodes, label) {
  const candidate = nodeMap(candidateNodes);
  const rollback = nodeMap(rollbackNodes);
  if (candidate.size !== rollback.size) fail(`${label} node count changed`);

  for (const [id, rollbackNode] of rollback) {
    const candidateNode = candidate.get(id);
    if (!candidateNode) fail(`${label} removed node ${id}`);
    if (candidateNode.type !== rollbackNode.type || candidateNode.name !== rollbackNode.name) {
      fail(`${label} changed node identity ${id}`);
    }
    if (id !== ALLOWED_CODE_NODE_ID && JSON.stringify(candidateNode) !== JSON.stringify(rollbackNode)) {
      fail(`${label} changed unrelated node ${id}`);
    }
  }
}

function assertDeployBoundary(candidate, rollback, state) {
  assertWorkflowId(candidate, 'candidate');
  assertWorkflowId(rollback, 'rollback');
  assertCanonicalPaths(candidate, 'candidate');

  if (candidate.active !== false || state.paused !== true) fail('candidate activation must remain paused');
  if (rollback.active !== true) fail('rollback activation evidence must remain true');
  if (candidate.name !== rollback.name) fail('workflow name changed');
  if (JSON.stringify(candidate.tags ?? []) !== JSON.stringify(rollback.tags ?? [])) fail('workflow tags changed');
  if (JSON.stringify(candidate.settings ?? {}) !== JSON.stringify(rollback.settings ?? {})) fail('workflow settings changed');
  if (JSON.stringify(candidate.staticData ?? null) !== JSON.stringify(rollback.staticData ?? null)) fail('workflow staticData changed');
  if (JSON.stringify(candidate.shared ?? []) !== JSON.stringify(rollback.shared ?? [])) fail('workflow sharing changed');
  if (JSON.stringify(candidate.credentials ?? null) !== JSON.stringify(rollback.credentials ?? null)) fail('workflow credentials changed');

  assertNodeBoundary(candidate.nodes, rollback.nodes, 'workflow');
  assertNodeBoundary(candidate.activeVersion?.nodes, rollback.activeVersion?.nodes, 'activeVersion');
}

const [command, ...args] = process.argv.slice(2);
if (!command || !['status-plan', 'deploy-plan', 'rollback-plan'].includes(command)) {
  fail('usage: status-plan | deploy-plan <rollback.json> [candidate.json] | rollback-plan <rollback.json>');
}

if (command === 'status-plan') {
  const state = readCandidateState();
  console.log('mode=repository-candidate-plan');
  console.log(`workflow_id=${WORKFLOW_ID}`);
  printCandidateState(state);
  console.log('live_commands_emitted=false');
  console.log('approval_required_for_live_action=true');
  console.log('network_access=false');
  console.log('credentials_read=false');
  process.exit(0);
}

const rollbackPath = args[0];
if (!rollbackPath) fail('rollback artifact is required');
const rollback = readJson(rollbackPath, 'rollback artifact');
assertWorkflowId(rollback, 'rollback artifact');
const candidateState = readCandidateState();

if (command === 'rollback-plan') {
  console.log('mode=repository-candidate-plan');
  console.log(`workflow_id=${WORKFLOW_ID}`);
  printCandidateState(candidateState);
  console.log('live_commands_emitted=false');
  console.log('approval_required_for_live_action=true');
  console.log('network_access=false');
  console.log('credentials_read=false');
  process.exit(0);
}

const candidatePath = args[1] ?? DEFAULT_CANDIDATE;
const candidate = readJson(candidatePath, 'candidate workflow');
assertDeployBoundary(candidate, rollback, candidateState);

console.log('mode=repository-candidate-plan');
console.log(`workflow_id=${WORKFLOW_ID}`);
printCandidateState(candidateState);
console.log('change_boundary=repository-candidate-only');
console.log('live_commands_emitted=false');
console.log('approval_required_for_live_action=true');
console.log('network_access=false');
console.log('credentials_read=false');
