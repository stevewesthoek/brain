import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const cli = path.join(import.meta.dirname, 'credential-vault-cli.mjs');

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, BRAIN_CREDENTIAL_VAULT_ROOT: path.resolve(import.meta.dirname, '../..') } });
}

test('help exposes the complete safe operator surface and no raw-secret getter', () => {
  const output = run(['--help']);
  assert.match(output, /status\|list\|inspect/);
  assert.match(output, /add/);
  assert.match(output, /rotate/);
  assert.match(output, /verify/);
  assert.match(output, /doctor/);
  assert.doesNotMatch(output, /get-secret/);
});

test('raw secret command options are rejected before any native operation', () => {
  const syntheticFlagValue = ['synthetic', 'not', 'real'].join('-');
  const rawSecretOption = ['--', 'secret'].join('');
  const result = spawnSync(process.execPath, [cli, 'add', 'credential:synthetic', `${rawSecretOption}=${syntheticFlagValue}`, '--confirm'], { encoding: 'utf8', env: { ...process.env, BRAIN_CREDENTIAL_VAULT_ROOT: path.resolve(import.meta.dirname, '../..') } });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /raw secret options are forbidden/);
  assert.doesNotMatch(result.stdout, new RegExp(syntheticFlagValue));
});

test('operator source uses hidden native entry and does not place secrets in argv', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, 'credential-vault-cli.mjs'), 'utf8');
  const nativeSource = fs.readFileSync(path.join(import.meta.dirname, 'macos-keychain-store.swift'), 'utf8');
  assert.match(source, /interactive-create/);
  assert.match(source, /interactive-update/);
  assert.match(nativeSource, /readHiddenSecret/);
  assert.match(nativeSource, /interactive-create/);
  assert.match(nativeSource, /interactive-update/);
  assert.match(nativeSource, /tcflag_t\(ECHO\)/);
  assert.doesNotMatch(nativeSource, /kSecReturnData/);
  assert.doesNotMatch(source, /process\.env\.[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|KEY)/);
});
