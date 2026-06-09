'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { infraDokployStatusSchema, type InfraDokployApp, type InfraDokployCompose } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';

const DOKPLOY_UI_URL = 'https://dokploy.prochat.tools';
const LIVE_STATUSES = new Set(['running', 'healthy', 'online', 'up', 'ready', 'available', 'deployed', 'active', 'ok', 'success', 'live', 'done']);
const TRANSITIONAL_STATUSES = new Set(['starting', 'pending', 'initializing', 'restarting', 'deploying', 'idle']);

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.has(normalizeStatus(status));
}

function statusTone(status: string): 'fresh' | 'warning' | 'error' {
  const normalized = normalizeStatus(status);
  if (LIVE_STATUSES.has(normalized)) return 'fresh';
  if (TRANSITIONAL_STATUSES.has(normalized) || normalized === 'unknown') return 'warning';
  return 'error';
}

function sortByProject<T extends { project: string; environment: string; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const project = a.project.localeCompare(b.project);
    if (project !== 0) return project;
    const environment = a.environment.localeCompare(b.environment);
    if (environment !== 0) return environment;
    return a.name.localeCompare(b.name);
  });
}

function countStatuses(entries: Record<string, number> | undefined): Array<[string, number]> {
  return Object.entries(entries ?? {}).sort((left, right) => {
    const count = right[1] - left[1];
    if (count !== 0) return count;
    return left[0].localeCompare(right[0]);
  });
}

function AppStatusRow({ app }: { app: InfraDokployApp }) {
  const live = isLiveStatus(app.status);
  const tone = statusTone(app.status);

  return (
    <tr>
      <td>
        <div className="card-title">{app.name}</div>
        <div className="meta">{app.project}</div>
      </td>
      <td>{app.environment}</td>
      <td>
        <StatusBadge status={tone} label={live ? 'Live' : 'Not live'} />
      </td>
      <td className="meta">{app.status}</td>
    </tr>
  );
}

function ComposeStatusRow({ compose }: { compose: InfraDokployCompose }) {
  const live = isLiveStatus(compose.status);
  const tone = statusTone(compose.status);

  return (
    <tr>
      <td>
        <div className="card-title">{compose.name}</div>
        <div className="meta">{compose.project}</div>
      </td>
      <td>{compose.environment}</td>
      <td>
        <StatusBadge status={tone} label={live ? 'Live' : 'Not live'} />
      </td>
      <td className="meta">{compose.status}</td>
    </tr>
  );
}

function StatusCountRow({ status, count }: { status: string; count: number }) {
  return (
    <div className="split" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--muted)' }}>
      <span className="meta" style={{ textTransform: 'capitalize' }}>{status}</span>
      <strong>{count}</strong>
    </div>
  );
}

export function DokployDashboard() {
  const dokploy = useQuery({
    queryKey: ['infra-dokploy'],
    queryFn: () => brainCoreRequest('/infra/dokploy', infraDokployStatusSchema, { timeoutMs: 12_000 }),
    refetchInterval: 15_000,
  });

  const apps = useMemo(() => sortByProject(dokploy.data?.apps ?? []), [dokploy.data?.apps]);
  const compose = useMemo(() => sortByProject(dokploy.data?.compose ?? []), [dokploy.data?.compose]);
  const liveApps = apps.filter((app) => isLiveStatus(app.status));
  const liveCompose = compose.filter((item) => isLiveStatus(item.status));
  const appStatusCounts = useMemo(() => countStatuses(dokploy.data?.appsByStatus), [dokploy.data?.appsByStatus]);
  const composeStatusCounts = useMemo(() => countStatuses(dokploy.data?.composeByStatus), [dokploy.data?.composeByStatus]);
  const projectCount = useMemo(() => {
    const projects = new Set<string>();
    for (const app of apps) projects.add(app.project);
    for (const item of compose) projects.add(item.project);
    return projects.size;
  }, [apps, compose]);

  const overallStatus = dokploy.data?.status ?? (dokploy.isError ? 'error' : 'not-configured');
  const overallLabel = overallStatus === 'ok' ? 'Connected' : overallStatus === 'not-configured' ? 'Credentials missing' : 'Offline';
  const overallTone: 'fresh' | 'warning' | 'error' = overallStatus === 'ok' ? 'fresh' : overallStatus === 'not-configured' ? 'warning' : 'error';

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Infrastructure</div>
          <h1>Dokploy</h1>
          <p>Brain Core reads Dokploy applications and compose services. The console shows whether each item is live or not live without exposing credentials or shell control.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={overallTone} label={overallLabel} />
          <span className="meta">Refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void dokploy.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
          <a className="button compact secondary" href={DOKPLOY_UI_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Open Dokploy
          </a>
        </div>
      </section>

      {dokploy.isError ? (
        <div className="compact-error">
          <strong>Dokploy data failed to load.</strong> Brain Core could not read `/infra/dokploy`.
        </div>
      ) : null}

      {dokploy.data?.status === 'not-configured' ? (
        <div className="compact-error">
          <strong>Dokploy credentials are not configured.</strong> Create <code>~/.config/dokploy/.env</code> with <code>DOKPLOY_URL</code> and <code>DOKPLOY_API_KEY</code>.
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Applications</div>
          <div className="metric">{apps.length}</div>
          <div className="meta">{liveApps.length} live, {Math.max(0, apps.length - liveApps.length)} not live</div>
        </article>
        <article className="card">
          <div className="card-title">Compose services</div>
          <div className="metric">{compose.length}</div>
          <div className="meta">{liveCompose.length} live, {Math.max(0, compose.length - liveCompose.length)} not live</div>
        </article>
        <article className="card">
          <div className="card-title">Projects</div>
          <div className="metric">{projectCount}</div>
          <div className="meta">Grouped by Dokploy project and environment</div>
        </article>
        <article className="card">
          <div className="card-title">Brain Core source</div>
          <div className="metric">GET</div>
          <div className="meta">Read-only status surfaced through `/infra/dokploy`</div>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Application status breakdown</div>
              <div className="card-description">Counts from Brain Core by raw Dokploy status.</div>
            </div>
            <StatusBadge status={overallTone} label="Apps" />
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 14 }}>
            {appStatusCounts.map(([status, count]) => <StatusCountRow key={status} status={status} count={count} />)}
            {appStatusCounts.length === 0 ? <p className="meta">No app status data yet.</p> : null}
          </div>
        </article>
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Compose status breakdown</div>
              <div className="card-description">Counts from Brain Core by raw Dokploy status.</div>
            </div>
            <StatusBadge status={overallTone} label="Compose" />
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 14 }}>
            {composeStatusCounts.map(([status, count]) => <StatusCountRow key={status} status={status} count={count} />)}
            {composeStatusCounts.length === 0 ? <p className="meta">No compose status data yet.</p> : null}
          </div>
        </article>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Environment</th>
              <th>Live</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => <AppStatusRow key={`${app.project}:${app.environment}:${app.name}`} app={app} />)}
            {apps.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="meta">No Dokploy applications were returned by Brain Core.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Compose service</th>
              <th>Environment</th>
              <th>Live</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {compose.map((item) => <ComposeStatusRow key={`${item.project}:${item.environment}:${item.name}`} compose={item} />)}
            {compose.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="meta">No Dokploy compose services were returned by Brain Core.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
