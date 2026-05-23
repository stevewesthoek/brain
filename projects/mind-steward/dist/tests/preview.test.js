import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyApprovedMindWritePreview, createMindPreviewArtifact, createMindWritePreview, evaluateMindPreviewPolicy, listMindPreviewArtifacts, readMindPreviewArtifact, writeMindPreviewArtifact, } from '../preview.js';
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
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n\nOld context\n',
        newContent: '# Current\n\nNew context\n',
        now,
    });
    assert.equal(preview.kind, 'mind-steward-mind-preview');
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
        actionKind: 'mind-steward-update-current-context',
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
        actionKind: 'mind-steward-update-current-context',
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
        actionKind: 'mind-steward-update-current-context',
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
            kind: 'mind-steward-update-current-context',
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
    assert.equal(result.audit.kind, 'mind-steward-update-current-context');
    assert.equal(result.audit.targetPath, 'router/current.md');
    assert.equal(result.audit.status, 'ok');
    assert.equal(result.rollback.targetPath, 'router/current.md');
    assert.equal(result.rollback.restoreContentHash, preview.oldHash);
    assert.equal(result.validation.accepted, true);
    assert.equal(result.validation.reasons.length, 0);
});
test('applyApprovedMindWritePreview rejects .obsidian paths through preview policy', () => {
    const preview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
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
            kind: 'mind-steward-update-current-context',
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
        actionKind: 'mind-steward-update-current-context',
        targetPath: '../router/current.md',
        operation: 'overwrite',
        oldContent: 'old',
        newContent: 'new',
        now,
    });
    const absolutePreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: '/Users/Office/Repos/stevewesthoek/mind/router/current.md',
        operation: 'overwrite',
        oldContent: 'old',
        newContent: 'new',
        now,
    });
    const approval = {
        id: 'approval-traversal',
        kind: 'mind-steward-update-current-context',
        status: 'approved',
        expiresAt: '2026-05-18T12:00:00.000Z',
        previewHash: traversalPreview.newHash,
    };
    assert.equal(applyApprovedMindWritePreview({ preview: traversalPreview, approval, now }).validation.reasons.some((reason) => reason.includes('traversal')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: absolutePreview,
        approval: {
            ...approval,
            id: 'approval-absolute',
            previewHash: absolutePreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('traversal')), true);
});
test('applyApprovedMindWritePreview rejects legacy numbered folders, archive paths, env files, and missing approvals', () => {
    const legacyPreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: '03-projects/example.md',
        operation: 'overwrite',
        oldContent: 'old',
        newContent: 'new',
        now,
    });
    const archivePreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'archive/old/example.md',
        operation: 'overwrite',
        oldContent: 'old',
        newContent: 'new',
        now,
    });
    const envPreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: '.env',
        operation: 'overwrite',
        oldContent: 'old',
        newContent: 'new',
        now,
    });
    assert.equal(applyApprovedMindWritePreview({ preview: legacyPreview, approval: null, now }).validation.reasons.some((reason) => reason.includes('Approval record is required.')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: archivePreview,
        approval: {
            id: 'approval-3',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: archivePreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('allowed unblocked Mind root')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: envPreview,
        approval: {
            id: 'approval-4',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: envPreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('allowed unblocked Mind root')), true);
});
test('applyApprovedMindWritePreview rejects oversized content, live-looking secrets, hash mismatches, stale approvals, and unapproved records', () => {
    const oversizedPreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: Array.from({ length: 151 }, (_, index) => `Line ${index + 1}`).join('\n'),
        now,
    });
    const secretPreview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: `# Current\n\n${'ghp_'}${'x'.repeat(24)}\n`,
        now,
    });
    assert.equal(applyApprovedMindWritePreview({
        preview: oversizedPreview,
        approval: {
            id: 'approval-5',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: oversizedPreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('150 line limit')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: secretPreview,
        approval: {
            id: 'approval-6',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: secretPreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('secret material')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: secretPreview,
        approval: {
            id: 'approval-7',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: 'sha256:mismatch',
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('does not match')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: secretPreview,
        approval: {
            id: 'approval-8',
            kind: 'mind-steward-update-current-context',
            status: 'approved',
            expiresAt: '2026-05-17T11:59:59.000Z',
            previewHash: secretPreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('expired')), true);
    assert.equal(applyApprovedMindWritePreview({
        preview: secretPreview,
        approval: {
            id: 'approval-9',
            kind: 'mind-steward-update-current-context',
            status: 'pending',
            expiresAt: '2026-05-18T12:00:00.000Z',
            previewHash: secretPreview.newHash,
        },
        now,
    }).validation.reasons.some((reason) => reason.includes('must be approved')), true);
});
test('existing preview behavior remains report-only', () => {
    const preview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: '# Current\n\nNext context\n',
        now,
    });
    assert.equal(preview.writesToMind, false);
    assert.equal(preview.externalSideEffects, false);
});
test('preview artifacts are written only under Brain runtime/local/mind-steward/previews', () => {
    const testDir = path.join(process.cwd(), '.buildflow-test-preview-artifacts');
    const preview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: '# Current\n\nPreview artifact\n',
        now,
    });
    fs.rmSync(testDir, { recursive: true, force: true });
    const result = writeMindPreviewArtifact({
        preview,
        runtimeRoot: path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews'),
    });
    assert.equal(result.artifact.writesToMind, false);
    assert.equal(result.artifact.externalSideEffects, false);
    assert.equal(result.artifactPath.startsWith(path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews')), true);
    assert.equal(fs.existsSync(result.artifactPath), true);
    const summaries = listMindPreviewArtifacts({
        runtimeRoot: path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews'),
        now,
    });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.previewId, result.artifact.previewId);
    assert.equal(summaries[0]?.targetPath, 'router/current.md');
    assert.equal(summaries[0]?.expired, false);
    fs.rmSync(testDir, { recursive: true, force: true });
});
test('preview artifacts reject unsafe paths', () => {
    const preview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: '# Current\n\nPreview artifact\n',
        now,
    });
    assert.throws(() => writeMindPreviewArtifact({
        preview,
        runtimeRoot: path.join(process.cwd(), 'mind', 'runtime', 'local', 'mind-steward', 'previews'),
    }), /Unsafe preview runtime path/);
});
test('preview artifact reader reports expiry and missing ids safely', () => {
    const testDir = path.join(process.cwd(), '.buildflow-test-preview-expiry');
    const preview = createMindWritePreview({
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldContent: '# Current\n',
        newContent: '# Current\n\nPreview artifact\n',
        now,
    });
    fs.rmSync(testDir, { recursive: true, force: true });
    const created = createMindPreviewArtifact({ preview, expiresAt: new Date('2026-05-17T11:00:00.000Z') });
    const previewDir = path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews');
    fs.mkdirSync(previewDir, { recursive: true });
    fs.writeFileSync(path.join(previewDir, `${created.previewId}.json`), `${JSON.stringify(created, null, 2)}\n`);
    const summary = readMindPreviewArtifact({
        previewId: created.previewId,
        runtimeRoot: previewDir,
        now: new Date('2026-05-17T12:00:00.000Z'),
    });
    assert.equal(summary?.expired, true);
    assert.equal(summary?.writesToMind, false);
    assert.equal(summary?.externalSideEffects, false);
    assert.equal(readMindPreviewArtifact({ previewId: 'missing', runtimeRoot: previewDir, now }), null);
    fs.rmSync(testDir, { recursive: true, force: true });
});
