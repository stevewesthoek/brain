'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getOperationalSnapshot } from '@/lib/braincore-client';
import type { OperationalSnapshot, OperationalState } from '@/lib/braincore-schemas';
import { FreshnessLabel } from '@/components/freshness-label';
import { OperationalStateBadge } from '@/components/operational-state';

const REFRESH_INTERVAL_MS = 10_000;

function displayState(state: OperationalState): string {
  return state.toLowerCase();
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function Revision({ value }: { value: string | null }) {
  return <code>{value ? value.slice(0, 12) : 'unknown'}</code>;
}

function SectionHeading({ eyebrow, title, titleId, state }: { eyebrow: string; title: string; titleId: string; state: OperationalState }) {
  return (
    <div className="split command-center-section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 id={titleId}>{title}</h2>
      </div>
      <OperationalStateBadge state={state} />
    </div>
  );
}

function KpiCard({ label, value, detail, state }: { label: string; value: string; detail: string; state: OperationalState }) {
  return (
    <article className="card command-center-kpi">
      <div className="split">
        <div className="card-title">{label}</div>
        <OperationalStateBadge state={state} />
      </div>
      <div className="metric">{value}</div>
      <div className="meta">{detail}</div>
    </article>
  );
}

function AttentionPanel({ snapshot }: { snapshot: OperationalSnapshot }) {
  const items = snapshot.sections.attention.data.items;
  return (
    <section className="card command-center-panel" aria-labelledby="command-center-attention">
      <SectionHeading eyebrow="Needs attention" title="Attention" titleId="command-center-attention" state={snapshot.sections.attention.state} />
      {items.length === 0 ? (
        <div className="command-center-empty">
          <OperationalStateBadge state="CURRENT" />
          <p>No actionable exceptions are currently reported.</p>
        </div>
      ) : (
        <div className="command-center-list">
          {items.map((item) => (
            <article className="command-center-list-item command-center-attention-item" key={item.id}>
              <div className="split command-center-item-header">
                <div className="row">
                  <OperationalStateBadge state={item.state} />
                  <strong>{item.title}</strong>
                </div>
                <FreshnessLabel freshness={item.freshness} updatedAt={item.observedAt} />
              </div>
              <p>{item.explanation}</p>
              <div className="split command-center-item-footer">
                <span className="meta">{item.source}{item.entityRef ? ` · ${item.entityRef}` : ''}</span>
                {item.safeNextAction ? <span className="meta">Next: {item.safeNextAction}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActiveWorkPanel({ snapshot }: { snapshot: OperationalSnapshot }) {
  const items = snapshot.sections.activeWork.data.items;
  return (
    <section className="card command-center-panel" aria-labelledby="command-center-active-work">
      <SectionHeading eyebrow="In progress" title="Active now" titleId="command-center-active-work" state={snapshot.sections.activeWork.state} />
      {items.length === 0 ? (
        <div className="command-center-empty">
          <OperationalStateBadge state="CURRENT" />
          <p>No active work is reported. Brain is idle for the instrumented work sources.</p>
        </div>
      ) : (
        <div className="command-center-list">
          {items.map((item) => (
            <article className="command-center-list-item" key={item.id}>
              <div className="split command-center-item-header">
                <div className="row"><OperationalStateBadge state={item.state} /><strong>{item.domain}</strong></div>
                <span className="meta">{item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleTimeString()}` : 'Update unknown'}</span>
              </div>
              <p>{item.nextAction}</p>
              <div className="command-center-work-meta">
                <span>{item.currentStage}</span>
                <span>owner: {item.primaryOwner}</span>
                <span>route: {item.capabilityRoute}</span>
                <span>progress: {item.progress === null ? 'unknown' : `${Math.round(item.progress * 100)}%`}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityPanel({ snapshot }: { snapshot: OperationalSnapshot }) {
  const items = snapshot.sections.activity.data.items;
  return (
    <section className="card command-center-panel" aria-labelledby="command-center-activity">
      <SectionHeading eyebrow="What happened" title="Recent activity" titleId="command-center-activity" state={snapshot.sections.activity.state} />
      {items.length === 0 ? (
        <div className="command-center-empty"><p>No recent activity is available from the current event source.</p></div>
      ) : (
        <div className="command-center-list">
          {items.map((item) => (
            <article className="command-center-list-item command-center-activity-item" key={item.id}>
              <div className="split command-center-item-header">
                <div className="row"><OperationalStateBadge state={item.severity === 'critical' ? 'ERROR' : item.severity === 'warning' ? 'DEGRADED' : 'CURRENT'} /><strong>{item.eventType}</strong></div>
                <time className="meta" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
              </div>
              <p>{item.summary}</p>
              <span className="meta">{item.domain} · {item.status}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PostureRow({ label, state, detail }: { label: string; state: OperationalState; detail: string }) {
  return (
    <div className="command-center-posture-row">
      <div className="row"><OperationalStateBadge state={state} /><strong>{label}</strong></div>
      <span className="meta">{detail}</span>
    </div>
  );
}

function PosturePanel({ snapshot }: { snapshot: OperationalSnapshot }) {
  const { brain, computer, scheduler, index, consumers, identity } = snapshot.sections;
  return (
    <section className="card command-center-panel" aria-labelledby="command-center-posture">
      <SectionHeading eyebrow="System map" title="Domain posture" titleId="command-center-posture" state={snapshot.overall.state} />
      <div className="command-center-posture">
        <PostureRow label="Brain" state={brain.state} detail={`${brain.data.runtimeStatus} · ${countLabel(brain.data.itemCount, 'orchestrator')} · execution ${brain.data.executionEnabled ? 'enabled' : 'contained'}`} />
        <PostureRow label="Computer" state={computer.state} detail={`${computer.data.resourceCount} resources · ${computer.data.staleResources} stale · ${computer.data.failedBackups} backup failures`} />
        <PostureRow label="Scheduler" state={scheduler.state} detail={`${scheduler.data.totalJobs} jobs · ${scheduler.data.runningJobs} running · ${scheduler.data.failedJobs} failed · ${scheduler.data.blockedJobs} blocked`} />
        <PostureRow label="Index" state={index.state} detail={`${index.data.currentCount}/${index.data.itemCount} sources current`} />
        <PostureRow label="Consumers" state={consumers.state} detail={consumers.data.domains.join(' · ')} />
      </div>
      <div className="command-center-identity">
        <div className="split"><strong>Runtime identity</strong><OperationalStateBadge state={identity.state} /></div>
        <div className="meta">{identity.data.runtime.serviceState} · started by {identity.data.runtime.launchMechanism}</div>
        <div className="meta">source <Revision value={identity.data.canonicalSource.revision} /> · deployed <Revision value={identity.data.deployment.revision} /></div>
      </div>
    </section>
  );
}

function CoreUnavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <section className="card command-center-unavailable" role="alert">
      <OperationalStateBadge state="UNAVAILABLE" />
      <h2>Brain Core unavailable</h2>
      <p>The Command Center cannot read its operational snapshot yet. Existing Console routes remain available.</p>
      <p className="meta">{error instanceof Error ? error.message : 'The snapshot request failed.'}</p>
      <button className="button compact secondary" onClick={onRetry}><RefreshCw size={14} /> Retry</button>
    </section>
  );
}

function LoadingState() {
  return <section className="card command-center-loading" aria-live="polite"><div className="eyebrow">Brain Command Center</div><h1>Loading operational posture…</h1><p>Reading one bounded snapshot from Brain Core.</p></section>;
}

export function CommandCenter() {
  const snapshot = useQuery({
    queryKey: ['operational-snapshot'],
    queryFn: getOperationalSnapshot,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  const retry = () => void snapshot.refetch();

  if (snapshot.isPending && !snapshot.data) return <LoadingState />;
  if (snapshot.isError && !snapshot.data) return <CoreUnavailable error={snapshot.error} onRetry={retry} />;

  const data = snapshot.data;
  if (!data) return <CoreUnavailable error={new Error('Brain Core returned no snapshot.')} onRetry={retry} />;

  return (
    <div className="stack command-center">
      <section className="command-center-header">
        <div>
          <div className="eyebrow">Brain Console 2.0 preview</div>
          <h1>Command Center</h1>
          <p>One bounded operational view for health, attention, active work, recent activity, and domain posture.</p>
        </div>
        <div className="command-center-header-meta">
          <OperationalStateBadge state={data.overall.state} detail={data.overall.data.summary} />
          <FreshnessLabel freshness={data.overall.freshness} updatedAt={data.generatedAt} detail={data.overall.data.summary} />
          <button className="button compact secondary" onClick={() => void snapshot.refetch()} disabled={snapshot.isFetching}><RefreshCw size={14} className={snapshot.isFetching ? 'command-center-spin' : undefined} /> {snapshot.isFetching ? 'Refreshing' : 'Refresh'}</button>
        </div>
      </section>

      {snapshot.isError ? <div className="compact-error" role="status"><strong>Showing the last valid snapshot.</strong> Refresh failed; the displayed posture has not been cleared.</div> : null}
      {data.errors.length > 0 ? <div className="compact-error" role="status"><strong>Partial snapshot.</strong> {countLabel(data.errors.length, 'source error')} are represented in the affected sections.</div> : null}

      <section className="command-center-kpis" aria-label="Command Center summary">
        <KpiCard label="Brain state" value={displayState(data.overall.state)} detail={data.overall.data.summary} state={data.overall.state} />
        <KpiCard label="Active work" value={String(data.overall.data.activeWorkCount)} detail={data.sections.activeWork.data.items.length === 0 ? 'No work in progress' : countLabel(data.overall.data.activeWorkCount, 'item')} state={data.sections.activeWork.state} />
        <KpiCard label="Attention" value={String(data.overall.data.attentionCount)} detail={data.overall.data.attentionCount === 0 ? 'Nothing requires action' : 'Review the highest-value exceptions'} state={data.sections.attention.state} />
        <KpiCard label="Runtime" value={data.sections.identity.data.identityState} detail={`${data.sections.identity.data.runtime.serviceState} · ${data.sections.identity.data.runtime.launchMechanism}`} state={data.sections.identity.state} />
      </section>

      <section className="command-center-primary-grid">
        <ActiveWorkPanel snapshot={data} />
        <AttentionPanel snapshot={data} />
        <ActivityPanel snapshot={data} />
        <PosturePanel snapshot={data} />
      </section>

      <footer className="command-center-footer">
        <span className="meta">Snapshot {data.snapshotId} · {data.safety.readOnly ? 'read-only' : 'safety contract unavailable'}</span>
        <Link href="/" className="button-link">Open legacy Overview</Link>
      </footer>
    </div>
  );
}
