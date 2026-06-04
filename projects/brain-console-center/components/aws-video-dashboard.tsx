'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FilePlus2, RefreshCw, Wand2, Youtube } from 'lucide-react';
import { BrainCoreError, brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import { recentVideoJobsSchema, videoActionResultSchema, videoArtifactsResponseSchema, videoExecutionResponseSchema, videoJobResponseSchema, videoStatusSchema, videoTimelineResponseSchema, youtubePublishResultSchema, type VideoJob, type VideoJobsDiagnostics } from '@/lib/braincore-schemas';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

const GENERATE_TIMEOUT_MS = 120_000;
type AwsVideoView = 'overview' | 'jobs' | 'create' | 'publish' | 'activity';

function pct(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function shortJobId(jobId: string | undefined): string {
  if (!jobId) return 'No job selected';
  return jobId.length > 48 ? `${jobId.slice(0, 30)}…${jobId.slice(-12)}` : jobId;
}

function nestedStatus(value: unknown): string {
  if (!value || typeof value !== 'object') return 'not_available';
  const status = (value as { status?: unknown }).status;
  return typeof status === 'string' ? status : 'not_available';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function stringField(value: unknown, key: string): string | null {
  const record = asRecord(value);
  const field = record?.[key];
  return typeof field === 'string' && field.length > 0 ? field : null;
}

function isReadyToPublish(job: Partial<VideoJob> | null | undefined): boolean {
  return job?.status === 'ready_to_publish' || job?.status === 'published';
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

function payloadDiagnostics(error: unknown): VideoJobsDiagnostics | null {
  if (!(error instanceof BrainCoreError) || !error.payload || typeof error.payload !== 'object') return null;
  const payload = error.payload as { diagnostics?: unknown; payload?: { diagnostics?: unknown } };
  const diagnostics = payload.diagnostics ?? payload.payload?.diagnostics;
  if (!diagnostics || typeof diagnostics !== 'object') return null;
  return diagnostics as VideoJobsDiagnostics;
}

function payloadDetails(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof BrainCoreError) || !error.payload || typeof error.payload !== 'object') return null;
  const payload = error.payload as { details?: unknown; payload?: { details?: unknown } };
  const details = payload.details ?? payload.payload?.details;
  return details && typeof details === 'object' ? details as Record<string, unknown> : null;
}

function pipelineSteps(job: Partial<VideoJob> | null | undefined, selectedReady: boolean, selectedUploaded: boolean) {
  const status = job?.status ?? 'not_available';
  const approval = nestedStatus(job?.approval);
  const generation = nestedStatus(job?.generation);
  const publishing = nestedStatus(job?.publishing);
  return [
    { key: 'draft', label: 'Draft', state: job ? 'complete' : 'not available' },
    { key: 'approval', label: 'Approve', state: approval === 'approved' ? 'complete' : approval },
    { key: 'generation', label: 'Generate', state: selectedReady ? 'complete' : generation },
    { key: 'contract', label: 'Publish contract', state: selectedReady || status === 'published' ? 'complete' : 'waiting' },
    { key: 'youtube', label: 'Private YouTube', state: selectedUploaded ? 'uploaded' : publishing },
  ];
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

function PublishDiagnosticsCard({
  artifactData,
  errorDetails,
}: {
  artifactData: Record<string, unknown> | null | undefined;
  errorDetails?: Record<string, unknown> | null;
}) {
  const publishable = asRecord(artifactData?.publishableAssets);
  const checked = asRecord(publishable?.checked) ?? asRecord(errorDetails?.checked);
  const selectedSource = asRecord(publishable?.selectedSource) ?? asRecord(errorDetails?.selectedSource);
  const missing = Array.isArray(publishable?.missing)
    ? publishable.missing
    : Array.isArray(errorDetails?.missing)
      ? errorDetails.missing
      : [];

  return (
    <div className="publish-guard">
      <div><span>publish.json</span><strong>{checked?.publishJson ? 'present' : 'missing'}</strong></div>
      <div><span>videoKey</span><strong>{stringField(selectedSource, 'videoKey') ?? 'not resolved'}</strong></div>
      <div><span>thumbnailKey</span><strong>{stringField(selectedSource, 'thumbnailKey') ?? 'not resolved'}</strong></div>
      <div><span>missing</span><strong>{missing.length ? missing.join(', ') : 'none'}</strong></div>
    </div>
  );
}

function ScenePlanCard({
  artifactData,
}: {
  artifactData: Record<string, unknown> | null | undefined;
}) {
  const scenePlan = asRecord(artifactData?.scenePlan);
  const scenePlanKey = stringField(artifactData, 'scenePlanKey');
  const narrationScriptKey = stringField(artifactData, 'narrationScriptKey');
  const scenes = Array.isArray(scenePlan?.scenes) ? (scenePlan.scenes as unknown[]) : [];

  if (!scenePlanKey && !scenePlan) return null;

  return (
    <article className="card">
      <div className="card-title">Scene plan</div>
      <div className="aws-facts">
        <div><span>Scenes</span><strong>{scenes.length || '—'}</strong></div>
        <div><span>Provider</span><strong>{stringField(scenePlan, 'providerName') ?? 'deterministic-local'}</strong></div>
        <div><span>Scene plan</span><strong>{scenePlanKey ?? 'pending'}</strong></div>
        <div><span>Narration script</span><strong>{narrationScriptKey ?? 'not set'}</strong></div>
      </div>
      {scenes.slice(0, 2).map((scene, i) => {
        const s = asRecord(scene);
        return (
          <div key={i} className="compact-error">
            <strong>Scene {i + 1}</strong>
            <p>{stringField(s, 'visualPrompt') ?? '—'}</p>
          </div>
        );
      })}
    </article>
  );
}

function GenerationArtifactsCard({
  jobId,
  artifactData,
  generationMode,
}: {
  jobId: string | null;
  artifactData: Record<string, unknown> | null | undefined;
  generationMode: string | null;
}) {
  const scenePlanKey = stringField(artifactData, 'scenePlanKey');
  const narrationScriptKey = stringField(artifactData, 'narrationScriptKey');

  if (!scenePlanKey && !narrationScriptKey) return null;
  if (!jobId) return null;

  const bucket = 'prochat-video-dev-909439522876-eu-north-1-an';
  const region = 'eu-north-1';

  const scenePlanCmd = scenePlanKey
    ? `aws s3 cp "s3://${bucket}/${scenePlanKey}" - --region ${region} | jq`
    : null;
  const narrationScriptCmd = narrationScriptKey
    ? `aws s3 cp "s3://${bucket}/${narrationScriptKey}" - --region ${region}`
    : null;

  return (
    <article className="card">
      <div className="card-title">Generation artifacts</div>
      <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
        Copy commands to inspect hybrid-mode generated content:
      </p>
      {scenePlanCmd ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>Scene plan:</div>
          <code style={{ display: 'block', overflow: 'auto', color: '#0a0a0a' }}>{scenePlanCmd}</code>
        </div>
      ) : null}
      {narrationScriptCmd ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#333' }}>Narration script:</div>
          <code style={{ display: 'block', overflow: 'auto', color: '#0a0a0a' }}>{narrationScriptCmd}</code>
        </div>
      ) : null}
    </article>
  );
}

export function AwsVideoDashboard() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<AwsVideoView>('overview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('prochat');
  const [prompt, setPrompt] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [dryRunPassedForJobId, setDryRunPassedForJobId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string[]>([]);

  const addActivity = (message: string) => setActivity((items) => [`${new Date().toLocaleTimeString()} · ${message}`, ...items].slice(0, 14));
  const beginAction = () => setDismissedError(null);

  const status = useQuery({
    queryKey: ['aws-video-status'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/status', videoStatusSchema),
    refetchInterval: 10_000,
  });
  const jobs = useQuery({
    queryKey: ['aws-video-jobs'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/jobs/recent', recentVideoJobsSchema),
    refetchInterval: 15_000,
    retry: 1,
  });

  const jobList = jobs.data?.jobs ?? [];
  const jobsDiagnostics = jobs.data?.diagnostics ?? payloadDiagnostics(jobs.error);
  const selected = useMemo(() => jobList.find((job) => job.jobId === selectedJobId) ?? jobList[0] ?? null, [jobList, selectedJobId]);
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
      setActiveView('overview');
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
      requestedBy: 'brain-console-center',
    }, 1_900_000),
    onSuccess: async (result) => {
      addActivity(result.ok ? `Private YouTube upload completed for ${jobId}${result.videoId ? ` (${result.videoId})` : ''}` : `Private YouTube upload failed for ${jobId}`);
      await invalidateVideo();
    },
  });

  const selectedJob = job.data?.data ?? selected;
  const timelineEvents = timeline.data?.data.events ?? [];
  const artifactData = artifacts.data?.data ?? null;
  const executionData = execution.data?.data ?? null;
  const publishableAssets = asRecord(artifactData?.publishableAssets);
  const mediaSource = stringField(selectedJob, 'mediaSource') ?? stringField(artifactData, 'mediaSource') ?? 'unknown';
  const generationMode = stringField(selectedJob, 'generationMode') ?? stringField(artifactData, 'generationMode') ?? 'unknown';
  const videoSourceKey = stringField(selectedJob, 'videoSourceKey') ?? stringField(artifactData, 'videoSourceKey');
  const audioSourceKey = stringField(selectedJob, 'audioSourceKey') ?? stringField(artifactData, 'audioSourceKey');
  const isHybridMode = generationMode === 'hybrid_scene_plan_fixture_media';
  const isFixtureMedia = mediaSource === 'fixture' || mediaSource === 'hybrid' || generationMode === 'fixture_assembly' || generationMode === 'hybrid_scene_plan_fixture_media';
  const scenePlanKey = stringField(artifactData, 'scenePlanKey');
  const narrationScriptKey = stringField(artifactData, 'narrationScriptKey');
  const hasScenePlan = Boolean(scenePlanKey || asRecord(artifactData?.scenePlan));
  const finalVideoKey = stringField(artifactData, 'finalVideo') ?? stringField(publishableAssets, 'videoKey');
  const thumbnailKey = stringField(artifactData, 'thumbnail') ?? stringField(publishableAssets, 'thumbnailKey');
  const hasGeneratedAssets = Boolean(finalVideoKey && thumbnailKey);
  const awsSucceeded = stringField(executionData, 'awsStatus') === 'SUCCEEDED';
  const localGenerationComplete = nestedStatus(selectedJob?.generation) === 'complete';
  const publishStatus = nestedStatus(selectedJob?.publishing);
  const selectedReady = isReadyToPublish(selectedJob) || ((awsSucceeded || localGenerationComplete || hasGeneratedAssets) && hasGeneratedAssets);
  const selectedPublished = selectedJob?.status === 'published' || ['uploaded', 'published'].includes(publishStatus);
  const selectedUploaded = selectedPublished || ['uploaded', 'published'].includes(publishStatus);
  const selectedApprovalStatus = nestedStatus(selectedJob?.approval);
  const selectedGenerationStatus = nestedStatus(selectedJob?.generation);
  const canApprove = Boolean(jobId && selectedApprovalStatus !== 'approved' && !['generating', 'ready_to_publish', 'published'].includes(selectedJob?.status ?? ''));
  const canGenerate = Boolean(jobId && selectedApprovalStatus === 'approved' && ['approved', 'failed'].includes(selectedJob?.status ?? '') && selectedGenerationStatus !== 'complete' && !hasGeneratedAssets);
  const canDryRun = Boolean(jobId && selectedReady && !selectedUploaded && ['pending', 'not_available'].includes(publishStatus));
  const canPublish = canDryRun && dryRunPassedForJobId === jobId;
  const publishNeedsRepair = hasGeneratedAssets && selectedJob?.status === 'generating' && !stringField(publishableAssets, 'videoKey');
  const publishReadinessLabel = selectedUploaded
    ? 'Already uploaded'
    : canDryRun
      ? 'Ready for dry-run'
      : hasGeneratedAssets
        ? 'Generated assets available — publish contract repair needed'
        : 'Waiting for generated assets';
  const guideSteps = [
    { label: 'Draft', help: 'Create or select a job.', done: Boolean(selectedJob), active: Boolean(selectedJob && ['draft', 'awaiting_approval'].includes(selectedJob.status ?? '')) },
    { label: 'Approve', help: 'Approve the script.', done: selectedApprovalStatus === 'approved' || selectedReady || selectedPublished, active: canApprove },
    { label: 'Generate', help: 'Run AWS assembly.', done: selectedReady || selectedPublished, active: canGenerate || selectedJob?.status === 'generating' },
    { label: 'Dry-run', help: 'Validate YouTube upload.', done: dryRunPassedForJobId === jobId || selectedUploaded, active: selectedReady && dryRunPassedForJobId !== jobId && !selectedUploaded },
    { label: 'Private publish', help: 'Upload privately after dry-run.', done: selectedUploaded, active: canPublish },
  ];
  const nextStep = guideSteps.find((step) => !step.done);
  const queryError = jobs.error ?? status.error;
  const queryErrorMessage = errorMessage(queryError);
  const actionError = [approve.error, generate.error, requestChanges.error, youtubeDryRun.error, youtubePublish.error, createDraft.error].find(Boolean);
  const actionErrorMessage = errorMessage(actionError);
  const publishErrorDetails = payloadDetails(youtubeDryRun.error ?? youtubePublish.error);
  const visibleErrorMessage = queryErrorMessage ?? actionErrorMessage;
  const showErrorToast = Boolean(visibleErrorMessage && visibleErrorMessage !== dismissedError);

  const counts = {
    total: jobList.length,
    pending: jobList.filter((item) => ['awaiting_approval', 'approved', 'ready_to_publish'].includes(item.status ?? '')).length,
    active: jobList.filter((item) => ['generating', 'publishing'].includes(item.status ?? '')).length,
    published: jobList.filter((item) => item.status === 'published').length,
  };

  return (
    <div className="aws-video-screen">
      {showErrorToast && visibleErrorMessage ? (
        <div className="toast-stack" role="alert" aria-live="assertive">
          <div className="toast error-toast">
            <div>
              <strong>{queryErrorMessage ? 'Brain Core request failed' : 'Action failed'}</strong>
              <p>{visibleErrorMessage}</p>
            </div>
            <button aria-label="Dismiss error" onClick={() => setDismissedError(visibleErrorMessage)}>×</button>
          </div>
        </div>
      ) : null}
      <section className="aws-hero">
        <div className="min-w-0">
          <div className="eyebrow">AWS Video Pipeline</div>
          <h1>Video operations</h1>
          <p>Brain Console Center is the active dashboard. Follow the pipeline left to right: draft, approve, generate, dry-run, then private YouTube upload.</p>
        </div>
        <div className="aws-hero-actions">
          <StatusBadge status={status.isError || jobs.isError ? 'error' : 'fresh'} label={status.isError || jobs.isError ? 'partial error' : 'online'} />
          <button className="button secondary" onClick={() => void invalidateVideo()}><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="aws-metrics">
        <div><span>Runtime mode</span><strong>{stringField(status.data?.data, 'generationModeRuntime') ?? 'loading'}</strong></div>
        <div><span>Jobs</span><strong>{counts.total}</strong></div>
        <div><span>Pending</span><strong>{counts.pending}</strong></div>
        <div><span>Active</span><strong>{counts.active}</strong></div>
        <div><span>Published</span><strong>{counts.published}</strong></div>
        <div><span>Selected</span><strong>{selectedUploaded ? 'uploaded' : selectedJob?.status?.replaceAll('_', ' ') ?? 'none'}</strong></div>
      </section>

      <section className="pipeline-guide" aria-label="AWS Video pipeline guide">
        <div className="pipeline-next">
          <span>Next action</span>
          <strong>{nextStep ? nextStep.label : 'Complete'}</strong>
          <p>{nextStep ? nextStep.help : 'This job has completed the visible pipeline.'}</p>
        </div>
        <div className="pipeline-steps">
          {guideSteps.map((step, index) => (
            <div key={step.label} className={step.done ? 'done' : step.active ? 'active' : ''}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <p>{step.help}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="aws-workspace">
        <nav className="aws-subnav" aria-label="AWS Video subviews">
          {[
            ['overview', '1. Pipeline'],
            ['jobs', '2. Jobs'],
            ['create', '3. Create draft'],
            ['publish', '4. Publish'],
            ['activity', '5. Activity'],
          ].map(([view, label]) => (
            <button key={view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view as AwsVideoView)}>{label}</button>
          ))}
        </nav>

        <main className="aws-main-panel">
          {activeView === 'overview' ? (
            <div className="stack">
              <article className="card aws-selected-card">
                <div className="card-header compact-header">
                  <div className="min-w-0">
                    <div className="card-title">Selected job</div>
                    <div className="card-description truncate">{shortJobId(selectedJob?.jobId)}</div>
                  </div>
                  <StatusBadge status={selectedJob?.status} />
                </div>
                {selectedJob ? (
                  <>
                    {isHybridMode
                      ? <div className="compact-error">Hybrid mode: scene plan and narration script are prompt-derived; final audio/video media still uses fixtures.</div>
                      : isFixtureMedia
                        ? <div className="compact-error">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
                        : null}
                    <h2 className="aws-job-title">{selectedJob.title}</h2>
                    <div className="progress"><span style={{ width: `${pct(selectedJob.progress)}%` }} /></div>
                    <div className="aws-facts">
                      <div><span>Status</span><strong>{selectedJob.status ?? 'not available'}</strong></div>
                      <div><span>Progress</span><strong>{pct(selectedJob.progress)}%</strong></div>
                      <div><span>Approval</span><strong>{nestedStatus(selectedJob.approval)}</strong></div>
                      <div><span>Step</span><strong>{selectedJob.currentStep ?? 'not available'}</strong></div>
                      <div><span>Media source</span><strong>{mediaSource}</strong></div>
                      <div><span>Generation mode</span><strong>{generationMode}</strong></div>
                    </div>
                  </>
                ) : <p>Select or create a job to start.</p>}
              </article>

              <article className="card">
                <div className="card-title">Pipeline flow</div>
                <div className="pipeline-flow">
                  {pipelineSteps(selectedJob, selectedReady, selectedUploaded).map((step, index) => (
                    <div className="pipeline-step" key={step.key}>
                      <div className="pipeline-index">{index + 1}</div>
                      <div className="min-w-0">
                        <strong>{step.label}</strong>
                        <span>{step.state}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pipeline-actions">
                  <button className="button secondary" onClick={() => setActiveView('create')}><FilePlus2 size={16} /> Create draft</button>
                  <button className="button" disabled={!canApprove || approve.isPending} onClick={() => { beginAction(); approve.mutate(); }}><CheckCircle2 size={16} /> Approve</button>
                  <button className="button" disabled={!canGenerate || generate.isPending} onClick={() => { beginAction(); generate.mutate(); }}><Wand2 size={16} /> Generate</button>
                  <button className="button secondary" onClick={() => setActiveView('publish')}><Youtube size={16} /> Publish step</button>
                </div>
              </article>

              {hasScenePlan ? <ScenePlanCard artifactData={artifactData} /> : null}
              {isHybridMode ? <GenerationArtifactsCard jobId={jobId} artifactData={artifactData} generationMode={generationMode} /> : null}
            </div>
          ) : null}

          {activeView === 'jobs' ? (
            <article className="card">
              <div className="card-header"><div><div className="card-title">Recent jobs</div><div className="card-description">Select one job. Long IDs wrap; no horizontal scrolling.</div></div><StatusBadge status={jobs.isError ? 'error' : 'fresh'} /></div>
              <JobsDiagnosticsCard
                diagnostics={jobList.length === 0 || (jobsDiagnostics?.skippedJobCount ?? 0) > 0 || jobs.isError ? jobsDiagnostics : null}
                error={queryErrorMessage}
              />
              <div className="job-list">
                {jobList.map((item) => (
                  <button key={item.jobId} className={`job-list-item ${item.jobId === selectedJob?.jobId ? 'active' : ''}`} onClick={() => { setSelectedJobId(item.jobId); setActiveView('overview'); }}>
                    <div className="min-w-0"><strong>{item.title || item.jobId}</strong><span>{item.jobId} · {item.channelId}</span></div>
                    <StatusBadge status={item.status} />
                    <div className="job-progress"><div className="progress"><span style={{ width: `${pct(item.progress)}%` }} /></div><span>{pct(item.progress)}%</span></div>
                    <span className="meta no-margin">{item.updatedAt ? timeAgo(item.updatedAt) : 'unknown'}</span>
                  </button>
                ))}
                {jobList.length === 0 && !jobsDiagnostics?.localJobFolderCount && !jobsDiagnostics?.s3DiscoveredJobCount && !queryErrorMessage ? <p>No video jobs returned by Brain Core.</p> : null}
              </div>
            </article>
          ) : null}

          {activeView === 'create' ? (
            <article className="card aws-form-card">
              <div className="card-title">Create draft</div>
              <p>Start here when you want a new video. Draft creation does not publish or generate anything.</p>
              <div className="stack">
                <input className="input" placeholder="Channel id, for example prochat" value={channelId} onChange={(event) => setChannelId(event.target.value)} />
                <textarea className="textarea" placeholder="Draft prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                <button className="button" disabled={channelId.trim().length === 0 || prompt.trim().length < 10 || createDraft.isPending} onClick={() => { beginAction(); createDraft.mutate(); }}><FilePlus2 size={16} /> {createDraft.isPending ? 'Creating…' : 'Create draft'}</button>
              </div>
            </article>
          ) : null}

          {activeView === 'publish' ? (
            <article className="card publish-panel aws-publish-card">
              <div className="card-header compact-header">
                <div className="min-w-0"><div className="card-title">Controlled YouTube publish</div><div className="card-description">Private upload only. Dry-run must pass before upload is enabled.</div></div>
                <StatusBadge status={selectedPublished ? 'fresh' : selectedReady ? 'ready' : 'pending'} label={selectedPublished ? 'uploaded' : selectedReady ? 'ready' : 'not ready'} />
              </div>
              <div className="publish-guard">
                <div><span>Selected job</span><strong>{shortJobId(jobId ?? undefined)}</strong></div>
                <div><span>Required state</span><strong>{publishReadinessLabel}</strong></div>
                <div><span>Media source</span><strong>{mediaSource}</strong></div>
                <div><span>Dry-run</span><strong>{dryRunPassedForJobId === jobId ? 'passed' : 'required'}</strong></div>
              </div>
              {isHybridMode
                ? <div className="compact-error">Hybrid mode: prompt-derived scene plan exists, but final media still uses fixture audio/video.</div>
                : isFixtureMedia
                  ? <div className="compact-error">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
                  : null}
              <div className="publish-guard">
                <div><span>generationMode</span><strong>{generationMode}</strong></div>
                <div><span>videoSourceKey</span><strong>{videoSourceKey ?? 'unknown'}</strong></div>
                <div><span>audioSourceKey</span><strong>{audioSourceKey ?? 'unknown'}</strong></div>
              </div>
              <PublishDiagnosticsCard artifactData={artifactData} errorDetails={publishErrorDetails} />
              {!selectedReady ? <div className="compact-error">This job is not ready to publish. Complete approval and generation first.</div> : null}
              {publishNeedsRepair ? <div className="compact-error">Generated assets available — publish contract repair needed.</div> : null}
              {selectedPublished ? <div className="success-panel">This job is already uploaded to YouTube. Duplicate upload is blocked.</div> : null}
              <div className="pipeline-actions">
                <button className="button secondary" disabled={!canDryRun || youtubeDryRun.isPending || youtubePublish.isPending} onClick={() => youtubeDryRun.mutate()}>{youtubeDryRun.isPending ? 'Running dry-run…' : 'Dry-run YouTube publish'}</button>
                <button className="button danger-button" disabled={!canPublish || youtubePublish.isPending} onClick={() => youtubePublish.mutate()}>{youtubePublish.isPending ? 'Publishing privately…' : 'Publish privately'}</button>
              </div>
              <p className="meta no-margin">Private upload unlocks automatically after a successful dry-run for this selected job.</p>
              {youtubeDryRun.data ? <pre className="compact-pre">{JSON.stringify(youtubeDryRun.data, null, 2).slice(0, 1800)}</pre> : null}
              {youtubePublish.data ? <pre className="compact-pre">{JSON.stringify(youtubePublish.data, null, 2).slice(0, 1800)}</pre> : null}
            </article>
          ) : null}

          {activeView === 'activity' ? (
            <div className="grid split-panels">
              <article className="card"><div className="card-title">Timeline</div><div className="timeline">{timelineEvents.map((event, index) => <div className="timeline-item" key={`${event.step}-${index}`}><div className="split"><strong>{event.step}</strong><StatusBadge status={event.status} /></div><div className="meta">{event.timestamp ? timeAgo(event.timestamp) : 'unknown time'}</div><p>{event.message}</p></div>)}{timelineEvents.length === 0 ? <p>No timeline events.</p> : null}</div></article>
              <article className="card"><div className="card-title">Activity</div><div className="stack">{activity.map((item) => <div className="meta no-margin" key={item}>{item}</div>)}{activity.length === 0 ? <p>No local dashboard activity yet.</p> : null}</div></article>
            </div>
          ) : null}
        </main>

        <aside className="aws-side-panel">
          <article className="card"><div className="card-title">Execution</div><pre className="compact-pre">{JSON.stringify(execution.data?.data ?? {}, null, 2).slice(0, 1600)}</pre></article>
          <article className="card"><div className="card-title">Artifacts</div><pre className="compact-pre">{JSON.stringify(artifacts.data?.data ?? {}, null, 2).slice(0, 1600)}</pre></article>
          <article className="card"><div className="card-title">Request changes</div><textarea className="textarea compact-textarea" placeholder="Requested changes" value={changeRequest} onChange={(event) => setChangeRequest(event.target.value)} /><button className="button secondary full-width" disabled={!jobId || changeRequest.trim().length < 4 || requestChanges.isPending} onClick={() => requestChanges.mutate()}>Request changes</button></article>
        </aside>
      </section>

    </div>
  );
}
