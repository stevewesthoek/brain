#!/usr/bin/env node

import { createInterface } from 'node:readline';
import { accessSync, constants as fsConstants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  APPROVED_ARTIFACT,
  APPROVED_SHA256,
  APPROVED_WORKFLOW_ID,
  auditRollbackArtifact,
} from '../n8n-save-to-mind-artifact-safety.mjs';

export const WORKFLOW_ID = APPROVED_WORKFLOW_ID;
export const CANDIDATE_PATH = 'operations/automations/n8n/workflows/mind-inbox-fixed.json';
export const MANIFEST_PATH = 'operations/automations/n8n/save-to-mind-topology-migration.json';
export const ROLLBACK_PATH = APPROVED_ARTIFACT;
export const ROLLBACK_SHA256 = APPROVED_SHA256;
export const UPDATE_TOOL = 'b1_0a_guarded_save_to_mind_update';
export const ROLLBACK_TOOL = 'b1_0a_guarded_save_to_mind_rollback';
export const UPDATE_CONFIRMATION = 'I_CONFIRM_B1_0A_GUARDED_UPDATE_FWP5INe9qoo1OwGC';
export const ROLLBACK_CONFIRMATION = 'I_CONFIRM_B1_0A_GUARDED_ROLLBACK_FWP5INe9qoo1OwGC';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const wrapperPath = resolve(repoRoot, 'tools/n8n-api.sh');
const topologyPlannerPath = resolve(repoRoot, 'tools/n8n-save-to-mind-topology-plan.mjs');
const MAX_CAPTURED_OUTPUT_BYTES = 8 * 1024;

class GuardedOperationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fixedPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function assertExactInput(argumentsValue, confirmation) {
  if (!argumentsValue || typeof argumentsValue !== 'object' || Array.isArray(argumentsValue)) {
    throw new GuardedOperationError('invalid_input');
  }
  if (!Object.hasOwn(argumentsValue, 'confirmation') || argumentsValue.confirmation !== confirmation) {
    throw new GuardedOperationError('confirmation_required');
  }
  const keys = Object.keys(argumentsValue).sort();
  if (keys.length !== 1 || keys[0] !== 'confirmation') {
    throw new GuardedOperationError('input_not_allowed');
  }
}

export function assertRollbackAvailability({ access = accessSync } = {}) {
  try {
    access(wrapperPath, fsConstants.X_OK);
    access(fixedPath(ROLLBACK_PATH), fsConstants.R_OK);
    access(fixedPath(CANDIDATE_PATH), fsConstants.R_OK);
    access(fixedPath(MANIFEST_PATH), fsConstants.R_OK);
  } catch {
    throw new GuardedOperationError('guarded_rollback_unavailable');
  }
}

export function toolDefinitions() {
  return [
    {
      name: UPDATE_TOOL,
      description: 'Confirmation-required B1.0a-only Save-to-Mind topology update. Fixed workflow, candidate, rollback artifact, and manifest only.',
      inputSchema: {
        type: 'object',
        properties: { confirmation: { type: 'string', const: UPDATE_CONFIRMATION } },
        required: ['confirmation'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    {
      name: ROLLBACK_TOOL,
      description: 'Confirmation-required B1.0a-only rollback to the exact approved Save-to-Mind workflow artifact.',
      inputSchema: {
        type: 'object',
        properties: { confirmation: { type: 'string', const: ROLLBACK_CONFIRMATION } },
        required: ['confirmation'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
  ];
}

export function fixedTopologyPlanInvocation() {
  return {
    file: process.execPath,
    args: [topologyPlannerPath, 'topology-plan', fixedPath(ROLLBACK_PATH), fixedPath(CANDIDATE_PATH), fixedPath(MANIFEST_PATH)],
    options: { cwd: repoRoot, shell: false, timeoutMs: 30_000 },
  };
}

export function fixedUpdateInvocation(operation) {
  const payload = operation === 'update' ? fixedPath(CANDIDATE_PATH) : fixedPath(ROLLBACK_PATH);
  return {
    file: wrapperPath,
    args: ['update-workflow', WORKFLOW_ID, payload],
    options: { cwd: repoRoot, shell: false, timeoutMs: 65_000 },
  };
}

export async function runProcess({ file, args, options }) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let exceeded = false;
    const startedAt = Date.now();
    const timeout = setTimeout(() => {
      exceeded = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);
    const collect = (chunk, isStdout) => {
      const bytes = Buffer.byteLength(chunk);
      if (isStdout) stdoutBytes += bytes;
      else stderrBytes += bytes;
      if ((isStdout ? stdoutBytes : stderrBytes) > MAX_CAPTURED_OUTPUT_BYTES) {
        exceeded = true;
        child.kill('SIGTERM');
        return;
      }
      if (isStdout) stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => collect(chunk.toString('utf8'), true));
    child.stderr.on('data', (chunk) => collect(chunk.toString('utf8'), false));
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolvePromise({ code, durationMs: Date.now() - startedAt, stdout, stderr, stdoutBytes, stderrBytes, exceeded });
    });
  });
}

function assertTopologyResult(result) {
  if (result.exceeded || result.code !== 0 || !result.stdout.includes('result=pass')) {
    throw new GuardedOperationError('topology_preflight_failed');
  }
}

function parseBoundedUpdateContract(result) {
  if (result.exceeded || result.code !== 0 || result.stdoutBytes > MAX_CAPTURED_OUTPUT_BYTES || result.stderrBytes > MAX_CAPTURED_OUTPUT_BYTES) {
    throw new GuardedOperationError('operation_failed');
  }
  let contract;
  try {
    contract = JSON.parse(result.stdout.trim());
  } catch {
    throw new GuardedOperationError('operation_response_ambiguous');
  }
  if (
    contract?.contractVersion !== 1
    || contract?.operation !== 'update-workflow'
    || contract?.classification !== 'succeeded'
    || contract?.workflowId !== WORKFLOW_ID
    || contract?.responseWorkflowId !== WORKFLOW_ID
    || contract?.requestSent !== true
    || contract?.responseReceived !== true
    || contract?.errorCode !== 'NONE'
  ) {
    throw new GuardedOperationError('operation_response_ambiguous');
  }
  return {
    exitCode: result.code,
    durationMs: result.durationMs,
    responseClassification: contract.classification,
    responseWorkflowId: contract.responseWorkflowId,
    networkWriteRequested: true,
    rawOutputEmitted: false,
  };
}

async function execute(operation, argumentsValue, dependencies = {}) {
  const confirmation = operation === 'update' ? UPDATE_CONFIRMATION : ROLLBACK_CONFIRMATION;
  assertExactInput(argumentsValue, confirmation);
  (dependencies.assertRollbackAvailability ?? assertRollbackAvailability)();
  const rollback = (dependencies.auditRollbackArtifact ?? auditRollbackArtifact)({ repoRoot });
  if (rollback.sha256 !== ROLLBACK_SHA256 || rollback.workflowId !== WORKFLOW_ID) {
    throw new GuardedOperationError('rollback_artifact_validation_failed');
  }
  const runner = dependencies.runProcess ?? runProcess;
  const topologyResult = await runner(fixedTopologyPlanInvocation());
  assertTopologyResult(topologyResult);
  const updateResult = await runner(fixedUpdateInvocation(operation));
  const contract = parseBoundedUpdateContract(updateResult);
  return {
    operation: operation === 'update' ? 'guarded-save-to-mind-update' : 'guarded-save-to-mind-rollback',
    workflowId: WORKFLOW_ID,
    candidatePath: operation === 'update' ? CANDIDATE_PATH : null,
    rollbackPath: ROLLBACK_PATH,
    rollbackSha256: ROLLBACK_SHA256,
    topologyManifestPath: MANIFEST_PATH,
    exactlyOneWorkflowUpdateRequested: true,
    activationChangeRequested: false,
    scheduleChangeRequested: false,
    webhookInvocationRequested: false,
    environmentOverridesAccepted: false,
    rollbackOperationAvailable: true,
    ...contract,
  };
}

export async function executeGuardedUpdate(argumentsValue, dependencies) {
  return await execute('update', argumentsValue, dependencies);
}

export async function executeGuardedRollback(argumentsValue, dependencies) {
  return await execute('rollback', argumentsValue, dependencies);
}

export async function dispatchToolCall(name, argumentsValue, dependencies) {
  if (name === UPDATE_TOOL) return await executeGuardedUpdate(argumentsValue, dependencies);
  if (name === ROLLBACK_TOOL) return await executeGuardedRollback(argumentsValue, dependencies);
  throw new GuardedOperationError('tool_not_found');
}

function jsonRpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function toolErrorResult(error) {
  const code = error instanceof GuardedOperationError ? error.code : 'operation_failed';
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, code, rawOutputEmitted: false }) }], isError: true };
}

export async function handleMcpMessage(message, dependencies) {
  if (!message || message.jsonrpc !== '2.0') return null;
  if (message.method === 'notifications/initialized') return null;
  if (message.method === 'initialize') {
    return jsonRpc(message.id, {
      protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'b1-0a-guarded-save-to-mind', version: '1.0.0' },
    });
  }
  if (message.method === 'tools/list') return jsonRpc(message.id, { tools: toolDefinitions() });
  if (message.method === 'tools/call') {
    try {
      const result = await dispatchToolCall(message.params?.name, message.params?.arguments, dependencies);
      return jsonRpc(message.id, { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result }) }], isError: false });
    } catch (error) {
      return jsonRpc(message.id, toolErrorResult(error));
    }
  }
  return jsonRpcError(message.id ?? null, -32601, 'method_not_found');
}

export async function startMcpServer() {
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify(jsonRpcError(null, -32700, 'parse_error'))}\n`);
      continue;
    }
    const response = await handleMcpMessage(message);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch(() => {
    process.exitCode = 1;
  });
}
