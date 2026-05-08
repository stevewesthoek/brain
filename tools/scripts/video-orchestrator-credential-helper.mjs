#!/usr/bin/env node

const USAGE = `Usage:
  node tools/scripts/video-orchestrator-credential-helper.mjs validate-ref <credential_reference>
  node tools/scripts/video-orchestrator-credential-helper.mjs redact <text>
  node tools/scripts/video-orchestrator-credential-helper.mjs dry-run-keychain-read <credential_reference>
  node tools/scripts/video-orchestrator-credential-helper.mjs dry-run-keychain-write-placeholder <credential_reference>
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
