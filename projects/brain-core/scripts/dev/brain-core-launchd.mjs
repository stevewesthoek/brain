#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const LABEL = 'com.office.brain-core';
const DEFAULT_PORT = 4877;
const DEFAULT_UID = process.getuid?.() ?? 502;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..', '..');
const sourcePlist = path.resolve(repoRoot, 'operations', 'system-configs', 'launchagents', `${LABEL}.plist`);
const installedPlist = path.resolve(process.env.HOME ?? '/Users/Office', 'Library', 'LaunchAgents', `${LABEL}.plist`);
const operationId = process.env.BRAIN_CORE_RESTART_OPERATION_ID ?? `brain-core-restart-${Date.now()}`;
const logPath = process.env.BRAIN_CORE_RESTART_LOG_PATH ?? path.resolve(repoRoot, 'runtime', 'local', 'brain-core', 'restart.log');
const port = Number.parseInt(process.env.BRAIN_CORE_PORT ?? `${DEFAULT_PORT}`, 10);

const logFd = fs.openSync(logPath, 'a');

main().catch((error) => {
  writeLog(`fatal ${formatError(error)}`);
  fs.closeSync(logFd);
  process.exitCode = 1;
});

async function main() {
  const command = (process.argv[2] ?? 'restart').trim().toLowerCase();
  writeLog(`begin command=${command} label=${LABEL} port=${port} repoRoot=${repoRoot}`);
  await ensurePlistInstalled();
  if (command !== 'restart') {
    throw new Error(`Unsupported command: ${command}. This helper currently implements restart only.`);
  }
  await restartViaLaunchd();
  writeLog(`restart completed operationId=${operationId}`);
  fs.closeSync(logFd);
}

async function restartViaLaunchd() {
  const uid = DEFAULT_UID;
  const domain = `gui/${uid}`;

  const before = await launchctlPrint();
  if (before.loaded) {
    writeLog(`launchd stop requested for ${LABEL}`);
    await execLaunchctl(['bootout', domain, installedPlist]);
  } else {
    writeLog(`launchd job not loaded; bootstrapping ${LABEL}`);
  }

  if (await isPortListening()) {
    await stopLegacyBrainCoreIfNeeded();
  }
  await waitForPortFree();

  await execLaunchctl(['bootstrap', domain, installedPlist]);
  writeLog(`launchd bootstrap complete for ${LABEL}`);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await isPortListening()) {
      const status = await waitForStatus();
      if (status.ok) {
        writeLog(`status verified via ${status.url}`);
        return;
      }
      writeLog(`status probe failed: ${status.error}`);
    }
    await sleep(500);
  }

  throw new Error('Brain Core did not report healthy within 60s after launchd restart.');
}

async function ensurePlistInstalled() {
  if (!fs.existsSync(sourcePlist)) {
    throw new Error(`LaunchAgent source plist is missing: ${sourcePlist}`);
  }
  if (fs.existsSync(installedPlist)) return;
  fs.mkdirSync(path.dirname(installedPlist), { recursive: true });
  fs.copyFileSync(sourcePlist, installedPlist);
  writeLog(`installed launchd plist to ${installedPlist}`);
}

async function launchctlPrint() {
  try {
    const { stdout } = await execFileAsync('launchctl', ['print', `gui/${DEFAULT_UID}/${LABEL}`], { timeout: 5000 });
    return { loaded: true, stdout };
  } catch {
    return { loaded: false, stdout: '' };
  }
}

async function execLaunchctl(args) {
  const { stdout, stderr } = await execFileAsync('launchctl', args, { timeout: 10000 });
  if (stdout.trim()) writeLog(stdout.trim());
  if (stderr.trim()) writeLog(stderr.trim());
}

async function waitForPortFree() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (!(await isPortListening())) {
      writeLog(`stop verified: port ${port} is free`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`Port ${port} is still occupied after launchd stop.`);
}

async function stopLegacyBrainCoreIfNeeded() {
  const legacyTargets = await findLegacyBrainCoreTargets();
  if (legacyTargets.length === 0) return;

  writeLog(`legacy fallback stop identified ${legacyTargets.length} target(s)`);
  for (const proc of legacyTargets) {
    writeLog(`legacy stop target pid=${proc.pid} command=${proc.command}`);
    try {
      process.kill(proc.pid, 'SIGTERM');
    } catch (error) {
      writeLog(`legacy stop SIGTERM failed for pid=${proc.pid}: ${formatError(error)}`);
    }
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const remaining = await findLegacyBrainCoreTargets();
    if (remaining.length === 0 && !(await isPortListening())) {
      writeLog('legacy fallback stop verified: port is free and stale processes are gone');
      return;
    }
    await sleep(250);
  }

  const stale = await findLegacyBrainCoreTargets();
  if (stale.length > 0 || await isPortListening()) {
    const summary = stale.map((proc) => `pid=${proc.pid} command=${proc.command}`).join('; ');
    throw new Error(`Legacy Brain Core process still holds port ${port}${summary ? ` (${summary})` : ''}`);
  }
}

async function isPortListening() {
  const net = await import('node:net');
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.once('error', () => resolve(false));
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function findLegacyBrainCoreTargets() {
  const { stdout } = await execFileAsync('ps', ['-axww', '-o', 'pid=,ppid=,command='], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) return null;
      return {
        pid: Number.parseInt(match[1] ?? '0', 10),
        ppid: Number.parseInt(match[2] ?? '0', 10),
        command: match[3] ?? '',
      };
    })
    .filter((entry) => Boolean(entry))
    .filter((proc) => {
      if (!proc) return false;
      if (proc.pid === process.pid) return false;
      if (proc.command.includes('brain-core-launchd.mjs')) return false;
      return proc.command.includes('/Users/Office/Repos/stevewesthoek/brain/projects/brain-core')
        && (
          proc.command.includes('dist/index.js')
          || proc.command.includes('npm run dev')
          || proc.command.includes('tsx watch src/index.ts')
          || proc.command.includes('node dist/index.js')
        );
    });
}

async function waitForStatus() {
  const url = `http://127.0.0.1:${port}/status`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}`, url };
    const body = await response.json().catch(() => null);
    return { ok: Boolean(body?.ok), error: body?.ok ? null : 'status response reported ok=false', url };
  } catch (error) {
    clearTimeout(timeout);
    return { ok: false, error: error instanceof Error ? error.message : 'status check failed', url };
  }
}

function writeLog(message) {
  fs.writeSync(logFd, `${new Date().toISOString()} [${operationId}] ${message}\n`);
}

function formatError(error) {
  return error instanceof Error ? `${error.message}\n${error.stack ?? ''}`.trim() : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
