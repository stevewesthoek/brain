import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const scriptPath = path.join(import.meta.dirname, 'video-runtime-report.sh');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'video-runtime-report-'));
  const value = {
    base,
    repoRoot: path.join(base, 'repo'),
    reportDir: path.join(base, 'report'),
    temporaryRoot: path.join(base, 'temporary'),
    durableRoot: path.join(base, 'durable'),
    unknownRoot: path.join(base, 'unknown'),
    outsideRoot: path.join(base, 'outside'),
  };
  for (const directory of Object.values(value).slice(1)) fs.mkdirSync(directory, { recursive: true });
  return value;
}

function rootSpec(id, rootPath, classification) {
  return { id, path: rootPath, classification };
}

function runReport(input, roots, extraEnv = {}) {
  const env = {
    ...process.env,
    VIDEO_RUNTIME_REPORT_REPO_ROOT: input.repoRoot,
    VIDEO_RUNTIME_REPORT_DIR: input.reportDir,
    VIDEO_RUNTIME_REPORT_STORAGE_ROOTS_JSON: JSON.stringify(roots),
    ...extraEnv,
  };
  execFileSync('/bin/bash', [scriptPath], { cwd: input.repoRoot, env, encoding: 'utf8', timeout: 3_000 });
  const jsonPath = path.join(input.reportDir, 'latest.json');
  const markdownPath = path.join(input.reportDir, 'latest.md');
  return {
    json: JSON.parse(fs.readFileSync(jsonPath, 'utf8')),
    markdown: fs.readFileSync(markdownPath, 'utf8'),
  };
}

function cleanup(input) {
  fs.rmSync(input.base, { recursive: true, force: true });
}

test('report collects only approved roots and preserves report-only compatibility', () => {
  const input = fixture();
  const sentinel = 'PRIVATE_VIDEO_CONTENT_MUST_NOT_APPEAR';
  try {
    fs.mkdirSync(path.join(input.temporaryRoot, 'cache'), { recursive: true });
    fs.writeFileSync(path.join(input.temporaryRoot, 'cache', 'cache.bin'), Buffer.alloc(7, 1));
    fs.writeFileSync(path.join(input.durableRoot, 'report-state.json'), 'report-state');
    fs.writeFileSync(path.join(input.unknownRoot, 'private-video.mp4'), sentinel);
    fs.writeFileSync(path.join(input.outsideRoot, 'outside.mp4'), 'outside-only');

    const result = runReport(input, [
      rootSpec('temporary-cache', input.temporaryRoot, 'CURRENT_TEMPORARY'),
      rootSpec('durable-state', input.durableRoot, 'CURRENT_DURABLE'),
      rootSpec('unclassified-local', input.unknownRoot, 'UNKNOWN'),
    ]);
    const { json, markdown } = result;
    const storage = json.storage;

    assert.equal(json.job, 'video-runtime-report');
    assert.equal(json.mode, 'report-only');
    assert.equal(json.writesToMind, false);
    assert.equal(json.executableActions, false);
    assert.equal(json.deletesFiles, false);
    assert.deepEqual(json.queue, []);
    assert.equal(storage.rootCount, 3);
    assert.equal(storage.totals.temporaryBytes, 7);
    assert.equal(storage.totals.durableBytes, Buffer.byteLength('report-state'));
    assert.equal(storage.totals.unknownBytes, Buffer.byteLength(sentinel));
    assert.equal(storage.totals.legacyBytes, 0);
    assert.equal(storage.candidateCount, 0);
    assert.equal(storage.safety.reportOnly, true);
    assert.equal(storage.safety.writesToMind, false);
    assert.equal(storage.safety.executableActions, false);
    assert.equal(storage.safety.deletesFiles, false);
    assert.equal(storage.safety.movesFiles, false);
    assert.equal(storage.safety.archivesFiles, false);
    assert.equal(storage.safety.networkAccess, false);
    assert.deepEqual(fs.readdirSync(input.reportDir).sort(), ['latest.json', 'latest.md']);
    assert.equal(fs.existsSync(path.join(input.outsideRoot, 'outside.mp4')), true);
    assert.doesNotMatch(JSON.stringify(json), new RegExp(sentinel));
    assert.doesNotMatch(JSON.stringify(json), /private-video\.mp4/);
    assert.doesNotMatch(markdown, /PRIVATE_VIDEO_CONTENT|private-video\.mp4|outside-only/);
    assert.match(markdown, /## Storage/);
    assert.match(markdown, /temporary-cache/);
    assert.match(markdown, /Deletes files: false/);
  } finally {
    cleanup(input);
  }
});

test('report rejects symlink escapes and gives missing roots a safe status', () => {
  const input = fixture();
  try {
    fs.writeFileSync(path.join(input.temporaryRoot, 'allowed.txt'), 'allowed');
    fs.writeFileSync(path.join(input.outsideRoot, 'secret.txt'), 'secret');
    fs.symlinkSync(input.outsideRoot, path.join(input.temporaryRoot, 'escape'));

    const { json } = runReport(input, [
      rootSpec('visible-root', input.temporaryRoot, 'CURRENT_TEMPORARY'),
      rootSpec('missing-root', path.join(input.base, 'does-not-exist'), 'UNKNOWN'),
    ]);
    const visible = json.storage.roots.find((root) => root.id === 'visible-root');
    const missing = json.storage.roots.find((root) => root.id === 'missing-root');

    assert.equal(visible.status, 'partial');
    assert.equal(visible.fileCount, 1);
    assert.ok(visible.warnings.includes('visible-root:symlink-entry-rejected'));
    assert.equal(missing.status, 'missing');
    assert.equal(missing.exists, false);
    assert.ok(missing.warnings.includes('missing-root:root-missing'));
    assert.ok(json.storage.collectionErrors.includes('visible-root:symlink-entry-rejected'));
    assert.equal(fs.existsSync(path.join(input.outsideRoot, 'secret.txt')), true);
  } finally {
    cleanup(input);
  }
});

test('report turns unreadable roots into partial or unavailable evidence', () => {
  const input = fixture();
  try {
    fs.writeFileSync(path.join(input.temporaryRoot, 'readable.txt'), 'readable');
    fs.chmodSync(input.unknownRoot, 0o000);
    const { json } = runReport(input, [rootSpec('permission-root', input.unknownRoot, 'UNKNOWN')]);
    const root = json.storage.roots[0];

    assert.ok(['partial', 'unavailable'].includes(root.status));
    assert.ok(root.warnings.some((warning) => /permission-denied|directory-read-failed/.test(warning)));
    assert.equal(json.storage.status, 'partial');
  } finally {
    fs.chmodSync(input.unknownRoot, 0o700);
    cleanup(input);
  }
});

test('report remains bounded by file count and contains no mutation or network path', () => {
  const input = fixture();
  try {
    for (let index = 0; index < 30; index += 1) {
      fs.writeFileSync(path.join(input.unknownRoot, `fixture-${index}.bin`), `${index}`);
    }
    const started = Date.now();
    const { json } = runReport(input, [rootSpec('bounded-root', input.unknownRoot, 'UNKNOWN')], {
      VIDEO_RUNTIME_REPORT_MAX_FILES: '5',
      VIDEO_RUNTIME_REPORT_MAX_DEPTH: '2',
      VIDEO_RUNTIME_REPORT_SCAN_TIMEOUT_SECONDS: '1',
    });
    const elapsed = Date.now() - started;
    const root = json.storage.roots[0];
    const source = fs.readFileSync(scriptPath, 'utf8');

    assert.ok(elapsed < 3_000, `bounded report took ${elapsed}ms`);
    assert.equal(root.status, 'partial');
    assert.equal(root.fileCount, 5);
    assert.ok(root.warnings.includes('bounded-root:max-files-reached'));
    assert.match(JSON.stringify(json.storage.bounds), /maxFilesPerRoot/);
    assert.doesNotMatch(source, /\b(?:rm|unlink|rmdir)\s*\(/);
    assert.doesNotMatch(source, /(?:os\.remove|os\.unlink|shutil\.rmtree|subprocess|urllib|requests|curl|fetch\s*\()/);
  } finally {
    cleanup(input);
  }
});
