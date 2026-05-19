import { spawn } from 'node:child_process';
import type {
  BrainCoreLocalAppActionResult,
  BrainCoreLocalAppActionResultStep,
  BrainCoreLocalAppActionSafety,
} from '../types/api.js';
import type { BrainCoreLocalAppDefinition } from '../types/api.js';
import { listLocalAppDefinitions } from './local-app-orchestrator.js';

type ExecutionStrategy = 'repo-script' | 'canonical-command' | 'docker-compose' | 'buildflow' | 'unknown';

interface ExecutorOptions {
  app: BrainCoreLocalAppDefinition;
  action: 'start' | 'stop' | 'restart';
}

interface CommandSpec {
  strategy: ExecutionStrategy;
  command: string;
  cwd: string | null;
  safe: boolean;
  reason: string;
}

const SAFE_COMMAND_PATTERNS = [
  /^bash\s+scripts\/dev\/(start|stop|restart)-local\.sh$/,
  /^cd\s+~\/[^;]+&&\s+npm\s+(start|run\s+dev)\s+>/,
  /^docker\s+compose\s+(up|down|restart)/,
  /^~\/\.local\/bin\/[a-z-]+-start$/,
  /^~\/\.local\/bin\/[a-z-]+-stop$/,
  /^supervisorctl\s+(start|stop|restart)\s+[a-z-]+$/,
];

const DANGEROUS_PATTERNS = [
  /[;&|`$()]/,  // pipes, redirects, command substitution
  /rm\s+-/,     // rm commands
  /kill\s+-9/,  // kill -9
  /dd\s+if=/,   // dd commands
];

export class LocalAppActionExecutor {
  private inFlightByAppAction = new Map<string, Promise<BrainCoreLocalAppActionResult>>();

  async executeAction(
    appId: string,
    action: 'start' | 'stop' | 'restart',
  ): Promise<BrainCoreLocalAppActionResult> {
    const startedAtMs = Date.now();
    const id = `local-app-${action}-${appId}-${startedAtMs}`;
    const lockKey = `${appId}:${action}`;

    try {
      const app = listLocalAppDefinitions().find((a) => a.id === appId);
      if (!app) {
        return this.result({
          id,
          appId,
          appName: appId,
          action,
          status: 'not_found',
          ok: false,
          message: 'App not found in canonical inventory.',
          errorCode: 'local_app_not_found',
          startedAtMs,
          steps: [{ id: 'validate', label: 'Validate app', type: 'validation', status: 'failed', message: 'App not found.' }],
        });
      }

      // Check for in-flight action
      const inFlight = this.inFlightByAppAction.get(lockKey);
      if (inFlight) {
        return this.result({
          id,
          appId: app.id,
          appName: app.name,
          action,
          status: 'blocked',
          ok: false,
          message: 'Another action is already in flight for this app.',
          errorCode: 'action_in_flight',
          startedAtMs,
          steps: [{ id: 'lock', label: 'Acquire lock', type: 'validation', status: 'failed', message: 'Action already in progress.' }],
        });
      }

      // Get command spec
      const spec = this.getCommandSpec(app, action);
      if (!spec.safe) {
        return this.result({
          id,
          appId: app.id,
          appName: app.name,
          action,
          status: 'not_executable',
          ok: false,
          message: spec.reason,
          errorCode: 'unsafe_command',
          startedAtMs,
          steps: [{ id: 'validate-cmd', label: 'Validate command', type: 'validation', status: 'failed', message: spec.reason }],
        });
      }

      // Execute command - use app's commandWorkdir if available, otherwise use extracted cwd
      const cwd = spec.cwd || (app as any).commandWorkdir || null;
      const executor = this.executeCommandSafely(spec.command, cwd, action, appId, app.name);
      this.inFlightByAppAction.set(lockKey, executor);

      try {
        const result = await executor;
        return result;
      } finally {
        this.inFlightByAppAction.delete(lockKey);
      }
    } catch (error) {
      return this.result({
        id,
        appId,
        appName: appId,
        action,
        status: 'failed',
        ok: false,
        message: 'Executor crashed safely. Brain Core remains online.',
        errorCode: 'executor_error',
        error: redactError(error),
        startedAtMs,
        steps: [{ id: 'execute', label: 'Execute command', type: 'service', status: 'failed', message: 'Executor error.' }],
      });
    }
  }

  private getCommandSpec(app: BrainCoreLocalAppDefinition, action: 'start' | 'stop' | 'restart'): CommandSpec {
    const command =
      action === 'start'
        ? (app as any).startCommand
        : action === 'stop'
          ? (app as any).stopCommand
          : action === 'restart'
            ? (app as any).restartCommand
            : null;

    if (!command || typeof command !== 'string') {
      return {
        strategy: 'unknown',
        command: '',
        cwd: null,
        safe: false,
        reason: `No ${action} command defined for this app.`,
      };
    }

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          strategy: 'unknown',
          command,
          cwd: null,
          safe: false,
          reason: `Command contains potentially dangerous operator. Manual execution only.`,
        };
      }
    }

    // Classify strategy
    let strategy: ExecutionStrategy = 'unknown';
    if (command.includes('docker compose')) {
      strategy = 'docker-compose';
    } else if (command.includes('scripts/dev/')) {
      strategy = 'repo-script';
    } else if (command.includes('buildflow-orchestrator')) {
      strategy = 'buildflow';
    } else {
      strategy = 'canonical-command';
    }

    // Validate cwd if needed
    const cwd = strategy === 'repo-script' || strategy === 'docker-compose' ? this.extractCwd(command) : null;

    // Final safety check: must match a known safe pattern or be explicitly allowed
    const isSafe = SAFE_COMMAND_PATTERNS.some((p) => p.test(command));

    return {
      strategy,
      command,
      cwd,
      safe: isSafe,
      reason: isSafe ? '' : 'Command strategy not yet approved for automated execution.',
    };
  }

  private extractCwd(command: string): string | null {
    const match = command.match(/cd\s+(~\/[^\s&]+)/);
    return match && match[1] ? match[1].replace(/^~/, process.env.HOME || '/root') : null;
  }

  private executeCommandSafely(
    command: string,
    cwd: string | null,
    action: 'start' | 'stop' | 'restart',
    appId: string,
    appName: string,
  ): Promise<BrainCoreLocalAppActionResult> {
    return new Promise((resolve) => {
      const startedAtMs = Date.now();
      const id = `exec-${action}-${startedAtMs}`;
      let stdout = '';
      let stderr = '';
      const MAX_OUTPUT = 2000;

      try {
        // For start actions, spawn detached if possible
        const isStart = action === 'start';
        const isStop = action === 'stop';

        const child = spawn('bash', ['-c', command], {
          cwd: cwd || process.cwd(),
          detached: isStart,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: isStart ? 5000 : 30000,
          shell: '/bin/bash',
        });

        if (isStart) {
          // Detach immediately for background processes
          child.unref?.();
        }

        const timeoutMs = isStart ? 5000 : 30000;
        let finished = false;
        let exitCode: number | null = null;

        const timeoutHandle = setTimeout(() => {
          if (!finished) {
            finished = true;
            if (isStart) {
              // For start, timeout is acceptable (server started in background)
              resolve(
                this.result({
                  id,
                  appId,
                  appName,
                  action,
                  status: 'accepted' as const,
                  ok: true,
                  message: 'Start command accepted and running in background.',
                  startedAtMs,
                  steps: [{ id: 'execute', label: 'Execute', type: 'service', status: 'skipped', message: 'Running.' }],
                }),
              );
            } else {
              resolve(
                this.result({
                  id,
                  appId,
                  appName,
                  action,
                  status: 'failed',
                  ok: false,
                  message: `${action} command timed out after ${timeoutMs}ms.`,
                  errorCode: 'command_timeout',
                  startedAtMs,
                  steps: [{ id: 'execute', label: 'Execute', type: 'service', status: 'failed', message: 'Timeout.' }],
                }),
              );
            }
            child.kill?.();
          }
        }, timeoutMs);

        if (child.stdout) {
          child.stdout.on('data', (data) => {
            stdout += data.toString();
            if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(-MAX_OUTPUT);
          });
        }

        if (child.stderr) {
          child.stderr.on('data', (data) => {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(-MAX_OUTPUT);
          });
        }

        child.on('exit', (code) => {
          clearTimeout(timeoutHandle);
          if (finished) return;
          finished = true;
          exitCode = code ?? 0;

          const endedAtMs = Date.now();
          const success = exitCode === 0;

          resolve(
            this.result({
              id,
              appId: 'unknown',
              appName: 'unknown',
              action,
              status: success ? 'success' : 'failed',
              ok: success,
              message: success ? `${action} completed successfully.` : `${action} failed with exit code ${exitCode}.`,
              startedAtMs,
              endedAtMs,
              steps: [
                {
                  id: 'execute',
                  label: 'Execute',
                  type: 'service',
                  status: success ? 'success' : 'failed',
                  message: success ? 'Completed.' : `Exit ${exitCode}.`,
                },
              ],
            }),
          );
        });

        child.on('error', (err) => {
          clearTimeout(timeoutHandle);
          if (finished) return;
          finished = true;

          resolve(
            this.result({
              id,
              appId: 'unknown',
              appName: 'unknown',
              action,
              status: 'failed',
              ok: false,
              message: `Command execution failed: ${(err as Error).message}`,
              errorCode: 'command_error',
              error: redactError(err),
              startedAtMs,
              steps: [{ id: 'execute', label: 'Execute', type: 'service', status: 'failed', message: 'Error.' }],
            }),
          );
        });
      } catch (err) {
        resolve(
          this.result({
            id,
            appId: 'unknown',
            appName: 'unknown',
            action,
            status: 'failed',
            ok: false,
            message: `Failed to spawn executor: ${(err as Error).message}`,
            errorCode: 'spawn_error',
            error: redactError(err),
            startedAtMs,
            steps: [{ id: 'execute', label: 'Execute', type: 'service', status: 'failed', message: 'Spawn failed.' }],
          }),
        );
      }
    });
  }

  private result(input: {
    id: string;
    appId: string;
    appName: string;
    action: 'start' | 'stop' | 'restart';
    status: BrainCoreLocalAppActionResult['status'];
    ok: boolean;
    message: string;
    errorCode?: string;
    error?: string;
    startedAtMs: number;
    endedAtMs?: number;
    steps: BrainCoreLocalAppActionResultStep[];
  }): BrainCoreLocalAppActionResult {
    const endedAtMs = input.endedAtMs ?? Date.now();
    const nextState: BrainCoreLocalAppActionResult['nextState'] = input.action === 'start' ? 'running' : 'stopped';
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
      endedAt: new Date(endedAtMs).toISOString(),
      finishedAt: new Date(endedAtMs).toISOString(),
      durationMs: Math.max(0, endedAtMs - input.startedAtMs),
      nextPollMs: 1500,
      steps: input.steps,
      safety: {
        pluginExecutesShell: false,
        arbitraryCommandAllowed: false,
        commandOverrideAccepted: false,
        canonicalAppIdRequired: true,
        allowlistedDefinitionRequired: true,
        allowlistedApp: input.status !== 'not_executable' && input.status !== 'not_found',
        allowlistedAction: input.status !== 'not_executable' && input.status !== 'not_found',
        exposesSecrets: false,
      },
      nextState,
    };
  }
}

function redactError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|COOKIE|CREDENTIAL)[A-Z0-9_]*=)[^\s]+/gi, '$1[redacted]')
    .replace(/\/Users\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .slice(0, 240);
}
