import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { isPathWithin, writeJsonFileOwnerOnly } from './runtime-profile-manager-core.mjs';
import { observeCodexAppServerAccount } from './codex-app-server-observer.mjs';
import { compileCodexProfileConfig } from './runtime-profile-configuration.mjs';

export const CODEX_RUNTIME_PROFILE_ADAPTER_ID = 'runtime_adapter:codex-cli';
export const CODEX_RUNTIME_PROFILE_ADAPTER_VERSION = '1.1.0';

const CLOUD_SYNC_MARKERS = Object.freeze([
  '/iCloud Drive/',
  '/Library/Mobile Documents/',
  '/Dropbox/',
  '/Google Drive/',
  '/OneDrive/',
]);

function mode(stat) {
  return stat.mode & 0o777;
}

function ownerOnlyDirectory(stat) {
  return (mode(stat) & 0o077) === 0;
}

function safeLstat(file) {
  try {
    const stat = fs.lstatSync(file);
    return { exists: true, stat, symlink: stat.isSymbolicLink() };
  } catch (error) {
    return { exists: false, errorCode: error?.code ?? 'stat_failed' };
  }
}

function inspectDirectory(file, { requireOwnerOnly = false } = {}) {
  const result = safeLstat(file);
  if (!result.exists) return { exists: false, ownerMatches: null, mode: null, safe: false, reason: result.errorCode };
  if (result.symlink || !result.stat.isDirectory()) return { exists: true, ownerMatches: false, mode: mode(result.stat), safe: false, reason: result.symlink ? 'symlink_not_allowed' : 'not_directory' };
  const ownerMatches = result.stat.uid === process.getuid?.();
  const safe = ownerMatches && (!requireOwnerOnly || ownerOnlyDirectory(result.stat));
  return { exists: true, ownerMatches, mode: mode(result.stat), safe, reason: safe ? null : ownerMatches ? 'directory_permissions_too_open' : 'directory_owner_mismatch' };
}

function inspectAuthFile(file) {
  const result = safeLstat(file);
  if (!result.exists) return { exists: false, state: 'not_created', mode: null, ownerMatches: null, safe: true };
  const ownerMatches = result.stat.uid === process.getuid?.();
  const fileMode = mode(result.stat);
  const safe = !result.symlink && result.stat.isFile() && ownerMatches && (fileMode & 0o077) === 0 && (fileMode & 0o600) === 0o600;
  return {
    exists: true,
    state: safe ? 'owner_only' : 'unsafe',
    mode: fileMode,
    ownerMatches,
    safe,
    reason: safe ? null : result.symlink ? 'auth_file_symlink_not_allowed' : 'auth_file_permissions_or_owner_invalid',
  };
}

function pathHasGitAncestor(file) {
  let current = path.resolve(file);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function isCloudSynchronized(file) {
  const normalized = `${path.resolve(file)}/`;
  return CLOUD_SYNC_MARKERS.some((marker) => normalized.includes(marker));
}

function processLiveness(pid) {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    return error?.code === 'ESRCH' ? 'dead' : 'unknown';
  }
}

function safeNativeLoginStatus({ root, executable, run }) {
  const result = run(executable, ['login', 'status', '--config', 'cli_auth_credentials_store="file"'], {
    env: { PATH: process.env.PATH, HOME: os.homedir(), CODEX_HOME: root },
    timeoutMs: 15_000,
  });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  if (result.errorCode === 'ENOENT') return { state: 'unknown', status: 'unavailable' };
  if (/not logged|logged out|no active|unauthenticated|not authenticated/.test(text)) return { state: 'confirmed', status: 'not_authenticated' };
  if (result.status === 0 && /logged in|authenticated|active session|already logged/.test(text)) return { state: 'confirmed', status: 'authenticated' };
  return { state: 'unknown', status: result.status === 0 ? 'unknown' : 'error' };
}

function defaultRun(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    env: options.env,
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 15_000,
    maxBuffer: 128 * 1024,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', errorCode: result.error?.code ?? null };
}

function defaultResourceOwnerProbe(paths) {
  if (paths.length === 0) return { state: 'none', owners: [], inspectedPaths: [] };
  const result = spawnSync('lsof', ['-n', '-t', '--', ...paths], {
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 64 * 1024,
    shell: false,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error && result.error.code === 'ENOENT') return { state: 'unknown', owners: [], inspectedPaths: paths, reason: 'lsof_unavailable' };
  if (result.error || ![0, 1].includes(result.status)) return { state: 'unknown', owners: [], inspectedPaths: paths, reason: result.error?.code ?? 'resource_owner_probe_failed' };
  const owners = [...new Set(String(result.stdout ?? '').split(/\r?\n/).map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0))];
  return { state: owners.length > 0 ? 'active' : 'none', owners, inspectedPaths: paths };
}

function runtimePathsForRoot(root) {
  const resolved = path.resolve(root);
  return [
    path.join(resolved, 'config.toml'),
    path.join(resolved, 'config.toml.brain-ownership.json'),
    path.join(resolved, 'auth.json'),
    path.join(resolved, '.brain-runtime-profile-lease.json'),
    path.join(resolved, 'app-server-control', 'app-server-control.sock'),
    path.join(resolved, 'app-server-control', 'app-server-startup.lock'),
  ];
}

export function createCodexCliRuntimeProfileAdapter({ executable = 'codex', run = defaultRun, now = () => new Date(), accountObserver, resourceOwnerProbe = defaultResourceOwnerProbe } = {}) {
  return Object.freeze({
    adapterId: CODEX_RUNTIME_PROFILE_ADAPTER_ID,
    adapterVersion: CODEX_RUNTIME_PROFILE_ADAPTER_VERSION,
    resolveRuntimeRoot(profile, context = {}) {
      const profilesRoot = path.resolve(context.profilesRoot ?? path.join(os.homedir(), '.brain', 'codex-runtime-profiles'));
      const suffix = profile.runtimeProfileId.slice('runtime_profile:'.length);
      const root = path.resolve(profilesRoot, suffix);
      if (!isPathWithin(profilesRoot, root) || root === profilesRoot) throw new Error('runtime profile root escaped profiles root');
      return root;
    },
    inspectRootSecurity({ root }) {
      const rootPath = path.resolve(root);
      const rootInfo = inspectDirectory(rootPath, { requireOwnerOnly: true });
      const parentInfo = inspectDirectory(path.dirname(rootPath), { requireOwnerOnly: false });
      const auth = inspectAuthFile(path.join(rootPath, 'auth.json'));
      const reasons = [];
      if (rootInfo.exists && !rootInfo.safe) reasons.push(`runtime_root_${rootInfo.reason}`);
      if (!rootInfo.exists && rootInfo.reason !== 'ENOENT') reasons.push(`runtime_root_${rootInfo.reason}`);
      if (!parentInfo.exists || !parentInfo.ownerMatches) reasons.push('runtime_root_parent_owner_unresolved');
      if (parentInfo.exists && (parentInfo.mode & 0o022) !== 0) reasons.push('runtime_root_parent_group_or_other_writable');
      if (pathHasGitAncestor(rootPath)) reasons.push('runtime_root_inside_git_worktree');
      if (isCloudSynchronized(rootPath)) reasons.push('runtime_root_in_known_cloud_sync_path');
      if (!auth.safe) reasons.push(auth.reason);
      return {
        rootExists: rootInfo.exists,
        safe: reasons.length === 0 && (!rootInfo.exists || rootInfo.safe),
        root: { ...rootInfo, path: rootPath },
        parent: { ...parentInfo, path: path.dirname(rootPath) },
        authFile: { ...auth, path: path.join(rootPath, 'auth.json') },
        cloudSync: isCloudSynchronized(rootPath) ? 'known_exposure' : 'not_observed',
        gitSeparation: pathHasGitAncestor(rootPath) ? 'unsafe' : 'not_in_git_worktree',
        diskEncryption: 'not_observed',
        reasons: [...new Set(reasons)].sort(),
      };
    },
    inspectAuthentication({ root }) {
      return safeNativeLoginStatus({ root, executable, run });
    },
    inspectAccountObservation({ profile, root, context = {} }) {
      if (typeof accountObserver === 'function') return accountObserver({ profile, root, context });
      // Tests and injected command runners retain the old bounded status probe;
      // production CLI invocations use the supported profile-local app-server
      // account/read surface instead.
      if (context.accountObservationMode !== 'app-server' && run !== defaultRun) return safeNativeLoginStatus({ root, executable, run });
      return observeCodexAppServerAccount({
        root,
        executable,
        cwd: context.cwd,
        expectedPrincipal: context.expectedPrincipal,
        identityMatcher: context.identityMatcher,
        providerId: context.providerId ?? 'openai',
      });
    },
    profileConfigPath({ root }) {
      return path.join(path.resolve(root), 'config.toml');
    },
    compileProfileConfig({ profile, artifact, settings = {} }) {
      return compileCodexProfileConfig({ profile, artifact, settings });
    },
    isDefaultRuntimeRoot(root) {
      return path.resolve(root) === path.resolve(path.join(os.homedir(), '.codex'));
    },
    runtimePaths({ root }) {
      return runtimePathsForRoot(root);
    },
    buildLaunchCommand({ profile, root, extraArgs = [] }) {
      if (extraArgs.length > 0) throw new Error('extra Codex arguments are disabled until explicit argument policy is admitted');
      return {
        executable,
        args: ['--config', 'cli_auth_credentials_store="file"'],
        envOverlay: {
          CODEX_HOME: root,
          BRAIN_RUNTIME_PROFILE_ID: profile.runtimeProfileId,
          BRAIN_RUNTIME_PROFILE_MANAGER: '1',
        },
        storageMode: 'file',
        shell: false,
        noGlobalEnvironmentMutation: true,
      };
    },
    buildLoginHandoff({ profile, root }) {
      return {
        executable,
        args: ['login', '--config', 'cli_auth_credentials_store="file"'],
        envOverlay: {
          CODEX_HOME: root,
          BRAIN_RUNTIME_PROFILE_ID: profile.runtimeProfileId,
          BRAIN_RUNTIME_PROFILE_MANAGER: '1',
        },
        shell: false,
        humanMustComplete: true,
        managerDoesNotExecute: true,
      };
    },
    createRuntimeRoot({ root }) {
      const rootPath = path.resolve(root);
      const existing = safeLstat(rootPath);
      if (existing.exists && (existing.symlink || !existing.stat.isDirectory())) throw new Error('runtime root exists but is not a directory');
      fs.mkdirSync(rootPath, { recursive: true, mode: 0o700 });
      fs.chmodSync(rootPath, 0o700);
    },
    processLeasePath({ root }) {
      return path.join(path.resolve(root), '.brain-runtime-profile-lease.json');
    },
    inspectProcessOwnership({ profile, root, context = {} }) {
      if (!root) return { state: 'not_provisioned', owner: 'profile_scoped', pid: null };
      const rootPath = path.resolve(root);
      const leasePath = path.join(rootPath, '.brain-runtime-profile-lease.json');
      const leaseFile = safeLstat(leasePath);
      if (leaseFile.exists && (leaseFile.symlink || !leaseFile.stat.isFile() || leaseFile.stat.uid !== process.getuid?.() || (mode(leaseFile.stat) & 0o077) !== 0)) {
        return { state: 'conflicted', owner: 'profile_scoped', pid: null, reason: 'lease_file_permissions_or_type_invalid' };
      }
      const existingPaths = runtimePathsForRoot(rootPath).filter((file) => safeLstat(file).exists);
      const resourceProbe = (context.resourceOwnerProbe ?? resourceOwnerProbe)(existingPaths, { profile, root: rootPath, context });
      if (resourceProbe?.state === 'unknown') {
        return { state: 'unknown', owner: 'profile_scoped', pid: null, resourceOwners: [], resourceProbe };
      }
      const resourceOwners = [...new Set(resourceProbe?.owners ?? [])];
      try {
        const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
        if (lease.profileId !== profile.runtimeProfileId || !Number.isInteger(lease.pid) || lease.pid <= 0) return { state: 'conflicted', owner: 'profile_scoped', pid: null };
        const liveness = processLiveness(lease.pid);
        const state = liveness === 'unknown'
          ? 'unknown'
          : liveness === 'alive' || resourceOwners.length > 0
            ? 'active'
            : 'stale';
        return { state, owner: 'profile_scoped', pid: lease.pid, leaseState: liveness, resourceOwners, resourceProbe };
      } catch (error) {
        return {
          state: error?.code === 'ENOENT' ? resourceOwners.length > 0 ? 'active' : 'none' : 'unknown',
          owner: 'profile_scoped',
          pid: null,
          resourceOwners,
          resourceProbe,
        };
      }
    },
    writeProcessLease({ root, profileId, pid, startedAt }) {
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('child process did not provide a valid pid');
      const leasePath = path.join(path.resolve(root), '.brain-runtime-profile-lease.json');
      const lease = { schemaVersion: '1.0.0', profileId, pid, startedAt, manager: CODEX_RUNTIME_PROFILE_ADAPTER_ID };
      writeJsonFileOwnerOnly(leasePath, lease);
      return { path: leasePath, pid, profileId, startedAt, state: 'active' };
    },
    removeProcessLease({ root, pid }) {
      const leasePath = path.join(path.resolve(root), '.brain-runtime-profile-lease.json');
      try {
        const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
        if (lease.pid === pid) fs.unlinkSync(leasePath);
        return { removed: lease.pid === pid, path: leasePath };
      } catch (error) {
        return { removed: false, path: leasePath, reason: error?.code ?? 'lease_unavailable' };
      }
    },
    clearStaleProcessLease({ root, profileId }) {
      const leasePath = path.join(path.resolve(root), '.brain-runtime-profile-lease.json');
      const leaseFile = safeLstat(leasePath);
      if (!leaseFile.exists) return { removed: false, path: leasePath, reason: 'lease_unavailable' };
      if (leaseFile.symlink || !leaseFile.stat.isFile() || leaseFile.stat.uid !== process.getuid?.() || (mode(leaseFile.stat) & 0o077) !== 0) {
        return { removed: false, path: leasePath, reason: 'lease_file_permissions_or_type_invalid' };
      }
      try {
        const lease = JSON.parse(fs.readFileSync(leasePath, 'utf8'));
        if (lease.profileId !== profileId || !Number.isInteger(lease.pid) || lease.pid <= 0) return { removed: false, path: leasePath, reason: 'lease_profile_mismatch' };
        const liveness = processLiveness(lease.pid);
        if (liveness === 'alive') return { removed: false, path: leasePath, reason: 'profile_process_still_active' };
        if (liveness === 'unknown') return { removed: false, path: leasePath, reason: 'profile_process_liveness_unresolved' };
        if (liveness === 'dead') {
          fs.unlinkSync(leasePath);
          return { removed: true, path: leasePath, reason: 'stale_process_lease_removed' };
        }
      } catch (error) {
        return { removed: false, path: leasePath, reason: error?.code ?? 'lease_unavailable' };
      }
    },
    now,
  });
}
