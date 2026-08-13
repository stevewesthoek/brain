import fs from 'node:fs';
import path from 'node:path';

export const ALLOWED_MODES = new Set(['SYMLINK', 'GENERATED-COPY', 'INCLUDE', 'LOCAL-ONLY']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeHomePath(value) {
  return String(value ?? '').replace(/\/$/, '');
}

export function validateWorkstationConfigOwnership(spec, { repoRoot } = {}) {
  assert(spec && typeof spec === 'object', 'spec must be an object');
  assert(spec.specVersion, 'specVersion is required');
  assert(spec.authority === 'brain-workstation-config', 'authority must be brain-workstation-config');
  assert(spec.migration?.liveMutationAuthorized === false, 'liveMutationAuthorized must remain false in canonical repo state');
  assert(spec.migration?.mustPreserveSessionState === true, 'migration must preserve session state');
  assert(spec.migration?.mustPreserveAuthState === true, 'migration must preserve auth state');
  assert(spec.migration?.requiresBackupBeforeMutation === true, 'migration must require backup before mutation');
  assert(spec.migration?.requiresRollbackReceipt === true, 'migration must require rollback receipts');

  const forbiddenRoots = new Set((spec.forbiddenWholeRootSymlinks ?? []).map(normalizeHomePath));
  for (const required of ['~/.claude', '~/.cursor', '~/.gemini', '~/.kiro', '~/.codex']) {
    assert(forbiddenRoots.has(required), `forbiddenWholeRootSymlinks missing ${required}`);
  }

  const roots = spec.runtimeRoots ?? [];
  const rootByPath = new Map();
  for (const entry of roots) {
    assert(ALLOWED_MODES.has(entry.mode), `invalid runtime-root mode for ${entry.id}: ${entry.mode}`);
    assert(entry.mode === 'LOCAL-ONLY', `runtime root ${entry.id} must be LOCAL-ONLY`);
    assert(entry.gitSecretAllowance === false, `runtime root ${entry.id} must forbid Git secrets`);
    assert(entry.preserveSessionState === true, `runtime root ${entry.id} must preserve session state`);
    rootByPath.set(normalizeHomePath(entry.localPath), entry);
  }
  for (const required of forbiddenRoots) {
    assert(rootByPath.has(required), `runtimeRoots missing ${required}`);
  }

  const entries = spec.managedEntries ?? [];
  const byId = new Map();
  for (const entry of entries) {
    assert(entry.id, 'managed entry id is required');
    assert(!byId.has(entry.id), `duplicate managed entry id: ${entry.id}`);
    byId.set(entry.id, entry);
    assert(ALLOWED_MODES.has(entry.mode), `invalid managed mode for ${entry.id}: ${entry.mode}`);
    assert(entry.gitSecretAllowance === false, `managed entry ${entry.id} must set gitSecretAllowance=false`);
    assert(entry.localPath, `managed entry ${entry.id} missing localPath`);
    assert(entry.sourcePath, `managed entry ${entry.id} missing sourcePath`);
    assert(!path.isAbsolute(entry.sourcePath), `managed entry ${entry.id} sourcePath must be repo-relative`);
    if (entry.mode === 'SYMLINK') {
      assert(!forbiddenRoots.has(normalizeHomePath(entry.localPath)), `whole runtime root may not be SYMLINK: ${entry.localPath}`);
    }
    if (entry.mode === 'INCLUDE') {
      assert(entry.localOverlayPath, `INCLUDE entry ${entry.id} requires localOverlayPath`);
    }
    if (repoRoot) {
      assert(fs.existsSync(path.join(repoRoot, entry.sourcePath)), `managed source missing for ${entry.id}: ${entry.sourcePath}`);
    }
  }

  const codex = byId.get('codex-config');
  assert(codex?.mode === 'GENERATED-COPY', 'codex-config must be GENERATED-COPY');
  assert(codex?.localPath === '~/.codex/config.toml', 'codex-config must target ~/.codex/config.toml');
  assert(codex?.fileMode === '0600', 'codex-config must require mode 0600');

  const git = byId.get('git-root-config');
  assert(git?.mode === 'INCLUDE', 'git-root-config must use INCLUDE');
  assert(git?.localPath === '~/.gitconfig', 'git-root-config must target ~/.gitconfig');

  const ssh = byId.get('ssh-root-config');
  assert(ssh?.mode === 'INCLUDE', 'ssh-root-config must use INCLUDE');
  assert(ssh?.localPath === '~/.ssh/config', 'ssh-root-config must target ~/.ssh/config');
  assert(ssh?.fileMode === '0600', 'ssh-root-config must require mode 0600');

  const continuity = spec.crossMachineContinuity ?? {};
  const aliases = new Set(continuity.sshAliasesThatMustResolve ?? []);
  for (const alias of ['MacBook', 'macbook', 'office']) {
    assert(aliases.has(alias), `crossMachineContinuity missing SSH alias ${alias}`);
  }
  assert(continuity.macBookThunderboltAddress === '192.168.2.2', 'MacBook Thunderbolt address must remain 192.168.2.2');
  assert(continuity.officeThunderboltAddress === '192.168.2.1', 'Office Thunderbolt address must remain 192.168.2.1');
  assert(continuity.officeTailscaleAddress === '100.86.124.66', 'Office Tailscale address must remain 100.86.124.66');
  assert(continuity.macBookTailscaleAddress === '100.70.12.18', 'MacBook Tailscale address must remain 100.70.12.18');
  assert(continuity.wifiLanAddressesCanonical === false, 'DHCP Wi-Fi/LAN addresses must not become canonical');
  const macBookToOffice = continuity.routePolicy?.macBookToOffice ?? [];
  assert(macBookToOffice.length === 2, 'MacBook→Office must expose exactly Thunderbolt and Tailscale canonical routes');
  assert(macBookToOffice[0]?.transport === 'thunderbolt' && macBookToOffice[0]?.host === '192.168.2.1', 'MacBook→Office priority 1 must remain Thunderbolt');
  assert(macBookToOffice[1]?.transport === 'tailscale' && macBookToOffice[1]?.host === '100.86.124.66', 'MacBook→Office priority 2 must remain Tailscale');
  const officeToMacBook = continuity.routePolicy?.officeToMacBook ?? [];
  assert(officeToMacBook.length === 2, 'Office→MacBook must expose exactly Thunderbolt and Tailscale canonical routes');
  assert(officeToMacBook[0]?.transport === 'thunderbolt' && officeToMacBook[0]?.host === '192.168.2.2', 'Office→MacBook priority 1 must remain Thunderbolt');
  assert(officeToMacBook[1]?.transport === 'tailscale' && officeToMacBook[1]?.host === '100.70.12.18', 'Office→MacBook priority 2 must remain Tailscale');
  const codexRemote = continuity.codexRemoteSsh ?? {};
  assert(codexRemote.remoteRuntimeRoot === '~/.codex', 'Codex Remote SSH runtime root must remain ~/.codex');
  assert(codexRemote.remoteRuntimeRootMustBePhysical === true, 'Codex Remote SSH requires a physical remote runtime root');
  assert(codexRemote.maxResolvedSocketPathBytes === 103, 'Codex Remote SSH socket path limit must remain 103 bytes');
  assert(codexRemote.configTomlMode === 'GENERATED-COPY', 'Codex Remote SSH config.toml must use GENERATED-COPY');
  assert(codexRemote.configTomlSymlinkRequired === false, 'Codex Remote SSH must not depend on a config.toml symlink');
  assert(codexRemote.mustValidateEndToEndAfterMigration === true, 'Codex Remote SSH requires end-to-end MacBook validation after migration');
  assert(continuity.migrationRequiresSshConfigResolutionCheck === true, 'migration must require SSH config resolution check');
  assert(continuity.migrationRequiresNonDestructiveSshConnectivityCheck === true, 'migration must require non-destructive SSH connectivity check');
  assert(continuity.privateKeysRemainLocalOnly === true, 'SSH private keys must remain local-only');
  assert(continuity.knownHostsRemainLocalOnly === true, 'SSH known_hosts must remain local-only');

  if (repoRoot) {
    const sshSourcePath = path.join(repoRoot, ssh.sourcePath);
    const sshSource = fs.readFileSync(sshSourcePath, 'utf8');
    assert(
      sshSource.includes('Host MacBook macbook\n  HostName 100.70.12.18'),
      'tracked SSH config must default MacBook/macbook to fixed Tailscale 100.70.12.18',
    );
    assert(
      sshSource.includes('Match host MacBook,macbook exec "/usr/bin/nc -G 1 -z 192.168.2.2 22"')
        && sshSource.includes('  HostName 192.168.2.2'),
      'tracked SSH config must override MacBook/macbook to fixed Thunderbolt 192.168.2.2 when reachable',
    );
    assert(
      sshSource.includes('Host office\n  HostName 100.86.124.66'),
      'tracked SSH config must default office to fixed Tailscale 100.86.124.66',
    );
    assert(
      sshSource.includes('Match host office exec "/usr/bin/nc -G 1 -z 192.168.2.1 22"')
        && sshSource.includes('  HostName 192.168.2.1'),
      'tracked SSH config must override office to fixed Thunderbolt 192.168.2.1 when reachable',
    );
    assert(!sshSource.includes('192.168.100.'), 'tracked SSH config must not embed DHCP home-LAN addresses');
  }

  return {
    specVersion: spec.specVersion,
    runtimeRoots: roots.length,
    managedEntries: entries.length,
    forbiddenWholeRootSymlinks: forbiddenRoots.size,
    sshAliases: [...aliases],
  };
}

export function loadAndValidateWorkstationConfigOwnership(specPath, options = {}) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  return validateWorkstationConfigOwnership(spec, options);
}
