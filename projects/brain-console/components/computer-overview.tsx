'use client';

import Link from 'next/link';
import { Activity, ArrowUpRight, Cpu, HardDrive, MemoryStick, Network, RefreshCw, Server, ShieldCheck, Timer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { brainCoreRequest } from '@/lib/braincore-client';
import { deploymentIdentitySchema, infraCloudflareTunnelsStatusSchema, infraOfficeSchedulerStatusSchema, localAppsDashboardSchema, opsSystemMetricsSchema, type InfraOfficeSchedulerStatus, type LocalApp, type OpsMetric, type OperationalState } from '@/lib/braincore-schemas';
import { formatDuration, formatPercent, timeAgo } from '@/lib/utils';
import { OperationalStateBadge } from '@/components/operational-state';
import { StatusBadge } from '@/components/status-badge';

const REFRESH_MS = 15_000;

function queryOptions() {
  return { refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: 10_000 } as const;
}

function metricState(metric: OpsMetric | undefined): OperationalState {
  if (!metric) return 'PENDING';
  if (metric.status === 'unavailable' || metric.status === 'not_instrumented') return 'UNAVAILABLE';
  if (metric.status === 'stale') return 'STALE';
  if (typeof metric.value !== 'number') return 'UNAVAILABLE';
  if (metric.unit === 'ratio' && metric.value >= 0.95) return 'ERROR';
  if (metric.unit === 'ratio' && metric.value >= 0.8) return 'DEGRADED';
  return 'CURRENT';
}

function metricValue(metric: OpsMetric | undefined): string {
  if (!metric || metric.value === null) return 'Not instrumented';
  if (metric.unit === 'ratio') return formatPercent(metric.value * 100);
  if (metric.unit === 'seconds') return formatDuration(metric.value);
  return String(metric.value);
}

function queryState(isPending: boolean, isError: boolean): OperationalState {
  if (isPending) return 'PENDING';
  if (isError) return 'UNAVAILABLE';
  return 'CURRENT';
}

function appState(app: LocalApp | undefined): OperationalState {
  if (!app) return 'UNAVAILABLE';
  if (app.status === 'running' && app.health === 'healthy') return 'CURRENT';
  if (app.status === 'unknown' || app.health === 'unknown') return 'UNAVAILABLE';
  return 'DEGRADED';
}

function schedulerState(data: InfraOfficeSchedulerStatus | undefined, isPending: boolean, isError: boolean): OperationalState {
  if (isPending) return 'PENDING';
  if (isError || !data) return 'UNAVAILABLE';
  if (data.health === 'failed') return 'ERROR';
  if (data.health === 'warning') return 'DEGRADED';
  return 'CURRENT';
}

function tunnelState(data: { status: string; tunnels: { status: string; hostnames?: { online: boolean | null }[] }[] } | undefined, isPending: boolean, isError: boolean): OperationalState {
  if (isPending) return 'PENDING';
  if (isError || !data) return 'UNAVAILABLE';
  if (data.status !== 'ok') return 'DEGRADED';
  return data.tunnels.every((tunnel) => ['healthy', 'active', 'running', 'up', 'connected', 'online'].includes(tunnel.status.toLowerCase()) && (tunnel.hostnames ?? []).every((host) => host.online !== false)) ? 'CURRENT' : 'DEGRADED';
}

function MetricCard({ icon: Icon, label, metric, description, notInstrumented = false }: { icon: typeof Cpu; label: string; metric?: OpsMetric; description: string; notInstrumented?: boolean }) {
  const state = notInstrumented ? 'UNAVAILABLE' : metricState(metric);
  return (
    <article className="workspace-metric-card">
      <div className="workspace-card-kicker"><span className="workspace-icon"><Icon size={15} /></span><span>{label}</span><OperationalStateBadge state={state} /></div>
      <strong className="workspace-metric-value">{metricValue(metric)}</strong>
      <span className="meta">{description}</span>
      <div className="workspace-meter" aria-hidden="true"><span style={{ width: `${metric?.unit === 'ratio' && typeof metric.value === 'number' ? Math.min(100, Math.max(0, metric.value * 100)) : 0}%` }} /></div>
    </article>
  );
}

function ServiceRow({ label, detail, state }: { label: string; detail: string; state: OperationalState }) {
  return <div className="workspace-status-row"><div className="workspace-status-name"><OperationalStateBadge state={state} /><strong>{label}</strong></div><span className="meta">{detail}</span></div>;
}

function AppRow({ app }: { app: LocalApp }) {
  return <div className="workspace-status-row"><div className="workspace-status-name"><StatusBadge status={app.status} /><strong>{app.label ?? app.name}</strong></div><span className="meta">{app.port ? `:${app.port}` : 'no port'} · {app.health ?? 'unknown'}</span></div>;
}

export function ComputerOverview() {
  const system = useQuery({ queryKey: ['computer-system-metrics'], queryFn: () => brainCoreRequest('/ops/system-metrics', opsSystemMetricsSchema), ...queryOptions() });
  const apps = useQuery({ queryKey: ['computer-local-apps'], queryFn: () => brainCoreRequest('/local-apps/dashboard', localAppsDashboardSchema), ...queryOptions() });
  const identity = useQuery({ queryKey: ['computer-identity'], queryFn: () => brainCoreRequest('/runtime/identity', deploymentIdentitySchema), ...queryOptions() });
  const scheduler = useQuery({ queryKey: ['computer-scheduler'], queryFn: () => brainCoreRequest('/infra/scheduler', infraOfficeSchedulerStatusSchema), ...queryOptions() });
  const tunnels = useQuery({ queryKey: ['computer-tunnels'], queryFn: () => brainCoreRequest('/infra/tunnels', infraCloudflareTunnelsStatusSchema), ...queryOptions() });

  const appList = apps.data?.apps ?? [];
  const appById = new Map(appList.map((app) => [app.id, app]));
  const visibleApps = appList.filter((app) => app.status === 'running' || app.id === 'mind-steward').slice(0, 5);
  const obsidian = appList.find((app) => app.id.toLowerCase().includes('obsidian') || app.name.toLowerCase().includes('obsidian'));
  const networkState = tunnelState(tunnels.data, tunnels.isPending, tunnels.isError);
  const brainCoreState: OperationalState = identity.isPending ? 'PENDING' : identity.isError ? 'UNAVAILABLE' : identity.data?.identityState === 'matching' && identity.data.runtime.serviceState === 'running' ? 'CURRENT' : 'DEGRADED';
  const consoleState = appState(appById.get('brain-console'));
  const schedulerStatus = schedulerState(scheduler.data, scheduler.isPending, scheduler.isError);
  const refreshedAt = system.data?.generatedAt ?? apps.data?.apps[0]?.lastCheckedAt ?? null;

  return (
    <div className="workspace-screen computer-workspace">
      <header className="workspace-header">
        <div><div className="eyebrow">Computer</div><h1>Computer Overview</h1><p>Host posture, Brain services, local applications, and network reachability in one compact view.</p></div>
        <div className="workspace-header-actions"><OperationalStateBadge state={networkState === 'ERROR' ? 'ERROR' : networkState === 'DEGRADED' || system.isError || apps.isError ? 'DEGRADED' : 'CURRENT'} /><span className="meta">{refreshedAt ? `Updated ${timeAgo(refreshedAt)}` : 'Loading live data'}</span><button className="button compact secondary" onClick={() => void Promise.all([system.refetch(), apps.refetch(), identity.refetch(), scheduler.refetch(), tunnels.refetch()])}><RefreshCw size={14} /> Refresh</button></div>
      </header>

      <section className="workspace-metric-grid" aria-label="Machine telemetry">
        <MetricCard icon={Cpu} label="CPU load" metric={system.data?.data.cpuLoad} description="Normalized 1-minute host load" />
        <MetricCard icon={MemoryStick} label="Memory pressure" metric={system.data?.data.memoryPressure} description="Host memory pressure" />
        <MetricCard icon={HardDrive} label="Disk" description="No disk metric is instrumented" notInstrumented />
        <MetricCard icon={Timer} label="Uptime" metric={system.data?.data.uptime} description="Since the Core process started" />
      </section>

      <div className="workspace-grid workspace-grid-three">
        <section className="workspace-panel" aria-labelledby="computer-services"><div className="workspace-panel-heading"><div><div className="eyebrow">Runtime</div><h2 id="computer-services">Brain services</h2></div><Link href="/operations" className="workspace-link">Operations <ArrowUpRight size={13} /></Link></div><div className="workspace-list"><ServiceRow label="Brain Core" detail={identity.data?.runtime.serviceState ?? 'checking'} state={brainCoreState} /><ServiceRow label="Brain Console" detail={appById.get('brain-console')?.port ? `:${appById.get('brain-console')?.port}` : '4881'} state={consoleState} /><ServiceRow label="Scheduler" detail={scheduler.data?.schedule ?? 'daily schedule'} state={schedulerStatus} />{obsidian ? <ServiceRow label="Obsidian" detail={obsidian.status ?? 'unknown'} state={appState(obsidian)} /> : null}</div><div className="workspace-panel-footer"><ShieldCheck size={14} /> <span className="meta">Identity {identity.data?.identityState ?? 'pending'} · launchd-backed</span></div></section>

        <section className="workspace-panel" aria-labelledby="computer-apps"><div className="workspace-panel-heading"><div><div className="eyebrow">Applications</div><h2 id="computer-apps">Local apps</h2></div><Link href="/local-apps" className="workspace-link">Details <ArrowUpRight size={13} /></Link></div><div className="workspace-mini-summary"><strong>{apps.data?.runningCount ?? '—'}</strong><span>running</span><strong>{apps.data?.unknownCount ?? '—'}</strong><span>unknown</span><strong>{apps.data?.appCount ?? '—'}</strong><span>registered</span></div><div className="workspace-list">{visibleApps.map((app) => <AppRow key={app.id} app={app} />)}{visibleApps.length === 0 ? <div className="workspace-empty"><StatusBadge status={apps.isError ? 'error' : 'unknown'} label={apps.isError ? 'Unavailable' : 'Loading'} /><span>Local app registry has no current rows.</span></div> : null}</div><div className="workspace-panel-footer"><AppWindowIcon /> <span className="meta">Healthy items recede; stopped apps remain available in detail.</span></div></section>

        <section className="workspace-panel" aria-labelledby="computer-network"><div className="workspace-panel-heading"><div><div className="eyebrow">Connectivity</div><h2 id="computer-network">Ports & tunnels</h2></div><Link href="/tunnels" className="workspace-link">Details <ArrowUpRight size={13} /></Link></div><div className="workspace-port-list"><div className="workspace-port-row"><span><Network size={14} /> Brain Core</span><code>:4877</code><OperationalStateBadge state={brainCoreState} /></div><div className="workspace-port-row"><span><Server size={14} /> Brain Console</span><code>:4881</code><OperationalStateBadge state={consoleState} /></div>{(tunnels.data?.tunnels ?? []).slice(0, 2).map((tunnel) => <div className="workspace-port-row" key={tunnel.id}><span><Network size={14} /> {tunnel.name}</span><span className="meta">{tunnel.hostnames.filter((host) => host.online === true).length}/{tunnel.hostnames.length} reachable</span><OperationalStateBadge state={tunnelState({ status: tunnel.status, tunnels: [tunnel] }, false, false)} /></div>)}</div><div className="workspace-panel-footer"><Activity size={14} /> <span className="meta">Tunnel state is read-only; credentials are never displayed.</span></div></section>
      </div>
      <footer className="workspace-footer"><span className="meta">Conservative attention thresholds: ≥80% degraded, ≥95% error. Disk and process-level anomalies are not instrumented by Core.</span><Link href="/operations" className="button-link">Open Operations <ArrowUpRight size={13} /></Link></footer>
    </div>
  );
}

function AppWindowIcon() { return <Server size={14} />; }
