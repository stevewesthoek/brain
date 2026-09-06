#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { safeCodexConfigMetadata } from './infrastructure-catalog/codex-runtime-adapter.mjs';

const STORAGE_MODES = Object.freeze(['file', 'keyring', 'auto']);
const PROFILE_NAMES = Object.freeze(['personal-01', 'personal-02']);

function runProfileStatusProbe({ executable, mode, profileRoot, profileName }) {
  const result = spawnSync(executable, ['--profile', profileName, 'login', 'status', '--config', `cli_auth_credentials_store=\"${mode}\"`], {
    env: { PATH: process.env.PATH, HOME: os.homedir(), CODEX_HOME: profileRoot },
    stdio: 'ignore',
    timeout: 15_000,
    shell: false,
  });
  return { profileName, exitCode: result.status, timedOut: result.error?.code === 'ETIMEDOUT' };
}

function runEmptyProfileProbe({ executable = 'codex', mode, profileRoot }) {
  fs.writeFileSync(path.join(profileRoot, 'config.toml'), '# synthetic non-secret base config\n');
  fs.writeFileSync(path.join(profileRoot, 'personal-01.config.toml'), 'model = "gpt-5.5"\n');
  fs.writeFileSync(path.join(profileRoot, 'personal-02.config.toml'), 'model = "gpt-5.6-terra"\n');
  const result = spawnSync(executable, ['login', 'status', '--config', `cli_auth_credentials_store=\"${mode}\"`], {
    env: { PATH: process.env.PATH, HOME: os.homedir(), CODEX_HOME: profileRoot },
    stdio: 'ignore',
    timeout: 15_000,
    shell: false,
  });
  const files = fs.readdirSync(profileRoot);
  return {
    mode,
    exitCode: result.status,
    signal: result.signal,
    timedOut: result.error?.code === 'ETIMEDOUT',
    authFileCreated: files.includes('auth.json'),
    profileLayers: PROFILE_NAMES.map((profileName) => runProfileStatusProbe({ executable, mode, profileRoot, profileName })),
    profileLayerFiles: files.filter((file) => file.endsWith('.config.toml')).sort(),
    rawOutputCaptured: false,
    credentialsProvided: false,
    loginOrLogoutAttempted: false,
  };
}

export function evaluateCodexAuthProfileIsolation({ config, syntheticModes } = {}) {
  const reasons = [];
  const warnings = ['active_account_attribution_unresolved', 'multi_account_concurrency_unproven'];
  if (config?.state !== 'confirmed') reasons.push('config_metadata_unavailable');
  if (!['file', 'keyring', 'auto'].includes(config?.configuredCredentialStore)) reasons.push('storage_mode_unspecified');
  if (syntheticModes?.length !== STORAGE_MODES.length || syntheticModes.some((probe) => probe.exitCode !== 1 || probe.timedOut || probe.authFileCreated || probe.profileLayerFiles?.length !== PROFILE_NAMES.length || probe.profileLayers?.some((profile) => profile.exitCode !== 1 || profile.timedOut))) {
    reasons.push('synthetic_storage_probe_failed');
  }
  return {
    status: reasons.length === 0 ? 'OK' : 'NOT_OK',
    reasons,
    warnings,
    configuredCredentialStore: config?.configuredCredentialStore ?? null,
    storageSelection: config?.storageSelection ?? 'unknown',
    accountAttribution: 'unknown_by_supported_cli_surface',
    multiAccountReadiness: 'not_proven',
    rawSecrets: 'none',
    executionPerformed: false,
  };
}

function safeStat(file) {
  try {
    const stat = fs.statSync(file);
    return { exists: true, bytes: stat.size, mode: stat.mode & 0o777, modifiedMs: stat.mtimeMs };
  } catch (error) {
    return { exists: false, code: error?.code ?? 'stat_failed' };
  }
}

export function runCodexAuthProfileIsolationCheck({ executable = 'codex', config = safeCodexConfigMetadata() } = {}) {
  const disposableRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-codex-auth-profile-check-'));
  const liveConfigPath = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'config.toml');
  const liveConfigBefore = safeStat(liveConfigPath);
  try {
    const syntheticModes = STORAGE_MODES.map((mode) => {
      const profileRoot = path.join(disposableRoot, mode);
      fs.mkdirSync(profileRoot);
      return runEmptyProfileProbe({ executable, mode, profileRoot });
    });
    const evaluated = evaluateCodexAuthProfileIsolation({ config, syntheticModes });
    const liveConfigAfter = safeStat(liveConfigPath);
    return {
      ...evaluated,
      profileLayersHonored: evaluated.reasons.includes('synthetic_storage_probe_failed') ? false : true,
      liveConfigUntouched: JSON.stringify(liveConfigBefore) === JSON.stringify(liveConfigAfter),
    };
  } finally {
    fs.rmSync(disposableRoot, { recursive: true, force: true });
  }
}

export function exitCodeForStatus(status) {
  return status === 'OK' ? 0 : 1;
}

function main() {
  const result = runCodexAuthProfileIsolationCheck();
  console.log(`CODEX_AUTH_PROFILE_ISOLATION=${result.status}`);
  console.log(`CONFIGURED_STORAGE=${result.configuredCredentialStore ?? 'unspecified'}`);
  console.log(`ACCOUNT_ATTRIBUTION=${result.accountAttribution}`);
  console.log(`MULTI_ACCOUNT_READINESS=${result.multiAccountReadiness}`);
  console.log(`PROFILE_LAYERS_HONORED=${result.profileLayersHonored}`);
  console.log(`LIVE_CONFIG_UNTOUCHED=${result.liveConfigUntouched}`);
  if (result.reasons.length > 0) console.log(`REASONS=${result.reasons.join(',')}`);
  if (result.warnings.length > 0) console.log(`WARNINGS=${result.warnings.join(',')}`);
  console.log('RAW_SECRETS=none');
  process.exitCode = exitCodeForStatus(result.status);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
