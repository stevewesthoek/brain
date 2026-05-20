import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreLocalAppAction,
  BrainCoreLocalAppActionResult,
  BrainCoreLocalAppActionResultStep,
} from '../types/api.js';
import type { BrainCoreLocalAppDefinition } from '../types/api.js';
import { listLocalAppDefinitions } from './local-app-orchestrator.js';

type ExecutionStrategy =
  | 'repo-dev-script'
  | 'repo-npm-dev'
  | 'repo-npm-start'
  | 'docker-compose'
  | 'absolute-helper'
  | 'supervisorctl'
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
};

const OUTPUT_LIMIT = 1800;
const inflightByApp = new Map<string, Promise<BrainCoreLocalAppActionResult>>();

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

    const spec = buildCommandSpec(app, action);
    if (!spec.executable) {
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

    const execution = executeSpec(id, app.id, action, spec, startedAtMs);
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

function buildCommandSpec(app: BrainCoreLocalAppDefinition, action: BrainCoreLocalAppAction): SafeCommandSpec {
  const rawCommand = action === 'start' ? app.startCommand : action === 'stop' ? app.stopCommand : app.restartCommand;
  if (!rawCommand) return disabled(`No canonical ${action} command is defined for this app.`);

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
    return scriptSpec('repo-dev-script', commandCwd, script, action);
  }

  const absoluteBash = commandBody.match(/^bash\s+(~?\/?[^\s;&|`$()]+\/(?:start|stop|restart|buildflow-orchestrator|stop-firecrawl|restart-xgrow|stop-xgrow)[^\s;&|`$()]*(?:\.sh)?)\s*(start|stop|restart)?$/);
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

function scriptSpec(strategy: ExecutionStrategy, cwd: string, script: string, action: BrainCoreLocalAppAction): SafeCommandSpec {
  const scriptPath = path.resolve(cwd, script);
  if (!isPathInsideAllowedRoot(scriptPath) || !fs.existsSync(scriptPath)) return disabled('Repo lifecycle script is registered but missing or outside allowlisted roots.');
  return {
    executable: true,
    reason: 'Canonical repo lifecycle script is allowlisted for Brain Core execution.',
    strategy,
    commandLabel: `bash ${script}`,
    file: 'bash',
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
      const child = spawn(spec.file, spec.args, {
        cwd: spec.cwd,
        detached: spec.detached,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: process.env,
      });

      if (spec.detached) child.unref();

      const finish = (result: BrainCoreLocalAppActionResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
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
