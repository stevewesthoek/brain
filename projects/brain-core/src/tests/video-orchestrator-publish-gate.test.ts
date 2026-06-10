import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isGeneratedMediaGenerationMode,
  publishGateDecision,
  validateGeneratedMediaPublishAssets,
} from '../providers/video-orchestrator-publish-gate.js';

test('publish gate treats hybrid_animated_video as generated media', () => {
  assert.equal(isGeneratedMediaGenerationMode('hybrid_animated_video'), true);
});

test('publish gate requires review approval for hybrid_animated_video', () => {
  assert.equal(
    publishGateDecision({ generationMode: 'hybrid_animated_video', reviewStatus: 'pending' }),
    'review_required',
  );
  assert.equal(
    publishGateDecision({ generationMode: 'hybrid_animated_video', reviewStatus: 'approved' }),
    'asset_check_needed',
  );
});

test('publish gate rejects fixture assets for hybrid_animated_video', () => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_animated_video',
    jobId: 'animated-job-001',
    videoKey: 'jobs/test-001/exports/generated-001-final.mp4',
    thumbnailKey: 'jobs/animated-job-001/exports/thumbnail-001.jpg',
  });

  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.match(result.reason, /fixture/);
  }
});

test('publish gate accepts job-owned animated generated assets', () => {
  const result = validateGeneratedMediaPublishAssets({
    generationMode: 'hybrid_animated_video',
    jobId: 'animated-job-001',
    videoKey: 'jobs/animated-job-001/exports/generated-001-final.mp4',
    thumbnailKey: 'jobs/animated-job-001/exports/thumbnail-001.jpg',
  });

  assert.deepEqual(result, { valid: true });
});
