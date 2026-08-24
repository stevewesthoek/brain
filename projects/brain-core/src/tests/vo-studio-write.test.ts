import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentItemRequest, updateContentItemRequest, generateThumbnailRequest, approveThumbnailRequest, generateMetadataRequest, approveMetadataRequest, queuePackageRequest, editPackageRequest, cancelPackageRequest, retryPackageRequest, finalApprovalRequest, publishPackageRequest, batchPublishRequest } from '../adapters/vo-studio-write.js';

test('createContentItemRequest accepts valid input and returns approval preview', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode for the series',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.ok(result.preview.contentItem);
});

test('createContentItemRequest rejects missing projectId', () => {
  const result = createContentItemRequest({
    projectId: '',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
  assert.equal(result.approval, undefined);
});

test('createContentItemRequest rejects missing title', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: '',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /title is required/);
});

test('createContentItemRequest rejects missing sourceAudioPath', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /sourceAudioPath is required/);
});

test('createContentItemRequest rejects missing backgroundImagePath', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: 'A new episode',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /backgroundImagePath is required/);
});

test('createContentItemRequest allows empty description', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'New Episode',
    description: '',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
  assert.equal(result.preview.contentItem.description, '');
});

test('preview contentItem has correct structure', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode Title',
    description: 'Description text',
    sourceAudioPath: '/audio/episode-1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.equal(result.ok, true);
  const item = result.preview!.contentItem!;

  assert.equal(item.projectId, 'project-123');
  assert.equal(item.title, 'Episode Title');
  assert.equal(item.description, 'Description text');
  assert.equal(item.sourceAudioPath, '/audio/episode-1.mp3');
  assert.equal(item.backgroundImagePath, '/images/bg.png');
  assert.equal(item.status, 'queued');
  assert.equal(item.language, 'en');
  assert.equal(item.durationSec, null);
  assert.ok(item.createdAt);
  assert.ok(item.updatedAt);
});

test('preview contentItem IDs are unique', () => {
  const result1 = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode 1',
    description: '',
    sourceAudioPath: '/audio/1.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  const result2 = createContentItemRequest({
    projectId: 'project-123',
    title: 'Episode 2',
    description: '',
    sourceAudioPath: '/audio/2.mp3',
    backgroundImagePath: '/images/bg.png',
  });

  assert.notEqual(
    result1.preview!.contentItem!.id,
    result2.preview!.contentItem!.id,
  );
});

test('multiple validation errors are reported', () => {
  const result = createContentItemRequest({
    projectId: '',
    title: '',
    description: '',
    sourceAudioPath: '',
    backgroundImagePath: '',
  });

  assert.equal(result.ok, false);
  assert.ok(result.error!.includes('projectId'));
  assert.ok(result.error!.includes('title'));
  assert.ok(result.error!.includes('sourceAudioPath'));
  assert.ok(result.error!.includes('backgroundImagePath'));
});

test('updateContentItemRequest accepts valid update with title only', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    title: 'Updated Title',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.contentItem!.title, 'Updated Title');
});

test('updateContentItemRequest accepts valid update with description only', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    description: 'Updated description',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.contentItem!.description, 'Updated description');
});

test('updateContentItemRequest rejects missing projectId', () => {
  const result = updateContentItemRequest({
    projectId: '',
    contentItemId: 'content-abc123',
    title: 'New Title',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('updateContentItemRequest rejects missing contentItemId', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: '',
    title: 'New Title',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('updateContentItemRequest rejects empty title', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    title: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /title cannot be empty/);
});

test('updateContentItemRequest allows undefined fields', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
});

test('generateThumbnailRequest accepts valid thumbnail request', () => {
  const result = generateThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.ok(result.preview!.job);
  assert.equal(result.preview!.job!.type, 'thumbnail');
  assert.equal(result.preview!.job!.status, 'pending_approval');
});

test('generateThumbnailRequest accepts optional template and boldText', () => {
  const result = generateThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    templateId: 'bold-text',
    boldText: 'Custom Headline',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
});

test('generateThumbnailRequest rejects missing projectId', () => {
  const result = generateThumbnailRequest({
    projectId: '',
    contentItemId: 'content-abc123',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('generateThumbnailRequest rejects missing contentItemId', () => {
  const result = generateThumbnailRequest({
    projectId: 'project-123',
    contentItemId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('generateThumbnailRequest job has unique IDs', () => {
  const result1 = generateThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  const result2 = generateThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  assert.notEqual(
    result1.preview!.job!.id,
    result2.preview!.job!.id,
  );
});

test('approveThumbnailRequest accepts valid approval', () => {
  const result = approveThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.approval!.type, 'thumbnail');
  assert.equal(result.preview!.approval!.status, 'pending');
});

test('approveThumbnailRequest rejects missing projectId', () => {
  const result = approveThumbnailRequest({
    projectId: '',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('approveThumbnailRequest rejects missing contentItemId', () => {
  const result = approveThumbnailRequest({
    projectId: 'project-123',
    contentItemId: '',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('approveThumbnailRequest rejects missing variantId', () => {
  const result = approveThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /variantId is required/);
});

test('approveThumbnailRequest approval has unique IDs', () => {
  const result1 = approveThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  const result2 = approveThumbnailRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-002',
  });

  assert.notEqual(
    result1.preview!.approval!.id,
    result2.preview!.approval!.id,
  );
});

test('generateMetadataRequest generates YouTube metadata from the canonical moving-video content item', async () => {
  const result = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: 'content-stb-story-052',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.job!.type, 'metadata');
  assert.equal(result.preview!.job!.status, 'pending_approval');
  assert.equal(result.preview!.metadata!.youtubeTitle, 'Genesis: Creation Story | Says the Bible');
  assert.ok(result.preview!.metadata!.youtubeDescription.length > 0);
  assert.ok(result.preview!.metadata!.youtubeTags.length > 0);
  assert.ok(result.preview!.metadata!.hashtags.length > 0);
  assert.deepEqual(Object.keys(result.preview!.metadata!.platforms), ['youtube']);
});

test('generateMetadataRequest accepts optional templateId for the YouTube item', async () => {
  const result = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: 'content-stb-story-052',
    templateId: 'default-template',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
});

test('generateMetadataRequest rejects missing projectId', async () => {
  const result = await generateMetadataRequest({
    projectId: '',
    contentItemId: 'content-stb-story-052',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('generateMetadataRequest rejects missing contentItemId', async () => {
  const result = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('generateMetadataRequest rejects an unknown content item deterministically', async () => {
  const result = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: 'content-missing',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'contentItemId not found: content-missing');
});

test('generateMetadataRequest rejects a content item from another project', async () => {
  const result = await generateMetadataRequest({
    projectId: 'other-project',
    contentItemId: 'content-stb-story-052',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'contentItemId does not belong to projectId');
});

test('generateMetadataRequest job has unique IDs', async () => {
  const result1 = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: 'content-stb-story-052',
  });

  const result2 = await generateMetadataRequest({
    projectId: 'says-the-bible',
    contentItemId: 'content-stb-story-052',
  });

  assert.notEqual(
    result1.preview!.job!.id,
    result2.preview!.job!.id,
  );
});

test('approveMetadataRequest accepts valid approval', () => {
  const result = approveMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.approval!.type, 'metadata');
  assert.equal(result.preview!.approval!.status, 'pending');
});

test('approveMetadataRequest persists an auditable YouTube metadata approval', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { readPendingVOApprovals } = await import('../adapters/vo-studio-approval-store.js');

  const originalApprovalsPath = process.env.VO_APPROVALS_PATH;
  const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-metadata-approval-'));
  process.env.VO_APPROVALS_PATH = join(tempDir, 'approvals.json');

  try {
    const result = approveMetadataRequest({
      projectId: 'says-the-bible',
      contentItemId: 'content-stb-story-052',
      variantId: 'metadata-youtube-001',
    });

    assert.equal(result.ok, true);
    assert.ok(result.approval);
    assert.equal(result.approval.status, 'pending');

    const approvals = readPendingVOApprovals('says-the-bible');
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0]?.id, result.approval.id);
    assert.equal(approvals[0]?.type, 'metadata');
    assert.deepEqual(approvals[0]?.requestPayload, {
      contentItemId: 'content-stb-story-052',
      variantId: 'metadata-youtube-001',
      requiredBefore: 'youtube_publish',
      targetPlatform: 'youtube',
    });
  } finally {
    if (originalApprovalsPath === undefined) delete process.env.VO_APPROVALS_PATH;
    else process.env.VO_APPROVALS_PATH = originalApprovalsPath;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('approveMetadataRequest rejects missing projectId', () => {
  const result = approveMetadataRequest({
    projectId: '',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('approveMetadataRequest rejects missing contentItemId', () => {
  const result = approveMetadataRequest({
    projectId: 'project-123',
    contentItemId: '',
    variantId: 'variant-001',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('approveMetadataRequest rejects missing variantId', () => {
  const result = approveMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /variantId is required/);
});

test('approveMetadataRequest approval has unique IDs', () => {
  const result1 = approveMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-001',
  });

  const result2 = approveMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    variantId: 'variant-002',
  });

  assert.notEqual(
    result1.preview!.approval!.id,
    result2.preview!.approval!.id,
  );
});

test('queuePackageRequest accepts valid queue request with single posting target', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [
      {
        platformId: 'youtube',
        accountId: 'account-789',
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.ok(result.preview!.package);
  assert.equal(result.preview!.package!.status, 'queued');
  assert.equal(result.preview!.package!.postingTargets.length, 1);
});

test('queuePackageRequest accepts multiple posting targets', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [
      { platformId: 'youtube', accountId: 'account-1' },
      { platformId: 'facebook', accountId: 'account-2' },
      { platformId: 'tiktok', accountId: 'account-3' },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
  assert.equal(result.preview!.package!.postingTargets.length, 3);
});

test('queuePackageRequest rejects missing projectId', () => {
  const result = queuePackageRequest({
    projectId: '',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-789' }],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('queuePackageRequest rejects missing contentItemId', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: '',
    pipelineProfileId: 'profile-456',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-789' }],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('queuePackageRequest rejects missing pipelineProfileId', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: '',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-789' }],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /pipelineProfileId is required/);
});

test('queuePackageRequest rejects empty postingTargets array', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /postingTargets must be a non-empty array/);
});

test('queuePackageRequest rejects posting target with missing platformId', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [
      { platformId: '', accountId: 'account-789' },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /postingTargets\[0\]\.platformId is required/);
});

test('queuePackageRequest rejects posting target with missing accountId', () => {
  const result = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [
      { platformId: 'youtube', accountId: '' },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /postingTargets\[0\]\.accountId is required/);
});

test('queuePackageRequest package has unique IDs', () => {
  const result1 = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-789' }],
  });

  const result2 = queuePackageRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    pipelineProfileId: 'profile-456',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-789' }],
  });

  assert.notEqual(
    result1.preview!.package!.id,
    result2.preview!.package!.id,
  );
});

test('editPackageRequest accepts package edit with posting targets', () => {
  const result = editPackageRequest({
    packageId: 'pkg-123',
    postingTargets: [
      { platformId: 'tiktok', accountId: 'account-new' },
    ],
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.package!.status, 'modified');
  assert.ok(result.preview!.package!.modifiedFields.includes('postingTargets'));
});

test('editPackageRequest accepts package edit with stage overrides', () => {
  const result = editPackageRequest({
    packageId: 'pkg-123',
    stageOverrides: {
      thumbnail: 'skip',
      metadata: 'auto',
    },
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview!.package!.modifiedFields.includes('stageOverrides'));
});

test('editPackageRequest rejects missing packageId', () => {
  const result = editPackageRequest({
    packageId: '',
    postingTargets: [{ platformId: 'youtube', accountId: 'account-123' }],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('cancelPackageRequest accepts valid cancellation', () => {
  const result = cancelPackageRequest({
    packageId: 'pkg-123',
    reason: 'Wrong timing, will reschedule',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.package!.status, 'cancelled');
  assert.equal(result.preview!.package!.reason, 'Wrong timing, will reschedule');
  assert.ok(result.preview!.package!.cancelledAt);
});

test('cancelPackageRequest rejects missing packageId', () => {
  const result = cancelPackageRequest({
    packageId: '',
    reason: 'User cancelled',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('cancelPackageRequest rejects missing reason', () => {
  const result = cancelPackageRequest({
    packageId: 'pkg-123',
    reason: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /reason is required/);
});

test('retryPackageRequest accepts full package retry', () => {
  const result = retryPackageRequest({
    packageId: 'pkg-123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.package!.status, 'retrying');
  assert.equal(result.preview!.package!.retryCount, 1);
});

test('retryPackageRequest accepts stage-specific retry', () => {
  const result = retryPackageRequest({
    packageId: 'pkg-123',
    stageId: 'metadata',
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.package!.retryStage, 'metadata');
});

test('retryPackageRequest rejects missing packageId', () => {
  const result = retryPackageRequest({
    packageId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('finalApprovalRequest accepts valid package approval', () => {
  const result = finalApprovalRequest({
    packageId: 'pkg-123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview!.approval!.type, 'final_review');
  assert.equal(result.preview!.approval!.status, 'approved');
});

test('finalApprovalRequest accepts optional notes', () => {
  const result = finalApprovalRequest({
    packageId: 'pkg-123',
    notes: 'Ready for publication',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
});

test('finalApprovalRequest rejects missing packageId', () => {
  const result = finalApprovalRequest({
    packageId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('publishPackageRequest accepts one immediate YouTube job target', () => {
  const result = publishPackageRequest({
    packageId: 'pkg-123',
    jobId: 'job-moving-video-123',
    postingTarget: { platformId: 'youtube', accountId: 'acct-stb-youtube' },
    confirmation: 'publish approved moving video to YouTube',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.package!.status, 'publishing');
  assert.equal(result.preview!.package!.jobId, 'job-moving-video-123');
  assert.deepEqual(result.preview!.package!.postingTarget, {
    platformId: 'youtube',
    accountId: 'acct-stb-youtube',
  });
  assert.ok(result.preview!.package!.publishedAt);
});

test('publishPackageRequest rejects scheduled direct YouTube publishing', () => {
  const result = publishPackageRequest({
    packageId: 'pkg-123',
    jobId: 'job-moving-video-123',
    postingTarget: { platformId: 'youtube', accountId: 'acct-stb-youtube' },
    confirmation: 'publish approved moving video to YouTube',
    scheduleAt: new Date(Date.now() + 3600000).toISOString(),
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /scheduled publishing is not supported/);
});

test('publishPackageRequest rejects missing packageId', () => {
  const result = publishPackageRequest({
    packageId: '',
    jobId: 'job-moving-video-123',
    postingTarget: { platformId: 'youtube', accountId: 'acct-stb-youtube' },
    confirmation: 'publish approved moving video to YouTube',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageId is required/);
});

test('publishPackageRequest rejects a non-YouTube target', () => {
  const result = publishPackageRequest({
    packageId: 'pkg-123',
    jobId: 'job-moving-video-123',
    postingTarget: { platformId: 'tiktok', accountId: 'acct-tiktok' },
    confirmation: 'publish approved moving video',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /postingTarget.platformId must be youtube/);
});

test('publishPackageRequest rejects missing job, account, and confirmation binding', () => {
  const result = publishPackageRequest({
    packageId: 'pkg-123',
    jobId: '',
    postingTarget: { platformId: 'youtube', accountId: '' },
    confirmation: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /jobId is required/);
  assert.match(result.error!, /postingTarget.accountId is required/);
  assert.match(result.error!, /confirmation is required/);
});

test('batchPublishRequest accepts multiple packages', () => {
  const result = batchPublishRequest({
    packageIds: ['pkg-1', 'pkg-2', 'pkg-3'],
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.ok(result.preview);
  assert.equal(result.preview!.batch!.packageCount, 3);
  assert.equal(result.preview!.batch!.status, 'publishing');
});

test('batchPublishRequest accepts scheduled batch publish', () => {
  const scheduledTime = new Date(Date.now() + 7200000).toISOString();
  const result = batchPublishRequest({
    packageIds: ['pkg-1', 'pkg-2'],
    scheduleAt: scheduledTime,
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview!.batch!.status, 'scheduled');
  assert.equal(result.preview!.batch!.scheduledAt, scheduledTime);
});

test('batchPublishRequest rejects empty packageIds', () => {
  const result = batchPublishRequest({
    packageIds: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageIds must be a non-empty array/);
});

test('batchPublishRequest rejects packageIds with empty strings', () => {
  const result = batchPublishRequest({
    packageIds: ['pkg-1', '', 'pkg-3'],
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /packageIds\[1\] is required/);
});




test('createContentItemRequest accepts a real moving-video source without slideshow inputs', () => {
  const result = createContentItemRequest({
    projectId: 'project-123',
    title: 'Moving Video Episode',
    description: 'A real moving-video source',
    sourceVideoPath: '/videos/episode-1.mp4',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.contentItem.sourceVideoPath, '/videos/episode-1.mp4');
  assert.equal(result.preview.contentItem.sourceAudioPath, '');
  assert.equal(result.preview.contentItem.backgroundImagePath, '');
});

test('updateContentItemRequest accepts a moving-video source through approval', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-123',
    sourceVideoPath: '/videos/replacement.mp4',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.equal(result.preview.contentItem.sourceVideoPath, '/videos/replacement.mp4');
});

test('updateContentItemRequest rejects an empty moving-video source', () => {
  const result = updateContentItemRequest({
    projectId: 'project-123',
    contentItemId: 'content-123',
    sourceVideoPath: '   ',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /sourceVideoPath cannot be empty/);
  assert.equal(result.approval, undefined);
});




test('approveThumbnailRequest persists an auditable thumbnail approval required before YouTube publishing', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { readPendingVOApprovals } = await import('../adapters/vo-studio-approval-store.js');

  const originalApprovalsPath = process.env.VO_APPROVALS_PATH;
  const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-thumbnail-approval-'));
  process.env.VO_APPROVALS_PATH = join(tempDir, 'approvals.json');

  try {
    const result = approveThumbnailRequest({
      projectId: 'project-1we',
      contentItemId: 'content-moving-video-1',
      variantId: 'variant_a',
    });

    assert.equal(result.ok, true);
    assert.ok(result.approval);
    assert.equal(result.approval.status, 'pending');

    const approvals = readPendingVOApprovals('project-1we');
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0]?.id, result.approval.id);
    assert.equal(approvals[0]?.type, 'thumbnail');
    assert.deepEqual(approvals[0]?.requestPayload, {
      contentItemId: 'content-moving-video-1',
      variantId: 'variant_a',
      requiredBefore: 'youtube_publish',
    });
  } finally {
    if (originalApprovalsPath === undefined) delete process.env.VO_APPROVALS_PATH;
    else process.env.VO_APPROVALS_PATH = originalApprovalsPath;
    await rm(tempDir, { recursive: true, force: true });
  }
});
