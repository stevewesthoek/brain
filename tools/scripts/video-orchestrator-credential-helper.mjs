#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const USAGE = `Usage:
  node tools/scripts/video-orchestrator-credential-helper.mjs validate-ref <credential_reference>
  node tools/scripts/video-orchestrator-credential-helper.mjs redact <text>
  node tools/scripts/video-orchestrator-credential-helper.mjs dry-run-keychain-read <credential_reference>
  node tools/scripts/video-orchestrator-credential-helper.mjs dry-run-keychain-write-placeholder <credential_reference>
  node tools/scripts/video-orchestrator-credential-helper.mjs generate-pkce
  node tools/scripts/video-orchestrator-credential-helper.mjs generate-state
  node tools/scripts/video-orchestrator-credential-helper.mjs build-youtube-auth-url <config_path>
  node tools/scripts/video-orchestrator-credential-helper.mjs validate-callback <callback_url> --expected-state <state>
  node tools/scripts/video-orchestrator-credential-helper.mjs oauth-self-test
  node tools/scripts/video-orchestrator-credential-helper.mjs exchange-youtube-code <config_path> --callback-url <callback_url> --expected-state <state> --code-verifier <code_verifier> --write-to-keychain <credential_reference> --confirm-real-token-exchange --confirm-real-keychain-write
  node tools/scripts/video-orchestrator-credential-helper.mjs keychain-write-youtube-token <credential_reference> --token-json-stdin --confirm-real-keychain-write
  node tools/scripts/video-orchestrator-credential-helper.mjs keychain-read-youtube-token <credential_reference> --confirm-real-keychain-read
  node tools/scripts/video-orchestrator-credential-helper.mjs keychain-delete-youtube-token <credential_reference> --confirm-real-keychain-delete
  node tools/scripts/video-orchestrator-credential-helper.mjs token-self-test
  node tools/scripts/video-orchestrator-credential-helper.mjs self-test`;

const REDACTION_PATTERNS = [
  { regex: /\b(access[_-]?token)\b\s*[:=]\s*([^\s"'`]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, replacement: '$1=[REDACTED]' },
  { regex: /\b(refresh[_-]?token)\b\s*[:=]\s*([^\s"'`]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, replacement: '$1=[REDACTED]' },
  { regex: /\b(client[_-]?secret)\b\s*[:=]\s*([^\s"'`]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, replacement: '$1=[REDACTED]' },
  { regex: /\b(authorization[_-]?code)\b\s*[:=]\s*([^\s"'`]+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, replacement: '$1=[REDACTED]' },
  { regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },
  { regex: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, replacement: '[REDACTED PRIVATE KEY BLOCK]' },
  { regex: /\b(AIza[0-9A-Za-z_-]{10,}|sk_live_[0-9A-Za-z_-]{10,}|ghp_[0-9A-Za-z_-]{10,}|github_pat_[0-9A-Za-z_-]{10,}|xoxb-[0-9A-Za-z-]{10,}|AKIA[0-9A-Z]{12,})\b/g, replacement: '[REDACTED]' },
];

const REFERENCE_RE = /^keychain:\/\/video-orchestrator\/([a-z0-9_-]+)\/([A-Za-z0-9._-]+)$/i;
const SUPPORTED_PLATFORMS = new Set(['youtube']);
const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|::1)$/i;
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

async function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(command ? 0 : 1);
  }
  if (command === 'validate-ref') {
    const reference = args[0] ?? '';
    printJson(validateRef(reference));
    return;
  }
  if (command === 'redact') {
    const text = args.join(' ');
    process.stdout.write(redact(text));
    if (!text.endsWith('\n')) process.stdout.write('\n');
    return;
  }
  if (command === 'dry-run-keychain-read') {
    const validation = validateRef(args[0] ?? '');
    if (!validation.ok) {
      printJson(validation);
      process.exit(1);
    }
    printJson({
      ok: true,
      dry_run: true,
      would_read: true,
      service: validation.service,
      account: validation.account,
      secret_value: '[NOT_READ]',
    });
    return;
  }
  if (command === 'dry-run-keychain-write-placeholder') {
    const validation = validateRef(args[0] ?? '');
    if (!validation.ok) {
      printJson(validation);
      process.exit(1);
    }
    printJson({
      ok: true,
      dry_run: true,
      would_write: false,
      service: validation.service,
      account: validation.account,
      secret_value: '[PLACEHOLDER_NOT_WRITTEN]',
    });
    return;
  }
  if (command === 'self-test') {
    selfTest();
    return;
  }
  if (command === 'generate-pkce') {
    printJson(generatePkce());
    return;
  }
  if (command === 'generate-state') {
    printJson(generateState());
    return;
  }
  if (command === 'build-youtube-auth-url') {
    const configPath = args[0];
    if (!configPath) {
      fail('Config path is required.');
    }
    printJson(buildYoutubeAuthUrl(configPath));
    return;
  }
  if (command === 'validate-callback') {
    const callbackUrl = args[0];
    const expectedStateIndex = args.indexOf('--expected-state');
    const expectedState = expectedStateIndex >= 0 ? args[expectedStateIndex + 1] : '';
    if (!callbackUrl || !expectedState) {
      fail('validate-callback requires <callback_url> and --expected-state <state>.');
    }
    const validation = validateCallback(callbackUrl, expectedState);
    printJson(validation);
    if (!validation.ok) {
      process.exit(1);
    }
    return;
  }
  if (command === 'oauth-self-test') {
    oauthSelfTest();
    return;
  }
  if (command === 'exchange-youtube-code') {
    printJson(await exchangeYoutubeCode(args));
    return;
  }
  if (command === 'keychain-write-youtube-token') {
    printJson(writeYoutubeTokenToKeychain(args));
    return;
  }
  if (command === 'keychain-read-youtube-token') {
    printJson(readYoutubeTokenFromKeychain(args));
    return;
  }
  if (command === 'keychain-delete-youtube-token') {
    printJson(deleteYoutubeTokenFromKeychain(args));
    return;
  }
  if (command === 'token-self-test') {
    tokenSelfTest();
    return;
  }
  console.error(USAGE);
  process.exit(1);
}

function validateRef(reference) {
  if (!reference || !reference.trim()) {
    return { ok: false, error: 'Credential reference is required.' };
  }
  const match = reference.match(REFERENCE_RE);
  if (!match) {
    return { ok: false, error: 'Credential reference must match keychain://video-orchestrator/<platform>/<account-label>.' };
  }
  const platform = match[1].toLowerCase();
  const accountLabel = match[2];
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return { ok: false, error: `Unsupported platform: ${platform}.`, platform };
  }
  if (/\s/.test(accountLabel) || accountLabel.trim().length === 0) {
    return { ok: false, error: 'Account label must not be whitespace-only.' };
  }
  if (/[\\/]/.test(accountLabel) || accountLabel.includes('..')) {
    return { ok: false, error: 'Account label must not contain traversal characters.' };
  }
  if (/[;&|$`"'<>\\]/.test(accountLabel)) {
    return { ok: false, error: 'Account label contains shell-dangerous characters.' };
  }
  const service = `video-orchestrator/${platform}`;
  return {
    ok: true,
    platform,
    account_label: accountLabel,
    service,
    account: accountLabel,
  };
}

function redact(text) {
  let redacted = String(text ?? '');
  for (const { regex, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(regex, replacement);
  }
  return redacted;
}

function generatePkce() {
  const codeVerifier = base64Url(crypto.randomBytes(64));
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  return {
    ok: true,
    method: 'S256',
    code_verifier: '[GENERATED_BUT_DO_NOT_LOG_IN_PRODUCTION]',
    code_challenge: codeChallenge,
    warning: 'Do not commit or log real verifier values in production.',
  };
}

function generateState() {
  return {
    ok: true,
    state: base64Url(crypto.randomBytes(32)),
    warning: 'State must be stored only in local transient memory during real OAuth.',
  };
}

function buildYoutubeAuthUrl(configPath) {
  const config = readJsonFile(configPath);
  const errors = [];
  if (config.platform !== 'youtube') errors.push('platform must be youtube.');
  if (config.phase !== '3E-B') errors.push('phase must be 3E-B.');
  if (config.dry_run !== true) errors.push('dry_run must be true.');
  if (!isPlaceholderClientId(config.client_id)) errors.push('client_id must be placeholder-like.');
  if (!isLocalhostRedirectUri(config.redirect_uri)) errors.push('redirect_uri must be localhost-only.');
  if (config.scope !== 'https://www.googleapis.com/auth/youtube.upload') errors.push('scope must be youtube.upload.');
  const validation = validateRef(config.credential_reference ?? '');
  if (!validation.ok) errors.push(`credential_reference invalid: ${validation.error}`);
  if (errors.length) {
    return { ok: false, errors };
  }
  const pkce = createPkceMaterial();
  const state = base64Url(crypto.randomBytes(32));
  const authorizationUrl = new URL(GOOGLE_AUTH_ENDPOINT);
  authorizationUrl.searchParams.set('client_id', String(config.client_id));
  authorizationUrl.searchParams.set('redirect_uri', String(config.redirect_uri));
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', String(config.scope));
  authorizationUrl.searchParams.set('access_type', String(config.access_type ?? 'offline'));
  authorizationUrl.searchParams.set('prompt', String(config.prompt ?? 'consent'));
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', pkce.code_challenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('include_granted_scopes', 'false');
  return {
    ok: true,
    dry_run: true,
    authorization_url: authorizationUrl.toString(),
    redirect_uri: config.redirect_uri,
    scope: config.scope,
    state,
    code_challenge_method: 'S256',
    code_challenge: pkce.code_challenge,
    credential_reference_valid: true,
    next_step: 'Open URL manually only after explicit approval. Phase 3E-B does not exchange tokens.',
  };
}

function validateCallback(callbackUrl, expectedState) {
  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, error: 'Callback URL is malformed.' };
  }
  if (!LOCALHOST_RE.test(parsed.hostname)) {
    return { ok: false, error: 'Callback host must be localhost only.' };
  }
  if (parsed.pathname !== '/oauth/youtube/callback') {
    return { ok: false, error: 'Callback path must be /oauth/youtube/callback.' };
  }
  const state = parsed.searchParams.get('state') ?? '';
  if (state !== expectedState) {
    return { ok: false, error: 'State mismatch.', state_valid: false, authorization_code_present: parsed.searchParams.has('code') };
  }
  const codePresent = parsed.searchParams.has('code');
  return {
    ok: true,
    state_valid: true,
    authorization_code_present: codePresent,
    token_exchange_performed: false,
    message: 'Callback shape is valid. Phase 3E-B does not exchange authorization codes.',
  };
}

function oauthSelfTest() {
  const pkce = createPkceMaterial();
  if (!pkce.code_verifier || pkce.code_verifier.length < 43 || pkce.code_verifier.length > 128) {
    throw new Error('PKCE verifier shape invalid.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(pkce.code_challenge)) {
    throw new Error('PKCE challenge shape invalid.');
  }
  const state = generateState();
  if (!state.ok || typeof state.state !== 'string' || state.state.length < 16) {
    throw new Error('State generation failed.');
  }
  const fixturePath = path.join(process.cwd(), 'operations/specs/video-orchestrator/examples/sample-youtube-oauth-setup-config.json');
  const authUrlResult = buildYoutubeAuthUrl(fixturePath);
  if (!authUrlResult.ok || !authUrlResult.authorization_url || !authUrlResult.state) {
    throw new Error('Authorization URL build failed.');
  }
  const callbackOk = validateCallback(`http://127.0.0.1:8765/oauth/youtube/callback?code=fake-code&state=${authUrlResult.state}`, authUrlResult.state);
  if (!callbackOk.ok || callbackOk.authorization_code_present !== true || callbackOk.token_exchange_performed !== false) {
    throw new Error('Callback happy path failed.');
  }
  const callbackBad = validateCallback(`http://127.0.0.1:8765/oauth/youtube/callback?code=fake-code&state=wrong`, authUrlResult.state);
  if (callbackBad.ok || !String(callbackBad.error ?? '').includes('State mismatch')) {
    throw new Error('Callback mismatch check failed.');
  }
  const redacted = redact('authorization_code=fake-code Bearer tok private key BEGIN PRIVATE KEY');
  if (/fake-code|tok/.test(redacted)) {
    throw new Error('Redaction leaked test values.');
  }
  console.log(JSON.stringify({
    ok: true,
    checked: ['generate-pkce', 'generate-state', 'build-youtube-auth-url', 'validate-callback'],
    authorization_url_preview: String(authUrlResult.authorization_url).replace(authUrlResult.state, '[REDACTED_STATE]').slice(0, 180),
    callback_state_validated: callbackOk.state_valid,
    redacted_preview: redacted.slice(0, 120),
  }, null, 2));
}

function exchangeYoutubeCode(args) {
  const configPath = args[0];
  const callbackUrl = readFlag(args, '--callback-url');
  const expectedState = readFlag(args, '--expected-state');
  const codeVerifier = readFlag(args, '--code-verifier');
  const writeToKeychain = readFlag(args, '--write-to-keychain');
  const confirmTokenExchange = args.includes('--confirm-real-token-exchange');
  const confirmKeychainWrite = args.includes('--confirm-real-keychain-write');
  if (!configPath || !callbackUrl || !expectedState || !codeVerifier) {
    return { ok: false, error: 'exchange-youtube-code requires config path, callback URL, state, and code verifier.' };
  }
  if (!confirmTokenExchange) {
    return { ok: false, error: 'Missing --confirm-real-token-exchange. Refusing to exchange authorization code.' };
  }
  if (!writeToKeychain) {
    return {
      ok: false,
      error: 'Missing --write-to-keychain. Phase 3E-C requires direct-to-Keychain exchange to avoid raw token output.',
      next_step: 'Re-run with --write-to-keychain keychain://video-orchestrator/youtube/<account> --confirm-real-keychain-write.',
    };
  }
  if (!confirmKeychainWrite) {
    return { ok: false, error: 'Missing --confirm-real-keychain-write. Refusing to write token to Keychain.' };
  }
  const config = readJsonFile(configPath);
  const callbackValidation = validateCallback(callbackUrl, expectedState);
  const configErrors = validateYoutubeTokenExchangeConfig(config);
  const pkceError = validatePkceVerifier(codeVerifier);
  const credentialValidation = validateRef(writeToKeychain);
  const callbackCode = extractAuthorizationCode(callbackUrl);
  if (!callbackValidation.ok || !configErrors.ok || !pkceError.ok || !credentialValidation.ok || !callbackCode.present) {
    return {
      ok: false,
      error: 'Token exchange prerequisites failed.',
      callback: callbackValidation,
      config: configErrors,
      pkce: pkceError,
      credential_reference: credentialValidation,
      authorization_code_present: callbackCode.present,
    };
  }
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams();
  body.set('client_id', String(config.client_id));
  body.set('code', callbackCode.value);
  body.set('code_verifier', codeVerifier);
  body.set('grant_type', 'authorization_code');
  body.set('redirect_uri', String(config.redirect_uri));
  if (Object.prototype.hasOwnProperty.call(config, 'client_secret') && config.client_secret) {
    body.set('client_secret', String(config.client_secret));
  }
  return fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  }).then(async (response) => {
    if (!response.ok) {
      return {
        ok: false,
        error: `Token endpoint returned HTTP ${response.status}.`,
        token_received: false,
        token_exchange_performed: true,
      };
    }
    const tokenJson = await response.json();
    const writeResult = writeYoutubeTokenToKeychain([
      writeToKeychain,
      '--token-json-stdin',
      '--confirm-real-keychain-write',
    ], JSON.stringify(tokenJson));
    if (!writeResult.ok) {
      return {
        ok: false,
        error: 'Token exchange succeeded but Keychain write failed.',
        token_received: true,
        keychain_write: writeResult,
      };
    }
    return {
      ok: true,
      platform: 'youtube',
      credential_reference: '[REDACTED_REFERENCE]',
      token_received: true,
      access_token_present: Boolean(tokenJson.access_token),
      refresh_token_present: Boolean(tokenJson.refresh_token),
      expires_in_present: Object.prototype.hasOwnProperty.call(tokenJson, 'expires_in'),
      scope: tokenJson.scope ?? null,
      token_type: tokenJson.token_type ?? null,
      keychain_write: writeResult,
      next_step: 'Token stored in macOS Keychain. Do not save raw token JSON to disk.',
    };
  }).catch((error) => ({
    ok: false,
    error: redact(error instanceof Error ? error.message : String(error)),
    token_received: false,
    token_exchange_performed: true,
  }));
}

function writeYoutubeTokenToKeychain(args, tokenJsonInput) {
  const credentialReference = args[0];
  const confirmWrite = args.includes('--confirm-real-keychain-write');
  const tokenStdin = args.includes('--token-json-stdin');
  if (!credentialReference) {
    return { ok: false, error: 'Credential reference is required.' };
  }
  if (!confirmWrite) {
    return { ok: false, error: 'Missing --confirm-real-keychain-write. Refusing to write to Keychain.' };
  }
  if (!tokenStdin && !tokenJsonInput) {
    return { ok: false, error: 'Token JSON input is required.' };
  }
  const validation = validateRef(credentialReference);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const tokenJson = typeof tokenJsonInput === 'string' ? tokenJsonInput : readStdin();
  let parsed;
  try {
    parsed = JSON.parse(tokenJson);
  } catch {
    return { ok: false, error: 'Token JSON was not valid JSON.' };
  }
  const summary = {
    ok: true,
    stored: false,
    service: validation.service,
    account: validation.account,
    access_token_present: Boolean(parsed.access_token),
    refresh_token_present: Boolean(parsed.refresh_token),
    token_value_printed: false,
  };
  const existing = readKeychainItem(validation.service, validation.account, true);
  const payload = JSON.stringify(parsed);
  const argsForSecurity = buildKeychainAddArgs(validation.service, validation.account, payload);
  if (existing.ok && existing.found) {
    summary.updated = true;
  }
  execFileSync('security', argsForSecurity, { stdio: ['ignore', 'pipe', 'pipe'] });
  summary.stored = true;
  return summary;
}

function readYoutubeTokenFromKeychain(args) {
  const credentialReference = args[0];
  const confirmRead = args.includes('--confirm-real-keychain-read');
  if (!credentialReference) {
    return { ok: false, error: 'Credential reference is required.' };
  }
  if (!confirmRead) {
    return { ok: false, error: 'Missing --confirm-real-keychain-read. Refusing to read Keychain.' };
  }
  const validation = validateRef(credentialReference);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const found = readKeychainItem(validation.service, validation.account, false);
  if (!found.ok) {
    return found;
  }
  if (!found.found) {
    return { ok: true, found: false, service: validation.service, account: validation.account };
  }
  let parsed;
  try {
    parsed = JSON.parse(found.value);
  } catch {
    return { ok: false, error: 'Stored token payload was not valid JSON.', found: true, service: validation.service, account: validation.account };
  }
  return {
    ok: true,
    found: true,
    service: validation.service,
    account: validation.account,
    access_token_present: Boolean(parsed.access_token),
    refresh_token_present: Boolean(parsed.refresh_token),
    expires_in_present: Object.prototype.hasOwnProperty.call(parsed, 'expires_in'),
    scope: parsed.scope ?? null,
    token_value_printed: false,
  };
}

function deleteYoutubeTokenFromKeychain(args) {
  const credentialReference = args[0];
  const confirmDelete = args.includes('--confirm-real-keychain-delete');
  if (!credentialReference) {
    return { ok: false, error: 'Credential reference is required.' };
  }
  if (!confirmDelete) {
    return { ok: false, error: 'Missing --confirm-real-keychain-delete. Refusing to delete Keychain entry.' };
  }
  const validation = validateRef(credentialReference);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  try {
    execFileSync('security', ['delete-generic-password', '-s', validation.service, '-a', validation.account], { stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, deleted: true, service: validation.service, account: validation.account };
  } catch (error) {
    const stderr = error?.stderr ? redact(error.stderr.toString('utf8')) : null;
    return { ok: false, error: stderr || 'Keychain delete failed.', deleted: false, service: validation.service, account: validation.account };
  }
}

function tokenSelfTest() {
  const sampleConfig = {
    platform: 'youtube',
    phase: '3E-C',
    client_id: 'YOUR_CLIENT_ID_PLACEHOLDER.apps.googleusercontent.com',
    client_secret_policy: 'not_stored_in_repo',
    redirect_uri: 'http://127.0.0.1:8765/oauth/youtube/callback',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    credential_reference: 'keychain://video-orchestrator/youtube/example-account-placeholder',
    real_token_exchange_enabled: false,
    real_keychain_write_enabled: false,
    real_upload_enabled: false,
    notes: [
      'Use real values only at runtime through local config outside the repo.',
      'Do not commit real client secrets or token responses.',
      'Prefer exchange directly to Keychain rather than printing raw token JSON.',
    ],
  };
  const configValid = sampleConfig;
  if (configValid.phase !== '3E-C') throw new Error('Sample token exchange config invalid.');
  const missingConfirm = exchangeYoutubeCode([
    'in-memory-sample-config',
    '--callback-url',
    'http://127.0.0.1:8765/oauth/youtube/callback?code=fake-code&state=fake-state',
    '--expected-state',
    'fake-state',
    '--code-verifier',
    'fake-verifier',
  ]);
  if (missingConfirm.ok || !String(missingConfirm.error ?? '').includes('confirm-real-token-exchange')) {
    throw new Error('Exchange refusal without confirmation failed.');
  }
  const callbackValidation = validateCallback('http://127.0.0.1:8765/oauth/youtube/callback?code=fake-code&state=fake-state', 'fake-state');
  if (!callbackValidation.ok || callbackValidation.authorization_code_present !== true) {
    throw new Error('Callback validation failed.');
  }
  const redacted = redact('access_token=one refresh_token=two client_secret=three authorization_code=four');
  if (['one', 'two', 'three', 'four'].some((value) => redacted.includes(value))) {
    throw new Error('Token redaction failed.');
  }
  const validator = validateRef('keychain://video-orchestrator/youtube/example-account-placeholder');
  if (!validator.ok) throw new Error('Credential reference validation failed.');
  const badRef = validateRef('keychain://video-orchestrator/vimeo/example-account');
  if (badRef.ok) throw new Error('Unsupported credential reference unexpectedly passed.');
  const addArgs = buildKeychainAddArgs('video-orchestrator/youtube', 'example-account-placeholder', '{"ok":true}');
  const findArgs = buildKeychainFindArgs('video-orchestrator/youtube', 'example-account-placeholder');
  if (!Array.isArray(addArgs) || !Array.isArray(findArgs)) {
    throw new Error('Keychain command builders must return argv arrays.');
  }
  if (addArgs.some((item) => typeof item !== 'string') || findArgs.some((item) => typeof item !== 'string')) {
    throw new Error('Keychain command builders returned non-string argv items.');
  }
  console.log(JSON.stringify({
    ok: true,
    checked: ['exchange-youtube-code', 'keychain-write-youtube-token', 'keychain-read-youtube-token', 'keychain-delete-youtube-token'],
    confirm_gate_refusal: missingConfirm.ok === false,
    callback_redaction_ok: !redacted.includes('four'),
    sample_config_placeholder: true,
  }, null, 2));
}

function createPkceMaterial() {
  const codeVerifier = base64Url(crypto.randomBytes(64));
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  return {
    code_verifier: codeVerifier,
    code_challenge: codeChallenge,
  };
}

function isPlaceholderClientId(clientId) {
  const value = String(clientId ?? '');
  return /placeholder|YOUR_CLIENT_ID/i.test(value);
}

function isLocalhostRedirectUri(redirectUri) {
  try {
    const parsed = new URL(String(redirectUri ?? ''));
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && LOCALHOST_RE.test(parsed.hostname) && parsed.pathname === '/oauth/youtube/callback';
  } catch {
    return false;
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function readKeychainItem(service, account, suppressNotFound = false) {
  try {
    const stdout = execFileSync('security', buildKeychainFindArgs(service, account), { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
    return { ok: true, found: true, value: stdout.trim(), service, account };
  } catch (error) {
    const stderr = error?.stderr ? error.stderr.toString('utf8') : '';
    if (/could not be found|not found/i.test(stderr)) {
      return { ok: true, found: false, service, account };
    }
    if (suppressNotFound) {
      return { ok: true, found: false, service, account };
    }
    return { ok: false, error: redact(stderr || 'Keychain read failed.'), found: false, service, account };
  }
}

function buildKeychainAddArgs(service, account, tokenJson) {
  return ['add-generic-password', '-U', '-s', service, '-a', account, '-w', tokenJson];
}

function buildKeychainFindArgs(service, account) {
  return ['find-generic-password', '-s', service, '-a', account, '-w'];
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function readFlag(args, flagName) {
  const index = args.indexOf(flagName);
  return index >= 0 ? args[index + 1] : '';
}

function validatePkceVerifier(codeVerifier) {
  const value = String(codeVerifier ?? '');
  if (value.length < 43 || value.length > 128) return { ok: false, error: 'code_verifier must be 43-128 chars.' };
  if (!/^[A-Za-z0-9._~-]+$/.test(value)) return { ok: false, error: 'code_verifier has invalid characters.' };
  return { ok: true };
}

function extractAuthorizationCode(callbackUrl) {
  const parsed = new URL(String(callbackUrl));
  const code = parsed.searchParams.get('code');
  return { present: Boolean(code), value: code ?? '' };
}

function validateYoutubeTokenExchangeConfig(config) {
  const errors = [];
  if (config.platform !== 'youtube') errors.push('platform must be youtube.');
  if (!isLocalhostRedirectUri(config.redirect_uri)) errors.push('redirect_uri must be localhost-only.');
  if (config.scope !== 'https://www.googleapis.com/auth/youtube.upload') errors.push('scope must be youtube.upload.');
  const validation = validateRef(config.credential_reference ?? '');
  if (!validation.ok) errors.push(`credential_reference invalid: ${validation.error}`);
  if (!config.client_id) errors.push('client_id is required.');
  return errors.length ? { ok: false, errors } : { ok: true };
}

function fail(message) {
  printJson({ ok: false, error: message });
  process.exit(1);
}

function selfTest() {
  const valid = validateRef('keychain://video-orchestrator/youtube/example-account-placeholder');
  if (!valid.ok || valid.platform !== 'youtube' || valid.account_label !== 'example-account-placeholder') {
    throw new Error('validate-ref happy path failed.');
  }
  const invalid = validateRef('keychain://video-orchestrator/vimeo/example-account');
  if (invalid.ok || !String(invalid.error ?? '').includes('Unsupported platform')) {
    throw new Error('validate-ref unsupported platform check failed.');
  }
  const sample = [
    'access_token=abc123',
    'refresh_token: "def456"',
    'client_secret=ghi789',
    'authorization_code=xyz',
    'Bearer ya29.fake-token',
    '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----',
    'AIzaFakeApiKey0123456789',
  ].join('\n');
  const redacted = redact(sample);
  const forbidden = ['abc123', 'def456', 'ghi789', 'xyz', 'ya29.fake-token', 'FAKE', 'AIzaFakeApiKey0123456789'];
  for (const value of forbidden) {
    if (redacted.includes(value)) {
      throw new Error(`redaction failed for ${value}`);
    }
  }
  if (!/REDACTED/.test(redacted)) {
    throw new Error('redaction did not redact expected values.');
  }
  const readPlan = JSON.parse(runAsText(['dry-run-keychain-read', 'keychain://video-orchestrator/youtube/example-account-placeholder']));
  if (readPlan.secret_value !== '[NOT_READ]' || readPlan.ok !== true) {
    throw new Error('dry-run-keychain-read failed.');
  }
  const writePlan = JSON.parse(runAsText(['dry-run-keychain-write-placeholder', 'keychain://video-orchestrator/youtube/example-account-placeholder']));
  if (writePlan.secret_value !== '[PLACEHOLDER_NOT_WRITTEN]' || writePlan.ok !== true) {
    throw new Error('dry-run-keychain-write-placeholder failed.');
  }
  console.log(JSON.stringify({
    ok: true,
    checked: ['validate-ref', 'redact', 'dry-run-keychain-read', 'dry-run-keychain-write-placeholder'],
    redacted_preview: redacted.slice(0, 120),
  }, null, 2));
}

function runAsText(args) {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let captured = '';
  process.stdout.write = ((chunk, encoding, callback) => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : 'utf8');
    if (typeof callback === 'function') callback();
    return true;
  });
  try {
    main(args);
    return captured;
  } finally {
    process.stdout.write = originalWrite;
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main(process.argv.slice(2)).catch((error) => {
  printJson({ ok: false, error: redact(error instanceof Error ? error.message : String(error)) });
  process.exit(1);
});
