'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { brainCoreRequest } from '@/lib/braincore-client';
import { canonicalInfrastructureTelemetrySchema, type CanonicalInfrastructureTelemetry } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';
import { formatDuration, formatPercent, timeAgo } from '@/lib/utils';

function bytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not instrumented';
  if (value < 1024 ** 2) return `${Math.round(value / 1024)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}

function hostTone(host: CanonicalInfrastructureTelemetry['hosts'][number]): string {
  return host.state;
}

function HostCard({ host }: { host: CanonicalInfrastructureTelemetry['hosts'][number] }) {
  const maxDisk = Math.max(...host.metrics.storage.map((item) => item.usedPercent ?? 0), 0);
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{host.name}</div>
          <div className="meta">{host.resourceId} · {host.entity.name ?? 'No entity'}</div>
        </div>
        <StatusBadge status={hostTone(host)} label={host.state} />
      </div>
      <p className="card-description" style={{ marginTop: 10 }}>{host.stateReason}</p>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <tbody>
            <tr><td>Telemetry</td><td><StatusBadge status={host.telemetry.freshness} label={host.telemetry.freshness} /></td><td className="meta">{host.telemetry.lastSeenAt ? timeAgo(host.telemetry.lastSeenAt) : 'unknown'}</td></tr>
            <tr><td>Agent</td><td className="meta">{host.telemetry.agentVersion ?? 'Not instrumented'}</td><td className="meta">{host.entity.guid ? 'GUID mapped' : 'No GUID'}</td></tr>
            <tr><td>CPU / load</td><td className="meta">{formatPercent(host.metrics.cpuPercent)}</td><td className="meta">{host.metrics.loadAverageOneMinute ?? '—'}</td></tr>
            <tr><td>Memory</td><td className="meta">{formatPercent(host.metrics.memoryUsedPercent)}</td><td className="meta">{bytes(host.metrics.memoryAvailableBytes)} available</td></tr>
            <tr><td>Storage</td><td className="meta">{maxDisk ? formatPercent(maxDisk) : 'Not instrumented'}</td><td className="meta">{host.metrics.storage.length} mounts</td></tr>
            <tr><td>Runtime</td><td className="meta">{host.runtime.runningContainers === null ? 'Not reported' : `${host.runtime.runningContainers} running`} · systemd {host.runtime.systemd}</td><td className="meta">{host.runtime.nonRunningContainers === null ? 'non-running unknown' : `${host.runtime.nonRunningContainers} non-running`} · {formatDuration(host.metrics.uptimeSeconds)} uptime</td></tr>
            <tr><td>Backup</td><td><StatusBadge status={host.backup.state} label={host.backup.state} /></td><td className="meta">{host.backup.reason}</td></tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function CanonicalInfrastructureTelemetry() {
  const telemetry = useQuery({
    queryKey: ['canonical-infrastructure-telemetry'],
    queryFn: () => brainCoreRequest('/infra/telemetry', canonicalInfrastructureTelemetrySchema, { timeoutMs: 15_000 }),
    refetchInterval: 15_000,
  });
  const hosts = telemetry.data?.hosts ?? [];

  return (
    <section className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Production infrastructure</div>
          <h2>Canonical host telemetry</h2>
          <p>Exactly three production hosts, mapped by canonical identity. Missing, stale, and uninstrumented signals never render as healthy.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={telemetry.isError ? 'error' : telemetry.data?.status === 'ok' ? 'fresh' : 'unknown'} label={telemetry.isError ? 'Unavailable' : telemetry.data?.status === 'ok' ? 'New Relic EU' : 'Unknown'} />
          <span className="meta">15s cache / refresh</span>
          <button className="button compact secondary" onClick={() => void telemetry.refetch()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </section>
      {telemetry.isError ? <div className="compact-error"><strong>Canonical telemetry unavailable.</strong> Brain Core could not read `/infra/telemetry`; no host is marked healthy.</div> : null}
      <div className="grid three">
        {hosts.map((host) => <HostCard key={host.resourceId} host={host} />)}
      </div>
      <div className="card">
        <div className="card-header"><div><div className="card-title">Alerting and stale evidence</div><div className="card-description">Current inventory is separated from historical entities; alert mutation remains an explicit operational step.</div></div><StatusBadge status={telemetry.data?.alerting.status ?? 'unknown'} label={telemetry.data?.alerting.status ?? 'unknown'} /></div>
        <div className="table-wrap" style={{ marginTop: 12 }}><table><tbody>
          <tr><td>Policies / conditions</td><td className="meta">{telemetry.data?.alerting.policyCount ?? 'unknown'} / {telemetry.data?.alerting.conditionCount ?? 'unknown'}</td><td className="meta">{telemetry.data?.alerting.canonicalPolicy ?? 'unknown'}</td></tr>
          <tr><td>Thresholds</td><td className="meta">CPU {telemetry.data?.alerting.thresholds.cpuPercent ?? '—'}% · memory {telemetry.data?.alerting.thresholds.memoryPercent ?? '—'}% · disk {telemetry.data?.alerting.thresholds.diskUsedPercent ?? '—'}%</td><td className="meta">stale after {telemetry.data?.alerting.thresholds.telemetryStaleSeconds ?? '—'}s</td></tr>
          <tr><td>Unmapped entities</td><td className="meta">{telemetry.data?.staleEntities.length ?? '—'}</td><td className="meta">retained as historical evidence</td></tr>
        </tbody></table></div>
      </div>
    </section>
  );
}
