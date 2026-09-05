import { getSystemMetrics } from './system-metrics.js';
import type { CodexUsageDiagnostics, CodexUsageFreshness } from './codex-usage-reader.js';
import { readMachineTelemetry } from './machine-telemetry.js';
import type { MachineTelemetry } from './machine-telemetry.js';

type Freshness = 'fresh' | 'stale' | 'unavailable' | 'not_instrumented';

type OpsMetric<T> = {
  id: string;
  label: string;
  value: T | null;
  unit: string | null;
  status: Freshness;
  generatedAt: string;
  source: string;
  message?: string;
};

type OpsDashboardEnvelope<T> = {
  id: string;
  generatedAt: string;
  status: 'available' | 'partial' | 'not_instrumented';
  data: T;
};

function nowIso(): string {
  return new Date().toISOString();
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function metric<T>(input: Omit<OpsMetric<T>, 'generatedAt'> & { generatedAt?: string }): OpsMetric<T> {
  return {
    ...input,
    generatedAt: input.generatedAt ?? nowIso(),
  };
}

function codexMetricStatus(freshness: CodexUsageFreshness): Freshness {
  if (freshness === 'CURRENT') return 'fresh';
  if (freshness === 'UNAVAILABLE' || freshness === 'PENDING') return 'unavailable';
  return 'stale';
}

function codexMetricMessage(freshness: CodexUsageFreshness, asOf: string | null, filesRead: number, bytesRead: number): string {
  const age = asOf ? `latest event ${asOf}` : 'no usage event is available yet';
  return `Codex usage ${freshness.toLowerCase()}; ${age}. Refresh inspected ${filesRead} changed file${filesRead === 1 ? '' : 's'} (${bytesRead} bytes).`;
}

export async function readOpsSystemMetrics(): Promise<OpsDashboardEnvelope<{
  cpuLoad: OpsMetric<number>;
  memoryPressure: OpsMetric<number>;
  gpuLoad: OpsMetric<number>;
  uptime: OpsMetric<number>;
  disk: MachineTelemetry['disk'];
  processes: MachineTelemetry['processes'];
  collector: MachineTelemetry['collector'];
}>> {
  const generatedAt = nowIso();
  const system = await getSystemMetrics();
  const machine = readMachineTelemetry();
  const cpuCount = Math.max(1, system.cpuCount);
  const loadAverage = system.loadAvg1;
  const memoryPressure = system.memFreePercent === null ? null : 1 - system.memFreePercent / 100;
  const gpuLoad = system.gpuUtilizationPercent;

  return {
    id: 'ops-system-metrics',
    generatedAt,
    status: machine.state === 'CURRENT' && memoryPressure !== null ? 'available' : 'partial',
    data: {
      cpuLoad: metric({
        id: 'cpu-load',
        label: 'CPU load',
        value: round(loadAverage / cpuCount, 4),
        unit: 'ratio',
        status: 'fresh',
        generatedAt,
        source: 'system-metrics.loadAvg1',
        message: '1-minute load average from the host, normalized by logical CPU count.',
      }),
      memoryPressure: metric({
        id: 'memory-pressure',
        label: 'Memory pressure',
        value: memoryPressure === null ? null : round(memoryPressure, 4),
        unit: 'ratio',
        status: memoryPressure === null ? 'unavailable' : 'fresh',
        generatedAt,
        source: 'system-metrics.memory_pressure',
        message: memoryPressure === null
          ? 'Host memory pressure could not be read from the machine.'
          : 'Memory pressure from the host memory_pressure command.',
      }),
      gpuLoad: metric<number>({
        id: 'gpu-load',
        label: 'GPU load',
        value: gpuLoad === null ? null : round(gpuLoad / 100, 4),
        unit: 'ratio',
        status: gpuLoad === null ? 'unavailable' : 'fresh',
        generatedAt,
        source: 'system-metrics.ioreg',
        message: gpuLoad === null
          ? 'GPU utilization could not be read from the host.'
          : 'GPU utilization reported by the host GPU driver.',
      }),
      uptime: metric({
        id: 'uptime',
        label: 'Machine uptime',
        value: Math.floor(system.uptimeSeconds),
        unit: 'seconds',
        status: 'fresh',
        generatedAt,
        source: 'system-metrics.uptime',
      }),
      disk: machine.disk,
      processes: machine.processes,
      collector: machine.collector,
    },
  };
}

export async function readOpsAiUsageWindows(): Promise<OpsDashboardEnvelope<{
  diagnostics: CodexUsageDiagnostics & { freshness: CodexUsageFreshness; asOf: string | null };
  codexCurrentWindow: OpsMetric<number>;
  codexFiveHourWindow: OpsMetric<number>;
  codexSevenDayWindow: OpsMetric<number>;
}>> {
  const generatedAt = nowIso();
  const system = await getSystemMetrics();
  const codex = system.codex;
  const fiveHourWindow = codex.fiveHour;
  const sevenDayWindow = codex.sevenDay;
  const status = codexMetricStatus(codex.freshness);
  const message = codexMetricMessage(codex.freshness, codex.asOf, codex.diagnostics.filesRead, codex.diagnostics.bytesRead);

  return {
    id: 'ops-ai-usage-windows',
    generatedAt,
    status: status === 'fresh' ? 'available' : 'partial',
    data: {
      diagnostics: {
        freshness: codex.freshness,
        asOf: codex.asOf,
        refreshCount: codex.diagnostics.refreshCount,
        filesInspected: codex.diagnostics.filesInspected,
        filesRead: codex.diagnostics.filesRead,
        cachedFiles: codex.diagnostics.cachedFiles,
        bytesRead: codex.diagnostics.bytesRead,
        truncated: codex.diagnostics.truncated,
        inFlight: codex.diagnostics.inFlight,
        errorCount: codex.diagnostics.errorCount,
        lastRefreshAt: codex.diagnostics.lastRefreshAt,
        lastRefreshDurationMs: codex.diagnostics.lastRefreshDurationMs,
      },
      codexCurrentWindow: metric<number>({
        id: 'codex-current-window',
        label: 'Codex current window',
        value: round(fiveHourWindow.usedPercent / 100, 4),
        unit: 'ratio',
        status,
        generatedAt,
        source: 'system-metrics.codex.fiveHour',
        message: `${fiveHourWindow.resetsAt
          ? `Used in the current 5-hour window, resets at ${fiveHourWindow.resetsAt}`
          : 'Current Codex window reported by the host.'} ${message}`,
      }),
      codexFiveHourWindow: metric<number>({
        id: 'codex-five-hour-window',
        label: 'Codex 5-hour window',
        value: round(fiveHourWindow.remainingPercent / 100, 4),
        unit: 'ratio',
        status,
        generatedAt,
        source: 'system-metrics.codex.fiveHour',
        message: `${fiveHourWindow.resetsAt
          ? `Remaining in the current 5-hour window, resets at ${fiveHourWindow.resetsAt}`
          : 'Five-hour Codex window reported by the host.'} ${message}`,
      }),
      codexSevenDayWindow: metric<number>({
        id: 'codex-seven-day-window',
        label: 'Codex 7-day window',
        value: round(sevenDayWindow.usedPercent / 100, 4),
        unit: 'ratio',
        status,
        generatedAt,
        source: 'system-metrics.codex.sevenDay',
        message: `${sevenDayWindow.resetsAt
          ? `Resets at ${sevenDayWindow.resetsAt}`
          : 'Seven-day Codex window reported by the host.'} ${message}`,
      }),
    },
  };
}

export async function readOpsAiCosts(): Promise<OpsDashboardEnvelope<{
  claudeCodeHaiku: OpsMetric<number>;
  claudeCodeSonnet: OpsMetric<number>;
  claudeCodeOpus: OpsMetric<number>;
}>> {
  const generatedAt = nowIso();
  const system = await getSystemMetrics();
  const claudeApi = system.claudeApi;

  return {
    id: 'ops-ai-costs',
    generatedAt,
    status: claudeApi ? 'available' : 'partial',
    data: {
      claudeCodeHaiku: metric<number>({
        id: 'claude-code-haiku-cost',
        label: 'Claude Code Haiku cost',
        value: claudeApi ? round(claudeApi.haiku.costUsd, 4) : 0,
        unit: 'usd',
        status: 'fresh',
        generatedAt,
        source: claudeApi ? 'system-metrics.claudeApi.haiku' : 'system-metrics.claudeApi',
        message: claudeApi
          ? `${claudeApi.haiku.callCount} call${claudeApi.haiku.callCount === 1 ? '' : 's'} this cycle.`
          : 'Claude API usage file not available on this machine.',
      }),
      claudeCodeSonnet: metric<number>({
        id: 'claude-code-sonnet-cost',
        label: 'Claude Code Sonnet cost',
        value: claudeApi ? round(claudeApi.sonnet.costUsd, 4) : 0,
        unit: 'usd',
        status: 'fresh',
        generatedAt,
        source: claudeApi ? 'system-metrics.claudeApi.sonnet' : 'system-metrics.claudeApi',
        message: claudeApi
          ? `${claudeApi.sonnet.callCount} call${claudeApi.sonnet.callCount === 1 ? '' : 's'} this cycle.`
          : 'Claude API usage file not available on this machine.',
      }),
      claudeCodeOpus: metric<number>({
        id: 'claude-code-opus-cost',
        label: 'Claude Code Opus cost',
        value: claudeApi ? round(claudeApi.opus.costUsd, 4) : 0,
        unit: 'usd',
        status: 'fresh',
        generatedAt,
        source: claudeApi ? 'system-metrics.claudeApi.opus' : 'system-metrics.claudeApi',
        message: claudeApi
          ? `${claudeApi.opus.callCount} call${claudeApi.opus.callCount === 1 ? '' : 's'} this cycle.`
          : 'Claude API usage file not available on this machine.',
      }),
    },
  };
}
