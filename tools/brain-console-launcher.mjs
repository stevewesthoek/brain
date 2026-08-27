#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runtimeRoot = path.resolve(process.env.BRAIN_CONSOLE_RUNTIME_ROOT ?? repoRoot);
const home = process.env.HOME ?? os.homedir();

const CORE_LABEL = 'com.office.brain-core';
const CORE_PORT = 4877;
const CONSOLE_PORT = 4881;
const CORE_HOST = '127.0.0.1';
const CORE_PROJECT_ROOT = path.join(runtimeRoot, 'projects', 'brain-core');
const CONSOLE_PROJECT_ROOT = path.join(runtimeRoot, 'projects', 'brain-console');
const CORE_ENTRY = path.join(CORE_PROJECT_ROOT, 'dist', 'index.js');
const SOURCE_PLIST = path.join(repoRoot, 'operations', 'system-configs', 'launchagents', `${CORE_LABEL}.plist`);
const INSTALLED_PLIST = path.join(home, 'Library', 'LaunchAgents', `${CORE_LABEL}.plist`);
const LOG_DIR = path.join(home, 'Library', 'Logs', 'Brain Console');
const LAUNCHER_LOG = path.join(LOG_DIR, 'launcher.log');
const CONSOLE_STDOUT_LOG = path.join(LOG_DIR, 'console.stdout.log');
const CONSOLE_STDERR_LOG = path.join(LOG_DIR, 'console.stderr.log');
const LOCK_DIR = path.join(home, 'Library', 'Application Support', 'Brain Console', 'launcher.lock');
const LOCK_PID = path.join(LOCK_DIR, 'pid');
const UID = process.getuid?.() ?? 502;
const DOMAIN = `gui/${UID}`;
const MAX_LOG_BYTES = 1_000_000;

let logFd;

await main();

async function main() {
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify({
      runtimeRoot,
      coreEntry: CORE_ENTRY,
      consoleProjectRoot: CONSOLE_PROJECT_ROOT,
      sourcePlist: SOURCE_PLIST,
      installedPlist: INSTALLED_PLIST,
      consoleUrl: `http://localhost:${CONSOLE_PORT}/monitoring`,
    }, null, 2)}\n`);
    return;
  }

  prepareLog();
  writeLog(`begin runtimeRoot=${runtimeRoot}`);

  try {
    validateRuntimeFiles();
    await withLauncherLock(async () => {
      await ensureBrainCore();
      await ensureBrainConsole();
      await execFileAsync('/usr/bin/open', [`http://localhost:${CONSOLE_PORT}/monitoring`], { timeout: 10_000 });
      writeLog(`browser opened url=http://localhost:${CONSOLE_PORT}/monitoring`);
    });
    writeLog('complete');
  } catch (error) {
    const message = safeErrorMessage(error);
    writeLog(`failed error=${message}`);
    notify(`Unable to open: ${message}`);
    process.exitCode = 1;
  } finally {
    if (logFd !== undefined) fs.closeSync(logFd);
  }
}

function validateRuntimeFiles() {
  for (const file of [SOURCE_PLIST, CORE_ENTRY, path.join(CONSOLE_PROJECT_ROOT, 'package.json')]) {
    if (!fs.existsSync(file)) throw new Error(`runtime file missing: ${file}`);
  }
}

async function withLauncherLock(task) {
  fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(LOCK_DIR);
      fs.writeFileSync(LOCK_PID, `${process.pid}\n`, 'utf8');
      try {
        return await task();
      } finally {
        fs.rmSync(LOCK_DIR, { recursive: true, force: true });
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (!lockOwnerAlive()) fs.rmSync(LOCK_DIR, { recursive: true, force: true });
      else await sleep(500);
    }
  }
  throw new Error('another Brain Console launch is still in progress');
}

function lockOwnerAlive() {
  try {
    const pid = Number.parseInt(fs.readFileSync(LOCK_PID, 'utf8').trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ensureBrainCore() {
  const current = await serviceState(CORE_PORT, 'core');
  const installed = readInstalledPlist();
  const identityCorrect = installed !== null && plistIdentityMatches(installed);
  const managed = await launchctlPrint();
  const managedOwnsPort = current.listening && managed.loaded && managed.stdout.includes(processEntryPath(current.command));

  if (current.listening && !current.canonicalOwner && !managedOwnsPort) {
    throw new Error(`Core port ${CORE_PORT} is occupied by an unknown process`);
  }

  if (current.healthy && current.canonicalOwner && identityCorrect && managed.loaded) {
    writeLog(`core reused pid=${current.pid}`);
    return;
  }

  if (current.healthy && current.canonicalOwner && identityCorrect && !managed.loaded) {
    throw new Error('Core is healthy but not owned by the canonical LaunchAgent');
  }

  writeLog(`core reconciliation requested loaded=${managed.loaded} installedIdentity=${identityCorrect}`);
  writeInstalledPlist();

  if (managed.loaded) {
    await execLaunchctl(['bootout', DOMAIN, INSTALLED_PLIST]);
    writeLog(`core LaunchAgent bootout requested label=${CORE_LABEL}`);
    await waitForPortFree(CORE_PORT, 20_000);
  } else if (await isPortListening(CORE_PORT)) {
    throw new Error(`Core port ${CORE_PORT} remains occupied after identity check`);
  }

  await execLaunchctl(['bootstrap', DOMAIN, INSTALLED_PLIST]);
  writeLog(`core LaunchAgent bootstrap requested label=${CORE_LABEL}`);
  await waitForCoreHealthy(60_000);
}

async function ensureBrainConsole() {
  const current = await serviceState(CONSOLE_PORT, 'console');
  if (current.listening && !current.canonicalOwner) {
    throw new Error(`Console port ${CONSOLE_PORT} is occupied by an unknown process`);
  }
  if (current.healthy && current.canonicalOwner) {
    writeLog(`console reused pid=${current.pid}`);
    return;
  }
  if (current.listening) {
    throw new Error(`Console port ${CONSOLE_PORT} is occupied but not healthy`);
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  rotateLogIfNeeded(CONSOLE_STDOUT_LOG);
  rotateLogIfNeeded(CONSOLE_STDERR_LOG);
  const stdout = fs.openSync(CONSOLE_STDOUT_LOG, 'a');
  const stderr = fs.openSync(CONSOLE_STDERR_LOG, 'a');
  const child = spawn('/opt/homebrew/bin/npm', ['run', 'dev'], {
    cwd: CONSOLE_PROJECT_ROOT,
    detached: true,
    env: { ...process.env, NEXT_PUBLIC_BRAIN_CORE_URL: `http://${CORE_HOST}:${CORE_PORT}` },
    stdio: ['ignore', stdout, stderr],
  });
  child.unref();
  writeLog(`console start requested pid=${child.pid ?? 'unknown'} port=${CONSOLE_PORT}`);
  await waitForConsoleHealthy(60_000);
}

async function waitForCoreHealthy(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await serviceState(CORE_PORT, 'core');
    if (state.healthy && state.canonicalOwner) {
      writeLog(`core health verified pid=${state.pid}`);
      return;
    }
    if (state.listening && !state.canonicalOwner) throw new Error(`Core port ${CORE_PORT} changed to an unknown process`);
    await sleep(500);
  }
  throw new Error(`Core did not become healthy within ${Math.round(timeoutMs / 1000)}s`);
}

async function waitForConsoleHealthy(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await serviceState(CONSOLE_PORT, 'console');
    if (state.healthy && state.canonicalOwner) {
      writeLog(`console health verified pid=${state.pid}`);
      return;
    }
    if (state.listening && !state.canonicalOwner) throw new Error(`Console port ${CONSOLE_PORT} changed to an unknown process`);
    await sleep(500);
  }
  throw new Error(`Console did not become healthy within ${Math.round(timeoutMs / 1000)}s`);
}

async function serviceState(port, kind) {
  const owners = await listenerOwners(port);
  const pid = owners[0]?.pid ?? null;
  const command = owners[0]?.command ?? '';
  const processTree = owners[0]?.processTree ?? [];
  const treeText = processTree.join(' ');
  const canonicalOwner = kind === 'core'
    ? treeText.includes(CORE_PROJECT_ROOT) && treeText.includes('dist/index.js')
    : treeText.includes(CONSOLE_PROJECT_ROOT) && (treeText.includes('next') || treeText.includes('npm run dev'));
  const health = await httpHealth(`http://${CORE_HOST}:${port}${kind === 'core' ? '/status' : '/'}`);
  return { listening: owners.length > 0, pid, command, canonicalOwner, healthy: health.ok };
}

async function httpHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { ok: false };
    if (url.endsWith('/status')) {
      const body = await response.json().catch(() => null);
      return { ok: body?.ok === true };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function listenerOwners(port) {
  try {
    const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { timeout: 5_000 });
    const pids = [...new Set(stdout.split(/\s+/).map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value)))];
    return await Promise.all(pids.map(async (pid) => ({
      pid,
      command: (await processInfo(pid)).command,
      processTree: await processTreeCommands(pid),
    })));
  } catch {
    return [];
  }
}

async function processInfo(pid) {
  try {
    const { stdout } = await execFileAsync('/bin/ps', ['-p', `${pid}`, '-o', 'pid=,ppid=,command='], { timeout: 5_000 });
    const match = stdout.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    return match ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] } : { pid, ppid: 1, command: '' };
  } catch {
    return { pid, ppid: 1, command: '' };
  }
}

async function processTreeCommands(pid) {
  const commands = [];
  let currentPid = pid;
  for (let depth = 0; depth < 6 && currentPid > 1; depth += 1) {
    const info = await processInfo(currentPid);
    if (!info.command) break;
    commands.push(info.command);
    if (info.ppid === currentPid || info.ppid <= 1) break;
    currentPid = info.ppid;
  }
  return commands;
}

function processEntryPath(command) {
  const match = command.match(/\/Users\/[^\s]+\/projects\/brain-core\/dist\/index\.js/);
  return match?.[0] ?? '__no_managed_process_path__';
}

async function launchctlPrint() {
  try {
    const { stdout } = await execFileAsync('/bin/launchctl', ['print', `${DOMAIN}/${CORE_LABEL}`], { timeout: 5_000 });
    return { loaded: true, stdout };
  } catch {
    return { loaded: false, stdout: '' };
  }
}

async function execLaunchctl(args) {
  try {
    await execFileAsync('/bin/launchctl', args, { timeout: 10_000 });
  } catch (error) {
    throw new Error(`launchctl ${args[0]} failed`);
  }
}

function readInstalledPlist() {
  if (!fs.existsSync(INSTALLED_PLIST)) return null;
  try {
    const result = requirePlutilJson();
    return result;
  } catch {
    return null;
  }
}

function requirePlutilJson() {
  const result = childProcessSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', INSTALLED_PLIST]);
  return JSON.parse(result);
}

function childProcessSync(file, args) {
  return execFileSync(file, args, { encoding: 'utf8', timeout: 5_000 });
}

function plistIdentityMatches(plist) {
  return plist.Label === CORE_LABEL
    && plist.ProgramArguments?.[0] === '/opt/homebrew/bin/node'
    && plist.ProgramArguments?.[1] === CORE_ENTRY
    && plist.WorkingDirectory === CORE_PROJECT_ROOT;
}

function writeInstalledPlist() {
  const source = fs.readFileSync(SOURCE_PLIST, 'utf8');
  const canonicalRoot = '/Users/Office/Repos/stevewesthoek/brain';
  if (!source.includes(canonicalRoot)) throw new Error('canonical LaunchAgent source root is not recognized');
  const rendered = source.replaceAll(canonicalRoot, runtimeRoot);
  fs.mkdirSync(path.dirname(INSTALLED_PLIST), { recursive: true });
  const tempPath = `${INSTALLED_PLIST}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, rendered, { mode: 0o600 });
  fs.renameSync(tempPath, INSTALLED_PLIST);
  writeLog(`LaunchAgent plist reconciled path=${INSTALLED_PLIST}`);
}

async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) return;
    await sleep(500);
  }
  throw new Error(`port ${port} did not become free after managed stop`);
}

async function isPortListening(port) {
  return (await listenerOwners(port)).length > 0;
}

function prepareLog() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  rotateLogIfNeeded(LAUNCHER_LOG);
  logFd = fs.openSync(LAUNCHER_LOG, 'a');
}

function rotateLogIfNeeded(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_LOG_BYTES) {
    fs.rmSync(`${filePath}.1`, { force: true });
    fs.renameSync(filePath, `${filePath}.1`);
  }
}

function writeLog(message) {
  if (logFd === undefined) return;
  fs.writeSync(logFd, `${new Date().toISOString()} ${message}\n`);
}

function notify(message) {
  const safe = message.replace(/[\r\n]/g, ' ').slice(0, 180);
  try {
    childProcessSync('/usr/bin/osascript', ['-e', `display notification ${JSON.stringify(safe)} with title "Brain Console"`]);
  } catch {
    // The diagnostic log remains authoritative if notifications are unavailable.
  }
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(NEW_RELIC|NRAK|eu01x)[^\s]*/gi, '[redacted]')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 240);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
