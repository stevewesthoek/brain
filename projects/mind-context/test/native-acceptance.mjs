import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

import {writeRawCapture} from '../src/capture/capture.mjs';
import {createRequestStore} from '../src/notifications/request-store.mjs';
import {computeProposalHash, createDecisionRequest, createReviewReadyCaptureRequest} from '../src/review/decision-request.mjs';

const evermindSupportRoot = path.join(os.homedir(), 'Library', 'Application Support', 'Evermind');
const appPath = process.env.EVERMIND_ACCEPTANCE_APP ?? path.join(evermindSupportRoot, 'app', 'Evermind.app', 'Contents', 'MacOS', 'Evermind');
const installedRuntime = path.join(evermindSupportRoot, 'runtime', 'src', 'notifications', 'action-cli.mjs');

if (process.platform !== 'darwin') {
  console.log('SKIP native acceptance: macOS is required');
  process.exit(0);
}

if (!fs.existsSync(appPath) || !fs.existsSync(installedRuntime)) {
  throw new Error('native acceptance requires the installed Evermind companion and runtime');
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-native-acceptance-'));
const root = path.join(fixture, 'root');
const storePath = path.join(fixture, 'store');
const acceptanceDirectory = path.join(fixture, 'harness');
const statePath = path.join(acceptanceDirectory, 'state.json');
fs.mkdirSync(root, {recursive: true});
const store = createRequestStore({root: storePath});
const acceptanceEnvironment = {
  ...process.env,
  EVERMIND_ACCEPTANCE_MODE: '1',
  EVERMIND_ACCEPTANCE_DIR: acceptanceDirectory,
  EVERMIND_ACCEPTANCE_ROOT: root,
  EVERMIND_ACCEPTANCE_STORE: storePath,
};

let appProcess;
let commandNumber = 0;

function logStep(message) {
  console.log(`✓ ${message}`);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForState(predicate, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastState = null;
  while (Date.now() < deadline) {
    if (fs.existsSync(statePath)) {
      const bytes = fs.readFileSync(statePath);
      if (bytes.length > 32 * 1024) throw new Error('acceptance_state_too_large');
      lastState = JSON.parse(bytes.toString('utf8'));
      if (predicate(lastState)) return lastState;
    }
    if (appProcess && appProcess.exitCode !== null) {
      throw new Error(`Evermind exited while waiting for ${label}`);
    }
    await wait(25);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastState)}`);
}

function openDeepLink(deepLink) {
  const result = spawnSync('/usr/bin/open', ['-g', deepLink], {encoding: 'utf8'});
  assert.equal(result.status, 0, `open failed for ${deepLink}: ${result.stderr ?? ''}`);
}

function writeCommand(command) {
  const commands = path.join(acceptanceDirectory, 'commands');
  fs.mkdirSync(commands, {recursive: true});
  const filename = `${String(commandNumber++).padStart(4, '0')}-${crypto.randomUUID()}.json`;
  const temporary = path.join(commands, `${filename}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(command)}\n`, {encoding: 'utf8', mode: 0o600});
  fs.renameSync(temporary, path.join(commands, filename));
}

function runInstalledDrain() {
  const result = spawnSync(process.execPath, [installedRuntime, '--drain', '--store-root', storePath, '--root', root], {encoding: 'utf8'});
  assert.equal(result.status, 0, `notification drain failed: ${result.stderr ?? ''}`);
  return JSON.parse(result.stdout);
}

function createCapture(content) {
  return writeRawCapture({root, content, sourceType: 'acceptance-test', provenance: 'synthetic-fixture'});
}

function createProposalRequest(captureId, id, requestId) {
  const proposal = {
    id,
    version: '1',
    content: 'Native immutable proposal fixture; disposable; no private content.',
    destination: `knowledge/${id}.md`,
    source: captureId,
    provenance: 'synthetic-fixture',
  };
  proposal.hash = computeProposalHash(proposal);
  return createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId,
    captureId,
    proposalId: proposal.id,
    source: {type: 'proposal', provenance: 'synthetic-fixture'},
    proposal,
  });
}

function startApp(startupLink = 'evermind://queue', environment = acceptanceEnvironment) {
  appProcess = spawn(appPath, ['--acceptance-mode', startupLink], {env: environment, stdio: 'ignore'});
  return appProcess;
}

async function stopApp() {
  if (!appProcess || appProcess.exitCode !== null) return;
  appProcess.kill('SIGTERM');
  const deadline = Date.now() + 2_000;
  while (appProcess.exitCode === null && Date.now() < deadline) await wait(25);
  if (appProcess.exitCode === null) appProcess.kill('SIGKILL');
  appProcess = null;
}

function writeProbeScript(probePath) {
  const script = [
    "const mode = process.env.EVERMIND_ACCEPTANCE_PROBE_MODE;",
    "if (mode === 'timeout') { setTimeout(() => {}, 10000); }",
    "else if (mode === 'nonzero') { process.stderr.write('synthetic probe failure'); process.exit(7); }",
    "else if (mode === 'malformed') { process.stdout.write('not-json'); }",
    "else { process.stdout.write(JSON.stringify({status: 'ok', result: []})); }",
    '',
  ].join('\n');
  fs.writeFileSync(probePath, script, {encoding: 'utf8', mode: 0o600});
}

async function runProcessProbe(probePath, mode, expectedError, assertions = {}) {
  await stopApp();
  writeProbeScript(probePath);
  const environment = {
    ...acceptanceEnvironment,
    EVERMIND_ACCEPTANCE_ACTION_PATH: probePath,
    EVERMIND_ACCEPTANCE_PROBE_MODE: mode,
  };
  startApp('evermind://queue', environment);
  await waitForState((candidate) => candidate.lifecycle === 'active' && candidate.route === 'queue' && !candidate.loading, `${mode} probe startup`);
  writeCommand({command: 'process-probe'});
  const state = await waitForState((candidate) => candidate.process?.role === 'acceptance-probe' && candidate.process?.errorCode === expectedError && !candidate.loading, `${mode} process telemetry`);
  if (assertions.stderrPresent !== undefined) assert.equal(state.process.stderrPresent, assertions.stderrPresent);
  if (assertions.stdoutParsed !== undefined) assert.equal(state.process.stdoutParsed, assertions.stdoutParsed);
  if (assertions.timedOut !== undefined) assert.equal(state.process.timedOut, assertions.timedOut);
  logStep(`${mode} subprocess failure is reported with bounded telemetry`);
}

async function main() {
  const reviewCapture = createCapture('Native review-only fixture; disposable; no private content.');
  const reviewRequest = createReviewReadyCaptureRequest({captureId: reviewCapture.captureId, sourceType: 'acceptance-test', provenance: 'synthetic-fixture'});
  store.put(reviewRequest);

  const approvalCapture = createCapture('Native approval fixture; disposable; no private content.');
  const approvalRequest = createProposalRequest(approvalCapture.captureId, 'native-acceptance-proposal', 'native-acceptance-approval-request');
  store.put(approvalRequest);

  const rejectCapture = createCapture('Native rejection fixture; disposable; no private content.');
  const rejectRequest = createReviewReadyCaptureRequest({captureId: rejectCapture.captureId, sourceType: 'acceptance-test', provenance: 'synthetic-fixture'});
  store.put(rejectRequest);

  startApp('evermind://queue');
  await waitForState((state) => state.lifecycle === 'active' && state.route === 'queue' && state.queueItemCount === 3 && !state.loading, 'cold queue route');
  logStep('cold launch reaches queue state');

  openDeepLink(`evermind://capture/${reviewCapture.captureId}`);
  let state = await waitForState((candidate) => candidate.route === 'capture' && candidate.selectedCaptureId === reviewCapture.captureId && !candidate.loading, 'warm capture route');
  assert.deepEqual(state.visibleActions, ['review', 'reject']);
  logStep('warm capture deep link selects the exact capture');

  openDeepLink(`evermind://review/${approvalRequest.proposal.id}`);
  state = await waitForState((candidate) => candidate.route === 'review' && candidate.selectedProposalId === approvalRequest.proposal.id && candidate.selectedRequestId === approvalRequest.requestId && !candidate.loading, 'proposal route');
  assert.deepEqual(state.visibleActions, ['approve', 'review', 'reject']);
  logStep('proposal deep link resolves proposal ID to the exact request');

  openDeepLink(`evermind://capture/${reviewCapture.captureId}`);
  openDeepLink(`evermind://review/${approvalRequest.proposal.id}`);
  state = await waitForState((candidate) => candidate.route === 'review' && candidate.selectedProposalId === approvalRequest.proposal.id && !candidate.loading, 'successive deep-link replacement');
  logStep('successive deep links leave the final route selected');

  openDeepLink(`evermind://capture/${reviewCapture.captureId}`);
  state = await waitForState((candidate) => candidate.route === 'capture' && candidate.selectedCaptureId === reviewCapture.captureId && !candidate.loading, 'review-only route');
  assert.equal(state.visibleActions.includes('approve'), false);
  writeCommand({command: 'action', action: 'approve', requestId: reviewRequest.requestId});
  state = await waitForState((candidate) => candidate.lastActionRequestId === reviewRequest.requestId && candidate.lastErrorCode === 'approve_requires_immutable_proposal' && !candidate.loading, 'review-only approve rejection');
  assert.equal(store.load(reviewRequest.requestId).state, 'pending');
  assert.equal(fs.existsSync(path.join(root, 'knowledge', 'native-review-only.md')), false);
  logStep('review-only approval is rejected fail-closed and remains pending');

  openDeepLink(`evermind://review/${approvalRequest.proposal.id}`);
  await waitForState((candidate) => candidate.route === 'review' && candidate.selectedProposalId === approvalRequest.proposal.id && candidate.visibleActions.includes('approve') && !candidate.loading, 'immutable proposal review');
  writeCommand({command: 'action', action: 'approve', requestId: approvalRequest.requestId});
  state = await waitForState((candidate) => candidate.route === 'queue' && candidate.lastActionRequestId === approvalRequest.requestId && candidate.lastActionResult === 'resolved-approved' && !candidate.loading, 'native approve');
  assert.equal(store.load(approvalRequest.requestId).state, 'resolved-approved');
  const approvedPath = path.join(root, approvalRequest.proposal.destination);
  assert.equal(fs.readFileSync(approvedPath, 'utf8'), `${approvalRequest.proposal.content}\n`);
  writeCommand({command: 'action', action: 'approve', requestId: approvalRequest.requestId});
  state = await waitForState((candidate) => candidate.lastActionRequestId === approvalRequest.requestId && candidate.lastActionResult === 'already_resolved' && !candidate.loading, 'approve replay');
  assert.equal(fs.readFileSync(approvedPath, 'utf8'), `${approvalRequest.proposal.content}\n`);
  assert.equal(state.visibleActions.length, 0);
  logStep('immutable approval delegates through JS, writes once, and rejects replay');

  openDeepLink(`evermind://capture/${rejectCapture.captureId}`);
  await waitForState((candidate) => candidate.route === 'capture' && candidate.selectedCaptureId === rejectCapture.captureId && !candidate.loading, 'reject route');
  writeCommand({command: 'action', action: 'reject', requestId: rejectRequest.requestId});
  await waitForState((candidate) => candidate.route === 'queue' && candidate.lastActionRequestId === rejectRequest.requestId && candidate.lastActionResult === 'resolved-rejected' && !candidate.loading, 'native reject');
  assert.equal(store.load(rejectRequest.requestId).state, 'resolved-rejected');
  const receipts = fs.readdirSync(path.join(root, 'inbox', 'processed')).filter((name) => name.includes(rejectCapture.captureId));
  assert.equal(receipts.length, 1);
  writeCommand({command: 'action', action: 'reject', requestId: rejectRequest.requestId});
  await waitForState((candidate) => candidate.lastActionRequestId === rejectRequest.requestId && candidate.lastActionResult === 'already_resolved' && !candidate.loading, 'reject replay');
  assert.equal(fs.readdirSync(path.join(root, 'inbox', 'processed')).filter((name) => name.includes(rejectCapture.captureId)).length, 1);
  logStep('reject archives once, writes one receipt, and rejects replay');

  const notificationCapture = createCapture('Native notification review fixture; disposable; no private content.');
  const notificationRequest = createReviewReadyCaptureRequest({captureId: notificationCapture.captureId, sourceType: 'acceptance-test', provenance: 'synthetic-fixture'});
  store.put(notificationRequest);
  store.writeAction({requestId: notificationRequest.requestId, action: 'review', eventId: 'native-acceptance-review-event'});
  const reviewDrain = runInstalledDrain();
  assert.equal(reviewDrain.result[0].result.status, 'review-opened');
  state = await waitForState((candidate) => candidate.route === 'capture' && candidate.selectedCaptureId === notificationCapture.captureId && !candidate.loading, 'notification review route');
  assert.equal(store.listActions().length, 0);
  logStep('notification Review event opens the exact native route');

  const notificationApprovalCapture = createCapture('Native notification approval fixture; disposable; no private content.');
  const notificationApproval = createProposalRequest(notificationApprovalCapture.captureId, 'native-notification-proposal', 'native-notification-approval-request');
  store.put(notificationApproval);
  store.writeAction({requestId: notificationApproval.requestId, action: 'approve', eventId: 'native-acceptance-approve-event'});
  const approveDrain = runInstalledDrain();
  assert.equal(approveDrain.result[0].result.state, 'resolved-approved');
  assert.equal(approveDrain.result[0].result.refreshed.opened, true);
  await waitForState((candidate) => candidate.route === 'queue' && !candidate.loading, 'notification approval refresh');
  assert.equal(store.load(notificationApproval.requestId).state, 'resolved-approved');
  assert.equal(fs.readFileSync(path.join(root, notificationApproval.proposal.destination), 'utf8'), `${notificationApproval.proposal.content}\n`);
  logStep('notification Approve event uses the JS authority layer and refreshes the app');

  const probePath = path.join(fixture, 'synthetic-probe.mjs');
  await runProcessProbe(probePath, 'nonzero', 'process_nonzero_exit', {stderrPresent: true, stdoutParsed: false, timedOut: false});
  await runProcessProbe(probePath, 'malformed', 'invalid_json_response', {stderrPresent: false, stdoutParsed: false, timedOut: false});
  await runProcessProbe(probePath, 'timeout', 'process_timeout', {stderrPresent: false, stdoutParsed: false, timedOut: true});

  await stopApp();
  startApp(`evermind://capture/${notificationCapture.captureId}`);
  await waitForState((candidate) => candidate.route === 'capture' && candidate.selectedCaptureId === notificationCapture.captureId && !candidate.loading, 'cold relaunch route');
  logStep('quit and relaunch honors the incoming route without stale selection');

  await stopApp();
  const productionHarness = path.join(fixture, 'production-harness');
  const stateBeforeProduction = fs.readFileSync(statePath, 'utf8');
  const productionProcess = spawn(appPath, ['evermind://queue'], {env: {...process.env}, stdio: 'ignore'});
  await wait(500);
  if (productionProcess.exitCode === null) productionProcess.kill('SIGTERM');
  assert.equal(fs.existsSync(path.join(productionHarness, 'state.json')), false);
  assert.equal(fs.readFileSync(statePath, 'utf8'), stateBeforeProduction);
  logStep('production mode does not create acceptance state');
}

try {
  await main();
  console.log('NATIVE_ACCEPTANCE_READY');
} finally {
  await stopApp();
  fs.rmSync(fixture, {recursive: true, force: true});
}
