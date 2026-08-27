'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { brainCoreRequest } from '@/lib/braincore-client';
import { canonicalInfrastructureTelemetrySchema, type CanonicalInfrastructureTelemetry } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';
import { formatDuration, formatPercent, timeAgo } from '@/lib/utils';

const CANONICAL_HOSTS = [
  { name: 'dokploy-aws', resourceId: 'host:dokploy-aws' },
  { name: 'cloudpanel-aws', resourceId: 'host:cloudpanel-aws' },
  { name: 'vm-supabase', resourceId: 'host:vm-supabase' },
] as const;
type CanonicalHost = CanonicalInfrastructureTelemetry['hosts'][number];

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}

function formatCount(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Unavailable';
}

function formatTimestamp(value: string | null): string {
  return value ? `${timeAgo(value)} (${new Date(value).toLocaleString()})` : 'Unavailable';
}

function stateTone(state: string): string {
  return state.toLowerCase();
}

function HostCard({ host, expectedId }: { host: CanonicalHost | null; expectedId: string }) {
  if (!host) {
    return (
      <article className="card" aria-label={`${expectedId} telemetry unavailable`}>
        <div className="card-header">
          <div>
            <div className="card-title">{expectedId}</div>
            <div className="meta">Canonical host identity</div>
          </div>
          <StatusBadge status="unknown" label="UNKNOWN" />
        </div>
        <p className="card-description" style={{ marginTop: 10 }}>Brain Core did not return this canonical host. No health is inferred in the Console.</p>
      </article>
    );
  }

  const storageWithMetrics = host.metrics.storage.filter((item) => item.usedPercent !== null);
  const maxDisk = storageWithMetrics.length > 0 ? Math.max(...storageWithMetrics.map((item) => item.usedPercent as number)) : null;
  const swap = host.metrics.swapTotalBytes === null && host.metrics.swapUsedBytes === null
    ? 'Unavailable'
    : `${formatBytes(host.metrics.swapUsedBytes)} / ${formatBytes(host.metrics.swapTotalBytes)}`;

  return (
    <article className="card" aria-label={`${host.name} telemetry`}>
      <div className="card-header">
        <div>
          <div className="card-title">{host.name}</div>
          <div className="meta"><code>{host.resourceId}</code> · {host.entity.name ?? 'Entity unavailable'}</div>
        </div>
        <StatusBadge status={stateTone(host.state)} label={host.state} />
      </div>
      <p className="card-description" style={{ marginTop: 10 }}>{host.stateReason}</p>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <tbody>
            <tr><td>Telemetry</td><td><StatusBadge status={host.telemetry.freshness} label={host.telemetry.freshness} /></td><td className="meta">{formatTimestamp(host.telemetry.lastSeenAt)}</td></tr>
            <tr><td>Agent / entity</td><td className="meta">{host.telemetry.agentVersion ?? 'Not instrumented'}</td><td className="meta">{host.entity.guid ? 'GUID mapped' : 'GUID unavailable'}</td></tr>
            <tr><td>CPU / load</td><td className="meta">{formatPercent(host.metrics.cpuPercent)}</td><td className="meta">load {host.metrics.loadAverageOneMinute ?? 'Unavailable'}</td></tr>
            <tr><td>Memory</td><td className="meta">{formatPercent(host.metrics.memoryUsedPercent)}</td><td className="meta">{formatBytes(host.metrics.memoryAvailableBytes)} available</td></tr>
            <tr><td>Swap</td><td className="meta" colSpan={2}>{swap}</td></tr>
            <tr><td>Storage</td><td className="meta">{maxDisk === null ? 'Unavailable' : formatPercent(maxDisk)}</td><td className="meta">{host.metrics.storage.length} mount{host.metrics.storage.length === 1 ? '' : 's'}</td></tr>
            <tr><td>Uptime</td><td className="meta">{formatDuration(host.metrics.uptimeSeconds)}</td><td className="meta">processes {formatCount(host.metrics.processCount)}</td></tr>
            <tr><td>Docker</td><td className="meta">{host.runtime.docker.replaceAll('_', ' ')}</td><td className="meta">{host.runtime.runningContainers === null ? 'running unavailable' : `${host.runtime.runningContainers} running`} · {host.runtime.nonRunningContainers === null ? 'non-running unavailable' : `${host.runtime.nonRunningContainers} non-running`}</td></tr>
            <tr><td>Services</td><td className="meta">{host.runtime.systemd}</td><td className="meta">{host.runtime.activeServices === null ? 'active unavailable' : `${host.runtime.activeServices} active`} · {host.runtime.failedServices === null ? 'failed unavailable' : `${host.runtime.failedServices} failed`}</td></tr>
            <tr><td>Restart signals</td><td className="meta">{formatCount(host.runtime.restartCount)}</td><td className="meta">alert {host.entity.alertSeverity ?? 'none'}</td></tr>
            <tr><td>Backup</td><td><StatusBadge status={host.backup.state} label={host.backup.state} /></td><td className="meta">{host.backup.reason}</td></tr>
          </tbody>
        </table>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary className="card-description">Show identity, services, storage, and backup evidence</summary>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <tbody>
              <tr><td>Continuity alias</td><td className="meta">{host.entity.continuityAlias ?? 'Unavailable'}</td></tr>
              <tr><td>Last successful backup</td><td className="meta">{formatTimestamp(host.backup.lastSuccessAt)}</td></tr>
              <tr><td>Last backup attempt</td><td className="meta">{formatTimestamp(host.backup.lastAttemptAt)}</td></tr>
              <tr><td>Backup source</td><td className="meta">{host.backup.sourceRef ?? 'Unavailable'}</td></tr>
              <tr><td>Service statuses</td><td className="meta">{host.runtime.serviceStatuses.length === 0 ? 'Unavailable' : host.runtime.serviceStatuses.map((service) => `${service.name}: ${service.status}`).join(' · ')}</td></tr>
              <tr><td>Storage detail</td><td className="meta">{host.metrics.storage.length === 0 ? 'Unavailable' : host.metrics.storage.map((item) => `${item.mountPoint}: ${formatPercent(item.usedPercent)}`).join(' · ')}</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}

function SummaryCard({ label, count, status, description }: { label: string; count: number | string; status: string; description: string }) {
  return (
    <article className="card compact-card">
      <div className="card-header"><div className="card-title">{label}</div><StatusBadge status={status} label={label} /></div>
      <div className="metric">{count}</div>
      <div className="meta">{description}</div>
    </article>
  );
}

function LoadingCards() {
  return (
    <div className="grid three" aria-label="Loading canonical host telemetry" aria-busy="true">
      {CANONICAL_HOSTS.map((host) => <article className="card" key={host.resourceId}><div className="card-title">{host.name}</div><p className="card-description" style={{ marginTop: 10 }}>Loading telemetry…</p></article>)}
    </div>
  );
}

export function CanonicalInfrastructureTelemetry() {
  const telemetry = useQuery({
    queryKey: ['canonical-infrastructure-telemetry'],
    queryFn: () => brainCoreRequest('/infra/telemetry', canonicalInfrastructureTelemetrySchema, { timeoutMs: 15_000 }),
    refetchInterval: 15_000,
  });

  const hosts = useMemo(() => {
    const byId = new Map((telemetry.data?.hosts ?? []).map((host) => [host.resourceId, host]));
    return CANONICAL_HOSTS.map((host) => byId.get(host.resourceId) ?? null);
  }, [telemetry.data?.hosts]);
  const knownHosts = hosts.filter((host): host is CanonicalHost => host !== null);
  const summary = {
    healthy: knownHosts.filter((host) => host.state === 'HEALTHY').length,
    warning: knownHosts.filter((host) => host.state === 'WARNING').length,
    critical: knownHosts.filter((host) => host.state === 'CRITICAL').length,
    staleUnknown: hosts.length - knownHosts.filter((host) => host.state !== 'STALE' && host.state !== 'UNKNOWN').length,
  };
  const unavailable = telemetry.isError || telemetry.data?.status !== 'ok';
  const sourceStatus = telemetry.isError ? 'error' : telemetry.data?.status === 'ok' ? 'fresh' : 'unknown';
  const sourceLabel = telemetry.isError ? 'Unavailable' : telemetry.data?.status === 'ok' ? 'New Relic EU' : 'Unknown';

  return (
    <section className="stack" aria-labelledby="infrastructure-telemetry-title">
      <section className="page-heading">
        <div>
          <div className="eyebrow">New Relic / Production infrastructure</div>
          <h1 id="infrastructure-telemetry-title">Infrastructure Telemetry</h1>
          <p>Read-only canonical host observability from Brain Core. Health state, freshness, backup truth, and alert evidence are supplied by the provider-backed `/infra/telemetry` contract.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={sourceStatus} label={sourceLabel} />
          <span className="meta">Updated {telemetry.data?.generatedAt ? formatTimestamp(telemetry.data.generatedAt) : 'Unavailable'} · refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void telemetry.refetch()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </section>

      {telemetry.isPending ? <LoadingCards /> : null}
      {telemetry.isError ? <div className="compact-error" role="alert"><strong>Canonical telemetry unavailable.</strong> Brain Core could not read `/infra/telemetry`; no host is marked healthy.</div> : null}
      {telemetry.data?.status === 'error' ? <div className="compact-error" role="alert"><strong>Provider telemetry failed closed.</strong> Brain Core returned an error state; UNKNOWN/STALE host evidence remains visible and is not promoted to healthy.</div> : null}
      {telemetry.data?.status === 'not-configured' ? <div className="compact-error" role="alert"><strong>Canonical telemetry is not configured.</strong> Brain Core did not provide a healthy provider-backed result.</div> : null}

      {!telemetry.isPending ? (
        <>
          <section className="grid cards" aria-label="Canonical host health summary">
            <SummaryCard label="Healthy" count={summary.healthy} status="healthy" description="Provider-supplied healthy hosts" />
            <SummaryCard label="Warning" count={summary.warning} status="warning" description="Provider-supplied warning hosts" />
            <SummaryCard label="Critical" count={summary.critical} status="critical" description="Provider-supplied critical hosts" />
            <SummaryCard label="Stale / unknown" count={unavailable && knownHosts.length === 0 ? '—' : summary.staleUnknown} status="unknown" description="Never treated as healthy" />
          </section>

          <section className="grid three" aria-label="Exactly three canonical production hosts">
            {hosts.map((host, index) => <HostCard key={CANONICAL_HOSTS[index].resourceId} host={host} expectedId={CANONICAL_HOSTS[index].name} />)}
          </section>
        </>
      ) : null}

      <div className="card">
        <div className="card-header">
          <div><div className="card-title">Alerting and stale evidence</div><div className="card-description">Read-only provider inventory. Alert mutation and historical cleanup remain outside this Console view.</div></div>
          <StatusBadge status={telemetry.data?.alerting.status ?? 'unknown'} label={telemetry.data?.alerting.status ?? 'unknown'} />
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}><table><tbody>
          <tr><td>Canonical policy</td><td className="meta">{telemetry.data?.alerting.canonicalPolicy ?? 'Unavailable'}</td><td className="meta">{telemetry.data?.alerting.policyCount ?? 'Unavailable'} policies · {telemetry.data?.alerting.conditionCount ?? 'Unavailable'} conditions</td></tr>
          <tr><td>Thresholds</td><td className="meta">CPU {telemetry.data?.alerting.thresholds.cpuPercent ?? 'Unavailable'}% · memory {telemetry.data?.alerting.thresholds.memoryPercent ?? 'Unavailable'}% · disk {telemetry.data?.alerting.thresholds.diskUsedPercent ?? 'Unavailable'}%</td><td className="meta">stale after {telemetry.data?.alerting.thresholds.telemetryStaleSeconds ?? 'Unavailable'}s</td></tr>
          <tr><td>Historical entities</td><td className="meta">{telemetry.data?.staleEntities.length ?? 'Unavailable'}</td><td className="meta">retained as evidence; not displayed as canonical hosts</td></tr>
          <tr><td>Last response</td><td className="meta">{telemetry.data?.generatedAt ? formatTimestamp(telemetry.data.generatedAt) : 'Unavailable'}</td><td className="meta">schema {telemetry.data?.schemaVersion ?? 'Unavailable'}</td></tr>
        </tbody></table></div>
      </div>
    </section>
  );
}
