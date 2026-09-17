import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SWIFT = '/usr/bin/swift';
const SCRIPT = path.join(import.meta.dirname, 'macos-keychain-release-signer.swift');
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const MAX_INPUT = 256 * 1024;

function safe(value, label) {
  if (typeof value !== 'string' || !SEGMENT.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function invoke(command, input, options) {
  const service = safe(options.service, 'service');
  const account = safe(options.account, 'account');
  const keyId = safe(options.keyId ?? 'brain-agent-release-key-v1', 'keyId');
  if (input !== undefined && (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > MAX_INPUT)) throw new TypeError('signing input is invalid or oversized');
  const result = spawnSync(SWIFT, [SCRIPT, command, service, account, keyId], {
    cwd: '/',
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME ?? '/' },
    input: input ?? '',
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return { ok: false, code: 'SIGNER_FAILED', detail: 'Keychain signing operation failed' };
  try {
    const parsed = JSON.parse(String(result.stdout ?? ''));
    if (!parsed || parsed.ok !== true || parsed.privateKeyExported !== false || parsed.algorithm !== 'Ed25519') return { ok: false, code: 'SIGNER_RESPONSE_INVALID', detail: 'Keychain signer response was not admissible' };
    return parsed;
  } catch { return { ok: false, code: 'SIGNER_RESPONSE_INVALID', detail: 'Keychain signer response was malformed' }; }
}

export function provisionMacOSReleaseSigningIdentity(options) { return invoke('provision', undefined, options); }
export function readMacOSReleaseSigningPublicKey(options) { return invoke('public', undefined, options); }
export function signWithMacOSReleaseSigningIdentity(canonicalMaterial, options) { return invoke('sign', canonicalMaterial, options); }
