import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildSourceIdentity,
  buildStructuralInventory,
  createDisposableRepositoryCopy,
  exactSourceFallbackRequired,
  evaluateFreshnessState,
  isStructurallyEligible,
  loadFreshnessContract,
  loadFreshnessState,
  queryStructuralMarker,
  runExplicitRefresh,
  statePath,
} from './b8-3-context-memory-freshness.mjs';

const ROOT = path.resolve('.');
const CONTRACT_PATH = path.join(ROOT, 'operations/specs/b8-3-context-memory-freshness.json');
const contract = loadFreshnessContract(CONTRACT_PATH);

function tempDir(prefix = 'b8-3-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createFakeProvider(dir, { failIndex = false } = {}) {
  const file = path.join(dir, 'fake-cbm.mjs');
  fs.writeFileSync(file, `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
const cache=process.env.CBM_CACHE_DIR;
fs.mkdirSync(cache,{recursive:true});
if(args[0]==='cli'&&args[1]==='index_repository'){
  if(${JSON.stringify(failIndex)}){console.error('forced index failure');process.exit(3)}
  const repo=args[args.indexOf('--repo-path')+1];
  const name=args[args.indexOf('--name')+1];
  const mode=args[args.indexOf('--mode')+1];
  const files=[];
  function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const a=path.join(d,e.name);if(e.isDirectory())walk(a);else if(e.isFile())files.push({path:path.relative(repo,a).replaceAll('\\\\','/'),text:fs.readFileSync(a,'utf8')})}}
  walk(repo);
  fs.writeFileSync(path.join(cache,'index.json'),JSON.stringify({name,mode,files}));
  console.log(JSON.stringify({project:name,mode,files:files.length}));
  process.exit(0);
}
if(args[0]==='cli'&&args[1]==='search_code'){
  const q=JSON.parse(args[2]);
  const data=JSON.parse(fs.readFileSync(path.join(cache,'index.json'),'utf8'));
  console.log(JSON.stringify(data.files.filter(f=>f.text.includes(q.query)).map(f=>({path:f.path,text:f.text}))));
  process.exit(0);
}
process.exit(2);
`);
  fs.chmodSync(file, 0o755);
  return file;
}

test('Brain source identity captures linked-worktree HEAD', () => {
  const identity = buildSourceIdentity(ROOT, contract);
  assert.match(identity.headCommit, /^[0-9a-f]{40}$/);
  assert.ok(identity.eligibleFileCount > 0);
});

test('contract is Brain-only, full mode, and watcher-free', () => {
  assert.equal(contract.repositoryInventory.length, 1);
  assert.equal(contract.repositoryInventory[0].repositoryId, 'brain');
  assert.equal(contract.providerContract.indexMode, 'full');
  assert.equal(contract.providerContract.autoWatch, false);
  assert.equal(contract.providerContract.autoIndex, false);
  assert.deepEqual(contract.notApprovedRepositories, ['mind', 'workbench', 'prochat']);
});

test('structural scope excludes generated/vendor/runtime and declaration files', () => {
  assert.equal(isStructurallyEligible('projects/core/src/index.ts', contract), true);
  assert.equal(isStructurallyEligible('node_modules/pkg/index.ts', contract), false);
  assert.equal(isStructurallyEligible('runtime/tmp/index.ts', contract), false);
  assert.equal(isStructurallyEligible('src/types.d.ts', contract), false);
  assert.equal(isStructurallyEligible('src/foo.generated.ts', contract), false);
});

test('inventory ignores excluded directories and fingerprints eligible source', () => {
  const dir = tempDir();
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'export const a=1;');
    fs.writeFileSync(path.join(dir, 'src', 'ignored.d.ts'), 'declare const x:number;');
    fs.writeFileSync(path.join(dir, 'node_modules', 'b.ts'), 'export const b=2;');
    assert.deepEqual(buildStructuralInventory(dir, contract), ['src/a.ts']);
    const first = buildSourceIdentity(dir, contract);
    fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'export const a=2;');
    const second = buildSourceIdentity(dir, contract);
    assert.notEqual(first.structuralFingerprint, second.structuralFingerprint);
    assert.equal(second.eligibleFileCount, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('explicit refresh persists fresh state and skips unchanged fingerprint', async () => {
  const dir = tempDir();
  try {
    const repo = path.join(dir, 'repo');
    const cache = path.join(dir, 'cache');
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, 'a.ts'), 'export const marker="alpha";');
    const provider = createFakeProvider(dir);
    const first = await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    assert.equal(first.refreshed, true);
    assert.equal(first.state.stale, false);
    assert.equal(first.state.lastSuccessfulIndexIdentity.indexMode, 'full');
    assert.equal(fs.existsSync(statePath(cache, contract)), true);
    const second = await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    assert.equal(second.skippedUnchanged, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('freshness evaluation detects source and provider drift', async () => {
  const dir = tempDir();
  try {
    const repo = path.join(dir, 'repo');
    const cache = path.join(dir, 'cache');
    fs.mkdirSync(repo);
    const target = path.join(repo, 'a.ts');
    fs.writeFileSync(target, 'export const a=1;');
    const provider = createFakeProvider(dir);
    const refreshed = await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    const providerSha = refreshed.state.lastSuccessfulIndexIdentity.providerSha256;
    assert.equal(evaluateFreshnessState(repo, cache, contract, providerSha).stale, false);
    fs.writeFileSync(target, 'export const a=2;');
    const sourceDrift = evaluateFreshnessState(repo, cache, contract, providerSha);
    assert.equal(sourceDrift.stale, true);
    assert.ok(sourceDrift.staleReasons.includes('structural-fingerprint-changed'));
    fs.writeFileSync(target, 'export const a=1;');
    const providerDrift = evaluateFreshnessState(repo, cache, contract, '0'.repeat(64));
    assert.equal(providerDrift.stale, true);
    assert.ok(providerDrift.staleReasons.includes('provider-identity-changed'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('file change becomes queryable after explicit refresh', async () => {
  const dir = tempDir();
  try {
    const repo = path.join(dir, 'repo');
    const cache = path.join(dir, 'cache');
    fs.mkdirSync(repo);
    const target = path.join(repo, 'a.ts');
    fs.writeFileSync(target, 'export const value=1;');
    const provider = createFakeProvider(dir);
    await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    const marker = 'B8_3_QUERYABLE_MARKER_123';
    fs.appendFileSync(target, `\nexport const ${marker}=true;\n`);
    const refreshed = await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    assert.equal(refreshed.refreshed, true);
    assert.equal(await queryStructuralMarker({ providerPath: provider, cacheDir: cache, projectName: 'brain-test', marker, targetPath: 'a.ts' }), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('provider failure marks stale, writes receipt, and requires exact-source fallback', async () => {
  const dir = tempDir();
  try {
    const repo = path.join(dir, 'repo');
    const cache = path.join(dir, 'cache');
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, 'a.ts'), 'export const a=1;');
    const provider = createFakeProvider(dir, { failIndex: true });
    const result = await runExplicitRefresh({ providerPath: provider, repositoryPath: repo, projectName: 'brain-test', cacheDir: cache, contract });
    assert.equal(result.failed, true);
    assert.equal(result.state.stale, true);
    assert.equal(fs.existsSync(result.receiptPath), true);
    assert.equal(exactSourceFallbackRequired(loadFreshnessState(cache, contract), true), true);
    assert.equal(exactSourceFallbackRequired({ stale: false }, false), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('disposable repository copy excludes runtime/build/vendor state', () => {
  const dir = tempDir();
  try {
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'a.ts'), 'export const a=1;');
    fs.writeFileSync(path.join(repo, 'node_modules', 'x.ts'), 'x');
    fs.writeFileSync(path.join(repo, 'runtime', 'x.ts'), 'x');
    const copy = createDisposableRepositoryCopy(repo);
    try {
      assert.equal(fs.existsSync(path.join(copy.repositoryPath, 'src', 'a.ts')), true);
      assert.equal(fs.existsSync(path.join(copy.repositoryPath, 'node_modules')), false);
      assert.equal(fs.existsSync(path.join(copy.repositoryPath, 'runtime')), false);
    } finally { fs.rmSync(copy.root, { recursive: true, force: true }); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
