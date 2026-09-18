#!/usr/bin/env node

import fs, {realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanupArtifacts} from './artifact-retention.mjs';
import {defaultArtifactRoot, fileSignature, ingestDroppedFile} from './file-intake.mjs';
import {ensureConfiguredDirectory, resolveLocalPaths} from '../config/local-config.mjs';
import {createNotifier} from '../notifications/notifier.mjs';
import {drainNotificationActions} from '../notifications/action-router.mjs';
import {createProcessingFailureRequest, createReviewReadyCaptureRequest} from '../review/decision-request.mjs';

const DAY_MS = 86_400_000;
const DEFAULT_STABILITY_MS = 1_000;

function ensureDropFolder(dropFolder) {
  if (!dropFolder) throw new Error('missing_drop_folder');
  try { return ensureConfiguredDirectory(dropFolder).path; }
  catch (error) {
    if (error?.message === 'unsafe_configured_directory') throw new Error('invalid_drop_folder');
    throw error;
  }
}

function stateFile(dropFolder) {
  return path.join(dropFolder, '.evermind', 'state.json');
}

function loadState(dropFolder) {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(dropFolder), 'utf8'));
    if ((parsed?.version === 1 || parsed?.version === 2) && parsed.files && typeof parsed.files === 'object') {
      return {version: 2, files: parsed.files, pending: parsed.pending && typeof parsed.pending === 'object' ? parsed.pending : {}};
    }
  } catch {}
  return {version: 2, files: {}, pending: {}};
}

function saveState(dropFolder, state) {
  const dir = path.join(dropFolder, '.evermind');
  fs.mkdirSync(dir, {recursive: true});
  const target = stateFile(dropFolder);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
  fs.renameSync(temp, target);
}

function directFiles(dropFolder) {
  return fs.readdirSync(dropFolder, {withFileTypes: true})
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => path.join(dropFolder, entry.name))
    .sort();
}

export async function scanDropFolder({root, dropFolder, artifactRoot = defaultArtifactRoot(), state, stabilityMs = DEFAULT_STABILITY_MS, now = Date.now()} = {}) {
  const resolvedDrop = ensureDropFolder(dropFolder);
  const currentState = state ?? loadState(resolvedDrop);
  currentState.version = 2;
  currentState.files ??= {};
  currentState.pending ??= {};
  const results = [];
  const stableFor = Math.max(0, Number(stabilityMs) || 0);
  const observedAt = typeof now === 'function' ? now() : Number(now);
  if (!Number.isFinite(observedAt)) throw new Error('invalid_observation_time');
  let stateChanged = false;
  for (const file of directFiles(resolvedDrop)) {
    let signature;
    let key;
    try {
      signature = fileSignature(file);
      key = fs.realpathSync(file);
    } catch { continue; }
    if (currentState.files[key]?.signature === signature) {
      if (currentState.pending[key]) {
        delete currentState.pending[key];
        stateChanged = true;
      }
      continue;
    }
    let pending = currentState.pending[key];
    if (!pending || pending.signature !== signature) {
      pending = {signature, firstSeenAt: observedAt, lastSeenAt: observedAt};
      currentState.pending[key] = pending;
      stateChanged = true;
      if (stableFor > 0) continue;
    }
    currentState.pending[key] = {...pending, lastSeenAt: observedAt};
    stateChanged = true;
    if (observedAt - pending.firstSeenAt < stableFor) continue;
    let result;
    try {
      result = ingestDroppedFile({root, dropFolder: resolvedDrop, artifactRoot, filePath: file});
    } catch (error) {
      saveState(resolvedDrop, currentState);
      throw error;
    }
    currentState.files[key] = {signature, captureId: result.captureId, ingestedAt: result.capturedAt};
    delete currentState.pending[key];
    stateChanged = true;
    results.push(result);
  }
  if (stateChanged) saveState(resolvedDrop, currentState);
  return {state: currentState, results};
}

function notifySafely({notifier, request, onNotification, onError}) {
  try {
    const notification = notifier.notify(request);
    onNotification({request, notification});
  } catch (error) {
    onError(error);
  }
}

function safeErrorCode(error) {
  const candidate = typeof error?.code === 'string' ? error.code : typeof error?.name === 'string' ? error.name : '';
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(candidate) ? candidate : 'processing_failure';
}

export async function watchDropFolder({root, dropFolder, artifactRoot = defaultArtifactRoot(), intervalMs = 1500, stabilityMs = DEFAULT_STABILITY_MS, retentionDays = 7, cleanupIntervalMs = DAY_MS, keepArtifacts = false, applyCleanup = false, notifier = createNotifier(), onIngest = () => {}, onNotification = () => {}, onMaintenance = () => {}, onError = () => {}} = {}) {
  const configured = resolveLocalPaths({root, dropFolder});
  const resolvedRoot = configured.root;
  const resolvedDrop = ensureDropFolder(configured.dropFolder);
  let state = loadState(resolvedDrop);
  let running = false;
  let stopped = false;
  let lastCleanupAt = 0;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const scanned = await scanDropFolder({root: resolvedRoot, dropFolder: resolvedDrop, artifactRoot, state, stabilityMs});
      state = scanned.state;
      if (notifier.requestStore) {
        const actionResults = await drainNotificationActions({store: notifier.requestStore, root: resolvedRoot});
        if (actionResults.length > 0) onNotification({actionResults});
      }
      for (const result of scanned.results) {
        onIngest(result);
        notifySafely({
          notifier,
          request: createReviewReadyCaptureRequest({captureId: result.captureId, sourceType: result.sourceType, provenance: 'drop-folder'}),
          onNotification,
          onError,
        });
      }

      const now = Date.now();
      if (!keepArtifacts && now - lastCleanupAt >= Math.max(60_000, Number(cleanupIntervalMs) || DAY_MS)) {
        const cleanup = cleanupArtifacts({root: resolvedRoot, artifactRoot, retentionDays, apply: applyCleanup});
        lastCleanupAt = now;
        onMaintenance(cleanup);
      }
    } catch (error) {
      notifySafely({
        notifier,
        request: createProcessingFailureRequest({errorCode: safeErrorCode(error)}),
        onNotification,
        onError,
      });
      onError(error);
    } finally {
      running = false;
    }
  };

  await tick();
  const timer = setInterval(tick, Math.max(500, Number(intervalMs) || 1500));
  return {
    dropFolder: resolvedDrop,
    artifactRoot: path.resolve(String(artifactRoot)),
    stabilityMs: Math.max(0, Number(stabilityMs) || 0),
    retentionDays: Number(retentionDays),
    cleanupIntervalMs: Math.max(60_000, Number(cleanupIntervalMs) || DAY_MS),
    cleanupMode: applyCleanup ? 'apply' : 'dry-run',
    keepArtifacts: keepArtifacts === true,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--drop-folder') args.dropFolder = argv[++i];
    else if (arg === '--artifacts') args.artifactRoot = argv[++i];
    else if (arg === '--interval') args.intervalMs = Number(argv[++i]);
    else if (arg === '--stability-ms') args.stabilityMs = Number(argv[++i]);
    else if (arg === '--retention-days') args.retentionDays = Number(argv[++i]);
    else if (arg === '--cleanup-interval' || arg === '--cleanup-interval-ms') args.cleanupIntervalMs = Number(argv[++i]);
    else if (arg === '--keep-artifacts') args.keepArtifacts = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--once') args.once = true;
    else if (arg === '--help') args.help = true;
    else throw new Error('invalid_argument');
  }
  return args;
}

function resolveCleanupMode(args) {
  if (args.apply && args.dryRun) throw new Error('conflicting_cleanup_modes');
  return args.apply === true;
}

const executedDirectly = process.argv[1]
  ? realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write('Usage: evermind-watch --root PATH --drop-folder PATH [--artifacts PATH] [--interval MS] [--stability-ms MS] [--retention-days DAYS] [--cleanup-interval MS] [--keep-artifacts] [--dry-run|--apply] [--once]\n');
    } else {
      const configured = resolveLocalPaths({root: args.root, dropFolder: args.dropFolder});
      const root = configured.root;
      const dropFolder = configured.dropFolder;
      const artifactRoot = args.artifactRoot ?? process.env.EVERMIND_ARTIFACT_ROOT ?? defaultArtifactRoot();
      const applyCleanup = resolveCleanupMode(args);
      if (args.once) {
        const scanned = await scanDropFolder({root, dropFolder, artifactRoot, stabilityMs: args.stabilityMs});
        const maintenance = args.keepArtifacts ? null : cleanupArtifacts({root, artifactRoot, retentionDays: args.retentionDays ?? 7, apply: applyCleanup});
        process.stdout.write(`${JSON.stringify({status: 'scanned', count: scanned.results.length, items: scanned.results, maintenance: maintenance ? {mode: maintenance.mode, eligibleCount: maintenance.eligible.length, removedCount: maintenance.removed.length} : {mode: 'skipped'}})}\n`);
      } else {
        const watcher = await watchDropFolder({
          root,
          dropFolder,
          artifactRoot,
          intervalMs: args.intervalMs,
          stabilityMs: args.stabilityMs,
          retentionDays: args.retentionDays,
          cleanupIntervalMs: args.cleanupIntervalMs,
          keepArtifacts: args.keepArtifacts,
          applyCleanup,
          onIngest: (item) => process.stdout.write(`${JSON.stringify({status: 'captured', ...item})}\n`),
          onNotification: ({notification}) => process.stdout.write(`${JSON.stringify({status: 'notified', ...notification})}\n`),
          onMaintenance: (maintenance) => process.stdout.write(`${JSON.stringify({status: 'maintenance', mode: maintenance.mode, eligibleCount: maintenance.eligible.length, removedCount: maintenance.removed.length})}\n`),
          onError: (error) => process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`),
        });
        process.stdout.write(`${JSON.stringify({status: 'watching', dropFolder: watcher.dropFolder, artifactRoot: watcher.artifactRoot, stabilityMs: watcher.stabilityMs, retentionDays: watcher.retentionDays, cleanupIntervalMs: watcher.cleanupIntervalMs, cleanupMode: watcher.cleanupMode, keepArtifacts: watcher.keepArtifacts})}\n`);
        await new Promise(() => {});
      }
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

export {ensureDropFolder, loadState, parseArgs, resolveCleanupMode, safeErrorCode, stateFile};
