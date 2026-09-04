'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronDown, RefreshCw } from 'lucide-react';
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

function StatusCell({ label, value, detail, state }: { label: string; value: string; detail: string; state: OperationalState }) {
  return (
    <article className="command-center-status-cell">
      <div className="eyebrow">{label}</div>
      <div className="command-center-status-value">
        <strong>{value}</strong>
        <OperationalStateBadge state={state} />
      </div>
      <span className="meta">{detail}</span>
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
          <p>No items need attention.</p>
        </div>
      ) : (
        <div className="command-center-list command-center-bounded-list">
          {items.slice(0, 3).map((item) => (
            <details className="command-center-disclosure" key={item.id}>
              <summary>
                <span className="command-center-summary-main"><OperationalStateBadge state={item.state} /><strong>{item.title}</strong></span>
                <span className="command-center-summary-meta"><FreshnessLabel freshness={item.freshness} updatedAt={item.observedAt} /><ChevronDown size={14} aria-hidden="true" /></span>
              </summary>
              <div className="command-center-disclosure-body">
                <p>{item.explanation}</p>
                <div className="command-center-detail-meta">
                  <span className="meta">{item.source}{item.entityRef ? ` · ${item.entityRef}` : ''}</span>
                  {item.safeNextAction ? <span className="meta"><strong>Next:</strong> {item.safeNextAction}</span> : null}
                </div>
              </div>
            </details>
          ))}
          {items.length > 3 ? (
            <details className="command-center-more">
              <summary>+ {items.length - 3} more attention {items.length - 3 === 1 ? 'item' : 'items'}</summary>
              <div className="command-center-more-list">
                {items.slice(3).map((item) => <div className="command-center-more-row" key={item.id}><OperationalStateBadge state={item.state} /><strong>{item.title}</strong><FreshnessLabel freshness={item.freshness} updatedAt={item.observedAt} /></div>)}
              </div>
            </details>
          ) : null}
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
        <div className="command-center-list command-center-bounded-list">
          {items.map((item) => (
            <details className="command-center-disclosure" key={item.id}>
              <summary>
                <span className="command-center-summary-main"><OperationalStateBadge state={item.state} /><strong>{item.domain}</strong><span className="meta">{item.currentStage}</span></span>
                <span className="command-center-summary-meta"><span className="meta">{item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleTimeString()}` : 'Update unknown'}</span><ChevronDown size={14} aria-hidden="true" /></span>
              </summary>
              <div className="command-center-disclosure-body">
                <p>{item.nextAction}</p>
                <div className="command-center-work-meta">
                  <span>owner: {item.primaryOwner}</span>
                  <span>consumer: {item.consumer}</span>
                  <span>route: {item.capabilityRoute}</span>
                  <span>progress: {item.progress === null ? 'unknown' : `${Math.round(item.progress * 100)}%`}</span>
                </div>
              </div>
            </details>
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
        <div className="command-center-activity-list">
          {items.slice(0, 4).map((item) => (
            <article className="command-center-activity-row" key={item.id}>
              <time className="meta" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              <div className="command-center-activity-copy"><div className="row"><OperationalStateBadge state={item.severity === 'critical' ? 'ERROR' : item.severity === 'warning' ? 'DEGRADED' : 'CURRENT'} /><strong>{item.eventType}</strong></div><p>{item.summary}</p></div>
              <span className="meta">{item.domain} · {item.status}</span>
            </article>
          ))}
          {items.length > 4 ? <details className="command-center-more"><summary>+ {items.length - 4} more events</summary><div className="command-center-more-list">{items.slice(4).map((item) => <div className="command-center-more-row" key={item.id}><time className="meta" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><strong>{item.eventType}</strong><span className="meta">{item.domain}</span></div>)}</div></details> : null}
        </div>
      )}
    </section>
  );
}

function PostureRow({ label, state, detail, href }: { label: string; state: OperationalState; detail: string; href: string }) {
  return (
    <Link className="command-center-posture-row" href={href}>
      <div className="row"><OperationalStateBadge state={state} /><strong>{label}</strong></div>
      <span className="command-center-posture-detail"><span className="meta">{detail}</span><ArrowUpRight size={13} aria-hidden="true" /></span>
    </Link>
  );
}

function PosturePanel({ snapshot }: { snapshot: OperationalSnapshot }) {
  const { brain, computer, scheduler, index, consumers, identity } = snapshot.sections;
  return (
    <section className="card command-center-panel" aria-labelledby="command-center-posture">
      <SectionHeading eyebrow="System map" title="Domain posture" titleId="command-center-posture" state={snapshot.overall.state} />
      <div className="command-center-posture">
        <PostureRow label="Brain" href="/" state={brain.state} detail={`${brain.data.runtimeStatus} · ${countLabel(brain.data.itemCount, 'orchestrator')} · execution ${brain.data.executionEnabled ? 'enabled' : 'contained'}`} />
        <PostureRow label="Computer" href="/infrastructure" state={computer.state} detail={`${computer.data.resourceCount} resources · ${computer.data.staleResources} stale · ${computer.data.failedBackups} backup failures`} />
        <PostureRow label="Scheduler" href="/scheduler" state={scheduler.state} detail={`${scheduler.data.totalJobs} jobs · ${scheduler.data.runningJobs} running · ${scheduler.data.failedJobs} failed · ${scheduler.data.blockedJobs} blocked`} />
        <PostureRow label="Index" href="/infrastructure" state={index.state} detail={`${index.data.currentCount}/${index.data.itemCount} sources current`} />
        <PostureRow label="Consumers" href="/ai-models" state={consumers.state} detail={consumers.data.domains.join(' · ')} />
      </div>
      <details className="command-center-identity">
        <summary><span><strong>Runtime identity</strong><span className="meta"> · {identity.data.runtime.serviceState} · {identity.data.runtime.launchMechanism}</span></span><span className="command-center-summary-meta"><OperationalStateBadge state={identity.state} /><ChevronDown size={14} aria-hidden="true" /></span></summary>
        <div className="command-center-identity-detail"><span className="meta">source <Revision value={identity.data.canonicalSource.revision} /> · deployed <Revision value={identity.data.deployment.revision} /></span><span className="meta">{identity.data.canonicalSource.path ?? 'Source path unavailable'} → {identity.data.deployment.runtimePath ?? 'Runtime path unavailable'}</span></div>
      </details>
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
  return (
    <div className="stack command-center command-center-loading-state" aria-live="polite" aria-label="Loading Command Center">
      <section className="command-center-header">
        <div><div className="eyebrow">Operational posture</div><span className="skeleton skeleton-command-title" /><span className="skeleton skeleton-command-copy" /></div>
        <div className="command-center-header-meta"><span className="skeleton skeleton-status" /><span className="skeleton skeleton-button" /></div>
      </section>
      <section className="command-center-status-strip" aria-hidden="true">{[1, 2, 3, 4, 5].map((item) => <span className="command-center-status-cell" key={item}><span className="skeleton skeleton-status-label" /><span className="skeleton skeleton-status-value" /><span className="skeleton skeleton-status-detail" /></span>)}</section>
      <section className="command-center-primary-grid" aria-hidden="true">{[1, 2, 3, 4].map((item) => <span className="card command-center-loading-panel" key={item}><span className="skeleton skeleton-panel-heading" /><span className="skeleton skeleton-panel-row" /><span className="skeleton skeleton-panel-row short" /></span>)}</section>
      <footer className="command-center-footer"><span className="skeleton skeleton-footer" /></footer>
    </div>
  );
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
          <div className="eyebrow">Operational posture</div>
          <h1>Command Center</h1>
          <p className="command-center-lede">{data.overall.data.summary}</p>
        </div>
        <div className="command-center-header-meta">
          <div className="command-center-header-state"><OperationalStateBadge state={data.overall.state} detail={data.overall.data.summary} /><FreshnessLabel freshness={data.overall.freshness} updatedAt={data.generatedAt} detail={data.overall.data.summary} /></div>
          <button className="button compact secondary" onClick={() => void snapshot.refetch()} disabled={snapshot.isFetching}><RefreshCw size={14} className={snapshot.isFetching ? 'command-center-spin' : undefined} /> {snapshot.isFetching ? 'Refreshing' : 'Refresh'}</button>
        </div>
      </section>

      <div className="command-center-notices">
        {snapshot.isError ? <div className="compact-error" role="status"><strong>Showing the last valid snapshot.</strong> Refresh failed; the displayed posture has not been cleared.</div> : null}
        {data.errors.length > 0 ? <div className="compact-error" role="status"><strong>Partial snapshot.</strong> {countLabel(data.errors.length, 'source error')} are represented in the affected sections.</div> : null}
      </div>

      <section className="command-center-status-strip" aria-label="Command Center summary">
        <StatusCell label="Brain" value={displayState(data.overall.state)} detail={data.overall.data.summary} state={data.overall.state} />
        <StatusCell label="Active" value={String(data.overall.data.activeWorkCount)} detail={data.overall.data.activeWorkCount === 0 ? 'No work in progress' : countLabel(data.overall.data.activeWorkCount, 'item')} state={data.sections.activeWork.state} />
        <StatusCell label="Attention" value={String(data.overall.data.attentionCount)} detail={data.overall.data.attentionCount === 0 ? 'Nothing requires action' : 'Highest-value exceptions'} state={data.sections.attention.state} />
        <StatusCell label="Runtime" value={data.sections.identity.data.identityState} detail={`${data.sections.identity.data.runtime.serviceState} · ${data.sections.identity.data.runtime.launchMechanism}`} state={data.sections.identity.state} />
        <StatusCell label="Scheduler" value={String(schedulerCount(data))} detail={`${data.sections.scheduler.data.blockedJobs} blocked · next run ${data.sections.scheduler.data.nextRunAt ? new Date(data.sections.scheduler.data.nextRunAt).toLocaleString() : 'unknown'}`} state={data.sections.scheduler.state} />
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

function schedulerCount(snapshot: OperationalSnapshot): number {
  return snapshot.sections.scheduler.data.totalJobs;
}
