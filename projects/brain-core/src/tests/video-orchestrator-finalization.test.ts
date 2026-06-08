import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  approveVideoReview,
  finalizeAwsVideoPublishPackage,
  getMissingReviewMediaFields,
  getVideoJobExecutionStatus,
  getVideoOrchestratorJobsRoot,
  getVideoReview,
  mergeReviewMetadata,
  type VideoReviewMedia,
  type VideoReviewMetadata,
} from '../providers/video-orchestrator-provider.js';

const canonicalMedia = {
  scenePlanKey: 'jobs/test-001/metadata/scene-plan.json',
  narrationScriptKey: 'jobs/test-001/audio/narration-script.txt',
  audioKey: 'jobs/test-001/audio/narration.mp3',
  sceneImageKeys: ['jobs/test-001/images/scene-001.png'],
  videoKey: 'jobs/test-001/exports/generated-001-final.mp4',
  thumbnailKey: 'jobs/test-001/exports/thumbnail-001.jpg',
  publishKey: 'jobs/test-001/metadata/publish.json',
  youtubePackageKey: 'jobs/test-001/metadata/youtube-package.json',
  overlayPlanKey: 'jobs/test-001/metadata/overlay-plan.json',
};

function makeReview(reviewStatus: VideoReviewMetadata['reviewStatus'], overrides: Partial<VideoReviewMetadata> = {}): VideoReviewMetadata {
  return {
    jobId: 'test-001',
    reviewStatus,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    reviewedAt: reviewStatus === 'approved' ? '2026-01-01T00:00:00.000Z' : null,
    reviewedBy: reviewStatus === 'approved' ? 'tester' : null,
    notes: null,
    media: { ...canonicalMedia },
    ...overrides,
  };
}

test('mergeReviewMetadata preserves approved review state over pending remote data', () => {
  const local = makeReview('approved');
  const remote = makeReview('pending', {
    media: {
      ...canonicalMedia,
      videoKey: null,
      thumbnailKey: null,
    },
  });

  const merged = mergeReviewMetadata(local, remote, 'test-001');

  assert.equal(merged?.reviewStatus, 'approved');
  assert.equal(merged?.media.videoKey, canonicalMedia.videoKey);
  assert.equal(merged?.media.thumbnailKey, canonicalMedia.thumbnailKey);
});

test('getMissingReviewMediaFields reports exact missing fields', () => {
  const missing = getMissingReviewMediaFields({
    scenePlanKey: null,
    narrationScriptKey: null,
    audioKey: null,
    sceneImageKeys: [],
    videoKey: null,
    thumbnailKey: null,
    publishKey: null,
    youtubePackageKey: null,
    overlayPlanKey: null,
  });

  assert.deepEqual(missing, [
    'scenePlanKey',
    'narrationScriptKey',
    'audioKey',
    'sceneImageKeys',
    'videoKey',
    'thumbnailKey',
    'publishKey',
    'youtubePackageKey',
  ]);
});

test('finalize, get review, and approve share the same canonical media contract', async () => {
  const jobId = `test-finalize-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');
  const audioRoot = join(jobRoot, 'audio');
  const exportsRoot = join(jobRoot, 'exports');
  const videoGeneratedRoot = join(jobRoot, 'video-generated');
  const imagesRoot = join(jobRoot, 'images');

  const canonicalMedia: VideoReviewMedia = {
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    audioKey: `jobs/${jobId}/audio/narration.mp3`,
    sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`],
    videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    publishKey: `jobs/${jobId}/metadata/publish.json`,
    youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
    overlayPlanKey: `jobs/${jobId}/metadata/overlay-plan.json`,
  };

  try {
    await mkdir(metadataRoot, { recursive: true });
    await mkdir(audioRoot, { recursive: true });
    await mkdir(exportsRoot, { recursive: true });
    await mkdir(videoGeneratedRoot, { recursive: true });
    await mkdir(imagesRoot, { recursive: true });

    await writeFile(join(metadataRoot, 'scene-plan.json'), JSON.stringify({
      jobId,
      scenes: [{ sceneIndex: 1, onScreenText: 'A growing tree', summary: 'A tree growing over time' }],
    }, null, 2));
    await writeFile(join(audioRoot, 'narration-script.txt'), 'A tree grows quietly over time.');
    await writeFile(join(audioRoot, 'narration.mp3'), Buffer.from('stub-audio'));
    await writeFile(join(imagesRoot, 'scene-001.png'), Buffer.from('stub-scene-image'));
    await writeFile(join(videoGeneratedRoot, 'generated-001.mp4'), Buffer.from('stub-generated-video'));
    await writeFile(join(exportsRoot, 'generated-001-final.mp4'), Buffer.from('stub-final-video'));
    await writeFile(join(exportsRoot, 'thumbnail-001.jpg'), Buffer.from('stub-thumbnail'));
    await writeFile(join(metadataRoot, 'overlay-plan.json'), JSON.stringify({
      jobId,
      provider: 'deterministic-overlay',
      createdAt: new Date().toISOString(),
      mode: 'hybrid_image_slideshow',
      title: 'A growing tree',
      style: {
        position: 'lower-third',
        safeMargin: 64,
        fontSize: 44,
        titleFontSize: 58,
      },
      cards: [
        { type: 'intro', text: 'A growing tree', durationSeconds: 3 },
        { type: 'scene', sceneIndex: 1, text: 'A tree growing over time', imageKey: `jobs/${jobId}/images/scene-001.png`, durationSeconds: 20 },
        { type: 'end', text: 'A growing tree', durationSeconds: 3 },
      ],
      warnings: [],
    }, null, 2));
    await writeFile(join(metadataRoot, 'youtube-package.json'), JSON.stringify({
      jobId,
      title: 'A growing tree',
      videoKey: canonicalMedia.videoKey,
      thumbnailKey: canonicalMedia.thumbnailKey,
      scenePlanKey: canonicalMedia.scenePlanKey,
      narrationScriptKey: canonicalMedia.narrationScriptKey,
    }, null, 2));
    await writeFile(join(metadataRoot, 'publish.json'), JSON.stringify({
      jobId,
      videoKey: canonicalMedia.videoKey,
      thumbnailKey: canonicalMedia.thumbnailKey,
      youtubePackageKey: canonicalMedia.youtubePackageKey,
      generationMode: 'hybrid_image_slideshow_video',
    }, null, 2));
    await writeFile(join(metadataRoot, 'assets.json'), JSON.stringify({
      jobId,
      generationMode: 'hybrid_image_slideshow_video',
      mediaSource: 'hybrid',
      scenePlanKey: canonicalMedia.scenePlanKey,
      narrationScriptKey: canonicalMedia.narrationScriptKey,
      audioKey: canonicalMedia.audioKey,
      videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
      videoKey: canonicalMedia.videoKey,
      finalVideo: canonicalMedia.videoKey,
      thumbnailKey: canonicalMedia.thumbnailKey,
      overlayPlanKey: canonicalMedia.overlayPlanKey,
      sceneImageKeys: canonicalMedia.sceneImageKeys,
      publishableAssets: {
        videoKey: canonicalMedia.videoKey,
        thumbnailKey: canonicalMedia.thumbnailKey,
        narrationKey: canonicalMedia.audioKey,
        missing: [],
      },
    }, null, 2));
    await writeFile(join(metadataRoot, 'review.json'), JSON.stringify({
      jobId,
      reviewStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      notes: null,
      media: {
        scenePlanKey: null,
        narrationScriptKey: null,
        audioKey: null,
        sceneImageKeys: [],
        videoKey: null,
        thumbnailKey: null,
        publishKey: null,
        youtubePackageKey: null,
        overlayPlanKey: null,
      },
    }, null, 2));

    const finalized = await finalizeAwsVideoPublishPackage(jobId);
    assert.equal(finalized.ok, true);
    if (!finalized.ok) return;
    assert.deepEqual(finalized.media, canonicalMedia);
    assert.deepEqual(finalized.review?.media, canonicalMedia);

    const reviewBeforeApprove = await getVideoReview(jobId);
    assert.equal(reviewBeforeApprove.ok, true);
    if (!reviewBeforeApprove.ok) return;
    assert.equal(reviewBeforeApprove.review.reviewStatus, 'pending');
    assert.deepEqual(reviewBeforeApprove.review.media, canonicalMedia);

    const approved = await approveVideoReview(jobId, {
      reviewedBy: 'brain-console-center',
      notes: 'approval smoke',
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.review.reviewStatus, 'approved');
    assert.deepEqual(approved.review.media, canonicalMedia);

    const reviewAfterApprove = await getVideoReview(jobId);
    assert.equal(reviewAfterApprove.ok, true);
    if (!reviewAfterApprove.ok) return;
    assert.equal(reviewAfterApprove.review.reviewStatus, 'approved');
    assert.deepEqual(reviewAfterApprove.review.media, canonicalMedia);
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('createJobFromPrompt dedup: second request with same channelId+prompt returns cached result with duplicateSuppressed flag', async () => {
  // This test verifies the in-memory dedup map prevents duplicate job creation
  // within the 30s TTL window
  // Note: This test requires a valid channel config to exist (prochat or test channel)
  // If the channel doesn't exist, both requests will fail and dedup won't be tested
  const { createJobFromPrompt } = await import('../providers/video-orchestrator-provider.js');

  const channelId = 'prochat';
  const prompt = 'A tree growing over time for dedup test';

  const result1 = await createJobFromPrompt({
    channelId,
    prompt,
    requestedBy: 'test-suite',
  });

  // Skip test if channel config doesn't exist
  if (!result1.ok && (result1 as unknown as Record<string, unknown>).code === 'invalid_channel') {
    console.log('Skipping dedup test: channel config not found');
    return;
  }

  assert.equal(result1.ok, true, `First call failed: ${!result1.ok ? (result1 as unknown as Record<string, unknown>).message : ''}`);
  if (!result1.ok) return;

  const jobId1 = result1.jobId;

  // Call again immediately with same channelId+prompt
  const result2 = await createJobFromPrompt({
    channelId,
    prompt,
    requestedBy: 'test-suite',
  });

  assert.equal(result2.ok, true);
  if (!result2.ok) return;

  // Should return same jobId
  assert.equal(result2.jobId, jobId1);

  // Should include duplicateSuppressed flag
  assert.equal(result2.duplicateSuppressed, true);
});

test('createJobFromPrompt with clientActionId: second request with same clientActionId returns same job', async () => {
  // This test verifies that clientActionId-based dedup works correctly
  const { createJobFromPrompt } = await import('../providers/video-orchestrator-provider.js');

  const channelId = 'prochat';
  const prompt = 'Test clientActionId dedup';
  const clientActionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result1 = await createJobFromPrompt({
    channelId,
    prompt,
    requestedBy: 'test-suite',
    clientActionId,
  });

  if (!result1.ok && (result1 as unknown as Record<string, unknown>).code === 'invalid_channel') {
    console.log('Skipping clientActionId test: channel config not found');
    return;
  }

  assert.equal(result1.ok, true);
  if (!result1.ok) return;

  const jobId1 = result1.jobId;

  // Call again with same clientActionId but different prompt
  const result2 = await createJobFromPrompt({
    channelId,
    prompt: 'Different prompt entirely',
    requestedBy: 'test-suite',
    clientActionId,
  });

  assert.equal(result2.ok, true);
  if (!result2.ok) return;

  // Should return same jobId (dedup by clientActionId, not prompt)
  assert.equal(result2.jobId, jobId1);
  assert.equal(result2.duplicateSuppressed, true);
});

test('createJobFromPrompt in-flight dedup: concurrent requests with same clientActionId return accepted state', async () => {
  // This test verifies that in-flight requests return accepted: true, inFlight: true
  // instead of creating duplicate jobs
  const { createJobFromPrompt } = await import('../providers/video-orchestrator-provider.js');

  const channelId = 'prochat';
  const prompt = 'Test concurrent in-flight dedup';
  const clientActionId = `concurrent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Fire both requests immediately (without awaiting first)
  const promise1 = createJobFromPrompt({
    channelId,
    prompt,
    requestedBy: 'test-suite',
    clientActionId,
  });

  const promise2 = createJobFromPrompt({
    channelId,
    prompt,
    requestedBy: 'test-suite',
    clientActionId,
  });

  const [result1, result2] = await Promise.all([promise1, promise2]);

  if (!result1.ok && (result1 as unknown as Record<string, unknown>).code === 'invalid_channel') {
    console.log('Skipping in-flight dedup test: channel config not found');
    return;
  }

  // First should be ok: true
  assert.equal(result1.ok, true);
  if (!result1.ok) return;

  // Second should also be ok: true
  assert.equal(result2.ok, true);
  if (!result2.ok) return;

  // Second should be marked as either inFlight (arrived while first was running)
  // or duplicateSuppressed (arrived after first completed)
  assert(result2.inFlight || result2.duplicateSuppressed, 'Second request should be marked inFlight or duplicateSuppressed');

  // If not in-flight, both should reference the same job
  if (!result2.inFlight) {
    assert.equal(result2.jobId, result1.jobId);
    assert.equal(result2.duplicateSuppressed, true);
  }
});

test('review finalization state: getVideoReview includes finalization field for generated-media jobs', async () => {
  // This test verifies that getVideoReview includes finalization state information
  // for generated-media jobs at ready_to_publish state
  const { getVideoReview } = await import('../providers/video-orchestrator-provider.js');

  const jobId = `test-finalize-state-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');
  const audioRoot = join(jobRoot, 'audio');
  const exportsRoot = join(jobRoot, 'exports');
  const imagesRoot = join(jobRoot, 'images');

  try {
    await mkdir(metadataRoot, { recursive: true });
    await mkdir(audioRoot, { recursive: true });
    await mkdir(exportsRoot, { recursive: true });
    await mkdir(imagesRoot, { recursive: true });

    // Create minimal media files
    await writeFile(join(metadataRoot, 'scene-plan.json'), JSON.stringify({
      jobId,
      scenes: [{ sceneIndex: 1, onScreenText: 'Test', summary: 'Test' }],
    }, null, 2));
    await writeFile(join(audioRoot, 'narration-script.txt'), 'Test.');
    await writeFile(join(audioRoot, 'narration.mp3'), Buffer.from('audio'));
    await writeFile(join(imagesRoot, 'scene-001.png'), Buffer.from('image'));
    await writeFile(join(exportsRoot, 'generated-001-final.mp4'), Buffer.from('video'));
    await writeFile(join(exportsRoot, 'thumbnail-001.jpg'), Buffer.from('thumb'));

    // Create status.json with ready_to_publish for a generated-media job
    await writeFile(join(metadataRoot, 'status.json'), JSON.stringify({
      jobId,
      status: 'ready_to_publish',
      generationMode: 'hybrid_slideshow_video',
    }, null, 2));

    // Create assets.json with generationMode
    await writeFile(join(metadataRoot, 'assets.json'), JSON.stringify({
      jobId,
      generationMode: 'hybrid_slideshow_video',
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    }, null, 2));

    // Create review.json with all null media
    await writeFile(join(metadataRoot, 'review.json'), JSON.stringify({
      jobId,
      reviewStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      notes: null,
      media: {
        scenePlanKey: null,
        narrationScriptKey: null,
        audioKey: null,
        sceneImageKeys: [],
        videoKey: null,
        thumbnailKey: null,
        publishKey: null,
        youtubePackageKey: null,
        overlayPlanKey: null,
      },
    }, null, 2));

    // Call getVideoReview which should trigger finalization for ready_to_publish jobs
    const result = await getVideoReview(jobId);

    assert.equal(result.ok, true, `getVideoReview failed: ${result.ok ? '' : (result as any).error}`);
    if (!result.ok) return;

    // Finalization info should be present in review
    assert(result.review.finalization !== undefined, 'finalization field should be present');
    assert.equal(typeof result.review.finalization.attempted, 'boolean');
    assert.equal(typeof result.review.finalization.ok, 'boolean');
    assert(Array.isArray(result.review.finalization.missing));
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('already-approved job: getVideoReview preserves reviewStatus after finalization', async () => {
  // This test verifies that finalizing an already-approved job
  // keeps the reviewStatus as 'approved' (no downgrade)
  // This reuses the setup from the main finalization test which has full media
  const { approveVideoReview, getVideoReview } = await import('../providers/video-orchestrator-provider.js');
  const { finalizeAwsVideoPublishPackage } = await import('../providers/video-orchestrator-provider.js');

  const jobId = `test-approved-final-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');
  const audioRoot = join(jobRoot, 'audio');
  const exportsRoot = join(jobRoot, 'exports');
  const videoGeneratedRoot = join(jobRoot, 'video-generated');
  const imagesRoot = join(jobRoot, 'images');

  const canonicalMedia = {
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    audioKey: `jobs/${jobId}/audio/narration.mp3`,
    sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`],
    videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    publishKey: `jobs/${jobId}/metadata/publish.json`,
    youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
    overlayPlanKey: `jobs/${jobId}/metadata/overlay-plan.json`,
  };

  try {
    await mkdir(metadataRoot, { recursive: true });
    await mkdir(audioRoot, { recursive: true });
    await mkdir(exportsRoot, { recursive: true });
    await mkdir(videoGeneratedRoot, { recursive: true });
    await mkdir(imagesRoot, { recursive: true });

    // Create all required media files
    await writeFile(join(metadataRoot, 'scene-plan.json'), JSON.stringify({
      jobId,
      scenes: [{ sceneIndex: 1, onScreenText: 'Test', summary: 'Test' }],
    }, null, 2));
    await writeFile(join(audioRoot, 'narration-script.txt'), 'Test.');
    await writeFile(join(audioRoot, 'narration.mp3'), Buffer.from('audio'));
    await writeFile(join(imagesRoot, 'scene-001.png'), Buffer.from('image'));
    await writeFile(join(videoGeneratedRoot, 'generated-001.mp4'), Buffer.from('generated'));
    await writeFile(join(exportsRoot, 'generated-001-final.mp4'), Buffer.from('video'));
    await writeFile(join(exportsRoot, 'thumbnail-001.jpg'), Buffer.from('thumb'));
    await writeFile(join(metadataRoot, 'publish.json'), JSON.stringify({
      jobId,
      videoKey: canonicalMedia.videoKey,
      thumbnailKey: canonicalMedia.thumbnailKey,
    }, null, 2));
    await writeFile(join(metadataRoot, 'youtube-package.json'), JSON.stringify({
      jobId,
      title: 'Test',
    }, null, 2));
    await writeFile(join(metadataRoot, 'overlay-plan.json'), JSON.stringify({
      jobId,
      provider: 'test',
      cards: [],
    }, null, 2));
    await writeFile(join(metadataRoot, 'assets.json'), JSON.stringify({
      jobId,
      generationMode: 'hybrid_slideshow_video',
    }, null, 2));

    // Create review.json with complete media
    await writeFile(join(metadataRoot, 'review.json'), JSON.stringify({
      jobId,
      reviewStatus: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'test-setup',
      notes: null,
      media: canonicalMedia,
    }, null, 2));

    // Now call getVideoReview which will finalize for approved jobs
    const reviewAfterFinalize = await getVideoReview(jobId);

    assert.equal(reviewAfterFinalize.ok, true, `getVideoReview failed`);
    if (!reviewAfterFinalize.ok) return;

    // Review status should still be 'approved' after finalization
    assert.equal(reviewAfterFinalize.review.reviewStatus, 'approved', 'reviewStatus should remain approved');
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('execution endpoint resilience: getVideoJobExecutionStatus returns base structure when status.json missing', async () => {
  // Regression test for: execution endpoint returns "Job not found" even though job exists with script.json + assets
  // Root cause: status.json missing → early return null → 404 error from route
  // Fix: Validate job exists (script.json present), then return base execution structure with default values
  const jobId = `test-exec-missing-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');

  try {
    await mkdir(metadataRoot, { recursive: true });

    // Create minimal job structure: script.json only (NO status.json)
    // This matches the real job: prochat-prompt-1780856968989-make-a-video-of-a-box-
    await writeFile(join(metadataRoot, 'script.json'), JSON.stringify({
      jobId,
      status: 'approved',
      approval: {
        required: true,
        status: 'approved',
        approvedBy: 'brain-console-center',
        approvedAt: new Date().toISOString(),
      },
    }, null, 2));

    // Call execution endpoint directly
    const execution = await getVideoJobExecutionStatus(jobId);

    // Must NOT return null (that would cause 404 in the route)
    assert.ok(execution !== null, 'execution must not be null when script.json exists');
    assert.equal(execution.jobId, jobId, 'jobId must match request');
    assert.equal(execution.awsStatus, null, 'awsStatus should be null (no executionArn)');
    assert.equal(execution.executionArn, null, 'executionArn should be null (missing from status.json)');
    assert.equal(execution.localStatus, 'pending', 'localStatus should default to pending when status.json missing');
    assert.ok(execution.checkedAt, 'checkedAt must be present');
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});
