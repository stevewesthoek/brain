'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function stringField(obj: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!obj) return null;
  const val = obj[key];
  return typeof val === 'string' ? val : null;
}

function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m/g, '');
}

function shortJobId(jobId: string | undefined): string {
  if (!jobId) return 'No job selected';
  return jobId.length > 48 ? `${jobId.slice(0, 30)}…${jobId.slice(-12)}` : jobId;
}

interface ActionState {
  dryRunPassed?: boolean;
  uploadStartedAt?: string;
  uploaded?: boolean;
  videoId?: string;
  url?: string;
  lastAction?: 'dry-run-passed' | 'uploaded' | 'already-uploaded' | 'duplicate-blocked';
  lastActionAt?: string;
}

export interface AwsVideoPublishDiagnosticsCardProps {
  jobId: string | null | undefined;
  mediaSource: string;
  generationMode: string;
  reviewStatus: string;
  isPublishingThisJob: boolean;
  selectedPublished: boolean;
  selectedReady: boolean;
  dryRunPassedForThisJob: boolean;
  dryRunRunning: boolean;
  dryRunFailed: boolean;
  canDryRun: boolean;
  canPublish: boolean;
  publishReadinessLabel: string;
  requiresReviewGate: boolean;
  reviewApproved: boolean;
  quotaExceeded: boolean;
  finalVideoAvailable: boolean;
  anyPendingTimeout: boolean;
  imageProvider: string | null | undefined;
  isHybridMode: boolean;
  isHybridTTSMode: boolean;
  isHybridStoryboardMode: boolean;
  isHybridSlideshowMode: boolean;
  isHybridImageSlideshowMode: boolean;
  isFixtureMedia: boolean;
  cpArtifactsVideoKey: string | null | undefined;
  cpArtifactsAudioKey: string | null | undefined;
  cpFinalizationPending: boolean;
  artifactData: Record<string, unknown> | null | undefined;
  publishErrorDetails: Record<string, unknown> | null | undefined;
  cpVideoKey: string | null | undefined;
  cpThumbnailKey: string | null | undefined;
  cpPublishKey: string | null | undefined;
  recommendedStepKey: string | null | undefined;
  cpPublishVideoId: string | null | undefined;
  cpPublishUrl: string | null | undefined;
  dryRunResult?: Record<string, unknown> | null;
  uploadResult?: Record<string, unknown> | null;
  actionState?: ActionState;
  onDryRun: () => void;
  onPublish: () => void;
  onDownload: () => void;
  isDryRunPending: boolean;
  isPublishPending: boolean;
}

function PublishDiagnosticsInner({
  artifactData,
  errorDetails,
  cpVideoKey,
  cpThumbnailKey,
  cpPublishKey,
}: {
  artifactData: Record<string, unknown> | null | undefined;
  errorDetails?: Record<string, unknown> | null;
  cpVideoKey?: string | null;
  cpThumbnailKey?: string | null;
  cpPublishKey?: string | null;
}) {
  const publishable = asRecord(artifactData?.publishableAssets);
  const checked = asRecord(publishable?.checked) ?? asRecord(errorDetails?.checked);
  const selectedSource = asRecord(publishable?.selectedSource) ?? asRecord(errorDetails?.selectedSource);
  const missing = Array.isArray(publishable?.missing)
    ? publishable.missing
    : Array.isArray(errorDetails?.missing)
      ? errorDetails.missing
      : [];

  const resolvedVideoKey = cpVideoKey ?? stringField(selectedSource, 'videoKey');
  const resolvedThumbnailKey = cpThumbnailKey ?? stringField(selectedSource, 'thumbnailKey');
  const hasPublishJson = cpPublishKey ? true : (checked?.publishJson ? true : false);

  return (
    <div className="publish-guard">
      <div><span>publish.json</span><strong>{hasPublishJson ? 'present' : 'missing'}</strong></div>
      <div><span>videoKey</span><strong>{resolvedVideoKey ?? 'not resolved'}</strong></div>
      <div><span>thumbnailKey</span><strong>{resolvedThumbnailKey ?? 'not resolved'}</strong></div>
      <div><span>missing</span><strong>{missing.length ? missing.join(', ') : 'none'}</strong></div>
    </div>
  );
}

function CompactPublishResult({
  dryRunResult,
  uploadResult,
  actionState,
  isPublishing,
}: {
  dryRunResult?: Record<string, unknown> | null;
  uploadResult?: Record<string, unknown> | null;
  actionState?: ActionState;
  isPublishing?: boolean;
}) {
  if (!dryRunResult && !uploadResult && !actionState?.uploaded) return null;

  const dryRunOk = dryRunResult?.ok === true;
  const uploadOk = uploadResult?.ok === true;
  const videoId = stringField(uploadResult, 'videoId') ?? actionState?.videoId;
  const url = stringField(uploadResult, 'url') ?? actionState?.url;
  const dryRunStdout = stringField(dryRunResult, 'stdout');
  const uploadStdout = stringField(uploadResult, 'stdout');
  const hasLogs = dryRunStdout || uploadStdout;

  return (
    <details style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '0.5rem' }}>
        {isPublishing ? '⏳ Uploading...' : uploadOk ? '✅ Upload success' : dryRunOk ? '✅ Dry-run passed' : '⚠️ Publish details'}
      </summary>
      <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--body)' }}>
        {dryRunOk ? <div style={{ marginBottom: '0.5rem' }}><strong>Dry-run:</strong> passed</div> : null}
        {uploadOk || actionState?.uploaded ? (
          <>
            <div style={{ marginBottom: '0.5rem' }}><strong>Upload:</strong> {actionState?.lastAction === 'already-uploaded' ? 'already uploaded' : 'uploaded'}</div>
            {videoId ? <div style={{ marginBottom: '0.5rem', wordBreak: 'break-all' }}><strong>Video ID:</strong> {videoId}</div> : null}
            {url ? <div style={{ marginBottom: '0.5rem' }}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></div> : null}
          </>
        ) : null}
        {isPublishing ? <div style={{ marginBottom: '0.5rem', color: 'var(--badge-success-text)' }}><strong>Status:</strong> Publishing privately...</div> : null}
      </div>
      {hasLogs ? (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Show logs</summary>
          <pre style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '2px',
            fontSize: '0.75rem',
            overflow: 'auto',
            maxHeight: '200px',
            color: 'var(--code-fg)',
          }}>
            {stripAnsiCodes(uploadStdout ?? dryRunStdout ?? 'No logs')}
          </pre>
        </details>
      ) : null}
    </details>
  );
}

export function AwsVideoPublishDiagnosticsCard({
  jobId,
  mediaSource,
  generationMode,
  reviewStatus,
  isPublishingThisJob,
  selectedPublished,
  selectedReady,
  dryRunPassedForThisJob,
  dryRunRunning,
  dryRunFailed,
  canDryRun,
  canPublish,
  publishReadinessLabel,
  requiresReviewGate,
  reviewApproved,
  quotaExceeded,
  finalVideoAvailable,
  anyPendingTimeout,
  imageProvider,
  isHybridMode,
  isHybridTTSMode,
  isHybridStoryboardMode,
  isHybridSlideshowMode,
  isHybridImageSlideshowMode,
  isFixtureMedia,
  cpArtifactsVideoKey,
  cpArtifactsAudioKey,
  cpFinalizationPending,
  artifactData,
  publishErrorDetails,
  cpVideoKey,
  cpThumbnailKey,
  cpPublishKey,
  cpPublishVideoId,
  cpPublishUrl,
  recommendedStepKey,
  dryRunResult,
  uploadResult,
  actionState,
  onDryRun,
  onPublish,
  onDownload,
  isDryRunPending,
  isPublishPending,
}: AwsVideoPublishDiagnosticsCardProps) {
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  // Reset confirmation when the selected job changes
  useEffect(() => { setConfirmingPublish(false); }, [jobId]);

  const publishDisabled = !canPublish || isPublishingThisJob || quotaExceeded || anyPendingTimeout;

  const handlePublishClick = () => {
    if (publishDisabled) return;
    if (!confirmingPublish) {
      setConfirmingPublish(true);
      return;
    }
    setConfirmingPublish(false);
    onPublish();
  };

  const handlePublishCancel = () => setConfirmingPublish(false);

  return (
    <article className="card publish-panel aws-publish-card">
      <div className="card-header compact-header">
        <div className="min-w-0">
          <div className="card-title">Controlled YouTube publish</div>
          <div className="card-description">Private upload only. Dry-run must pass before upload is enabled.</div>
        </div>
        <StatusBadge
          status={isPublishingThisJob ? 'pending' : selectedPublished ? 'fresh' : selectedReady ? 'ready' : 'pending'}
          label={isPublishingThisJob ? 'publishing' : selectedPublished ? 'uploaded' : selectedReady ? 'ready' : 'not ready'}
        />
      </div>
      <div className="publish-guard">
        <div><span>Selected job</span><strong>{shortJobId(jobId ?? undefined)}</strong></div>
        <div><span>Required state</span><strong>{publishReadinessLabel}</strong></div>
        <div><span>Media source</span><strong>{mediaSource}</strong></div>
        <div><span>Dry-run</span><strong>{dryRunRunning ? 'running' : dryRunFailed ? 'failed' : dryRunPassedForThisJob ? 'passed' : 'pending'}</strong></div>
        <div><span>Review</span><strong>{reviewStatus}</strong></div>
      </div>
      {requiresReviewGate && !reviewApproved ? <div className="compact-warning">Review gate is enforced for generated media. Dry-run and private publish stay disabled until review is approved.</div> : null}
      {quotaExceeded ? <div className="compact-warning">YouTube upload quota reached. The video is ready; download the MP4 or try private publish again after quota resets.</div> : null}
      {reviewApproved && requiresReviewGate ? <div className="success-panel">Review approved. Dry-run is now enabled.</div> : null}
      {dryRunRunning ? <div className="compact-info">Dry-run is running... Page refresh is safe; state persists in publish-check.json.</div> : null}
      {dryRunFailed ? <div className="compact-error">Dry-run failed. Check logs below or re-run.</div> : null}
      {isHybridImageSlideshowMode
        ? <div className="compact-info">Generated image slideshow: scene images are generated by {imageProvider ?? 'the configured image provider'}; final video is assembled as a slideshow.</div>
        : isHybridSlideshowMode
        ? <div className="compact-info">Slideshow mode: prompt-derived storyboard images and narration audio are assembled into the final MP4.</div>
        : isHybridStoryboardMode
          ? <div className="compact-info">Hybrid Storyboard mode: prompt-derived scene plan, narration script, and scene images exist; narration audio is TTS-generated; video still uses fixtures.</div>
          : isHybridTTSMode
            ? <div className="compact-info">Hybrid TTS mode: prompt-derived scene plan and narration script exist; narration audio is TTS-generated; video still uses fixtures.</div>
            : isHybridMode
              ? <div className="compact-info">Hybrid mode: prompt-derived scene plan exists, but final media still uses fixture audio/video.</div>
              : isFixtureMedia
                ? <div className="compact-info">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
                : null}
      <div className="publish-guard">
        <div><span>generationMode</span><strong>{generationMode}</strong></div>
        <div><span>videoKey</span><strong>{cpArtifactsVideoKey ?? 'unknown'}</strong></div>
        <div><span>audioKey</span><strong>{cpArtifactsAudioKey ?? 'unknown'}</strong></div>
      </div>
      <PublishDiagnosticsInner
        artifactData={artifactData}
        errorDetails={publishErrorDetails}
        cpVideoKey={cpVideoKey}
        cpThumbnailKey={cpThumbnailKey}
        cpPublishKey={cpPublishKey}
      />
      {!selectedReady ? anyPendingTimeout ? <div className="compact-info">Waiting for job state… Action is still processing in Brain Core. Refresh is safe.</div> : <div className="compact-warning">This job is not ready to publish. Complete approval and generation first.</div> : null}
      {cpFinalizationPending ? <div className="compact-warning">Finalizing publish package…</div> : null}
      {selectedPublished && !isPublishingThisJob ? (
        <div className="success-panel">
          <div>Uploaded to YouTube — duplicate upload is blocked.</div>
          {(cpPublishVideoId ?? actionState?.videoId) ? (
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
              <strong>Video ID:</strong> {cpPublishVideoId ?? actionState?.videoId}
            </div>
          ) : null}
          {(cpPublishUrl ?? actionState?.url) ? (
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
              <a href={cpPublishUrl ?? actionState?.url} target="_blank" rel="noopener noreferrer">{cpPublishUrl ?? actionState?.url}</a>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="pipeline-actions">
        <button
          className={recommendedStepKey === 'dry-run' ? 'button next-action' : 'button secondary'}
          disabled={!canDryRun || isDryRunPending || isPublishingThisJob || anyPendingTimeout}
          onClick={onDryRun}
        >
          {isDryRunPending ? 'Running dry-run…' : 'Dry-run YouTube publish'}
        </button>
        {confirmingPublish ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--foreground)' }}>This will upload the video to YouTube as private. Continue?</span>
            <button
              className="button danger-button"
              disabled={publishDisabled}
              onClick={handlePublishClick}
            >
              Yes, publish privately
            </button>
            <button className="button secondary" onClick={handlePublishCancel}>Cancel</button>
          </div>
        ) : (
          <button
            className={recommendedStepKey === 'publish' ? 'button next-action' : 'button danger-button'}
            disabled={publishDisabled}
            onClick={handlePublishClick}
          >
            {isPublishPending ? 'Publishing privately…' : 'Publish privately'}
          </button>
        )}
        {finalVideoAvailable ? (
          <button className="button secondary" onClick={onDownload}>Download final MP4</button>
        ) : null}
      </div>
      <p className="meta no-margin">
        {requiresReviewGate
          ? 'Review approval is required before dry-run or private upload.'
          : 'Private upload unlocks automatically after a successful dry-run for this selected job.'}
      </p>
      {finalVideoAvailable ? <p className="meta no-margin">Use this when YouTube upload quota is reached or to inspect video quality locally.</p> : null}
      <CompactPublishResult
        dryRunResult={dryRunResult}
        uploadResult={uploadResult}
        actionState={actionState}
        isPublishing={isPublishingThisJob}
      />
    </article>
  );
}
