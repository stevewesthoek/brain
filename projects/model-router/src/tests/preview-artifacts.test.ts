import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  writeMaintenancePreviewArtifact,
  listMaintenancePreviewArtifacts,
  readMaintenancePreviewArtifact,
  type WriteMaintenancePreviewArtifactInput,
} from '../preview-artifacts.js';
import type { MindMaintenancePreviewQueue } from '../maintenance-preview.js';

function makeRuntimeRoot(): string {
  return `.runtime-test-${Date.now()}`;
}

test('preview-artifacts: writes queue artifact to safe runtime root', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const queue: MindMaintenancePreviewQueue = {
      kind: 'mind-maintenance-preview-queue',
      createdAt: '2026-05-17T19:30:00.000Z',
      source: 'wiki-health',
      actions: [],
      summary: {
        total: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        approvalRequiredCount: 0,
        blockedCount: 0,
      },
      writesToMind: false,
      externalSideEffects: false,
    };

    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');
    const meta = writeMaintenancePreviewArtifact({ queue, runtimeRoot });

    assert.match(meta.queueId, /^queue-[a-f0-9]{12}$/);
    assert.strictEqual(meta.actionCount, 0);
    assert.strictEqual(fs.existsSync(runtimeRoot), true);

    // Check that latest.json was created
    const latestPath = path.join(runtimeRoot, 'latest.json');
    assert.strictEqual(fs.existsSync(latestPath), true);

    // Check that artifact file was created
    const artifactPath = path.join(runtimeRoot, `${meta.queueId}.json`);
    assert.strictEqual(fs.existsSync(artifactPath), true);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: rejects unsafe runtime root containing mind path', () => {
  const queue: MindMaintenancePreviewQueue = {
    kind: 'mind-maintenance-preview-queue',
    createdAt: '2026-05-17T19:30:00.000Z',
    source: 'wiki-health',
    actions: [],
    summary: {
      total: 0,
      lowRiskCount: 0,
      mediumRiskCount: 0,
      highRiskCount: 0,
      approvalRequiredCount: 0,
      blockedCount: 0,
    },
    writesToMind: false,
    externalSideEffects: false,
  };

  const unsafeRoot = path.join(tmpdir(), 'mind/runtime');
  assert.throws(() => writeMaintenancePreviewArtifact({ queue, runtimeRoot: unsafeRoot }));
});

test('preview-artifacts: rejects unsafe runtime root with traversal', () => {
  const queue: MindMaintenancePreviewQueue = {
    kind: 'mind-maintenance-preview-queue',
    createdAt: '2026-05-17T19:30:00.000Z',
    source: 'wiki-health',
    actions: [],
    summary: {
      total: 0,
      lowRiskCount: 0,
      mediumRiskCount: 0,
      highRiskCount: 0,
      approvalRequiredCount: 0,
      blockedCount: 0,
    },
    writesToMind: false,
    externalSideEffects: false,
  };

  const unsafeRoot = '../../etc/passwd';
  assert.throws(() => writeMaintenancePreviewArtifact({ queue, runtimeRoot: unsafeRoot }));
});

test('preview-artifacts: rejects unsafe runtime root with absolute path', () => {
  const queue: MindMaintenancePreviewQueue = {
    kind: 'mind-maintenance-preview-queue',
    createdAt: '2026-05-17T19:30:00.000Z',
    source: 'wiki-health',
    actions: [],
    summary: {
      total: 0,
      lowRiskCount: 0,
      mediumRiskCount: 0,
      highRiskCount: 0,
      approvalRequiredCount: 0,
      blockedCount: 0,
    },
    writesToMind: false,
    externalSideEffects: false,
  };

  const unsafeRoot = '/tmp/malicious';
  assert.throws(() => writeMaintenancePreviewArtifact({ queue, runtimeRoot: unsafeRoot }));
});

test('preview-artifacts: returns empty list when no artifacts exist', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');
    const items = listMaintenancePreviewArtifacts({ runtimeRoot });
    assert.strictEqual(items.length, 0);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: lists existing artifacts', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');

    const queue1: MindMaintenancePreviewQueue = {
      kind: 'mind-maintenance-preview-queue',
      createdAt: '2026-05-17T19:00:00.000Z',
      source: 'wiki-health',
      actions: [],
      summary: {
        total: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        approvalRequiredCount: 0,
        blockedCount: 0,
      },
      writesToMind: false,
      externalSideEffects: false,
    };

    const queue2: MindMaintenancePreviewQueue = {
      kind: 'mind-maintenance-preview-queue',
      createdAt: '2026-05-17T20:00:00.000Z',
      source: 'wiki-health',
      actions: [],
      summary: {
        total: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        approvalRequiredCount: 0,
        blockedCount: 0,
      },
      writesToMind: false,
      externalSideEffects: false,
    };

    writeMaintenancePreviewArtifact({ queue: queue1, runtimeRoot });
    writeMaintenancePreviewArtifact({ queue: queue2, runtimeRoot });

    const items = listMaintenancePreviewArtifacts({ runtimeRoot });
    assert.ok(items.length >= 1);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: marks artifacts as expired based on 24-hour expiry', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

    const queue: MindMaintenancePreviewQueue = {
      kind: 'mind-maintenance-preview-queue',
      createdAt: oldDate.toISOString(),
      source: 'wiki-health',
      actions: [],
      summary: {
        total: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        approvalRequiredCount: 0,
        blockedCount: 0,
      },
      writesToMind: false,
      externalSideEffects: false,
    };

    writeMaintenancePreviewArtifact({ queue, runtimeRoot });
    const items = listMaintenancePreviewArtifacts({ runtimeRoot });
    assert.ok(items.some((item) => item.expired));
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: reads artifact by queueId', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');

    const queue: MindMaintenancePreviewQueue = {
      kind: 'mind-maintenance-preview-queue',
      createdAt: '2026-05-17T19:30:00.000Z',
      source: 'wiki-health',
      actions: [],
      summary: {
        total: 0,
        lowRiskCount: 0,
        mediumRiskCount: 0,
        highRiskCount: 0,
        approvalRequiredCount: 0,
        blockedCount: 0,
      },
      writesToMind: false,
      externalSideEffects: false,
    };

    const meta = writeMaintenancePreviewArtifact({ queue, runtimeRoot });
    const readQueue = readMaintenancePreviewArtifact({ queueId: meta.queueId, runtimeRoot });

    assert.notStrictEqual(readQueue, null);
    assert.strictEqual(readQueue?.kind, 'mind-maintenance-preview-queue');
    assert.strictEqual(readQueue?.source, 'wiki-health');
    assert.strictEqual(readQueue?.writesToMind, false);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: returns null for non-existent queueId', () => {
  const tempDir = makeRuntimeRoot();
  try {
    const runtimeRoot = path.join(tempDir, 'runtime/local/model-router/maintenance-previews');
    const queue = readMaintenancePreviewArtifact({ queueId: 'queue-nonexistent', runtimeRoot });
    assert.strictEqual(queue, null);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('preview-artifacts: rejects unsafe runtime root on read', () => {
  const unsafeRoot = '../../etc/passwd';
  assert.throws(() => readMaintenancePreviewArtifact({ queueId: 'queue-anything', runtimeRoot: unsafeRoot }));
});
