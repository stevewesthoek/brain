import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {startCaptureHttpServer} from '../src/capture/server.mjs';
import {ingestDroppedFile} from '../src/intake/file-intake.mjs';
import {parseArgs, resolveCleanupMode, scanDropFolder, watchDropFolder} from '../src/intake/drop-watch.mjs';
import {listReviewQueue} from '../src/review/review.mjs';

function makeDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function request({port, method = 'GET', pathname = '/', headers = {}, body = ''}) {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, method, path: pathname, headers}, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('Paste into Evermind UI is served through the loopback capture server', async (t) => {
  const root = makeDir('evermind-intake-root-');
  const started = await startCaptureHttpServer({root, port: 0});
  t.after(() => new Promise((resolve) => started.server.close(resolve)));
  const response = await request({port: started.port});
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.match(response.body, /Paste into Evermind/);
  assert.match(response.body, /Add to Evermind/);
});

test('foreign browser origin requires adapter authentication while localhost remains allowed', async (t) => {
  const root = makeDir('evermind-intake-root-');
  const authValue = ['adapter', 'auth', 'value'].join('-');
  const started = await startCaptureHttpServer({root, port: 0, token: authValue});
  t.after(() => new Promise((resolve) => started.server.close(resolve)));
  const payload = JSON.stringify({content: 'browser capture', sourceType: 'browser', provenance: 'extension-test'});
  const blocked = await request({port: started.port, method: 'POST', pathname: '/capture', headers: {'content-type': 'application/json', origin: 'chrome-extension://abc123'}, body: payload});
  assert.equal(blocked.statusCode, 403);
  const allowed = await request({port: started.port, method: 'POST', pathname: '/capture', headers: {'content-type': 'application/json', origin: 'chrome-extension://abc123', 'x-evermind-token': authValue}, body: payload});
  assert.equal(allowed.statusCode, 201);
  assert.equal(JSON.parse(allowed.body).status, 'captured');
});

test('dropped text file is copied to artifact store and normalized into inbox/new', () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  const source = path.join(dropFolder, 'note.txt');
  fs.writeFileSync(source, 'A dropped note worth reviewing.\n');
  const result = ingestDroppedFile({root, dropFolder, artifactRoot, filePath: source});
  assert.equal(result.kind, 'text');
  assert.equal(result.extractionStatus, 'extracted');
  assert.equal(fs.existsSync(path.join(artifactRoot, result.artifact)), true);
  const captureText = fs.readFileSync(path.join(root, result.relativePath), 'utf8');
  assert.match(captureText, /A dropped note worth reviewing\./);
  assert.match(captureText, /status: "raw"/);
  assert.match(captureText, /authority: "unreviewed"/);
});

test('drop-folder scan is restart-safe for unchanged files', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  fs.writeFileSync(path.join(dropFolder, 'first.md'), '# First\n');
  const first = await scanDropFolder({root, dropFolder, artifactRoot, stabilityMs: 0});
  assert.equal(first.results.length, 1);
  assert.equal(listReviewQueue({root}).length, 1);
  const second = await scanDropFolder({root, dropFolder, artifactRoot, stabilityMs: 0});
  assert.equal(second.results.length, 0);
  assert.equal(listReviewQueue({root}).length, 1);
});

test('drop-folder scan waits for a stable file observation before ingesting', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  const source = path.join(dropFolder, 'copying.md');
  fs.writeFileSync(source, '# Stable after copy\n');

  const first = await scanDropFolder({root, dropFolder, artifactRoot, now: 1_000, stabilityMs: 1_000});
  assert.equal(first.results.length, 0);
  assert.equal(Object.keys(first.state.pending).length, 1);
  assert.equal(listReviewQueue({root}).length, 0);

  const beforeStable = await scanDropFolder({root, dropFolder, artifactRoot, now: 1_999, stabilityMs: 1_000});
  assert.equal(beforeStable.results.length, 0);
  assert.equal(listReviewQueue({root}).length, 0);

  const stable = await scanDropFolder({root, dropFolder, artifactRoot, now: 2_000, stabilityMs: 1_000});
  assert.equal(stable.results.length, 1);
  assert.equal(Object.keys(stable.state.pending).length, 0);
  assert.equal(listReviewQueue({root}).length, 1);
});

test('stability observation resets when a file changes and survives watcher restart', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  const source = path.join(dropFolder, 'changing.md');
  fs.writeFileSync(source, '# First\n');

  await scanDropFolder({root, dropFolder, artifactRoot, now: 10_000, stabilityMs: 500});
  fs.writeFileSync(source, '# Changed while copying\n');
  const changed = await scanDropFolder({root, dropFolder, artifactRoot, now: 10_500, stabilityMs: 500});
  assert.equal(changed.results.length, 0);

  const restarted = await scanDropFolder({root, dropFolder, artifactRoot, now: 11_000, stabilityMs: 500});
  assert.equal(restarted.results.length, 1);
  assert.match(fs.readFileSync(path.join(root, restarted.results[0].relativePath), 'utf8'), /Changed while copying/);
});

test('watcher CLI exposes conservative retention and cleanup controls', () => {
  const parsed = parseArgs([
    '--root', '/tmp/root', '--drop-folder', '/tmp/drop', '--retention-days', '14',
    '--cleanup-interval', '60000', '--keep-artifacts', '--apply', '--stability-ms', '2500',
  ]);
  assert.equal(parsed.retentionDays, 14);
  assert.equal(parsed.cleanupIntervalMs, 60000);
  assert.equal(parsed.keepArtifacts, true);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.stabilityMs, 2500);
  assert.equal(resolveCleanupMode(parsed), true);
  assert.equal(resolveCleanupMode(parseArgs(['--dry-run'])), false);
  assert.throws(() => resolveCleanupMode(parseArgs(['--apply', '--dry-run'])), /conflicting_cleanup_modes/);
});

test('drop-folder symlinks cannot escape the watched folder', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  const outside = path.join(makeDir('evermind-outside-'), 'secret.md');
  fs.writeFileSync(outside, 'outside content');
  fs.symlinkSync(outside, path.join(dropFolder, 'linked.md'));

  const result = await scanDropFolder({root, dropFolder, artifactRoot, stabilityMs: 0});
  assert.equal(result.results.length, 0);
  assert.equal(listReviewQueue({root}).length, 0);
});

test('watcher emits a review-ready notification after ingestion', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = makeDir('evermind-artifacts-');
  fs.writeFileSync(path.join(dropFolder, 'ready.txt'), 'ready for review');
  const notifications = [];
  const watcher = await watchDropFolder({
    root,
    dropFolder,
    artifactRoot,
    stabilityMs: 0,
    intervalMs: 60_000,
    keepArtifacts: true,
    notifier: {notify: (request) => { notifications.push(request); return {delivered: true, kind: 'test'}; }},
  });
  watcher.stop();
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, 'review-ready-capture');
  assert.match(notifications[0].deepLink, /^evermind:\/\/capture\//);
  assert.equal(notifications[0].summary, 'A new capture is waiting for human review.');
});

test('watcher failure notification exposes only a safe error code', async () => {
  const root = makeDir('evermind-intake-root-');
  const dropFolder = makeDir('evermind-drop-');
  const artifactRoot = path.join(makeDir('evermind-artifact-file-'), 'not-a-directory');
  fs.writeFileSync(artifactRoot, 'not a directory');
  fs.writeFileSync(path.join(dropFolder, 'failure.txt'), 'will fail safely');
  const notifications = [];
  const errors = [];
  const watcher = await watchDropFolder({
    root,
    dropFolder,
    artifactRoot,
    stabilityMs: 0,
    intervalMs: 60_000,
    keepArtifacts: true,
    notifier: {notify: (request) => { notifications.push(request); return {delivered: true, kind: 'test'}; }},
    onError: (error) => errors.push(error),
  });
  watcher.stop();
  assert.equal(errors.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, 'processing-failure');
  assert.match(notifications[0].summary, /Processing stopped safely \([A-Za-z0-9_.:-]+\)\./);
  assert.doesNotMatch(notifications[0].summary, /evermind-artifact-file|not-a-directory/);
});

test('legacy Markdown inbox item appears as reviewable legacy capture without rewrite', () => {
  const root = makeDir('evermind-intake-root-');
  fs.mkdirSync(path.join(root, 'inbox', 'new'), {recursive: true});
  const file = path.join(root, 'inbox', 'new', 'legacy.md');
  const original = '---\nsource: save-to-mind\ncreated: 2026-08-29\n---\n\n# Legacy capture\n\nHistorical content.\n';
  fs.writeFileSync(file, original);
  const queue = listReviewQueue({root});
  assert.equal(queue.length, 1);
  assert.equal(queue[0].legacy, true);
  assert.match(queue[0].captureId, /^legacy-/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});
