#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
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

function main(argv) {
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
    printJson(validateCallback(callbackUrl, expectedState));
    if (!validateCallback(callbackUrl, expectedState).ok) {
      process.exit(1);
    }
    return;
  }
  if (command === 'oauth-self-test') {
    oauthSelfTest();
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

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

main(process.argv.slice(2));
