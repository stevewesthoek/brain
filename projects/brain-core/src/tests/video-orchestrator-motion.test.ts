import assert from 'node:assert/strict';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { buildDeterministicMotionLayer, getVideoOrchestratorJobsRoot, finalizeAwsVideoPublishPackage } from '../providers/video-orchestrator-provider.js';

const ONE_BY_ONE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6X4n0AAAAASUVORK5CYII=', 'base64');

async function setupMotionJob(jobId: string): Promise<string> {
  const jobsRoot = getVideoOrchestratorJobsRoot();
  const jobRoot = join(jobsRoot, jobId);
  const metadataRoot = join(jobRoot, 'metadata');
  const imagesRoot = join(jobRoot, 'images');
  const audioRoot = join(jobRoot, 'audio');
  const exportsRoot = join(jobRoot, 'exports');
  const videoGeneratedRoot = join(jobRoot, 'video-generated');
  await mkdir(metadataRoot, { recursive: true });
  await mkdir(imagesRoot, { recursive: true });
  await mkdir(audioRoot, { recursive: true });
  await mkdir(exportsRoot, { recursive: true });
  await mkdir(videoGeneratedRoot, { recursive: true });
  await writeFile(join(metadataRoot, 'scene-plan.json'), JSON.stringify({
    jobId,
    scenes: [
      { index: 0, durationSeconds: 3, visualPrompt: 'scene 1', narrationText: 'scene 1', onScreenText: 'scene 1' },
      { index: 1, durationSeconds: 3, visualPrompt: 'scene 2', narrationText: 'scene 2', onScreenText: 'scene 2' },
    ],
  }, null, 2));
  await writeFile(join(audioRoot, 'narration-script.txt'), 'scene 1\nscene 2');
  await writeFile(join(imagesRoot, 'scene-001.png'), ONE_BY_ONE_PNG);
  await writeFile(join(imagesRoot, 'scene-002.png'), ONE_BY_ONE_PNG);
  await writeFile(join(audioRoot, 'narration.mp3'), Buffer.from('stub-audio'));
  return jobRoot;
}

test('buildDeterministicMotionLayer creates motion plan and clips', async () => {
  const jobId = `motion-plan-${Date.now()}`;
  const jobRoot = await setupMotionJob(jobId);
  try {
    const result = await buildDeterministicMotionLayer({
      jobId,
      jobRoot,
      metadataDir: join(jobRoot, 'metadata'),
      scenePlan: JSON.parse(await readFile(join(jobRoot, 'metadata', 'scene-plan.json'), 'utf-8')),
      sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`, `jobs/${jobId}/images/scene-002.png`],
      imageGenerationSettings: { width: 1280, height: 720 },
    });

    assert.equal(result.fallbackUsed, false, result.fallbackReason ?? 'expected motion generation to succeed');
    assert.equal(result.motionClipKeys.length, 2);
    assert.equal(result.motionFrameKeys.length, 2);
    assert.equal(result.motionPlan.provider, 'local-ffmpeg-motion');
    assert.equal(result.motionPlan.mode, 'ken-burns');
    assert.equal(result.motionPlan.sceneCount, 2);
    assert.equal(result.motionPlan.generatedClipKeys.length, 2);
    assert.equal(result.motionPlan.generatedFrameKeys.length, 2);
    assert.equal(result.motionPlan.fallbackUsed, false);
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('buildDeterministicMotionLayer falls back when source scene image is missing', async () => {
  const jobId = `motion-fallback-${Date.now()}`;
  const jobRoot = await setupMotionJob(jobId);
  try {
    await rm(join(jobRoot, 'images', 'scene-002.png'), { force: true });
    const result = await buildDeterministicMotionLayer({
      jobId,
      jobRoot,
      metadataDir: join(jobRoot, 'metadata'),
      scenePlan: JSON.parse(await readFile(join(jobRoot, 'metadata', 'scene-plan.json'), 'utf-8')),
      sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`, `jobs/${jobId}/images/scene-002.png`],
      imageGenerationSettings: { width: 1280, height: 720 },
    });

    assert.equal(result.fallbackUsed, true);
    assert.equal(result.motionPlan.provider, 'local-ffmpeg-motion');
    assert.equal(result.motionPlan.generatedClipKeys.length, 0);
    assert.equal(result.motionPlan.fallbackReason?.includes('missing source scene image'), true);
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});

test('finalizeAwsVideoPublishPackage keeps canonical publish package intact', async () => {
  const jobId = `motion-finalize-${Date.now()}`;
  const jobRoot = await setupMotionJob(jobId);
  try {
    await writeFile(join(jobRoot, 'video-generated', 'generated-001.mp4'), Buffer.from('stub-video'));
    await writeFile(join(jobRoot, 'exports', 'generated-001-final.mp4'), Buffer.from('stub-final'));
    await writeFile(join(jobRoot, 'exports', 'thumbnail-001.jpg'), Buffer.from('stub-thumb'));
    await writeFile(join(jobRoot, 'metadata', 'overlay-plan.json'), JSON.stringify({
      jobId,
      provider: 'deterministic-overlay',
      mode: 'hybrid_image_slideshow',
      title: 'x',
      warnings: [],
      cards: [],
    }, null, 2));
    await writeFile(join(jobRoot, 'metadata', 'thumbnail.json'), JSON.stringify({
      jobId,
      thumbnailStatus: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'selected-scene-image',
      source: { kind: 'scene-image', key: `jobs/${jobId}/images/scene-001.png` },
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      previewKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      width: 1280,
      height: 720,
      mimeType: 'image/jpeg',
      titleOverlay: null,
      prompt: null,
      warnings: [],
    }, null, 2));
    await writeFile(join(jobRoot, 'metadata', 'publish.json'), JSON.stringify({
      jobId,
      generationMode: 'hybrid_image_slideshow_video',
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
    }, null, 2));
    await writeFile(join(jobRoot, 'metadata', 'youtube-package.json'), JSON.stringify({
      jobId,
      title: 'x',
      description: 'y',
      tags: [],
      videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
      scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
      narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    }, null, 2));
    await writeFile(join(jobRoot, 'metadata', 'review.json'), JSON.stringify({ jobId, reviewStatus: 'pending', media: { scenePlanKey: null, narrationScriptKey: null, audioKey: null, sceneImageKeys: [], videoKey: null, thumbnailKey: null, publishKey: null, youtubePackageKey: null, overlayPlanKey: null } }, null, 2));
    await writeFile(join(jobRoot, 'metadata', 'assets.json'), JSON.stringify({
      jobId,
      generationMode: 'hybrid_image_slideshow_video',
      motionGenerated: true,
      motionProvider: 'local-ffmpeg-motion',
      motionPlanKey: `jobs/${jobId}/metadata/motion-plan.json`,
      motionClipKeys: [`jobs/${jobId}/motion/scene-001.mp4`],
      motionFrameKeys: [`jobs/${jobId}/frames/frame-001.png`],
      fallbackUsed: false,
      fallbackReason: null,
      sceneImageKeys: [`jobs/${jobId}/images/scene-001.png`, `jobs/${jobId}/images/scene-002.png`],
    }, null, 2));

    const finalized = await finalizeAwsVideoPublishPackage(jobId);
    assert.equal(finalized.ok, true);
    if (finalized.ok) {
      assert.equal(finalized.publish?.youtubePackageKey, `jobs/${jobId}/metadata/youtube-package.json`);
      assert.equal(finalized.review?.media.videoKey, `jobs/${jobId}/exports/generated-001-final.mp4`);
    }
  } finally {
    await rm(jobRoot, { recursive: true, force: true });
  }
});
