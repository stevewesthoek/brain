import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateWorkstationConfigOwnership } from './lib/workstation-config-ownership.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/workstation-config-ownership.json'), 'utf8'));

function clone() {
  return structuredClone(SPEC);
}

test('canonical workstation ownership spec validates', () => {
  const result = validateWorkstationConfigOwnership(clone(), { repoRoot: ROOT });
  assert.equal(result.specVersion, '1.0.0');
  assert.ok(result.managedEntries > 0);
});

test('whole Claude/Cursor/Gemini/Kiro/Codex roots cannot become symlinks', () => {
  for (const root of ['~/.claude', '~/.cursor', '~/.gemini', '~/.kiro', '~/.codex']) {
    const spec = clone();
    const runtime = spec.runtimeRoots.find((entry) => entry.localPath === root);
    runtime.mode = 'SYMLINK';
    assert.throws(() => validateWorkstationConfigOwnership(spec), /must be LOCAL-ONLY/);
  }
});

test('Codex config must remain a generated physical copy', () => {
  const spec = clone();
  spec.managedEntries.find((entry) => entry.id === 'codex-config').mode = 'SYMLINK';
  assert.throws(() => validateWorkstationConfigOwnership(spec), /codex-config must be GENERATED-COPY/);
});

test('Git-backed entries may never allow secrets', () => {
  const spec = clone();
  spec.managedEntries.find((entry) => entry.id === 'ssh-root-config').gitSecretAllowance = true;
  assert.throws(() => validateWorkstationConfigOwnership(spec), /must set gitSecretAllowance=false/);
});

test('SSH root must use native INCLUDE and preserve Thunderbolt aliases', () => {
  const includeSpec = clone();
  includeSpec.managedEntries.find((entry) => entry.id === 'ssh-root-config').mode = 'SYMLINK';
  assert.throws(() => validateWorkstationConfigOwnership(includeSpec), /ssh-root-config must use INCLUDE/);

  const aliasSpec = clone();
  aliasSpec.crossMachineContinuity.sshAliasesThatMustResolve = ['office'];
  assert.throws(() => validateWorkstationConfigOwnership(aliasSpec), /missing SSH alias MacBook/);
});

test('Codex Remote SSH preserves both application-facing Office aliases', () => {
  const aliasSpec = clone();
  aliasSpec.crossMachineContinuity.sshAliasesThatMustResolve =
    aliasSpec.crossMachineContinuity.sshAliasesThatMustResolve.filter((alias) => alias !== 'office-repos-tb');
  assert.throws(() => validateWorkstationConfigOwnership(aliasSpec), /missing SSH alias office-repos-tb/);

  const routeSpec = clone();
  routeSpec.crossMachineContinuity.codexRemoteSsh.fixedRouteAliases
    .find((entry) => entry.alias === 'office-repos-ts').host = '192.168.100.20';
  assert.throws(() => validateWorkstationConfigOwnership(routeSpec), /office-repos-ts must remain tailscale 100.86.124.66/);
});

test('tracked SSH config rejects the retired Office LAN profile', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workstation-config-lan-'));
  try {
    for (const entry of SPEC.managedEntries) {
      if (entry.id === 'ssh-root-config') continue;
      const destination = path.join(tempRoot, entry.sourcePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.symlinkSync(path.join(ROOT, entry.sourcePath), destination);
    }
    fs.mkdirSync(path.join(tempRoot, 'operations/system-configs/ssh'), { recursive: true });
    const source = fs.readFileSync(path.join(ROOT, 'operations/system-configs/ssh/config'), 'utf8');
    fs.writeFileSync(
      path.join(tempRoot, 'operations/system-configs/ssh/config'),
      `${source}\nHost office-repos-lan\n  HostName office.local\n`,
    );
    assert.throws(
      () => validateWorkstationConfigOwnership(clone(), { repoRoot: tempRoot }),
      /must not restore the retired office-repos-lan alias/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('canonical migration is plan-only and must preserve sessions/auth', () => {
  const spec = clone();
  spec.migration.liveMutationAuthorized = true;
  assert.throws(() => validateWorkstationConfigOwnership(spec), /liveMutationAuthorized must remain false/);
});

test('MacBook and Office routes remain Thunderbolt first, then fixed Tailscale', () => {
  const spec = clone();
  spec.crossMachineContinuity.routePolicy.macBookToOffice.reverse();
  assert.throws(() => validateWorkstationConfigOwnership(spec), /priority 1 must remain Thunderbolt/);

  const macBookSpec = clone();
  macBookSpec.crossMachineContinuity.macBookTailscaleAddress = '100.64.0.1';
  assert.throws(() => validateWorkstationConfigOwnership(macBookSpec), /MacBook Tailscale address must remain 100.70.12.18/);

  const officeSpec = clone();
  officeSpec.crossMachineContinuity.routePolicy.officeToMacBook[1].host = '192.168.100.22';
  assert.throws(() => validateWorkstationConfigOwnership(officeSpec), /priority 2 must remain Tailscale/);
});

test('DHCP Wi-Fi and LAN addresses are never canonical workstation routes', () => {
  const spec = clone();
  spec.crossMachineContinuity.wifiLanAddressesCanonical = true;
  assert.throws(() => validateWorkstationConfigOwnership(spec), /DHCP Wi-Fi\/LAN addresses must not become canonical/);
});

test('Codex Remote SSH requires short physical runtime root and generated config copy', () => {
  const spec = clone();
  spec.crossMachineContinuity.codexRemoteSsh.remoteRuntimeRootMustBePhysical = false;
  assert.throws(() => validateWorkstationConfigOwnership(spec), /requires a physical remote runtime root/);

  const socketSpec = clone();
  socketSpec.crossMachineContinuity.codexRemoteSsh.maxResolvedSocketPathBytes = 104;
  assert.throws(() => validateWorkstationConfigOwnership(socketSpec), /socket path limit must remain 103 bytes/);

  const configSpec = clone();
  configSpec.crossMachineContinuity.codexRemoteSsh.configTomlMode = 'SYMLINK';
  assert.throws(() => validateWorkstationConfigOwnership(configSpec), /config.toml must use GENERATED-COPY/);
});
