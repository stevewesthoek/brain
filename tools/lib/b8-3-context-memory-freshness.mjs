import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function loadFreshnessContract(filePath) {
  const contract = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (contract.task !== 'B8.3' || contract.providerContract?.indexMode !== 'full') throw new Error('invalid B8.3 freshness contract');
  if (contract.repositoryInventory?.length !== 1 || contract.repositoryInventory[0]?.repositoryId !== 'brain') throw new Error('B8.3 inventory must contain Brain only');
  if (contract.providerContract.autoWatch !== false || contract.providerContract.autoIndex !== false) throw new Error('automatic freshness remains disabled');
  return contract;
}

export function isStructurallyEligible(relativePath, contract) {
  const normalized = relativePath.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (parts.some((part) => contract.structuralScope.excludedDirectoryNames.includes(part))) return false;
  if (contract.structuralScope.excludeSymlinks && normalized.includes('->')) return false;
  const base = path.posix.basename(normalized);
  if (contract.structuralScope.excludedFilePatterns.some((pattern) => {
    if (pattern === '*.d.ts') return base.endsWith('.d.ts');
    if (pattern === '*.generated.*') return base.includes('.generated.');
    if (pattern === '*.gen.*') return base.includes('.gen.');
    return false;
  })) return false;
  return contract.structuralScope.eligibleExtensions.includes(path.posix.extname(normalized));
}

function walkFiles(root, current = root, output = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).replaceAll('\\', '/');
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      output.push({ relative, directory: true });
      walkFiles(root, absolute, output);
    } else if (entry.isFile()) output.push({ relative, directory: false });
  }
  return output;
}

export function buildStructuralInventory(repositoryPath, contract) {
  const excludedDirs = new Set(contract.structuralScope.excludedDirectoryNames);
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(repositoryPath, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name)) continue;
        visit(absolute);
      } else if (entry.isFile() && isStructurallyEligible(relative, contract)) files.push(relative);
    }
  }
  visit(repositoryPath);
  files.sort();
  return files;
}

export function structuralFingerprint(repositoryPath, contract) {
  const files = buildStructuralInventory(repositoryPath, contract);
  const hash = crypto.createHash('sha256');
  for (const relative of files) {
    hash.update(relative).update('\0');
    hash.update(fs.readFileSync(path.join(repositoryPath, relative))).update('\0');
  }
  return { fingerprint: hash.digest('hex'), eligibleFileCount: files.length, files };
}

export function repositoryHead(repositoryPath) {
  try {
    return execFileSync('git', ['-C', repositoryPath, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function buildSourceIdentity(repositoryPath, contract) {
  const inventory = structuralFingerprint(repositoryPath, contract);
  return {
    headCommit: repositoryHead(repositoryPath),
    structuralFingerprint: inventory.fingerprint,
    eligibleFileCount: inventory.eligibleFileCount,
  };
}

export function statePath(cacheDir, contract) {
  return path.join(cacheDir, contract.metadataPolicy.stateFileName);
}

export function receiptDirectory(cacheDir, contract) {
  return path.join(cacheDir, contract.metadataPolicy.failureReceiptDirectoryName);
}

export function loadFreshnessState(cacheDir, contract) {
  const file = statePath(cacheDir, contract);
  if (!fs.existsSync(file)) return { stale: true, lastSuccessfulRefreshAt: null, lastSuccessfulSourceIdentity: null, lastSuccessfulIndexIdentity: null, lastFailure: null };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeFreshnessState(cacheDir, contract, state) {
  fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(statePath(cacheDir, contract), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export function writeFailureReceipt(cacheDir, contract, failure) {
  const dir = receiptDirectory(cacheDir, contract);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const file = path.join(dir, `${stamp}-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(failure, null, 2)}\n`, { mode: 0o600 });
  return file;
}

export function evaluateFreshnessState(repositoryPath, cacheDir, contract, providerSha = null) {
  const state = loadFreshnessState(cacheDir, contract);
  const currentSourceIdentity = buildSourceIdentity(repositoryPath, contract);
  const fingerprintMatches = state.lastSuccessfulSourceIdentity?.structuralFingerprint === currentSourceIdentity.structuralFingerprint;
  const providerMatches = providerSha === null || state.lastSuccessfulIndexIdentity?.providerSha256 === providerSha;
  return {
    ...state,
    currentSourceIdentity,
    stale: state.stale !== false || !fingerprintMatches || !providerMatches,
    staleReasons: [
      ...(state.stale !== false ? ['recorded-stale'] : []),
      ...(!fingerprintMatches ? ['structural-fingerprint-changed'] : []),
      ...(!providerMatches ? ['provider-identity-changed'] : []),
    ],
  };
}

export function exactSourceFallbackRequired(state, providerAvailable = true) {
  return !providerAvailable || state?.stale !== false;
}

export async function providerSha256(providerPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(providerPath)).digest('hex');
}

export async function measureIndexBytes(cacheDir) {
  let total = 0;
  if (!fs.existsSync(cacheDir)) return total;
  for (const item of walkFiles(cacheDir)) {
    if (!item.directory) total += fs.statSync(path.join(cacheDir, item.relative)).size;
  }
  return total;
}

export async function runExplicitRefresh({ providerPath, repositoryPath, projectName, cacheDir, contract, timeoutMs = 120000 }) {
  const startedAt = new Date().toISOString();
  const sourceIdentity = buildSourceIdentity(repositoryPath, contract);
  const previous = loadFreshnessState(cacheDir, contract);
  if (contract.freshnessPolicy.skipRefreshWhenStructuralFingerprintUnchanged && previous.lastSuccessfulSourceIdentity?.structuralFingerprint === sourceIdentity.structuralFingerprint) {
    return { refreshed: false, skippedUnchanged: true, state: previous, durationMs: 0 };
  }
  const start = performance.now();
  try {
    const env = { ...process.env, CBM_CACHE_DIR: cacheDir };
    const { stdout, stderr } = await execFileAsync(providerPath, ['cli', 'index_repository', '--repo-path', repositoryPath, '--mode', 'full', '--name', projectName, '--persistence', 'false'], { env, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    const durationMs = Math.round(performance.now() - start);
    const indexBytes = await measureIndexBytes(cacheDir);
    const indexIdentity = { providerSha256: await providerSha256(providerPath), projectName, cacheDir, indexMode: 'full', indexBytes };
    const state = { lastSuccessfulRefreshAt: new Date().toISOString(), lastSuccessfulSourceIdentity: sourceIdentity, lastSuccessfulIndexIdentity: indexIdentity, stale: false, lastFailure: null };
    writeFreshnessState(cacheDir, contract, state);
    return { refreshed: true, skippedUnchanged: false, durationMs, stdout, stderr, state, startedAt };
  } catch (error) {
    const failure = { occurredAt: new Date().toISOString(), startedAt, repositoryPath, projectName, sourceIdentity, error: error.message, fallbackAuthority: contract.providerContract.fallbackAuthority };
    const receiptPath = writeFailureReceipt(cacheDir, contract, failure);
    const state = { ...previous, stale: true, lastFailure: { ...failure, receiptPath } };
    writeFreshnessState(cacheDir, contract, state);
    return { refreshed: false, skippedUnchanged: false, failed: true, durationMs: Math.round(performance.now() - start), error: error.message, receiptPath, state };
  }
}

export async function queryStructuralMarker({ providerPath, cacheDir, projectName, marker, targetPath, timeoutMs = 30000 }) {
  try {
    const payload = JSON.stringify({ project: projectName, query: marker, max_results: 20 });
    const { stdout } = await execFileAsync(providerPath, ['cli', 'search_code', payload], { env: { ...process.env, CBM_CACHE_DIR: cacheDir }, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(stdout);
    const results = Array.isArray(parsed) ? parsed : parsed?.results;
    if (!Array.isArray(results)) return false;
    return results.some((result) => String(result?.path ?? result?.file ?? '').replaceAll('\\', '/').endsWith(targetPath.replaceAll('\\', '/')) && JSON.stringify(result).includes(marker));
  } catch {
    return false;
  }
}

export function createDisposableRepositoryCopy(repositoryPath, prefix = 'b8-3-brain-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const destination = path.join(root, 'source');
  fs.cpSync(repositoryPath, destination, {
    recursive: true,
    dereference: false,
    filter: (source) => {
      const relative = path.relative(repositoryPath, source).replaceAll('\\', '/');
      if (!relative) return true;
      const parts = relative.split('/');
      return !parts.some((part) => ['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', 'runtime'].includes(part));
    },
  });
  return { root, repositoryPath: destination };
}
