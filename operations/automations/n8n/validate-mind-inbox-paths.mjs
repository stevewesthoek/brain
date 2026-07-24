import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workflowPath = path.join(
  process.cwd(),
  'operations/automations/n8n/workflows/mind-inbox-fixed.json',
);
const runbookPath = path.join(
  process.cwd(),
  'operations/runbooks/n8n-mind-inbox.md',
);
const topologyManifestPath = path.join(
  process.cwd(),
  'operations/automations/n8n/save-to-mind-topology-migration.json',
);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} is missing`);
    return '';
  }
  return value;
}

const workflowRaw = fs.readFileSync(workflowPath, 'utf8');
let workflow;
let topologyManifest;

try {
  workflow = JSON.parse(workflowRaw);
  console.log('workflow_json=valid');
} catch (error) {
  fail(`workflow JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  process.exit();
}

try {
  topologyManifest = JSON.parse(fs.readFileSync(topologyManifestPath, 'utf8'));
  console.log('topology_manifest_json=valid');
} catch (error) {
  fail(`topology manifest JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  process.exit();
}

if (workflow.active !== false) {
  fail('repository candidate activation must be false');
}

const requiredCandidateState = {
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
if (Object.entries(requiredCandidateState).some(([key, value]) => topologyManifest?.candidateState?.[key] !== value)) {
  fail('topology manifest candidate state is incomplete or unsafe');
}

const currentNode = workflow.nodes?.find(
  (node) => node?.name === 'Build Processed Note',
);
const activeNode = workflow.activeVersion?.nodes?.find(
  (node) => node?.name === 'Build Processed Note',
);

const definitions = [
  ['nodes.Build Processed Note', requireText(currentNode?.parameters?.jsCode, 'current workflow code')],
  ['activeVersion.nodes.Build Processed Note', requireText(activeNode?.parameters?.jsCode, 'active-version workflow code')],
];

const successDefault = "($env.MIND_INBOX_PATH || 'inbox/new')";
const failureDefault = "($env.MIND_FAILED_PATH || 'inbox/failed')";
const conditionalRoute = 'isFailed ? failedPrefix : inboxPrefix';
const retiredPaths = ['capture/inbox', 'capture/failed'];

for (const [label, code] of definitions) {
  if (!code.includes(successDefault)) {
    fail(`${label} does not default MIND_INBOX_PATH to inbox/new`);
  }
  if (!code.includes(failureDefault)) {
    fail(`${label} does not default MIND_FAILED_PATH to inbox/failed`);
  }
  if (!code.includes(conditionalRoute)) {
    fail(`${label} does not route failures through failedPrefix`);
  }

  for (const retiredPath of retiredPaths) {
    if (code.includes(retiredPath)) {
      fail(`${label} contains active retired path ${retiredPath}`);
    }
  }

  console.log(`${label}=canonical_paths_verified`);
}

const tokenCounts = {};
for (const token of ['inbox/new', 'inbox/failed', ...retiredPaths]) {
  tokenCounts[token] = workflowRaw.split(token).length - 1;
  console.log(`${token}=${tokenCounts[token]}`);
}

if (tokenCounts['capture/inbox'] !== 0 || tokenCounts['capture/failed'] !== 0) {
  fail('workflow JSON retains an active retired-path token');
}

const runbook = fs.readFileSync(runbookPath, 'utf8');
const requiredRunbookText = [
  'repository target `inbox/new/`',
  'repository target `inbox/failed/`',
  'Repository controlled-migration candidate status: deployed and read back exactly.',
  'Historical frozen candidate status: paused; repository evidence only.',
  'Live deployment status: verified by guarded canonical readback on 2026-07-22.',
  'Live activation and schedule state: preserved unchanged; no separate mutation requested.',
  'B1.0a status: complete for the approved guarded deployment/readback scope.',
  'Any future live change requires a new',
  'approval, operation ID, confirmation, and readback sequence.',
];

for (const requiredText of requiredRunbookText) {
  if (!runbook.includes(requiredText)) {
    fail(`runbook is missing required text: ${requiredText}`);
  }
}

for (const retiredPath of retiredPaths) {
  if (runbook.includes(retiredPath)) {
    fail(`runbook retains unexplained retired path ${retiredPath}`);
  }
}

console.log('runbook=canonical_paths_and_live_boundary_verified');
console.log('credential_values_read=false');
console.log('external_actions_performed=false');

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('result=pass');
