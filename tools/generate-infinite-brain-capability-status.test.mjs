import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCapabilityStatus, renderCapabilityStatus} from './generate-infinite-brain-capability-status.mjs';
import {loadJsonFile} from './capability-manifest-utils.mjs';

const scriptPath = path.resolve('tools/generate-infinite-brain-capability-status.mjs');
const manifestPath = path.resolve('operations/specs/infinite-brain-capabilities.json');
const runbookPath = path.resolve('operations/runbooks/infinite-brain-roadmap-status.md');

function makeTempFiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-capability-status-'));
  const tempRunbook = path.join(root, 'status.md');
  const tempManifest = path.join(root, 'capabilities.json');
  fs.copyFileSync(runbookPath, tempRunbook);
  fs.copyFileSync(manifestPath, tempManifest);
  return {root, tempRunbook, tempManifest};
}

function runScript(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {cwd: path.resolve('.'), encoding: 'utf8'});
}

test('first generation succeeds', () => {
  const {tempRunbook, tempManifest} = makeTempFiles();
  const result = runScript(['--write', '--file', tempRunbook, '--manifest', tempManifest]);
  assert.equal(result.status, 0);
  assert(result.stdout.includes('capability-status=written'));
  const content = fs.readFileSync(tempRunbook, 'utf8');
  assert(content.includes('<!-- BEGIN GENERATED CAPABILITY STATUS -->'));
  assert(content.includes('context-gateway-core'));
});

test('second generation produces no diff', () => {
  const {tempRunbook, tempManifest} = makeTempFiles();
  const first = runScript(['--write', '--file', tempRunbook, '--manifest', tempManifest]);
  const second = runScript(['--check', '--file', tempRunbook, '--manifest', tempManifest]);
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert(second.stdout.includes('capability-status=pass'));
});

test('human notes preserved', () => {
  const {tempRunbook, tempManifest} = makeTempFiles();
  const before = fs.readFileSync(tempRunbook, 'utf8');
  runScript(['--write', '--file', tempRunbook, '--manifest', tempManifest]);
  const after = fs.readFileSync(tempRunbook, 'utf8');
  assert(after.includes('This page reports reality.'));
  assert(before.includes('This page reports reality.'));
});

test('manual generated-block edit detected', () => {
  const {tempRunbook, tempManifest} = makeTempFiles();
  runScript(['--write', '--file', tempRunbook, '--manifest', tempManifest]);
  const content = fs.readFileSync(tempRunbook, 'utf8').replace('context-gateway-core', 'context-gateway-core-tampered');
  fs.writeFileSync(tempRunbook, content);
  const result = runScript(['--check', '--file', tempRunbook, '--manifest', tempManifest]);
  assert.equal(result.status, 1);
  assert(result.stdout.includes('capability-status=diff'));
});

test('invalid manifest rejected', () => {
  const {tempRunbook, tempManifest} = makeTempFiles();
  const bad = loadJsonFile(tempManifest);
  bad.schemaVersion = '2.0.0';
  fs.writeFileSync(tempManifest, `${JSON.stringify(bad, null, 2)}\n`);
  const result = runScript(['--check', '--file', tempRunbook, '--manifest', tempManifest]);
  assert.equal(result.status, 1);
  assert(result.stderr.includes('invalid_manifest'));
});

test('evidence failure shown', () => {
  const manifest = loadJsonFile(manifestPath);
  const block = renderCapabilityStatus(manifest, {
    evidenceRunner: (command) => (command === 'npm --prefix projects/mind-context test'
      ? {ok: false, status: 1, stdout: '', stderr: 'boom'}
      : {ok: true, status: 0, stdout: '', stderr: ''}),
  });
  assert(block.includes('FAILED: npm --prefix projects/mind-context test'));
});

test('deterministic output', () => {
  const manifest = loadJsonFile(manifestPath);
  const first = renderCapabilityStatus(manifest, {evidenceRunner: (command) => ({ok: true, status: 0, stdout: command, stderr: ''})});
  const second = renderCapabilityStatus(manifest, {evidenceRunner: (command) => ({ok: true, status: 0, stdout: command, stderr: ''})});
  assert.equal(first, second);
});
