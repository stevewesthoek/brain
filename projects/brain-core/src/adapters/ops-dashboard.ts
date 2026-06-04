import os from 'node:os';

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

export function readOpsSystemMetrics(): OpsDashboardEnvelope<{
  cpuLoad: OpsMetric<number>;
  memoryPressure: OpsMetric<number>;
  gpuLoad: OpsMetric<number>;
  uptime: OpsMetric<number>;
}> {
  const generatedAt = nowIso();
  const cpuCount = Math.max(1, os.cpus().length);
  const loadAverage = os.loadavg()[0] ?? 0;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryPressure = totalMemory > 0 ? 1 - freeMemory / totalMemory : null;

  return {
    id: 'ops-system-metrics',
    generatedAt,
    status: 'partial',
    data: {
      cpuLoad: metric({
        id: 'cpu-load',
        label: 'CPU load',
        value: round(loadAverage / cpuCount, 4),
        unit: 'ratio',
        status: 'fresh',
        generatedAt,
        source: 'node:os.loadavg',
        message: '1-minute load average normalized by logical CPU count.',
      }),
      memoryPressure: metric({
        id: 'memory-pressure',
        label: 'Memory pressure',
        value: memoryPressure === null ? null : round(memoryPressure, 4),
        unit: 'ratio',
        status: memoryPressure === null ? 'unavailable' : 'fresh',
        generatedAt,
        source: 'node:os.totalmem/freemem',
      }),
      gpuLoad: metric<number>({
        id: 'gpu-load',
        label: 'GPU load',
        value: null,
        unit: 'ratio',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: 'GPU load is not safely instrumented in Brain Core yet.',
      }),
      uptime: metric({
        id: 'uptime',
        label: 'Machine uptime',
        value: Math.floor(os.uptime()),
        unit: 'seconds',
        status: 'fresh',
        generatedAt,
        source: 'node:os.uptime',
      }),
    },
  };
}

export function readOpsAiUsageWindows(): OpsDashboardEnvelope<{
  codexCurrentWindow: OpsMetric<number>;
  codexFiveHourWindow: OpsMetric<number>;
  codexSevenDayWindow: OpsMetric<number>;
}> {
  const generatedAt = nowIso();
  const notInstrumented = 'Codex usage-window telemetry is not safely instrumented in Brain Core yet.';

  return {
    id: 'ops-ai-usage-windows',
    generatedAt,
    status: 'not_instrumented',
    data: {
      codexCurrentWindow: metric<number>({
        id: 'codex-current-window',
        label: 'Codex current window',
        value: null,
        unit: 'usage',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
      codexFiveHourWindow: metric<number>({
        id: 'codex-five-hour-window',
        label: 'Codex 5-hour window',
        value: null,
        unit: 'usage',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
      codexSevenDayWindow: metric<number>({
        id: 'codex-seven-day-window',
        label: 'Codex 7-day window',
        value: null,
        unit: 'usage',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
    },
  };
}

export function readOpsAiCosts(): OpsDashboardEnvelope<{
  claudeCodeHaiku: OpsMetric<number>;
  claudeCodeSonnet: OpsMetric<number>;
  claudeCodeOpus: OpsMetric<number>;
}> {
  const generatedAt = nowIso();
  const notInstrumented = 'Claude Code per-model cost telemetry is not safely instrumented in Brain Core yet.';

  return {
    id: 'ops-ai-costs',
    generatedAt,
    status: 'not_instrumented',
    data: {
      claudeCodeHaiku: metric<number>({
        id: 'claude-code-haiku-cost',
        label: 'Claude Code Haiku cost',
        value: null,
        unit: 'usd',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
      claudeCodeSonnet: metric<number>({
        id: 'claude-code-sonnet-cost',
        label: 'Claude Code Sonnet cost',
        value: null,
        unit: 'usd',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
      claudeCodeOpus: metric<number>({
        id: 'claude-code-opus-cost',
        label: 'Claude Code Opus cost',
        value: null,
        unit: 'usd',
        status: 'not_instrumented',
        generatedAt,
        source: 'not-instrumented',
        message: notInstrumented,
      }),
    },
  };
}
