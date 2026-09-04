import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createCodexUsageReader, type CodexUsageSnapshot } from './codex-usage-reader.js';

const execFileAsync = promisify(execFile);

export type SystemMetricsCodexWindow = CodexUsageSnapshot['fiveHour'];

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
    freshness: CodexUsageSnapshot['freshness'];
    diagnostics: CodexUsageSnapshot['diagnostics'];
  };
  claudeApi?: ClaudeApiMetrics;
}

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

const codexUsageReader = createCodexUsageReader();

export function readCodexUsage(): CodexUsageSnapshot {
  return codexUsageReader.getSnapshot();
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
    ...(claudeApi !== undefined ? { claudeApi } : {}),
  };
}
