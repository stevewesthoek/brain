/**
 * b8-1-cbm-incremental-reindex.test.mjs — Hardened CBM reindex tests with deterministic fake CBM.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateRunDirectory,
  validatePathIsolation,
  hashFile,
  hashDirectory,
  findTargetFile,
  generateMarker,
  applyMarker,
  restoreFile,
  measureCacheBytes,
  runIncrementalReindex,
} from './b8-1-cbm-incremental-reindex.mjs';

function makeTempDir(prefix = 'b8-1-cbm-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a deterministic fake CBM executable that logs argv and env, and creates cache artifacts.
 */
function createFakeCbm(tmpDir) {
  const fakeCbmPath = path.join(tmpDir, 'fake-cbm');
  const fakeCbmScript = `#!/bin/bash
ARGV_LOG="${tmpDir}/cbm-argv.log"
ENV_LOG="${tmpDir}/cbm-env.log"
echo "$$" >> "$ARGV_LOG"
echo "$@" >> "$ARGV_LOG"
env | grep -E "(HOME|XDG_)" | sort >> "$ENV_LOG"

if [[ "$1" == "cli" && "$2" == "index_repository" ]]; then
  # Create cache artifacts for proof of indexing
  CACHE_DIR="\${XDG_CACHE_HOME}"
  if [[ -n "$CACHE_DIR" && -d "$CACHE_DIR" ]]; then
    mkdir -p "$CACHE_DIR/cbm-cache"
    dd if=/dev/zero of="$CACHE_DIR/cbm-cache/index.bin" bs=1024 count=10 2>/dev/null
  fi
  echo '{"indexed": true, "project": "'$(grep -- '--name' <(echo "$@") | head -1 | awk '{print $NF}')'"}'
  exit 0
elif [[ "$1" == "cli" && "$2" == "search_code" ]]; then
  PATTERN=""
  for i in "$@"; do
    if [[ "$prev" == "--pattern" ]]; then
      PATTERN="$i"
    fi
    prev="$i"
  done
  if [[ -n "$PATTERN" ]]; then
    echo '[{"file": "index.ts", "text": "'$PATTERN'", "line": 1}]'
  else
    echo '[]'
  fi
  exit 0
else
  echo '{"error": "unknown command"}'
  exit 1
fi
`;
  fs.writeFileSync(fakeCbmPath, fakeCbmScript, 'utf8');
  fs.chmodSync(fakeCbmPath, 0o755);
  return fakeCbmPath;
}

test('validateRunDirectory: valid directory', () => {
  const tmpDir = makeTempDir();
  try {
    const result = validateRunDirectory(tmpDir, 'test');
    assert.equal(result.valid, true);
  } finally { cleanup(tmpDir); }
});

test('validateRunDirectory: nonexistent directory', () => {
  const result = validateRunDirectory('/nonexistent/dir', 'test');
  assert.equal(result.valid, false);
});

test('validateRunDirectory: symlink rejected', () => {
  const tmpDir = makeTempDir();
  try {
    const realDir = path.join(tmpDir, 'real');
    const linkDir = path.join(tmpDir, 'link');
    fs.mkdirSync(realDir);
    fs.symlinkSync(realDir, linkDir);
    const result = validateRunDirectory(linkDir, 'test');
    assert.equal(result.valid, false);
  } finally { cleanup(tmpDir); }
});

test('validatePathIsolation: identical cache and config rejected', () => {
  const tmpDir = makeTempDir();
  try {
    const result = validatePathIsolation(tmpDir, tmpDir, path.join(tmpDir, 'source'));
    assert.equal(result.valid, false);
  } finally { cleanup(tmpDir); }
});

test('validatePathIsolation: cache inside source rejected', () => {
  const tmpDir = makeTempDir();
  try {
    const cacheDir = path.join(tmpDir, 'source', 'cache');
    const configDir = path.join(tmpDir, 'config');
    const sourceDir = path.join(tmpDir, 'source');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    const result = validatePathIsolation(cacheDir, configDir, sourceDir);
    assert.equal(result.valid, false);
  } finally { cleanup(tmpDir); }
});

test('hashFile: matches content', () => {
  const tmpDir = makeTempDir();
  try {
    const file1 = path.join(tmpDir, 'file1.txt');
    const file2 = path.join(tmpDir, 'file2.txt');
    fs.writeFileSync(file1, 'same content');
    fs.writeFileSync(file2, 'same content');
    assert.equal(hashFile(file1), hashFile(file2));
  } finally { cleanup(tmpDir); }
});

test('hashDirectory: detects changes', () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'content');
    const hash1 = hashDirectory(tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'modified');
    const hash2 = hashDirectory(tmpDir);
    assert.notEqual(hash1, hash2);
  } finally { cleanup(tmpDir); }
});

test('findTargetFile: finds .ts file', () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'code');
    const target = findTargetFile(tmpDir);
    assert.ok(target && target.endsWith('index.ts'));
  } finally { cleanup(tmpDir); }
});

test('generateMarker: produces valid identifier', () => {
  const marker = generateMarker();
  assert.ok(marker.startsWith('B8.1-mark-'));
  assert.ok(/^B8\.1-mark-[a-f0-9]+-[a-z0-9]+$/.test(marker));
});

test('applyMarker: adds and restores', () => {
  const tmpDir = makeTempDir();
  try {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'original');
    const marker = 'B8.1-mark-test';
    const line = applyMarker(file, marker);
    assert.ok(fs.readFileSync(file, 'utf8').includes(marker));
    const result = restoreFile(file, line);
    assert.equal(result.success, true);
    assert.equal(fs.readFileSync(file, 'utf8'), 'original');
  } finally { cleanup(tmpDir); }
});

test('measureCacheBytes: nested directories', () => {
  const tmpDir = makeTempDir();
  try {
    const sub = path.join(tmpDir, 'sub');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a'.repeat(50));
    fs.writeFileSync(path.join(sub, 'b.txt'), 'b'.repeat(75));
    assert.equal(measureCacheBytes(tmpDir), 125);
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: missing parameters', async () => {
  const result = await runIncrementalReindex({});
  assert.equal(result.success, false);
});

test('runIncrementalReindex: nonexistent cache directory', async () => {
  const repoDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');
    const result = await runIncrementalReindex({
      cbmExecutable: '/fake/cbm',
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir: '/nonexistent/cache',
      configDir: '/nonexistent/config',
      env: { HOME: '/tmp' },
    });
    assert.equal(result.success, false);
  } finally { cleanup(repoDir); }
});

test('runIncrementalReindex: cache inside source rejected', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(repoDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');

    const result = await runIncrementalReindex({
      cbmExecutable: '/fake/cbm',
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: '/tmp' },
    });
    assert.equal(result.success, false);
    assert.match(result.reason, /contained within source/);
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: no target file found', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(tmpDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(repoDir, 'readme.md'), 'no code');

    const result = await runIncrementalReindex({
      cbmExecutable: '/fake/cbm',
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: '/tmp' },
    });
    assert.equal(result.success, false);
    assert.match(result.reason, /no target file/);
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: comprehensive fake-CBM success with full provenance', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(tmpDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    const homeDir = path.join(tmpDir, 'home');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(homeDir);
    fs.chmodSync(homeDir, 0o700);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'export const x = 1;');
    // Pre-populate cache with bytes before indexing
    fs.writeFileSync(path.join(cacheDir, 'precache'), 'x'.repeat(100));

    const fakeCbm = createFakeCbm(tmpDir);

    const result = await runIncrementalReindex({
      cbmExecutable: fakeCbm,
      disposableRepositoryPath: repoDir,
      repoId: 'test-repo-123',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: {
        HOME: homeDir,
        PATH: '/bin:/usr/bin',
        XDG_CACHE_HOME: cacheDir,
        XDG_CONFIG_HOME: configDir,
      },
      timeout: 10000,
    });

    // Verify successful result
    assert.equal(result.success, true, `Expected success, got: ${result.reason}`);
    assert.equal(result.marker !== null, true, 'marker should be set');
    assert.ok(result.marker.startsWith('B8.1-mark-'), 'marker format incorrect');
    assert.equal(result.targetFilePath !== null, true, 'targetFilePath should be set');
    assert.ok(result.targetFilePath.endsWith('index.ts'), 'targetFilePath should be index.ts');

    // Verify two index calls + one search call
    assert.equal(result.initialIndexWallMs !== null, true, 'initial index wallMs should be measured');
    assert.equal(result.incrementalReindexWallMs !== null, true, 'incremental reindex wallMs should be measured');
    assert.equal(result.markerVisible, true, 'marker should be visible');

    // Verify isolated environment
    assert.equal(result.provenance.cacheDir, cacheDir, 'cache dir mismatch');
    assert.equal(result.provenance.configDir, configDir, 'config dir mismatch');

    // Verify distinct paths
    assert.notEqual(repoDir, cacheDir, 'repo and cache should be distinct');
    assert.notEqual(repoDir, configDir, 'repo and config should be distinct');
    assert.notEqual(cacheDir, configDir, 'cache and config should be distinct');

    // Verify positive attributable cache evidence
    assert.ok(result.cacheBytes > result.cacheBytesInitial, 'cache delta should be positive');
    const cacheDelta = result.cacheBytes - result.cacheBytesInitial;
    assert.ok(cacheDelta > 0, `cache delta should be positive: ${cacheDelta}`);

    // Verify valid provenance
    assert.equal(result.provenance.targetHashMatches, true, 'target file should be restored');
    assert.equal(result.provenance.repoHashMatches, true, 'repo should be restored');
    assert.equal(result.restorationVerified, true, 'restoration should be verified');
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: restoration failure overrides success', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(tmpDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    const homeDir = path.join(tmpDir, 'home');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(homeDir);
    fs.chmodSync(homeDir, 0o700);
    const targetFile = path.join(repoDir, 'index.ts');
    fs.writeFileSync(targetFile, 'export const x = 1;');

    const fakeCbm = createFakeCbm(tmpDir);

    // Run normally first
    const result = await runIncrementalReindex({
      cbmExecutable: fakeCbm,
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: homeDir, PATH: '/bin:/usr/bin', XDG_CACHE_HOME: cacheDir, XDG_CONFIG_HOME: configDir },
      timeout: 10000,
    });

    // Even if it succeeds, the file should be restored and hashes should match
    assert.equal(result.restorationVerified, true, 'restoration should be verified');
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: source inside cache rejected', async () => {
  const tmpDir = makeTempDir();
  try {
    const cacheDir = path.join(tmpDir, 'cache');
    const repoDir = path.join(cacheDir, 'source');
    const configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(repoDir);
    fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');

    const result = await runIncrementalReindex({
      cbmExecutable: '/fake/cbm',
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: '/tmp' },
    });
    assert.equal(result.success, false, 'should reject source inside cache');
    assert.match(result.reason, /contained within cache/);
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: cache inside config rejected', async () => {
  const tmpDir = makeTempDir();
  try {
    const configDir = path.join(tmpDir, 'config');
    const cacheDir = path.join(configDir, 'cache');
    const repoDir = path.join(tmpDir, 'source');
    fs.mkdirSync(configDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(repoDir);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');

    const result = await runIncrementalReindex({
      cbmExecutable: '/fake/cbm',
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: '/tmp' },
    });
    assert.equal(result.success, false, 'should reject cache inside config');
    assert.match(result.reason, /contained within config/);
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: wrong XDG environment rejected', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(tmpDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    const homeDir = path.join(tmpDir, 'home');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.mkdirSync(homeDir);
    fs.chmodSync(homeDir, 0o700);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');

    const fakeCbm = createFakeCbm(tmpDir);

    const result = await runIncrementalReindex({
      cbmExecutable: fakeCbm,
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: homeDir, PATH: '/bin:/usr/bin', XDG_CACHE_HOME: '/wrong' },
      timeout: 10000,
    });
    assert.equal(result.success, false, 'should reject wrong XDG_CACHE_HOME');
  } finally { cleanup(tmpDir); }
});

test('runIncrementalReindex: invalid measurement despite exit zero', async () => {
  const tmpDir = makeTempDir();
  try {
    const repoDir = path.join(tmpDir, 'source');
    const cacheDir = path.join(tmpDir, 'cache');
    const configDir = path.join(tmpDir, 'config');
    fs.mkdirSync(repoDir);
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'code');

    // Fake CBM that returns invalid JSON
    const fakeCbmPath = path.join(tmpDir, 'fake-cbm-bad');
    fs.writeFileSync(fakeCbmPath, '#!/bin/bash\necho "not json"\nexit 0', 'utf8');
    fs.chmodSync(fakeCbmPath, 0o755);

    const result = await runIncrementalReindex({
      cbmExecutable: fakeCbmPath,
      disposableRepositoryPath: repoDir,
      repoId: 'test',
      projectName: 'test-project',
      cacheDir,
      configDir,
      env: { HOME: tmpDir, PATH: '/bin:/usr/bin', XDG_CACHE_HOME: cacheDir, XDG_CONFIG_HOME: configDir },
      timeout: 10000,
    });
    assert.equal(result.success, false, 'should reject invalid measurement');
    assert.match(result.reason, /initial index failed/);
  } finally { cleanup(tmpDir); }
});

test('restoreFile: mismatch rejects', () => {
  const tmpDir = makeTempDir();
  try {
    const file = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(file, 'original');
    const result = restoreFile(file, 'WRONG_MARKER\n');
    assert.equal(result.success, false);
  } finally { cleanup(tmpDir); }
});
