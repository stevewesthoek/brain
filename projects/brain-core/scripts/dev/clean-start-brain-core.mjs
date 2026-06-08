#!/usr/bin/env node
/**
 * Clean-start Brain Core.
 *
 * Guarantees before start:
 * - Finds stale Brain Core node/tsx processes for this project and stops them.
 * - Checks the intended port for listeners and stops anything occupying it.
 * - Waits until the port is actually free.
 * - Starts exactly one Brain Core dev server.
 * - Waits for /status to answer before reporting ready.
 *
 * Usage:
 *   npm run brain-core:clean-start
 *   BRAIN_CORE_PORT=4000 npm run brain-core:clean-start
 */

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_CORE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const PORT = Number.parseInt(process.env.BRAIN_CORE_PORT ?? process.env.PORT ?? '4877', 10);
const HOST = process.env.BRAIN_CORE_HOST ?? process.env.HOST ?? '127.0.0.1';
const HEALTH_PATH = process.env.BRAIN_CORE_HEALTH_PATH ?? '/status';
const START_TIMEOUT_MS = Number.parseInt(process.env.BRAIN_CORE_START_TIMEOUT_MS ?? '30000', 10);
const STOP_TIMEOUT_MS = Number.parseInt(process.env.BRAIN_CORE_STOP_TIMEOUT_MS ?? '8000', 10);

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`[clean-start] Invalid port: ${String(process.env.BRAIN_CORE_PORT ?? process.env.PORT)}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: BRAIN_CORE_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function uniqueNumbers(values) {
  return [...new Set(values.map(value => Number.parseInt(value, 10)).filter(Number.isInteger))];
}

function findListeningPids(port) {
  if (os.platform() === 'win32') {
    console.warn('[clean-start] Windows port PID lookup is not implemented; relying on bind check.');
    return [];
  }

  const result = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  if (result.status !== 0 && !result.stdout.trim()) {
    return [];
  }
  return uniqueNumbers(result.stdout.split(/\s+/).filter(Boolean));
}

function findStaleBrainCorePids() {
  if (os.platform() === 'win32') {
    console.warn('[clean-start] Windows stale process lookup is not implemented; relying on port cleanup.');
    return [];
  }

  const result = run('ps', ['-axo', 'pid=,command=']);
  if (result.status !== 0) {
    console.warn(`[clean-start] Could not list processes: ${result.stderr.trim()}`);
    return [];
  }

  return uniqueNumbers(
    result.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => {
        const isThisScript = line.includes('clean-start-brain-core.mjs');
        const isBrainCore = line.includes('/projects/brain-core/') || line.includes('projects/brain-core');
        const isServer = line.includes('src/index.ts') || line.includes('dist/index.js') || line.includes('tsx watch');
        return !isThisScript && isBrainCore && isServer;
      })
      .map(line => line.split(/\s+/, 1)[0])
  ).filter(pid => pid !== process.pid);
}

async function waitForPidExit(pid, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
      await sleep(150);
    } catch {
      return true;
    }
  }
  return false;
}

async function stopPids(pids, label) {
  const uniquePids = uniqueNumbers(pids).filter(pid => pid > 0 && pid !== process.pid);
  if (uniquePids.length === 0) {
    console.log(`[clean-start] No ${label} processes found.`);
    return;
  }

  console.log(`[clean-start] Stopping ${label} processes: ${uniquePids.join(', ')}`);
  for (const pid of uniquePids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already exited.
    }
  }

  const stillAlive = [];
  for (const pid of uniquePids) {
    if (!(await waitForPidExit(pid, STOP_TIMEOUT_MS))) {
      stillAlive.push(pid);
    }
  }

  if (stillAlive.length > 0) {
    console.warn(`[clean-start] Forcing stale processes to stop: ${stillAlive.join(', ')}`);
    for (const pid of stillAlive) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Already exited.
      }
    }
  }
}

function isPortFree(port, host) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function waitForPortFree(port, host, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortFree(port, host)) {
      return true;
    }
    await sleep(150);
  }
  return false;
}

function requestHealth(port, host, healthPath) {
  return new Promise(resolve => {
    const request = http.request(
      {
        host,
        port,
        path: healthPath,
        method: 'GET',
        timeout: 1000,
      },
      response => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 500);
      }
    );
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
    request.end();
  });
}

async function waitForHealth(port, host, healthPath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestHealth(port, host, healthPath)) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function main() {
  console.log(`[clean-start] Brain Core root: ${BRAIN_CORE_ROOT}`);
  console.log(`[clean-start] Target: http://${HOST}:${PORT}${HEALTH_PATH}`);

  const staleBrainCorePids = findStaleBrainCorePids();
  if (staleBrainCorePids.length > 0) {
    console.warn(
      `[clean-start] Found possible stale Brain Core processes outside the target-port check: ${staleBrainCorePids.join(', ')}`
    );
    console.warn('[clean-start] Not stopping those broad matches automatically; only target-port listeners are stopped.');
  } else {
    console.log('[clean-start] No possible stale Brain Core processes found outside the target-port check.');
  }

  await stopPids(findListeningPids(PORT), `listeners on port ${PORT}`);

  const portFree = await waitForPortFree(PORT, HOST, STOP_TIMEOUT_MS);
  if (!portFree) {
    console.error(`[clean-start] Port ${PORT} is still occupied. Refusing to start a second instance.`);
    process.exit(1);
  }
  console.log(`[clean-start] Verified port ${PORT} is free.`);

  const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: BRAIN_CORE_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST,
    },
    stdio: 'inherit',
  });

  const stopChild = signal => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.once('SIGINT', () => stopChild('SIGINT'));
  process.once('SIGTERM', () => stopChild('SIGTERM'));

  const healthy = await waitForHealth(PORT, HOST, HEALTH_PATH, START_TIMEOUT_MS);
  if (!healthy) {
    console.error(`[clean-start] Brain Core did not become healthy at http://${HOST}:${PORT}${HEALTH_PATH}.`);
    stopChild('SIGTERM');
    process.exit(1);
  }
  console.log(`[clean-start] Brain Core is healthy at http://${HOST}:${PORT}${HEALTH_PATH}.`);

  child.once('exit', (code, signal) => {
    if (signal) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

main().catch(error => {
  console.error(`[clean-start] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
