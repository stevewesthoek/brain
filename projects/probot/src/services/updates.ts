import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type UpdateCheck = {
  hasUpdates: boolean;
  nodeVersion: { current: string; required: string; compatible: boolean };
  packageUpdates: Array<{ name: string; current: string; available: string }>;
  nativeModuleIssues: Array<{ module: string; issue: string }>;
  details: string;
};

export type PreUpdateState = {
  capturedAt: string;
  runningApps: string[];
  probot: { pid: number | null; port: number };
};

const STATE_FILE_PATH = path.join(os.homedir(), ".probot", "update-restore-state.json");

// Ensure state directory exists
function ensureStateDir(): void {
  fs.mkdirSync(path.dirname(STATE_FILE_PATH), { recursive: true });
}

/**
 * Captures the current state of running services before update.
 * Saved to ~/.probot/update-restore-state.json
 */
export function capturePreUpdateState(runningApps: string[], probotPort: number, probotPid: number | null): void {
  ensureStateDir();
  const state: PreUpdateState = {
    capturedAt: new Date().toISOString(),
    runningApps,
    probot: { pid: probotPid, port: probotPort },
  };
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  console.log(`[Updates] Pre-update state captured: ${runningApps.length} apps running`);
}

/**
 * Reads the pre-update state (if it exists).
 */
export function readPreUpdateState(): PreUpdateState | null {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return null;
    const content = fs.readFileSync(STATE_FILE_PATH, "utf-8");
    return JSON.parse(content) as PreUpdateState;
  } catch (err) {
    console.error(`[Updates] Failed to read pre-update state:`, String(err));
    return null;
  }
}

/**
 * Deletes the pre-update state file (call after successful restoration).
 */
export function clearPreUpdateState(): void {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      fs.unlinkSync(STATE_FILE_PATH);
      console.log(`[Updates] Pre-update state cleared`);
    }
  } catch (err) {
    console.error(`[Updates] Failed to clear pre-update state:`, String(err));
  }
}

/**
 * Checks if Node.js version has changed (native module compatibility).
 * Returns the required version from package.json engines field.
 */
export async function checkNodeVersionCompatibility(): Promise<{ current: string; required: string; compatible: boolean }> {
  const current = process.version;
  let required = "node (any)";
  let compatible = true;

  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    if (packageJson.engines?.node) {
      required = packageJson.engines.node as string;
      // Very basic semver check (not production-grade)
      const currentMajor = Number.parseInt(current.slice(1).split(".")[0] ?? "0", 10);
      const requiredMatch = required.match(/(\d+)/);
      const requiredMajor = requiredMatch?.[1] ? Number.parseInt(requiredMatch[1], 10) : NaN;
      if (!Number.isNaN(requiredMajor) && currentMajor !== requiredMajor) {
        compatible = false;
      }
    }
  } catch {
    // If we can't read package.json, assume compatible
  }

  return { current, required, compatible };
}

/**
 * Checks for native module rebuild issues (main cause of update failures).
 * Runs npm rebuild --dry-run to detect version mismatches.
 */
export async function checkNativeModuleIssues(): Promise<Array<{ module: string; issue: string }>> {
  const issues: Array<{ module: string; issue: string }> = [];

  try {
    const { stdout, stderr } = await execFileAsync("npm", ["rebuild", "--dry-run"], {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = stdout + stderr;
    // Look for common error patterns
    if (output.includes("gyp ERR!") || output.includes("node-gyp") || output.includes("MODULE_VERSION")) {
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.includes("MODULE_VERSION") || line.includes("was compiled against")) {
          const match = line.match(/(\w+)/);
          issues.push({
            module: match?.[1] ?? "unknown",
            issue: line.trim(),
          });
        }
      }
    }
  } catch (err) {
    const message = String(err);
    if (message.includes("MODULE_VERSION") || message.includes("was compiled")) {
      issues.push({
        module: "native-modules",
        issue: "Native modules incompatible with current Node.js version",
      });
    }
  }

  return issues;
}

/**
 * Checks for outdated npm packages.
 */
export async function checkOutdatedPackages(): Promise<Array<{ name: string; current: string; available: string }>> {
  const packages: Array<{ name: string; current: string; available: string }> = [];

  try {
    const { stdout } = await execFileAsync("npm", ["outdated", "--json"], {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
    });

    const outdated = JSON.parse(stdout) as Record<string, { current: string; latest: string }>;
    for (const [name, info] of Object.entries(outdated)) {
      packages.push({
        name,
        current: info.current,
        available: info.latest,
      });
    }
  } catch {
    // npm outdated returns non-zero if there are outdated packages, so this is expected
  }

  return packages;
}

/**
 * Comprehensive update check. Returns what needs updating.
 */
export async function checkForUpdates(): Promise<UpdateCheck> {
  const nodeVersion = await checkNodeVersionCompatibility();
  const nativeModuleIssues = await checkNativeModuleIssues();
  const packageUpdates = await checkOutdatedPackages();

  const hasUpdates = !nodeVersion.compatible || nativeModuleIssues.length > 0 || packageUpdates.length > 0;

  let details = "";
  if (!nodeVersion.compatible) {
    details += `Node.js version changed (current: ${nodeVersion.current}, expected: ${nodeVersion.required}). `;
  }
  if (nativeModuleIssues.length > 0) {
    details += `${nativeModuleIssues.length} native module(s) may need rebuilding. `;
  }
  if (packageUpdates.length > 0) {
    details += `${packageUpdates.length} package update(s) available. `;
  }

  return {
    hasUpdates,
    nodeVersion,
    packageUpdates,
    nativeModuleIssues,
    details: details.trim(),
  };
}
