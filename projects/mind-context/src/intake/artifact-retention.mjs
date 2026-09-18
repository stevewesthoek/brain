#!/usr/bin/env node

import fs, {realpathSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defaultArtifactRoot} from './file-intake.mjs';

const DAY_MS = 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maintenanceRoot() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Evermind', 'maintenance');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'Evermind', 'maintenance');
  return path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'evermind', 'maintenance');
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return {};
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const metadata = {};
  for (const line of markdown.slice(4, end).split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (!key) continue;
    if (raw.startsWith('"')) {
      try { metadata[key] = JSON.parse(raw); }
      catch { metadata[key] = raw.slice(1, -1); }
    } else {
      metadata[key] = raw;
    }
  }
  return metadata;
}

function reviewedCaptures(root) {
  const processedDir = path.join(path.resolve(root), 'inbox', 'processed');
  const map = new Map();
  if (!fs.existsSync(processedDir)) return map;
  for (const name of fs.readdirSync(processedDir).filter((item) => item.endsWith('.md')).sort()) {
    const file = path.join(processedDir, name);
    let metadata;
    try { metadata = parseFrontmatter(fs.readFileSync(file, 'utf8')); }
    catch { continue; }
    const captureId = String(metadata.capture_id ?? '');
    const decision = String(metadata.decision ?? '');
    const reviewedAt = String(metadata.reviewed_at ?? '');
    const reviewedMs = Date.parse(reviewedAt);
    if (!UUID_RE.test(captureId)) continue;
    if (!['approved', 'rejected'].includes(decision)) continue;
    if (!Number.isFinite(reviewedMs)) continue;
    const current = map.get(captureId);
    if (!current || reviewedMs > current.reviewedMs) map.set(captureId, {captureId, decision, reviewedAt, reviewedMs, receipt: file});
  }
  return map;
}

function safeArtifactDirectory(artifactRoot, captureId) {
  if (!UUID_RE.test(captureId)) throw new Error('invalid_capture_id');
  const resolvedRoot = fs.realpathSync(path.resolve(artifactRoot));
  const candidate = path.join(resolvedRoot, captureId);
  if (!fs.existsSync(candidate)) return null;
  const stat = fs.lstatSync(candidate);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_artifact_directory');
  const real = fs.realpathSync(candidate);
  const relative = path.relative(resolvedRoot, real);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) throw new Error('unsafe_artifact_directory');
  return {root: resolvedRoot, path: real};
}

function directoryBytes(directory) {
  let total = 0;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) total += fs.statSync(target).size;
    }
  };
  visit(directory);
  return total;
}

function appendReceipt(entry, receiptRoot = maintenanceRoot()) {
  const root = path.resolve(receiptRoot);
  fs.mkdirSync(root, {recursive: true, mode: 0o700});
  const file = path.join(root, 'artifact-cleanup.jsonl');
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, {encoding: 'utf8', mode: 0o600});
  try { fs.chmodSync(file, 0o600); } catch {}
  return file;
}

export function planArtifactCleanup({root, artifactRoot = defaultArtifactRoot(), retentionDays = 7, now = new Date()} = {}) {
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days < 1) throw new Error('invalid_retention_days');
  const resolvedArtifacts = path.resolve(artifactRoot);
  if (!fs.existsSync(resolvedArtifacts)) return {eligible: [], retained: [], bytesEligible: 0};
  if (!fs.statSync(resolvedArtifacts).isDirectory()) throw new Error('invalid_artifact_root');

  const reviewed = reviewedCaptures(root);
  const cutoff = now.getTime() - days * DAY_MS;
  const eligible = [];
  const retained = [];

  for (const captureId of fs.readdirSync(resolvedArtifacts).sort()) {
    if (!UUID_RE.test(captureId)) {
      retained.push({captureId, reason: 'unrecognized_artifact_directory'});
      continue;
    }
    const review = reviewed.get(captureId);
    if (!review) {
      retained.push({captureId, reason: 'not_reviewed'});
      continue;
    }
    if (review.reviewedMs > cutoff) {
      retained.push({captureId, reason: 'within_grace_period', reviewedAt: review.reviewedAt, decision: review.decision});
      continue;
    }
    const directory = safeArtifactDirectory(resolvedArtifacts, captureId);
    if (!directory) continue;
    const bytes = directoryBytes(directory.path);
    eligible.push({captureId, artifactPath: directory.path, bytes, reviewedAt: review.reviewedAt, decision: review.decision});
  }

  return {eligible, retained, bytesEligible: eligible.reduce((sum, item) => sum + item.bytes, 0)};
}

export function cleanupArtifacts({root, artifactRoot = defaultArtifactRoot(), retentionDays = 7, now = new Date(), apply = false, receiptRoot = maintenanceRoot()} = {}) {
  const plan = planArtifactCleanup({root, artifactRoot, retentionDays, now});
  const removed = [];
  if (apply) {
    for (const item of plan.eligible) {
      const checked = safeArtifactDirectory(artifactRoot, item.captureId);
      if (!checked) continue;
      fs.rmSync(checked.path, {recursive: true, force: false});
      removed.push({...item, removedAt: new Date().toISOString()});
    }
  }
  const receipt = {
    version: 1,
    runAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    retentionDays: Number(retentionDays),
    artifactRoot: path.resolve(artifactRoot),
    eligibleCount: plan.eligible.length,
    removedCount: removed.length,
    bytesEligible: plan.bytesEligible,
    removed,
  };
  const receiptFile = appendReceipt(receipt, receiptRoot);
  return {...plan, removed, receiptFile, mode: receipt.mode};
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--artifacts') args.artifactRoot = argv[++i];
    else if (arg === '--retention-days') args.retentionDays = Number(argv[++i]);
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--help') args.help = true;
    else throw new Error('invalid_argument');
  }
  return args;
}

const executedDirectly = process.argv[1]
  ? realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Usage: evermind-artifact-cleanup --root PATH [--artifacts PATH] [--retention-days 7] [--apply]\n');
    } else {
      const root = args.root ?? process.env.EVERMIND_ROOT ?? process.env.MIND_CONTEXT_ROOT;
      const artifactRoot = args.artifactRoot ?? process.env.EVERMIND_ARTIFACT_ROOT ?? defaultArtifactRoot();
      const result = cleanupArtifacts({root, artifactRoot, retentionDays: args.retentionDays ?? 7, apply: args.apply === true});
      process.stdout.write(`${JSON.stringify({status: 'ok', ...result})}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

export {maintenanceRoot, parseArgs, reviewedCaptures, safeArtifactDirectory};
