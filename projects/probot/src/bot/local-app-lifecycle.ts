import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NormalizedLocalApp } from "./local-apps.js";
import { resolveLocalAppCwd, resolveLocalAppLifecycleCommand } from "./local-apps.js";
import { getPortOccupants } from "./local-app-ports.js";

const execFileAsync = promisify(execFile);

/**
 * Map to track in-progress operations per app to prevent concurrent calls.
 */
const appOperationLocks = new Map<string, boolean>();

/**
 * Get PIDs currently listening on the app's port.
 * If app has no port, return [].
 * Safe: does not throw on missing listeners; returns [] instead.
 * Delegates to shared local-app-ports module for caching and deduplication.
 */
export async function getLocalAppPortOccupants(app: NormalizedLocalApp | null): Promise<string[]> {
  return getPortOccupants(app?.port ?? null);
}

/**
 * Check if the app's port is currently free.
 * If app has no port, consider it "free".
 */
export async function isLocalAppPortFree(app: NormalizedLocalApp | null): Promise<boolean> {
  const occupants = await getLocalAppPortOccupants(app);
  return occupants.length === 0;
}

/**
 * Poll until the app's port becomes free, or timeout.
 * If app has no port, return true immediately.
 */
export async function waitForLocalAppPortFree(
  app: NormalizedLocalApp | null,
  timeoutMs = 10000,
): Promise<boolean> {
  if (!app?.port) {
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  const pollIntervalMs = 500;

  while (Date.now() < deadline) {
    const free = await isLocalAppPortFree(app);
    if (free) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

/**
 * Structured result for force-stopping a port.
 */
export type ForceStopResult = {
  ok: boolean;
  pids: string[];
  killed: string[];
  error?: string;
};

/**
 * Send SIGTERM to all PIDs on the app's port, then SIGKILL if they don't exit.
 * If app has no port, return success with empty lists.
 * Safe: returns structured failure instead of throwing.
 */
export async function forceStopLocalAppPort(app: NormalizedLocalApp | null): Promise<ForceStopResult> {
  if (!app?.port) {
    return { ok: true, pids: [], killed: [] };
  }

  try {
    let occupants = await getLocalAppPortOccupants(app);
    if (occupants.length === 0) {
      return { ok: true, pids: [], killed: [] };
    }

    const killed: string[] = [];

    // Send SIGTERM first
    for (const pid of occupants) {
      try {
        process.kill(Number.parseInt(pid, 10), "SIGTERM");
      } catch (err) {
        console.warn(`[LocalAppLifecycle] Failed to send SIGTERM to ${pid}:`, String(err));
      }
    }

    // Wait briefly for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if any are still listening
    occupants = await getLocalAppPortOccupants(app);
    if (occupants.length === 0) {
      return { ok: true, pids: occupants, killed };
    }

    // Force kill the remaining ones
    for (const pid of occupants) {
      try {
        process.kill(Number.parseInt(pid, 10), "SIGKILL");
        killed.push(pid);
      } catch (err) {
        console.warn(`[LocalAppLifecycle] Failed to send SIGKILL to ${pid}:`, String(err));
      }
    }

    // Verify they're gone
    const remaining = await getLocalAppPortOccupants(app);
    if (remaining.length > 0) {
      return {
        ok: false,
        pids: remaining,
        killed,
        error: `Failed to kill PIDs: ${remaining.join(", ")}`,
      };
    }

    return { ok: true, pids: occupants, killed };
  } catch (err) {
    return {
      ok: false,
      pids: [],
      killed: [],
      error: String(err),
    };
  }
}

/**
 * Acquire exclusive lock for an app operation (module-private).
 * Throws if operation is already running for that app.
 * Callers must use runExclusiveLocalAppOperation() which releases locks in finally.
 */
function acquireAppOperationLock(appName: string): void {
  if (appOperationLocks.get(appName)) {
    throw new Error(`Local app operation already running for ${appName}`);
  }
  appOperationLocks.set(appName, true);
}

/**
 * Release exclusive lock for an app operation (module-private).
 * Callers must use runExclusiveLocalAppOperation() which manages lock lifecycle.
 */
function releaseAppOperationLock(appName: string): void {
  appOperationLocks.delete(appName);
}

/**
 * Execute an operation with exclusive locking per app.
 * Prevents concurrent operations on the same app.
 */
export async function runExclusiveLocalAppOperation<T>(
  appName: string,
  operation: () => Promise<T>,
): Promise<T> {
  acquireAppOperationLock(appName);
  try {
    return await operation();
  } finally {
    releaseAppOperationLock(appName);
  }
}

/**
 * Structured result for stopping an app cleanly.
 */
export type StopLocalAppResult = {
  ok: boolean;
  commandRan: boolean;
  portFree: boolean;
  forceStop: ForceStopResult;
  error?: string;
};

/**
 * Stop an app cleanly:
 * 1. Run the stop command if present
 * 2. Force stop any remaining port listeners
 * 3. Wait for the port to become free
 */
export async function stopLocalAppCleanly(
  app: NormalizedLocalApp | null,
  options?: { timeoutMs?: number },
): Promise<StopLocalAppResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  let commandRan = false;

  try {
    // Try the stop command first
    const stopCommand = resolveLocalAppLifecycleCommand(app, "stop");
    if (stopCommand && app) {
      try {
        commandRan = true;
        console.log(`[LocalAppLifecycle] Running stop command for ${app.name}...`);
        const cwd = resolveLocalAppCwd(app);
        await execFileAsync("/bin/bash", ["-c", stopCommand], {
          cwd,
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });
        console.log(`[LocalAppLifecycle] Stop command completed for ${app.name}`);
      } catch (err) {
        console.warn(`[LocalAppLifecycle] Stop command failed for ${app.name}:`, String(err));
      }
    }

    // Force stop any remaining port listeners
    const forceStop = await forceStopLocalAppPort(app);

    // Wait for port to become free
    const portFree = await waitForLocalAppPortFree(app, timeoutMs);

    return {
      ok: portFree && forceStop.ok,
      commandRan,
      portFree,
      forceStop,
    };
  } catch (err) {
    return {
      ok: false,
      commandRan,
      portFree: false,
      forceStop: { ok: false, pids: [], killed: [], error: String(err) },
      error: String(err),
    };
  }
}
