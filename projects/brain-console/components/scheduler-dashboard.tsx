'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { brainCoreRequest } from '@/lib/braincore-client';
import { infraOfficeSchedulerStatusSchema, type InfraOfficeSchedulerJob } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';

function dateLabel(value: string | null | undefined): string {
  if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function durationLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'; if (value < 60) return `${value}s`; return `${Math.floor(value / 60)}m ${value % 60}s`;
}
function resultLabel(job: InfraOfficeSchedulerJob): string {
  if (job.status === 'failed' && job.exitCode !== null) return `Failed (${job.exitCode})`;
  return job.status.replaceAll('-', ' ');
}
function jobTone(job: InfraOfficeSchedulerJob): string {
  if (job.status === 'success' || job.status === 'running') return 'success';
  if (job.status === 'failed' || job.status === 'timeout') return 'error';
  return job.status;
}
function count(data: { counts: Record<string, number> } | undefined, key: string): number { return data?.counts[key] ?? 0; }

function JobDetail({ job, onClose }: { job: InfraOfficeSchedulerJob; onClose: () => void }) {
  return (
    <article className="card">
      <div className="compact-actions">
        <div><div className="eyebrow">Job detail</div><h2>{job.name}</h2></div>
        <button className="button compact secondary" onClick={onClose}>Close</button>
      </div>
      <p>{job.description}</p>
      <div className="grid cards">
        <div><div className="meta">Lifecycle</div><StatusBadge status={job.lifecycle} label={job.lifecycle} /></div>
        <div><div className="meta">Current result</div><StatusBadge status={jobTone(job)} label={resultLabel(job)} /></div>
        <div><div className="meta">Mode</div><div>{job.mode}</div></div>
        <div><div className="meta">Owner</div><div>{job.owner}</div></div>
      </div>
      <dl className="detail-list">
        <dt>Entrypoint</dt><dd><code>{job.entrypoint}</code></dd>
        <dt>Schedule</dt><dd>{job.schedule}</dd>
        <dt>Dependencies</dt><dd>{job.dependencies.join(', ') || 'None'}</dd>
        <dt>Safety</dt><dd>Network: {job.networkAccess}; credentials: {String(job.credentialSensitive)}; destructive: {String(job.destructive)}; Mind writes: {String(job.mindWrite)}</dd>
        <dt>Last run</dt><dd>{dateLabel(job.lastRunAt)} · {durationLabel(job.durationSeconds)}</dd>
        <dt>Next run / trigger</dt><dd>{dateLabel(job.nextRunAt)}{job.trigger ? ` · ${job.trigger}` : ''}</dd>
        <dt>Receipt</dt><dd><code>{job.receiptPath}</code></dd>
        <dt>Artifacts</dt><dd>{job.artifactPaths.join(', ') || 'None recorded'}</dd>
        <dt>Policy</dt><dd>{job.policyReason}</dd>
        <dt>Human action</dt><dd>{job.humanAction}</dd>
        <dt>Runbook</dt><dd><code>{job.runbook}</code></dd>
        {job.latestError ? <><dt>Latest error</dt><dd>{job.latestError}</dd></> : null}
      </dl>
      <div className="meta">Recent history: {job.recentHistory.length ? `${job.recentHistory.length} bounded record(s)` : 'none recorded'}.</div>
    </article>
  );
}

export function SchedulerDashboard() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const scheduler = useQuery({ queryKey: ['infra-office-scheduler'], queryFn: () => brainCoreRequest('/infra/scheduler', infraOfficeSchedulerStatusSchema, { timeoutMs: 12_000 }), refetchInterval: 15_000 });
  const data = scheduler.data;
  const selectedJob = data?.jobs.find((job) => job.id === selectedJobId) ?? null;
  const overallTone = data?.health === 'healthy' ? 'success' : data?.health === 'failed' ? 'error' : 'warning';

  return (
    <div className="stack">
      <section className="page-heading">
        <div><div className="eyebrow">Brain infrastructure</div><h1>Brain Scheduler</h1><p>Canonical, read-only control center for the typed Brain Scheduler registry, launchd schedule, job lifecycle, receipts, and bounded runtime history.</p></div>
        <div className="compact-actions"><StatusBadge status={overallTone} label={data?.health ?? (scheduler.isError ? 'error' : 'loading')} /><span className="meta">Auto-refreshes every 15 seconds</span><button className="button compact secondary" onClick={() => void scheduler.refetch()}><RefreshCw size={14} /> Refresh</button></div>
      </section>

      {scheduler.isError ? <div className="compact-error"><strong>Scheduler data failed to load.</strong> Brain Core could not read the canonical scheduler overview.</div> : null}
      {data?.status === 'not-configured' ? <div className="compact-error"><strong>Brain Scheduler is not configured.</strong> The planned registry or runtime evidence is unavailable.</div> : null}

      <section className="grid cards">
        <article className="card"><div className="card-title">Health</div><div className="metric">{data?.health ?? '—'}</div><div className="meta">{data?.displayName ?? 'Canonical scheduler'}</div></article>
        <article className="card"><div className="card-title">Schedule</div><div className="metric">03:00</div><div className="meta">{data?.timezone ?? 'Europe/Lisbon'} · RunAtLoad guarded</div></article>
        <article className="card"><div className="card-title">Last run</div><div className="metric">{dateLabel(data?.lastRun?.endedAt as string | null | undefined)}</div><div className="meta">{data?.lastRun?.status ? `${String(data.lastRun.status)} · ${durationLabel((data.lastRun.durationSeconds as number | null | undefined) ?? null)}` : 'no receipt'}</div></article>
        <article className="card"><div className="card-title">Next run</div><div className="metric">{dateLabel(data?.nextRunAt)}</div><div className="meta">{data?.schedule ?? 'daily schedule'}</div></article>
        <article className="card"><div className="card-title">Lifecycle</div><div className="metric">{count(data, 'active')} active</div><div className="meta">{count(data, 'policy-blocked')} blocked · {count(data, 'disabled') + count(data, 'deprecated')} disabled/retired</div></article>
        <article className="card"><div className="card-title">Runtime</div><div className="metric">{count(data, 'successful')} success</div><div className="meta">{count(data, 'failed') + count(data, 'timeout')} failures/timeouts · {count(data, 'running')} running</div></article>
      </section>

      {data ? <section className="card"><div className="card-title">Launch and authority</div><p>{data.launchMechanism} · <code>{data.launchAgentLabel}</code> · {data.schedule}</p><div className="meta">Manifest: {String(data.manifest.valid)} · {String(data.manifest.jobCount)} jobs · lock: {data.lock.held ? 'held' : data.lock.stale ? 'stale' : 'free'} · report: {data.report.available ? 'available' : 'missing'}</div></section> : null}
      {selectedJob ? <JobDetail job={selectedJob} onClose={() => setSelectedJobId(null)} /> : null}

      <section className="table-wrap"><table><thead><tr><th>Job / purpose</th><th>Schedule</th><th>Lifecycle</th><th>Mode</th><th>Last run</th><th>Result</th><th>Duration</th><th>Next / trigger</th><th>Human action</th></tr></thead><tbody>
        {(data?.jobs ?? []).map((job) => <tr key={job.id}><td><button className="button-link" onClick={() => setSelectedJobId(job.id)}>{job.name}</button><div className="meta">{job.id} · {job.description}</div></td><td className="meta">{job.schedule}</td><td><StatusBadge status={job.lifecycle} label={job.lifecycle} /></td><td className="meta">{job.mode}</td><td className="meta">{dateLabel(job.lastRunAt)}</td><td><StatusBadge status={jobTone(job)} label={resultLabel(job)} /><div className="meta">{job.exitCode !== null ? `exit ${job.exitCode}` : ''}</div></td><td className="meta">{durationLabel(job.durationSeconds)}</td><td className="meta">{dateLabel(job.nextRunAt)}{job.trigger ? ` · ${job.trigger}` : ''}</td><td className="meta">{job.humanAction}</td></tr>)}
        {(data?.jobs ?? []).length === 0 ? <tr><td colSpan={9}><div className="meta">No canonical scheduler jobs were returned.</div></td></tr> : null}
      </tbody></table></section>
    </div>
  );
}
