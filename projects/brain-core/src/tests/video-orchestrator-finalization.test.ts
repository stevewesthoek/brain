import assert from 'node:assert/strict';
import test from 'node:test';
import { getMissingReviewMediaFields, mergeReviewMetadata, type VideoReviewMetadata } from '../providers/video-orchestrator-provider.js';

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
