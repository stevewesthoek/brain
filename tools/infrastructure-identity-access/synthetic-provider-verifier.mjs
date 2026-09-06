#!/usr/bin/env node

import fs from 'node:fs';

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function readArguments() {
  const args = process.argv.slice(2);
  const values = { mode: 'normal', expectedPrincipal: '', requiredScopes: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--mode') values.mode = args[++index] ?? '';
    else if (arg === '--expected-principal') values.expectedPrincipal = args[++index] ?? '';
    else if (arg === '--required-scopes-json') values.requiredScopes = JSON.parse(args[++index] ?? '[]');
    else output({ resultCode: 'unknown', transportCheck: 'stdin_only', scopes: [] });
  }
  return values;
}

function parseSyntheticSecret(secret) {
  const prefix = 'brain-synthetic:v1:';
  if (!secret.startsWith(prefix)) return null;
  const remainder = secret.slice(prefix.length);
  const principalEnd = remainder.indexOf(':');
  const scopesEnd = remainder.indexOf(':', principalEnd + 1);
  const nonceStart = remainder.lastIndexOf(':');
  if (principalEnd < 1 || scopesEnd <= principalEnd + 1 || nonceStart <= scopesEnd + 1 || nonceStart >= remainder.length - 1) return null;
  return {
    principal: remainder.slice(0, principalEnd),
    scopes: remainder.slice(principalEnd + 1, scopesEnd).split(',').filter(Boolean),
    expiresAt: remainder.slice(scopesEnd + 1, nonceStart),
  };
}

async function main() {
  const values = readArguments();
  const secret = fs.readFileSync(0, 'utf8').replace(/\n$/, '');
  const transportCheck = process.argv.slice(2).some((arg) => arg.includes(secret)) ? 'argv_leak' : 'stdin_only';
  if (transportCheck !== 'stdin_only') {
    output({ resultCode: 'unknown', transportCheck, scopes: [] });
    return;
  }
  if (values.mode === 'unavailable') {
    output({ resultCode: 'provider_unavailable', transportCheck, scopes: [] });
    return;
  }
  if (values.mode === 'revoked') {
    output({ resultCode: 'revoked', transportCheck, scopes: [] });
    return;
  }
  if (values.mode === 'reauthentication_required') {
    output({ resultCode: 'reauthentication_required', transportCheck, scopes: [] });
    return;
  }
  if (values.mode === 'refresh_available') {
    output({ resultCode: 'refresh_available', transportCheck, scopes: [] });
    return;
  }
  if (values.mode === 'leak') {
    output({ resultCode: 'accepted', principal: secret, scopes: ['fixture.read'], expiresAt: '2099-01-01T00:00:00Z', refreshAvailable: false, transportCheck });
    return;
  }
  const parsed = parseSyntheticSecret(secret);
  if (!parsed) {
    output({ resultCode: 'rejected', transportCheck, scopes: [] });
    return;
  }
  output({ resultCode: 'accepted', principal: parsed.principal, scopes: parsed.scopes, expiresAt: parsed.expiresAt, refreshAvailable: false, transportCheck });
}

main().catch(() => output({ resultCode: 'unknown', transportCheck: 'stdin_only', scopes: [] }));
