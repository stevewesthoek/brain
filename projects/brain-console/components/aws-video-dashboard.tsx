'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { BRAIN_CORE_URL, BrainCoreError, brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import { recentVideoJobsSchema, videoActionResultSchema, videoArtifactsResponseSchema, videoExecutionResponseSchema, videoJobResponseSchema, videoReviewSchema, videoStatusSchema, videoTimelineResponseSchema, youtubePublishResultSchema, type VideoJobsDiagnostics } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';
import { useAwsVideoSelection } from '@/components/aws-video/use-aws-video-selection';
import { useAwsVideoControlPlane } from '@/components/aws-video/use-aws-video-control-plane';
import { AwsVideoControlPlaneDebugPanel } from '@/components/aws-video/aws-video-control-plane-debug-panel';
import { AwsVideoPublishDiagnosticsCard } from '@/components/aws-video/aws-video-publish-diagnostics-card';
import { AwsVideoReviewCard } from '@/components/aws-video/aws-video-review-card';
import { AwsVideoPipelineFlow } from '@/components/aws-video/aws-video-pipeline-flow';
import { AwsVideoActivityPanel } from '@/components/aws-video/aws-video-activity-panel';
import { AwsVideoJobSelector } from '@/components/aws-video/aws-video-job-selector';
import { AwsVideoDashboardHeader } from '@/components/aws-video/aws-video-dashboard-header';

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


interface TimeoutMonitorSnapshot {
  pendingActionByJobId: Record<string, PendingAction>;
  createDraftTimedOut: boolean;
  currentCreateActionId: string | null;
  preTimeoutJobIds: string[];
  selectedJobId: string | null;
  savedAt: string | null;
}

const TIMEOUT_MONITOR_KEY = 'aws-video-timeout-monitor';
const TIMEOUT_MONITOR_MAX_AGE_MS = 2 * 60 * 1000;
const EMPTY_TIMEOUT_MONITOR: TimeoutMonitorSnapshot = {
  pendingActionByJobId: {},
  createDraftTimedOut: false,
  currentCreateActionId: null,
  preTimeoutJobIds: [],
  selectedJobId: null,
  savedAt: null,
};

function readTimeoutMonitor(): TimeoutMonitorSnapshot {
  try {
    const raw = sessionStorage.getItem(TIMEOUT_MONITOR_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TimeoutMonitorSnapshot>;
      const savedAtMs = typeof p.savedAt === 'string' ? new Date(p.savedAt).getTime() : NaN;
      if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > TIMEOUT_MONITOR_MAX_AGE_MS) {
        sessionStorage.removeItem(TIMEOUT_MONITOR_KEY);
        return EMPTY_TIMEOUT_MONITOR;
      }
      return {
        pendingActionByJobId: p.pendingActionByJobId ?? {},
        createDraftTimedOut: p.createDraftTimedOut ?? false,
        currentCreateActionId: p.currentCreateActionId ?? null,
        preTimeoutJobIds: p.preTimeoutJobIds ?? [],
        selectedJobId: p.selectedJobId ?? null,
        savedAt: p.savedAt ?? null,
      };
    }
  } catch { /* ignore parse/storage errors */ }
  return EMPTY_TIMEOUT_MONITOR;
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
    staleTime: 30_000,
    retry: 1,
    retryDelay: 2000,
    placeholderData: (prev) => prev,
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

  const controlPlaneHook = useAwsVideoControlPlane(jobId);
  const controlPlane = controlPlaneHook.query;

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
          savedAt: new Date().toISOString(),
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
  // ═══════════════════════════════════════════════════════════════════════════
  const rawControlPlaneResponse = controlPlaneHook.rawResponse;
  const controlPlaneData = controlPlaneHook.data;
  const controlPlaneLoading = controlPlaneHook.isLoading && Boolean(jobId);
  const controlPlaneStale = controlPlaneHook.isError;

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
  const isHybridAnimatedVideoMode = generationMode === 'hybrid_animated_video';
  const isFixtureMedia = mediaSource === 'fixture' || mediaSource === 'hybrid' || generationMode === 'fixture_assembly' || generationMode === 'hybrid_scene_plan_fixture_media' || generationMode === 'hybrid_tts_fixture_video' || generationMode === 'hybrid_storyboard_fixture_video' || generationMode === 'hybrid_slideshow_video' || generationMode === 'hybrid_image_slideshow_video' || generationMode === 'hybrid_animated_video';

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
  const uploadLockActive = Boolean(actionState?.uploadStartedAt && (Date.now() - new Date(actionState.uploadStartedAt).getTime()) < 60_000);
  const dryRunPassedForThisJob = (actionState?.dryRunPassed ?? backendDryRunPassed) && !uploadLockActive;
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

  const packageComplete = cpFinalization?.status === 'complete';
  const finalMediaVerified = Boolean(finalVideoKey && thumbnailKey && (packageComplete || cpReview?.reviewStatus === 'approved' || cpPublish?.videoKey || cpArtifacts?.publishableAssets?.missing?.length === 0));
  const selectedReady = finalMediaVerified && (cpPhase === 'ready_to_publish' || cpSelectedJob?.status === 'ready_to_publish' || reviewMediaReady || cpReview?.reviewStatus === 'approved');
  const selectedUploaded = selectedPublished;

  // In-flight state
  const isPublishingThisJob = youtubePublish.isPending || uploadLockActive;

  const selectedApprovalStatus = cpSelectedJob?.approvalStatus ?? 'pending';
  const reviewStatus = cpReview?.reviewStatus ?? 'pending';
  const reviewApproved = reviewStatus === 'approved';
  const requiresReviewGate = ['hybrid_storyboard_fixture_video', 'hybrid_slideshow_video', 'hybrid_image_slideshow_video', 'hybrid_animated_video'].includes(generationMode);

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
  const canApproveReview = Boolean((cpAllowedActions.approve_review?.enabled ?? false) && finalMediaVerified);
  const verifiedPackageReady = Boolean(finalMediaVerified && reviewApproved && cpArtifacts?.publishableAssets?.missing?.length === 0);
  const canDryRun = Boolean(jobId && !selectedUploaded && !isPublishingThisJob && ((selectedReady && (cpAllowedActions.dry_run?.enabled ?? false)) || verifiedPackageReady));
  const canPublish = Boolean(jobId && !selectedUploaded && !isPublishingThisJob && dryRunPassedForThisJob && ((selectedReady && (cpAllowedActions.publish_private?.enabled ?? false)) || verifiedPackageReady));
  const canDownloadVideo = cpAllowedActions.download_video?.enabled ?? false;

  const dryRunDisabledReason = cpAllowedActions.dry_run?.reason;
  const publishReadinessLabel = selectedUploaded
    ? 'Already uploaded'
    : requiresReviewGate && !reviewApproved
      ? `Review ${reviewStatus}`
    : canDryRun
      ? 'Ready for dry-run'
      : dryRunDisabledReason
        ? dryRunDisabledReason
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
  const statusHasUsableData = Boolean(status.data);
  const statusOnlyErrorMessage = status.isLoading || (status.isFetching && statusHasUsableData)
    ? null
    : errorMessage(statusOnlyError);
  const refreshSafeTimeoutErrors = [createDraft.error, approve.error, approveReview.error, youtubeDryRun.error, youtubePublish.error].filter(isTimeoutError);
  const generatedArtifactsArrived = Boolean(hasGeneratedAssets || finalVideoKey || thumbnailKey || cpArtifacts?.finalVideoKey || cpArtifacts?.thumbnailKey);
  const generationError = isTimeoutError(generate.error) && generatedArtifactsArrived ? null : generate.error;
  const actionError = [approve.error, requestChanges.error, approveReview.error, requestReviewChanges.error, youtubeDryRun.error, youtubePublish.error, createDraft.error]
    .filter((error) => !(isTimeoutError(error) && refreshSafeTimeoutErrors.includes(error)))
    .find(Boolean) ?? (pendingActionForSelectedJob === 'generate' || generationTimeoutStillRunning ? null : generationError);
  const actionErrorMessage = errorMessage(actionError);
  const publishErrorDetails = payloadDetails(youtubeDryRun.error ?? youtubePublish.error);
  const quotaExceeded = cpPublish?.quotaStatus === 'exceeded' || isQuotaExceededResult(youtubePublish.error, youtubePublish.data ?? null);
  const finalVideoAvailable = finalMediaVerified;
  const visibleErrorMessage = actionErrorMessage;
  const visibleErrorSummary = quotaExceeded
    ? 'YouTube upload quota reached'
    : actionErrorSummary(actionError) ?? 'Action failed';
  const visibleErrorDetails = actionErrorMessage;
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
      // clientActionId known but not yet visible in list — avoid trapping the UI forever.
      if (jobList.length > 0) {
        setCreateDraftTimedOut(false);
        setCurrentCreateActionId(null);
        addActivity('Draft creation did not return a new job; overlay reset. Create draft can be retried.');
      }
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
    const generationFinished = finalMediaVerified || ['ready_to_publish', 'failed', 'published'].includes(selectedJob?.status ?? '');
    if (generationFinished) {
      clearPendingAction(jobId);
      if (generationTimeoutJobId === jobId) setGenerationTimeoutJobId(null);
      if (finalMediaVerified && reviewStatus !== 'approved') setActiveView('review');
    }
  }, [jobId, selectedJob?.status, pendingActionByJobId, generationTimeoutJobId, finalMediaVerified, reviewStatus]);

  // Staleness TTL: release the generation overlay after 10 minutes without terminal evidence.
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'generate') return;
    const timer = setTimeout(() => {
      if (pendingActionByJobId[jobId] === 'generate') {
        clearPendingAction(jobId);
        if (generationTimeoutJobId === jobId) setGenerationTimeoutJobId(null);
        addActivity(`Generation pending state cleared after timeout for ${jobId}; backend work may still continue.`);
      }
    }, 600_000);
    return () => clearTimeout(timer);
  }, [jobId, pendingActionByJobId, generationTimeoutJobId]);

  // Poll-based clearing of pending actions: approve_review
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'approve_review') return;
    if (reviewStatus === 'approved') {
      clearPendingAction(jobId);
      setActiveView('publish');
    }
  }, [jobId, reviewStatus, pendingActionByJobId]);

  // Staleness TTL: release quick approval actions if no backend confirmation arrives.
  useEffect(() => {
    if (!jobId || !['approve_script', 'approve_review'].includes(pendingActionByJobId[jobId] ?? '')) return;
    const pendingApproval = pendingActionByJobId[jobId];
    const timer = setTimeout(() => {
      if (pendingActionByJobId[jobId] === pendingApproval) {
        clearPendingAction(jobId);
        addActivity(`${pendingApproval === 'approve_script' ? 'Script' : 'Review'} approval pending state cleared after timeout for ${jobId}`);
      }
    }, 120_000);
    return () => clearTimeout(timer);
  }, [jobId, pendingActionByJobId]);

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

  // Staleness TTL: release a timed-out publish overlay and local upload lock after 3 minutes.
  useEffect(() => {
    if (!jobId || pendingActionByJobId[jobId] !== 'publish') return;
    const timer = setTimeout(() => {
      if (pendingActionByJobId[jobId] === 'publish') {
        clearPendingAction(jobId);
        updateActionState(jobId, { uploadStartedAt: undefined });
        addActivity(`Publish pending state cleared after timeout for ${jobId}`);
      }
    }, 180_000);
    return () => clearTimeout(timer);
  }, [jobId, pendingActionByJobId]);

  // Clear stale client errors once canonical backend state proves the action completed.
  useEffect(() => {
    if (selectedApprovalStatus === 'approved' && approve.isError) approve.reset();
    if (finalMediaVerified && generate.isError) generate.reset();
    if (reviewApproved && approveReview.isError) approveReview.reset();
    if (backendDryRunPassed && youtubeDryRun.isError) youtubeDryRun.reset();
    if (selectedUploaded && youtubePublish.isError) youtubePublish.reset();
  }, [selectedApprovalStatus, finalMediaVerified, reviewApproved, backendDryRunPassed, selectedUploaded, approve.isError, generate.isError, approveReview.isError, youtubeDryRun.isError, youtubePublish.isError]);

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
              {visibleErrorDetails ? (
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
      <AwsVideoDashboardHeader
        jobsIsError={jobs.isError}
        statusIsError={status.isError}
        onRefresh={() => void invalidateVideo()}
        runtimeMode={stringField(status.data?.data, 'generationModeRuntime') ?? (status.isLoading && !status.data ? 'loading' : stringField(asRecord(selectedJob), 'mediaSource') === 'hybrid' ? 'hybrid' : stringField(asRecord(selectedJob), 'mediaSource') === 'fixture' ? 'fixture' : 'unknown')}
        counts={counts}
        selectedUploaded={selectedUploaded}
        selectedJobStatus={selectedJob?.status}
        guideSteps={guideSteps}
        recommendedStepKey={recommendedStep?.key ?? null}
      />

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

              <AwsVideoPipelineFlow
                guideSteps={guideSteps}
                recommendedStepKey={recommendedStep?.key ?? null}
                anyPendingTimeout={anyPendingTimeout}
                canApprove={canApprove}
                canGenerate={canGenerate}
                canApproveReview={canApproveReview}
                isApprovePending={approve.isPending}
                isGeneratePending={generate.isPending}
                isApproveReviewPending={approveReview.isPending}
                onCreateDraft={() => setActiveView('create')}
                onApprove={() => { if (jobId) { beginAction(); approve.mutate({ jobIdArg: jobId }); } }}
                onGenerate={() => { if (jobId) { beginAction(); generate.mutate({ jobIdArg: jobId }); } }}
                onApproveReview={() => { if (jobId) { beginAction(); approveReview.mutate({ jobIdArg: jobId, notes: undefined }); } }}
                onPublishStep={() => setActiveView('publish')}
              />

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
              <AwsVideoReviewCard
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
            <AwsVideoJobSelector
              jobsIsError={jobs.isError}
              jobsDiagnostics={jobsDiagnostics}
              jobsErrorMessage={jobs.isError ? errorMessage(jobs.error) : null}
              jobSearchQuery={jobSearchQuery}
              setJobSearchQuery={setJobSearchQuery}
              directJobIdValue={directJobIdValue}
              setDirectJobIdValue={setDirectJobIdValue}
              directJobIdError={directJobIdError}
              setDirectJobIdError={setDirectJobIdError}
              onOpenDirectJobId={openDirectJobId}
              filteredJobList={filteredJobList}
              jobsTotal={jobList.length}
              resolvedJobId={jobId}
              onSelectJob={(id) => { setSelectedJobId(id); setJobSearchQuery(''); setActiveView('overview'); }}
              statusErrorMessage={statusOnlyErrorMessage}
            />
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
            <AwsVideoPublishDiagnosticsCard
              jobId={jobId}
              mediaSource={mediaSource}
              generationMode={generationMode}
              reviewStatus={reviewStatus}
              isPublishingThisJob={isPublishingThisJob}
              selectedPublished={selectedPublished}
              selectedReady={selectedReady}
              dryRunPassedForThisJob={dryRunPassedForThisJob}
              dryRunRunning={dryRunRunning}
              dryRunFailed={dryRunFailed}
              canDryRun={canDryRun}
              canPublish={canPublish}
              publishReadinessLabel={publishReadinessLabel}
              requiresReviewGate={requiresReviewGate}
              reviewApproved={reviewApproved}
              quotaExceeded={quotaExceeded}
              finalVideoAvailable={finalVideoAvailable}
              anyPendingTimeout={anyPendingTimeout}
              imageProvider={imageProvider}
              isHybridMode={isHybridMode}
              isHybridTTSMode={isHybridTTSMode}
              isHybridStoryboardMode={isHybridStoryboardMode}
              isHybridSlideshowMode={isHybridSlideshowMode}
              isHybridImageSlideshowMode={isHybridImageSlideshowMode}
              isFixtureMedia={isFixtureMedia}
              cpArtifactsVideoKey={cpArtifacts?.videoKey ?? cpArtifacts?.finalVideoKey ?? null}
              cpArtifactsAudioKey={cpArtifacts?.audioKey ?? null}
              cpFinalizationPending={cpFinalization?.status === 'pending'}
              artifactData={artifactData}
              publishErrorDetails={publishErrorDetails}
              cpVideoKey={finalVideoKey}
              cpThumbnailKey={thumbnailKey}
              cpPublishKey={(cpReviewMedia?.publishKey as string | undefined) ?? null}
              cpPublishVideoId={cpPublish?.videoId ?? null}
              cpPublishUrl={cpPublish?.url ?? null}
              recommendedStepKey={recommendedStep?.key ?? null}
              dryRunResult={youtubeDryRun.data}
              uploadResult={youtubePublish.data}
              actionState={actionState}
              onDryRun={() => { if (jobId) { beginAction(); youtubeDryRun.mutate({ jobIdArg: jobId }); } }}
              onPublish={() => { if (jobId) { beginAction(); youtubePublish.mutate({ jobIdArg: jobId }); } }}
              onDownload={() => { if (jobId) downloadFinalVideo(jobId); }}
              isDryRunPending={youtubeDryRun.isPending}
              isPublishPending={youtubePublish.isPending}
            />
          ) : null}

          {activeView === 'activity' ? (
            <AwsVideoActivityPanel
              timelineEvents={timelineEvents}
              activity={activity}
            />
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
          <AwsVideoControlPlaneDebugPanel
            rawControlPlaneOk={Boolean(rawControlPlaneResponse)}
            jobId={jobId}
            fetchUrl={controlPlaneHook.fetchUrl}
            timeoutMs={controlPlaneHook.timeoutMs}
            queryStatus={controlPlane.status}
            isLoading={controlPlane.isLoading}
            isError={controlPlane.isError}
            error={controlPlane.error}
            cpPhase={cpPhase}
            selectedApprovalStatus={cpSelectedJob?.approvalStatus ?? 'n/a'}
            reviewStatus={cpReview?.reviewStatus ?? 'n/a'}
            approveReviewEnabled={cpAllowedActions.approve_review?.enabled ?? false}
            generateEnabled={cpAllowedActions.generate?.enabled ?? false}
            finalVideoKey={finalVideoKey}
            thumbnailKey={thumbnailKey}
            controlPlaneDataMissing={!controlPlaneData}
          />

          {/* Status polling diagnostics — shown only on error */}
          {statusOnlyErrorMessage ? (
            <div className="compact-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
              Status poll: {statusOnlyErrorMessage}
            </div>
          ) : null}

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
