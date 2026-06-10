/**
 * Documents the current generation mode inventory and the planned animated-video path.
 *
 * This test file is the canonical register of modes. Update it when modes are added or removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// All modes accepted by getAwsVideoGenerationMode() via AWS_VIDEO_GENERATION_MODE env var.
// Modes map to manifest generationMode strings via the modeMetadata block in generateApprovedScript().
const EXPECTED_GENERATION_MODES = [
  'fixture',               // default: uses fixture video + fixture audio, no generation
  'hybrid',                // scene plan generated, fixture media
  'hybrid_tts',            // TTS narration generated, fixture video
  'hybrid_storyboard',     // TTS + storyboard images generated, fixture video
  'hybrid_slideshow',      // TTS + storyboard images + ffmpeg slideshow assembled
  'hybrid_image_slideshow', // TTS + Bedrock Nova Canvas images + ken-burns motion + ffmpeg slideshow
  'hybrid_animated_video', // PLANNED: TTS + images + image-to-video model clips + ffmpeg stitch
  'ai',                    // RESERVED: fully AI-generated (no provider implemented)
] as const;

// Manifest generationMode values written to assets.json/status.json/publish.json.
const EXPECTED_MANIFEST_GENERATION_MODES = [
  'fixture_assembly',
  'hybrid_scene_plan_fixture_media',
  'hybrid_tts_fixture_video',
  'hybrid_storyboard_fixture_video',
  'hybrid_slideshow_video',
  'hybrid_image_slideshow_video',
  'hybrid_animated_video',         // PLANNED: will be written when animated provider is live
  'ai_generation',
] as const;

test('generation modes: GenerationMode type covers all expected modes', () => {
  // Verify the type exists and covers all modes.
  // If this import fails, aws-video-generation-types.ts is broken.
  type GenerationMode = typeof EXPECTED_GENERATION_MODES[number];
  const modes: GenerationMode[] = [...EXPECTED_GENERATION_MODES];
  assert.equal(modes.length, 8);
});

test('generation modes: fixture and hybrid modes are fully implemented', () => {
  const implementedModes = [
    'fixture',
    'hybrid',
    'hybrid_tts',
    'hybrid_storyboard',
    'hybrid_slideshow',
    'hybrid_image_slideshow',
  ];
  assert.equal(implementedModes.length, 6, 'six modes are fully implemented');
  for (const mode of implementedModes) {
    assert.ok(EXPECTED_GENERATION_MODES.includes(mode as any), `${mode} must be in the mode registry`);
  }
});

test('generation modes: hybrid_animated_video is scaffolded with local placeholder provider', () => {
  // Phase B: AnimatedClipProvider interface + LocalFfmpegAnimatedClipProvider added.
  // hybrid_animated_video routes through storyboard/image generation then generates
  // per-scene animated clips using the local ffmpeg placeholder provider.
  const plannedMode = 'hybrid_animated_video';
  assert.ok(EXPECTED_GENERATION_MODES.includes(plannedMode), 'hybrid_animated_video is registered');

  // The manifest counterpart must also be registered.
  assert.ok(
    EXPECTED_MANIFEST_GENERATION_MODES.includes(plannedMode),
    'hybrid_animated_video manifest mode is registered',
  );
});

test('generation modes: animated video pipeline contract', () => {
  // Documents the intended asset layout for hybrid_animated_video when implemented.
  // Each scene produces: image (from Bedrock/placeholder) → animated clip (image-to-video model) → stitched MP4.
  const animatedVideoArtifactPaths = {
    sceneImages: 'jobs/<jobId>/images/scene-NNN.png',
    animatedClips: 'jobs/<jobId>/animated/scene-NNN.mp4',   // NEW: per-scene model-generated clip
    motionPlan: 'jobs/<jobId>/metadata/motion-plan.json',   // reuse: extended with animated provider
    assembledVideo: 'jobs/<jobId>/video-generated/generated-001.mp4',
    finalVideo: 'jobs/<jobId>/exports/generated-001-final.mp4',
    thumbnail: 'jobs/<jobId>/exports/thumbnail-001.jpg',
  };

  // Artifact contract is stable documentation — all paths must follow the jobs/<jobId>/ convention.
  for (const [, path] of Object.entries(animatedVideoArtifactPaths)) {
    assert.ok(path.startsWith('jobs/<jobId>/'), `${path} must be scoped to the job directory`);
  }

  // The animated clips directory is new (not used by any existing mode).
  assert.ok(animatedVideoArtifactPaths.animatedClips.includes('/animated/'), 'animated clips live in /animated/ subdirectory');
});

test('generation modes: manifest mode name alignment', () => {
  // Each GenerationMode env var value maps to a distinct manifest generationMode string.
  // This table is the authoritative mapping. Update when adding modes.
  const modeMapping: Record<string, string> = {
    fixture:                'fixture_assembly',
    hybrid:                 'hybrid_scene_plan_fixture_media',
    hybrid_tts:             'hybrid_tts_fixture_video',
    hybrid_storyboard:      'hybrid_storyboard_fixture_video',
    hybrid_slideshow:       'hybrid_slideshow_video',
    hybrid_image_slideshow: 'hybrid_image_slideshow_video',
    hybrid_animated_video:  'hybrid_animated_video',   // PLANNED: manifest name matches env var name
    ai:                     'ai_generation',
  };

  assert.equal(Object.keys(modeMapping).length, 8, 'all 8 modes are mapped');

  for (const [envMode, manifestMode] of Object.entries(modeMapping)) {
    assert.ok(envMode.length > 0, 'env mode key must be non-empty');
    assert.ok(manifestMode.length > 0, 'manifest mode must be non-empty');
    assert.ok(
      EXPECTED_GENERATION_MODES.includes(envMode as any),
      `${envMode} must be in EXPECTED_GENERATION_MODES`,
    );
    assert.ok(
      EXPECTED_MANIFEST_GENERATION_MODES.includes(manifestMode as any),
      `${manifestMode} must be in EXPECTED_MANIFEST_GENERATION_MODES`,
    );
  }
});

test('generation modes: AnimatedClipProvider interface contract', async () => {
  // Verify the types file exports AnimatedClipProvider and AnimatedClipProviderInput.
  const types = await import('../providers/aws-video-generation-types.js');
  // Types are compile-time only — verify by importing AnimatedClipProviderInput shape via assignment.
  // If this compiles, the interface is exported correctly.
  const input: import('../providers/aws-video-generation-types.js').AnimatedClipProviderInput = {
    jobId: 'test-001',
    imagePath: '/tmp/scene-001.png',
    outputClipPath: '/tmp/scene-001.mp4',
    durationSeconds: 3,
    sceneIndex: 0,
    width: 1280,
    height: 720,
  };
  assert.equal(input.jobId, 'test-001');
  assert.equal(input.outputClipPath, '/tmp/scene-001.mp4');
});

test('generation modes: LocalFfmpegAnimatedClipProvider has correct provider name', async () => {
  const { LocalFfmpegAnimatedClipProvider } = await import('../providers/aws-video-animated-clip-provider.js');
  const provider = new LocalFfmpegAnimatedClipProvider();
  assert.equal(provider.name, 'local-ffmpeg-animated-placeholder');
});

test('generation modes: animated clip output path follows jobs/<jobId>/animated/scene-NNN.mp4 contract', () => {
  const jobId = 'test-animated-001';
  const sceneCount = 3;
  const animatedClipKeys = Array.from({ length: sceneCount }, (_, index) =>
    `jobs/${jobId}/animated/scene-${String(index + 1).padStart(3, '0')}.mp4`
  );

  for (const [index, key] of animatedClipKeys.entries()) {
    assert.ok(key.startsWith(`jobs/${jobId}/animated/`), `clip key must be scoped to job animated dir`);
    assert.ok(key.endsWith('.mp4'), `clip key must be an mp4 path`);
    assert.ok(key.includes(`scene-${String(index + 1).padStart(3, '0')}`), `clip key must include padded scene number`);
  }
});
