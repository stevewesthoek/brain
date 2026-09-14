#!/usr/bin/env node

import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type ModelAccessEvidence } from '../agent-mode/model-gateway.js';
import { admitManualModelOverride } from '../agent-mode/model-tier-policy.js';
import type { RouteEvidence } from '../agent-mode/model-tier-policy.js';
import { defaultAgentModeDatabasePath, AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { AGENT_MODE_CONTROL_SCHEMA_VERSION, AgentModeControlService, deriveAgentModeControlOperationId } from '../agent-mode/agent-mode-control-service.js';
import { runLiveAgentModeSlice } from '../agent-mode/live-agent-mode-slice.js';
import { WorkcellManager } from '../agent-mode/workcell.js';
import { runAgentModeSchedulerTick } from '../agent-mode/scheduler.js';
import { BRAIN_TASK_LIFECYCLE_SOURCE, GIT_REPOSITORY_REVISION_SOURCE, INFRASTRUCTURE_HOST_HEALTH_SOURCE, GitRepositoryEventSourceAdapter, HostHealthEventSourceAdapter, InternalLifecycleEventSourceAdapter, pollEventSourcesOnce } from '../agent-mode/event-source.js';
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
  console.error('Usage: brain-agent capabilities | brain-agent heartbeat --once | brain-agent scheduler tick | brain-agent sources poll --once [--source-type git.repository.revision --source-id ID --repository-ref REF --repository-root PATH | --source-type brain.task.lifecycle | --source-type infrastructure.host-health] [--debounce-ms N] [--cooldown-ms N] [--catch-up-limit N] | brain-agent run [--model auto|minimax-m2.5|glm-5|opus-4.6] [--task TEXT] | brain-agent inspect|pause|resume|cancel|kill RUN_ID [--operation-id ID] [--reason TEXT] | brain-agent workcell create|inspect|destroy ...');
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

  if (command === 'sources') {
    const action = process.argv[3];
    const once = process.argv[4] === '--once';
    if (action !== 'poll' || !once) {
      usage();
      process.exitCode = 1;
      return;
    }
    const sourceType = flag('--source-type') ?? GIT_REPOSITORY_REVISION_SOURCE;
    if (sourceType !== GIT_REPOSITORY_REVISION_SOURCE && sourceType !== BRAIN_TASK_LIFECYCLE_SOURCE && sourceType !== INFRASTRUCTURE_HOST_HEALTH_SOURCE) throw new Error(`unsupported source type: ${sourceType}`);
    const sourceId = flag('--source-id') ?? (sourceType === BRAIN_TASK_LIFECYCLE_SOURCE ? BRAIN_TASK_LIFECYCLE_SOURCE : sourceType === INFRASTRUCTURE_HOST_HEALTH_SOURCE ? INFRASTRUCTURE_HOST_HEALTH_SOURCE : requiredFlag('--source-id'));
    const repositoryRef = flag('--repository-ref') ?? (sourceType === GIT_REPOSITORY_REVISION_SOURCE ? requiredFlag('--repository-ref') : 'infrastructure-plane');
    const repositoryRoot = flag('--repository-root');
    if (sourceType === GIT_REPOSITORY_REVISION_SOURCE && !repositoryRoot) throw new Error('missing required --repository-root');
    const numberFlag = (name: string, fallback: number): number => {
      const raw = flag(name);
      if (!raw) return fallback;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
      return parsed;
    };
    const config = {
      sourceId,
      sourceType,
      repositoryRef,
      adapterType: sourceType,
      debounceWindowMs: numberFlag('--debounce-ms', 0),
      cooldownWindowMs: numberFlag('--cooldown-ms', 0),
      catchUpLimit: numberFlag('--catch-up-limit', 10),
      enabled: true,
      bootstrapWatermark: null,
    };
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = new AgentModeSqliteStateStore(databasePath);
    try {
      const configuration = store.upsertEventSource(config);
      const adapter = sourceType === BRAIN_TASK_LIFECYCLE_SOURCE
        ? new InternalLifecycleEventSourceAdapter({ store })
        : sourceType === INFRASTRUCTURE_HOST_HEALTH_SOURCE
          ? new HostHealthEventSourceAdapter()
          : new GitRepositoryEventSourceAdapter({ sourceId, repositoryRef, repositoryRoot: repositoryRoot as string });
      const result = await pollEventSourcesOnce({ store, adapters: [adapter] });
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-event-source-poll', configuration, ...result }, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent sources poll failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'heartbeat' || command === 'scheduler') {
    const valid = command === 'heartbeat' ? process.argv[3] === '--once' && process.argv.length === 4 : process.argv[3] === 'tick' && process.argv.length === 4;
    if (!valid) {
      usage();
      process.exitCode = 1;
      return;
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    if (!existsSync(databasePath)) {
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-heartbeat', outcome: 'NO_ACTION', reason: 'state_store_absent', databasePresent: false })}\n`);
      return;
    }
    const store = new AgentModeSqliteStateStore(databasePath);
    try {
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-heartbeat', databasePresent: true, ...runAgentModeSchedulerTick({ store }) }, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent heartbeat failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

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
    if (!runId) {
      usage();
      process.exitCode = 1;
      return;
    }
    if (command === 'inspect' && process.argv.length > 4) {
      usage();
      process.exitCode = 1;
      return;
    }
    if (command !== 'inspect') {
      for (let index = 4; index < process.argv.length; index += 2) {
        const name = process.argv[index];
        if (name !== '--operation-id' && name !== '--reason' || !process.argv[index + 1] || process.argv[index + 1]!.startsWith('--')) {
          usage();
          process.exitCode = 1;
          return;
        }
      }
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
        const reason = flag('--reason') ?? `brain-agent ${command}`;
        const control = new AgentModeControlService(store);
        const commandWithoutOperationId = {
          schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION,
          action: command,
          runId,
          actor: { source: 'cli', actorId: 'brain-agent' },
          requestedAt: now,
          reason,
        } as const;
        const operationId = flag('--operation-id') ?? deriveAgentModeControlOperationId(commandWithoutOperationId);
        const controlCommand = { ...commandWithoutOperationId, operationId } as const;
        const result = command === 'pause' ? control.pauseRun(controlCommand)
          : command === 'resume' ? control.resumeRun(controlCommand)
            : command === 'cancel' ? control.cancelRun(controlCommand)
              : control.killRun(controlCommand);
        const current = store.getRun(runId);
        const operation = result.outcome === 'completed' ? 'created' : result.outcome === 'already_applied' ? 'duplicate' : result.outcome === 'conflict' ? 'conflict' : result.outcome;
        process.stdout.write(`${JSON.stringify({ action: command, runId, attemptId: attempts[0]?.attemptId, operation, status: current?.status, durable: true, ...(result.receipt?.recoveryCode ? { recovery: result.outcome === 're_admission_required' ? 're-admission_required' : result.receipt.recoveryCode.toLowerCase() } : {}), ...(result.signal ? { runtimePid: current?.runtimePid, signal: { sent: result.signal.sent, reason: result.signal.reasonCode.toLowerCase() } } : {}) }, null, 2)}\n`);
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
