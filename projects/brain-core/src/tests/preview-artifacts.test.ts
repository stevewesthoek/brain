import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listMindPreviewSummaries,
  readLatestMindPreviewDetail,
  readMindPreviewDetailById,
} from '../adapters/preview-artifacts.js';

const previousPreviewPath = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;

function withPreviewPath<T>(previewPath: string, callback: () => T): T {
  process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previewPath;
  try {
    return callback();
  } finally {
    if (previousPreviewPath === undefined) {
      delete process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH;
    } else {
      process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH = previousPreviewPath;
    }
  }
}

test('Brain Core reads mind-steward previewId artifacts', () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-brain-core-previews');
  const previewRoot = path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews');
  const previewId = 'preview-compat-1';

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(previewRoot, { recursive: true });
  fs.writeFileSync(
    path.join(previewRoot, `${previewId}.json`),
    `${JSON.stringify(
      {
        previewId,
        actionKind: 'mind-steward-update-current-context',
        targetPath: 'router/current.md',
        operation: 'overwrite',
        oldHash: 'old-hash',
        newHash: 'new-hash',
        lineCountBefore: 2,
        lineCountAfter: 3,
        maxLines: 150,
        unifiedDiff: '--- a/router/current.md\n+++ b/router/current.md\n@@ preview @@\n-old\n+new',
        writesToMind: false,
        externalSideEffects: false,
        policyReasons: ['Target path is allowed for preview-only planning.'],
        blockedRoot: false,
        allowedRoot: true,
        createdAt: '2026-05-17T12:00:00.000Z',
        expiresAt: '2026-05-18T12:00:00.000Z',
      },
      null,
      2,
    )}\n`,
  );

  try {
    withPreviewPath(previewRoot, () => {
      const summaries = listMindPreviewSummaries();
      const latest = readLatestMindPreviewDetail();
      const detail = readMindPreviewDetailById(previewId);

      assert.equal(summaries.length, 1);
      assert.equal(summaries[0]?.id, previewId);
      assert.equal(summaries[0]?.writesToMind, false);
      assert.equal(summaries[0]?.externalSideEffects, false);
      assert.equal(latest?.id, previewId);
      assert.equal(detail?.id, previewId);
      assert.equal(detail?.targetPath, 'router/current.md');
      assert.equal(detail?.allowedRoot, true);
      assert.equal(detail?.blockedRoot, false);
      assert.equal(detail?.newHash, 'new-hash');
      assert.equal(detail?.lineCountAfter, 3);
    });
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Brain Core still reads legacy id preview artifacts', () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-brain-core-previews-id');
  const previewRoot = path.join(testDir, 'runtime', 'local', 'mind-steward', 'previews');
  const id = 'preview-id-compat-1';

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(previewRoot, { recursive: true });
  fs.writeFileSync(
    path.join(previewRoot, `${id}.json`),
    `${JSON.stringify({
      id,
      actionKind: 'mind-steward-update-current-context',
      targetPath: 'router/current.md',
      createdAt: '2026-05-17T12:00:00.000Z',
      expiresAt: '2026-05-18T12:00:00.000Z',
      allowedRoot: true,
      blockedRoot: false,
    })}\n`,
  );

  try {
    withPreviewPath(previewRoot, () => {
      const detail = readMindPreviewDetailById(id);
      assert.equal(detail?.id, id);
      assert.equal(detail?.writesToMind, false);
      assert.equal(detail?.externalSideEffects, false);
    });
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
