'use client';

import { BRAIN_CORE_URL } from '@/lib/braincore-client';
import { timeAgo } from '@/lib/utils';
import type { VideoReview } from '@/lib/braincore-schemas';

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

function downloadFinalVideo(jobId: string): void {
  window.open(`${BRAIN_CORE_URL}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/video`, '_blank', 'noopener,noreferrer');
}

export interface AwsVideoReviewCardProps {
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
}

export function AwsVideoReviewCard({
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
}: AwsVideoReviewCardProps) {
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
  // If control-plane is unavailable, report missing media without fallback reconstruction.
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
                src={`${BRAIN_CORE_URL}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/thumbnail?key=${encodeURIComponent(reviewMedia.thumbnailKey)}&ts=${encodeURIComponent(reviewData?.updatedAt ?? reviewMedia.thumbnailKey ?? '')}`}
                alt={`Generated thumbnail: ${reviewMedia.thumbnailKey}`}
                style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px', border: '1px solid var(--border)' }}
                onError={(event) => {
                  const image = event.currentTarget;
                  const retryCount = Number(image.dataset.retryCount ?? '0');
                  if (retryCount < 3) {
                    const nextRetryCount = retryCount + 1;
                    image.dataset.retryCount = String(nextRetryCount);
                    window.setTimeout(() => {
                      if (!image.isConnected) return;
                      const retryUrl = new URL(image.src);
                      retryUrl.searchParams.set('retry', `${Date.now()}-${nextRetryCount}`);
                      image.src = retryUrl.toString();
                    }, nextRetryCount * 2_000);
                    return;
                  }
                  image.style.display = 'none';
                  image.nextElementSibling?.removeAttribute('hidden');
                }}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  image.style.display = '';
                  image.nextElementSibling?.setAttribute('hidden', '');
                }}
              />
              <div hidden style={{ padding: '0.75rem', backgroundColor: 'var(--muted)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                Thumbnail preview is not ready in the dashboard yet. Refresh after generation completes; if this remains visible, the publish package is incomplete or the thumbnail endpoint could not load the asset.
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              The dashboard previews thumbnails through Brain Core; no terminal command is required.
            </div>
          </div>
        </details>
      )}
      {reviewMedia?.videoKey ? (
        <div style={{ marginBottom: '1rem' }}>
          <button
            className="button secondary"
            onClick={() => downloadFinalVideo(jobId)}
            disabled={finalizationState !== 'complete'}
            title={finalizationState === 'complete' ? 'Download the final MP4' : 'Final MP4 download unlocks after the publish package is complete.'}
          >
            Download final MP4
          </button>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.35rem' }}>
            {finalizationState === 'complete'
              ? 'Use this when YouTube upload quota is reached or to inspect video quality locally.'
              : 'Final MP4 is not available until generation and publish-package finalization complete.'}
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
