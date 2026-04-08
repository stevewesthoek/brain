import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface WindowUsage {
  remainingPercent: number;
  usedPercent: number;
  resetsAt: string | null;
}

export interface CodexUsage {
  fiveHour: WindowUsage;
  sevenDay: WindowUsage;
  asOf: string | null;
  source: "session_log" | "probe" | "fallback";
}

interface RateLimitWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number;
}

interface TokenCountPayload {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
}

interface TokenCountEvent {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    rate_limits?: TokenCountPayload;
  };
}

interface PersistedCodexUsage extends CodexUsage {
  lastProbeAttemptAt?: string | null;
}

interface CodexUsageOptions {
  codexSessionsDir: string;
  dataDir: string;
}

const FALLBACK_WINDOW: WindowUsage = {
  remainingPercent: 100,
  usedPercent: 0,
  resetsAt: null,
};

const FALLBACK_USAGE: CodexUsage = {
  fiveHour: FALLBACK_WINDOW,
  sevenDay: FALLBACK_WINDOW,
  asOf: null,
  source: "fallback",
};

const CACHE_FILE = "codex-usage.json";
const PROBE_COOLDOWN_MS = 15 * 60 * 1000;
const PROBE_TIMEOUT_MS = 20 * 1000;
const MONITOR_INTERVAL_MS = 5 * 60 * 1000;

let inFlightProbe: Promise<CodexUsage | null> | null = null;

function walkJsonl(dir: string, out: string[]): void {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkJsonl(full, out);
      else if (entry.name.endsWith(".jsonl")) out.push(full);
    }
  } catch {
    // Skip unreadable dirs; usage probing is best-effort.
  }
}

function toWindow(window: RateLimitWindow | undefined): WindowUsage {
  if (!window) return FALLBACK_WINDOW;
  return {
    usedPercent: Math.round(window.used_percent),
    remainingPercent: Math.round(Math.max(0, 100 - window.used_percent)),
    resetsAt: new Date(window.resets_at * 1000).toISOString(),
  };
}

function parseTokenCount(line: string): CodexUsage | null {
  if (!line.includes("\"token_count\"")) return null;

  try {
    const obj = JSON.parse(line) as TokenCountEvent;
    if (obj.type !== "event_msg" || obj.payload?.type !== "token_count") return null;
    if (!obj.payload.rate_limits?.primary) return null;

    return {
      fiveHour: toWindow(obj.payload.rate_limits.primary),
      sevenDay: toWindow(obj.payload.rate_limits.secondary),
      asOf: obj.timestamp ?? null,
      source: "session_log",
    };
  } catch {
    return null;
  }
}

function readLatestUsageFromSessions(
  codexSessionsDir: string,
  minTimestampMs = 0,
): CodexUsage | null {
  const files: string[] = [];
  walkJsonl(codexSessionsDir, files);

  let bestUsage: CodexUsage | null = null;
  let bestTs = minTimestampMs;

  for (const filePath of files) {
    try {
      if (fs.statSync(filePath).mtimeMs < minTimestampMs) continue;
      const lines = fs.readFileSync(filePath, "utf8").split("\n");
      for (const line of lines) {
        const usage = parseTokenCount(line);
        if (!usage?.asOf) continue;
        const ts = new Date(usage.asOf).getTime();
        if (!Number.isFinite(ts) || ts < minTimestampMs || ts <= bestTs) continue;
        bestTs = ts;
        bestUsage = usage;
      }
    } catch {
      // Ignore unreadable or malformed session files.
    }
  }

  return bestUsage;
}

function cachePath(dataDir: string): string {
  return path.join(dataDir, CACHE_FILE);
}

function readCachedUsage(dataDir: string): PersistedCodexUsage | null {
  try {
    const raw = fs.readFileSync(cachePath(dataDir), "utf8");
    return JSON.parse(raw) as PersistedCodexUsage;
  } catch {
    return null;
  }
}

function writeCachedUsage(dataDir: string, usage: PersistedCodexUsage): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(cachePath(dataDir), JSON.stringify(usage, null, 2));
  } catch {
    // Ignore cache write failures; they should not break the dashboard.
  }
}

function isWindowExpired(resetsAt: string | null, now = Date.now()): boolean {
  if (!resetsAt) return false;
  const resetTs = new Date(resetsAt).getTime();
  return Number.isFinite(resetTs) && resetTs <= now;
}

function shouldProbe(
  usage: CodexUsage | null,
  cached: PersistedCodexUsage | null,
  now = Date.now(),
): boolean {
  const lastProbeAttempt = cached?.lastProbeAttemptAt
    ? new Date(cached.lastProbeAttemptAt).getTime()
    : 0;
  if (now - lastProbeAttempt < PROBE_COOLDOWN_MS) return false;

  if (!usage) return true;
  if (isWindowExpired(usage.sevenDay.resetsAt, now)) return true;
  if (isWindowExpired(usage.fiveHour.resetsAt, now)) return true;

  return false;
}

function chooseBestUsage(
  sessionUsage: CodexUsage | null,
  cached: PersistedCodexUsage | null,
): CodexUsage | null {
  const candidates = [sessionUsage, cached].filter((value): value is CodexUsage => Boolean(value));
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const aTs = a.asOf ? new Date(a.asOf).getTime() : 0;
    const bTs = b.asOf ? new Date(b.asOf).getTime() : 0;
    return bTs - aTs;
  })[0] ?? null;
}

async function runCodexProbe(codexSessionsDir: string): Promise<CodexUsage | null> {
  const probeStartedAt = Date.now();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "codex",
      [
        "exec",
        "--skip-git-repo-check",
        "--json",
        "-s",
        "read-only",
        "-C",
        "/tmp",
        "Reply with exactly OK.",
      ],
      {
        stdio: ["ignore", "ignore", "pipe"],
        env: {
          ...process.env,
          TERM: "dumb",
        },
      },
    );

    let settled = false;
    let stderr = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("Codex usage probe timed out"));
    }, PROBE_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Codex usage probe exited with code ${code ?? "unknown"}`));
    });
  });

  const usage = readLatestUsageFromSessions(codexSessionsDir, probeStartedAt - 1_000);
  if (!usage) return null;
  return {
    ...usage,
    source: "probe",
  };
}

export async function getCodexUsage(options: CodexUsageOptions): Promise<CodexUsage> {
  const cached = readCachedUsage(options.dataDir);
  const sessionUsage = readLatestUsageFromSessions(options.codexSessionsDir);
  const baseUsage = chooseBestUsage(sessionUsage, cached);
  const now = Date.now();

  if (!shouldProbe(baseUsage, cached, now)) {
    if (baseUsage) {
      writeCachedUsage(options.dataDir, {
        ...baseUsage,
        lastProbeAttemptAt: cached?.lastProbeAttemptAt ?? null,
      });
      return baseUsage;
    }
    return FALLBACK_USAGE;
  }

  const lastProbeAttemptAt = new Date(now).toISOString();
  writeCachedUsage(options.dataDir, {
    ...(baseUsage ?? FALLBACK_USAGE),
    lastProbeAttemptAt,
  });

  if (!inFlightProbe) {
    inFlightProbe = runCodexProbe(options.codexSessionsDir)
      .catch(() => null)
      .finally(() => {
        inFlightProbe = null;
      });
  }

  const probed = await inFlightProbe;
  if (probed) {
    writeCachedUsage(options.dataDir, {
      ...probed,
      lastProbeAttemptAt,
    });
    return probed;
  }

  return baseUsage ?? FALLBACK_USAGE;
}

export function startCodexUsageMonitor(options: CodexUsageOptions): void {
  void getCodexUsage(options).catch(() => {
    // Ignore warm-up failures; next interval can recover.
  });

  const timer = setInterval(() => {
    void getCodexUsage(options).catch(() => {
      // Best-effort background refresh only.
    });
  }, MONITOR_INTERVAL_MS);

  timer.unref();
}
