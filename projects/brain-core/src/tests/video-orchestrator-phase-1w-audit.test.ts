import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  approveThumbnailRequest,
  approveMetadataRequest,
  queuePackageRequest,
} from '../adapters/vo-studio-write.js';
import { readPendingVOApprovals } from '../adapters/vo-studio-approval-store.js';

test('Phase 1W records a complete cross-stage audit trail for one YouTube content item', async () => {
  const originalApprovalsPath = process.env.VO_APPROVALS_PATH;
  const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-phase-1w-audit-'));
  process.env.VO_APPROVALS_PATH = join(tempDir, 'approvals.json');

  try {
    const projectId = 'project-1w-e2e';
    const contentItemId = 'content-moving-video-e2e';

    const thumbnail = approveThumbnailRequest({
      projectId,
      contentItemId,
      variantId: 'thumbnail-variant-a',
    });
    const metadata = approveMetadataRequest({
      projectId,
      contentItemId,
      variantId: 'metadata-youtube-a',
    });
    const packageResult = queuePackageRequest({
      projectId,
      contentItemId,
      pipelineProfileId: 'youtube-moving-video',
      postingTargets: [
        { platformId: 'youtube', accountId: 'acct-stb-youtube' },
      ],
    });

    assert.equal(thumbnail.ok, true);
    assert.equal(metadata.ok, true);
    assert.equal(packageResult.ok, true);

    const approvals = readPendingVOApprovals(projectId);
    assert.equal(approvals.length, 3);

    const byType = new Map(approvals.map((approval) => [approval.type, approval]));
    assert.deepEqual(byType.get('thumbnail')?.requestPayload, {
      contentItemId,
      variantId: 'thumbnail-variant-a',
      requiredBefore: 'youtube_publish',
    });
    assert.deepEqual(byType.get('metadata')?.requestPayload, {
      contentItemId,
      variantId: 'metadata-youtube-a',
      requiredBefore: 'youtube_publish',
      targetPlatform: 'youtube',
    });
    assert.deepEqual(byType.get('package')?.requestPayload, {
      contentItemId,
      pipelineProfileId: 'youtube-moving-video',
      postingTargets: [
        { platformId: 'youtube', accountId: 'acct-stb-youtube' },
      ],
    });

    for (const approval of approvals) {
      assert.equal(approval.projectId, projectId);
      assert.equal(approval.status, 'pending');
      assert.equal(
        (approval.requestPayload as Record<string, unknown>).contentItemId,
        contentItemId,
      );
    }
  } finally {
    if (originalApprovalsPath === undefined) delete process.env.VO_APPROVALS_PATH;
    else process.env.VO_APPROVALS_PATH = originalApprovalsPath;
    await rm(tempDir, { recursive: true, force: true });
  }
});
