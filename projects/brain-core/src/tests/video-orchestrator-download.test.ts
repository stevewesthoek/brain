import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { classifyYouTubeQuotaError, resolveDownloadableVideo, getVideoOrchestratorJobsRoot } from '../providers/video-orchestrator-provider.js';

async function writeGeneratedMediaFixture(jobId: string, publishVideoKey: string): Promise<void> {
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');
  const exportsRoot = join(jobRoot, 'exports');
  const imagesRoot = join(jobRoot, 'images');
  const audioRoot = join(jobRoot, 'audio');
  const videoGeneratedRoot = join(jobRoot, 'video-generated');

  await mkdir(metadataRoot, { recursive: true });
  await mkdir(exportsRoot, { recursive: true });
  await mkdir(imagesRoot, { recursive: true });
  await mkdir(audioRoot, { recursive: true });
  await mkdir(videoGeneratedRoot, { recursive: true });

  await writeFile(join(metadataRoot, 'scene-plan.json'), JSON.stringify({
    jobId,
    scenes: [{ sceneIndex: 1, onScreenText: 'Scene', summary: 'Scene summary' }],
  }, null, 2));
  await writeFile(join(audioRoot, 'narration-script.txt'), 'Narration text.');
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
    title: 'Fixture title',
    cards: [],
    warnings: [],
  }, null, 2));
  await writeFile(join(metadataRoot, 'youtube-package.json'), JSON.stringify({
    jobId,
    title: 'Fixture title',
    videoKey: publishVideoKey,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
  }, null, 2));
  await writeFile(join(metadataRoot, 'publish.json'), JSON.stringify({
    jobId,
    publishStatus: 'pending',
    generationMode: 'hybrid_image_slideshow_video',
    videoKey: publishVideoKey,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
    platforms: { youtube: { status: 'pending' } },
  }, null, 2));
  await writeFile(join(metadataRoot, 'assets.json'), JSON.stringify({
    jobId,
    generationMode: 'hybrid_image_slideshow_video',
    mediaSource: 'hybrid',
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    audioKey: `jobs/${jobId}/audio/narration.mp3`,
    videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
    videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
    finalVideo: `jobs/${jobId}/exports/generated-001-final.mp4`,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    overlayPlanKey: `jobs/${jobId}/metadata/overlay-plan.json`,
    sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`],
    publishableAssets: {
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
      missing: [],
    },
  }, null, 2));
  await writeFile(join(metadataRoot, 'review.json'), JSON.stringify({
    jobId,
    reviewStatus: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'tester',
    notes: null,
    media: {
      scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
      narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
      audioKey: `jobs/${jobId}/audio/narration.mp3`,
      sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`],
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      publishKey: `jobs/${jobId}/metadata/publish.json`,
      youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
      overlayPlanKey: `jobs/${jobId}/metadata/overlay-plan.json`,
    },
  }, null, 2));
}

test('classifyYouTubeQuotaError matches common quota failures', () => {
  for (const input of [
    'quotaExceeded',
    'dailyLimitExceeded',
    'rateLimitExceeded',
    'userRateLimitExceeded',
    'The request cannot be completed because you have exceeded your quota',
    { error: { errors: [{ reason: 'quotaExceeded' }] } },
  ]) {
    assert.equal(classifyYouTubeQuotaError(input), true);
  }
});

test('resolveDownloadableVideo rejects generated-media fixture videos', async () => {
  const jobId = `test-download-fixture-${Date.now()}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  try {
    await writeGeneratedMediaFixture(jobId, 'jobs/test-001/exports/sample-transcoded.mp4');

    const result = await resolveDownloadableVideo(jobId);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'generated_media_publish_assets_invalid');
    }
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('resolveDownloadableVideo resolves canonical final MP4 for generated-media jobs', async () => {
  const jobId = `test-download-final-${Date.now()}`;
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  try {
    await writeGeneratedMediaFixture(jobId, `jobs/${jobId}/exports/generated-001-final.mp4`);
    const result = await resolveDownloadableVideo(jobId);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.videoKey, `jobs/${jobId}/exports/generated-001-final.mp4`);
      assert.ok(result.localPath?.endsWith('generated-001-final.mp4'));
    }
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});
