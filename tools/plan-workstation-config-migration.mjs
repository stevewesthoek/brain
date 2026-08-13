#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(ROOT, 'operations/specs/workstation-config-ownership.json');
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
const home = os.homedir();
const args = new Set(process.argv.slice(2));
const receiptIndex = process.argv.indexOf('--receipt');
const receiptArg = receiptIndex >= 0 ? process.argv[receiptIndex + 1] : undefined;

function expandHome(value) {
  return String(value).replace(/^~(?=\/|$)/, home);
}

function describePath(input) {
  const absolutePath = expandHome(input);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { path: input, absolutePath, exists: false, kind: 'missing' };
    }
    throw error;
  }

  const result = {
    path: input,
    absolutePath,
    exists: true,
    kind: stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    mode: `0${(stat.mode & 0o777).toString(8)}`,
  };
  if (stat.isSymbolicLink()) {
    result.symlinkTarget = fs.readlinkSync(absolutePath);
  }
  return result;
}

const runtimeRoots = spec.runtimeRoots.map((entry) => ({
  id: entry.id,
  desiredMode: entry.mode,
  preserveSessionState: entry.preserveSessionState,
  current: describePath(entry.localPath),
}));

const managedEntries = spec.managedEntries.map((entry) => ({
  id: entry.id,
  desiredMode: entry.mode,
  sourcePath: entry.sourcePath,
  sourceExists: fs.existsSync(path.join(ROOT, entry.sourcePath)),
  current: describePath(entry.localPath),
}));

const migrationRequired = runtimeRoots.some((entry) => entry.current.kind === 'symlink')
  || managedEntries.some((entry) => {
    if (entry.id === 'git-root-config' || entry.id === 'ssh-root-config') {
      return entry.current.kind === 'symlink';
    }
    return false;
  });

const plan = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: 'PLAN_ONLY',
  liveMutationAuthorized: false,
  repositoryRoot: ROOT,
  home,
  canonicalSpec: path.relative(ROOT, SPEC_PATH),
  migrationRequired,
  safety: {
    mutatesHomeDirectory: false,
    readsSecretContents: false,
    printsSecretContents: false,
    preservesSessionsAuthCachesAndRuntimeDatabases: true,
    requiresApplicationShutdownBeforeRootConversion: true,
    requiresRollbackReceiptBeforeMutation: true,
    requiresOfficeMacBookConnectivityAcceptance: true,
  },
  canonicalNetwork: spec.crossMachineContinuity,
  runtimeRoots,
  managedEntries,
  executionGates: [
    'Capture a read-only baseline and path metadata.',
    'Quit only the application owning the root being migrated.',
    'Create a timestamped lossless backup outside the repository.',
    'Stage a physical runtime directory preserving session/auth/runtime state.',
    'Verify staged critical paths without reading secret contents.',
    'Atomically replace the legacy whole-root symlink only after staging verifies.',
    'Attach only ownership-spec narrow symlinks/generated copies/includes.',
    'Run application/session/auth/MCP and Office↔MacBook SSH acceptance checks.',
    'Rollback immediately on any regression.',
    'Delete old runtime residue only in a separately approved cleanup step.',
  ],
};

if (args.has('--write')) {
  throw new Error('This tool is plan-only. --write is intentionally unsupported.');
}

if (receiptArg) {
  const receiptPath = path.resolve(ROOT, receiptArg);
  if (!receiptPath.startsWith(ROOT + path.sep)) {
    throw new Error('Receipt path must stay inside the repository root.');
  }
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
  console.error(`plan receipt written: ${receiptPath}`);
}

console.log(JSON.stringify(plan, null, 2));
