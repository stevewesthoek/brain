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

function MetricCard({ metric }: { metric: OpsMetric }) {
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{metric.label}</div>
          <div className="card-description">{metric.source}</div>
        </div>
        <StatusBadge status={metric.status} />
      </div>
      <div className="metric">{metricValue(metric)}</div>
      <div className="meta">Updated {timeAgo(metric.generatedAt)}</div>
      {metric.message ? <p className="meta">{metric.message}</p> : null}
    </article>
  );
}

export function OverviewDashboard() {
  const system = useQuery({
    queryKey: ['ops-system-metrics'],
    queryFn: () => brainCoreRequest('/ops/system-metrics', opsSystemMetricsSchema),
    refetchInterval: 5_000,
  });
  const usage = useQuery({
    queryKey: ['ops-ai-usage-windows'],
    queryFn: () => brainCoreRequest('/ops/ai-usage-windows', opsAiUsageWindowsSchema),
    refetchInterval: 30_000,
  });
  const costs = useQuery({
    queryKey: ['ops-ai-costs'],
    queryFn: () => brainCoreRequest('/ops/ai-costs', opsAiCostsSchema),
    refetchInterval: 60_000,
  });

  const metrics: OpsMetric[] = [
    ...(system.data ? [system.data.data.cpuLoad, system.data.data.memoryPressure, system.data.data.gpuLoad, system.data.data.uptime] : []),
    ...(usage.data ? [usage.data.data.codexCurrentWindow, usage.data.data.codexFiveHourWindow, usage.data.data.codexSevenDayWindow] : []),
    ...(costs.data ? [costs.data.data.claudeCodeHaiku, costs.data.data.claudeCodeSonnet, costs.data.data.claudeCodeOpus] : []),
  ];

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Overview</div>
          <h1>Operational pulse</h1>
          <p>Live system, Codex window, and Claude Code cost cards from Brain Core. Missing telemetry is shown as not instrumented, not guessed.</p>
        </div>
        <div className="row">
          <StatusBadge status={system.isError || usage.isError || costs.isError ? 'error' : 'fresh'} label={system.isError || usage.isError || costs.isError ? 'partial error' : 'auto refresh'} />
          <span className="meta">System refreshes every 5 seconds</span>
        </div>
      </section>

      {(system.isLoading || usage.isLoading || costs.isLoading) && metrics.length === 0 ? (
        <div className="card">Loading Brain Core operational metrics…</div>
      ) : null}

      {(system.error || usage.error || costs.error) ? (
        <div className="card">
          <div className="card-title">Some overview data failed to load</div>
          <p>Brain Console Center keeps available cards visible and marks missing data explicitly.</p>
        </div>
      ) : null}

      <section className="grid cards">
        {metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
      </section>
    </div>
  );
}
