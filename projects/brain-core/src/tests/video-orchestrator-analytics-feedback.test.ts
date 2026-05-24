import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { recordPublishOutcome, recordVideoMetrics, summarizeFeedback } from '../adapters/video-orchestrator-analytics-feedback.js';

const FEEDBACK_PATH = path.join(process.cwd(), `.tmp-vo-feedback-${Date.now()}.json`);

function cleanup(): void {
  try { fs.rmSync(FEEDBACK_PATH, { force: true }); } catch {}
}

test('summarizeFeedback returns empty recommendation when no data exists', () => {
  cleanup();
  process.env['VO_FEEDBACK_PATH'] = FEEDBACK_PATH;

  const summary = summarizeFeedback('project-123');

  assert.equal(summary.ok, true);
  assert.equal(summary.projectId, 'project-123');
  assert.equal(summary.outcomes.length, 0);
  assert.equal(summary.metrics.length, 0);
  assert.match(summary.recommendation.note, /No metrics recorded yet/);
});

test('recordPublishOutcome persists outcome and summarizeFeedback reflects it', () => {
  cleanup();
  process.env['VO_FEEDBACK_PATH'] = FEEDBACK_PATH;

  const summary = recordPublishOutcome({
    projectId: 'project-123',
    packageId: 'pkg-1',
    status: 'succeeded',
    thumbnailVariant: 'variant-a',
    metadataVariant: 'meta-a',
    platform: 'youtube',
  });

  assert.equal(summary.outcomes.length, 1);
  assert.equal(summary.outcomes[0]?.packageId, 'pkg-1');
  assert.equal(summary.outcomes[0]?.status, 'succeeded');
});

test('recordVideoMetrics chooses best variant by CTR', () => {
  cleanup();
  process.env['VO_FEEDBACK_PATH'] = FEEDBACK_PATH;

  recordVideoMetrics({
    projectId: 'project-123',
    packageId: 'pkg-1',
    thumbnailVariant: 'variant-a',
    metadataVariant: 'meta-a',
    views24h: 1000,
    ctr: 2.3,
    engagementRate: 4.1,
  });

  const summary = recordVideoMetrics({
    projectId: 'project-123',
    packageId: 'pkg-2',
    thumbnailVariant: 'variant-b',
    metadataVariant: 'meta-b',
    views24h: 1200,
    ctr: 1.8,
    engagementRate: 3.7,
  });

  assert.equal(summary.metrics.length, 2);
  assert.equal(summary.recommendation.bestThumbnailVariant, 'variant-a');
  assert.equal(summary.recommendation.bestMetadataVariant, 'meta-a');
});

test.after(() => {
  cleanup();
  delete process.env['VO_FEEDBACK_PATH'];
});
