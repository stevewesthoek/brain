'use client';

import { useQuery } from '@tanstack/react-query';
import { brainCoreRequest } from '@/lib/braincore-client';
import { opsAiCostsSchema, opsAiUsageWindowsSchema, opsSystemMetricsSchema, type OpsMetric } from '@/lib/braincore-schemas';
import { formatDuration, formatPercent, formatUsd, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

function metricValue(metric: OpsMetric): string {
  if (metric.unit === 'ratio') return formatPercent(metric.value === null ? null : metric.value * 100);
  if (metric.unit === 'seconds') return formatDuration(metric.value);
  if (metric.unit === 'usd') return formatUsd(metric.value);
  if (typeof metric.value === 'number') return String(metric.value);
  return 'Not instrumented';
}

function PulseMetricCard({ metric }: { metric: OpsMetric }) {
  return (
    <article className="pulse-card">
      <div className="pulse-card-header">
        <div className="pulse-card-title">{metric.label}</div>
        <StatusBadge status={metric.status} />
      </div>
      <div className="pulse-metric">{metricValue(metric)}</div>
      <div className="pulse-meta">Updated {timeAgo(metric.generatedAt)}</div>
      {metric.message ? <p className="pulse-message">{metric.message}</p> : null}
    </article>
  );
}

const SYSTEM_REFRESH_MS = 15_000;
const AI_REFRESH_MS = 30_000;

export function GlobalPulseStrip() {
  const system = useQuery({
    queryKey: ['ops-system-metrics'],
    queryFn: () => brainCoreRequest('/ops/system-metrics', opsSystemMetricsSchema),
    refetchInterval: SYSTEM_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const usage = useQuery({
    queryKey: ['ops-ai-usage-windows'],
    queryFn: () => brainCoreRequest('/ops/ai-usage-windows', opsAiUsageWindowsSchema),
    refetchInterval: AI_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const costs = useQuery({
    queryKey: ['ops-ai-costs'],
    queryFn: () => brainCoreRequest('/ops/ai-costs', opsAiCostsSchema),
    refetchInterval: AI_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const metrics: OpsMetric[] = [
    ...(system.data ? [system.data.data.cpuLoad, system.data.data.memoryPressure, system.data.data.gpuLoad, system.data.data.uptime] : []),
    ...(usage.data ? [usage.data.data.codexCurrentWindow, usage.data.data.codexFiveHourWindow, usage.data.data.codexSevenDayWindow] : []),
    ...(costs.data ? [costs.data.data.claudeCodeHaiku, costs.data.data.claudeCodeSonnet, costs.data.data.claudeCodeOpus] : []),
  ];

  return (
    <section className="pulse-strip" aria-label="Operational pulse">
      <div className="pulse-strip-header">
        <div>
          <div className="eyebrow">Operational pulse</div>
          <p className="pulse-strip-copy">Live system telemetry, derived Codex windows, and Claude Code cost estimates stay pinned here on every view.</p>
        </div>
        <div className="pulse-strip-status">
          <StatusBadge status={system.isError || usage.isError || costs.isError ? 'error' : 'fresh'} label={system.isError || usage.isError || costs.isError ? 'partial' : 'live'} />
          <span className="meta">System every 15s, AI estimates every 30s</span>
        </div>
      </div>

      <div className="pulse-grid">
        {metrics.map((metric) => <PulseMetricCard key={metric.id} metric={metric} />)}
      </div>
    </section>
  );
}
