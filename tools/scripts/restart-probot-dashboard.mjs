#!/usr/bin/env node

/**
 * ProBot Dashboard Restart Script
 *
 * Safe local utility to:
 * 1. Check if port 7070 is in use
 * 2. Kill existing ProBot process if safe
 * 3. Start fresh ProBot from projects/probot
 * 4. Wait for dashboard endpoints to respond
 * 5. Print status
 *
 * Do not hardcode secrets.
 * Do not touch .env.
 * Do not stage runtime logs.
 */

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PROBOT_DIR = path.join(REPO_ROOT, "projects/probot");
const RUNTIME_LOG_DIR = path.join(REPO_ROOT, "runtime/local");
const PROBOT_LOG_PATH = path.join(RUNTIME_LOG_DIR, "probot-dev.log");
const DASHBOARD_PORT = 7070;
const DASHBOARD_HOST = "127.0.0.1";
const STARTUP_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 500;

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkPortInUse() {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-tiTCP:" + String(DASHBOARD_PORT),
      "-sTCP:LISTEN",
    ]);
    const pids = stdout
      .trim()
      .split("\n")
      .filter((p) => p.length > 0);
    return pids;
  } catch (err) {
    return [];
  }
}

async function killProcessSafely(pids) {
  const killed = [];

  for (const pid of pids) {
    try {
      const { stdout } = await execFileAsync("ps", ["-p", pid, "-o", "comm="]);
      const command = stdout.trim();

      // Only kill if it looks like ProBot (node, npm, tsx)
      const isNodeProcess =
        command.includes("node") ||
        command.includes("npm") ||
        command.includes("tsx");

      if (isNodeProcess) {
        log(`  Killing PID ${pid}: ${command}`, "yellow");
        process.kill(Number.parseInt(pid, 10), "SIGTERM");
        killed.push(pid);
      } else {
        log(
          `  ⚠ Refusing to kill PID ${pid}: not a node process (${command})`,
          "red"
        );
        throw new Error(
          `Port ${DASHBOARD_PORT} in use by non-node process (${command}). Manual intervention needed.`
        );
      }
    } catch (err) {
      if (err.message.includes("Refusing to kill")) {
        throw err;
      }
      log(`  ⚠ Could not identify process ${pid}: ${String(err)}`, "yellow");
    }
  }

  // Wait for graceful shutdown
  if (killed.length > 0) {
    log(`  Waiting for processes to exit...`, "yellow");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return killed;
}

async function ensurePortFree() {
  const pids = await checkPortInUse();

  if (pids.length === 0) {
    log(`✓ Port ${DASHBOARD_PORT} is free`, "green");
    return true;
  }

  log(
    `⚠ Port ${DASHBOARD_PORT} is in use by PID(s): ${pids.join(", ")}`,
    "yellow"
  );
  const killed = await killProcessSafely(pids);

  // Double-check
  const remainingPids = await checkPortInUse();
  if (remainingPids.length === 0) {
    log(`✓ Port ${DASHBOARD_PORT} is now free`, "green");
    return true;
  } else {
    log(
      `✗ Port ${DASHBOARD_PORT} still in use (PID: ${remainingPids.join(", ")})`,
      "red"
    );
    return false;
  }
}

async function startProBot() {
  // Ensure runtime log directory exists
  fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });

  // Clear old log
  try {
    fs.unlinkSync(PROBOT_LOG_PATH);
  } catch {
    // Ignore if file doesn't exist
  }

  const logStream = fs.createWriteStream(PROBOT_LOG_PATH, { flags: "a" });

  return new Promise((resolve, reject) => {
    log(`Starting ProBot from ${PROBOT_DIR}...`, "blue");

    const proc = spawn("npm", ["run", "dev"], {
      cwd: PROBOT_DIR,
      stdio: ["ignore", logStream, logStream],
      detached: true,
    });

    // Detach so it runs independently
    proc.unref();

    let started = false;

    proc.on("error", (err) => {
      reject(new Error(`Failed to start ProBot: ${String(err)}`));
    });

    // Give it a moment to start
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 1000);
  });
}

async function waitForDashboard() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  log(
    `Waiting for dashboard to respond on http://${DASHBOARD_HOST}:${DASHBOARD_PORT}...`,
    "blue"
  );

  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(
        `http://${DASHBOARD_HOST}:${DASHBOARD_PORT}/`,
        {},
        2000
      );
      if (response.ok) {
        log(`✓ Dashboard is responding`, "green");
        return true;
      }
    } catch {
      // Not ready yet, will retry
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

async function verifyEndpoints() {
  const endpoints = [
    {
      path: "/api/video-orchestrator/accounts-panel",
      name: "Accounts Panel",
    },
    {
      path: "/api/video-orchestrator/youtube-lifecycle-panel",
      name: "YouTube Lifecycle Panel",
    },
  ];

  log(`\nVerifying API endpoints...`, "blue");

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(
        `http://${DASHBOARD_HOST}:${DASHBOARD_PORT}${endpoint.path}`,
        {},
        3000
      );
      const data = await response.json();

      if (response.ok && data.ok !== false) {
        log(`✓ ${endpoint.name}`, "green");
      } else {
        log(
          `⚠ ${endpoint.name}: ${response.status} ${JSON.stringify(data).slice(0, 50)}`,
          "yellow"
        );
      }
    } catch (err) {
      log(`✗ ${endpoint.name}: ${String(err).slice(0, 50)}`, "red");
    }
  }
}

async function main() {
  log(`\n🦞 ProBot Dashboard Restart Script\n`, "blue");

  try {
    // Step 1: Check/clear port
    log(`1. Checking port ${DASHBOARD_PORT}...`);
    const portFree = await ensurePortFree();
    if (!portFree) {
      log(
        `\nCould not free port ${DASHBOARD_PORT}. Exiting.`,
        "red"
      );
      process.exit(1);
    }

    // Step 2: Start ProBot
    log(`\n2. Starting ProBot...`);
    await startProBot();

    // Step 3: Wait for dashboard
    log(`\n3. Waiting for dashboard...`);
    const dashboardUp = await waitForDashboard();
    if (!dashboardUp) {
      log(
        `\nDashboard did not respond within ${STARTUP_TIMEOUT_MS}ms.`,
        "red"
      );
      log(`Check logs at: ${PROBOT_LOG_PATH}`, "yellow");
      process.exit(1);
    }

    // Step 4: Verify endpoints
    await verifyEndpoints();

    // Step 5: Success
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "green");
    log(`✓ ProBot Dashboard is ready!`, "green");
    log(
      `📊 Open: http://${DASHBOARD_HOST}:${DASHBOARD_PORT}`,
      "green"
    );
    log(`📝 Logs: ${PROBOT_LOG_PATH}`, "green");
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, "green");
  } catch (err) {
    log(`\n✗ Error: ${String(err)}\n`, "red");
    process.exit(1);
  }
}

main();
