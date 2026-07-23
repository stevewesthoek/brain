import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const TOOL = path.join(ROOT, 'tools/n8n-save-to-mind-topology-plan.mjs');
const ORDINARY_TOOL = path.join(ROOT, 'tools/n8n-save-to-mind-plan.mjs');
const ROLLBACK = path.join(ROOT, 'operations/reports/artifacts/b1-0a-live-workflow-rollback.json');
const CANDIDATE = path.join(ROOT, 'operations/automations/n8n/workflows/mind-inbox-fixed.json');
const MANIFEST = path.join(ROOT, 'operations/automations/n8n/save-to-mind-topology-migration.json');

function run(tool, args) {
  return spawnSync(process.execPath, [tool, ...args], { cwd: ROOT, encoding: 'utf8', env: {} });
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-to-mind-topology-'));
  const files = {
    rollback: path.join(dir, 'rollback.json'),
    candidate: path.join(dir, 'candidate.json'),
    manifest: path.join(dir, 'manifest.json'),
  };
  fs.copyFileSync(ROLLBACK, files.rollback);
  fs.copyFileSync(CANDIDATE, files.candidate);
  fs.copyFileSync(MANIFEST, files.manifest);
  return { dir, files };
}

function mutate(file, change) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function topology(files) {
  return run(TOOL, ['topology-plan', files.rollback, files.candidate, files.manifest]);
}

function expectFailure(result, pattern) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
}

async function withFixture(fn) {
  const item = fixture();
  try { await fn(item.files); } finally { fs.rmSync(item.dir, { recursive: true, force: true }); }
}

test('exact approved topology migration passes', async () => withFixture((files) => {
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  const actualManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  mutate(files.manifest, (m) => { m.rollbackSha256 = actualManifest.rollbackSha256; });
  fs.copyFileSync(ROLLBACK, files.rollback);
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  const result = topology(files);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /result=pass/);
  assert.match(result.stdout, /network_access=false/);
  assert.match(result.stdout, /credentials_read=false/);
}));

test('extra removed node fails', async () => withFixture((files) => {
  mutate(files.manifest, (m) => { m.nodes.find((n) => n.id === 'check-github-file').transition = 'removed'; m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /rollback node set differs|candidate node set differs/);
}));

test('extra added node fails', async () => withFixture((files) => {
  mutate(files.candidate, (w) => { w.nodes.push({ id: 'extra-node', name: 'Extra Node', type: 'n8n-nodes-base.noOp', parameters: {} }); });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /candidate node set differs|expected post-deployment node set differs from candidate/);
}));

test('unlisted type change fails', async () => withFixture((files) => {
  mutate(files.candidate, (w) => { w.nodes.find((n) => n.id === 'build-gemini-body').type = 'n8n-nodes-base.set'; });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /manifest identity mismatch/);
}));

test('unlisted connection change fails', async () => withFixture((files) => {
  mutate(files.candidate, (w) => { w.connections['Build Gemini Body'].main[0][0].node = 'Check Existing GitHub File'; });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /added connection set differs|expected post-deployment connection graph differs/);
}));

for (const [name, change, pattern] of [
  ['activation', (w) => { w.active = !w.active; }, /candidate activation must remain paused/],
  ['settings', (w) => { w.settings = { ...(w.settings ?? {}), executionOrder: 'v0' }; }, /settings changed/],
  ['tags', (w) => { w.tags = [{ id: 'unexpected' }]; }, /tags changed/],
  ['sharing', (w) => { w.shared = []; }, /shared changed/],
  ['credentials', (w) => { w.credentials = { unexpected: true }; }, /credentials changed/],
]) {
  test(`${name} change fails`, async () => withFixture((files) => {
    mutate(files.candidate, change);
    mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
    expectFailure(topology(files), pattern);
  }));
}

test('missing candidate state fails closed', async () => withFixture((files) => {
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; delete m.candidateState.deployed; });
  expectFailure(topology(files), /candidate state is incomplete or unsafe/);
}));

test('webhook identity change fails', async () => withFixture((files) => {
  mutate(files.candidate, (w) => { w.nodes.find((n) => n.id === 'webhook-trigger').name = 'Changed Webhook'; });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /manifest identity mismatch|webhook identity/);
}));

test('retired capture path fails', async () => withFixture((files) => {
  mutate(files.candidate, (w) => { const n = w.nodes.find((x) => x.id === 'build-processed-note'); n.parameters.jsCode += "\nconst retired='capture/inbox';"; });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /retired path capture\/inbox/);
}));

test('missing inbox failed routing fails', async () => withFixture((files) => {
  mutate(files.candidate, (workflow) => {
    const replaceRouting = (value) => {
      if (typeof value === 'string') {
        return value.replaceAll('inbox/failed', 'inbox/new').replaceAll('MIND_FAILED_PATH', 'MIND_INBOX_PATH');
      }
      if (Array.isArray(value)) return value.map(replaceRouting);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceRouting(item)]));
      }
      return value;
    };
    Object.assign(workflow, replaceRouting(workflow));
    const serialized = JSON.stringify(workflow);
    assert.equal(serialized.includes('inbox/failed'), false);
    assert.equal(serialized.includes('MIND_FAILED_PATH'), false);
  });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /candidate is missing inbox\/failed|candidate is missing MIND_FAILED_PATH/);
}));

test('wrong workflow id fails', async () => withFixture((files) => {
  mutate(files.rollback, (w) => { w.id = 'wrong-workflow'; });
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; });
  expectFailure(topology(files), /workflow id must be FwP5INe9qoo1OwGC/);
}));

test('wrong rollback artifact hash fails', async () => withFixture((files) => {
  mutate(files.manifest, (m) => { m.rollbackArtifact = files.rollback; m.rollbackSha256 = '0'.repeat(64); });
  expectFailure(topology(files), /rollback artifact SHA-256 does not match manifest/);
}));

test('ordinary deploy plan still rejects topology migration', () => {
  const result = run(ORDINARY_TOOL, ['deploy-plan', ROLLBACK, CANDIDATE]);
  expectFailure(result, /workflow removed node resolve-inbox-path/);
});
