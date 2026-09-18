import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {buildRawCapture, writeRawCapture} from '../src/capture/capture.mjs';
import {LOOPBACK_HOST, startCaptureHttpServer} from '../src/capture/server.mjs';

const cliPath = path.resolve('src/cli/cli.mjs');
const serverPath = path.resolve('src/capture/server.mjs');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-capture-'));
}

function runCli(args, options = {}) {
  const {env, ...spawnOptions} = options;
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    env: {...process.env, ...(env ?? {})},
    ...spawnOptions,
  });
}

function request({port, method = 'POST', pathname = '/capture', contentType = 'application/json', body = '', headers = {}}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = {...headers, ...(contentType ? {'content-type': contentType} : {})};
    const req = http.request({host: LOOPBACK_HOST, port, method, path: pathname, headers: requestHeaders}, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('raw capture metadata stays explicitly unreviewed', () => {
  const capture = buildRawCapture({
    content: 'Remember this decision.',
    sourceType: 'test',
    provenance: 'unit-test',
    capturedAt: '2026-09-17T00:00:00.000Z',
    captureId: '11111111-1111-4111-8111-111111111111',
  });
  assert.match(capture.markdown, /status: "raw"/);
  assert.match(capture.markdown, /authority: "unreviewed"/);
  assert.match(capture.markdown, /source_type: "test"/);
  assert.match(capture.markdown, /provenance: "unit-test"/);
  assert.match(capture.markdown, /Remember this decision\./);
});

test('writeRawCapture writes only beneath inbox/new with private mode', () => {
  const root = makeRoot();
  const result = writeRawCapture({
    root,
    content: 'Raw inbox content',
    sourceType: 'test',
    provenance: 'unit-test',
    capturedAt: '2026-09-17T00:00:00.000Z',
    captureId: '22222222-2222-4222-8222-222222222222',
  });
  assert.match(result.relativePath, /^inbox\/new\//);
  const target = path.join(root, result.relativePath);
  assert.equal(fs.existsSync(target), true);
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.equal(fs.readdirSync(path.join(root, 'inbox')).sort().join(','), 'new');
});

test('writeRawCapture rejects inbox/new symlink escaping the root', () => {
  const root = makeRoot();
  const outside = makeRoot();
  fs.mkdirSync(path.join(root, 'inbox'), {recursive: true});
  fs.symlinkSync(outside, path.join(root, 'inbox', 'new'));
  assert.throws(() => writeRawCapture({root, content: 'must not escape'}), /capture_path_outside_root/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('CLI captures positional text into inbox/new', () => {
  const root = makeRoot();
  const result = runCli(['capture', 'CLI raw thought', '--root', root, '--source-type', 'manual', '--provenance', 'cli-test']);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'captured');
  assert.equal(payload.sourceType, 'manual');
  assert.equal(payload.provenance, 'cli-test');
  assert.match(payload.relativePath, /^inbox\/new\//);
  assert.match(fs.readFileSync(path.join(root, payload.relativePath), 'utf8'), /CLI raw thought/);
});

test('CLI captures stdin and reports missing content as usage error', () => {
  const root = makeRoot();
  const piped = runCli(['capture', '--root', root], {input: 'piped raw thought\n'});
  assert.equal(piped.status, 0, piped.stderr);
  const payload = JSON.parse(piped.stdout);
  assert.match(fs.readFileSync(path.join(root, payload.relativePath), 'utf8'), /piped raw thought/);

  const missing = runCli(['capture', '--root', root], {input: ''});
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing_content/);
});

test('HTTP capture binds to loopback and writes JSON payload to inbox/new', async (t) => {
  const root = makeRoot();
  const started = await startCaptureHttpServer({root, port: 0});
  t.after(() => new Promise((resolve) => started.server.close(resolve)));
  assert.equal(started.host, '127.0.0.1');
  const address = started.server.address();
  assert.equal(typeof address === 'object' && address ? address.address : null, '127.0.0.1');

  const response = await request({
    port: started.port,
    body: JSON.stringify({content: 'HTTP raw thought', sourceType: 'shortcut', provenance: 'localhost-test'}),
  });
  assert.equal(response.statusCode, 201);
  const payload = JSON.parse(response.body);
  assert.equal(payload.status, 'captured');
  assert.equal(payload.sourceType, 'shortcut');
  assert.equal(payload.provenance, 'localhost-test');
  assert.match(payload.relativePath, /^inbox\/new\//);
  assert.match(fs.readFileSync(path.join(root, payload.relativePath), 'utf8'), /HTTP raw thought/);
});

test('HTTP capture rejects unsupported routes, methods, media, malformed JSON and oversized capture', async (t) => {
  const root = makeRoot();
  const started = await startCaptureHttpServer({root, port: 0});
  t.after(() => new Promise((resolve) => started.server.close(resolve)));

  assert.equal((await request({port: started.port, pathname: '/other'})).statusCode, 404);
  assert.equal((await request({port: started.port, method: 'GET'})).statusCode, 405);
  assert.equal((await request({port: started.port, contentType: 'application/octet-stream', body: 'x'})).statusCode, 415);
  assert.equal((await request({port: started.port, body: '{'})).statusCode, 400);
  assert.equal((await request({port: started.port, body: JSON.stringify({content: 'blocked'}), headers: {origin: 'https://example.com'}})).statusCode, 403);
  const oversized = 'x'.repeat(1024 * 1024 + 1);
  assert.equal((await request({port: started.port, contentType: 'text/plain', body: oversized})).statusCode, 413);
});

test('existing context provider remains mutation-free', async () => {
  const runtime = await import('../src/provider/runtime.mjs');
  assert.equal(runtime.TOOL_DEFINITIONS.some((tool) => /capture|write|mutat/i.test(tool.name)), false);
  assert.equal(runtime.TOOL_DEFINITIONS.every((tool) => tool.annotations.readOnlyHint === true), true);
});




test('raw capture rejects non-string metadata and malformed capture ids', () => {
  assert.throws(() => buildRawCapture({content: 'x', sourceType: 42}), /invalid_source_type/);
  assert.throws(() => buildRawCapture({content: 'x', provenance: null}), /invalid_provenance/);
  assert.throws(() => buildRawCapture({content: 'x', captureId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}), /invalid_capture_id/);
});

test('CLI reports invalid capture root and oversized capture as usage errors', () => {
  const missingRoot = runCli(['capture', 'x', '--root', path.join(makeRoot(), 'does-not-exist')]);
  assert.equal(missingRoot.status, 2);
  assert.match(missingRoot.stderr, /invalid_capture_root/);

  const root = makeRoot();
  const oversized = runCli(['capture', '--root', root], {input: 'x'.repeat(1024 * 1024 + 1)});
  assert.equal(oversized.status, 2);
  assert.match(oversized.stderr, /capture_too_large/);
});

test('HTTP capture rejects non-loopback Host headers', async (t) => {
  const root = makeRoot();
  const started = await startCaptureHttpServer({root, port: 0});
  t.after(() => new Promise((resolve) => started.server.close(resolve)));

  const response = await request({
    port: started.port,
    body: JSON.stringify({content: 'blocked'}),
    headers: {host: `example.com:${started.port}`},
  });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).code, 'host_not_allowed');
  assert.equal(fs.existsSync(path.join(root, 'inbox')), false);
});




test('npm-style symlinked CLI and capture-server entrypoints execute directly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-bin-'));
  const cliLink = path.join(dir, 'evermind');
  const serverLink = path.join(dir, 'evermind-capture-server');
  fs.symlinkSync(cliPath, cliLink);
  fs.symlinkSync(serverPath, serverLink);

  const cli = spawnSync(cliLink, ['--help'], {encoding: 'utf8'});
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /Usage:/);

  const server = spawnSync(serverLink, ['--help'], {encoding: 'utf8'});
  assert.equal(server.status, 0, server.stderr);
  assert.match(server.stdout, /Usage: node src\/capture\/server\.mjs/);
});
