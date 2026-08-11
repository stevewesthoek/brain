import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  classifyChanges,
  collectDocuments,
  loadGraphifyProfile,
  loadSemanticState,
  pruneReceipts,
  runSemanticEvent,
  writeReceipt,
} from './b8-5-graphify-semantic.mjs';

const ROOT = path.resolve('.');
const PROFILE_PATH = path.join(ROOT, 'operations/specs/graphify-operational-profile.json');
const profile = loadGraphifyProfile(PROFILE_PATH);
const scopeId = 'brain-architecture-docs';
const approvedPath = 'docs/system/graphify-context-standard.md';

function tempDir(prefix = 'b8-5-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function prepareRepo(root, content = '# Graphify\nsemantic source\n') {
  const file = path.join(root, approvedPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'code.ts'), 'export const code=1;');
}

function fakeRunner(root, { fail = false } = {}) {
  const file = path.join(root, fail ? 'fail-runner.mjs' : 'fake-runner.mjs');
  fs.writeFileSync(file, `#!/usr/bin/env node
import fs from 'node:fs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)]}));
fs.writeFileSync(${JSON.stringify(path.join(root, fail ? 'fail-invoked' : 'runner-invoked'))},'1');
${fail ? "console.error('forced failure');process.exit(7);" : "const m=JSON.parse(fs.readFileSync(args.manifest,'utf8'));fs.writeFileSync(args.output,JSON.stringify({authority:'non-authoritative',documents:m.documents.map(d=>d.path)}));"}
`);
  fs.chmodSync(file, 0o755);
  return file;
}

test('profile is Brain-only, semantic-only, and model-optional', () => {
  assert.deepEqual(profile.corpus.repositories, ['brain']);
  assert.equal(profile.corpus.mindApproved, false);
  assert.equal(profile.execution.automaticFullScan, false);
  assert.equal(profile.execution.structuralGraphGeneration, 'frozen');
  assert.equal(profile.execution.codeOnlyInvokeRunner, false);
  assert.equal(profile.execution.runnerMode, 'explicit-only');
  assert.equal(profile.safety.externalOrLocalModelRequired, false);
});

test('code-only change never invokes runner or marks projection stale', async () => {
  const root = tempDir();
  const outputRoot = path.join(root, 'runtime-output');
  try {
    prepareRepo(root);
    const runner = fakeRunner(root);
    const result = await runSemanticEvent({ repositoryRoot: root, profile, scopeId, changedFiles: ['src/code.ts'], runnerPath: runner, outputRoot, sourceHead: 'a'.repeat(40) });
    assert.equal(result.status, 'no-relevant-semantic-change');
    assert.equal(result.runnerInvoked, false);
    assert.equal(fs.existsSync(path.join(root, 'runner-invoked')), false);
    assert.equal(loadSemanticState(outputRoot).freshness, 'unknown');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('relevant document without explicit runner marks projection stale', async () => {
  const root = tempDir();
  const outputRoot = path.join(root, 'runtime-output');
  try {
    prepareRepo(root);
    const result = await runSemanticEvent({ repositoryRoot: root, profile, scopeId, changedFiles: [approvedPath], outputRoot, sourceHead: 'b'.repeat(40) });
    assert.equal(result.status, 'stale-runner-unconfigured');
    assert.equal(result.runnerInvoked, false);
    assert.equal(loadSemanticState(outputRoot).freshness, 'stale');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('explicit fake runner processes only changed approved documents and publishes atomically', async () => {
  const root = tempDir();
  const outputRoot = path.join(root, 'runtime-output');
  try {
    prepareRepo(root);
    const runner = fakeRunner(root);
    const result = await runSemanticEvent({ repositoryRoot: root, profile, scopeId, changedFiles: [approvedPath, 'src/code.ts'], runnerPath: runner, outputRoot, sourceHead: 'c'.repeat(40) });
    assert.equal(result.status, 'regenerated');
    assert.equal(result.runnerInvoked, true);
    assert.equal(fs.existsSync(path.join(root, 'runner-invoked')), true);
    const published = JSON.parse(fs.readFileSync(result.publishedPath, 'utf8'));
    assert.deepEqual(published.documents, [approvedPath]);
    const state = loadSemanticState(outputRoot);
    assert.equal(state.freshness, 'fresh');
    assert.deepEqual(state.lastSuccessfulRun.documents.map((item) => item.path), [approvedPath]);
    assert.equal(fs.existsSync(path.join(outputRoot, 'staging', result.state.lastSuccessfulRun.runId)), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('unapproved documents are never staged or interpreted', async () => {
  const root = tempDir();
  const outputRoot = path.join(root, 'runtime-output');
  try {
    prepareRepo(root);
    const runner = fakeRunner(root);
    const classification = classifyChanges(['README.md', 'src/code.ts'], profile);
    assert.deepEqual(classification.relevant, []);
    const result = await runSemanticEvent({ repositoryRoot: root, profile, scopeId, changedFiles: ['README.md'], runnerPath: runner, outputRoot, sourceHead: 'd'.repeat(40) });
    assert.equal(result.runnerInvoked, false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('document byte/token caps fail closed before runner invocation', () => {
  const root = tempDir();
  try {
    prepareRepo(root, 'x'.repeat(128));
    const tiny = structuredClone(profile);
    tiny.caps.maxBytes = 16;
    assert.throws(() => collectDocuments(root, [approvedPath], tiny), /byte cap exceeded/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('runner failure leaves stale state, writes receipt, and cleans staging', async () => {
  const root = tempDir();
  const outputRoot = path.join(root, 'runtime-output');
  try {
    prepareRepo(root);
    const runner = fakeRunner(root, { fail: true });
    const result = await runSemanticEvent({ repositoryRoot: root, profile, scopeId, changedFiles: [approvedPath], runnerPath: runner, outputRoot, sourceHead: 'e'.repeat(40) });
    assert.equal(result.status, 'failed');
    assert.equal(result.state.freshness, 'stale');
    assert.equal(fs.existsSync(result.receiptPath), true);
    const staging = path.join(outputRoot, 'staging');
    assert.equal(fs.existsSync(staging) ? fs.readdirSync(staging).length : 0, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('receipt retention enforces max runs', () => {
  const root = tempDir();
  try {
    for (let i = 0; i < 10; i += 1) writeReceipt(root, { runId: `r${i}` });
    pruneReceipts(root, profile);
    assert.ok(fs.readdirSync(path.join(root, 'receipts')).length <= profile.retention.maxRuns);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('manual unapproved scope fails closed', async () => {
  const root = tempDir();
  try {
    prepareRepo(root);
    await assert.rejects(() => runSemanticEvent({ repositoryRoot: root, profile, scopeId: 'mind-vault', changedFiles: [approvedPath], outputRoot: path.join(root, 'out') }), /scope not approved/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Office scheduler uses semantic gate and legacy structural runner remains fail-closed', () => {
  const scheduler = fs.readFileSync(path.join(ROOT, 'tools/scripts/office-nightly-scheduler.sh'), 'utf8');
  const legacy = fs.readFileSync(path.join(ROOT, 'tools/scripts/graphify-nightly.sh'), 'utf8');
  assert.match(scheduler, /graphify-semantic-event\.mjs/);
  assert.doesNotMatch(scheduler, /GRAPHIFY_PHASES=%q/);
  assert.match(legacy, /GRAPHIFY_CONTAINED_EXECUTION/);
});

test('operational profile validator passes', () => {
  const output = execFileSync(process.execPath, ['tools/validate-graphify-operational-profile.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /event-driven-semantic-only/);
});
