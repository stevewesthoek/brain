import test from 'node:test';
import assert from 'node:assert/strict';
import { runControlledYouTubePublish } from '../providers/video-orchestrator-provider.js';

test('live YouTube publish requires exact operator confirmation before any upload work', async () => {
  const result = await runControlledYouTubePublish('job-moving-video-gate-test', {
    dryRun: false,
    confirmation: 'publish approved moving video to YouTube',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'publish_confirmation_required');
  assert.match(result.error ?? '', /PUBLISH TO YOUTUBE/);
});

test('live YouTube publish requires persisted successful dry-run proof', async () => {
  const result = await runControlledYouTubePublish('job-moving-video-gate-test', {
    dryRun: false,
    confirmation: 'PUBLISH TO YOUTUBE',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'publish_dry_run_required');
  assert.match(result.error ?? '', /successful YouTube dry-run/);
});
