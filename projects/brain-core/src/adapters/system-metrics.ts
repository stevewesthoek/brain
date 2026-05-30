import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface SystemMetricsCodexWindow {
  remainingPercent: number;
  usedPercent: number;
  resetsAt: string | null;
}

export interface SystemMetricsGemini {
  usedPercent: number;
  remainingPercent: number;
  callsToday: number;
  callsUsed: number;
  callsRemaining: number;
  resetsAt: string;
  hoursUntilReset: number;
}

export interface ClaudeModelUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  callCount: number;
}

export interface ClaudeApiMetrics {
  haiku: ClaudeModelUsage;
  sonnet: ClaudeModelUsage;
  opus: ClaudeModelUsage;
  totalCostUsd: number;
  resetAt: string;
  daysUntilReset: number;
}

export interface SystemMetrics {
  loadAvg1: number;
  cpuCount: number;
  memFreePercent: number | null;
  memUsedGb: number;
  memTotalGb: number;
  gpuUtilizationPercent: number | null;
  gpuCoreCount: number | null;
  uptimeSeconds: number;
  codex: {
    fiveHour: SystemMetricsCodexWindow;
    sevenDay: SystemMetricsCodexWindow;
    asOf: string | null;
  };
  gemini?: SystemMetricsGemini;
  claudeApi?: ClaudeApiMetrics;
}

const FALLBACK_WINDOW: SystemMetricsCodexWindow = {
  remainingPercent: 100,
  usedPercent: 0,
  resetsAt: null,
};

async function getMemoryFreePercent(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('memory_pressure', ['-Q', '-v', '1'], { timeout: 2000 });
    const match = stdout.match(/System-wide memory free percentage:\s*(\d+)%/i);
    if (!match?.[1]) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function getMemoryStats(freePercent: number | null): { usedGb: number; totalGb: number } {
  const totalBytes = os.totalmem();
  const usedBytes = freePercent === null
    ? totalBytes - os.freemem()
    : Math.round(totalBytes * (100 - freePercent) / 100);
  return {
    totalGb: Math.round((totalBytes / 1073741824) * 10) / 10,
    usedGb: Math.round((usedBytes / 1073741824) * 10) / 10,
  };
}

async function getGpuUtilizationPercent(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ioreg', ['-r', '-c', 'AGXAccelerator'], { timeout: 2000 });
    const match = stdout.match(/"Device Utilization %"\s*=\s*(\d+)/i);
    if (!match?.[1]) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function getGpuCoreCount(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ioreg', ['-r', '-c', 'AGXAccelerator'], { timeout: 2000 });
    const match = stdout.match(/"gpu-core-count"\s*=\s*(\d+)/i);
    if (!match?.[1]) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

interface RateLimitWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number;
}

function toCodexWindow(window: RateLimitWindow | undefined): SystemMetricsCodexWindow {
  if (!window) return FALLBACK_WINDOW;
  return {
    usedPercent: Math.round(window.used_percent),
    remainingPercent: Math.round(Math.max(0, 100 - window.used_percent)),
    resetsAt: new Date(window.resets_at * 1000).toISOString(),
  };
}

function walkJsonl(dir: string, out: string[]): void {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkJsonl(full, out);
      else if (entry.name.endsWith('.jsonl')) out.push(full);
    }
  } catch {
    // Skip unreadable dirs.
  }
}

function readCodexUsage(): { fiveHour: SystemMetricsCodexWindow; sevenDay: SystemMetricsCodexWindow; asOf: string | null } {
  const sessionsDir = path.join(os.homedir(), '.codex', 'sessions');
  const files: string[] = [];
  walkJsonl(sessionsDir, files);

  let bestTs = 0;
  let bestFiveHour: SystemMetricsCodexWindow = FALLBACK_WINDOW;
  let bestSevenDay: SystemMetricsCodexWindow = FALLBACK_WINDOW;
  let bestAsOf: string | null = null;

  for (const filePath of files) {
    try {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      for (const line of lines) {
        if (!line.includes('"token_count"')) continue;
        try {
          const obj = JSON.parse(line) as { type?: string; timestamp?: string; payload?: { type?: string; rate_limits?: { primary?: RateLimitWindow; secondary?: RateLimitWindow } } };
          if (obj.type !== 'event_msg' || obj.payload?.type !== 'token_count') continue;
          if (!obj.payload.rate_limits?.primary) continue;
          const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0;
          if (!Number.isFinite(ts) || ts <= bestTs) continue;
          bestTs = ts;
          bestFiveHour = toCodexWindow(obj.payload.rate_limits.primary);
          bestSevenDay = toCodexWindow(obj.payload.rate_limits.secondary);
          bestAsOf = obj.timestamp ?? null;
        } catch {
          // Skip malformed lines.
        }
      }
    } catch {
      // Skip unreadable files.
    }
  }

  return { fiveHour: bestFiveHour, sevenDay: bestSevenDay, asOf: bestAsOf };
}

const GEMINI_FREE_TIER_DAILY_LIMIT = 1500;

interface GeminiRateLimitsFile {
  calls_today: number[];
  video_seconds_today?: number;
  day?: string;
}

function readGeminiUsage(): SystemMetricsGemini | undefined {
  try {
    const filePath = path.join(os.homedir(), '.local', 'video-orchestrator', 'state', 'gemini-rate-limits.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as GeminiRateLimitsFile;

    const callsUsed = Array.isArray(data.calls_today) ? data.calls_today.length : 0;
    const callsRemaining = Math.max(0, GEMINI_FREE_TIER_DAILY_LIMIT - callsUsed);
    const usedPercent = Math.min(100, Math.round((callsUsed / GEMINI_FREE_TIER_DAILY_LIMIT) * 100));
    const remainingPercent = Math.max(0, 100 - usedPercent);

    // Reset is at 00:00 UTC the next day.
    const now = new Date();
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const msUntilReset = resetDate.getTime() - now.getTime();
    const hoursUntilReset = Math.max(0, Math.round(msUntilReset / 3600000 * 10) / 10);

    return {
      usedPercent,
      remainingPercent,
      callsToday: GEMINI_FREE_TIER_DAILY_LIMIT,
      callsUsed,
      callsRemaining,
      resetsAt: resetDate.toISOString(),
      hoursUntilReset,
    };
  } catch {
    return undefined;
  }
}

interface ClaudeUsageFile {
  generatedAt: string;
  resetAt: string;
  months: Record<string, { models: Record<string, ClaudeModelUsage>; totalCostUsd: number }>;
  totalCostUsdAllTime: number;
}

function readClaudeApiUsage(): ClaudeApiMetrics | undefined {
  try {
    const filePath = path.join(os.homedir(), '.local', 'claude-api', 'monthly-usage.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as ClaudeUsageFile;

    // Get current month
    const now = new Date();
    const currentMonth = now.toLocaleString('en-CA', { year: 'numeric', month: '2-digit' }).replace('/', '-');
    const monthData = data.months[currentMonth];

    if (!monthData) {
      return undefined;
    }

    // Ensure all models exist (default to 0 if not present)
    const models = monthData.models;
    const haiku = models.haiku || { inputTokens: 0, outputTokens: 0, costUsd: 0, callCount: 0 };
    const sonnet = models.sonnet || { inputTokens: 0, outputTokens: 0, costUsd: 0, callCount: 0 };
    const opus = models.opus || { inputTokens: 0, outputTokens: 0, costUsd: 0, callCount: 0 };

    // Calculate days until reset (1st of next month at 12:00 Lisbon time)
    const resetDate = new Date(data.resetAt);
    const msUntilReset = resetDate.getTime() - now.getTime();
    const daysUntilReset = Math.max(0, Math.ceil(msUntilReset / 86400000));

    return {
      haiku,
      sonnet,
      opus,
      totalCostUsd: monthData.totalCostUsd,
      resetAt: data.resetAt,
      daysUntilReset,
    };
  } catch {
    return undefined;
  }
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const [memFreePercent, gpuUtilizationPercent, gpuCoreCount] = await Promise.all([
    getMemoryFreePercent(),
    getGpuUtilizationPercent(),
    getGpuCoreCount(),
  ]);

  const load = os.loadavg();
  const { usedGb, totalGb } = getMemoryStats(memFreePercent);
  const codex = readCodexUsage();
  const gemini = readGeminiUsage();
  const claudeApi = readClaudeApiUsage();

  return {
    loadAvg1: Math.round((load[0] ?? 0) * 100) / 100,
    cpuCount: os.cpus().length,
    memFreePercent,
    memUsedGb: usedGb,
    memTotalGb: totalGb,
    gpuUtilizationPercent,
    gpuCoreCount,
    uptimeSeconds: Math.floor(process.uptime()),
    codex,
    ...(gemini !== undefined ? { gemini } : {}),
    ...(claudeApi !== undefined ? { claudeApi } : {}),
  };
}
