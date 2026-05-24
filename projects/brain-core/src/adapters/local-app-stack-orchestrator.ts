import { execFile } from 'node:child_process';
import net from 'node:net';
import type {
  BrainCoreLocalAppDefinition,
  BrainCoreLocalAppActionResultStep,
} from '../types/api.js';

const DB_START_TIMEOUT_MS = 30_000;
const DB_STOP_TIMEOUT_MS = 15_000;
const PORT_POLL_INTERVAL_MS = 500;
const APP_STOP_GRACE_MS = 8_000;
const APP_START_VERIFY_TIMEOUT_MS = 30_000;
const APP_STOP_VERIFY_TIMEOUT_MS = 15_000;
const APP_HEALTH_CHECK_TIMEOUT_MS = 3_000;

export type StackStep = BrainCoreLocalAppActionResultStep;

export type StackPhaseResult =
  | { ok: true; steps: StackStep[] }
  | { ok: false; steps: StackStep[]; reason: string };

// ─── Port probing ────────────────────────────────────────────────────────────

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket
      .on('connect', () => { socket.destroy(); resolve(true); })
      .on('error', () => { socket.destroy(); resolve(false); })
      .on('timeout', () => { socket.destroy(); resolve(false); })
      .connect(port, '127.0.0.1');
  });
}

async function waitForPort(port: number, wantUp: boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const up = await isPortListening(port);
    if (up === wantUp) return true;
    await sleep(PORT_POLL_INTERVAL_MS);
  }
  return false;
}

// ─── Docker container control ────────────────────────────────────────────────

function dockerCmd(args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout: 20_000 }, (err, stdout, stderr) => {
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join(' ').slice(0, 400);
      resolve({ ok: !err, output });
    });
  });
}

async function dockerContainerState(containerName: string): Promise<'running' | 'stopped' | 'unknown'> {
  const result = await dockerCmd(['inspect', '--format', '{{.State.Status}}', containerName]);
  if (!result.ok) return 'unknown';
  const state = result.output.trim().toLowerCase();
  if (state === 'running') return 'running';
  if (state === 'exited' || state === 'created' || state === 'paused') return 'stopped';
  return 'unknown';
}

async function startContainer(containerName: string): Promise<{ ok: boolean; output: string }> {
  return dockerCmd(['start', containerName]);
}

async function stopContainer(containerName: string): Promise<{ ok: boolean; output: string }> {
  return dockerCmd(['stop', '--time', '10', containerName]);
}

// ─── DB phase: start ─────────────────────────────────────────────────────────

export async function startDatabasePhase(app: BrainCoreLocalAppDefinition): Promise<StackPhaseResult> {
  const db = app.database;
  if (!db) return { ok: true, steps: [] };

  const containerName = db.containerName;
  const port = db.hostPort;

  const steps: StackStep[] = [];

  // Check current state first
  if (containerName) {
    const state = await dockerContainerState(containerName);
    if (state === 'running') {
      if (port) {
        const up = await isPortListening(port);
        if (up) {
          steps.push(step('db-already-running', 'Database', 'validation', 'success',
            `Container ${containerName} already running and port ${port} is accepting connections.`));
          return { ok: true, steps };
        }
      } else {
        steps.push(step('db-already-running', 'Database', 'validation', 'success',
          `Container ${containerName} already running.`));
        return { ok: true, steps };
      }
    }

    const startResult = await startContainer(containerName);
    if (!startResult.ok) {
      steps.push(step('db-start', 'Start database container', 'database', 'failed',
        `docker start ${containerName} failed: ${startResult.output}`));
      return { ok: false, steps, reason: `Failed to start database container ${containerName}: ${startResult.output}` };
    }
    steps.push(step('db-start', 'Start database container', 'database', 'success',
      `docker start ${containerName}: ${startResult.output || 'ok'}`));
  } else {
    steps.push(step('db-no-container', 'Database container name', 'validation', 'skipped',
      'No container name registered; skipping Docker start. Assuming database is externally managed.'));
  }

  if (port) {
    const up = await waitForPort(port, true, DB_START_TIMEOUT_MS);
    if (!up) {
      steps.push(step('db-port-verify', `Verify database port ${port}`, 'health-check', 'failed',
        `Port ${port} did not come up within ${DB_START_TIMEOUT_MS / 1000}s.`));
      return { ok: false, steps, reason: `Database port ${port} did not open within ${DB_START_TIMEOUT_MS / 1000}s.` };
    }
    steps.push(step('db-port-verify', `Verify database port ${port}`, 'health-check', 'success',
      `Port ${port} is accepting connections.`));
  }

  return { ok: true, steps };
}

// ─── DB phase: stop ──────────────────────────────────────────────────────────

export async function stopDatabasePhase(app: BrainCoreLocalAppDefinition): Promise<StackPhaseResult> {
  const db = app.database;
  if (!db) return { ok: true, steps: [] };

  const containerName = db.containerName;
  const port = db.hostPort;

  const steps: StackStep[] = [];

  if (containerName) {
    const state = await dockerContainerState(containerName);
    if (state !== 'running') {
      steps.push(step('db-already-stopped', 'Database', 'validation', 'success',
        `Container ${containerName} is already stopped.`));
      return { ok: true, steps };
    }

    const stopResult = await stopContainer(containerName);
    if (!stopResult.ok) {
      steps.push(step('db-stop', 'Stop database container', 'database', 'failed',
        `docker stop ${containerName} failed: ${stopResult.output}`));
      return { ok: false, steps, reason: `Failed to stop database container ${containerName}: ${stopResult.output}` };
    }
    steps.push(step('db-stop', 'Stop database container', 'database', 'success',
      `docker stop ${containerName}: ${stopResult.output || 'ok'}`));
  } else {
    steps.push(step('db-no-container', 'Database container name', 'validation', 'skipped',
      'No container name registered; skipping Docker stop.'));
  }

  if (port) {
    const down = await waitForPort(port, false, DB_STOP_TIMEOUT_MS);
    if (!down) {
      steps.push(step('db-port-verify', `Verify database port ${port} closed`, 'health-check', 'failed',
        `Port ${port} still listening after ${DB_STOP_TIMEOUT_MS / 1000}s.`));
      return { ok: false, steps, reason: `Database port ${port} did not close within ${DB_STOP_TIMEOUT_MS / 1000}s.` };
    }
    steps.push(step('db-port-verify', `Verify database port ${port} closed`, 'health-check', 'success',
      `Port ${port} is no longer accepting connections.`));
  }

  return { ok: true, steps };
}

// ─── App phase: verify started ───────────────────────────────────────────────

export async function verifyAppStarted(app: BrainCoreLocalAppDefinition): Promise<StackPhaseResult> {
  const port = app.appPort;
  if (!port) {
    return { ok: true, steps: [step('app-port-verify', 'Verify app port', 'health-check', 'skipped', 'No app port registered; cannot verify.')] };
  }

  const up = await waitForPort(port, true, APP_START_VERIFY_TIMEOUT_MS);
  if (!up) {
    return {
      ok: false,
      steps: [step('app-port-verify', `Verify app port ${port}`, 'health-check', 'failed',
        `App port ${port} did not come up within ${APP_START_VERIFY_TIMEOUT_MS / 1000}s.`)],
      reason: `App did not start: port ${port} never opened within ${APP_START_VERIFY_TIMEOUT_MS / 1000}s.`,
    };
  }
  return {
    ok: true,
    steps: [step('app-port-verify', `Verify app port ${port}`, 'health-check', 'success',
      `App port ${port} is accepting connections.`)],
  };
}

export async function isAppAlreadyRunning(app: BrainCoreLocalAppDefinition): Promise<StackPhaseResult> {
  const steps: StackStep[] = [];
  const port = app.appPort;
  const healthUrl = app.healthUrl || app.appUrl;

  if (healthUrl) {
    const healthy = await probeHealthUrl(healthUrl, APP_HEALTH_CHECK_TIMEOUT_MS);
    if (healthy) {
      steps.push(step('app-health-verify', `Verify app health ${healthUrl}`, 'health-check', 'success', `Health endpoint ${healthUrl} returned ok.`));
      return { ok: true, steps };
    }
    steps.push(step('app-health-verify', `Verify app health ${healthUrl}`, 'health-check', 'failed', `Health endpoint ${healthUrl} did not return ok.`));
  }

  if (!port) {
    return { ok: false, steps, reason: 'No app port registered; cannot determine running state.' };
  }

  const listening = await isPortListening(port);
  if (listening) {
    steps.push(step('app-port-verify', `Verify app port ${port}`, 'health-check', 'success', `App port ${port} is accepting connections.`));
    if (healthUrl) {
      return { ok: false, steps, reason: `App port ${port} is open but ${healthUrl} is not healthy.` };
    }
    return { ok: true, steps };
  }

  steps.push(step('app-port-verify', `Verify app port ${port}`, 'health-check', 'failed', `App port ${port} is not accepting connections.`));
  return { ok: false, steps, reason: `App port ${port} is not open.` };
}

// ─── App phase: verify stopped ───────────────────────────────────────────────

export async function verifyAppStopped(app: BrainCoreLocalAppDefinition): Promise<StackPhaseResult> {
  const port = app.appPort;
  if (!port) {
    return { ok: true, steps: [step('app-port-verify', 'Verify app stopped', 'health-check', 'skipped', 'No app port registered; cannot verify.')] };
  }

  // Give graceful shutdown a moment
  await sleep(APP_STOP_GRACE_MS);

  const down = await waitForPort(port, false, APP_STOP_VERIFY_TIMEOUT_MS);
  if (!down) {
    // Port still up — kill whatever is on it
    const killResult = await forceKillPort(port);
    const forceDown = await waitForPort(port, false, 5_000);
    if (!forceDown) {
      return {
        ok: false,
        steps: [step('app-port-verify', `Verify app port ${port} closed`, 'health-check', 'failed',
          `Port ${port} still listening after graceful stop and force kill. ${killResult}`)],
        reason: `App did not stop: port ${port} still open after force kill.`,
      };
    }
    return {
      ok: true,
      steps: [step('app-port-verify', `Verify app port ${port} closed`, 'health-check', 'success',
        `Port ${port} closed after force kill. ${killResult}`)],
    };
  }
  return {
    ok: true,
    steps: [step('app-port-verify', `Verify app port ${port} closed`, 'health-check', 'success',
      `App port ${port} is no longer accepting connections.`)],
  };
}

// ─── Force-kill any process holding a port ───────────────────────────────────

function forceKillPort(port: number): Promise<string> {
  return new Promise((resolve) => {
    execFile('lsof', ['-ti', `:${port}`], (err, stdout) => {
      if (err || !stdout.trim()) { resolve('no process found on port'); return; }
      const pids = stdout.trim().split('\n').filter(Boolean);
      let killed = 0;
      for (const pid of pids) {
        try {
          (process as any).kill(parseInt(pid, 10), 'SIGKILL');
          killed++;
        } catch { /* ignore */ }
      }
      resolve(`SIGKILL sent to ${killed} process(es) on port ${port}`);
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function step(
  id: string,
  label: string,
  type: StackStep['type'],
  status: StackStep['status'],
  message: string,
): StackStep {
  return { id, label, type, status, message };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeHealthUrl(healthUrl: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
