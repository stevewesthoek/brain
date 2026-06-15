import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeRequestedThumbnailKeyForTesting } from '../providers/video-orchestrator-provider.js';

test('requested thumbnail key safety helper accepts only unambiguous same-job image keys', () => {
  const jobId = 'thumbnail-key-helper-unit-20260615';
  const cases: Array<{ key: string | null | undefined; expected: boolean }> = [
    { key: `jobs/${jobId}/exports/thumbnail.jpg`, expected: true },
    { key: `jobs/${jobId}/exports/thumbnail.JPEG`, expected: true },
    { key: `jobs/${jobId}/exports/thumbnail.png`, expected: true },
    { key: `jobs/${jobId}/exports/thumbnail.WEBP`, expected: true },
    { key: null, expected: false },
    { key: undefined, expected: false },
    { key: '', expected: false },
    { key: 'jobs/other-job/exports/thumbnail.jpg', expected: false },
    { key: `jobs/${jobId}/../thumbnail.jpg`, expected: false },
    { key: `jobs/${jobId}/exports\\thumbnail.jpg`, expected: false },
    { key: `jobs/${jobId}/exports/thumbnail\n.jpg`, expected: false },
    { key: `jobs/${jobId}/exports/thumbnail\u200B.jpg`, expected: false },
    { key: `jobs/${jobId}/exports/thumbnail?variant.jpg`, expected: false },
    { key: `jobs/${jobId}/exports%2Fthumbnail.jpg`, expected: false },
    { key: `jobs/${jobId}/exports/thumbnail.gif`, expected: false },
  ];

  for (const { key, expected } of cases) {
    assert.equal(isSafeRequestedThumbnailKeyForTesting(jobId, key), expected, String(key));
  }
});
