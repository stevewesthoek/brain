import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const nowId = () => `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomBytes(4).toString('hex')}`;

export function loadGraphifyProfile(filePath) {
  const profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (profile.profileId !== 'graphify-bounded-semantic') throw new Error('B8.5 bounded semantic profile required');
  if (profile.generatedOutputAuthority !== 'non-authoritative') throw new Error('Graphify must remain non-authoritative');
  if (profile.execution?.automaticFullScan !== false || profile.execution?.structuralGraphGeneration !== 'frozen') throw new Error('structural Graphify must remain frozen');
  if (profile.corpus?.mindApproved !== false || profile.corpus?.repositories?.some((repo) => repo !== 'brain')) throw new Error('B8.5 profile must remain Brain-only');
  return profile;
}

export function scopeById(profile, scopeId) {
  return profile.corpus.semanticScopes.find((scope) => scope.scopeId === scopeId) ?? null;
}

export function approvedSemanticPaths(profile) {
  return new Set(profile.corpus.semanticScopes.flatMap((scope) => scope.paths));
}

export function isExcludedPath(relativePath, profile) {
  const normalized = relativePath.replaceAll('\\', '/');
  const lower = normalized.toLowerCase();
  const parts = normalized.split('/');
  if (parts.some((part) => ['runtime', 'vendor', 'node_modules', '.git', 'graphify-out', '.graphify-out'].includes(part))) return true;
  if (lower.includes('.env') || lower.includes('credential') || lower.includes('secret') || lower.includes('backup') || lower.includes('generated')) return true;
  return false;
}

export function classifyChanges(changedFiles, profile) {
  const approved = approvedSemanticPaths(profile);
  const normalized = [...new Set(changedFiles.map((file) => file.replaceAll('\\', '/')))];
  const relevant = normalized.filter((file) => approved.has(file) && !isExcludedPath(file, profile));
  const rejectedApproved = normalized.filter((file) => approved.has(file) && isExcludedPath(file, profile));
  const other = normalized.filter((file) => !approved.has(file));
  return { relevant, rejectedApproved, other, codeOnlyOrUnapproved: relevant.length === 0 && normalized.length > 0 };
}

export function estimateTokens(bytes) {
  return Math.ceil(bytes / 4);
}

export function collectDocuments(repositoryRoot, relativePaths, profile) {
  const documents = [];
  let totalBytes = 0;
  for (const relativePath of relativePaths) {
    if (isExcludedPath(relativePath, profile)) throw new Error(`excluded semantic path: ${relativePath}`);
    const absolute = path.resolve(repositoryRoot, relativePath);
    if (!absolute.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`semantic document missing: ${relativePath}`);
    const content = fs.readFileSync(absolute);
    totalBytes += content.length;
    documents.push({ path: relativePath, bytes: content.length, sha256: sha256Buffer(content) });
  }
  const estimatedTokens = estimateTokens(totalBytes);
  if (documents.length > profile.caps.maxDocuments) throw new Error('semantic document cap exceeded');
  if (totalBytes > profile.caps.maxBytes) throw new Error('semantic byte cap exceeded');
  if (estimatedTokens > profile.caps.maxEstimatedTokens) throw new Error('semantic token cap exceeded');
  return { documents, totalBytes, estimatedTokens };
}

export function loadSemanticState(outputRoot) {
  const file = path.join(outputRoot, 'semantic-state.json');
  if (!fs.existsSync(file)) return { freshness: 'unknown', lastEvaluatedHead: null, lastSuccessfulRun: null, lastFailure: null };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeSemanticState(outputRoot, state) {
  fs.mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(outputRoot, 'semantic-state.json'), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export function writeReceipt(outputRoot, receipt) {
  const dir = path.join(outputRoot, 'receipts');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${receipt.runId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return file;
}

export function pruneReceipts(outputRoot, profile, now = Date.now()) {
  const dir = path.join(outputRoot, 'receipts');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => {
    const file = path.join(dir, name);
    return { file, mtimeMs: fs.statSync(file).mtimeMs };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);
  const ageLimit = profile.retention.maxAgeDays * 86400000;
  const removed = [];
  files.forEach((item, index) => {
    if (index >= profile.retention.maxRuns || now - item.mtimeMs > ageLimit) {
      fs.rmSync(item.file, { force: true });
      removed.push(item.file);
    }
  });
  return removed;
}

function stageDocuments(repositoryRoot, outputRoot, runId, collection) {
  const stageRoot = path.join(outputRoot, 'staging', runId);
  fs.mkdirSync(stageRoot, { recursive: true, mode: 0o700 });
  for (const document of collection.documents) {
    const destination = path.join(stageRoot, 'documents', document.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(repositoryRoot, document.path), destination);
  }
  const manifestPath = path.join(stageRoot, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({ runId, ...collection }, null, 2)}\n`, { mode: 0o600 });
  return { stageRoot, manifestPath };
}

async function invokeRunner(runnerPath, manifestPath, outputPath, timeoutMs) {
  if (!runnerPath) return { invoked: false, reason: 'runner-unconfigured' };
  if (!fs.existsSync(runnerPath)) throw new Error('semantic runner missing');
  const args = runnerPath.endsWith('.mjs') || runnerPath.endsWith('.js') ? [runnerPath, `--manifest=${manifestPath}`, `--output=${outputPath}`] : [`--manifest=${manifestPath}`, `--output=${outputPath}`];
  const executable = runnerPath.endsWith('.mjs') || runnerPath.endsWith('.js') ? process.execPath : runnerPath;
  const result = await execFileAsync(executable, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? '/tmp' } });
  return { invoked: true, stdout: result.stdout, stderr: result.stderr };
}

export async function runSemanticEvent({ repositoryRoot, profile, scopeId, changedFiles, runnerPath = null, outputRoot = null, sourceHead = null, disabled = false }) {
  const runId = nowId();
  const resolvedOutputRoot = outputRoot ?? path.join(repositoryRoot, profile.operationalOutputRoot);
  const state = loadSemanticState(resolvedOutputRoot);
  const classification = classifyChanges(changedFiles, profile);
  const receiptBase = { runId, task: 'B8.5', scopeId, sourceHead, changedFiles, classification, generatedOutputAuthority: profile.generatedOutputAuthority, startedAt: new Date().toISOString() };

  if (disabled) {
    const nextState = classification.relevant.length > 0
      ? { ...state, freshness: 'stale', lastEvaluatedHead: sourceHead ?? state.lastEvaluatedHead, pendingDocuments: classification.relevant, lastFailure: null }
      : { ...state, lastEvaluatedHead: sourceHead ?? state.lastEvaluatedHead };
    writeSemanticState(resolvedOutputRoot, nextState);
    const receipt = { ...receiptBase, status: 'disabled', runnerInvoked: false, freshnessAfter: nextState.freshness, completedAt: new Date().toISOString() };
    const receiptPath = writeReceipt(resolvedOutputRoot, receipt);
    pruneReceipts(resolvedOutputRoot, profile);
    return { status: 'disabled', runnerInvoked: false, receiptPath, state: nextState };
  }

  if (classification.relevant.length === 0) {
    const nextState = { ...state, lastEvaluatedHead: sourceHead ?? state.lastEvaluatedHead };
    writeSemanticState(resolvedOutputRoot, nextState);
    const receipt = { ...receiptBase, status: 'no-relevant-semantic-change', runnerInvoked: false, freshnessAfter: nextState.freshness, completedAt: new Date().toISOString() };
    const receiptPath = writeReceipt(resolvedOutputRoot, receipt);
    pruneReceipts(resolvedOutputRoot, profile);
    return { status: receipt.status, runnerInvoked: false, receiptPath, state: nextState };
  }

  const scope = scopeById(profile, scopeId);
  if (!scope) throw new Error(`semantic scope not approved: ${scopeId}`);
  const outsideScope = classification.relevant.filter((file) => !scope.paths.includes(file));
  if (outsideScope.length) throw new Error(`changed semantic document outside requested scope: ${outsideScope.join(', ')}`);

  const collection = collectDocuments(repositoryRoot, classification.relevant, profile);
  const staleState = { ...state, freshness: 'stale', lastEvaluatedHead: sourceHead ?? state.lastEvaluatedHead, pendingDocuments: collection.documents, lastFailure: null };
  writeSemanticState(resolvedOutputRoot, staleState);
  const staged = stageDocuments(repositoryRoot, resolvedOutputRoot, runId, collection);

  if (!runnerPath) {
    fs.rmSync(staged.stageRoot, { recursive: true, force: true });
    const receipt = { ...receiptBase, status: 'stale-runner-unconfigured', runnerInvoked: false, collection, freshnessAfter: 'stale', completedAt: new Date().toISOString() };
    const receiptPath = writeReceipt(resolvedOutputRoot, receipt);
    pruneReceipts(resolvedOutputRoot, profile);
    return { status: receipt.status, runnerInvoked: false, receiptPath, state: staleState };
  }

  const semanticDir = path.join(resolvedOutputRoot, 'semantic', scopeId);
  fs.mkdirSync(semanticDir, { recursive: true, mode: 0o700 });
  const pendingOutput = path.join(staged.stageRoot, 'semantic-output.json');
  try {
    const runner = await invokeRunner(runnerPath, staged.manifestPath, pendingOutput, profile.caps.maxRuntimeSeconds * 1000);
    if (!fs.existsSync(pendingOutput)) throw new Error('semantic runner produced no output');
    const outputBytes = fs.statSync(pendingOutput).size;
    if (outputBytes > profile.caps.maxOutputBytes) throw new Error('semantic output cap exceeded');
    const publishedPath = path.join(semanticDir, 'latest.json');
    const publishTemp = path.join(semanticDir, `.latest-${runId}.tmp`);
    fs.copyFileSync(pendingOutput, publishTemp);
    fs.renameSync(publishTemp, publishedPath);
    const nextState = { freshness: 'fresh', lastEvaluatedHead: sourceHead ?? state.lastEvaluatedHead, lastSuccessfulRun: { runId, scopeId, completedAt: new Date().toISOString(), documents: collection.documents, outputPath: publishedPath, outputSha256: sha256Buffer(fs.readFileSync(publishedPath)) }, lastFailure: null };
    writeSemanticState(resolvedOutputRoot, nextState);
    fs.rmSync(staged.stageRoot, { recursive: true, force: true });
    const receipt = { ...receiptBase, status: 'regenerated', runnerInvoked: runner.invoked, collection, outputBytes, freshnessAfter: 'fresh', completedAt: new Date().toISOString() };
    const receiptPath = writeReceipt(resolvedOutputRoot, receipt);
    pruneReceipts(resolvedOutputRoot, profile);
    return { status: receipt.status, runnerInvoked: true, receiptPath, state: nextState, publishedPath };
  } catch (error) {
    fs.rmSync(staged.stageRoot, { recursive: true, force: true });
    const nextState = { ...staleState, lastFailure: { runId, occurredAt: new Date().toISOString(), message: error.message } };
    writeSemanticState(resolvedOutputRoot, nextState);
    const receipt = { ...receiptBase, status: 'failed', runnerInvoked: true, error: error.message, collection, freshnessAfter: 'stale', completedAt: new Date().toISOString() };
    const receiptPath = writeReceipt(resolvedOutputRoot, receipt);
    pruneReceipts(resolvedOutputRoot, profile);
    return { status: 'failed', runnerInvoked: true, error: error.message, receiptPath, state: nextState };
  }
}
