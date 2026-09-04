import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CODEX_USAGE_BOUNDS, createCodexUsageReader } from '../adapters/codex-usage-reader.js';

function tokenEvent(timestamp: string, usedPercent: number): string {
  return `${JSON.stringify({
    type: 'event_msg',
    timestamp,
    payload: {
      type: 'token_count',
      rate_limits: {
        primary: { used_percent: usedPercent, window_minutes: 300, resets_at: 2000000000 },
        secondary: { used_percent: usedPercent / 2, window_minutes: 10080, resets_at: 2000000000 },
      },
    },
  })}\n`;
}

async function makeFixture(): Promise<{ root: string; cachePath: string }> {
  const root = await fs.mkdtemp(path.join(process.env.TMPDIR ?? '/tmp', 'brain-codex-usage-'));
  return { root, cachePath: path.join(root, 'cache', 'index.json') };
}

async function writeSession(root: string, name: string, timestamp: string, usedPercent: number): Promise<string> {
  const filePath = path.join(root, name);
  await fs.writeFile(filePath, `${JSON.stringify({ type: 'session_meta' })}\n${tokenEvent(timestamp, usedPercent)}`);
  return filePath;
}

test('cold and warm refreshes are bounded and incremental', async () => {
  const fixture = await makeFixture();
  try {
    const first = await writeSession(fixture.root, 'first.jsonl', '2026-09-04T20:00:00.000Z', 12);
    const second = await writeSession(fixture.root, 'second.jsonl', '2026-09-04T20:01:00.000Z', 24);
    const reader = createCodexUsageReader({ sessionsDir: fixture.root, cachePath: fixture.cachePath });

    const pending = reader.getSnapshot();
    assert.equal(pending.freshness, 'PENDING');
    const cold = await reader.refresh();
    assert.equal(cold.freshness, 'CURRENT');
    assert.equal(cold.fiveHour.usedPercent, 24);
    assert.equal(cold.diagnostics.filesRead, 2);
    assert.ok(cold.diagnostics.bytesRead > 0);

    const warm = await reader.refresh();
    assert.equal(warm.freshness, 'CURRENT');
    assert.equal(warm.diagnostics.filesRead, 0);
    assert.equal(warm.diagnostics.cachedFiles, 2);
    assert.equal(warm.diagnostics.bytesRead, 0);

    const persistedReader = createCodexUsageReader({ sessionsDir: fixture.root, cachePath: fixture.cachePath });
    const persisted = await persistedReader.refresh();
    assert.equal(persisted.freshness, 'CURRENT');
    assert.equal(persisted.diagnostics.filesRead, 0);
    assert.equal(persisted.diagnostics.cachedFiles, 2);

    await writeSession(fixture.root, 'new.jsonl', '2026-09-04T20:02:00.000Z', 36);
    const added = await reader.refresh();
    assert.equal(added.fiveHour.usedPercent, 36);
    assert.equal(added.diagnostics.filesRead, 1);

    await fs.writeFile(second, `${JSON.stringify({ type: 'session_meta' })}\n${tokenEvent('2026-09-04T20:03:00.000Z', 48)}`);
    const changed = await reader.refresh();
    assert.equal(changed.fiveHour.usedPercent, 48);
    assert.equal(changed.diagnostics.filesRead, 1);

    await fs.writeFile(first, 'not-json\n');
    const corrupt = await reader.refresh();
    assert.equal(corrupt.freshness, 'CURRENT');
    assert.equal(corrupt.diagnostics.errorCount, 0);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('expired values stay available while one stale-while-revalidate job runs', async () => {
  const fixture = await makeFixture();
  let clock = Date.parse('2026-09-04T20:00:00.000Z');
  try {
    await writeSession(fixture.root, 'one.jsonl', '2026-09-04T20:00:00.000Z', 12);
    const reader = createCodexUsageReader({
      sessionsDir: fixture.root,
      cachePath: fixture.cachePath,
      now: () => clock,
      refreshTtlMs: 100,
    });
    await reader.refresh();
    clock += 101;
    const stale = reader.getSnapshot();
    assert.equal(stale.freshness, 'STALE');
    assert.equal(stale.fiveHour.usedPercent, 12);
    assert.ok(reader.getInFlightRefresh());
    await reader.getInFlightRefresh();
    assert.equal(reader.getSnapshot().freshness, 'CURRENT');
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('hard bounds cap files, bytes, and retained index entries', async () => {
  const fixture = await makeFixture();
  try {
    for (let index = 0; index < 20; index += 1) {
      const filePath = await writeSession(fixture.root, `session-${index}.jsonl`, `2026-09-04T20:${String(index).padStart(2, '0')}:00.000Z`, index);
      await fs.appendFile(filePath, 'x'.repeat(2048));
    }
    const reader = createCodexUsageReader({
      sessionsDir: fixture.root,
      cachePath: fixture.cachePath,
      maxFiles: 5,
      maxBytesPerRefresh: 512,
      maxTailBytesPerFile: 128,
    });
    const result = await reader.refresh();
    assert.equal(result.freshness, 'DEGRADED');
    assert.equal(result.diagnostics.filesInspected, 5);
    assert.ok(result.diagnostics.bytesRead <= 512);
    assert.equal(Object.keys(JSON.parse(await fs.readFile(fixture.cachePath, 'utf8')).records).length, 5);
    assert.ok(CODEX_USAGE_BOUNDS.maxBytesPerRefresh > 0);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('corrupt and unreadable files degrade only Codex telemetry', async () => {
  const fixture = await makeFixture();
  try {
    await writeSession(fixture.root, 'good.jsonl', '2026-09-04T20:00:00.000Z', 12);
    await writeSession(fixture.root, 'unreadable.jsonl', '2026-09-04T20:01:00.000Z', 24);
    const reader = createCodexUsageReader({
      sessionsDir: fixture.root,
      cachePath: fixture.cachePath,
      readFileTail: async (filePath, maxBytes) => {
        if (filePath.endsWith('unreadable.jsonl')) throw new Error('synthetic permission failure');
        const data = await fs.readFile(filePath);
        return { text: data.subarray(Math.max(0, data.length - maxBytes)).toString(), bytesRead: Math.min(data.length, maxBytes) };
      },
    });
    const result = await reader.refresh();
    assert.equal(result.freshness, 'DEGRADED');
    assert.equal(result.fiveHour.usedPercent, 12);
    assert.equal(result.diagnostics.errorCount, 1);
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test('concurrent callers share one in-flight bounded refresh', async () => {
  const fixture = await makeFixture();
  try {
    await writeSession(fixture.root, 'one.jsonl', '2026-09-04T20:00:00.000Z', 12);
    await writeSession(fixture.root, 'two.jsonl', '2026-09-04T20:01:00.000Z', 24);
    let reads = 0;
    let activeReads = 0;
    let maxActiveReads = 0;
    const reader = createCodexUsageReader({
      sessionsDir: fixture.root,
      cachePath: fixture.cachePath,
      readFileTail: async (filePath, maxBytes) => {
        reads += 1;
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        const data = await fs.readFile(filePath);
        activeReads -= 1;
        return { text: data.subarray(Math.max(0, data.length - maxBytes)).toString(), bytesRead: Math.min(data.length, maxBytes) };
      },
    });
    const snapshots = await Promise.all(Array.from({ length: 20 }, () => reader.refresh()));
    assert.equal(reads, 2);
    assert.equal(maxActiveReads, 1);
    assert.ok(snapshots.every((snapshot) => snapshot.fiveHour.usedPercent === 24));
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
