import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentItemRequest, updateContentItemRequest, generateThumbnailRequest, approveThumbnailRequest, generateMetadataRequest, approveMetadataRequest, queuePackageRequest, editPackageRequest, cancelPackageRequest, retryPackageRequest } from '../adapters/vo-studio-write.js';

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
  assert.equal(result.preview!.approval!.status, 'pending_approval');
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

test('generateMetadataRequest accepts valid metadata request', () => {
  const result = generateMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  assert.equal(result.ok, true);
  assert.ok(result.approval);
  assert.match(result.approval.id, /^approval-/);
  assert.equal(result.approval.status, 'pending');
  assert.ok(result.preview);
  assert.ok(result.preview!.job);
  assert.equal(result.preview!.job!.type, 'metadata');
  assert.equal(result.preview!.job!.status, 'pending_approval');
});

test('generateMetadataRequest accepts optional templateId', () => {
  const result = generateMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
    templateId: 'default-template',
  });

  assert.equal(result.ok, true);
  assert.ok(result.preview);
});

test('generateMetadataRequest rejects missing projectId', () => {
  const result = generateMetadataRequest({
    projectId: '',
    contentItemId: 'content-abc123',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /projectId is required/);
});

test('generateMetadataRequest rejects missing contentItemId', () => {
  const result = generateMetadataRequest({
    projectId: 'project-123',
    contentItemId: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.error!, /contentItemId is required/);
});

test('generateMetadataRequest job has unique IDs', () => {
  const result1 = generateMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
  });

  const result2 = generateMetadataRequest({
    projectId: 'project-123',
    contentItemId: 'content-abc123',
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
  assert.equal(result.preview!.approval!.status, 'pending_approval');
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
