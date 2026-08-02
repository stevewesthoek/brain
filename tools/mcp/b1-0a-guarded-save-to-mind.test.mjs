import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANDIDATE_PATH,
  MANIFEST_PATH,
  ROLLBACK_CONFIRMATION,
  ROLLBACK_PATH,
  ROLLBACK_SHA256,
  ROLLBACK_TOOL,
  UPDATE_CONFIRMATION,
  UPDATE_TOOL,
  WORKFLOW_ID,
  dispatchToolCall,
  executeGuardedRollback,
  executeGuardedUpdate,
  fixedTopologyPlanInvocation,
  fixedUpdateInvocation,
  handleMcpMessage,
  toolDefinitions,
} from './b1-0a-guarded-save-to-mind.mjs';

function successResult(stdout) {
  return { code: 0, durationMs: 4, stdout, stderr: '', stdoutBytes: Buffer.byteLength(stdout), stderrBytes: 0, exceeded: false };
}

function successfulDependencies(calls) {
  return {
    assertRollbackAvailability: () => {},
    auditRollbackArtifact: () => ({ sha256: ROLLBACK_SHA256, workflowId: WORKFLOW_ID }),
    runProcess: async (invocation) => {
      calls.push(invocation);
      if (invocation.file === process.execPath) return successResult('result=pass\n');
      return successResult(JSON.stringify({ contractVersion: 1, operation: 'update-workflow', classification: 'succeeded', workflowId: WORKFLOW_ID, responseWorkflowId: WORKFLOW_ID, requestSent: true, responseReceived: true, errorCode: 'NONE' }));
    },
  };
}

test('update requires the exact confirmation and rejects every caller-controlled override', async () => {
  const calls = [];
  const dependencies = successfulDependencies(calls);
  await assert.rejects(() => executeGuardedUpdate({}, dependencies), /confirmation_required/);
  for (const override of [
    { workflowId: 'other' },
    { candidatePath: CANDIDATE_PATH },
    { rollbackPath: ROLLBACK_PATH },
    { manifestPath: MANIFEST_PATH },
    { env: { N8N_API_URL: 'override' } },
    { active: true },
    { schedule: 'enabled' },
    { webhookIdentity: 'other' },
    { credentials: {} },
    { settings: {} },
    { tags: [] },
    { sharing: [] },
    { nodeChanges: [] },
  ]) {
    await assert.rejects(() => executeGuardedUpdate({ confirmation: UPDATE_CONFIRMATION, ...override }, dependencies), /input_not_allowed/);
  }
  assert.equal(calls.length, 0);
});

test('update runs fixed topology validation then exactly one fixed-argv update with shell disabled', async () => {
  const calls = [];
  const result = await executeGuardedUpdate({ confirmation: UPDATE_CONFIRMATION }, successfulDependencies(calls));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], fixedTopologyPlanInvocation());
  assert.deepEqual(calls[1], fixedUpdateInvocation('update'));
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[1].options.shell, false);
  assert.deepEqual(calls[1].args, ['update-workflow', WORKFLOW_ID, fixedUpdateInvocation('update').args[2]]);
  assert.equal(result.operation, 'guarded-save-to-mind-update');
  assert.equal(result.exactlyOneWorkflowUpdateRequested, true);
  assert.equal(result.activationChangeRequested, false);
  assert.equal(result.scheduleChangeRequested, false);
  assert.equal(result.environmentOverridesAccepted, false);
  assert.equal(result.rawOutputEmitted, false);
});

test('rollback accepts no mutable scope and restores only the approved rollback artifact', async () => {
  const calls = [];
  const dependencies = successfulDependencies(calls);
  await assert.rejects(() => executeGuardedRollback({ confirmation: ROLLBACK_CONFIRMATION, rollbackPath: 'other.json' }, dependencies), /input_not_allowed/);
  const result = await executeGuardedRollback({ confirmation: ROLLBACK_CONFIRMATION }, dependencies);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], fixedUpdateInvocation('rollback'));
  assert.equal(calls[1].args[2].endsWith(ROLLBACK_PATH), true);
  assert.equal(result.operation, 'guarded-save-to-mind-rollback');
  assert.equal(result.candidatePath, null);
  assert.equal(result.rollbackPath, ROLLBACK_PATH);
});

test('missing local rollback availability blocks update before any validator or network wrapper invocation', async () => {
  let runnerCalled = false;
  await assert.rejects(
    () => executeGuardedUpdate({ confirmation: UPDATE_CONFIRMATION }, {
      assertRollbackAvailability: () => { throw new Error('missing'); },
      runProcess: async () => { runnerCalled = true; return successResult('result=pass\n'); },
    }),
    /missing/,
  );
  assert.equal(runnerCalled, false);
});

test('topology failure and ambiguous wrapper output fail closed without exposing raw output', async () => {
  const dependencies = successfulDependencies([]);
  dependencies.runProcess = async (invocation) => invocation.file === process.execPath
    ? successResult('result=fail\n')
    : successResult('{}');
  await assert.rejects(() => executeGuardedUpdate({ confirmation: UPDATE_CONFIRMATION }, dependencies), /topology_preflight_failed/);

  const ambiguous = successfulDependencies([]);
  ambiguous.runProcess = async (invocation) => invocation.file === process.execPath
    ? successResult('result=pass\n')
    : successResult('{"classification":"succeeded"}');
  await assert.rejects(() => executeGuardedUpdate({ confirmation: UPDATE_CONFIRMATION }, ambiguous), /operation_response_ambiguous/);
});

test('MCP registration advertises destructive confirmation-required fixed-scope tools only', async () => {
  const definitions = toolDefinitions();
  assert.deepEqual(definitions.map((tool) => tool.name), [UPDATE_TOOL, ROLLBACK_TOOL]);
  for (const tool of definitions) {
    assert.equal(tool.annotations.destructiveHint, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.inputSchema.required[0], 'confirmation');
  }
  const response = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: UPDATE_TOOL, arguments: {} } });
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /confirmation_required/);
  assert.doesNotMatch(response.result.content[0].text, /N8N_API_KEY|Bearer|Authorization/);
});

test('unknown tools fail closed', async () => {
  await assert.rejects(() => dispatchToolCall('other', { confirmation: UPDATE_CONFIRMATION }), /tool_not_found/);
  assert.equal(MANIFEST_PATH, 'operations/automations/n8n/save-to-mind-topology-migration.json');
});
