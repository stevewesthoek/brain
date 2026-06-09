'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import {
  infraNewRelicStatusSchema,
  type InfraNewRelicHost,
  type InfraNewRelicSynthetic,
} from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';
import { timeAgo } from '@/lib/utils';

const HOST_PRIORITY: Record<string, number> = { true: 0, false: 1, null: 2 };

function toneForState(online: boolean | null): 'fresh' | 'warning' | 'error' {
  if (online === true) return 'fresh';
  if (online === false) return 'error';
  return 'warning';
}

function liveLabel(online: boolean | null): string {
  if (online === true) return 'Up';
  if (online === false) return 'Down';
  return 'Unknown';
}

function reportingLabel(reporting: boolean): string {
  return reporting ? 'Reporting' : 'Muted';
}

function sortHosts(items: InfraNewRelicHost[]): InfraNewRelicHost[] {
  return [...items].sort((left, right) => {
    const priority = HOST_PRIORITY[String(right.online) as keyof typeof HOST_PRIORITY] - HOST_PRIORITY[String(left.online) as keyof typeof HOST_PRIORITY];
    if (priority !== 0) return priority;
    return left.name.localeCompare(right.name);
  });
}

function sortSynthetics(items: InfraNewRelicSynthetic[]): InfraNewRelicSynthetic[] {
  return [...items].sort((left, right) => {
    const priority = HOST_PRIORITY[String(right.online) as keyof typeof HOST_PRIORITY] - HOST_PRIORITY[String(left.online) as keyof typeof HOST_PRIORITY];
    if (priority !== 0) return priority;
    return left.name.localeCompare(right.name);
  });
}

function ServerRow({ host }: { host: InfraNewRelicHost }) {
  return (
    <tr>
      <td>
        <div className="card-title">{host.name}</div>
        <div className="meta">Server</div>
      </td>
      <td>
        <StatusBadge status={toneForState(host.online)} label={liveLabel(host.online)} />
      </td>
      <td>
        <StatusBadge status={host.reporting ? 'fresh' : 'warning'} label={reportingLabel(host.reporting)} />
      </td>
      <td className="meta">{host.alertSeverity ?? 'none'}</td>
      <td className="meta">{host.lastSeenAt ? timeAgo(host.lastSeenAt) : 'unknown'}</td>
    </tr>
  );
}

function WebsiteRow({ synthetic }: { synthetic: InfraNewRelicSynthetic }) {
  return (
    <tr>
      <td>
        <div className="card-title">{synthetic.name}</div>
        <div className="meta">Website uptime check</div>
      </td>
      <td>
        <StatusBadge status={toneForState(synthetic.online)} label={liveLabel(synthetic.online)} />
      </td>
      <td>
        <StatusBadge status={synthetic.reporting ? 'fresh' : 'warning'} label={reportingLabel(synthetic.reporting)} />
      </td>
      <td className="meta">{synthetic.alertSeverity ?? 'none'}</td>
      <td className="meta">{synthetic.lastCheckAt ? timeAgo(synthetic.lastCheckAt) : 'unknown'}</td>
    </tr>
  );
}

export function MonitoringDashboard() {
  const monitoring = useQuery({
    queryKey: ['infra-new-relic'],
    queryFn: () => brainCoreRequest('/infra/monitoring', infraNewRelicStatusSchema, { timeoutMs: 12_000 }),
    refetchInterval: 15_000,
  });

  const hosts = useMemo(() => sortHosts(monitoring.data?.hosts ?? []), [monitoring.data?.hosts]);
  const synthetics = useMemo(() => sortSynthetics(monitoring.data?.synthetics ?? []), [monitoring.data?.synthetics]);
  const liveHosts = hosts.filter((host) => host.online === true).length;
  const downHosts = hosts.filter((host) => host.online === false).length;
  const liveSites = synthetics.filter((item) => item.online === true).length;
  const downSites = synthetics.filter((item) => item.online === false).length;

  const overallStatus = monitoring.data?.status ?? (monitoring.isError ? 'error' : 'not-configured');
  const overallLabel = overallStatus === 'ok' ? 'Connected' : overallStatus === 'not-configured' ? 'Credentials missing' : 'Offline';
  const overallTone: 'fresh' | 'warning' | 'error' = overallStatus === 'ok' ? 'fresh' : overallStatus === 'not-configured' ? 'warning' : 'error';

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Infrastructure</div>
          <h1>New Relic</h1>
          <p>Brain Core reads website and server uptime from New Relic. The console shows live, down, and unknown state for hosts and synthetic checks without exposing admin controls.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={overallTone} label={overallLabel} />
          <span className="meta">Refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void monitoring.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {monitoring.isError ? (
        <div className="compact-error">
          <strong>New Relic data failed to load.</strong> Brain Core could not read `/infra/monitoring`.
        </div>
      ) : null}

      {monitoring.data?.status === 'not-configured' ? (
        <div className="compact-error">
          <strong>New Relic credentials are not configured.</strong> Set <code>NEW_RELIC_USER_API_KEY</code> and <code>NEW_RELIC_ACCOUNT_ID</code>, or create <code>~/.config/newrelic/.env</code>.
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Servers</div>
          <div className="metric">{hosts.length}</div>
          <div className="meta">{liveHosts} up, {downHosts} down</div>
        </article>
        <article className="card">
          <div className="card-title">Websites</div>
          <div className="metric">{synthetics.length}</div>
          <div className="meta">{liveSites} up, {downSites} down</div>
        </article>
        <article className="card">
          <div className="card-title">Reporting</div>
          <div className="metric">{hosts.filter((item) => item.reporting).length + synthetics.filter((item) => item.reporting).length}</div>
          <div className="meta">Entities currently reporting to New Relic</div>
        </article>
        <article className="card">
          <div className="card-title">Source</div>
          <div className="metric">GET</div>
          <div className="meta">Read-only status from `/infra/monitoring`</div>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Servers</div>
              <div className="card-description">Infrastructure host uptime and reporting state.</div>
            </div>
            <StatusBadge status={overallTone} label="Hosts" />
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Server</th>
                  <th>State</th>
                  <th>Reporting</th>
                  <th>Alert</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((host) => <ServerRow key={host.name} host={host} />)}
                {hosts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="meta">No New Relic host data was returned by Brain Core.</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Websites</div>
              <div className="card-description">Synthetic uptime checks and latest results.</div>
            </div>
            <StatusBadge status={overallTone} label="Synthetics" />
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Website</th>
                  <th>State</th>
                  <th>Reporting</th>
                  <th>Alert</th>
                  <th>Last check</th>
                </tr>
              </thead>
              <tbody>
                {synthetics.map((synthetic) => <WebsiteRow key={synthetic.name} synthetic={synthetic} />)}
                {synthetics.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="meta">No New Relic synthetic data was returned by Brain Core.</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
