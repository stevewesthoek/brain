'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FilePlus2, RefreshCw, Wand2 } from 'lucide-react';
import { brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import { recentVideoJobsSchema, videoActionResultSchema, videoArtifactsResponseSchema, videoExecutionResponseSchema, videoJobResponseSchema, videoStatusSchema, videoTimelineResponseSchema, youtubePublishResultSchema, type VideoJob } from '@/lib/braincore-schemas';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

const GENERATE_TIMEOUT_MS = 120_000;

function pct(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function AwsVideoDashboard() {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [publishConfirmation, setPublishConfirmation] = useState('');
  const [dryRunPassedForJobId, setDryRunPassedForJobId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string[]>([]);

  const addActivity = (message: string) => setActivity((items) => [`${new Date().toLocaleTimeString()} · ${message}`, ...items].slice(0, 12));

  const status = useQuery({
    queryKey: ['aws-video-status'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/status', videoStatusSchema),
    refetchInterval: 10_000,
  });
  const jobs = useQuery({
    queryKey: ['aws-video-jobs'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/jobs/recent', recentVideoJobsSchema),
    refetchInterval: 10_000,
  });

  const selected = useMemo(() => {
    const list = jobs.data?.jobs ?? [];
    return list.find((job) => job.jobId === selectedJobId) ?? list[0] ?? null;
  }, [jobs.data?.jobs, selectedJobId]);

  const jobId = selected?.jobId ?? null;

  const job = useQuery({
    queryKey: ['aws-video-job', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}`, videoJobResponseSchema),
    enabled: Boolean(jobId),
    refetchInterval: selected && ['generating', 'publishing'].includes(selected.status ?? '') ? 5_000 : 15_000,
  });
  const timeline = useQuery({
    queryKey: ['aws-video-timeline', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/timeline`, videoTimelineResponseSchema),
    enabled: Boolean(jobId),
    refetchInterval: 15_000,
  });
  const artifacts = useQuery({
    queryKey: ['aws-video-artifacts', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/artifacts`, videoArtifactsResponseSchema),
    enabled: Boolean(jobId),
    refetchInterval: 20_000,
  });
  const execution = useQuery({
    queryKey: ['aws-video-execution', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/execution`, videoExecutionResponseSchema),
    enabled: Boolean(jobId),
    refetchInterval: 10_000,
  });

  const invalidateVideo = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['aws-video-status'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-job'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-timeline'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-artifacts'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-execution'] }),
    ]);
  };

  const createDraft = useMutation({
    mutationFn: () => postBrainCoreAction('/api/video-orchestrator/jobs/create-from-prompt', videoActionResultSchema, { channelId, prompt, requestedBy: 'brain-console-center' }),
    onSuccess: async (result) => {
      const possibleJobId = typeof result.jobId === 'string' ? result.jobId : typeof (result.job as { jobId?: unknown } | undefined)?.jobId === 'string' ? (result.job as { jobId: string }).jobId : null;
      if (possibleJobId) setSelectedJobId(possibleJobId);
      setPrompt('');
      addActivity(`Draft created${possibleJobId ? `: ${possibleJobId}` : ''}`);
      await invalidateVideo();
    },
  });

  const approve = useMutation({
    mutationFn: () => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId ?? '')}/approve`, videoActionResultSchema, { approvedBy: 'brain-console-center' }),
    onSuccess: async () => { addActivity(`Approved script for ${jobId}`); await invalidateVideo(); },
  });

  const requestChanges = useMutation({
    mutationFn: () => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId ?? '')}/request-changes`, videoActionResultSchema, { requestedBy: 'brain-console-center', changes: changeRequest }),
    onSuccess: async () => { setChangeRequest(''); addActivity(`Requested changes for ${jobId}`); await invalidateVideo(); },
  });

  const generate = useMutation({
    mutationFn: () => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId ?? '')}/generate`, videoActionResultSchema, { requestedBy: 'brain-console-center' }, GENERATE_TIMEOUT_MS),
    onSuccess: async () => { addActivity(`Generation accepted for ${jobId}`); await invalidateVideo(); },
  });

  const youtubeDryRun = useMutation({
    mutationFn: () => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/publish/youtube/dry-run`, youtubePublishResultSchema, {}, 180_000),
    onSuccess: async (result) => {
      if (result.ok && jobId) setDryRunPassedForJobId(jobId);
      addActivity(result.ok ? `YouTube dry-run passed for ${jobId}` : `YouTube dry-run failed for ${jobId}`);
      await invalidateVideo();
    },
  });

  const youtubePublish = useMutation({
    mutationFn: () => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/publish/youtube`, youtubePublishResultSchema, {
      dryRun: false,
      confirmation: publishConfirmation,
      requestedBy: 'brain-console-center',
    }, 1_900_000),
    onSuccess: async (result) => {
      addActivity(result.ok ? `Private YouTube upload completed for ${jobId}${result.videoId ? ` (${result.videoId})` : ''}` : `Private YouTube upload failed for ${jobId}`);
      setPublishConfirmation('');
      await invalidateVideo();
    },
  });

  const selectedJob = job.data?.data ?? selected;
  const timelineEvents = timeline.data?.data.events ?? [];

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">AWS Video Pipeline</div>
          <h1>Video operations</h1>
          <p>Brain Console Center is the active dashboard. Brain Console Web is legacy. Controlled YouTube publishing uses dry-run first, then confirmed private upload.</p>
        </div>
        <div className="row">
          <StatusBadge status={status.isError || jobs.isError ? 'error' : 'fresh'} label={status.isError || jobs.isError ? 'partial error' : 'auto refresh'} />
          <button className="button secondary" onClick={() => void invalidateVideo()}><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="grid two">
        <div className="stack">
          <article className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Recent jobs</div>
                <div className="card-description">{jobs.data?.jobs?.length ?? 0} jobs returned by Brain Core</div>
              </div>
              <StatusBadge status={jobs.isError ? 'error' : 'fresh'} />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Job</th><th>Status</th><th>Progress</th><th>Updated</th></tr></thead>
                <tbody>
                  {(jobs.data?.jobs ?? []).map((item) => (
                    <tr key={item.jobId} onClick={() => setSelectedJobId(item.jobId)} style={{ cursor: 'pointer' }}>
                      <td><strong>{item.title}</strong><div className="meta">{item.jobId} · {item.channelId}</div></td>
                      <td><StatusBadge status={item.status} /></td>
                      <td><div className="progress"><span style={{ width: `${pct(item.progress)}%` }} /></div><div className="meta">{pct(item.progress)}%</div></td>
                      <td>{item.updatedAt ? timeAgo(item.updatedAt) : 'unknown'}</td>
                    </tr>
                  ))}
                  {(jobs.data?.jobs ?? []).length === 0 ? <tr><td colSpan={4}>No video jobs returned by Brain Core.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card">
            <div className="card-title">Create draft</div>
            <p>Creates a new AWS Video draft through Brain Core.</p>
            <div className="stack">
              <input className="input" placeholder="Channel id" value={channelId} onChange={(event) => setChannelId(event.target.value)} />
              <textarea className="textarea" placeholder="Draft prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              <button className="button" disabled={channelId.trim().length === 0 || prompt.trim().length < 10 || createDraft.isPending} onClick={() => createDraft.mutate()}><FilePlus2 size={16} /> Create draft</button>
            </div>
          </article>
        </div>

        <aside className="stack">
          <article className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Selected job</div>
                <div className="card-description">{selectedJob?.jobId ?? 'No job selected'}</div>
              </div>
              <StatusBadge status={selectedJob?.status} />
            </div>
            {selectedJob ? (
              <div className="stack">
                <h2 style={{ margin: 0 }}>{selectedJob.title}</h2>
                <div className="progress"><span style={{ width: `${pct(selectedJob.progress)}%` }} /></div>
                <div className="meta">Current step: {selectedJob.currentStep ?? 'unknown'}</div>
                <div className="row">
                  <button className="button" disabled={!jobId || approve.isPending} onClick={() => approve.mutate()}><CheckCircle2 size={16} /> Approve script</button>
                  <button className="button" disabled={!jobId || generate.isPending} onClick={() => generate.mutate()}><Wand2 size={16} /> Generate</button>
                </div>
                <div className="publish-panel">
                  <div className="split">
                    <div>
                      <strong>Controlled YouTube publish</strong>
                      <div className="meta">Private upload only. Dry-run must pass before the publish button is enabled.</div>
                    </div>
                    <StatusBadge status={selectedJob.status === 'published' ? 'fresh' : selectedJob.status === 'ready_to_publish' ? 'ready' : 'pending'} label={selectedJob.status === 'published' ? 'uploaded' : selectedJob.status === 'ready_to_publish' ? 'ready' : 'not ready'} />
                  </div>
                  <div className="row">
                    <button className="button secondary" disabled={!jobId || youtubeDryRun.isPending || youtubePublish.isPending} onClick={() => youtubeDryRun.mutate()}>
                      {youtubeDryRun.isPending ? 'Running dry-run…' : 'Dry-run YouTube publish'}
                    </button>
                    <button className="button" disabled={!jobId || dryRunPassedForJobId !== jobId || publishConfirmation !== 'PUBLISH PRIVATE TO YOUTUBE' || youtubePublish.isPending} onClick={() => youtubePublish.mutate()}>
                      {youtubePublish.isPending ? 'Publishing privately…' : 'Publish privately'}
                    </button>
                  </div>
                  <label className="meta" style={{ display: 'grid', gap: 8 }}>
                    Type <code>PUBLISH PRIVATE TO YOUTUBE</code> after a successful dry-run.
                    <input className="input" value={publishConfirmation} onChange={(event) => setPublishConfirmation(event.target.value)} placeholder="PUBLISH PRIVATE TO YOUTUBE" />
                  </label>
                  {youtubeDryRun.data ? <pre className="meta">{JSON.stringify(youtubeDryRun.data, null, 2).slice(0, 1600)}</pre> : null}
                  {youtubePublish.data ? <pre className="meta">{JSON.stringify(youtubePublish.data, null, 2).slice(0, 1600)}</pre> : null}
                </div>
                <textarea className="textarea" placeholder="Requested changes" value={changeRequest} onChange={(event) => setChangeRequest(event.target.value)} />
                <button className="button secondary" disabled={!jobId || changeRequest.trim().length < 4 || requestChanges.isPending} onClick={() => requestChanges.mutate()}>Request changes</button>
              </div>
            ) : <p>Select a job to inspect details.</p>}
          </article>

          <article className="card">
            <div className="card-title">AWS execution</div>
            <pre className="meta">{JSON.stringify(execution.data?.data ?? {}, null, 2).slice(0, 1800)}</pre>
          </article>

          <article className="card">
            <div className="card-title">Artifacts</div>
            <pre className="meta">{JSON.stringify(artifacts.data?.data ?? {}, null, 2).slice(0, 1800)}</pre>
          </article>
        </aside>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="card-title">Timeline</div>
          <div className="timeline">
            {timelineEvents.map((event, index) => (
              <div className="timeline-item" key={`${event.step}-${index}`}>
                <div className="split"><strong>{event.step}</strong><StatusBadge status={event.status} /></div>
                <div className="meta">{event.timestamp ? timeAgo(event.timestamp) : 'unknown time'}</div>
                <p>{event.message}</p>
              </div>
            ))}
            {timelineEvents.length === 0 ? <p>No timeline events for the selected job.</p> : null}
          </div>
        </article>
        <article className="card">
          <div className="card-title">Activity</div>
          <div className="stack">
            {[...(activity.length ? activity : ['No activity yet.'])].map((item) => <div className="meta" key={item}>{item}</div>)}
          </div>
        </article>
      </section>

      {[createDraft.error, approve.error, requestChanges.error, generate.error, youtubeDryRun.error, youtubePublish.error].filter(Boolean).map((error, index) => (
        <div className="card" key={index}><div className="card-title">Action error</div><p>{error instanceof Error ? error.message : String(error)}</p></div>
      ))}
    </div>
  );
}
