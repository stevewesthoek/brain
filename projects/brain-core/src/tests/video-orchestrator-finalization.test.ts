import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import {
  approveVideoReview,
  finalizeAwsVideoPublishPackage,
  getMissingReviewMediaFields,
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
