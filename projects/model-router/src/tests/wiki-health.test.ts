import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMindWikiHealthResultFromRoot } from '../wiki-health.js';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mind-wiki-health-'));
}

test('healthy Mind fixture reports no findings and preview-safe flags', () => {
  const root = makeRoot();
  try {
    fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(root, 'capture', 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(root, 'capture', 'failed'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
    fs.writeFileSync(path.join(root, 'wiki', 'index.md'), '# Wiki Index\n\n- [[people]]\n- [[organisations]]\n');
    fs.writeFileSync(path.join(root, 'wiki', 'log.md'), '# Wiki Log\n\nNo automated entries yet.\n');
    fs.writeFileSync(path.join(root, 'wiki', 'people.md'), '# People\n\nSource: capture/inbox/people.md\n');
    fs.writeFileSync(path.join(root, 'sources', 'index.md'), '# Sources\n\n- web\n');
    fs.writeFileSync(path.join(root, 'capture', 'inbox', 'recent.md'), '# Recent\n');
    fs.writeFileSync(path.join(root, 'capture', 'failed', 'failed.md'), '# Failed\n');

    const result = createMindWikiHealthResultFromRoot(root, new Date('2026-05-17T12:00:00.000Z'));

    assert.equal(result.kind, 'mind-wiki-health');
    assert.equal(result.writesToMind, false);
    assert.equal(result.externalSideEffects, false);
    assert.equal(result.ok, true);
    assert.equal(result.summary.errorCount, 0);
    assert.equal(result.summary.warningCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing wiki/log.md is reported', () => {
  const root = makeRoot();
  try {
    fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
    fs.writeFileSync(path.join(root, 'wiki', 'index.md'), '# Wiki Index\n');
    fs.writeFileSync(path.join(root, 'sources', 'index.md'), '# Sources\n');

    const result = createMindWikiHealthResultFromRoot(root);

    assert.equal(result.writesToMind, false);
    assert.equal(result.externalSideEffects, false);
    assert.equal(result.findings.some((finding) => finding.path === 'wiki/log.md'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('oversized wiki pages and missing source traces are reported', () => {
  const root = makeRoot();
  try {
    fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
    fs.writeFileSync(path.join(root, 'wiki', 'index.md'), '# Wiki Index\n- [[big]]\n');
    fs.writeFileSync(path.join(root, 'wiki', 'log.md'), '# Wiki Log\n');
    fs.writeFileSync(path.join(root, 'wiki', 'big.md'), `${Array.from({ length: 501 }, (_, index) => `Line ${index + 1}`).join('\n')}\n`);
    fs.writeFileSync(path.join(root, 'sources', 'index.md'), '# Sources\n');

    const result = createMindWikiHealthResultFromRoot(root);

    assert.equal(result.findings.some((finding) => finding.id === 'oversized-wiki-page'), true);
    assert.equal(result.findings.some((finding) => finding.id === 'missing-source-trace'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale capture inbox and failed capture items are reported', () => {
  const root = makeRoot();
  try {
    fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sources'), { recursive: true });
    fs.mkdirSync(path.join(root, 'capture', 'inbox'), { recursive: true });
    fs.mkdirSync(path.join(root, 'capture', 'failed'), { recursive: true });
    fs.writeFileSync(path.join(root, 'wiki', 'index.md'), '# Wiki Index\n');
    fs.writeFileSync(path.join(root, 'wiki', 'log.md'), '# Wiki Log\n');
    fs.writeFileSync(path.join(root, 'sources', 'index.md'), '# Sources\n');
    const staleInbox = path.join(root, 'capture', 'inbox', 'old.md');
    const staleFailed = path.join(root, 'capture', 'failed', 'old.md');
    fs.writeFileSync(staleInbox, '# Old inbox\n');
    fs.writeFileSync(staleFailed, '# Old failed\n');
    const oldDate = new Date('2026-05-01T00:00:00.000Z');
    fs.utimesSync(staleInbox, oldDate, oldDate);
    fs.utimesSync(staleFailed, oldDate, oldDate);

    const result = createMindWikiHealthResultFromRoot(root, new Date('2026-05-17T12:00:00.000Z'));

    assert.equal(result.summary.staleCaptureCount, 1);
    assert.equal(result.summary.failedCaptureCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unsafe roots are rejected', () => {
  assert.throws(() => createMindWikiHealthResultFromRoot('/tmp/mind/.git'), /Unsafe model-router wiki health root path/);
});
