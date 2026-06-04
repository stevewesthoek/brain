'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LoaderCircle, Play, RefreshCw, Square } from 'lucide-react';
import { brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import {
  localAppsActionReadinessSchema,
  localAppsActionResultSchema,
  localAppsActionStatusSchema,
  localAppsDashboardSchema,
  type LocalApp,
} from '@/lib/braincore-schemas';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

type LocalAppsTab = 'apps' | 'actions' | 'policy';
type LocalActionName = 'start' | 'stop' | 'restart';
type InFlightLocalAction = { appId?: unknown; action?: unknown; startedAt?: unknown };

const APPS_PER_PAGE = 4;
const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  starting: 1,
  healthy: 2,
  stopped: 3,
  blocked: 4,
  unknown: 5,
  unavailable: 6,
};

function localUrl(app: LocalApp): string | null {
  if (typeof app.port === 'number') return `http://localhost:${app.port}`;
  if (app.url?.startsWith('http')) return app.url;
  return null;
}

function portSummary(app: LocalApp): string {
  const ports = [typeof app.port === 'number' ? app.port : null, ...(app.servicePorts ?? [])]
    .filter((port): port is number => typeof port === 'number' && Number.isFinite(port));
  return Array.from(new Set(ports)).join(', ') || '—';
}

function infrastructureSummary(app: LocalApp): string {
  const parts = [
    typeof app.databasePort === 'number' ? `db:${app.databasePort}` : null,
    app.containerName ? `ctr:${app.containerName}${app.containerStatus ? `/${app.containerStatus}` : ''}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' · ') || 'none';
}

function disabledReason(app: LocalApp): string {
  if (app.actionDisabledReason) return app.actionDisabledReason;
  const reasons = app.actionDisabledReasons;
  if (Array.isArray(reasons)) return reasons.join('; ') || 'Action is not enabled by Brain Core.';
  if (reasons && typeof reasons === 'object') return Object.values(reasons).filter(Boolean).join('; ') || 'Action is not enabled by Brain Core.';
  return 'Action is not enabled by Brain Core.';
}

function actionSupported(app: LocalApp, action: 'start' | 'stop' | 'restart'): boolean {
  if (action === 'start') return Boolean(app.startSupported || app.restartSupported);
  if (action === 'stop') return Boolean(app.stopSupported);
  return Boolean(app.restartSupported || app.startSupported);
}

function readInFlightActions(payload: unknown): InFlightLocalAction[] {
  if (!payload || typeof payload !== 'object') return [];
  const value = (payload as { inFlight?: unknown }).inFlight;
  return Array.isArray(value) ? value as InFlightLocalAction[] : [];
}

function activeActionForApp(app: LocalApp, localPending?: { app: LocalApp; actionName: LocalActionName }, inFlight: InFlightLocalAction[] = []): LocalActionName | string | null {
  if (localPending?.app.id === app.id) return localPending.actionName;
  const remote = inFlight.find((entry) => entry.appId === app.id);
  return typeof remote?.action === 'string' ? remote.action : null;
}

function dedupeAppsById(apps: LocalApp[]): LocalApp[] {
  const seen = new Map<string, LocalApp>();
  for (const app of apps) {
    const existing = seen.get(app.id);
    if (!existing) {
      seen.set(app.id, app);
      continue;
    }
    const existingScore = existing.status === 'running' ? 2 : existing.port ? 1 : 0;
    const nextScore = app.status === 'running' ? 2 : app.port ? 1 : 0;
    if (nextScore > existingScore) seen.set(app.id, app);
  }
  return Array.from(seen.values());
}

function uniqueApps(apps: LocalApp[]): LocalApp[] {
  const seen = new Set<string>();
  return apps.filter((app) => {
    if (seen.has(app.id)) return false;
    seen.add(app.id);
    return true;
  });
}

function sortApps(apps: LocalApp[]): LocalApp[] {
  return uniqueApps(apps).sort((a, b) => {
    const statusA = STATUS_PRIORITY[String(a.status ?? 'unknown')] ?? 50;
    const statusB = STATUS_PRIORITY[String(b.status ?? 'unknown')] ?? 50;
    if (statusA !== statusB) return statusA - statusB;
    const portA = typeof a.port === 'number' ? a.port : 99_999;
    const portB = typeof b.port === 'number' ? b.port : 99_999;
    if (portA !== portB) return portA - portB;
    return (a.label ?? a.name).localeCompare(b.label ?? b.name);
  });
}

function AppCard({ app, pending, activeAction, onAction }: { app: LocalApp; pending: boolean; activeAction: LocalActionName | string | null; onAction: (app: LocalApp, actionName: LocalActionName) => void }) {
  const url = localUrl(app);
  const startOrRestart: LocalActionName = app.restartSupported ? 'restart' : 'start';
  const reason = disabledReason(app);
  const servicePorts = portSummary(app);
  const infrastructure = infrastructureSummary(app);
  const busy = Boolean(activeAction);
  const visibleStatus = busy ? 'starting' : app.status;
  const statusLabel = busy ? `${activeAction}…` : undefined;

  return (
    <article className="app-card">
      <div className="app-card-top">
        <div className="min-w-0">
          <div className="app-name">{app.label ?? app.name}</div>
          <div className="app-id">{app.id}</div>
        </div>
        <StatusBadge status={visibleStatus} label={statusLabel} />
      </div>

      <div className="app-meta-grid">
        <div>
          <span>Ports</span>
          <strong>{servicePorts}</strong>
        </div>
        <div>
          <span>Infra</span>
          <strong title={infrastructure}>{infrastructure}</strong>
        </div>
        <div>
          <span>Health</span>
          <strong>{app.health ?? 'unknown'}</strong>
        </div>
      </div>

      <div className="app-notes">{app.notes || app.category || 'No description available.'}</div>

      <div className="app-actions">
        <button className="button compact secondary" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
          <ExternalLink size={14} /> Open
        </button>
        <button
          className="button compact"
          disabled={!actionSupported(app, startOrRestart) || pending}
          title={actionSupported(app, startOrRestart) ? `${startOrRestart} ${app.name}` : reason}
          onClick={() => onAction(app, startOrRestart)}
        >
          {busy && activeAction === startOrRestart ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />} {busy && activeAction === startOrRestart ? 'Working' : startOrRestart === 'restart' ? 'Restart' : 'Start'}
        </button>
        <button
          className="button compact destructive"
          disabled={!actionSupported(app, 'stop') || pending}
          title={actionSupported(app, 'stop') ? `Stop ${app.name}` : reason}
          onClick={() => onAction(app, 'stop')}
        >
          {busy && activeAction === 'stop' ? <LoaderCircle size={14} className="spin" /> : <Square size={14} />} {busy && activeAction === 'stop' ? 'Stopping' : 'Stop'}
        </button>
      </div>
    </article>
  );
}

export function LocalAppsDashboard() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<LocalAppsTab>('apps');
  const [page, setPage] = useState(1);

  const dashboard = useQuery({
    queryKey: ['local-apps-dashboard'],
    queryFn: () => brainCoreRequest('/local-apps/dashboard', localAppsDashboardSchema),
    refetchInterval: 5_000,
  });
  const readiness = useQuery({
    queryKey: ['local-apps-action-readiness'],
    queryFn: () => brainCoreRequest('/local-apps/action-readiness', localAppsActionReadinessSchema),
    refetchInterval: 10_000,
  });
  const actionStatus = useQuery({
    queryKey: ['local-apps-actions-status'],
    queryFn: () => brainCoreRequest('/local-apps/actions/status', localAppsActionStatusSchema),
    refetchInterval: 5_000,
  });

  const action = useMutation({
    mutationFn: ({ app, actionName }: { app: LocalApp; actionName: 'start' | 'stop' | 'restart' }) => postBrainCoreAction(`/local-apps/${encodeURIComponent(app.id)}/${actionName}`, localAppsActionResultSchema),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['local-apps-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['local-apps-actions-status'] }),
      ]);
    },
  });

  const apps = useMemo(() => sortApps(dedupeAppsById(dashboard.data?.apps ?? [])), [dashboard.data?.apps]);
  const inFlightActions = useMemo(() => readInFlightActions(actionStatus.data), [actionStatus.data]);
  const localPending = action.isPending ? action.variables : undefined;
  const pageCount = Math.max(1, Math.ceil(apps.length / APPS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visibleApps = apps.slice((safePage - 1) * APPS_PER_PAGE, safePage * APPS_PER_PAGE);
  const pageItems = Array.from({ length: pageCount }, (_, index) => index + 1);

  const runAction = (app: LocalApp, actionName: 'start' | 'stop' | 'restart') => action.mutate({ app, actionName });

  return (
    <div className="screen-panel local-apps-screen">
      <section className="compact-heading">
        <div>
          <div className="eyebrow">Local Applications</div>
          <h1>Apps</h1>
          <p>Prioritized by running status. Brain Core handles lifecycle safety, ports, databases, and stale-instance checks.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={dashboard.data?.status ?? (dashboard.isError ? 'error' : 'fresh')} />
          <button className="button compact secondary" onClick={() => void dashboard.refetch()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </section>

      <div className="tabs">
        <button className={tab === 'apps' ? 'active' : ''} onClick={() => setTab('apps')}>Apps</button>
        <button className={tab === 'actions' ? 'active' : ''} onClick={() => setTab('actions')}>Actions</button>
        <button className={tab === 'policy' ? 'active' : ''} onClick={() => setTab('policy')}>Policy</button>
      </div>

      {tab === 'apps' ? (
        <section className="tab-panel">
          <div className="local-summary-strip">
            <div><span>Total</span><strong>{apps.length}</strong></div>
            <div><span>Running</span><strong>{dashboard.data?.runningCount ?? 0}</strong></div>
            <div><span>Stopped</span><strong>{dashboard.data?.stoppedCount ?? 0}</strong></div>
            <div><span>Unknown</span><strong>{dashboard.data?.unknownCount ?? 0}</strong></div>
            <div><span>Managed</span><strong>{dashboard.data?.managedCount ?? 0}</strong></div>
          </div>

          {dashboard.isError ? (
            <div className="compact-error"><strong>Local Apps failed to load.</strong> Check Brain Core and the local-apps registry.</div>
          ) : null}

          <div className="app-grid">
            {visibleApps.map((app, index) => {
              const activeAction = activeActionForApp(app, localPending, inFlightActions);
              return (
                <AppCard
                  key={`${safePage}-${index}-${app.id}-${app.port ?? 'no-port'}-${app.label ?? app.name}`}
                  app={app}
                  pending={Boolean(activeAction)}
                  activeAction={activeAction}
                  onAction={runAction}
                />
              );
            })}
            {dashboard.isLoading ? <div className="compact-error">Loading local applications…</div> : null}
            {!dashboard.isLoading && apps.length === 0 ? <div className="compact-error">No local applications returned by Brain Core.</div> : null}
          </div>

          <div className="pager local-apps-pager">
            <span>{apps.length === 0 ? '0 apps' : `Page ${safePage}/${pageCount} · showing ${(safePage - 1) * APPS_PER_PAGE + 1}-${Math.min(safePage * APPS_PER_PAGE, apps.length)} of ${apps.length}`}</span>
            <div className="row page-controls">
              <button className="button compact secondary" disabled={safePage <= 1} onClick={() => setPage(1)}>First</button>
              <button className="button compact secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</button>
              {pageItems.map((item) => (
                <button key={item} className={`page-dot ${item === safePage ? 'active' : ''}`} onClick={() => setPage(item)} aria-label={`Go to Local Apps page ${item}`}>{item}</button>
              ))}
              <button className="button compact secondary" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
              <button className="button compact secondary" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'actions' ? (
        <section className="tab-panel split-panels">
          {action.error ? <div className="compact-error"><strong>Action failed.</strong> {action.error instanceof Error ? action.error.message : String(action.error)}</div> : null}
          <article className="mini-panel">
            <div className="card-title">Action readiness</div>
            <pre className="meta compact-pre">{JSON.stringify(readiness.data ?? {}, null, 2).slice(0, 3200)}</pre>
          </article>
          <article className="mini-panel">
            <div className="card-title">Recent action status</div>
            <pre className="meta compact-pre">{JSON.stringify(actionStatus.data ?? {}, null, 2).slice(0, 3200)}</pre>
          </article>
        </section>
      ) : null}

      {tab === 'policy' ? (
        <section className="tab-panel split-panels">
          <article className="mini-panel">
            <div className="card-title">Lifecycle guarantees</div>
            <ul className="compact-list">
              <li>Actions are per-app locked in Brain Core.</li>
              <li>Start checks whether the app is already healthy before launching.</li>
              <li>Start runs database/container phase before app service phase where modeled.</li>
              <li>Stop verifies the app port is closed before database/container shutdown is considered complete.</li>
              <li>Restart is a Brain Core composite stop/start sequence.</li>
              <li>Unsupported apps return structured disabled/not-executable results.</li>
            </ul>
          </article>
          <article className="mini-panel">
            <div className="card-title">Action policy</div>
            <pre className="meta compact-pre">{JSON.stringify(dashboard.data?.actionPolicy ?? {}, null, 2)}</pre>
          </article>
        </section>
      ) : null}
    </div>
  );
}
