'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FilePlus2, RefreshCw, Wand2, Youtube } from 'lucide-react';
import { BRAIN_CORE_URL, BrainCoreError, brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import { recentVideoJobsSchema, videoActionResultSchema, videoArtifactsResponseSchema, videoExecutionResponseSchema, videoJobResponseSchema, videoReviewSchema, videoStatusSchema, videoTimelineResponseSchema, youtubePublishResultSchema, videoControlPlaneSchema, type VideoJob, type VideoJobsDiagnostics, type VideoReview, type VideoControlPlaneData } from '@/lib/braincore-schemas';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { useAwsVideoSelection } from '@/components/aws-video/use-aws-video-selection';

const GENERATE_TIMEOUT_MS = 120_000;
type AwsVideoView = 'overview' | 'jobs' | 'create' | 'review' | 'publish' | 'activity';

// Action state per job: tracks dry-run pass, upload status, mutation in-flight
interface ActionState {
  dryRunPassed?: boolean;
  uploadStartedAt?: string;
  uploaded?: boolean;
  videoId?: string;
  url?: string;
  lastAction?: 'dry-run-passed' | 'uploaded' | 'already-uploaded' | 'duplicate-blocked';
  lastActionAt?: string;
}

// Pending action after timeout: job is still processing in brain core
type PendingAction = 'approve_script' | 'generate' | 'approve_review' | 'dry_run' | 'publish';

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

function containsInternalOverlayTerms(value: unknown): boolean {
  if (typeof value === 'string') return /\b(AWS|Bedrock|Nova|Polly|FFmpeg|pipeline|fixture)\b/i.test(value);
  if (Array.isArray(value)) return value.some((item) => containsInternalOverlayTerms(item));
  const record = asRecord(value);
  return record ? Object.values(record).some((item) => containsInternalOverlayTerms(item)) : false;
}


function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isTimeoutError(error: unknown): boolean {
  const message = errorMessage(error);
  return Boolean(message && /timed out/i.test(message));
}

function actionErrorSummary(error: unknown): string | null {
  const message = errorMessage(error);
  if (!message) return null;
  const lower = message.toLowerCase();
  const prefix = lower.includes('generate') || lower.includes('generation') || lower.includes('slideshow') || lower.includes('ffmpeg')
    ? 'Generation failed'
    : lower.includes('dry-run')
      ? 'Dry-run failed'
      : lower.includes('publish') || lower.includes('upload')
        ? 'Publish failed'
        : 'Action failed';

  if (lower.includes('drawtext')) return `${prefix}: FFmpeg drawtext unavailable`;
  if (lower.includes('ffmpeg')) return `${prefix}: FFmpeg unavailable`;
  if (lower.includes('overlay')) return `${prefix}: overlay rendering failed`;

  const firstLine = message.split('\n')[0]?.trim() ?? message;
  const compact = firstLine.replace(/\s+/g, ' ').slice(0, 140);
  return compact.length < firstLine.length ? `${prefix}: ${compact}...` : `${prefix}: ${compact}`;
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

function isQuotaExceededResult(error: unknown, result?: Record<string, unknown> | null): boolean {
  if (result?.code === 'youtube_quota_exceeded') return true;
  if (!(error instanceof BrainCoreError) || !error.payload || typeof error.payload !== 'object') return false;
  const payload = error.payload as Record<string, unknown>;
  return payload.code === 'youtube_quota_exceeded';
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
          <div key={i} className="compact-info">
            <strong>Scene {i + 1}</strong>
            <p>{stringField(s, 'visualPrompt') ?? '—'}</p>
          </div>
        );
      })}
    </article>
  );
}

function MotionCard({
  artifactData,
}: {
  artifactData: Record<string, unknown> | null | undefined;
}) {
  const motionPlan = asRecord(artifactData?.motionPlan);
  const motionPlanKey = stringField(artifactData, 'motionPlanKey');
  const motionProvider = stringField(artifactData, 'motionProvider');
  const motionMode = stringField(motionPlan, 'mode') ?? 'ken-burns';
  const motionClipKeys = Array.isArray(artifactData?.motionClipKeys) ? (artifactData.motionClipKeys as string[]) : [];
  const motionFrameKeys = Array.isArray(artifactData?.motionFrameKeys) ? (artifactData.motionFrameKeys as string[]) : [];
  const warnings = Array.isArray(motionPlan?.warnings) ? (motionPlan.warnings as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const fallbackUsed = artifactData?.motionFallbackUsed === true || motionPlan?.fallbackUsed === true;
  const fallbackReason = stringField(artifactData, 'motionFallbackReason') ?? stringField(motionPlan, 'fallbackReason');
  const motionGenerated = artifactData?.motionGenerated === true;

  if (!motionPlanKey && motionClipKeys.length === 0 && motionFrameKeys.length === 0 && !fallbackUsed && warnings.length === 0) return null;

  return (
    <article className="card">
      <div className="card-title">Motion</div>
      <div className="aws-facts">
        <div><span>Provider</span><strong>{motionProvider ?? 'local-ffmpeg-motion'}</strong></div>
        <div><span>Mode</span><strong>{motionMode}</strong></div>
        <div><span>Generated</span><strong>{motionGenerated ? 'true' : 'false'}</strong></div>
        <div><span>Clips</span><strong>{motionClipKeys.length}</strong></div>
        <div><span>Frames</span><strong>{motionFrameKeys.length}</strong></div>
        <div><span>Fallback</span><strong>{fallbackUsed ? 'used' : 'not used'}</strong></div>
        <div><span>Plan</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{motionPlanKey ?? 'missing'}</strong></div>
      </div>
      {fallbackReason ? <div className="compact-warning" style={{ marginTop: '0.75rem' }}>{fallbackReason}</div> : null}
      {warnings.length > 0 ? (
        <div className="compact-info" style={{ marginTop: '0.75rem' }}>
          <strong>Warnings</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', paddingLeft: 0 }}>
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function stripAnsiCodes(text: string): string {
  // Remove ANSI escape codes like \x1b[32m, [1m, etc.
  return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m/g, '');
}

function downloadFinalVideo(jobId: string): void {
  window.open(`${BRAIN_CORE_URL}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/video`, '_blank', 'noopener,noreferrer');
}

function CompactPublishResultCard({
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

function StoryboardCard({
  artifactData,
}: {
  artifactData: Record<string, unknown> | null | undefined;
}) {
  const storyboardKey = stringField(artifactData, 'storyboardKey');
  const imageGenerationKey = stringField(artifactData, 'imageGenerationKey');
  const sceneImageKeys = Array.isArray(artifactData?.sceneImageKeys) ? (artifactData?.sceneImageKeys as string[]) : [];
  const imageProvider = stringField(artifactData, 'imageProvider');
  const imageModelId = stringField(artifactData, 'imageModelId');
  const imageRegion = stringField(artifactData, 'imageRegion');
  const imageGeneration = asRecord(artifactData?.imageGeneration);
  const imageGenerationSettings = asRecord(imageGeneration?.settings);
  const promptHashes = Array.isArray(imageGeneration?.promptHashes) ? (imageGeneration?.promptHashes as string[]) : [];
  const sceneAuditSummaries = Array.isArray(asRecord(artifactData?.storyboard)?.scenes)
    ? (asRecord(artifactData?.storyboard)?.scenes as Array<Record<string, unknown>>)
    : [];

  if (!storyboardKey && sceneImageKeys.length === 0 && !imageGenerationKey) return null;

  return (
    <article className="card">
      <div className="card-title">Storyboard</div>
      <div className="aws-facts">
        <div><span>Provider</span><strong>{imageProvider ?? 'unknown'}</strong></div>
        {imageModelId ? <div><span>Image model</span><strong>{imageModelId}</strong></div> : null}
        {imageRegion ? <div><span>Region</span><strong>{imageRegion}</strong></div> : null}
        <div><span>Scene images</span><strong>{sceneImageKeys.length || '0'}</strong></div>
        <div><span>Storyboard manifest</span><strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{storyboardKey ?? 'pending'}</strong></div>
        {imageGenerationKey ? <div><span>Image generation</span><strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{imageGenerationKey}</strong></div> : null}
      </div>
      {imageGeneration ? (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div className="card-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Image generation</div>
          <div className="aws-facts">
            <div><span>Count</span><strong>{String(imageGeneration?.sceneCount ?? sceneImageKeys.length)}</strong></div>
            <div><span>Prompt hashes</span><strong>{promptHashes.length}</strong></div>
            <div><span>Width</span><strong>{String(imageGenerationSettings?.width ?? 'unknown')}</strong></div>
            <div><span>Height</span><strong>{String(imageGenerationSettings?.height ?? 'unknown')}</strong></div>
          </div>
          <div className="aws-facts" style={{ marginTop: '0.75rem' }}>
            <div><span>Model</span><strong>{stringField(imageGeneration, 'modelId') ?? 'unknown'}</strong></div>
            <div><span>Region</span><strong>{stringField(imageGeneration, 'region') ?? 'unknown'}</strong></div>
            <div><span>Provider</span><strong>{stringField(imageGeneration, 'provider') ?? 'unknown'}</strong></div>
          </div>
          <details style={{ marginTop: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Show prompt audit</summary>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sceneAuditSummaries.slice(0, 3).map((scene, index) => (
                <details key={`${index}-${String(scene.index ?? index)}`} style={{ padding: '0.75rem', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--foreground)' }}>Scene {String(scene.index ?? index + 1)} audit</summary>
                  <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div><span>finalImagePrompt</span><strong style={{ display: 'block', wordBreak: 'break-word' }}>{stringField(scene, 'finalImagePrompt') ?? 'unknown'}</strong></div>
                    <div><span>promptHash</span><strong>{stringField(scene, 'promptHash') ?? 'unknown'}</strong></div>
                    <div><span>imageKey</span><strong style={{ display: 'block', wordBreak: 'break-all' }}>{stringField(scene, 'imageKey') ?? 'unknown'}</strong></div>
                    <div><span>generatedAt</span><strong>{stringField(scene, 'generatedAt') ?? 'unknown'}</strong></div>
                  </div>
                </details>
              ))}
            </div>
          </details>
        </div>
      ) : null}
      {sceneImageKeys.length > 0 ? (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem' }}>Scene images:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sceneImageKeys.slice(0, 3).map((key, i) => (
              <code key={i} style={{ fontSize: '0.8rem', wordBreak: 'break-all', padding: '0.5rem', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--code-fg)' }}>
                {key}
              </code>
            ))}
            {sceneImageKeys.length > 3 ? <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>… and {sceneImageKeys.length - 3} more</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function TTSAudioCard({
  artifactData,
}: {
  artifactData: Record<string, unknown> | null | undefined;
}) {
  const audioProvider = stringField(artifactData, 'audioProvider');
  const voiceId = stringField(artifactData, 'voiceId');
  const audioKey = stringField(artifactData, 'audioKey');

  if (!audioProvider && !voiceId) return null;

  return (
    <article className="card">
      <div className="card-title">Narration audio (TTS)</div>
      <div className="aws-facts">
        <div><span>Provider</span><strong>{audioProvider ?? 'unknown'}</strong></div>
        <div><span>Voice</span><strong>{voiceId ?? 'default'}</strong></div>
        <div><span>Audio key</span><strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{audioKey ?? 'pending'}</strong></div>
      </div>
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
      <p style={{ fontSize: '0.875rem', color: 'var(--body)', marginBottom: '1rem' }}>
        Copy commands to inspect hybrid-mode generated content:
      </p>
      {scenePlanCmd ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--foreground)' }}>Scene plan:</div>
          <code style={{ display: 'block', overflow: 'auto', color: 'var(--code-fg)' }}>{scenePlanCmd}</code>
        </div>
      ) : null}
      {narrationScriptCmd ? (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--foreground)' }}>Narration script:</div>
          <code style={{ display: 'block', overflow: 'auto', color: 'var(--code-fg)' }}>{narrationScriptCmd}</code>
        </div>
      ) : null}
    </article>
  );
}

function ReviewCard({
  jobId,
  reviewData,
  artifactData,
  approvePending,
  requestChangesPending,
  onApprove,
  onRequestChanges,
  notes,
  setNotes,
  isRecommended,
  finalizationState,
  isPendingTimeout,
  controlPlaneData,
}: {
  jobId: string | null;
  reviewData: VideoReview | null;
  artifactData: Record<string, unknown> | null | undefined;
  approvePending: boolean;
  requestChangesPending: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  notes: string;
  setNotes: (value: string) => void;
  isRecommended?: boolean;
  finalizationState?: 'not_required' | 'pending' | 'failed' | 'complete' | null;
  isPendingTimeout?: boolean;
  controlPlaneData?: Record<string, unknown> | null;
}) {
  if (!jobId) return null;

  // Extract control-plane review media as canonical source.
  // NOTE: controlPlaneData is ALREADY the normalized payload (inner data object).
  // Do not double-wrap; access directly.
  const controlPlaneReviewMedia = controlPlaneData
    ? (() => {
        const cpRecord = asRecord(controlPlaneData);
        const cpReview = cpRecord?.review ? asRecord(cpRecord.review) : null;
        return cpReview?.media as Partial<VideoReview['media']> | null | undefined;
      })()
    : null;

  // Log dev warning if falling back to legacy data when control-plane exists
  if (controlPlaneData && !controlPlaneReviewMedia && process.env.NODE_ENV === 'development') {
    console.warn('[ReviewCard] Control-plane exists but review.media is null; falling back to legacy review/artifact data');
  }

  // Control-plane is ALWAYS canonical when available. Never reconstruct from legacy sources.
  const reviewMedia = controlPlaneReviewMedia ?? null;

  const artifactRecord: Record<string, unknown> = artifactData ?? {};
  const publishableAssets = asRecord(artifactRecord.publishableAssets);

  // For thumbnail + YouTube metadata details, still use legacy artifact data
  // (ReviewCard renders these from artifactData for display purposes only)
  // But these DO NOT drive missing field logic.
  const imageKeys = reviewMedia?.sceneImageKeys ?? [];
  const bucket = 'prochat-video-dev-909439522876-eu-north-1-an';
  const region = 'eu-north-1';
  const s3Command = (key: string | null, label: string) => key
    ? `aws s3 cp "s3://${bucket}/${key}" - --region ${region}`
    : `# ${label} not available`;

  // Compute missing media fields using ONLY control-plane review media (canonical).
  // If control-plane is unavailable, reportmissing media without fallback reconstruction.
  const requiredMediaFields = [
    { key: 'scenePlanKey', label: 'Scene plan' },
    { key: 'narrationScriptKey', label: 'Narration script' },
    { key: 'audioKey', label: 'Narration audio' },
    { key: 'videoKey', label: 'Final MP4' },
    { key: 'thumbnailKey', label: 'Thumbnail' },
    { key: 'publishKey', label: 'Publish JSON' },
    { key: 'youtubePackageKey', label: 'YouTube package' },
  ] as const;

  const missingReviewMediaFields = reviewMedia
    ? requiredMediaFields.filter(field => !reviewMedia[field.key])
    : [];
  // Media is complete when control-plane review.media has all required fields (no sceneImageKeys requirement)
  const mediaComplete = reviewMedia ? missingReviewMediaFields.length === 0 : false;

  // Extract YouTube package metadata from artifacts
  const youtubePackage = asRecord(artifactRecord.youtubePackage) ?? null;
  const youtubePackageQuality = youtubePackage ? asRecord(youtubePackage.metadataQuality) : null;
  const youtubePackageMetadata: {
    title: string | null;
    description: string | null;
    tags: string[];
    quality: {
      titleLength: number;
      tagCount: number;
      descriptionLength: number;
      hasInternalTerms: boolean;
      warnings: string[];
    } | null;
  } | null = youtubePackage
    ? {
        title: stringField(youtubePackage, 'title'),
        description: stringField(youtubePackage, 'description'),
        tags: Array.isArray(youtubePackage.tags) ? (youtubePackage.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
        quality: youtubePackageQuality
          ? {
              titleLength: typeof youtubePackageQuality.titleLength === 'number' ? youtubePackageQuality.titleLength : 0,
              tagCount: typeof youtubePackageQuality.tagCount === 'number' ? youtubePackageQuality.tagCount : 0,
              descriptionLength: typeof youtubePackageQuality.descriptionLength === 'number' ? youtubePackageQuality.descriptionLength : 0,
              hasInternalTerms: youtubePackageQuality.hasInternalTerms === true,
              warnings: Array.isArray(youtubePackageQuality.warnings) ? (youtubePackageQuality.warnings as unknown[]).filter((w): w is string => typeof w === 'string') : [],
            }
          : null,
      }
    : null;

  const hasInternalTermsInMetadata = youtubePackageMetadata?.quality?.hasInternalTerms === true;
  const metadataWarnings = youtubePackageMetadata?.quality?.warnings ?? [];
  const overlayPlan = asRecord(artifactRecord.overlayPlan);
  const overlayCards = Array.isArray(overlayPlan?.cards) ? (overlayPlan.cards as unknown[]).map(asRecord).filter((card): card is Record<string, unknown> => Boolean(card)) : [];
  const overlayWarnings = Array.isArray(overlayPlan?.warnings) ? (overlayPlan.warnings as unknown[]).filter((warning): warning is string => typeof warning === 'string') : [];
  const requiresOverlayPlan = stringField(artifactRecord, 'generationMode') === 'hybrid_image_slideshow_video';
  const overlayMissing = requiresOverlayPlan && !overlayPlan && !reviewMedia?.overlayPlanKey;
  const overlayHasInternalTerms = requiresOverlayPlan && containsInternalOverlayTerms(overlayPlan);
  const overlayBlocksApproval = overlayMissing || overlayHasInternalTerms;

  return (
    <article className="card">
      <div className="card-title">Review</div>
      {reviewMedia?.thumbnailKey && (
        <details open style={{ marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>Thumbnail preview</summary>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--card)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>
              <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{reviewMedia.thumbnailKey}</code>
            </div>
            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
              <img
                src={`${BRAIN_CORE_URL}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/thumbnail?ts=${encodeURIComponent(reviewData?.updatedAt ?? reviewMedia.thumbnailKey ?? '')}`}
                alt={`Generated thumbnail: ${reviewMedia.thumbnailKey}`}
                style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px', border: '1px solid var(--border)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }}
              />
              <div hidden style={{ padding: '0.75rem', backgroundColor: 'var(--muted)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                Thumbnail not available locally. Use the terminal command below to preview from S3.
              </div>
            </div>
            <button
              className="button small"
              onClick={() => {
                const cmd = `aws s3 cp "s3://${bucket}/${reviewMedia.thumbnailKey}" - --region ${region} | open -a Preview -f`;
                navigator.clipboard.writeText(cmd);
                alert('Copy command to preview thumbnail:\n' + cmd);
              }}
              style={{ marginBottom: '0.5rem' }}
            >
              Copy preview command
            </button>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              Use this command in terminal to preview the thumbnail in your Mac Preview app.
            </div>
          </div>
        </details>
      )}
      {reviewMedia?.videoKey ? (
        <div style={{ marginBottom: '1rem' }}>
          <button className="button secondary" onClick={() => downloadFinalVideo(jobId)}>
            Download final MP4
          </button>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.35rem' }}>
            Use this when YouTube upload quota is reached or to inspect video quality locally.
          </div>
        </div>
      ) : null}
      {youtubePackageMetadata && (
        <details open style={{ marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>YouTube metadata</summary>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--card)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div className="aws-facts" style={{ marginBottom: '0.75rem' }}>
              <div><span>Title</span><strong style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{youtubePackageMetadata.title ?? 'missing'}</strong></div>
              <div><span>Title length</span><strong>{youtubePackageMetadata.quality ? youtubePackageMetadata.quality.titleLength : 0} chars (target: ≤80)</strong></div>
              <div><span>Tags</span><strong>{youtubePackageMetadata.quality ? youtubePackageMetadata.quality.tagCount : 0} (target: 8–15)</strong></div>
              <div><span>Description length</span><strong>{youtubePackageMetadata.quality ? youtubePackageMetadata.quality.descriptionLength : 0} chars (target: ≤1000)</strong></div>
            </div>
            {youtubePackageMetadata.description && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: 'var(--code-bg)', borderRadius: '3px', border: '1px solid var(--border)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                <strong>Description:</strong>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--body)' }}>{youtubePackageMetadata.description}</p>
              </div>
            )}
            {youtubePackageMetadata.tags.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Tags:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {youtubePackageMetadata.tags.map(tag => (
                    <span key={tag} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--border)', borderRadius: '3px', fontSize: '0.8rem' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {metadataWarnings.length > 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--badge-warning-text)', padding: '0.5rem', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '3px' }}>
                <strong>Quality warnings:</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', paddingLeft: 0 }}>
                  {metadataWarnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
      {requiresOverlayPlan ? (
        <details open style={{ marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>Overlay plan</summary>
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--card)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div className="aws-facts" style={{ marginBottom: '0.75rem' }}>
              <div><span>Title</span><strong style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{stringField(overlayPlan, 'title') ?? 'missing'}</strong></div>
              <div><span>Provider</span><strong>{stringField(overlayPlan, 'provider') ?? stringField(artifactRecord, 'overlayProvider') ?? 'missing'}</strong></div>
              <div><span>Cards</span><strong>{overlayCards.length}</strong></div>
              <div><span>Plan</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.overlayPlanKey ?? stringField(artifactRecord, 'overlayPlanKey') ?? 'missing'}</strong></div>
            </div>
            {overlayCards.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {overlayCards.map((card, index) => {
                  const type = stringField(card, 'type') ?? `card ${index + 1}`;
                  const sceneIndex = typeof card.sceneIndex === 'number' ? ` ${card.sceneIndex}` : '';
                  return <span key={`${type}-${index}`} style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--border)', borderRadius: '3px', fontSize: '0.8rem' }}>{type}{sceneIndex}</span>;
                })}
              </div>
            ) : null}
            {overlayWarnings.length > 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--badge-warning-text)', padding: '0.5rem', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '3px' }}>
                <strong>Overlay warnings:</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', paddingLeft: 0 }}>
                  {overlayWarnings.map(w => <li key={w}>{w}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
      <div className="aws-facts">
        <div><span>Status</span><strong>{reviewData?.reviewStatus ?? 'pending'}</strong></div>
        <div><span>Created</span><strong>{reviewData?.createdAt ? timeAgo(reviewData.createdAt) : 'unknown'}</strong></div>
        <div><span>Updated</span><strong>{reviewData?.updatedAt ? timeAgo(reviewData.updatedAt) : 'unknown'}</strong></div>
        <div><span>Images</span><strong>{imageKeys.length}</strong></div>
        <div><span>Review JSON</span><strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{reviewMedia?.publishKey ? reviewMedia.publishKey.replace('/publish.json', '/review.json') : 'jobs/.../metadata/review.json'}</strong></div>
      </div>
      {reviewData?.reviewStatus !== 'approved' ? <div className="compact-warning">Generated media must be reviewed before YouTube dry-run or private publish.</div> : <div className="success-panel">Review approved. Ready to proceed to dry-run or publish.</div>}
      <div style={{ fontSize: '0.8rem', color: 'var(--body)', marginBottom: '0.5rem' }}>
        Review media from control-plane{reviewMedia ? ' (available)' : controlPlaneData ? ' (unavailable)' : ' (loading…)'}{missingReviewMediaFields.length > 0 ? ' — some fields missing' : ''}.
      </div>
      {missingReviewMediaFields.length > 0 && (
        isPendingTimeout ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--badge-warning-text)', padding: '0.75rem', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
            <strong>Waiting for job data…</strong>
            <div style={{ marginTop: '0.25rem' }}>
              Action is still processing in Brain Core. Fields will populate when complete.
            </div>
          </div>
        ) : finalizationState === 'pending' ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--badge-warning-text)', padding: '0.75rem', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
            <strong>Finalizing publish package…</strong>
            <div style={{ marginTop: '0.25rem' }}>
              Generating missing fields: {missingReviewMediaFields.map(field => field.label).join(', ')}
            </div>
          </div>
        ) : finalizationState === 'failed' ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--badge-warning-text)', padding: '0.75rem', backgroundColor: 'var(--badge-warning-bg)', border: '1px solid var(--badge-warning-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
            <strong>Finalization incomplete</strong>
            <div style={{ marginTop: '0.25rem' }}>
              Missing: {missingReviewMediaFields.map(field => field.label).join(', ')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--badge-error-text)', padding: '0.75rem', backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
            <strong>Cannot approve: Missing fields</strong>
            <div style={{ marginTop: '0.25rem' }}>
              {missingReviewMediaFields.map(field => field.label).join(', ')}
            </div>
          </div>
        )
      )}
      {hasInternalTermsInMetadata && (
        <div style={{ fontSize: '0.85rem', color: 'var(--badge-error-text)', padding: '0.75rem', backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
          <strong>Cannot approve: YouTube metadata contains internal terms</strong>
          <div style={{ marginTop: '0.25rem' }}>
            Title or description contains AWS, Bedrock, Polly, FFmpeg, fixture, or other internal implementation details.
          </div>
        </div>
      )}
      {overlayBlocksApproval && (
        <div style={{ fontSize: '0.85rem', color: 'var(--badge-error-text)', padding: '0.75rem', backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-border)', borderRadius: '4px', marginBottom: '0.75rem' }}>
          <strong>Cannot approve: Overlay plan issue</strong>
          <div style={{ marginTop: '0.25rem' }}>
            {overlayMissing ? 'Hybrid image slideshow is missing metadata/overlay-plan.json.' : 'Overlay plan contains internal implementation terms.'}
          </div>
        </div>
      )}
      <div className="stack">
        <label className="meta no-margin">Notes</label>
        <textarea className="textarea compact-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional review notes" />
        <div className="pipeline-actions">
          {/* CONTROL PLANE CANONICAL: always use allowedActions.approve_review.enabled */}
          {(() => {
            // controlPlaneData is ALREADY the normalized inner payload.
            // Read directly; do not wrap again.
            const cpRecord = asRecord(controlPlaneData);
            const cpActionsRecord = cpRecord?.allowedActions as Record<string, { enabled: boolean; reason?: string }> | undefined;
            const approveReviewAction = cpActionsRecord?.approve_review;
            const cpReviewStatus = asRecord(cpRecord?.review)?.reviewStatus ?? 'pending';
            const shouldHighlight = approveReviewAction?.enabled && isRecommended;
            // Control-plane is canonical. If available, trust it entirely. Otherwise fall back to legacy logic.
            const isEnabled = controlPlaneData && approveReviewAction !== undefined ? approveReviewAction.enabled : (mediaComplete && !hasInternalTermsInMetadata && !overlayBlocksApproval);
            const isApproved = controlPlaneData && cpReviewStatus === 'approved' ? true : reviewData?.reviewStatus === 'approved';
            return (
              <button
                className={shouldHighlight ? 'button next-action' : 'button'}
                disabled={!jobId || approvePending || !isEnabled}
                onClick={onApprove}
                title={approveReviewAction?.reason ?? undefined}
              >
                {approvePending ? 'Approving review…' : isApproved ? 'Review approved' : 'Approve review'}
              </button>
            );
          })()}
          <button className="button secondary" disabled={!jobId || requestChangesPending} onClick={onRequestChanges}>{requestChangesPending ? 'Requesting changes…' : 'Request changes'}</button>
        </div>
      </div>
      {controlPlaneData && reviewMedia && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
          ✓ Review media is available from control-plane
        </div>
      )}
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer' }}>Media details</summary>
        <div className="aws-facts" style={{ marginTop: '0.75rem' }}>
          <div><span>Scene plan</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.scenePlanKey ?? 'missing'}</strong></div>
          <div><span>Narration script</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.narrationScriptKey ?? 'missing'}</strong></div>
          <div><span>Narration audio</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.audioKey ?? 'missing'}</strong></div>
          <div><span>Final MP4</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.videoKey ?? 'missing'}</strong></div>
          <div><span>Thumbnail</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.thumbnailKey ?? 'missing'}</strong></div>
          <div><span>Publish JSON</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.publishKey ?? 'missing'}</strong></div>
          <div><span>YouTube package</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.youtubePackageKey ?? 'missing'}</strong></div>
          <div><span>Overlay plan</span><strong style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{reviewMedia?.overlayPlanKey ?? 'not required'}</strong></div>
        </div>
        {imageKeys.length > 0 ? (
          <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            {imageKeys.slice(0, 4).map((key: string) => (
              <code key={key} style={{ fontSize: '0.78rem', wordBreak: 'break-all', padding: '0.5rem', backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--code-fg)' }}>
                {key}
              </code>
            ))}
          </div>
        ) : null}
      </details>
      <details style={{ marginTop: '1rem' }}>
        <summary style={{ cursor: 'pointer' }}>S3 copy commands</summary>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.scenePlanKey ?? null, 'scene plan')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.narrationScriptKey ?? null, 'narration script')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.audioKey ?? null, 'narration audio')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.videoKey ?? null, 'final MP4')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.thumbnailKey ?? null, 'thumbnail')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.publishKey ?? null, 'publish JSON')}</code>
          <code style={{ whiteSpace: 'pre-wrap' }}>{s3Command(reviewMedia?.youtubePackageKey ?? null, 'youtube package')}</code>
        </div>
      </details>
      {artifactData ? (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer' }}>Prompt audit</summary>
          <pre className="compact-pre">{JSON.stringify(asRecord(artifactData?.imageGeneration) ?? {}, null, 2).slice(0, 1600)}</pre>
        </details>
      ) : null}
    </article>
  );
}

interface TimeoutMonitorSnapshot {
  pendingActionByJobId: Record<string, PendingAction>;
  createDraftTimedOut: boolean;
  currentCreateActionId: string | null;
  preTimeoutJobIds: string[];
  selectedJobId: string | null;
}

const TIMEOUT_MONITOR_KEY = 'aws-video-timeout-monitor';

function readTimeoutMonitor(): TimeoutMonitorSnapshot {
  try {
    const raw = sessionStorage.getItem(TIMEOUT_MONITOR_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TimeoutMonitorSnapshot>;
      return {
        pendingActionByJobId: p.pendingActionByJobId ?? {},
        createDraftTimedOut: p.createDraftTimedOut ?? false,
        currentCreateActionId: p.currentCreateActionId ?? null,
        preTimeoutJobIds: p.preTimeoutJobIds ?? [],
        selectedJobId: p.selectedJobId ?? null,
      };
    }
  } catch { /* ignore parse/storage errors */ }
  return { pendingActionByJobId: {}, createDraftTimedOut: false, currentCreateActionId: null, preTimeoutJobIds: [], selectedJobId: null };
}

export function AwsVideoDashboard() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<AwsVideoView>('overview');
  const [channelId, setChannelId] = useState('prochat');
  const [prompt, setPrompt] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [actionStateByJobId, setActionStateByJobId] = useState<Record<string, ActionState>>({});
  const [activity, setActivity] = useState<string[]>([]);
  const [generationTimeoutJobId, setGenerationTimeoutJobId] = useState<string | null>(null);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [directJobIdError, setDirectJobIdError] = useState<string | null>(null);
  const [directJobIdValue, setDirectJobIdValue] = useState('');

  // Timeout monitor state — restored after mount to avoid hydration mismatch
  const [currentCreateActionId, setCurrentCreateActionId] = useState<string | null>(null);
  const [pendingActionByJobId, setPendingActionByJobId] = useState<Record<string, PendingAction>>({});
  const [createDraftTimedOut, setCreateDraftTimedOut] = useState<boolean>(false);
  const [preTimeoutJobIds, setPreTimeoutJobIds] = useState<string[]>([]);

  // Restore timeout-monitor state from sessionStorage after mount (hydration-safe)
  useEffect(() => {
    const m = readTimeoutMonitor();
    if (m.currentCreateActionId) setCurrentCreateActionId(m.currentCreateActionId);
    if (Object.keys(m.pendingActionByJobId).length > 0) setPendingActionByJobId(m.pendingActionByJobId);
    if (m.createDraftTimedOut) setCreateDraftTimedOut(m.createDraftTimedOut);
    if (m.preTimeoutJobIds.length > 0) setPreTimeoutJobIds(m.preTimeoutJobIds);
  }, []);

  const addActivity = (message: string) => setActivity((items) => [`${new Date().toLocaleTimeString()} · ${message}`, ...items].slice(0, 14));
  const beginAction = () => setDismissedError(null);

  // Update action state for a specific job
  const updateActionState = (jobId: string, update: Partial<ActionState>) => {
    setActionStateByJobId((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...update, lastActionAt: new Date().toISOString() },
    }));
  };

  // Pending action helpers
  const setPendingAction = (id: string, action: PendingAction) =>
    setPendingActionByJobId(prev => ({ ...prev, [id]: action }));
  const clearPendingAction = (id: string) =>
    setPendingActionByJobId(prev => { const n = { ...prev }; delete n[id]; return n; });

  const status = useQuery({
    queryKey: ['aws-video-status'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/status', videoStatusSchema),
    refetchInterval: 10_000,
  });
  const jobs = useQuery({
    queryKey: ['aws-video-jobs'],
    queryFn: () => brainCoreRequest('/api/video-orchestrator/jobs/recent?limit=100', recentVideoJobsSchema),
    refetchInterval: 15_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const jobList = jobs.data?.jobs ?? [];
  const jobsDiagnostics = jobs.data?.diagnostics ?? payloadDiagnostics(jobs.error);

  // Filter jobs based on search query
  const filteredJobList = useMemo(() => {
    if (!jobSearchQuery.trim()) return jobList;
    const query = jobSearchQuery.toLowerCase();
    return jobList.filter((job) => {
      const title = (job.title ?? '').toLowerCase();
      const jobIdLower = (job.jobId ?? '').toLowerCase();
      const channelId = (job.channelId ?? '').toLowerCase();
      const status = (job.status ?? '').toLowerCase();
      return title.includes(query) || jobIdLower.includes(query) || channelId.includes(query) || status.includes(query);
    });
  }, [jobList, jobSearchQuery]);

  // Hydration-safe selected-job hook — defers sessionStorage to after mount
  const { selectedJobId, setSelectedJobId, resolvedJobId, isSelectionReady } = useAwsVideoSelection(jobList);

  // selected is used only for the jobs list highlight and legacy fallback display.
  // It must NEVER drive control-plane query key or panel state.
  const selected = useMemo(() => jobList.find((job) => job.jobId === resolvedJobId) ?? null, [jobList, resolvedJobId]);

  // jobId is the canonical selected identity — stable across /jobs/recent refetches
  const jobId = resolvedJobId;

  // Legacy queries — used for debug panels only, not for driving main UI state
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
  const review = useQuery({
    queryKey: ['aws-video-review', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/review`, videoReviewSchema),
    enabled: Boolean(jobId),
    refetchInterval: 15_000,
  });

  const controlPlane = useQuery({
    queryKey: ['aws-video-control-plane', jobId],
    queryFn: () => brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/control-plane`, videoControlPlaneSchema, { timeoutMs: 25_000 }),
    enabled: Boolean(jobId),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (prev, prevQuery) => {
      const prevJobId = (prevQuery?.queryKey as [string, string | null] | undefined)?.[1];
      if (prevJobId && prevJobId === jobId) return prev;
      return undefined;
    },
  });

  const invalidateVideo = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['aws-video-status'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-job'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-timeline'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-artifacts'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-execution'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-review'] }),
      queryClient.invalidateQueries({ queryKey: ['aws-video-control-plane'] }),
    ]);
  };

  const openDirectJobId = async (attemptedJobId: string) => {
    if (!attemptedJobId.trim()) {
      setDirectJobIdError('Job ID cannot be empty');
      return;
    }
    setDirectJobIdError(null);
    try {
      const result = await brainCoreRequest(`/api/video-orchestrator/jobs/${encodeURIComponent(attemptedJobId)}`, videoJobResponseSchema);
      const jobData = result?.data ?? result;
      if (jobData && typeof jobData === 'object' && 'jobId' in jobData && typeof jobData.jobId === 'string') {
        setSelectedJobId(jobData.jobId);
        setJobSearchQuery('');
        setDirectJobIdValue('');
        setActiveView('overview');
        addActivity(`Opened job: ${jobData.jobId}`);
      } else {
        setDirectJobIdError('Job not found');
      }
    } catch (error) {
      setDirectJobIdError(errorMessage(error) || 'Failed to load job');
    }
  };

  const createDraft = useMutation({
    mutationFn: async () => {
      // Generate stable clientActionId once per button click
      const actionId = currentCreateActionId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setCurrentCreateActionId(actionId);
      return postBrainCoreAction('/api/video-orchestrator/jobs/create-from-prompt', videoActionResultSchema, { channelId, prompt, requestedBy: 'brain-console-center', clientActionId: actionId }, 15_000);
    },
    onSuccess: async (result) => {
      const possibleJobId = typeof result.jobId === 'string' ? result.jobId : typeof (result.job as { jobId?: unknown } | undefined)?.jobId === 'string' ? (result.job as { jobId: string }).jobId : null;
      if (possibleJobId) {
        setSelectedJobId(possibleJobId);
        setCurrentCreateActionId(null);
        setCreateDraftTimedOut(false);
      }
      setPrompt('');
      setActiveView('overview');
      addActivity(`Draft created${possibleJobId ? `: ${possibleJobId}` : ''}`);
      await invalidateVideo();
    },
    onError: async (error) => {
      if (isTimeoutError(error)) {
        setCreateDraftTimedOut(true);
        setPreTimeoutJobIds(jobList.map(j => j.jobId));
        addActivity('Draft creation is still running. Refresh is safe. Waiting for new job…');
        await invalidateVideo();
        return;
      }
      addActivity(`Draft creation failed: ${errorMessage(error)}`);
      setCurrentCreateActionId(null);
    },
  });

  // PART 1: Fix approve mutation to take explicit jobId argument
  const approve = useMutation({
    mutationFn: ({ jobIdArg }: { jobIdArg: string }) => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobIdArg)}/approve`, videoActionResultSchema, { approvedBy: 'brain-console-center' }, 15_000),
    onSuccess: async (_, { jobIdArg }) => {
      clearPendingAction(jobIdArg);
      addActivity(`Approved script for ${jobIdArg}`);
      await invalidateVideo();
    },
    onError: async (error, { jobIdArg }) => {
      if (isTimeoutError(error)) {
        setPendingAction(jobIdArg, 'approve_script');
        addActivity(`Script approval is still being persisted for ${jobIdArg}; waiting for confirmation…`);
        await invalidateVideo();
        return;
      }
      addActivity(`Script approval error for ${jobIdArg}: ${errorMessage(error)}`);
      console.error(`[approve] Error for ${jobIdArg}:`, error);
    },
  });

  const requestChanges = useMutation({
    mutationFn: ({ jobIdArg }: { jobIdArg: string }) => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobIdArg)}/request-changes`, videoActionResultSchema, { requestedBy: 'brain-console-center', changes: changeRequest }),
    onSuccess: async (_, { jobIdArg }) => { setChangeRequest(''); addActivity(`Requested changes for ${jobIdArg}`); await invalidateVideo(); },
  });
  const approveReview = useMutation({
    mutationFn: ({ jobIdArg, notes }: { jobIdArg: string; notes?: string }) => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobIdArg)}/review/approve`, videoReviewSchema, { reviewedBy: 'brain-console-center', notes }, 15_000),
    onSuccess: async (result, { jobIdArg }) => {
      clearPendingAction(jobIdArg);
      addActivity(`Approved review for ${jobIdArg}`);
      setReviewNotes('');
      setActiveView('publish');
      // Cache the full wrapped response from videoReviewSchema so queries stay in sync
      queryClient.setQueryData(['aws-video-review', jobIdArg], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['aws-video-review', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-artifacts', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-job', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-control-plane', jobIdArg] }),
      ]);
    },
    onError: async (error, { jobIdArg }) => {
      if (isTimeoutError(error)) {
        setPendingAction(jobIdArg, 'approve_review');
        addActivity(`Review approval is still being persisted for ${jobIdArg}; waiting for confirmation…`);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['aws-video-review', jobIdArg] }),
          queryClient.invalidateQueries({ queryKey: ['aws-video-artifacts', jobIdArg] }),
          queryClient.invalidateQueries({ queryKey: ['aws-video-job', jobIdArg] }),
          queryClient.invalidateQueries({ queryKey: ['aws-video-jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['aws-video-control-plane', jobIdArg] }),
        ]);
        return;
      }
      addActivity(`Review approval error for ${jobIdArg}: ${errorMessage(error)}`);
      console.error(`[approveReview] Error for ${jobIdArg}:`, error);
    },
  });
  const requestReviewChanges = useMutation({
    mutationFn: ({ jobIdArg, notes }: { jobIdArg: string; notes?: string }) => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobIdArg)}/review/request-changes`, videoReviewSchema, { reviewedBy: 'brain-console-center', notes }),
    onSuccess: async (result, { jobIdArg }) => {
      addActivity(`Requested review changes for ${jobIdArg}`);
      // Focused invalidation
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['aws-video-review', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-artifacts', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-job', jobIdArg] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['aws-video-control-plane', jobIdArg] }),
      ]);
    },
  });

  const generate = useMutation({
    mutationFn: ({ jobIdArg }: { jobIdArg: string }) => postBrainCoreAction(`/api/video-orchestrator/scripts/${encodeURIComponent(jobIdArg)}/generate`, videoActionResultSchema, { requestedBy: 'brain-console-center' }, GENERATE_TIMEOUT_MS),
    onSuccess: async (_, { jobIdArg }) => {
      setGenerationTimeoutJobId((current) => (current === jobIdArg ? null : current));
      clearPendingAction(jobIdArg);
      addActivity(`Generation accepted for ${jobIdArg}`);
      await invalidateVideo();
    },
    onError: async (error, { jobIdArg }) => {
      if (!isTimeoutError(error)) return;

      setGenerationTimeoutJobId(jobIdArg);
      setPendingAction(jobIdArg, 'generate');
      addActivity(`Generation is still running for ${jobIdArg}; refresh is safe.`);
      await invalidateVideo();
    },
  });

  const youtubeDryRun = useMutation({
    mutationFn: ({ jobIdArg }: { jobIdArg: string }) => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobIdArg)}/publish/youtube/dry-run`, youtubePublishResultSchema, {}, 45_000),
    onSuccess: async (result, { jobIdArg }) => {
      clearPendingAction(jobIdArg);
      if (result.ok) {
        updateActionState(jobIdArg, { dryRunPassed: true });
      }
      addActivity(result.ok ? `YouTube dry-run passed for ${jobIdArg}` : `YouTube dry-run failed for ${jobIdArg}: ${result.error || 'unknown'}`);
      await invalidateVideo();
    },
    onError: async (error, { jobIdArg }) => {
      if (isTimeoutError(error)) {
        setPendingAction(jobIdArg, 'dry_run');
        addActivity(`YouTube dry-run is still running for ${jobIdArg}; refresh is safe.`);
        await invalidateVideo();
        return;
      }
      addActivity(`YouTube dry-run error for ${jobIdArg}: ${errorMessage(error)}`);
      console.error(`[youtubeDryRun] Error for ${jobIdArg}:`, error);
    },
  });

  const youtubePublish = useMutation({
    mutationFn: ({ jobIdArg }: { jobIdArg: string }) => postBrainCoreAction(`/api/video-orchestrator/jobs/${encodeURIComponent(jobIdArg)}/publish/youtube`, youtubePublishResultSchema, {
      dryRun: false,
      requestedBy: 'brain-console-center',
    }, 60_000),
    onSuccess: async (result, { jobIdArg }) => {
      clearPendingAction(jobIdArg);
      if (result.ok) {
        // PART 2: Terminal upload states — treat all these as uploaded
        const isTerminalUpload = result.videoId || result.publishStatus === 'uploaded';
        const isAlreadyUploaded = result.code === 'already_uploaded';
        const isDuplicateBlocked = result.code === 'already_uploaded';

        if (isTerminalUpload || isAlreadyUploaded || isDuplicateBlocked) {
          updateActionState(jobIdArg, {
            uploaded: true,
            videoId: result.videoId ?? undefined,
            url: result.url ?? undefined,
            dryRunPassed: true,
            uploadStartedAt: undefined,
            lastAction: isAlreadyUploaded || isDuplicateBlocked ? 'already-uploaded' : 'uploaded',
          });
          addActivity(`Private YouTube upload completed for ${jobIdArg}${result.videoId ? ` (${result.videoId})` : ''} — ${isAlreadyUploaded ? 'already uploaded' : 'new upload'}`);
        }
      }
      if (!result.ok) {
        // On failure, keep dryRunPassed if it was true, but don't mark uploaded
        updateActionState(jobIdArg, { uploadStartedAt: undefined });
        addActivity(`Private YouTube upload failed for ${jobIdArg}: ${result.error || 'unknown error'}`);
      }
      await invalidateVideo();
    },
    onMutate: ({ jobIdArg }) => {
      // PART 3: Mark upload in-flight
      updateActionState(jobIdArg, { uploadStartedAt: new Date().toISOString() });
    },
    onError: async (error, { jobIdArg }) => {
      if (isTimeoutError(error)) {
        setPendingAction(jobIdArg, 'publish');
        addActivity(`Private YouTube upload is still running for ${jobIdArg}; refresh is safe.`);
        await invalidateVideo();
        return;
      }
      updateActionState(jobIdArg, { uploadStartedAt: undefined });
      addActivity(`Private YouTube upload error for ${jobIdArg}: ${errorMessage(error)}`);
      console.error(`[youtubePublish] Error for ${jobIdArg}:`, error);
    },
  });

  // Clear error toast when any mutation succeeds
  useEffect(() => {
    if (approve.isSuccess || generate.isSuccess || approveReview.isSuccess || youtubeDryRun.isSuccess || youtubePublish.isSuccess) {
      setDismissedError(null);
    }
  }, [approve.isSuccess, generate.isSuccess, approveReview.isSuccess, youtubeDryRun.isSuccess, youtubePublish.isSuccess]);

  // Persist timeout monitor state to sessionStorage
  useEffect(() => {
    const hasActive = createDraftTimedOut || Object.keys(pendingActionByJobId).length > 0;
    try {
      if (hasActive) {
        const snapshot: TimeoutMonitorSnapshot = {
          pendingActionByJobId,
          createDraftTimedOut,
          currentCreateActionId,
          preTimeoutJobIds,
          selectedJobId,
        };
        sessionStorage.setItem(TIMEOUT_MONITOR_KEY, JSON.stringify(snapshot));
      } else {
        sessionStorage.removeItem(TIMEOUT_MONITOR_KEY);
      }
    } catch { /* storage quota or private-mode errors: ignore */ }
  }, [pendingActionByJobId, createDraftTimedOut, currentCreateActionId, preTimeoutJobIds, selectedJobId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL PLANE IS THE SOLE SOURCE OF TRUTH FOR MAIN UI STATE
  // Legacy queries are kept for debug panels only.
  // Use keepPreviousData semantics: keep last good CP data while refetching.
  // NORMALIZATION: Extract the inner data object once and reuse everywhere.
  // ═══════════════════════════════════════════════════════════════════════════
  const rawControlPlaneResponse = controlPlane.data ?? null;
  const controlPlaneData: VideoControlPlaneData | null =
    rawControlPlaneResponse?.data
      ? (asRecord(rawControlPlaneResponse.data) ? asRecord(rawControlPlaneResponse.data) : rawControlPlaneResponse?.data)
      : asRecord(rawControlPlaneResponse);
  const controlPlaneLoading = controlPlane.isLoading && Boolean(jobId);
  const controlPlaneStale = controlPlane.isError;

  // Prove control-plane is available and queryable
  if (jobId && controlPlaneData && process.env.NODE_ENV === 'development') {
    const cpRec = asRecord(controlPlaneData);
    const selectedJobRec = cpRec?.selectedJob ? asRecord(cpRec.selectedJob) : null;
    const reviewRec = cpRec?.review ? asRecord(cpRec.review) : null;
    const allowedActionsRec = cpRec?.allowedActions ? asRecord(cpRec.allowedActions) : null;
    const approveReviewRec = allowedActionsRec?.approve_review ? asRecord(allowedActionsRec.approve_review) : null;
    console.debug('[AwsVideo] Control-plane data loaded:', {
      queryKey: ['aws-video-control-plane', jobId],
      jobIdUsed: jobId,
      controlPlaneLoading,
      controlPlaneIsError: controlPlane.isError,
      rawResponseOk: Boolean(rawControlPlaneResponse),
      normalizedDataOk: Boolean(controlPlaneData),
      phase: cpRec?.phase,
      selectedJobStatus: selectedJobRec?.status,
      reviewStatus: reviewRec?.reviewStatus,
      approveReviewEnabled: approveReviewRec?.enabled,
    });
  }

  // Missing control-plane is surfaced in the debug panel.
  // useEffect avoids triggering the Next.js red dev overlay during render.
  useEffect(() => {
    if (!jobId || controlPlaneLoading || controlPlaneData || !controlPlane.isError) return;
    if (process.env.NODE_ENV === 'development') {
      console.warn('[AwsVideo] Control-plane unavailable for job:', jobId, errorMessage(controlPlane.error));
    }
  }, [jobId, controlPlaneLoading, controlPlaneData, controlPlane.isError, controlPlane.error]);

  // Legacy data — debug panels ONLY, never drives main UI
  const timelineEvents = timeline.data?.data.events ?? [];
  const legacyArtifactData = artifacts.data?.data ?? null;
  const legacyExecutionData = execution.data?.data ?? null;
  const legacyReviewData = review.data?.review ?? null;

  // ─── Derived from control-plane (normalized payload) ─────────────────────
  // CANONICAL: Always use normalized controlPlaneData (inner data object).
  // Do NOT read from the raw response envelope.
  const cp = controlPlaneData as any;
  const cpSelectedJob = cp?.selectedJob ?? null;
  const cpPhase = cp?.phase ?? cp?.canonicalPhase ?? 'unknown';
  // NORMALIZE: allowedActions is keyed object {action_name: {enabled, reason}}
  // Handle both array format (legacy) and object format (current)
  let cpAllowedActions: Record<string, { enabled: boolean; reason?: string }> = {};
  if (cp?.allowedActions) {
    if (Array.isArray(cp.allowedActions)) {
      // Legacy array format: convert to keyed object
      cpAllowedActions = cp.allowedActions.reduce(
        (acc: Record<string, { enabled: boolean; reason?: string }>, item: any) => {
          if (item?.action && typeof item.enabled === 'boolean') {
            acc[item.action] = { enabled: item.enabled, reason: item.reason };
          }
          return acc;
        },
        {}
      );
    } else if (typeof cp.allowedActions === 'object') {
      // Current object format: use directly
      cpAllowedActions = cp.allowedActions as Record<string, { enabled: boolean; reason?: string }>;
    }
  }
  const cpFinalization = cp?.finalization ?? null;
  const cpArtifacts = cp?.artifacts ?? null;
  const cpExecution = cp?.execution ?? null;
  const cpReview = cp?.review ?? null;
  const cpPublish = cp?.publish ?? null;

  // Canonical review media object: source of truth for ready_to_publish phase
  const cpReviewMedia = cpReview?.media ?? null;

  // Media source and generation mode from control-plane (canonical)
  const mediaSource = cpArtifacts?.mediaSource ?? cpSelectedJob?.mediaSource ?? 'unknown';
  const generationMode = cpArtifacts?.generationMode ?? cpSelectedJob?.generationMode ?? 'unknown';
  const isHybridMode = generationMode === 'hybrid_scene_plan_fixture_media';
  const isHybridTTSMode = generationMode === 'hybrid_tts_fixture_video';
  const isHybridStoryboardMode = generationMode === 'hybrid_storyboard_fixture_video';
  const isHybridSlideshowMode = generationMode === 'hybrid_slideshow_video';
  const isHybridImageSlideshowMode = generationMode === 'hybrid_image_slideshow_video';
  const isFixtureMedia = mediaSource === 'fixture' || mediaSource === 'hybrid' || generationMode === 'fixture_assembly' || generationMode === 'hybrid_scene_plan_fixture_media' || generationMode === 'hybrid_tts_fixture_video' || generationMode === 'hybrid_storyboard_fixture_video' || generationMode === 'hybrid_slideshow_video' || generationMode === 'hybrid_image_slideshow_video';

  // Artifact keys from control-plane with review media precedence
  const finalVideoKey =
    cpReviewMedia?.videoKey ??
    cpArtifacts?.finalVideoKey ??
    cpArtifacts?.videoKey ??
    null;

  const thumbnailKey =
    cpReviewMedia?.thumbnailKey ??
    cpArtifacts?.thumbnailKey ??
    null;

  const audioKey =
    cpReviewMedia?.audioKey ??
    cpArtifacts?.audioKey ??
    null;

  const youtubePackageKey =
    cpReviewMedia?.youtubePackageKey ??
    cpArtifacts?.youtubePackageKey ??
    null;

  const scenePlanKey = cpReviewMedia?.scenePlanKey ?? cpArtifacts?.scenePlanKey ?? null;
  const narrationScriptKey = cpReviewMedia?.narrationScriptKey ?? cpArtifacts?.narrationScriptKey ?? null;
  const sceneImageKeys = cpReviewMedia?.sceneImageKeys ?? cpArtifacts?.sceneImageKeys ?? [];
  const hasGeneratedAssets = Boolean(finalVideoKey && thumbnailKey);
  const hasScenePlan = Boolean(scenePlanKey);
  const reviewMediaReady = Boolean(finalVideoKey && thumbnailKey);

  // For detail cards that still need legacy artifact data (scene plan content, image generation, etc.)
  const artifactData = legacyArtifactData;
  // Detail-level rendering vars from legacy artifacts (for sub-cards only, not main state)
  const imageProvider = stringField(artifactData, 'imageProvider');
  const imageModelId = stringField(artifactData, 'imageModelId');
  const videoProvider = stringField(artifactData, 'videoProvider');
  const imageGenerated = artifactData?.imageGenerated === true;
  const partialAiGenerated = artifactData?.partialAiGenerated === true;
  const slideshowGenerated = artifactData?.slideshowGenerated === true;
  const generatedVideoKey = cpArtifacts?.videoKey ?? cpArtifacts?.finalVideoKey ?? null;

  // Selected job — from control-plane ONLY for actionable state.
  // When control-plane is unavailable, selectedJob is null so action buttons disable.
  // List data is display-only context, never drives workflow actions.
  const selectedJob = cpSelectedJob
    ? {
        jobId: cpSelectedJob.jobId,
        title: cpSelectedJob.title,
        status: cpSelectedJob.status,
        approval: { status: cpSelectedJob.approvalStatus },
        mediaSource: cpSelectedJob.mediaSource,
        generationMode: cpSelectedJob.generationMode,
        updatedAt: cpSelectedJob.updatedAt,
        progress: (typeof cp?.progress === 'number' ? cp.progress : 0) ?? 0,
        currentStep: cpExecution?.localStep ?? null,
      }
    : null;

  // Display-only context from /jobs/recent (for job card title when CP loading)
  const listDisplayJob = selected;

  // Action state per job
  const actionState = jobId ? actionStateByJobId[jobId] : undefined;

  // Dry-run state: control-plane canonical, local optimistic override
  const backendDryRunStatus = cpPublish?.dryRunStatus ?? null;
  const backendDryRunPassed = backendDryRunStatus === 'passed';
  const backendDryRunRunning = backendDryRunStatus === 'running';
  const backendDryRunFailed = backendDryRunStatus === 'failed';
  const dryRunPassedForThisJob = (actionState?.dryRunPassed ?? backendDryRunPassed) && !actionState?.uploadStartedAt;
  const dryRunRunning = !dryRunPassedForThisJob && (youtubeDryRun.isPending || backendDryRunRunning);
  const dryRunFailed = !dryRunPassedForThisJob && !dryRunRunning && backendDryRunFailed;

  // Upload state: local optimistic > control-plane > list status
  const backendUploaded = cpPublish?.videoId || cpPublish?.uploadStatus === 'uploaded';
  const selectedPublished = actionState?.uploaded
    ? true
    : backendUploaded
      ? true
      : cpSelectedJob?.status === 'published'
        ? true
        : cpPublish?.status === 'uploaded' || cpPublish?.status === 'published'
          ? true
          : false;

  const selectedReady = cpPhase === 'ready_to_publish' || cpSelectedJob?.status === 'ready_to_publish' || reviewMediaReady;
  const selectedUploaded = selectedPublished;

  // In-flight state
  const isPublishingThisJob = youtubePublish.isPending || (actionState?.uploadStartedAt ? (Date.now() - new Date(actionState.uploadStartedAt).getTime()) < 60000 : false);

  const selectedApprovalStatus = cpSelectedJob?.approvalStatus ?? 'pending';
  const reviewStatus = cpReview?.reviewStatus ?? 'pending';
  const reviewApproved = reviewStatus === 'approved';
  const requiresReviewGate = ['hybrid_storyboard_fixture_video', 'hybrid_slideshow_video', 'hybrid_image_slideshow_video'].includes(generationMode);

  // Finalization from control-plane
  const finalizationState = cpFinalization?.status ?? null;

  const generationInProgress = ['generating'].includes(cpSelectedJob?.status ?? '') || cpPhase === 'generating';
  const generationTimeoutStillRunning = Boolean(generationTimeoutJobId && generationTimeoutJobId === jobId && generationInProgress);
  const generationTimeoutFailed = Boolean(generationTimeoutJobId && generationTimeoutJobId === jobId && cpSelectedJob?.status === 'failed');

  // Pending action state for selected job
  const pendingActionForSelectedJob = jobId ? pendingActionByJobId[jobId] : undefined;
  const createDraftIsStillProcessing = createDraftTimedOut && !createDraft.isPending;
  const anyPendingTimeout = Boolean(pendingActionForSelectedJob || createDraftIsStillProcessing);

  // Allowed actions from control-plane, with deterministic local fallback for older/stale CP responses.
  // A draft/awaiting_approval job with pending approval is always approvable by contract.
  const canApprove = (cpAllowedActions.approve_script?.enabled ?? false)
    || Boolean(jobId && selectedApprovalStatus === 'pending' && ['draft', 'awaiting_approval'].includes(selectedJob?.status ?? ''));
  const canGenerate = (cpAllowedActions.generate?.enabled ?? false)
    || Boolean(jobId && selectedApprovalStatus === 'approved' && ['approved', 'ready_to_generate'].includes(selectedJob?.status ?? ''));
  const canApproveReview = cpAllowedActions.approve_review?.enabled ?? false;
  const canDryRun = Boolean(jobId && selectedReady && !selectedUploaded && !isPublishingThisJob && (cpAllowedActions.dry_run?.enabled ?? false));
  const canPublish = Boolean(jobId && selectedReady && !selectedUploaded && !isPublishingThisJob && dryRunPassedForThisJob && (cpAllowedActions.publish_private?.enabled ?? false));
  const canDownloadVideo = cpAllowedActions.download_video?.enabled ?? false;

  const publishReadinessLabel = selectedUploaded
    ? 'Already uploaded'
    : requiresReviewGate && !reviewApproved
      ? `Review ${reviewStatus}`
    : canDryRun
      ? 'Ready for dry-run'
      : hasGeneratedAssets
        ? 'Generated assets available'
        : 'Waiting for generated assets';

  // Pipeline step model derived from control-plane phase and allowedActions
  // CANONICAL: All step states derive from control-plane (phase, status, allowedActions, reviewStatus)
  const guideSteps = [
    { key: 'draft', view: 'create' as const, action: 'Create draft', label: 'Create draft', help: 'Create or select a job.', done: Boolean(cpSelectedJob), active: !cpSelectedJob },
    { key: 'approve', view: 'overview' as const, action: 'Approve', label: 'Approve script', help: 'Approve the script.', done: cpSelectedJob?.approvalStatus === 'approved' || selectedReady || selectedUploaded, active: cpAllowedActions.approve_script?.enabled ?? false },
    { key: 'generate', view: 'overview' as const, action: 'Generate', label: 'Generate media', help: 'Run image generation and assembly.', done: selectedReady || selectedUploaded, active: cpAllowedActions.generate?.enabled ?? false },
    { key: 'finalize', view: 'overview' as const, action: 'Finalize', label: 'Finalize package', help: 'Finalize review and publish metadata.', done: cpPhase === 'ready_to_publish' || cpFinalization?.status === 'complete' || selectedUploaded, active: cpFinalization?.status === 'pending' },
    { key: 'review', view: 'review' as const, action: 'Approve review', label: 'Review media', help: 'Approve generated media before publish.', done: !requiresReviewGate || reviewApproved || selectedUploaded, active: cpAllowedActions.approve_review?.enabled ?? false },
    { key: 'dry-run', view: 'publish' as const, action: 'Dry-run YouTube publish', label: 'Dry-run upload', help: 'Validate the YouTube upload.', done: dryRunPassedForThisJob || selectedUploaded, active: cpAllowedActions.dry_run?.enabled ?? false },
    { key: 'publish', view: 'publish' as const, action: 'Publish privately', label: 'Publish privately', help: 'Upload privately after dry-run.', done: selectedUploaded, active: cpAllowedActions.publish_private?.enabled ?? false },
    { key: 'download', view: 'publish' as const, action: 'Download', label: 'Download / audit', help: 'Download final video or audit upload.', done: false, active: cpAllowedActions.download_video?.enabled ?? false },
  ];
  const recommendedStep = guideSteps.find((step) => step.active && !step.done) ?? guideSteps.find((step) => !step.done);
  const nextStep = recommendedStep;
  const busyAction = createDraft.isPending || createDraftIsStillProcessing
    ? { title: createDraft.isPending ? 'Creating draft…' : 'Still processing in Brain Core.', detail: createDraft.isPending ? 'Preparing a new video job. Please wait before clicking another action.' : 'Refresh is safe. Waiting for new job to appear…' }
    : approve.isPending || pendingActionForSelectedJob === 'approve_script'
      ? { title: approve.isPending ? 'Approving script…' : 'Still processing in Brain Core.', detail: approve.isPending ? 'Saving approval and refreshing the pipeline state.' : 'Refresh is safe. Waiting for script approval confirmation…' }
      : generate.isPending || pendingActionForSelectedJob === 'generate'
        ? { title: generate.isPending ? 'Generating video…' : 'Still processing in Brain Core.', detail: generate.isPending ? 'Creating narration, images, overlays, thumbnail, and final video. This can take a while.' : 'Refresh is safe. Waiting for job state…' }
        : approveReview.isPending || pendingActionForSelectedJob === 'approve_review'
          ? { title: approveReview.isPending ? 'Approving review…' : 'Still processing in Brain Core.', detail: approveReview.isPending ? 'Validating generated media and unlocking the publish step.' : 'Refresh is safe. Waiting for job state…' }
          : requestReviewChanges.isPending || requestChanges.isPending
            ? { title: 'Saving requested changes…', detail: 'Writing change notes and refreshing the job state.' }
            : youtubeDryRun.isPending || pendingActionForSelectedJob === 'dry_run'
              ? { title: youtubeDryRun.isPending ? 'Running YouTube dry-run…' : 'Still processing in Brain Core.', detail: youtubeDryRun.isPending ? 'Validating video, thumbnail, and metadata. Refresh is safe after this transitions to running.' : 'Refresh is safe. Waiting for job state…' }
              : youtubePublish.isPending || pendingActionForSelectedJob === 'publish'
                ? { title: youtubePublish.isPending ? 'Publishing privately…' : 'Still processing in Brain Core.', detail: youtubePublish.isPending ? 'Uploading the final video and thumbnail to YouTube. This may take a minute.' : 'Refresh is safe. Waiting for job state…' }
                : null;

  const statusOnlyError = status.error;
  const statusOnlyErrorMessage = errorMessage(statusOnlyError);
  const refreshSafeTimeoutErrors = [createDraft.error, approve.error, approveReview.error, youtubeDryRun.error, youtubePublish.error].filter(isTimeoutError);
  const actionError = [approve.error, requestChanges.error, approveReview.error, requestReviewChanges.error, youtubeDryRun.error, youtubePublish.error, createDraft.error]
    .filter((error) => !(isTimeoutError(error) && refreshSafeTimeoutErrors.includes(error)))
    .find(Boolean) ?? (pendingActionForSelectedJob === 'generate' || generationTimeoutStillRunning ? null : generate.error);
  const actionErrorMessage = errorMessage(actionError);
  const publishErrorDetails = payloadDetails(youtubeDryRun.error ?? youtubePublish.error);
  const quotaExceeded = cpPublish?.quotaStatus === 'exceeded' || isQuotaExceededResult(youtubePublish.error, youtubePublish.data ?? null);
  const finalVideoAvailable = Boolean(finalVideoKey);
  const visibleErrorMessage = statusOnlyErrorMessage ?? actionErrorMessage;
  const visibleErrorSummary = quotaExceeded
    ? 'YouTube upload quota reached'
    : statusOnlyErrorMessage
      ? 'Brain Core request failed'
      : actionErrorSummary(actionError) ?? 'Action failed';
  const visibleErrorDetails = statusOnlyErrorMessage ?? actionErrorMessage;
  const showErrorToast = Boolean(!anyPendingTimeout && !quotaExceeded && visibleErrorMessage && visibleErrorMessage !== dismissedError);

  const counts = {
    total: jobList.length,
    pending: jobList.filter((item) => ['awaiting_approval', 'approved', 'ready_to_publish'].includes(item.status ?? '')).length,
    active: jobList.filter((item) => ['generating', 'publishing'].includes(item.status ?? '')).length,
    published: jobList.filter((item) => item.status === 'published').length,
  };

  // Poll-based clearing of pending actions: create_draft
  useEffect(() => {
    if (!createDraftTimedOut || createDraft.isPending) return;

    // Primary: deterministic match by clientActionId (post-backend-change jobs have this)
    if (currentCreateActionId) {
      const matched = jobList.find(j => j.clientActionId === currentCreateActionId);
      if (matched) {
        setSelectedJobId(matched.jobId);
        setCreateDraftTimedOut(false);
        setCurrentCreateActionId(null);
        addActivity(`Draft created: ${matched.jobId}`);
        setActiveView('overview');
      }
      // clientActionId known but not yet visible in list — keep overlay locked
      return;
    }

    // Fallback: first new job not in preTimeoutJobIds (jobs predating the backend change)
    const newJob = jobList.find(j => !preTimeoutJobIds.includes(j.jobId));
    if (newJob) {
      setSelectedJobId(newJob.jobId);
      setCreateDraftTimedOut(false);
      setCurrentCreateActionId(null);
      addActivity(`Draft created: ${newJob.jobId}`);
      setActiveView('overview');
    }
  }, [createDraftTimedOut, jobList, preTimeoutJobIds, createDraft.isPending, currentCreateActionId]);

  // Poll-based clearing of pending actions: approve_script
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'approve_script') return;
    if (selectedApprovalStatus === 'approved' || ['approved', 'ready_to_generate', 'generating', 'ready_to_publish', 'published'].includes(selectedJob?.status ?? '')) {
      clearPendingAction(jobId);
    }
  }, [jobId, selectedApprovalStatus, selectedJob?.status, pendingActionByJobId]);

  // Poll-based clearing of pending actions: generate
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'generate') return;
    if (['ready_to_publish', 'failed', 'published'].includes(selectedJob?.status ?? '')) {
      clearPendingAction(jobId);
      if (generationTimeoutJobId === jobId) setGenerationTimeoutJobId(null);
    }
  }, [jobId, selectedJob?.status, pendingActionByJobId, generationTimeoutJobId]);

  // Poll-based clearing of pending actions: approve_review
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'approve_review') return;
    if (reviewStatus === 'approved') {
      clearPendingAction(jobId);
      setActiveView('publish');
    }
  }, [jobId, reviewStatus, pendingActionByJobId]);

  // Poll-based clearing of pending actions: dry_run
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'dry_run') return;
    if (['passed', 'failed', 'quota_exceeded'].includes(backendDryRunStatus ?? '')) {
      clearPendingAction(jobId);
    }
  }, [jobId, backendDryRunStatus, pendingActionByJobId]);

  // Staleness TTL: clear pending dry_run if stuck > 3 minutes without terminal status
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'dry_run') return;
    const timer = setTimeout(() => {
      if (pendingActionByJobId[jobId] === 'dry_run') {
        clearPendingAction(jobId);
        addActivity(`Dry-run pending state cleared after timeout for ${jobId}`);
      }
    }, 180_000);
    return () => clearTimeout(timer);
  }, [jobId, pendingActionByJobId]);

  // Poll-based clearing of pending actions: publish
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'publish') return;
    if (selectedUploaded || selectedJob?.status === 'failed' || cpPublish?.quotaStatus === 'exceeded') {
      clearPendingAction(jobId);
    }
  }, [jobId, selectedUploaded, selectedJob?.status, cpPublish?.quotaStatus, pendingActionByJobId]);

  // DEV ASSERTION: When controlPlane is available, verify it is driving the main UI state
  useEffect(() => {
    if (!jobId || !controlPlaneData || process.env.NODE_ENV !== 'development') return;

    if (cpReview?.media) {
      console.debug('[AwsVideo] ✓ ReviewCard using control-plane media');
    }
    if (cpExecution && cpExecution.status === null && cpExecution.unavailableReason) {
      console.debug('[AwsVideo] ✓ Execution shows unavailableReason (structured, not empty {})');
    }
    if (cpArtifacts && cpArtifacts.status === null && cpArtifacts.unavailableReason) {
      console.debug('[AwsVideo] ✓ Artifacts shows unavailableReason (structured, not empty {})');
    }
    if (cpFinalization?.status === 'pending') {
      console.debug('[AwsVideo] ✓ Finalization pending state detected');
    }
    if (cpAllowedActions.approve_review) {
      console.debug(`[AwsVideo] ✓ approve_review enabled=${cpAllowedActions.approve_review.enabled}`);
    }
  }, [jobId, controlPlaneData, cpReview?.media, cpExecution, cpArtifacts, cpFinalization?.status, cpAllowedActions]);

  return (
    <div className="aws-video-screen">
      {busyAction ? (
        <div className="busy-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="busy-dialog">
            <div className="busy-spinner" aria-hidden="true" />
            <div>
              <strong>{busyAction.title}</strong>
              <p>{busyAction.detail}</p>
            </div>
            <div className="busy-progress" aria-hidden="true"><span /></div>
          </div>
        </div>
      ) : null}
      {showErrorToast && visibleErrorMessage ? (
        <div className="toast-stack" role="alert" aria-live="assertive">
          <div className="toast error-toast">
            <div className="toast-content">
              <strong>{visibleErrorSummary}</strong>
              {statusOnlyErrorMessage ? <p>{statusOnlyErrorMessage}</p> : null}
              {!statusOnlyErrorMessage && visibleErrorDetails ? (
                <details className="toast-details">
                  <summary>Show details</summary>
                  <pre>{visibleErrorDetails}</pre>
                </details>
              ) : null}
            </div>
            <button aria-label="Dismiss error" onClick={() => setDismissedError(visibleErrorMessage)}>×</button>
          </div>
        </div>
      ) : null}
      <section className="aws-hero">
        <div className="min-w-0">
          <div className="eyebrow">AWS Video Pipeline</div>
          <h1>Video operations</h1>
          <p>Brain Console is the active dashboard. Follow the pipeline left to right: draft, approve, generate, review, dry-run, then private YouTube upload.</p>
        </div>
        <div className="aws-hero-actions">
          <StatusBadge status={status.isError || jobs.isError ? 'error' : 'fresh'} label={status.isError || jobs.isError ? 'partial error' : 'online'} />
          <button className="button secondary" onClick={() => void invalidateVideo()}><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="aws-metrics">
        <div><span>Runtime mode</span><strong>{stringField(status.data?.data, 'generationModeRuntime') ?? (status.isLoading && !status.data ? 'loading' : stringField(asRecord(selectedJob), 'mediaSource') === 'hybrid' ? 'hybrid' : stringField(asRecord(selectedJob), 'mediaSource') === 'fixture' ? 'fixture' : 'unknown')}</strong></div>
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
          <p>{nextStep ? `${nextStep.help} Press “${nextStep.action}”.` : 'This job has completed the visible pipeline.'}</p>
        </div>
        <div className="pipeline-steps">
          {guideSteps.map((step, index) => (
            <div key={step.label} className={step.done ? 'done' : step === recommendedStep ? 'recommended' : step.active ? 'active' : ''}>
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
            ['review', '4. Review'],
            ['publish', '5. Publish'],
            ['activity', '6. Activity'],
          ].map(([view, label]) => (
            <button key={view} className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view as AwsVideoView)}>{label}</button>
          ))}
        </nav>

        <main className="aws-main-panel">
          {activeView === 'overview' ? (
            <div className="stack">
              {generationTimeoutStillRunning ? (
                <div className="compact-info">
                  <strong>Generation is still running</strong>
                  <p>Page refresh is safe.</p>
                </div>
              ) : null}
              {generationTimeoutFailed ? (
                <div className="compact-error">
                  <strong>Generation failed</strong>
                  <p>{actionErrorSummary(generate.error) ?? 'The backend reported a failure after the timeout.'}</p>
                </div>
              ) : null}
              <article className="card aws-selected-card">
                <div className="card-header compact-header">
                  <div className="min-w-0">
                    <div className="card-title">Selected job</div>
                    <div className="card-description truncate">{!isSelectionReady ? 'Loading selected job…' : shortJobId(jobId ?? undefined)}</div>
                  </div>
                  <StatusBadge status={!isSelectionReady ? 'pending' : selectedJob?.status ?? (controlPlaneLoading ? 'pending' : undefined)} />
                </div>
                {!isSelectionReady ? (
                  <div className="compact-info">Loading selected job…</div>
                ) : selectedJob ? (
                  <>
                    {isHybridImageSlideshowMode
                      ? <div className="compact-info">Generated image slideshow: scene images are generated by {imageProvider ?? 'the configured image provider'}; final video is assembled as a slideshow.</div>
                      : isHybridSlideshowMode
                      ? <div className="compact-info">Slideshow mode: final video is assembled from generated storyboard images and generated narration audio.</div>
                      : isHybridStoryboardMode
                      ? <div className="compact-info">Hybrid Storyboard mode: scene plan, narration script, and scene images are prompt-derived; narration audio is generated via AWS Polly; final video still uses fixtures.</div>
                      : isHybridTTSMode
                        ? <div className="compact-info">Hybrid TTS mode: scene plan and narration script are prompt-derived; narration audio is generated via AWS Polly; final video still uses fixtures.</div>
                        : isHybridMode
                          ? <div className="compact-info">Hybrid mode: scene plan and narration script are prompt-derived; final audio/video media still uses fixtures.</div>
                          : isFixtureMedia
                            ? <div className="compact-info">Pipeline proof mode: this job used fixture media, not AI-generated video.</div>
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
                ) : jobId && controlPlaneLoading ? (
                  <div className="compact-info">
                    Loading control-plane state…
                    {listDisplayJob ? <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{listDisplayJob.title ?? shortJobId(jobId)} (from job list, non-canonical)</p> : null}
                  </div>
                ) : jobId && controlPlane.isError ? (
                  <div className="compact-error">
                    <strong>Control-plane unavailable</strong>
                    <p>Job ID: {shortJobId(jobId)}</p>
                    <p style={{ fontSize: '0.8rem' }}>Actions are disabled until control-plane responds.</p>
                    <button className="button secondary" onClick={() => void controlPlane.refetch()}>Retry</button>
                  </div>
                ) : <p>Select or create a job to start.</p>}
              </article>

              <article className="card">
                <div className="card-title">Pipeline flow</div>
                <div className="pipeline-flow">
                  {guideSteps.map((step, index) => (
                    <div className="pipeline-step" key={step.key}>
                      <div className="pipeline-index">{index + 1}</div>
                      <div className="min-w-0">
                        <strong>{step.label}</strong>
                        <span>{step.done ? 'complete' : step.active ? 'active' : 'waiting'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pipeline-actions">
                  <button className={recommendedStep?.key === 'draft' ? 'button next-action' : 'button secondary'} onClick={() => setActiveView('create')}><FilePlus2 size={16} /> Create draft</button>
                  <button className={recommendedStep?.key === 'approve' ? 'button next-action' : 'button'} disabled={!canApprove || approve.isPending || anyPendingTimeout} onClick={() => { if (jobId) { beginAction(); approve.mutate({ jobIdArg: jobId }); } }}><CheckCircle2 size={16} /> Approve script</button>
                  <button className={recommendedStep?.key === 'generate' ? 'button next-action' : 'button'} disabled={!canGenerate || generate.isPending || anyPendingTimeout} onClick={() => { if (jobId) { beginAction(); generate.mutate({ jobIdArg: jobId }); } }}><Wand2 size={16} /> Generate</button>
                  <button className={recommendedStep?.key === 'review' ? 'button next-action' : 'button'} disabled={!canApproveReview || approveReview.isPending || anyPendingTimeout} onClick={() => { if (jobId) { beginAction(); approveReview.mutate({ jobIdArg: jobId, notes: undefined }); } }}><CheckCircle2 size={16} /> Approve review</button>
                  <button className={recommendedStep?.view === 'publish' ? 'button next-action' : 'button secondary'} onClick={() => setActiveView('publish')}><Youtube size={16} /> Publish step</button>
                </div>
              </article>

              {hasScenePlan ? <ScenePlanCard artifactData={artifactData} /> : null}
              {isHybridImageSlideshowMode ? <StoryboardCard artifactData={artifactData} /> : null}
              {isHybridSlideshowMode ? <StoryboardCard artifactData={artifactData} /> : null}
              {isHybridStoryboardMode ? <StoryboardCard artifactData={artifactData} /> : null}
              {isHybridTTSMode ? <TTSAudioCard artifactData={artifactData} /> : null}
              {isHybridMode || isHybridTTSMode || isHybridStoryboardMode || isHybridSlideshowMode || isHybridImageSlideshowMode ? <GenerationArtifactsCard jobId={jobId} artifactData={artifactData} generationMode={generationMode} /> : null}
              {isHybridSlideshowMode || isHybridImageSlideshowMode ? (
                <article className="card">
                  <div className="card-title">Slideshow assembly</div>
                  <div className="aws-facts">
                    <div><span>{isHybridImageSlideshowMode ? 'Image provider' : 'Storyboard provider'}</span><strong>{imageProvider ?? 'unknown'}</strong></div>
                    {imageModelId ? <div><span>Image model</span><strong>{imageModelId}</strong></div> : null}
                    <div><span>Video provider</span><strong>{videoProvider ?? 'local-ffmpeg-slideshow'}</strong></div>
                    {isHybridImageSlideshowMode ? <div><span>imageGenerated</span><strong>{imageGenerated ? 'true' : 'false'}</strong></div> : null}
                    {isHybridImageSlideshowMode ? <div><span>partialAiGenerated</span><strong>{partialAiGenerated ? 'true' : 'false'}</strong></div> : null}
                    <div><span>slideshowGenerated</span><strong>{slideshowGenerated ? 'true' : 'false'}</strong></div>
                    <div><span>Video key</span><strong style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{generatedVideoKey ?? 'pending'}</strong></div>
                    <div><span>Scene image count</span><strong>{sceneImageKeys.length}</strong></div>
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          {activeView === 'review' ? (
            <div className="stack">
              <ReviewCard
                jobId={jobId}
                reviewData={legacyReviewData}
                artifactData={artifactData}
                approvePending={approveReview.isPending}
                requestChangesPending={requestReviewChanges.isPending}
                onApprove={() => { if (jobId) { beginAction(); approveReview.mutate({ jobIdArg: jobId, notes: reviewNotes.trim() || undefined }); } }}
                onRequestChanges={() => { if (jobId) { beginAction(); requestReviewChanges.mutate({ jobIdArg: jobId, notes: reviewNotes.trim() || undefined }); } }}
                notes={reviewNotes}
                setNotes={setReviewNotes}
                isRecommended={recommendedStep?.key === 'review'}
                finalizationState={finalizationState}
                isPendingTimeout={anyPendingTimeout}
                controlPlaneData={controlPlaneData}
              />
              <MotionCard artifactData={artifactData} />
            </div>
          ) : null}

          {activeView === 'jobs' ? (
            <article className="card">
              <div className="card-header"><div><div className="card-title">Jobs</div><div className="card-description">Search, filter, or open a job by ID</div></div><StatusBadge status={jobs.isError ? 'error' : 'fresh'} /></div>
              <JobsDiagnosticsCard
                diagnostics={jobList.length === 0 || (jobsDiagnostics?.skippedJobCount ?? 0) > 0 || jobs.isError ? jobsDiagnostics : null}
                error={statusOnlyErrorMessage}
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
                        openDirectJobId(directJobIdValue.trim());
                      }
                    }}
                  />
                  <button
                    className="button secondary"
                    disabled={!directJobIdValue.trim()}
                    onClick={() => { if (directJobIdValue.trim()) openDirectJobId(directJobIdValue.trim()); }}
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
                    <button key={item.jobId} className={`job-list-item ${item.jobId === jobId ? 'active' : ''}${isTestJob ? ' test-job' : ''}`} onClick={() => { setSelectedJobId(item.jobId); setJobSearchQuery(''); setActiveView('overview'); }}>
                      <div className="min-w-0"><strong>{item.title || item.jobId}{isTestJob ? ' [diagnostic]' : ''}</strong><span>{item.jobId} · {item.channelId}</span></div>
                      <StatusBadge status={item.status} />
                      <div className="job-progress"><div className="progress"><span style={{ width: `${pct(item.progress)}%` }} /></div><span>{pct(item.progress)}%</span></div>
                      <span className="meta no-margin">{item.updatedAt ? timeAgo(item.updatedAt) : 'unknown'}</span>
                    </button>
                  );
                })}
                {jobList.length === 0 && !jobsDiagnostics?.localJobFolderCount && !jobsDiagnostics?.s3DiscoveredJobCount && !statusOnlyErrorMessage ? <p>No video jobs returned by Brain Core.</p> : null}
                {jobList.length > 0 && filteredJobList.length === 0 ? (
                  <div className="stack" style={{ padding: '0.75rem' }}>
                    <p>No jobs match the search filter.</p>
                    {jobSearchQuery.trim().length >= 10 ? (
                      <button
                        className="button secondary"
                        onClick={() => openDirectJobId(jobSearchQuery.trim())}
                      >
                        Open "{jobSearchQuery.trim().slice(0, 48)}" as job ID
                      </button>
                    ) : null}
                  </div>
                ) : null}
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
                <button className="button" disabled={channelId.trim().length === 0 || prompt.trim().length < 10 || createDraft.isPending || anyPendingTimeout} onClick={() => { beginAction(); createDraft.mutate(); }}><FilePlus2 size={16} /> {createDraft.isPending ? 'Creating…' : 'Create draft'}</button>
              </div>
            </article>
          ) : null}

          {activeView === 'publish' ? (
            <article className="card publish-panel aws-publish-card">
              <div className="card-header compact-header">
                <div className="min-w-0"><div className="card-title">Controlled YouTube publish</div><div className="card-description">Private upload only. Dry-run must pass before upload is enabled.</div></div>
                <StatusBadge status={isPublishingThisJob ? 'pending' : selectedPublished ? 'fresh' : selectedReady ? 'ready' : 'pending'} label={isPublishingThisJob ? 'publishing' : selectedPublished ? 'uploaded' : selectedReady ? 'ready' : 'not ready'} />
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
                <div><span>videoKey</span><strong>{cpArtifacts?.videoKey ?? cpArtifacts?.finalVideoKey ?? 'unknown'}</strong></div>
                <div><span>audioKey</span><strong>{cpArtifacts?.audioKey ?? 'unknown'}</strong></div>
              </div>
              <PublishDiagnosticsCard artifactData={artifactData} errorDetails={publishErrorDetails} cpVideoKey={finalVideoKey} cpThumbnailKey={thumbnailKey} cpPublishKey={(cpReviewMedia?.publishKey as string | undefined) ?? null} />
              {!selectedReady ? anyPendingTimeout ? <div className="compact-info">Waiting for job state… Action is still processing in Brain Core. Refresh is safe.</div> : <div className="compact-warning">This job is not ready to publish. Complete approval and generation first.</div> : null}
              {cpFinalization?.status === 'pending' ? <div className="compact-warning">Finalizing publish package…</div> : null}
              {selectedPublished && !isPublishingThisJob ? <div className="success-panel">This job is already uploaded to YouTube. Duplicate upload is blocked.</div> : null}
              <div className="pipeline-actions">
                <button className={recommendedStep?.key === 'dry-run' ? 'button next-action' : 'button secondary'} disabled={!canDryRun || youtubeDryRun.isPending || isPublishingThisJob || anyPendingTimeout} onClick={() => { if (jobId) { beginAction(); youtubeDryRun.mutate({ jobIdArg: jobId }); } }}>{youtubeDryRun.isPending ? 'Running dry-run…' : 'Dry-run YouTube publish'}</button>
                <button className={recommendedStep?.key === 'publish' ? 'button next-action' : 'button danger-button'} disabled={!canPublish || isPublishingThisJob || quotaExceeded || anyPendingTimeout} onClick={() => { if (jobId) { beginAction(); youtubePublish.mutate({ jobIdArg: jobId }); } }}>{isPublishingThisJob ? 'Publishing privately…' : 'Publish privately'}</button>
                {finalVideoAvailable ? <button className="button secondary" onClick={() => { if (jobId) downloadFinalVideo(jobId); }}>Download final MP4</button> : null}
              </div>
              <p className="meta no-margin">{requiresReviewGate ? 'Review approval is required before dry-run or private upload.' : 'Private upload unlocks automatically after a successful dry-run for this selected job.'}</p>
              {finalVideoAvailable ? <p className="meta no-margin">Use this when YouTube upload quota is reached or to inspect video quality locally.</p> : null}
              <CompactPublishResultCard
                dryRunResult={youtubeDryRun.data}
                uploadResult={youtubePublish.data}
                actionState={actionState}
                isPublishing={isPublishingThisJob}
              />
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
          {/* Stale indicator when control-plane refetch is pending/failed */}
          {controlPlaneStale && controlPlaneData ? (
            <div className="compact-warning" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              Control-plane data may be stale. Refetching…
            </div>
          ) : null}

          {/* Execution panel */}
          <article className="card">
            <div className="card-title">Execution</div>
            {cpExecution ? (
              <div className="aws-facts">
                <div><span>Status</span><strong>{cpExecution.status ?? 'pending'}</strong></div>
                {cpExecution.awsStatus ? <div><span>AWS status</span><strong>{cpExecution.awsStatus}</strong></div> : null}
                {cpExecution.localStep ? <div><span>Step</span><strong>{cpExecution.localStep}</strong></div> : null}
                {cpExecution.executionArn ? <div><span>Execution ARN</span><strong style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{cpExecution.executionArn}</strong></div> : null}
                {cpExecution.unavailableReason ? (
                  <div><span>Reason</span><strong>{cpExecution.unavailableReason}</strong></div>
                ) : null}
              </div>
            ) : controlPlaneLoading ? (
              <p>Loading execution data…</p>
            ) : (
              <p>Execution pending</p>
            )}
          </article>

          {/* Artifacts panel */}
          <article className="card">
            <div className="card-title">Artifacts</div>
            {cpArtifacts ? (
              <div className="aws-facts">
                <div><span>Status</span><strong>{cpArtifacts.status ?? 'pending'}</strong></div>
                {cpArtifacts.scenePlanKey ? <div><span>Scene plan</span><strong>present</strong></div> : null}
                {cpArtifacts.audioKey ? <div><span>Audio</span><strong>present</strong></div> : null}
                {cpArtifacts.finalVideoKey ? <div><span>Video</span><strong>present</strong></div> : null}
                {cpArtifacts.thumbnailKey ? <div><span>Thumbnail</span><strong>present</strong></div> : null}
                {cpArtifacts.unavailableReason ? (
                  <div><span>Reason</span><strong>{cpArtifacts.unavailableReason}</strong></div>
                ) : null}
              </div>
            ) : controlPlaneLoading ? (
              <p>Loading artifacts…</p>
            ) : (
              <p>Artifacts pending</p>
            )}
          </article>

          {/* Finalization panel */}
          {cpFinalization && cpFinalization.status !== 'not_required' ? (
            <article className="card">
              <div className="card-title">Finalization</div>
              <div className="aws-facts">
                <div><span>Status</span><strong>{cpFinalization.status ?? 'unknown'}</strong></div>
                {cpFinalization.repaired.length > 0 ? <div><span>Repaired</span><strong>{cpFinalization.repaired.join(', ')}</strong></div> : null}
                {cpFinalization.missingFields.length > 0 ? <div><span>Missing</span><strong>{cpFinalization.missingFields.join(', ')}</strong></div> : null}
                {cpFinalization.error ? <div><span>Error</span><strong>{cpFinalization.error}</strong></div> : null}
              </div>
            </article>
          ) : null}

          <article className="card"><div className="card-title">Request changes</div><textarea className="textarea compact-textarea" placeholder="Requested changes" value={changeRequest} onChange={(event) => setChangeRequest(event.target.value)} /><button className="button secondary full-width" disabled={!jobId || changeRequest.trim().length < 4 || requestChanges.isPending || anyPendingTimeout} onClick={() => { if (jobId) requestChanges.mutate({ jobIdArg: jobId }); }}>Request changes</button></article>

          {/* DEBUG: Control-plane state proof */}
          <article className="card" style={{ marginTop: '1rem' }}>
            <details open>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Debug: control-plane state</summary>
              <div className="aws-facts" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                <div><span>raw control-plane ok</span><strong>{rawControlPlaneResponse ? 'yes' : 'no'}</strong></div>
                <div><span>selected job id used by query</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{jobId ?? 'none'}</strong></div>
                <div><span>actual fetch URL</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{jobId ? `http://127.0.0.1:4877/api/video-orchestrator/jobs/${jobId}/control-plane` : 'n/a'}</strong></div>
                <div><span>timeout ms</span><strong>25000</strong></div>
                <div><span>control-plane query status</span><strong>{controlPlane.status}</strong></div>
                <div><span>isLoading</span><strong>{String(controlPlane.isLoading)}</strong></div>
                <div><span>isError</span><strong>{String(controlPlane.isError)}</strong></div>
                {controlPlane.error ? <div><span>error</span><strong style={{ color: 'var(--badge-error-text)' }}>{errorMessage(controlPlane.error)}</strong></div> : null}
                <div><span>cpPhase</span><strong>{cpPhase}</strong></div>
                <div><span>selectedApprovalStatus</span><strong>{cpSelectedJob?.approvalStatus ?? 'n/a'}</strong></div>
                <div><span>reviewStatus</span><strong>{cpReview?.reviewStatus ?? 'n/a'}</strong></div>
                <div><span>approve_review.enabled</span><strong>{String(cpAllowedActions.approve_review?.enabled ?? false)}</strong></div>
                <div><span>generate.enabled</span><strong>{String(cpAllowedActions.generate?.enabled ?? false)}</strong></div>
                <div><span>finalVideoKey</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{finalVideoKey ?? 'missing'}</strong></div>
                <div><span>thumbnailKey</span><strong style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{thumbnailKey ?? 'missing'}</strong></div>
                {!controlPlaneData ? (
                  <div style={{ gridColumn: '1 / -1', padding: '0.5rem', backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-border)', borderRadius: '3px', marginTop: '0.5rem' }}>
                    <strong style={{ color: 'var(--badge-error-text)' }}>⚠️ Control-plane state is missing for selected job</strong>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--badge-error-text)' }}>
                      Job ID: {shortJobId(jobId ?? undefined)}
                      {controlPlane.error ? <div>Query error: {errorMessage(controlPlane.error)}</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          </article>

          {/* DEBUG: Legacy data collapsed */}
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Debug: legacy execution data</summary>
            <pre className="compact-pre" style={{ marginTop: '0.5rem' }}>{JSON.stringify(legacyExecutionData ?? {}, null, 2).slice(0, 1600)}</pre>
          </details>
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>Debug: legacy artifacts data</summary>
            <pre className="compact-pre" style={{ marginTop: '0.5rem' }}>{JSON.stringify(legacyArtifactData ?? {}, null, 2).slice(0, 1600)}</pre>
          </details>
        </aside>
      </section>

    </div>
  );
}
