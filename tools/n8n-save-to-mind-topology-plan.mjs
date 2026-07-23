import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const WORKFLOW_ID = 'FwP5INe9qoo1OwGC';
const DEFAULT_CANDIDATE = 'operations/automations/n8n/workflows/mind-inbox-fixed.json';
const DEFAULT_MANIFEST = 'operations/automations/n8n/save-to-mind-topology-migration.json';

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

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function assertWorkflowId(workflow, label) {
  if (workflow?.id !== WORKFLOW_ID) fail(`${label} workflow id must be ${WORKFLOW_ID}`);
}

function nodeMap(workflow) {
  return new Map((workflow.nodes ?? []).map((node) => [node.id, node]));
}

function nodeNameToId(workflow) {
  return new Map((workflow.nodes ?? []).map((node) => [node.name, node.id]));
}

function edges(workflow) {
  const result = [];
  for (const [from, groups] of Object.entries(workflow.connections ?? {})) {
    for (const [kind, branches] of Object.entries(groups ?? {})) {
      for (const [branch, targets] of (branches ?? []).entries()) {
        for (const target of targets ?? []) {
          result.push({ from, to: target.node, kind, branch, toIndex: target.index });
        }
      }
    }
  }
  return result.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function assertCanonicalPaths(candidate) {
  const raw = JSON.stringify(candidate);
  for (const token of ['inbox/new', 'inbox/failed', 'MIND_INBOX_PATH', 'MIND_FAILED_PATH']) {
    if (!raw.includes(token)) fail(`candidate is missing ${token}`);
  }
  for (const token of ['capture/inbox', 'capture/failed']) {
    if (raw.includes(token)) fail(`candidate contains retired path ${token}`);
  }
}

function assertPreservedWorkflowFields(candidate, rollback, manifest) {
  const checks = [
    ['name', candidate.name, rollback.name],
    ['settings', candidate.settings ?? {}, rollback.settings ?? {}],
    ['tags', candidate.tags ?? [], rollback.tags ?? []],
    ['shared', candidate.shared ?? [], rollback.shared ?? []],
    ['credentials', candidate.credentials ?? null, rollback.credentials ?? null],
    ['staticData', candidate.staticData ?? null, rollback.staticData ?? null],
  ];
  for (const [label, candidateValue, rollbackValue] of checks) {
    if (!same(candidateValue, rollbackValue)) fail(`${label} changed outside the approved topology manifest`);
  }
  if (candidate.active !== false) fail('candidate activation must remain paused');
  if (rollback.active !== true) fail('rollback activation evidence must remain true');
  const preserve = manifest.preserve ?? {};
  if (preserve.active !== false || !Object.entries(preserve).filter(([key]) => key !== 'active').every(([, value]) => value === true)) {
    fail('manifest preserve contract must explicitly freeze activation and preserve every other protected boundary');
  }
}

function assertCandidateState(manifest) {
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
    fail('candidate state is incomplete or unsafe');
  }
}

function transitionIds(manifest, transition) {
  return manifest.nodes.filter((node) => node.transition === transition).map((node) => node.id).sort();
}

function assertNodeTransitions(candidate, rollback, manifest) {
  const candidateNodes = nodeMap(candidate);
  const rollbackNodes = nodeMap(rollback);
  const retained = transitionIds(manifest, 'retained');
  const removed = transitionIds(manifest, 'removed');
  const added = transitionIds(manifest, 'added');
  const expectedLive = [...retained, ...removed].sort();
  const expectedCandidate = [...retained, ...added].sort();

  if (!same([...rollbackNodes.keys()].sort(), expectedLive)) fail('rollback node set differs from manifest');
  if (!same([...candidateNodes.keys()].sort(), expectedCandidate)) fail('candidate node set differs from manifest');

  for (const entry of manifest.nodes) {
    const node = entry.transition === 'removed' ? rollbackNodes.get(entry.id) : candidateNodes.get(entry.id);
    if (!node) fail(`manifest node ${entry.id} is missing`);
    if (node.name !== entry.name || node.type !== entry.type) fail(`manifest identity mismatch for node ${entry.id}`);
    if (Boolean(node.credentials) !== entry.credentialsPresent) fail(`credential-presence mismatch for node ${entry.id}`);
  }

  const approvedRetainedChanges = new Map((manifest.retainedNodeChanges ?? []).map((entry) => [entry.id, entry]));
  for (const id of retained) {
    const candidateNode = candidateNodes.get(id);
    const rollbackNode = rollbackNodes.get(id);
    if (same(candidateNode, rollbackNode)) continue;

    const approval = approvedRetainedChanges.get(id);
    if (!approval) fail(`retained node changed without manifest approval: ${id}`);
    if (!same(approval.allowedFields, ['parameters'])) fail(`retained node ${id} has unsupported allowed fields`);

    const candidateWithoutParameters = { ...candidateNode };
    const rollbackWithoutParameters = { ...rollbackNode };
    delete candidateWithoutParameters.parameters;
    delete rollbackWithoutParameters.parameters;
    if (!same(candidateWithoutParameters, rollbackWithoutParameters)) fail(`retained node changed outside parameters: ${id}`);

    if (hashValue(rollbackNode) !== approval.liveNodeSha256) fail(`retained node live fingerprint mismatch: ${id}`);
    if (hashValue(candidateNode) !== approval.candidateNodeSha256) fail(`retained node candidate fingerprint mismatch: ${id}`);
    if (hashValue(rollbackNode.parameters) !== approval.liveParametersSha256) fail(`retained node live parameter fingerprint mismatch: ${id}`);
    if (hashValue(candidateNode.parameters) !== approval.candidateParametersSha256) fail(`retained node candidate parameter fingerprint mismatch: ${id}`);
  }

  const webhook = candidateNodes.get('webhook-trigger');
  const rollbackWebhook = rollbackNodes.get('webhook-trigger');
  if (!webhook || !rollbackWebhook || !same(webhook, rollbackWebhook)) fail('webhook identity or parameters changed');
}

function assertConnections(candidate, rollback, manifest) {
  const liveEdges = edges(rollback);
  const candidateEdges = edges(candidate);
  const liveNameIds = nodeNameToId(rollback);
  const candidateNameIds = nodeNameToId(candidate);
  const removedIds = new Set(transitionIds(manifest, 'removed'));
  const addedIds = new Set(transitionIds(manifest, 'added'));
  const retainedIds = new Set(transitionIds(manifest, 'retained'));

  const removed = liveEdges.filter((edge) => removedIds.has(liveNameIds.get(edge.from)) || removedIds.has(liveNameIds.get(edge.to)));
  const added = candidateEdges.filter((edge) => addedIds.has(candidateNameIds.get(edge.from)) || addedIds.has(candidateNameIds.get(edge.to)));
  const retained = candidateEdges.filter((edge) => retainedIds.has(candidateNameIds.get(edge.from)) && retainedIds.has(candidateNameIds.get(edge.to)));

  if (!same(removed, manifest.removedConnections)) fail('removed connection set differs from manifest');
  if (!same(added, manifest.addedConnections)) fail('added connection set differs from manifest');
  if (!same(retained, manifest.retainedConnections)) fail('retained connection set differs from manifest');
  if (!same(candidateEdges, manifest.expectedPostDeployment?.connections ?? [])) fail('candidate connection graph differs from expected post-deployment graph');
}

function assertManifest(candidate, rollback, manifest, rollbackPath) {
  if (manifest.version !== 1) fail('unsupported topology manifest version');
  if (manifest.workflowId !== WORKFLOW_ID) fail(`manifest workflow id must be ${WORKFLOW_ID}`);
  if (manifest.workflowName !== candidate.name || candidate.name !== rollback.name) fail('manifest workflow name does not match candidate and rollback');
  if (manifest.rollbackArtifact !== rollbackPath) fail('manifest rollback artifact path does not match supplied rollback artifact');
  if (sha256(rollbackPath) !== manifest.rollbackSha256) fail('rollback artifact SHA-256 does not match manifest');
  if (manifest.routing?.success !== 'inbox/new' || manifest.routing?.failure !== 'inbox/failed') fail('manifest routing paths are not canonical');
  if (manifest.routing?.successEnv !== 'MIND_INBOX_PATH' || manifest.routing?.failureEnv !== 'MIND_FAILED_PATH') fail('manifest routing environment contract is incomplete');
  assertCandidateState(manifest);

  const expectedNodeIds = (candidate.nodes ?? []).map((node) => node.id).sort();
  if (!same(expectedNodeIds, manifest.expectedPostDeployment?.nodeIds ?? [])) fail('expected post-deployment node set differs from candidate');
}

const [command, rollbackPath, candidatePath = DEFAULT_CANDIDATE, manifestPath = DEFAULT_MANIFEST, ...extra] = process.argv.slice(2);
if (command !== 'topology-plan' || !rollbackPath || extra.length > 0) {
  fail('usage: topology-plan <rollback.json> [candidate.json] [manifest.json]');
}

const rollback = readJson(rollbackPath, 'rollback artifact');
const candidate = readJson(candidatePath, 'candidate workflow');
const manifest = readJson(manifestPath, 'topology migration manifest');

assertWorkflowId(rollback, 'rollback artifact');
assertWorkflowId(candidate, 'candidate');
assertCanonicalPaths(candidate);
assertPreservedWorkflowFields(candidate, rollback, manifest);
assertManifest(candidate, rollback, manifest, rollbackPath);
assertNodeTransitions(candidate, rollback, manifest);
assertConnections(candidate, rollback, manifest);

console.log('mode=repository-candidate-topology-plan');
console.log(`workflow_id=${WORKFLOW_ID}`);
console.log(`rollback_sha256=${manifest.rollbackSha256}`);
console.log(`retained_nodes=${transitionIds(manifest, 'retained').join(',')}`);
console.log(`removed_nodes=${transitionIds(manifest, 'removed').join(',')}`);
console.log(`added_nodes=${transitionIds(manifest, 'added').join(',')}`);
console.log('expected_success_path=inbox/new');
console.log('expected_failure_path=inbox/failed');
console.log(`repository_candidate=${manifest.candidateState.repositoryCandidate}`);
console.log(`deployed=${manifest.candidateState.deployed}`);
console.log(`activation_state=${manifest.candidateState.activation}`);
console.log(`schedule_state=${manifest.candidateState.schedule}`);
console.log(`b1_0a=${manifest.candidateState.b1_0a}`);
console.log('live_commands_emitted=false');
console.log('approval_required_for_live_action=true');
console.log('network_access=false');
console.log('credentials_read=false');
console.log('result=pass');
