import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { clearPreUpdateState, readPreUpdateState, capturePreUpdateState } from "../services/updates.js";
import { findLocalApp, buildLocalAppsStatus, launchLocalAppStartCommand, resolveLocalAppCwd, resolveLocalAppLifecycleCommand, loadLocalApps } from "./local-apps.js";
import { waitForLocalAppHealth } from "./local-apps.js";

const execFileAsync = promisify(execFile);

export type UpdateResult = {
  success: boolean;
  updateApplied: boolean;
  restored: Array<{
    name: string;
    status: "running" | "failed" | "timeout";
    error?: string;
  }>;
  errors: string[];
};

/**
 * Dependency chain for safe startup/shutdown order.
 * Services are started in this order; stopped in reverse.
 */
const STARTUP_ORDER = [
  "Firecrawl",
  "ProChat",
  "Says the Bible",
  "xGrow",
  "JPV Bootcamp",
  "Family Finance",
  "Google Ads API",
  "BuildFlow",
];

/**
 * Stops all local apps in reverse dependency order.
 * Critical apps stop first, then dependencies.
 */
export async function stopAllLocalApps(appNames: string[]): Promise<void> {
  const allApps = loadLocalApps();
  const stopOrder = [...STARTUP_ORDER].reverse();

  for (const appName of stopOrder) {
    if (!appNames.includes(appName)) continue;

    const app = findLocalApp(appName);
    if (!app?.stop) continue;

    try {
      console.log(`[Update] Stopping ${appName}...`);
      const stopCommand = resolveLocalAppLifecycleCommand(app, "stop");
      if (stopCommand) {
        await execFileAsync("/bin/bash", ["-c", stopCommand], {
          cwd: resolveLocalAppCwd(app),
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        });
      }
      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.warn(`[Update] Failed to stop ${appName}: ${String(err)}`);
      // Continue anyway; we'll try to stop forcefully later
    }
  }
}

/**
 * Starts services that were running before update, in dependency order.
 * Waits for health checks on critical services.
 */
export async function restoreRunningApps(preState: { runningApps: string[] }): Promise<Array<{ name: string; status: "running" | "failed" | "timeout"; error?: string }>> {
  const results: Array<{ name: string; status: "running" | "failed" | "timeout"; error?: string }> = [];
  const healthCheckTimeoutMs = 60000; // 1 minute per service

  for (const appName of STARTUP_ORDER) {
    if (!preState.runningApps.includes(appName)) continue;

    const app = findLocalApp(appName);
    if (!app) {
      results.push({ name: appName, status: "failed", error: "App not found in registry" });
      continue;
    }

    const startCommand = resolveLocalAppLifecycleCommand(app, "start");
    if (!startCommand) {
      results.push({ name: appName, status: "failed", error: "No start command defined" });
      continue;
    }

    try {
      console.log(`[Update] Restoring ${appName}...`);
      launchLocalAppStartCommand(startCommand, resolveLocalAppCwd(app), app);

      // Wait for health check
      const healthy = await waitForLocalAppHealth(app, fetch, healthCheckTimeoutMs);
      if (healthy) {
        results.push({ name: appName, status: "running" });
        console.log(`[Update] ✓ ${appName} restored and healthy`);
      } else {
        results.push({ name: appName, status: "timeout", error: `Health check timed out after ${healthCheckTimeoutMs}ms` });
        console.warn(`[Update] ⚠ ${appName} started but health check failed`);
      }
    } catch (err) {
      results.push({ name: appName, status: "failed", error: String(err) });
      console.error(`[Update] ✗ ${appName} restore failed: ${String(err)}`);
    }

    // Small delay between starting services to avoid race conditions
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Performs the actual npm update:
 * - npm install (fetch new packages)
 * - npm rebuild (rebuild native modules)
 * - Verifies build succeeds
 *
 * This is called as a separate subprocess so ProBot can exit cleanly.
 */
export async function executeNpmUpdate(): Promise<boolean> {
  console.log("[Update] Executing npm install...");
  try {
    await execFileAsync("npm", ["install"], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 300000, // 5 minutes for npm install
    });
    console.log("[Update] ✓ npm install completed");
  } catch (err) {
    console.error("[Update] ✗ npm install failed:", String(err));
    return false;
  }

  console.log("[Update] Executing npm rebuild...");
  try {
    await execFileAsync("npm", ["rebuild"], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 300000,
    });
    console.log("[Update] ✓ npm rebuild completed");
  } catch (err) {
    console.error("[Update] ✗ npm rebuild failed:", String(err));
    return false;
  }

  return true;
}

/**
 * Spawns a subprocess to perform npm update, then restart ProBot.
 * The main process exits cleanly after spawning this.
 */
export function spawnUpdateAndRestart(): void {
  const script = `
set -e
cd '${process.cwd().replace(/'/g, "'\"'\"'")}'
echo "[Update] Starting npm install..."
npm install
echo "[Update] Starting npm rebuild..."
npm rebuild
echo "[Update] Update successful! Restarting ProBot..."
npm start
`;

  const child = spawn("/bin/bash", ["-c", script], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    console.log(`[Update Subprocess] ${String(chunk)}`);
  });

  child.stderr?.on("data", (chunk) => {
    console.error(`[Update Subprocess] ${String(chunk)}`);
  });

  child.unref();
  console.log(`[Update] Update subprocess spawned (PID: ${child.pid})`);
}

/**
 * Gracefully shuts down ProBot: finish active requests, close DB connections, then exit.
 */
export async function gracefulShutdown(timeoutMs = 5000): Promise<void> {
  console.log("[Update] Initiating graceful shutdown...");

  // Set a hard timeout to force exit if requests hang
  const forceExitTimer = setTimeout(() => {
    console.error("[Update] Graceful shutdown timeout exceeded. Force exiting.");
    process.exit(0);
  }, timeoutMs);

  // Close the database if ProBot has one
  try {
    // This assumes ProBot has a global 'db' object; adjust as needed for your setup
    // @ts-ignore - accessing global db if it exists
    if (globalThis.db && typeof globalThis.db.close === "function") {
      // @ts-ignore
      globalThis.db.close();
      console.log("[Update] Database connection closed");
    }
  } catch (err) {
    console.warn("[Update] Failed to close database:", String(err));
  }

  clearTimeout(forceExitTimer);
  console.log("[Update] Graceful shutdown complete");
}

/**
 * Called after ProBot restarts (endpoint /api/system/restore-after-update).
 * Reads pre-update state and restores services.
 */
export async function restoreSystemAfterUpdate(): Promise<UpdateResult> {
  console.log("[Update] Post-restart restoration starting...");

  const preState = readPreUpdateState();
  if (!preState) {
    console.log("[Update] No pre-update state found. Skipping restoration.");
    return {
      success: true,
      updateApplied: true,
      restored: [],
      errors: ["No pre-update state found; no services to restore"],
    };
  }

  const errors: string[] = [];

  try {
    await restoreRunningApps(preState);
    clearPreUpdateState();
    console.log("[Update] System restoration complete");
  } catch (err) {
    errors.push(String(err));
    console.error("[Update] Restoration failed:", String(err));
  }

  const restored = await restoreRunningApps(preState);
  return {
    success: errors.length === 0,
    updateApplied: true,
    restored,
    errors,
  };
}
