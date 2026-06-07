'use client';

import { useEffect, useState } from 'react';

import { brainCoreRequest } from '../lib/braincore-client';
import { mindStewardSchedulerStatusSchema, type MindStewardSchedulerStatus } from '../lib/braincore-schemas';

function formatReportLabel(key: string) {
  if (key === 'dryRun') return 'Dry run';
  if (key === 'inbox') return 'Inbox';
  if (key === 'classifier') return 'Classifier';
  if (key === 'queue') return 'Queue';
  return key;
}

function MindStewardStatusCard() {
  const [status, setStatus] = useState<MindStewardSchedulerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const payload = await brainCoreRequest('/scheduler/mind-steward/status', mindStewardSchedulerStatusSchema);
        if (!cancelled) {
          setStatus(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();
    const interval = window.setInterval(loadStatus, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <article className="card">
      <div className="card-title">Mind Steward preflights</div>
      {loading ? <p className="meta">Loading Mind Steward runtime reports…</p> : null}
      {error ? <p className="meta">Status unavailable: {error}</p> : null}
      {status ? (
        <div className="stack gap-sm">
          <p className="meta">
            {status.availableCount}/{status.reportCount} reports available from {status.source}. Status: {status.status}.
          </p>
          <div className="grid two">
            {Object.entries(status.reports).map(([key, report]) => (
              <div className="surface compact" key={key}>
                <strong>{formatReportLabel(key)}</strong>
                <p className="meta">
                  {report.available ? report.status : 'missing'}
                  {report.mode ? ` · ${report.mode}` : ''}
                </p>
                <p className="meta">
                  writesToMind: {String(report.writesToMind ?? false)} · executableActions:{' '}
                  {String(report.executableActions ?? false)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function OverviewDashboard() {
  return (
    <div className="stack overview-screen">
      <section className="overview-hero overview-hero-compact">
        <div className="overview-copy">
          <div className="eyebrow">Overview</div>
          <h1>Operational control</h1>
          <p>
            The global pulse strip above stays pinned on every dashboard view, so system health, Codex windows,
            and Claude Code cost estimates are always visible without opening a separate page.
          </p>
        </div>
        <div className="overview-status-card">
          <div className="card-title">Global coverage</div>
          <strong>Always on</strong>
          <span>Top-of-screen telemetry is shared across every dashboard surface.</span>
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-title">What stays pinned</div>
          <p className="meta">
            CPU load, memory pressure, GPU state, uptime, Codex windows, and Claude Code costs remain in the
            same global location regardless of the page you open.
          </p>
        </article>
        <article className="card">
          <div className="card-title">Refresh cadence</div>
          <p className="meta">
            System telemetry refreshes every second. Codex and Claude estimate cards refresh every five seconds.
          </p>
        </article>
        <MindStewardStatusCard />
      </section>
    </div>
  );
}
