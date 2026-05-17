import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApprovedMindWritePreview,
  createMindWritePreview,
  evaluateMindPreviewPolicy,
} from '../preview.js';

const now = new Date('2026-05-17T12:00:00.000Z');

test('preview policy allows the first proposed router current target', () => {
  const result = evaluateMindPreviewPolicy('router/current.md');

  assert.equal(result.targetPath, 'router/current.md');
  assert.equal(result.allowedRoot, true);
  assert.equal(result.blockedRoot, false);
  assert.equal(result.reasons.includes('Target path is allowed for preview-only planning.'), true);
});

test('preview policy rejects legacy numbered folders even when markdown', () => {
  const result = evaluateMindPreviewPolicy('03-projects/example.md');

  assert.equal(result.allowedRoot, false);
  assert.equal(result.blockedRoot, true);
  assert.equal(result.reasons.some((reason) => reason.includes('03-projects/')), true);
});

test('preview policy rejects obsidian plugin/config paths', () => {
  const result = evaluateMindPreviewPolicy('.obsidian/plugins/example/main.js');

  assert.equal(result.allowedRoot, false);
  assert.equal(result.blockedRoot, true);
  assert.equal(result.reasons.some((reason) => reason.includes('.obsidian/')), true);
});

test('preview policy rejects traversal and absolute paths', () => {
  const traversal = evaluateMindPreviewPolicy('../router/current.md');
  const absolute = evaluateMindPreviewPolicy('/Users/Office/Repos/stevewesthoek/mind/router/current.md');

  assert.equal(traversal.allowedRoot, false);
  assert.equal(traversal.blockedRoot, false);
  assert.equal(traversal.reasons.some((reason) => reason.includes('traversal')), true);
  assert.equal(absolute.allowedRoot, false);
  assert.equal(absolute.blockedRoot, false);
  assert.equal(absolute.reasons.some((reason) => reason.includes('traversal')), true);
});

test('createMindWritePreview is non-writing and includes hashes and diff', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n\nOld context\n',
    newContent: '# Current\n\nNew context\n',
    now,
  });

  assert.equal(preview.kind, 'model-router-mind-preview');
  assert.equal(preview.writesToMind, false);
  assert.equal(preview.externalSideEffects, false);
  assert.equal(preview.allowedRoot, true);
  assert.equal(preview.blockedRoot, false);
  assert.equal(preview.maxLines, 150);
  assert.equal(preview.createdAt, '2026-05-17T12:00:00.000Z');
  assert.equal(typeof preview.oldHash, 'string');
  assert.equal(typeof preview.newHash, 'string');
  assert.notEqual(preview.oldHash, preview.newHash);
  assert.match(preview.unifiedDiff, /--- a\/router\/current\.md/);
  assert.match(preview.unifiedDiff, /\+New context/);
});

test('createMindWritePreview flags line-limit violations without writing', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n',
    newContent: Array.from({ length: 151 }, (_, index) => `Line ${index + 1}`).join('\n'),
    now,
  });

  assert.equal(preview.writesToMind, false);
  assert.equal(preview.lineCountAfter, 151);
  assert.equal(preview.maxLines, 150);
  assert.equal(preview.policyReasons.some((reason) => reason.includes('150 line limit')), true);
});

test('createMindWritePreview flags live-looking secret material without writing', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n',
    newContent: `# Current\n\n${'sk-'}${'x'.repeat(24)}\n`,
    now,
  });

  assert.equal(preview.writesToMind, false);
  assert.equal(preview.blockedRoot, true);
  assert.equal(preview.policyReasons.some((reason) => reason.includes('secret material')), true);
});

test('applyApprovedMindWritePreview accepts the approved router current target', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n\nOld context\n',
    newContent: '# Current\n\nNew context\n',
    now,
  });

  const result = applyApprovedMindWritePreview({
    preview,
    approval: {
      id: 'approval-1',
      kind: 'model-router-update-current-context',
      status: 'approved',
      expiresAt: '2026-05-18T12:00:00.000Z',
      previewHash: preview.newHash,
    },
    now,
  });

  assert.equal(result.applied, true);
  assert.equal(result.targetPath, 'router/current.md');
  assert.equal(result.writesToMind, true);
  assert.equal(result.audit.event, 'applied');
  assert.equal(result.audit.kind, 'model-router-update-current-context');
  assert.equal(result.audit.targetPath, 'router/current.md');
  assert.equal(result.audit.status, 'ok');
  assert.equal(result.rollback.targetPath, 'router/current.md');
  assert.equal(result.rollback.restoreContentHash, preview.oldHash);
  assert.equal(result.validation.accepted, true);
  assert.equal(result.validation.reasons.length, 0);
});

test('applyApprovedMindWritePreview rejects .obsidian paths through preview policy', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: '.obsidian/plugins/example/main.js',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });

  const result = applyApprovedMindWritePreview({
    preview,
    approval: {
      id: 'approval-2',
      kind: 'model-router-update-current-context',
      status: 'approved',
      expiresAt: '2026-05-18T12:00:00.000Z',
      previewHash: preview.newHash,
    },
    now,
  });

  assert.equal(result.applied, false);
  assert.equal(result.writesToMind, false);
  assert.equal(result.audit.event, 'blocked');
  assert.equal(result.audit.status, 'blocked');
  assert.equal(result.audit.writesToMind, false);
  assert.equal(result.audit.appliedAt, null);
  assert.equal(result.validation.accepted, false);
  assert.equal(result.validation.reasons.some((reason) => reason.includes('.obsidian')), true);
});

test('applyApprovedMindWritePreview rejects traversal and absolute target paths', () => {
  const traversalPreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: '../router/current.md',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });
  const absolutePreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: '/Users/Office/Repos/stevewesthoek/mind/router/current.md',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });
  const approval = {
    id: 'approval-traversal',
    kind: 'model-router-update-current-context',
    status: 'approved',
    expiresAt: '2026-05-18T12:00:00.000Z',
    previewHash: traversalPreview.newHash,
  } as const;

  assert.equal(
    applyApprovedMindWritePreview({ preview: traversalPreview, approval, now }).validation.reasons.some((reason) =>
      reason.includes('traversal'),
    ),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: absolutePreview,
      approval: {
        ...approval,
        id: 'approval-absolute',
        previewHash: absolutePreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('traversal')),
    true,
  );
});

test('applyApprovedMindWritePreview rejects legacy numbered folders, archive paths, env files, and missing approvals', () => {
  const legacyPreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: '03-projects/example.md',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });
  const archivePreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'archive/old/example.md',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });
  const envPreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: '.env',
    operation: 'overwrite',
    oldContent: 'old',
    newContent: 'new',
    now,
  });

  assert.equal(
    applyApprovedMindWritePreview({ preview: legacyPreview, approval: null, now }).validation.reasons.some((reason) =>
      reason.includes('Approval record is required.'),
    ),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: archivePreview,
      approval: {
        id: 'approval-3',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: archivePreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('allowed unblocked Mind root')),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: envPreview,
      approval: {
        id: 'approval-4',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: envPreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('allowed unblocked Mind root')),
    true,
  );
});

test('applyApprovedMindWritePreview rejects oversized content, live-looking secrets, hash mismatches, stale approvals, and unapproved records', () => {
  const oversizedPreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n',
    newContent: Array.from({ length: 151 }, (_, index) => `Line ${index + 1}`).join('\n'),
    now,
  });
  const secretPreview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n',
    newContent: `# Current\n\n${'ghp_'}${'x'.repeat(24)}\n`,
    now,
  });

  assert.equal(
    applyApprovedMindWritePreview({
      preview: oversizedPreview,
      approval: {
        id: 'approval-5',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: oversizedPreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('150 line limit')),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: secretPreview,
      approval: {
        id: 'approval-6',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: secretPreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('secret material')),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: secretPreview,
      approval: {
        id: 'approval-7',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: 'sha256:mismatch',
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('does not match')),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: secretPreview,
      approval: {
        id: 'approval-8',
        kind: 'model-router-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-17T11:59:59.000Z',
        previewHash: secretPreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('expired')),
    true,
  );
  assert.equal(
    applyApprovedMindWritePreview({
      preview: secretPreview,
      approval: {
        id: 'approval-9',
        kind: 'model-router-update-current-context',
        status: 'pending',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: secretPreview.newHash,
      },
      now,
    }).validation.reasons.some((reason) => reason.includes('must be approved')),
    true,
  );
});

test('existing preview behavior remains report-only', () => {
  const preview = createMindWritePreview({
    actionKind: 'model-router-update-current-context',
    targetPath: 'router/current.md',
    operation: 'overwrite',
    oldContent: '# Current\n',
    newContent: '# Current\n\nNext context\n',
    now,
  });

  assert.equal(preview.writesToMind, false);
  assert.equal(preview.externalSideEffects, false);
});
