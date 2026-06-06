'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import {
  infraOfficeSchedulerStatusSchema,
  type InfraOfficeSchedulerJob,
} from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';

const JOB_STATUS_PRIORITY: Record<InfraOfficeSchedulerJob['status'], number> = {
  running: 0,
  failed: 1,
  timeout: 2,
  success: 3,
  never: 4,
};

function normalizeDateLabel(value: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function timeUntil(value: string | null): string {
  if (!value) return 'unknown';
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return 'unknown';
  const diff = target - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return diff >= 0 ? 'in under 1m' : 'just now';
  if (abs < 3_600_000) return diff >= 0 ? `in ${Math.round(abs / 60_000)}m` : `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return diff >= 0 ? `in ${Math.round(abs / 3_600_000)}h` : `${Math.round(abs / 3_600_000)}h ago`;
  return diff >= 0 ? `in ${Math.round(abs / 86_400_000)}d` : `${Math.round(abs / 86_400_000)}d ago`;
}

function formatDuration(seconds: number | null): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function jobTone(status: InfraOfficeSchedulerJob['status']): 'fresh' | 'warning' | 'error' {
  if (status === 'success' || status === 'running') return 'fresh';
  if (status === 'failed' || status === 'timeout') return 'error';
  return 'warning';
}

function jobStatusLabel(job: InfraOfficeSchedulerJob): string {
  if (job.status === 'running') return 'Running';
  if (job.status === 'success') return 'Success';
  if (job.status === 'timeout') return 'Timeout';
  if (job.status === 'failed') return job.exitCode !== null ? `Failed (${job.exitCode})` : 'Failed';
  return 'Never run';
}

function SchedulerJobRow({ job }: { job: InfraOfficeSchedulerJob }) {
  return (
    <tr>
      <td>
        <div className="card-title">{job.label}</div>
        <div className="meta">{job.key}</div>
      </td>
      <td>
        <StatusBadge status={job.planned ? 'fresh' : 'warning'} label={job.planned ? 'Planned' : 'Not planned'} />
      </td>
      <td>
        <StatusBadge status={job.executed ? 'fresh' : 'warning'} label={job.executed ? 'Executed' : 'Pending'} />
      </td>
      <td>
        <StatusBadge status={jobTone(job.status)} label={jobStatusLabel(job)} />
      </td>
      <td className="meta">{normalizeDateLabel(job.lastRunAt)}</td>
      <td className="meta">{timeUntil(job.nextRunAt)}</td>
      <td className="meta">{formatDuration(job.durationSeconds)}</td>
    </tr>
  );
}

export function SchedulerDashboard() {
  const scheduler = useQuery({
    queryKey: ['infra-office-scheduler'],
    queryFn: () => brainCoreRequest('/infra/scheduler', infraOfficeSchedulerStatusSchema, { timeoutMs: 12_000 }),
    refetchInterval: 15_000,
  });

  const jobs = useMemo(
    () => [...(scheduler.data?.jobs ?? [])].sort((left, right) => {
      const priority = JOB_STATUS_PRIORITY[left.status] - JOB_STATUS_PRIORITY[right.status];
      if (priority !== 0) return priority;
      return left.label.localeCompare(right.label);
    }),
    [scheduler.data?.jobs],
  );

  const overallStatus = scheduler.data?.status ?? (scheduler.isError ? 'error' : 'not-configured');
  const overallTone: 'fresh' | 'warning' | 'error' = overallStatus === 'ok' ? 'fresh' : overallStatus === 'not-configured' ? 'warning' : 'error';
  const overallLabel = overallStatus === 'ok' ? 'Connected' : overallStatus === 'not-configured' ? 'Not configured' : 'Offline';

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Infrastructure</div>
          <h1>Scheduler</h1>
          <p>Brain Core reads the Office nightly scheduler state and shows which tasks are planned, which have executed, and which ones are currently running or failed.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={overallTone} label={overallLabel} />
          <span className="meta">Refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void scheduler.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {scheduler.isError ? (
        <div className="compact-error">
          <strong>Scheduler data failed to load.</strong> Brain Core could not read `/infra/scheduler`.
        </div>
      ) : null}

      {scheduler.data?.status === 'not-configured' ? (
        <div className="compact-error">
          <strong>Office scheduler state is not configured.</strong> Brain Core can still render the planned job list, but the local scheduler state and report files were not found.
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Planned tasks</div>
          <div className="metric">{scheduler.data?.plannedJobs ?? 0}</div>
          <div className="meta">{scheduler.data?.totalJobs ?? 0} configured jobs</div>
        </article>
        <article className="card">
          <div className="card-title">Executed</div>
          <div className="metric">{scheduler.data?.executedJobs ?? 0}</div>
          <div className="meta">Jobs with at least one recorded run</div>
        </article>
        <article className="card">
          <div className="card-title">Running</div>
          <div className="metric">{scheduler.data?.runningJobs ?? 0}</div>
          <div className="meta">Live lock detected from the local scheduler</div>
        </article>
        <article className="card">
          <div className="card-title">Failures</div>
          <div className="metric">{(scheduler.data?.failedJobs ?? 0) + (scheduler.data?.timeoutJobs ?? 0)}</div>
          <div className="meta">{scheduler.data?.failedJobs ?? 0} failed, {scheduler.data?.timeoutJobs ?? 0} timed out</div>
        </article>
        <article className="card">
          <div className="card-title">Next run</div>
          <div className="metric">{scheduler.data ? normalizeDateLabel(scheduler.data.nextRunAt) : 'unknown'}</div>
          <div className="meta">{scheduler.data ? timeUntil(scheduler.data.nextRunAt) : 'unknown'}</div>
        </article>
        <article className="card">
          <div className="card-title">Report</div>
          <div className="metric">{scheduler.data?.report.available ? 'Ready' : 'Missing'}</div>
          <div className="meta">{scheduler.data?.report.summary ?? 'No report summary available.'}</div>
        </article>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Planned</th>
              <th>Executed</th>
              <th>Status</th>
              <th>Last run</th>
              <th>Next run</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => <SchedulerJobRow key={job.key} job={job} />)}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="meta">No scheduler jobs were returned by Brain Core.</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
