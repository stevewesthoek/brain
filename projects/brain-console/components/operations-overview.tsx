'use client';

import Link from 'next/link';
import { ArrowUpRight, CalendarClock, CircleAlert, Database, Network, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { brainCoreRequest, getOperationalSnapshot } from '@/lib/braincore-client';
import { deploymentIdentitySchema, infraCloudflareTunnelsStatusSchema, infraOfficeSchedulerStatusSchema, opsAiUsageWindowsSchema, type OperationalState } from '@/lib/braincore-schemas';
import { formatPercent, timeAgo } from '@/lib/utils';
import { OperationalStateBadge } from '@/components/operational-state';
import { StatusBadge } from '@/components/status-badge';

const REFRESH_MS = 15_000;

function mapQueryState(isPending: boolean, isError: boolean): OperationalState {
  if (isPending) return 'PENDING';
  if (isError) return 'UNAVAILABLE';
  return 'CURRENT';
}

function schedulerState(data: any, pending: boolean, error: boolean): OperationalState {
  if (pending) return 'PENDING';
  if (error || !data) return 'UNAVAILABLE';
  if (data.health === 'failed') return 'ERROR';
  if (data.health === 'warning') return 'DEGRADED';
  return 'CURRENT';
}

function tunnelState(data: any, pending: boolean, error: boolean): OperationalState {
  if (pending) return 'PENDING';
  if (error || !data) return 'UNAVAILABLE';
  if (data.status !== 'ok') return 'DEGRADED';
  return data.tunnels.every((tunnel: any) => ['healthy', 'active', 'running', 'up', 'connected', 'online'].includes(String(tunnel.status).toLowerCase())) ? 'CURRENT' : 'DEGRADED';
}

function StatusTile({ icon: Icon, label, value, detail, state }: { icon: typeof Server; label: string; value: string; detail: string; state: OperationalState }) {
  return <article className="workspace-status-tile"><div className="workspace-card-kicker"><span className="workspace-icon"><Icon size={15} /></span><span>{label}</span><OperationalStateBadge state={state} /></div><strong>{value}</strong><span className="meta">{detail}</span></article>;
}

function dateLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function OperationsOverview() {
  const scheduler = useQuery({ queryKey: ['operations-scheduler'], queryFn: () => brainCoreRequest('/infra/scheduler', infraOfficeSchedulerStatusSchema, { timeoutMs: 12_000 }), refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: 10_000 });
  const tunnels = useQuery({ queryKey: ['operations-tunnels'], queryFn: () => brainCoreRequest('/infra/tunnels', infraCloudflareTunnelsStatusSchema, { timeoutMs: 12_000 }), refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: 10_000 });
  const usage = useQuery({ queryKey: ['operations-codex-usage'], queryFn: () => brainCoreRequest('/ops/ai-usage-windows', opsAiUsageWindowsSchema), refetchInterval: 30_000, refetchIntervalInBackground: false, staleTime: 15_000 });
  const identity = useQuery({ queryKey: ['operations-identity'], queryFn: () => brainCoreRequest('/runtime/identity', deploymentIdentitySchema), refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: 10_000 });
  const snapshot = useQuery({ queryKey: ['operations-snapshot'], queryFn: getOperationalSnapshot, refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: 10_000 });

  const schedulerData = scheduler.data;
  const usageData = usage.data?.data;
  const diagnostics = usageData?.diagnostics;
  const attention = snapshot.data?.sections.attention.data.items ?? [];
  const activity = (snapshot.data?.sections.activity.data.items ?? []).filter((item) => item.severity !== 'info').slice(0, 3);
  const failedJobs = (schedulerData?.failedJobs ?? 0) + (schedulerData?.timeoutJobs ?? 0);
  const lastRunStatus = typeof schedulerData?.lastRun?.status === 'string' ? schedulerData.lastRun.status : '—';
  const overallState: OperationalState = snapshot.data?.overall.state ?? (snapshot.isError ? 'DEGRADED' : 'PENDING');
  const refreshAll = () => void Promise.all([scheduler.refetch(), tunnels.refetch(), usage.refetch(), identity.refetch(), snapshot.refetch()]);

  return (
    <div className="workspace-screen operations-workspace">
      <header className="workspace-header"><div><div className="eyebrow">Operations</div><h1>Operations Overview</h1><p>Scheduler, runtime, tunnels, failures, and Codex telemetry with anomaly-first detail.</p></div><div className="workspace-header-actions"><OperationalStateBadge state={overallState} /><span className="meta">{snapshot.data?.generatedAt ? `Updated ${timeAgo(snapshot.data.generatedAt)}` : 'Loading live posture'}</span><button className="button compact secondary" onClick={refreshAll}><RefreshCw size={14} /> Refresh</button></div></header>

      <section className="workspace-metric-grid operations-status-grid" aria-label="Operations posture"><StatusTile icon={CalendarClock} label="Scheduler" value={lastRunStatus} detail={schedulerData?.nextRunAt ? `Next ${dateLabel(schedulerData.nextRunAt)}` : 'Next run unavailable'} state={schedulerState(schedulerData, scheduler.isPending, scheduler.isError)} /><StatusTile icon={Server} label="Runtime" value={identity.data?.runtime.serviceState ?? '—'} detail={identity.data?.identityState ?? 'Identity unavailable'} state={identity.isError ? 'UNAVAILABLE' : identity.data?.identityState === 'matching' ? 'CURRENT' : 'DEGRADED'} /><StatusTile icon={Network} label="Tunnels" value={tunnels.data?.tunnels.length ? `${tunnels.data.tunnels.length} configured` : '—'} detail={tunnels.data?.tunnels.map((tunnel) => tunnel.name).join(' · ') ?? 'Tunnel source unavailable'} state={tunnelState(tunnels.data, tunnels.isPending, tunnels.isError)} /><StatusTile icon={Database} label="Codex usage" value={usageData?.codexCurrentWindow.value === null || usageData?.codexCurrentWindow.value === undefined ? '—' : formatPercent(usageData.codexCurrentWindow.value * 100)} detail={diagnostics ? `${diagnostics.filesRead} changed files · ${diagnostics.bytesRead} bytes` : 'Telemetry unavailable'} state={diagnostics?.freshness ?? mapQueryState(usage.isPending, usage.isError)} /></section>

      <div className="workspace-grid operations-primary-grid">
        <section className="workspace-panel" aria-labelledby="operations-attention"><div className="workspace-panel-heading"><div><div className="eyebrow">Anomaly first</div><h2 id="operations-attention">Attention</h2></div><Link href="/command-center" className="workspace-link">Command Center <ArrowUpRight size={13} /></Link></div><div className="workspace-list">{attention.slice(0, 4).map((item) => <div className="workspace-attention-row" key={item.id}><OperationalStateBadge state={item.state} /><div><strong>{item.title}</strong><span className="meta">{item.explanation}</span></div></div>)}{attention.length === 0 ? <div className="workspace-empty"><OperationalStateBadge state="CURRENT" /><span>No attention items reported by the canonical model.</span></div> : null}</div><div className="workspace-panel-footer"><CircleAlert size={14} /> <span className="meta">Existing attention model · {attention.length} total items</span></div></section>

        <section className="workspace-panel" aria-labelledby="operations-scheduler"><div className="workspace-panel-heading"><div><div className="eyebrow">Scheduled work</div><h2 id="operations-scheduler">Scheduler posture</h2></div><Link href="/scheduler" className="workspace-link">History <ArrowUpRight size={13} /></Link></div><div className="workspace-kpi-row"><div><strong>{schedulerData?.successfulJobs ?? '—'}</strong><span className="meta">successful</span></div><div><strong>{failedJobs}</strong><span className="meta">failures</span></div><div><strong>{schedulerData?.runningJobs ?? '—'}</strong><span className="meta">running</span></div></div><div className="workspace-list"><div className="workspace-status-row"><div className="workspace-status-name"><StatusBadge status={schedulerData?.lastRun?.status} /><strong>Latest run</strong></div><span className="meta">{dateLabel(schedulerData?.lastRun?.endedAt)} · {schedulerData?.lastRun?.durationSeconds ?? '—'}s</span></div><div className="workspace-status-row"><div className="workspace-status-name"><OperationalStateBadge state="CURRENT" /><strong>Next run</strong></div><span className="meta">{dateLabel(schedulerData?.nextRunAt)}</span></div></div><div className="workspace-panel-footer"><ShieldCheck size={14} /> <span className="meta">{schedulerData?.launchMechanism ?? 'Scheduler source unavailable'} · read-only</span></div></section>

        <section className="workspace-panel" aria-labelledby="operations-events"><div className="workspace-panel-heading"><div><div className="eyebrow">Recent exceptions</div><h2 id="operations-events">Events & failures</h2></div><Link href="/infrastructure" className="workspace-link">Infrastructure <ArrowUpRight size={13} /></Link></div><div className="workspace-list">{activity.map((item) => <div className="workspace-attention-row" key={item.id}><StatusBadge status={item.severity === 'critical' ? 'error' : 'warning'} label={item.severity} /><div><strong>{item.eventType}</strong><span className="meta">{item.summary}</span></div><span className="meta">{timeAgo(item.occurredAt)}</span></div>)}{activity.length === 0 ? <div className="workspace-empty"><StatusBadge status="fresh" label="Clear" /><span>No recent warning or critical events.</span></div> : null}</div><div className="workspace-panel-footer"><CircleAlert size={14} /> <span className="meta">{snapshot.data?.errors.length ?? 0} source errors in current snapshot</span></div></section>

        <section className="workspace-panel" aria-labelledby="operations-telemetry"><div className="workspace-panel-heading"><div><div className="eyebrow">Bounded telemetry</div><h2 id="operations-telemetry">Codex usage index</h2></div><Link href="/monitoring" className="workspace-link">Telemetry <ArrowUpRight size={13} /></Link></div><div className="workspace-telemetry-state"><OperationalStateBadge state={diagnostics?.freshness ?? 'PENDING'} /><strong>{diagnostics?.asOf ? `Latest event ${timeAgo(diagnostics.asOf)}` : 'Waiting for first bounded refresh'}</strong></div><div className="workspace-kpi-row"><div><strong>{diagnostics?.filesInspected ?? '—'}</strong><span className="meta">files inspected</span></div><div><strong>{diagnostics?.cachedFiles ?? '—'}</strong><span className="meta">cached</span></div><div><strong>{diagnostics?.refreshCount ?? '—'}</strong><span className="meta">refreshes</span></div></div><p className="meta">{diagnostics?.inFlight ? 'Refreshing in the background; cached values remain visible.' : diagnostics?.truncated ? 'Input bounds reached; telemetry is explicitly partial.' : 'Incremental metadata index; transcript bodies are never retained.'}</p><div className="workspace-panel-footer"><ShieldCheck size={14} /> <span className="meta">{diagnostics?.errorCount ?? 0} isolated input errors · no direct session scan</span></div></section>
      </div>
      <footer className="workspace-footer"><span className="meta">Operational state is sourced from Brain Core. Details stay behind Scheduler, Local Apps, Tunnels, and Infrastructure routes.</span><span className="workspace-footer-links"><Link href="/tunnels" className="button-link">Open Tunnels <ArrowUpRight size={13} /></Link><Link href="/computer" className="button-link">Open Computer <ArrowUpRight size={13} /></Link></span></footer>
    </div>
  );
}
