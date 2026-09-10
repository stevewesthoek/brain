#!/usr/bin/env node

import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type ModelAccessEvidence } from '../agent-mode/model-gateway.js';
import { admitManualModelOverride } from '../agent-mode/model-tier-policy.js';
import type { RouteEvidence } from '../agent-mode/model-tier-policy.js';
import { defaultAgentModeDatabasePath, AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { runLiveAgentModeSlice } from '../agent-mode/live-agent-mode-slice.js';
import { verifyRuntimeProcessIdentity } from '../agent-mode/runtime-process-identity.js';
import { WorkcellManager } from '../agent-mode/workcell.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BRAIN_CORE_URL ?? 'http://127.0.0.1:4877';

function jsonEnv<T>(name: string): T | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { throw new Error(`${name} must contain valid JSON`); }
}

const MODEL_REFS: Record<string, AdmittedModelRef | 'auto'> = {
  auto: 'auto',
  'minimax-m2.5': 'agent-mode/minimax-m2.5',
  'agent-mode/minimax-m2.5': 'agent-mode/minimax-m2.5',
  'glm-5': 'agent-mode/glm-5',
  'agent-mode/glm-5': 'agent-mode/glm-5',
  'opus-4.6': 'agent-mode/claude-opus-4.6',
  'agent-mode/claude-opus-4.6': 'agent-mode/claude-opus-4.6',
};

function usage(): void {
  console.error('Usage: brain-agent capabilities | brain-agent run [--model auto|minimax-m2.5|glm-5|opus-4.6] [--task TEXT] | brain-agent inspect|pause|resume|cancel|kill RUN_ID | brain-agent workcell create|inspect|destroy ...');
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredFlag(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`missing required ${name}`);
  return value;
}

function signalRecordedRuntime(runId: string, runtimePid: number | undefined, runtimeIdentity: Parameters<typeof verifyRuntimeProcessIdentity>[2]): { sent: boolean; reason?: string } {
  if (!runtimePid) return { sent: false, reason: 'no_recorded_runtime_pid' };
  if (!runtimeIdentity) return { sent: false, reason: 'no_recorded_runtime_identity' };
  if (!verifyRuntimeProcessIdentity(runtimePid, runId, runtimeIdentity)) return { sent: false, reason: 'runtime_identity_unverified' };
  try {
    process.kill(runtimePid, 'SIGTERM');
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function printModelRequest(rawModel: string): void {
  const modelRef = MODEL_REFS[rawModel.toLowerCase()];
  if (!modelRef || (modelRef !== 'auto' && !admitManualModelOverride(modelRef).ok)) {
    console.error(`Invalid Brain model override: ${rawModel}`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify({
    kind: 'agent-mode-model-request',
    policy: 'brain-agent-mode',
    admission: modelRef === 'auto' ? 'required' : admitManualModelOverride(modelRef),
    model: rawModel,
    modelRef: modelRef === 'auto' ? null : modelRef,
    route: modelRef === 'auto' ? null : AGENT_MODE_MODEL_ROUTES[modelRef],
    note: 'This is a policy request; Brain performs access, health, budget, capability, safety, and admission checks before invocation.',
  }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === 'workcell') {
    const action = process.argv[3];
    if (!action || !['create', 'inspect', 'destroy'].includes(action)) {
      usage();
      process.exitCode = 1;
      return;
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = existsSync(databasePath) || action === 'create' ? new AgentModeSqliteStateStore(databasePath) : undefined;
    if (!store) {
      console.error(`No durable Agent Mode StateStore at ${databasePath}`);
      process.exitCode = 1;
      return;
    }
    try {
      const manager = new WorkcellManager({ store });
      if (action === 'create') {
        const baseRef = flag('--base-ref');
        const workcell = await manager.create({
          taskId: requiredFlag('--task-id'),
          runId: requiredFlag('--run-id'),
          attemptId: requiredFlag('--attempt-id'),
          repositoryRef: requiredFlag('--repository-ref'),
          repositoryRoot: requiredFlag('--repository-root'),
          workcellsRoot: requiredFlag('--workcells-root'),
          ownerAgent: requiredFlag('--owner-agent'),
          ...(baseRef ? { baseRef } : {}),
        });
        process.stdout.write(`${JSON.stringify(workcell, null, 2)}\n`);
      } else if (action === 'inspect') {
        const inspection = await manager.inspect(requiredFlag('--workcell-id'), requiredFlag('--actor'));
        process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
      } else {
        const workcell = await manager.destroy(requiredFlag('--workcell-id'), requiredFlag('--actor'));
        process.stdout.write(`${JSON.stringify(workcell, null, 2)}\n`);
      }
    } catch (error) {
      console.error(`brain-agent workcell ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'run') {
    const modelIndex = process.argv.indexOf('--model');
    const modelArg = modelIndex >= 0 ? (process.argv[modelIndex + 1] ?? '') : 'auto';
    const taskIndex = process.argv.indexOf('--task');
    const taskText = taskIndex >= 0 ? process.argv[taskIndex + 1] : undefined;
    const modelRef = MODEL_REFS[modelArg.toLowerCase()];
    if (!modelRef) {
      console.error('Unknown Brain model. Use auto, minimax-m2.5, glm-5, or opus-4.6; all choices remain policy-gated.');
      process.exitCode = 2;
      return;
    }
    try {
      const harnessRoot = process.env.BRAIN_AGENT_MODE_HARNESS_ROOT;
      const accountRef = process.env.BRAIN_AGENT_MODE_ACCOUNT_REF;
      const routeEvidence = jsonEnv<Readonly<Record<AdmittedModelRef, RouteEvidence>>>('BRAIN_AGENT_MODE_ROUTE_EVIDENCE_JSON');
      const modelAccessEvidence = jsonEnv<ModelAccessEvidence>('BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON');
      if (!harnessRoot || !accountRef || !routeEvidence || !modelAccessEvidence) throw new Error('brain-agent run requires BRAIN_AGENT_MODE_HARNESS_ROOT, BRAIN_AGENT_MODE_ACCOUNT_REF, BRAIN_AGENT_MODE_ROUTE_EVIDENCE_JSON, and BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON');
      const result = await runLiveAgentModeSlice({
        databasePath: process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath(),
        fixtureRoot: path.resolve(new URL('../../fixtures', import.meta.url).pathname),
        harnessRoot,
        accountRef,
        routeEvidence,
        modelAccessEvidence,
        ...(taskText ? { taskText } : {}),
        ...(modelRef !== 'auto' ? { modelRef } : {}),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent run failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (['inspect', 'pause', 'resume', 'cancel', 'kill'].includes(command ?? '')) {
    const runId = process.argv[3];
    if (!runId || process.argv.length > 4) {
      usage();
      process.exitCode = 1;
      return;
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = command === 'inspect'
      ? AgentModeSqliteStateStore.openExisting(databasePath)
      : existsSync(databasePath) ? new AgentModeSqliteStateStore(databasePath) : undefined;
    if (!store) {
      console.error(`No durable Agent Mode StateStore at ${databasePath}`);
      process.exitCode = 1;
      return;
    }
    try {
      const run = store.getRun(runId);
      const attempts = store.listAttempts().filter((attempt) => attempt.runId === runId);
      if (!run) {
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      if (command === 'pause' || command === 'resume' || command === 'cancel' || command === 'kill') {
        const now = new Date().toISOString();
        const runtimePid = run.runtimePid;
        const runtimeOwned = verifyRuntimeProcessIdentity(runtimePid, runId, run.runtimeIdentity);
        let result = command === 'pause'
          ? store.pauseRun(runId, now)
          : command === 'resume'
            ? runtimeOwned ? store.resumeRun(runId, now) : 'conflict'
            : store.cancelRun(runId, now, command === 'kill' ? 'kill' : 'cancel');
        let recovery: string | undefined;
        if (command === 'resume' && !runtimeOwned) recovery = 're-admission_required';
        if (command === 'cancel' && !runtimeOwned) {
          const currentAttempt = store.listAttempts().find((attempt) => attempt.runId === runId && attempt.cancellationStatus === 'requested');
          if (currentAttempt) {
            store.acknowledgeCancellation(currentAttempt.attemptId, now);
            store.finishAttempt(currentAttempt.attemptId, 'cancelled', now);
            result = 'created';
            recovery = 'controller_absent_cancel_acknowledged';
          }
        }
        const signal = command === 'kill' ? signalRecordedRuntime(runId, runtimePid, run.runtimeIdentity) : undefined;
        const current = store.getRun(runId);
        process.stdout.write(`${JSON.stringify({ action: command, runId, attemptId: attempts[0]?.attemptId, operation: result, status: current?.status, durable: true, ...(recovery ? { recovery } : {}), ...(signal ? { runtimePid, signal } : {}) }, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${JSON.stringify({ run, task: store.getTask(run.taskId), attempts, events: store.listRecentEvents(500).filter((event) => event.entityId === runId || attempts.some((attempt) => event.entityId === attempt.attemptId)) }, null, 2)}\n`);
    } finally {
      store.close();
    }
    return;
  }

  if (command === '--model') {
    const model = process.argv[3];
    if (!model || process.argv.length > 4) {
      usage();
      process.exitCode = 1;
      return;
    }
    printModelRequest(model);
    return;
  }

  if (command !== 'capabilities') {
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/agent/capabilities`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Brain Core returned ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`brain-agent capabilities failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
