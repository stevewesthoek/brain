'use client';

import { StatusBadge } from '@/components/status-badge';
import { timeAgo } from '@/lib/utils';
import type { VideoJobsDiagnostics } from '@/lib/braincore-schemas';

function pct(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function JobsDiagnosticsCard({
  diagnostics,
  error,
}: {
  diagnostics: Partial<VideoJobsDiagnostics> | null | undefined;
  error?: string | null;
}) {
  if (!diagnostics && !error) return null;

  return (
    <div className="compact-error">
      <strong>AWS Video job diagnostics</strong>
      {error ? <p>{error}</p> : null}
      {diagnostics ? (
        <div className="aws-facts">
          <div><span>jobsRoot</span><strong>{diagnostics.jobsRoot || 'not available'}</strong></div>
          <div><span>local folders</span><strong>{diagnostics.localJobFolderCount ?? 0}</strong></div>
          <div><span>local IDs</span><strong>{diagnostics.localDiscoveredJobCount ?? 0}</strong></div>
          <div><span>hydrated</span><strong>{diagnostics.hydratedJobCount ?? 0}</strong></div>
          <div><span>skipped</span><strong>{diagnostics.skippedJobCount ?? 0}</strong></div>
          <div><span>S3 fallback</span><strong>{diagnostics.s3DiscoveryAttempted ? `yes (${diagnostics.s3DiscoveredJobCount ?? 0})` : 'no'}</strong></div>
        </div>
      ) : null}
      {diagnostics?.error ? <p>Error: {diagnostics.error}</p> : null}
      {diagnostics?.warnings?.length ? <pre className="compact-pre">{diagnostics.warnings.join('\n')}</pre> : null}
      {diagnostics?.skippedJobs?.length ? <pre className="compact-pre">{JSON.stringify(diagnostics.skippedJobs.slice(0, 8), null, 2)}</pre> : null}
    </div>
  );
}

interface JobListItem {
  jobId: string;
  title?: string | null;
  channelId?: string | null;
  status?: string | null;
  progress?: number | null;
  updatedAt?: string | null;
}

export interface AwsVideoJobSelectorProps {
  jobsIsError: boolean;
  jobsDiagnostics: Partial<VideoJobsDiagnostics> | null | undefined;
  jobsErrorMessage: string | null;
  jobSearchQuery: string;
  setJobSearchQuery: (q: string) => void;
  directJobIdValue: string;
  setDirectJobIdValue: (v: string) => void;
  directJobIdError: string | null;
  setDirectJobIdError: (e: string | null) => void;
  onOpenDirectJobId: (id: string) => void;
  filteredJobList: JobListItem[];
  jobsTotal: number;
  resolvedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  statusErrorMessage: string | null;
}

export function AwsVideoJobSelector({
  jobsIsError,
  jobsDiagnostics,
  jobsErrorMessage,
  jobSearchQuery,
  setJobSearchQuery,
  directJobIdValue,
  setDirectJobIdValue,
  directJobIdError,
  setDirectJobIdError,
  onOpenDirectJobId,
  filteredJobList,
  jobsTotal,
  resolvedJobId,
  onSelectJob,
  statusErrorMessage,
}: AwsVideoJobSelectorProps) {
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Jobs</div>
          <div className="card-description">Search, filter, or open a job by ID</div>
        </div>
        <StatusBadge status={jobsIsError ? 'error' : 'fresh'} />
      </div>
      <JobsDiagnosticsCard
        diagnostics={jobsTotal === 0 || (jobsDiagnostics?.skippedJobCount ?? 0) > 0 || jobsIsError ? jobsDiagnostics : null}
        error={jobsIsError ? jobsErrorMessage : null}
      />
      <div className="stack" style={{ marginBottom: '1rem' }}>
        <input
          className="input"
          placeholder="Search by title, job ID, channel, or status"
          value={jobSearchQuery}
          onChange={(e) => setJobSearchQuery(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
          <input
            className="input"
            placeholder="Or paste a job ID to open directly"
            value={directJobIdValue}
            onChange={(e) => { setDirectJobIdValue(e.target.value); setDirectJobIdError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && directJobIdValue.trim()) {
                onOpenDirectJobId(directJobIdValue.trim());
              }
            }}
          />
          <button
            className="button secondary"
            disabled={!directJobIdValue.trim()}
            onClick={() => { if (directJobIdValue.trim()) onOpenDirectJobId(directJobIdValue.trim()); }}
          >
            Go
          </button>
        </div>
        {directJobIdError ? <div className="compact-warning">{directJobIdError}</div> : null}
      </div>
      <div className="job-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {filteredJobList.map((item) => {
          const isTestJob = /^Test\s+clientActionId\s+dedup/i.test(item.title ?? '');
          return (
            <button
              key={item.jobId}
              className={`job-list-item ${item.jobId === resolvedJobId ? 'active' : ''}${isTestJob ? ' test-job' : ''}`}
              onClick={() => onSelectJob(item.jobId)}
            >
              <div className="min-w-0">
                <strong>{item.title || item.jobId}{isTestJob ? ' [diagnostic]' : ''}</strong>
                <span>{item.jobId} · {item.channelId}</span>
              </div>
              <StatusBadge status={item.status} />
              <div className="job-progress">
                <div className="progress"><span style={{ width: `${pct(item.progress)}%` }} /></div>
                <span>{pct(item.progress)}%</span>
              </div>
              <span className="meta no-margin">{item.updatedAt ? timeAgo(item.updatedAt) : 'unknown'}</span>
            </button>
          );
        })}
        {jobsTotal === 0 && !jobsDiagnostics?.localJobFolderCount && !jobsDiagnostics?.s3DiscoveredJobCount && !statusErrorMessage ? (
          <p>No video jobs returned by Brain Core.</p>
        ) : null}
        {jobsTotal > 0 && filteredJobList.length === 0 ? (
          <div className="stack" style={{ padding: '0.75rem' }}>
            <p>No jobs match the search filter.</p>
            {jobSearchQuery.trim().length >= 10 ? (
              <button
                className="button secondary"
                onClick={() => onOpenDirectJobId(jobSearchQuery.trim())}
              >
                Open &quot;{jobSearchQuery.trim().slice(0, 48)}&quot; as job ID
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
