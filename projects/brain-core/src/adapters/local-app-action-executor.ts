import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreLocalAppAction,
  BrainCoreLocalAppManagedProcessRecord,
  BrainCoreLocalAppActionResult,
  BrainCoreLocalAppActionResultStep,
} from '../types/api.js';
import type { BrainCoreLocalAppDefinition } from '../types/api.js';
import { listLocalAppDefinitions } from './local-app-orchestrator.js';
import {
  startDatabasePhase,
  stopDatabasePhase,
  verifyAppStarted,
  verifyAppStopped,
} from './local-app-stack-orchestrator.js';

type ExecutionStrategy =
  | 'repo-dev-script'
  | 'repo-npm-dev'
  | 'repo-npm-start'
  | 'docker-compose'
  | 'absolute-helper'
  | 'supervisorctl'
  | 'managed-process-stop'
  | 'managed-restart'
  | 'unsupported';

type SafeCommandSpec = {
  executable: boolean;
  reason: string;
  strategy: ExecutionStrategy;
  commandLabel: string;
  file: string;
  args: string[];
  cwd: string;
  detached: boolean;
  timeoutMs: number;
  expectedLongRunning: boolean;
  pathPrepend?: string[];
  managedProcessRecord?: BrainCoreLocalAppManagedProcessRecord;
};

type ManagedProcessState = {
  records: BrainCoreLocalAppManagedProcessRecord[];
};

const OUTPUT_LIMIT = 1800;
const inflightByApp = new Map<string, Promise<BrainCoreLocalAppActionResult>>();
const processHandle = (globalThis as any).process as { kill: (pid: number, signal?: NodeJS.Signals | number) => void };

export function evaluateLocalAppActionDefinition(
  app: BrainCoreLocalAppDefinition,
  action: BrainCoreLocalAppAction,
): Pick<SafeCommandSpec, 'executable' | 'reason' | 'strategy' | 'commandLabel'> {
  const spec = buildCommandSpec(app, action);
  return {
    executable: spec.executable,
    reason: spec.reason,
    strategy: spec.strategy,
    commandLabel: spec.commandLabel,
  };
}

export function readManagedLocalAppProcesses(): BrainCoreLocalAppManagedProcessRecord[] {
  return readManagedProcessState().records.filter((record) => isPidAlive(record.pid));
}

export function readManagedLocalAppProcess(appId: string): BrainCoreLocalAppManagedProcessRecord | null {
  return readManagedProcessForApp(appId);
}

export class LocalAppActionExecutor {
  async executeAction(appId: string, action: BrainCoreLocalAppAction): Promise<BrainCoreLocalAppActionResult> {
    const startedAtMs = Date.now();
    const id = `local-app-${action}-${normalizeId(appId || 'unknown')}-${startedAtMs}`;
    const app = listLocalAppDefinitions().find((entry) => entry.id === appId);

    if (!app) {
      return createResult({
        id,
        appId,
        action,
        status: 'not_found',
        ok: false,
        message: 'App is not registered in the canonical local app inventory.',
        errorCode: 'local_app_not_found',
        startedAtMs,
        steps: validationSteps('failed', 'Canonical app id was not found.'),
        allowlistedApp: false,
        allowlistedAction: false,
        nextState: 'unknown',
      });
    }

    const existing = inflightByApp.get(app.id);
    if (existing) {
      return createResult({
        id,
        appId: app.id,
        action,
        status: 'blocked',
        ok: false,
        message: 'Another local app action is already running for this app.',
        errorCode: 'local_app_action_in_flight',
        startedAtMs,
        steps: validationSteps('blocked', 'Per-app lifecycle lock is already held.'),
        allowlistedApp: true,
        allowlistedAction: true,
        nextState: 'unknown',
      });
    }

    const execution = runActionCore(app, action, id, startedAtMs);
    inflightByApp.set(app.id, execution);
    try {
      return await execution;
    } catch (error) {
      return createResult({
        id,
        appId: app.id,
        action,
        status: 'failed',
        ok: false,
        message: 'Local app action failed safely. Brain Core remains available.',
        errorCode: 'local_app_action_failed',
        error: redact(String(error instanceof Error ? error.message : error)),
        startedAtMs,
        steps: executionSteps('failed', 'Executor threw and was converted to a structured result.'),
        allowlistedApp: true,
        allowlistedAction: true,
        nextState: 'unknown',
      });
    } finally {
      inflightByApp.delete(app.id);
    }
  }
}

async function runActionCore(
  app: BrainCoreLocalAppDefinition,
  action: BrainCoreLocalAppAction,
  id: string,
  startedAtMs: number,
): Promise<BrainCoreLocalAppActionResult> {
  const spec = buildCommandSpec(app, action);
  if (!spec.executable) {
    const managedStop = action === 'stop' ? readManagedProcessForApp(app.id) : null;
    if (managedStop) {
      return executeManagedProcessStop(id, app.id, action, managedStop, startedAtMs);
    }
    return createResult({
      id,
      appId: app.id,
      action,
      status: 'not_executable',
      ok: false,
      message: spec.reason,
      errorCode: 'local_app_action_not_executable',
      startedAtMs,
      steps: validationSteps('not_executable', spec.reason),
      allowlistedApp: true,
      allowlistedAction: false,
      nextState: 'unknown',
    });
  }

  if (action === 'restart' && spec.strategy === 'managed-restart') {
    return executeCompositeRestart(app, id, startedAtMs);
  }

  return executeStackAction(app, action, id, spec, startedAtMs);
}

async function executeStackAction(
  app: BrainCoreLocalAppDefinition,
  action: BrainCoreLocalAppAction,
  id: string,
  spec: SafeCommandSpec,
  startedAtMs: number,
): Promise<BrainCoreLocalAppActionResult> {
  const preSteps: BrainCoreLocalAppActionResultStep[] = [];

  // ── START: bring DB up first, then app ──────────────────────────────────
  if (action === 'start') {
    const dbPhase = await startDatabasePhase(app);
    preSteps.push(...dbPhase.steps);
    if (!dbPhase.ok) {
      return createResult({
        id, appId: app.id, action,
        status: 'failed', ok: false,
        message: `Database did not start: ${dbPhase.reason}`,
        errorCode: 'local_app_db_start_failed',
        startedAtMs,
        steps: [...preSteps, ...validationSteps('failed', 'App start was blocked because database failed to come up.')],
        allowlistedApp: true, allowlistedAction: true, nextState: 'unknown',
      });
    }

    const appResult = await executeSpec(id, app.id, action, spec, startedAtMs);
    const verifyPhase = await verifyAppStarted(app);
    return createResult({
      id, appId: app.id, action,
      status: appResult.ok && verifyPhase.ok ? appResult.status : 'failed',
      ok: appResult.ok && verifyPhase.ok,
      message: appResult.ok && verifyPhase.ok
        ? appResult.message
        : `App start failed verification: ${verifyPhase.ok ? appResult.message : (verifyPhase as any).reason}`,
      ...(appResult.errorCode ? { errorCode: appResult.errorCode } : {}),
      ...(appResult.error ? { error: appResult.error } : {}),
      startedAtMs,
      steps: [...preSteps, ...appResult.steps, ...verifyPhase.steps],
      allowlistedApp: true, allowlistedAction: true,
      nextState: appResult.ok && verifyPhase.ok ? 'running' : 'unknown',
      nextPollMs: appResult.nextPollMs,
    });
  }

  // ── STOP: stop app, verify port closed, then stop DB ────────────────────
  if (action === 'stop') {
    const appResult = await executeSpec(id, app.id, action, spec, startedAtMs);
    const verifyPhase = await verifyAppStopped(app);
    const postSteps = [...appResult.steps, ...verifyPhase.steps];

    if (!verifyPhase.ok) {
      return createResult({
        id, appId: app.id, action,
        status: 'failed', ok: false,
        message: `App stop failed: ${(verifyPhase as any).reason}`,
        errorCode: 'local_app_stop_verify_failed',
        startedAtMs,
        steps: postSteps,
        allowlistedApp: true, allowlistedAction: true, nextState: 'unknown',
      });
    }

    const dbPhase = await stopDatabasePhase(app);
    postSteps.push(...dbPhase.steps);

    return createResult({
      id, appId: app.id, action,
      status: dbPhase.ok ? (appResult.ok ? appResult.status : 'failed') : 'failed',
      ok: appResult.ok && dbPhase.ok,
      message: dbPhase.ok
        ? appResult.message
        : `App stopped but database did not stop: ${(dbPhase as any).reason}`,
      ...(appResult.errorCode && !dbPhase.ok ? { errorCode: 'local_app_db_stop_failed' } : appResult.errorCode ? { errorCode: appResult.errorCode } : {}),
      startedAtMs,
      steps: postSteps,
      allowlistedApp: true, allowlistedAction: true,
      nextState: appResult.ok && dbPhase.ok ? 'stopped' : 'unknown',
    });
  }

  // ── Fallback (should not be reached for managed-restart, but safe) ───────
  return executeSpec(id, app.id, action, spec, startedAtMs);
}

function buildCommandSpec(app: BrainCoreLocalAppDefinition, action: BrainCoreLocalAppAction): SafeCommandSpec {
  const pathPrepend = app.commandPathPrepend && app.commandPathPrepend.length > 0 ? app.commandPathPrepend : undefined;
  if (app.id === 'model-router') {
    return disabled(`No canonical ${action} command is defined for this app.`);
  }
  if (isManualLaunchOnly(app)) {
    return disabled('Repo lifecycle script is registered but missing or outside allowlisted roots.');
  }
  if (action === 'restart') {
    const stopSpec = buildCommandSpec(app, 'stop');
    const startSpec = buildCommandSpec(app, 'start');
    if (stopSpec.executable && startSpec.executable) {
      return {
        executable: true,
        reason: 'Canonical stop/start commands are allowlisted for Brain Core composite restart.',
        strategy: 'managed-restart',
        commandLabel: `${stopSpec.commandLabel} && ${startSpec.commandLabel}`,
        file: '',
        args: [],
        cwd: startSpec.cwd || stopSpec.cwd,
        detached: false,
        timeoutMs: 0,
        expectedLongRunning: false,
        ...(pathPrepend ? { pathPrepend } : {}),
      };
    }
  }
  const rawCommand = action === 'start' ? app.startCommand : action === 'stop' ? app.stopCommand : app.restartCommand;
  if (action === 'stop' && requiresManagedNpmRegistryStop(app) && looksLikeManagedNpmStartCommand(app.startCommand, app.commandWorkdir)) {
    const stopScriptPath = resolveRepoLifecycleScriptPath(app.stopCommand, app.commandWorkdir);
    if (stopScriptPath && isUnsafePortKillingScript(stopScriptPath)) {
      const managed = readManagedProcessForApp(app.id);
      if (managed) {
        return {
          executable: true,
          reason: 'Brain Core-managed npm process is recorded for this app.',
          strategy: 'managed-process-stop',
          commandLabel: 'managed-process-stop',
          file: '',
          args: [],
          cwd: process.cwd(),
          detached: false,
          timeoutMs: 0,
          expectedLongRunning: false,
          managedProcessRecord: managed,
        };
      }
      return disabled('No Brain Core-managed npm process is recorded for this app. Start it from Brain Console first.');
    }
  }
  if (!rawCommand) {
    if (action === 'stop') {
      const managed = readManagedProcessForApp(app.id);
      if (managed) {
        return {
          executable: true,
          reason: 'Brain Core-managed npm process is recorded for this app.',
          strategy: 'managed-process-stop',
          commandLabel: 'managed-process-stop',
          file: '',
          args: [],
          cwd: process.cwd(),
          detached: false,
          timeoutMs: 0,
          expectedLongRunning: false,
          managedProcessRecord: managed,
        };
      }
      if (looksLikeManagedNpmStartCommand(app.startCommand)) {
        return disabled('No Brain Core-managed npm process is recorded for this app. Start it from Brain Console first.');
      }
    }
    return disabled(`No canonical ${action} command is defined for this app.`);
  }

  const cwd = resolveSafeCwd(app.commandWorkdir);
  if (!cwd) return disabled('Canonical command working directory is missing, unsafe, or not on disk.');

  const command = rawCommand.trim();
  if (containsSecretLikeText(command)) return disabled('Canonical command contains secret-looking text and is not executable from Brain Core.');
  if (/\b(env|printenv|cat)\b/.test(command)) return disabled('Canonical command could expose environment or file contents.');

  const cdPrefix = command.match(/^cd\s+(~?\/?[^;&|`$()]+)\s+&&\s+(.+)$/);
  const commandBody = cdPrefix ? cdPrefix[2]?.trim() ?? '' : command;
  const commandCwd = cdPrefix ? resolveSafeCwd(expandHome(cdPrefix[1]?.trim() ?? '')) : cwd;
  if (!commandCwd) return disabled('Canonical command cd target is missing, unsafe, or not on disk.');

  if (/[`$()|;]/.test(commandBody)) return disabled('Canonical command uses shell metacharacters that are not allowed for automated execution.');

  if (/^bash\s+scripts\/dev\/(start|stop|restart)-local\.sh$/.test(commandBody)) {
    const script = commandBody.replace(/^bash\s+/, '');
    return scriptSpec('repo-dev-script', commandCwd, script, action, pathPrepend);
  }

  const absoluteBash = commandBody.match(/^bash\s+(~?\/?[^\s;&|`$()]+\/(?:start|stop|restart|buildflow-orchestrator|stop-firecrawl|restart-xgrow|stop-xgrow|model-router-dry-run-report)[^\s;&|`$()]*(?:\.sh)?)\s*(start|stop|restart)?$/);
  if (absoluteBash) {
    const scriptPath = expandHome(absoluteBash[1] ?? '');
    if (!isPathInsideAllowedRoot(scriptPath)) return disabled('Helper script is outside the allowlisted local app roots.');
    if (!fs.existsSync(scriptPath)) return disabled('Helper script is registered but does not exist on disk.');
    return {
      executable: true,
      reason: 'Canonical helper script is allowlisted for Brain Core execution.',
      strategy: 'absolute-helper',
      commandLabel: `bash ${redactPath(scriptPath)}${absoluteBash[2] ? ` ${absoluteBash[2]}` : ''}`,
      file: 'bash',
      args: [scriptPath, ...(absoluteBash[2] ? [absoluteBash[2]] : [])],
      cwd: path.dirname(scriptPath),
      detached: action === 'start',
      timeoutMs: action === 'start' ? 5000 : 30000,
      expectedLongRunning: action === 'start',
    };
  }

  if (/^docker\s+compose\s+(up\s+-d|down|restart)$/.test(commandBody)) {
    const args = commandBody.split(/\s+/).slice(1);
    return {
      executable: true,
      reason: 'Canonical docker compose lifecycle command is allowlisted for Brain Core execution.',
      strategy: 'docker-compose',
      commandLabel: commandBody,
      file: 'docker',
      args,
      cwd: commandCwd,
      detached: false,
      timeoutMs: 45000,
      expectedLongRunning: false,
    };
  }

  if (/^npm\s+start$/.test(commandBody) || /^npm\s+run\s+dev$/.test(commandBody)) {
    return {
      executable: true,
      reason: 'Canonical npm lifecycle command is allowlisted and launched without shell command overrides.',
      strategy: commandBody === 'npm start' ? 'repo-npm-start' : 'repo-npm-dev',
      commandLabel: commandBody,
      file: 'npm',
      args: commandBody === 'npm start' ? ['start'] : ['run', 'dev'],
      cwd: commandCwd,
      detached: true,
      timeoutMs: 5000,
      expectedLongRunning: true,
    };
  }

  const envNpm = commandBody.match(/^(?:[A-Z0-9_]+=[^\s;&|`$()]+\s+)+npm\s+run\s+dev(?:\s*>\s*\/tmp\/[a-z0-9._-]+\s*2>&1\s*&)?$/i);
  if (envNpm) return disabled('Command uses inline environment variables; register a repo-local start script before Brain Core can execute it.');

  if (/^~\/\.local\/bin\/[a-z0-9-]+-(start|stop|restart)$/.test(commandBody)) {
    const helper = expandHome(commandBody);
    if (!fs.existsSync(helper)) return disabled('Local helper is registered but does not exist on disk.');
    return {
      executable: true,
      reason: 'Canonical local helper is allowlisted for Brain Core execution.',
      strategy: 'absolute-helper',
      commandLabel: redactPath(helper),
      file: helper,
      args: [],
      cwd,
      detached: action === 'start',
      timeoutMs: action === 'start' ? 5000 : 30000,
      expectedLongRunning: action === 'start',
    };
  }

  if (/^supervisorctl\s+(start|stop|restart)\s+[a-z0-9-]+$/i.test(commandBody)) {
    const parts = commandBody.split(/\s+/);
    if (parts[1] !== action) return disabled('Supervisor command action does not match the requested action.');
    return {
      executable: true,
      reason: 'Canonical supervisor lifecycle command is allowlisted for Brain Core execution.',
      strategy: 'supervisorctl',
      commandLabel: commandBody,
      file: 'supervisorctl',
      args: parts.slice(1),
      cwd,
      detached: false,
      timeoutMs: 30000,
      expectedLongRunning: false,
    };
  }

  return disabled('Canonical command is registered but its execution strategy is not allowlisted yet.');
}

function scriptSpec(strategy: ExecutionStrategy, cwd: string, script: string, action: BrainCoreLocalAppAction, pathPrepend?: string[]): SafeCommandSpec {
  const scriptPath = path.resolve(cwd, script);
  if (!isPathInsideAllowedRoot(scriptPath) || !fs.existsSync(scriptPath)) return disabled('Repo lifecycle script is registered but missing or outside allowlisted roots.');
  return {
    executable: true,
    reason: 'Canonical repo lifecycle script is allowlisted for Brain Core execution.',
    strategy,
    commandLabel: `bash ${script}`,
    file: 'bash',
    ...(pathPrepend && pathPrepend.length > 0 ? { pathPrepend } : {}),
    args: [script],
    cwd,
    detached: action === 'start',
    timeoutMs: action === 'start' ? 5000 : 30000,
    expectedLongRunning: action === 'start',
  };
}

function disabled(reason: string): SafeCommandSpec {
  return {
    executable: false,
    reason,
    strategy: 'unsupported',
    commandLabel: '',
    file: '',
    args: [],
    cwd: process.cwd(),
    detached: false,
    timeoutMs: 0,
    expectedLongRunning: false,
  };
}

function executeSpec(
  id: string,
  appId: string,
  action: BrainCoreLocalAppAction,
  spec: SafeCommandSpec,
  startedAtMs: number,
): Promise<BrainCoreLocalAppActionResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    try {
      const spawnEnv = spec.pathPrepend && spec.pathPrepend.length > 0
        ? { ...process.env, PATH: `${spec.pathPrepend.join(path.delimiter)}${path.delimiter}${process.env.PATH ?? ''}` }
        : process.env;
      const child = spawn(spec.file, spec.args, {
        cwd: spec.cwd,
        detached: spec.detached,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: spawnEnv,
      });

      if (spec.detached) child.unref();
      if (spec.strategy === 'repo-npm-dev' || spec.strategy === 'repo-npm-start') {
        recordManagedProcessStart({
          appId,
          pid: child.pid ?? -1,
          startedAtMs,
          strategy: spec.strategy,
          commandLabel: spec.commandLabel,
          cwd: spec.cwd,
        });
      }

      const finish = (result: BrainCoreLocalAppActionResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.stdout?.destroy();
        child.stderr?.destroy();
        resolve(result);
      };

      const timeout = setTimeout(() => {
        if (spec.expectedLongRunning) {
          finish(createResult({
            id,
            appId,
            action,
            status: 'accepted',
            ok: true,
            message: `${action} command accepted; ${spec.strategy} is still starting or running in the background.`,
            startedAtMs,
            steps: executionSteps('success', `Accepted ${spec.commandLabel}. Output: ${compactOutput(stdout, stderr)}`),
            allowlistedApp: true,
            allowlistedAction: true,
            nextState: action === 'stop' ? 'stopped' : 'running',
            nextPollMs: 3000,
          }));
          return;
        }
        child.kill('SIGTERM');
        finish(createResult({
          id,
          appId,
          action,
          status: 'failed',
          ok: false,
          message: `${action} command timed out after ${spec.timeoutMs}ms.`,
          errorCode: 'local_app_action_timeout',
          startedAtMs,
          steps: executionSteps('failed', `Timed out running ${spec.commandLabel}. Output: ${compactOutput(stdout, stderr)}`),
          allowlistedApp: true,
          allowlistedAction: true,
          nextState: 'unknown',
        }));
      }, spec.timeoutMs);

      child.stdout?.on('data', (chunk) => {
        stdout = cap(`${stdout}${chunk.toString()}`);
      });
      child.stderr?.on('data', (chunk) => {
        stderr = cap(`${stderr}${chunk.toString()}`);
      });
      child.on('error', (error) => {
        finish(createResult({
          id,
          appId,
          action,
          status: 'failed',
          ok: false,
          message: `${action} command could not start.`,
          errorCode: 'local_app_spawn_failed',
          error: redact(error.message),
          startedAtMs,
          steps: executionSteps('failed', `Spawn failed for ${spec.commandLabel}.`),
          allowlistedApp: true,
          allowlistedAction: true,
          nextState: 'unknown',
        }));
      });
      child.on('exit', (code) => {
        const ok = code === 0;
        finish(createResult({
          id,
          appId,
          action,
          status: ok ? 'success' : 'failed',
          ok,
          message: ok ? `${action} command completed successfully.` : `${action} command failed with exit code ${code ?? 'unknown'}.`,
          ...(ok ? {} : { errorCode: 'local_app_command_failed' }),
          startedAtMs,
          steps: executionSteps(ok ? 'success' : 'failed', `Ran ${spec.commandLabel}. Output: ${compactOutput(stdout, stderr)}`),
          allowlistedApp: true,
          allowlistedAction: true,
          nextState: ok ? (action === 'stop' ? 'stopped' : 'running') : 'unknown',
        }));
      });
    } catch (error) {
      resolve(createResult({
        id,
        appId,
        action,
        status: 'failed',
        ok: false,
        message: 'Local app action failed before spawn.',
        errorCode: 'local_app_executor_error',
        error: redact(String(error instanceof Error ? error.message : error)),
        startedAtMs,
        steps: executionSteps('failed', 'Executor error was caught and structured.'),
        allowlistedApp: true,
        allowlistedAction: true,
        nextState: 'unknown',
      }));
    }
  });
}

async function executeCompositeRestart(app: BrainCoreLocalAppDefinition, id: string, startedAtMs: number): Promise<BrainCoreLocalAppActionResult> {
  return (async () => {
    const stopResult = await runActionCore(app, 'stop', `${id}-stop`, startedAtMs);
    if (!stopResult.ok) {
      return createResult({
        id,
        appId: app.id,
        action: 'restart',
        status: 'failed',
        ok: false,
        message: `restart stopped safely because stop failed: ${stopResult.message}`,
        ...(stopResult.errorCode ? { errorCode: stopResult.errorCode } : { errorCode: 'local_app_restart_stop_failed' }),
        ...(stopResult.error ? { error: stopResult.error } : {}),
        startedAtMs,
        steps: [
          ...stopResult.steps,
          { id: 'skip-start', label: 'Skip start after stop failure', type: 'validation', status: 'skipped', message: 'Start did not run because stop was not successful.' },
        ],
        allowlistedApp: true,
        allowlistedAction: true,
        nextState: stopResult.nextState,
      });
    }

    const startResult = await runActionCore(app, 'start', `${id}-start`, startedAtMs);
    return createResult({
      id,
      appId: app.id,
      action: 'restart',
      status: startResult.ok ? 'success' : 'failed',
      ok: startResult.ok,
      message: startResult.ok
        ? `restart completed through safe stop/start sequence.`
        : `restart stop/start sequence failed during start: ${startResult.message}`,
      ...(startResult.errorCode ? { errorCode: startResult.errorCode } : {}),
      ...(startResult.error ? { error: startResult.error } : {}),
      startedAtMs,
      steps: [
        ...stopResult.steps.map((step) => ({ ...step })),
        ...startResult.steps.map((step) => ({ ...step })),
      ],
      allowlistedApp: true,
      allowlistedAction: true,
      nextState: startResult.nextState,
    });
  })();
}

function looksLikeManagedNpmStartCommand(command: string | undefined, cwd?: string): boolean {
  if (!command) return false;
  const normalized = command.trim();
  if (/npm\s+(start|run\s+dev)(?:\s|$)/i.test(normalized)) return true;
  const scriptPath = resolveRepoLifecycleScriptPath(normalized, cwd);
  if (!scriptPath || !fs.existsSync(scriptPath)) return false;
  try {
    const script = fs.readFileSync(scriptPath, 'utf8');
    return /npm\s+(start|run\s+dev)(?:\s|>|&|$)/i.test(script);
  } catch {
    return false;
  }
}

function resolveRepoLifecycleScriptPath(command: string | undefined, cwd?: string): string | null {
  if (!command || !cwd) return null;
  const match = command.trim().match(/^bash\s+(scripts\/dev\/(?:start|stop|restart)-local\.sh)$/);
  if (!match) return null;
  return path.resolve(cwd, match[1] ?? '');
}

function isUnsafePortKillingScript(scriptPath: string): boolean {
  try {
    const script = fs.readFileSync(scriptPath, 'utf8');
    return /\blsof\b|\bpkill\b|\bkillall\b|\bkill\s+-9\b|\bkill\s+\$\{?PIDS\b/.test(script);
  } catch {
    return true;
  }
}

function isManualLaunchOnly(app: BrainCoreLocalAppDefinition): boolean {
  return /manual launch only/i.test(app.lifecycleNotes ?? '');
}

function requiresManagedNpmRegistryStop(app: BrainCoreLocalAppDefinition): boolean {
  return app.id === 'prochat' || app.id === 'jpv-bootcamp';
}

function readManagedProcessState(): ManagedProcessState {
  const registryPath = resolveManagedProcessRegistryPath();
  if (!registryPath) return { records: [] };
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(raw) as ManagedProcessState;
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    const cleaned = sanitizeManagedProcessRecords(records);
    if (cleaned.length !== records.length) {
      writeManagedProcessState({ records: cleaned });
    }
    return { records: cleaned };
  } catch {
    return { records: [] };
  }
}

function writeManagedProcessState(state: ManagedProcessState): void {
  const registryPath = resolveManagedProcessRegistryPath();
  if (!registryPath) return;
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify({ records: sanitizeManagedProcessRecords(state.records) }, null, 2)}\n`);
}

function recordManagedProcessStart(input: {
  appId: string;
  pid: number;
  startedAtMs: number;
  strategy: BrainCoreLocalAppManagedProcessRecord['strategy'];
  commandLabel: string;
  cwd: string;
}): void {
  if (!Number.isInteger(input.pid) || input.pid <= 0) return;
  const state = readManagedProcessState();
  const record: BrainCoreLocalAppManagedProcessRecord = {
    appId: input.appId,
    action: 'start',
    pid: input.pid,
    startedAt: new Date(input.startedAtMs).toISOString(),
    cwdSummary: summarizeCwd(input.cwd),
    strategy: input.strategy,
    commandLabel: redact(input.commandLabel),
  };
  const records = state.records.filter((entry) => !(entry.appId === input.appId && entry.strategy === input.strategy));
  records.push(record);
  writeManagedProcessState({ records });
}

function readManagedProcessForApp(appId: string): BrainCoreLocalAppManagedProcessRecord | null {
  const state = readManagedProcessState();
  for (const record of state.records) {
    if (record.appId !== appId) continue;
    if (record.strategy !== 'repo-npm-dev' && record.strategy !== 'repo-npm-start') continue;
    if (!isPidAlive(record.pid)) continue;
    return record;
  }
  return null;
}

function resolveManagedProcessRegistryPath(): string | null {
  const rawPath = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH || path.resolve(process.cwd(), 'runtime/local/local-apps/managed-processes.json');
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase()).filter(Boolean);
  if (segments.some((segment) => ['.env', '.git', 'node_modules', 'operations', 'mind'].includes(segment))) {
    return null;
  }
  return path.resolve(rawPath);
}

function sanitizeManagedProcessRecords(records: BrainCoreLocalAppManagedProcessRecord[]): BrainCoreLocalAppManagedProcessRecord[] {
  return records.filter((record): record is BrainCoreLocalAppManagedProcessRecord => {
    if (!record || typeof record !== 'object') return false;
    if (typeof record.appId !== 'string' || record.appId.trim().length === 0) return false;
    if (!Number.isInteger(record.pid) || record.pid <= 0) return false;
    if (record.strategy !== 'repo-npm-dev' && record.strategy !== 'repo-npm-start') return false;
    if (record.action !== 'start') return false;
    if (typeof record.startedAt !== 'string' || record.startedAt.trim().length === 0) return false;
    if (typeof record.cwdSummary !== 'string' || record.cwdSummary.trim().length === 0) return false;
    if (typeof record.commandLabel !== 'string' || record.commandLabel.trim().length === 0) return false;
    return isPidAlive(record.pid);
  }).map((record) => ({
    appId: record.appId,
    action: 'start',
    pid: record.pid,
    startedAt: record.startedAt,
    cwdSummary: record.cwdSummary,
    strategy: record.strategy,
    commandLabel: record.commandLabel,
  }));
}

async function executeManagedProcessStop(
  id: string,
  appId: string,
  action: BrainCoreLocalAppAction,
  managed: BrainCoreLocalAppManagedProcessRecord,
  startedAtMs: number,
): Promise<BrainCoreLocalAppActionResult> {
  const app = listLocalAppDefinitions().find((entry) => entry.id === appId);
  const stopSteps: BrainCoreLocalAppActionResultStep[] = [];

  if (!isPidAlive(managed.pid)) {
    clearManagedProcessRecord(appId, managed.pid);
    stopSteps.push(
      { id: 'validate-managed-process', label: 'Validate Brain Core-managed process', type: 'validation', status: 'success', message: 'The recorded PID was already absent.' },
      { id: 'clear-stale-record', label: 'Clear stale managed process record', type: 'report', status: 'success', message: 'Stale managed process state was cleared.' },
    );
  } else {
    try {
      processHandle.kill(managed.pid, 'SIGTERM');
      clearManagedProcessRecord(appId, managed.pid);
      stopSteps.push(
        { id: 'validate-managed-process', label: 'Validate Brain Core-managed process', type: 'validation', status: 'success', message: 'Recorded PID belongs to this app and is alive.' },
        { id: 'stop-managed-process', label: 'Stop Brain Core-managed process', type: 'service', status: 'success', message: `Sent SIGTERM to PID ${managed.pid}.` },
      );
    } catch (error) {
      return createResult({
        id, appId, action,
        status: 'failed', ok: false,
        message: 'Managed npm process stop failed safely.',
        errorCode: 'local_app_managed_stop_failed',
        error: redact(String(error instanceof Error ? error.message : error)),
        startedAtMs,
        steps: [{ id: 'validate-managed-process', label: 'Validate Brain Core-managed process', type: 'validation', status: 'failed', message: 'The managed PID could not be stopped safely.' }],
        allowlistedApp: true, allowlistedAction: true, nextState: 'unknown',
      });
    }
  }

  // Verify app port is actually closed
  if (app) {
    const verifyPhase = await verifyAppStopped(app);
    stopSteps.push(...verifyPhase.steps);
    if (!verifyPhase.ok) {
      return createResult({
        id, appId, action,
        status: 'failed', ok: false,
        message: `App process stopped but port did not close: ${(verifyPhase as any).reason}`,
        errorCode: 'local_app_stop_verify_failed',
        startedAtMs, steps: stopSteps,
        allowlistedApp: true, allowlistedAction: true, nextState: 'unknown',
      });
    }

    // Stop database
    const dbPhase = await stopDatabasePhase(app);
    stopSteps.push(...dbPhase.steps);
    return createResult({
      id, appId, action,
      status: dbPhase.ok ? 'success' : 'failed',
      ok: dbPhase.ok,
      message: dbPhase.ok
        ? 'Managed npm process and database stopped successfully.'
        : `App stopped but database did not stop: ${(dbPhase as any).reason}`,
      ...(dbPhase.ok ? {} : { errorCode: 'local_app_db_stop_failed' }),
      startedAtMs, steps: stopSteps,
      allowlistedApp: true, allowlistedAction: true,
      nextState: dbPhase.ok ? 'stopped' : 'unknown',
    });
  }

  return createResult({
    id, appId, action,
    status: 'success', ok: true,
    message: 'Managed npm process stopped successfully.',
    startedAtMs, steps: stopSteps,
    allowlistedApp: true, allowlistedAction: true, nextState: 'stopped',
  });
}

function clearManagedProcessRecord(appId: string, pid: number): void {
  const state = readManagedProcessState();
  const records = state.records.filter((entry) => !(entry.appId === appId && entry.pid === pid));
  writeManagedProcessState({ records });
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    processHandle.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function summarizeCwd(cwd: string): string {
  const relative = path.relative(process.cwd(), cwd);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
  return `[external-safe-runtime-path]/${path.basename(cwd)}`;
}

function createResult(input: {
  id: string;
  appId: string;
  action: BrainCoreLocalAppAction;
  status: BrainCoreLocalAppActionResult['status'];
  ok: boolean;
  message: string;
  errorCode?: string;
  error?: string;
  startedAtMs: number;
  steps: BrainCoreLocalAppActionResultStep[];
  allowlistedApp: boolean;
  allowlistedAction: boolean;
  nextState: BrainCoreLocalAppActionResult['nextState'];
  nextPollMs?: number;
}): BrainCoreLocalAppActionResult {
  const endedAtMs = Date.now();
  const endedAt = new Date(endedAtMs).toISOString();
  return {
    id: input.id,
    appId: input.appId,
    action: input.action,
    status: input.status,
    ok: input.ok,
    message: input.message,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.error ? { error: input.error } : {}),
    startedAt: new Date(input.startedAtMs).toISOString(),
    endedAt,
    finishedAt: endedAt,
    durationMs: Math.max(0, endedAtMs - input.startedAtMs),
    nextPollMs: input.nextPollMs ?? 1500,
    steps: input.steps,
    safety: {
      pluginExecutesShell: false,
      arbitraryCommandAllowed: false,
      commandOverrideAccepted: false,
      canonicalAppIdRequired: true,
      allowlistedDefinitionRequired: input.allowlistedApp,
      allowlistedApp: input.allowlistedApp,
      allowlistedAction: input.allowlistedAction,
      exposesSecrets: false,
    },
    nextState: input.nextState,
  };
}

function validationSteps(status: BrainCoreLocalAppActionResultStep['status'], message: string): BrainCoreLocalAppActionResultStep[] {
  return [{ id: 'validate-canonical-command', label: 'Validate canonical app/action command', type: 'validation', status, message }];
}

function executionSteps(status: BrainCoreLocalAppActionResultStep['status'], message: string): BrainCoreLocalAppActionResultStep[] {
  return [{ id: 'execute-allowlisted-command', label: 'Execute allowlisted Brain Core lifecycle command', type: 'service', status, message }];
}

function resolveSafeCwd(value: string | undefined): string | null {
  if (!value) return null;
  const resolved = path.resolve(expandHome(value));
  if (!isPathInsideAllowedRoot(resolved)) return null;
  try {
    const stat = fs.statSync(resolved) as unknown as { isDirectory: () => boolean };
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  return resolved;
}

function isPathInsideAllowedRoot(value: string): boolean {
  const resolved = path.resolve(value);
  const home = process.env.HOME || '/Users/Office';
  const roots = [
    path.join(home, 'Repos'),
    path.join(home, '.local', 'bin'),
  ].map((entry) => path.resolve(entry));
  return roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function expandHome(value: string): string {
  if (value === '~') return process.env.HOME || '/Users/Office';
  if (value.startsWith('~/')) return path.join(process.env.HOME || '/Users/Office', value.slice(2));
  return value;
}

function compactOutput(stdout: string, stderr: string): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  return redact(combined || 'no output');
}

function cap(value: string): string {
  return value.length <= OUTPUT_LIMIT ? value : value.slice(value.length - OUTPUT_LIMIT);
}

function redact(value: string): string {
  return value
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*=)[^\s]+/gi, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\//g, '[home]/')
    .slice(0, OUTPUT_LIMIT);
}

function redactPath(value: string): string {
  return value.replace(process.env.HOME || '/Users/Office', '~');
}

function containsSecretLikeText(value: string): boolean {
  return /(?:TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIAL|API[_-]?KEY)=/i.test(value);
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}
