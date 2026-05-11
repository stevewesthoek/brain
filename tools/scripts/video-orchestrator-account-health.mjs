#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const REFERENCE_RE = /^keychain:\/\/video-orchestrator\/([a-z0-9_-]+)\/([A-Za-z0-9._-]+)$/i;
const TOKEN_HELPER = path.resolve(REPO_ROOT, 'tools/scripts/video-orchestrator-credential-helper.mjs');
const DEFAULT_DB_URL = process.env.VIDEO_ORCHESTRATOR_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5450/video_orchestrator';
const DEFAULT_LOCAL_REGISTRY_PATH = path.resolve(REPO_ROOT, 'runtime/local/video-orchestrator/account-registry.local.json');
const DEFAULT_SNAPSHOT_PATH = path.resolve(REPO_ROOT, 'runtime/local/video-orchestrator/account-health-snapshot.json');
const DEFAULT_LOG_PATH = path.resolve(REPO_ROOT, 'runtime/local/video-orchestrator/account-health.log');
const SUPPORTED_CREDENTIAL_PLATFORMS = new Set(['youtube', 'bluesky', 'instagram']);
const SECRET_KEY_RE = /(access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization[_-]?code|credential[_-]?reference|keychain|bearer|api[_-]?key|password|cookie)/i;
const SECRET_VALUE_RE = /\b(AIza[0-9A-Za-z_-]{10,}|sk_live_[0-9A-Za-z_-]{10,}|ghp_[0-9A-Za-z_-]{10,}|github_pat_[0-9A-Za-z_-]{10,}|xoxb-[0-9A-Za-z-]{10,}|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/;
const TOKEN_ASSIGNMENT_RE = /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization[_-]?code)\b\s*[:=]\s*[^\s"'`]+/i;

main(process.argv.slice(2)).catch((err) => fail(String(err?.message ?? err)));

async function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === '-h') {
    printJson({
      ok: true,
      usage: [
        'print-default-paths',
        'init-local-registry [--from <example_path>] [--to <local_path>] [--force]',
        'validate-registry <registry_path>',
        'check-account <registry_path> <account_id> --dry-run [--write-snapshot <path>]',
        'check-all <registry_path> --dry-run [--write-snapshot <path>]',
        'write-nightly-snapshot <registry_path> --dry-run [--snapshot <path>]',
        'readiness-youtube-private-upload <registry_path> <account_id> --video-id <video_id> --package-target <target> --dry-run [--write-snapshot <path>]',
        'self-test',
      ],
    });
    process.exit(command ? 0 : 1);
  }

  if (command === 'print-default-paths') {
    printJson({
      ok: true,
      operator_registry: DEFAULT_LOCAL_REGISTRY_PATH,
      account_health_snapshot: DEFAULT_SNAPSHOT_PATH,
      account_health_log: DEFAULT_LOG_PATH,
    });
    return;
  }

  if (command === 'init-local-registry') {
    const fromPath = readOption(args, '--from') ?? 'operations/specs/video-orchestrator/examples/account-registry.example.json';
    const toPath = readOption(args, '--to') ?? DEFAULT_LOCAL_REGISTRY_PATH;
    const force = args.includes('--force');
    printJson(initLocalRegistry(fromPath, toPath, force));
    return;
  }

  if (command === 'validate-registry') {
    const registryPath = args[0];
    if (!registryPath) fail('Registry path is required.');
    printJson(validateRegistryFile(registryPath));
    return;
  }

  if (command === 'check-account') {
    const registryPath = args[0];
    const accountId = args[1];
    const dryRun = args.includes('--dry-run');
    const snapshotPath = readOption(args, '--write-snapshot');
    if (!registryPath || !accountId) fail('check-account requires <registry_path> <account_id> --dry-run.');
    if (!dryRun) fail('check-account requires --dry-run.');
    const result = await evaluateRegistry(registryPath, { accountId, dryRun: true, writeSnapshotPath: snapshotPath ?? null });
    printJson(result);
    return;
  }

  if (command === 'check-all') {
    const registryPath = args[0];
    const dryRun = args.includes('--dry-run');
    const snapshotPath = readOption(args, '--write-snapshot');
    if (!registryPath) fail('check-all requires <registry_path> --dry-run.');
    if (!dryRun) fail('check-all requires --dry-run.');
    const result = await evaluateRegistry(registryPath, { dryRun: true, writeSnapshotPath: snapshotPath ?? null });
    printJson(result);
    return;
  }

  if (command === 'write-nightly-snapshot') {
    const registryPath = args[0];
    const dryRun = args.includes('--dry-run');
    const snapshotPath = readOption(args, '--snapshot') ?? DEFAULT_SNAPSHOT_PATH;
    if (!registryPath) fail('write-nightly-snapshot requires <registry_path> --dry-run.');
    if (!dryRun) fail('write-nightly-snapshot requires --dry-run.');
    const result = await evaluateRegistry(registryPath, { dryRun: true, writeSnapshotPath: snapshotPath });
    printJson({
      ok: result.ok,
      status: result.status,
      summary: result.summary,
      snapshot_written: result.snapshot_written,
      checked_at: result.summary ? new Date().toISOString() : null,
      message: result.ok ? 'Nightly account-health snapshot written.' : 'Nightly account-health snapshot not written.',
      errors: result.ok ? undefined : result.errors,
    });
    return;
  }

  if (command === 'readiness-youtube-private-upload') {
    const registryPath = args[0];
    const accountId = args[1];
    const videoId = readOption(args, '--video-id');
    const packageTarget = readOption(args, '--package-target');
    const dryRun = args.includes('--dry-run');
    const snapshotPath = readOption(args, '--write-snapshot');
    if (!registryPath || !accountId || !videoId || !packageTarget) fail('readiness-youtube-private-upload requires <registry_path> <account_id> --video-id <video_id> --package-target <target> --dry-run.');
    if (!dryRun) fail('readiness-youtube-private-upload requires --dry-run.');
    const result = await evaluatePrivateUploadReadiness(registryPath, accountId, videoId, packageTarget, { writeSnapshotPath: snapshotPath ?? null });
    printJson(result);
    return;
  }

  if (command === 'self-test') {
    await selfTest();
    return;
  }

  fail(`Unknown command: ${command}`);
}

function validateRegistryFile(registryPath) {
  const registry = readJson(registryPath);
  const errors = [];
  if (!registry || typeof registry !== 'object') errors.push('Registry must be a JSON object.');
  if (registry?.schema_version !== '1.0') errors.push('schema_version must be 1.0.');
  if (!Array.isArray(registry?.accounts) || registry.accounts.length === 0) errors.push('accounts must be a non-empty array.');

  const accounts = Array.isArray(registry?.accounts) ? registry.accounts : [];
  for (const account of accounts) {
    errors.push(...validateAccountShape(account).errors);
    errors.push(...scanForSecretLikeValues(account).map((item) => `account.${item.path}: ${item.reason}`));
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, schema_version: registry.schema_version, account_count: accounts.length };
}

function validateAccountShape(account) {
  const errors = [];
  if (!account || typeof account !== 'object') return { errors: ['Account entries must be objects.'] };
  const authMode = String(account.auth_mode ?? '');
  const platform = String(account.platform ?? '');
  const credentialReference = getCredentialReference(account);
  const allowedPrivacy = Array.isArray(account.allowed_privacy) ? account.allowed_privacy.map((value) => String(value)) : [];
  if (!String(account.account_id ?? '').trim()) errors.push('account_id is required.');
  if (!platform) errors.push('platform is required.');
  if (!String(account.account_label ?? '').trim()) errors.push('account_label is required.');
  if (!String(account.display_name ?? '').trim()) errors.push('display_name is required.');
  if (!['oauth', 'api_key', 'app_password', 'browser_assisted', 'manual_only'].includes(authMode)) errors.push(`auth_mode is invalid: ${authMode}`);
  if (['oauth', 'api_key', 'app_password', 'browser_assisted'].includes(authMode)) {
    if (!credentialReference) errors.push('credential_reference is required for credential-backed accounts.');
    else if (!validateReference(credentialReference).ok) errors.push(`credential_reference invalid: ${validateReference(credentialReference).error}`);
  }
  if (authMode === 'manual_only' && credentialReference) errors.push('manual_only accounts must not define credential_reference.');
  if (!account.capabilities || typeof account.capabilities !== 'object') errors.push('capabilities must be an object.');
  if (!account.health_check || typeof account.health_check !== 'object') errors.push('health_check must be an object.');
  if (!account.notification_policy || typeof account.notification_policy !== 'object') errors.push('notification_policy must be an object.');
  if (platform === 'youtube') {
    if (String(account.default_privacy ?? '') !== 'private') errors.push('YouTube default_privacy must be private.');
    if (allowedPrivacy.length === 0 || allowedPrivacy.some((value) => value !== 'private')) errors.push('YouTube allowed_privacy must be private only.');
  }
  return { errors };
}

function validateReference(reference) {
  if (!reference || !String(reference).trim()) return { ok: false, error: 'Credential reference is required.' };
  const match = String(reference).match(REFERENCE_RE);
  if (!match) return { ok: false, error: 'Credential reference must match keychain://video-orchestrator/<platform>/<account-label>.' };
  const platform = match[1].toLowerCase();
  const accountLabel = match[2];
  if (!SUPPORTED_CREDENTIAL_PLATFORMS.has(platform)) {
    return { ok: false, error: `Unsupported credential reference platform: ${platform}.` };
  }
  if (!accountLabel.trim()) return { ok: false, error: 'Account label must not be empty.' };
  if (/\s/.test(accountLabel)) return { ok: false, error: 'Account label must not contain whitespace.' };
  if (/[\\/]/.test(accountLabel) || accountLabel.includes('..')) return { ok: false, error: 'Account label must not contain traversal characters.' };
  if (/[;&|$`"'<>\\]/.test(accountLabel)) return { ok: false, error: 'Account label contains shell-dangerous characters.' };
  return { ok: true, platform, account: accountLabel };
}

async function evaluateRegistry(registryPath, options = {}) {
  const registry = readJson(registryPath);
  const validation = validateRegistryFile(registryPath);
  if (!validation.ok) {
    return { ok: false, status: 'red', errors: validation.errors, accounts: [], summary: buildSummary([]) };
  }
  const accounts = Array.isArray(registry.accounts) ? registry.accounts : [];
  const selected = options.accountId ? accounts.filter((account) => String(account.account_id ?? '') === options.accountId) : accounts;
  const evaluated = [];
  for (const account of selected) {
    evaluated.push(await evaluateAccount(account, { dryRun: true }));
  }
  const snapshot = buildSnapshot(evaluated);
  if (options.writeSnapshotPath) writeSnapshot(options.writeSnapshotPath, snapshot);
  return { ok: true, status: overallStatus(evaluated), accounts: evaluated, summary: buildSummary(evaluated), snapshot_written: Boolean(options.writeSnapshotPath) };
}

function initLocalRegistry(fromPath, toPath, force) {
  const sourcePath = String(fromPath || '').trim();
  const targetPath = String(toPath || '').trim();
  if (!sourcePath) return { ok: false, error: 'Source registry path is required.' };
  if (!targetPath) return { ok: false, error: 'Target registry path is required.' };
  if (fs.existsSync(targetPath) && !force) {
    return { ok: false, error: 'Local registry already exists. Use --force to overwrite.' };
  }
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    const validation = validateRegistryFile(targetPath);
    if (!validation.ok) {
      fs.unlinkSync(targetPath);
      return { ok: false, error: 'Copied registry failed validation.', errors: validation.errors };
    }
    return {
      ok: true,
      created: true,
      path: targetPath,
      next_step: 'Edit this local file with your real account labels and credential references. Do not commit it.',
    };
  } catch (err) {
    return { ok: false, error: redactText(String(err)) };
  }
}

async function evaluatePrivateUploadReadiness(registryPath, accountId, videoId, packageTarget, options = {}) {
  const registryResult = await evaluateRegistry(registryPath, { accountId, dryRun: true });
  const account = registryResult.accounts[0];
  if (!account) {
    return {
      ok: false,
      safe_to_run_private_upload: false,
      requires_manual_confirmation: true,
      database_reachable: false,
      package_target_present: false,
      package_target_upload_ready: false,
      account_status: 'red',
      message: 'Account not found.',
    };
  }
  const db = await checkDatabaseAndPackage(videoId, packageTarget);
  const safe = registryResult.status !== 'red'
    && db.package_target_present
    && db.package_target_upload_ready
    && account.status === 'green'
    && account.enabled === true
    && account.auth_mode === 'oauth'
    && account.capabilities.manual_fallback === true
    && account.platform === 'youtube'
    && Array.isArray(account.allowed_privacy)
    && account.allowed_privacy.length === 1
    && account.allowed_privacy[0] === 'private';
  const snapshot = {
    version: '1.0',
    checked_at: new Date().toISOString(),
    accounts: registryResult.accounts.map(redactAccountForSnapshot),
    summary: registryResult.summary,
  };
  if (options.writeSnapshotPath) writeSnapshot(options.writeSnapshotPath, snapshot);
  return {
    ok: true,
    safe_to_run_private_upload: Boolean(safe),
    requires_manual_confirmation: true,
    database_reachable: db.database_reachable,
    package_target_present: db.package_target_present,
    package_target_upload_ready: db.package_target_upload_ready,
    account_status: account.status,
    last_checked_at: new Date().toISOString(),
    platform: account.platform,
    account_id: account.account_id,
    display_name: account.display_name,
    auth_mode: account.auth_mode,
    manual_fallback_available: Boolean(account.capabilities.manual_fallback),
    next_action: account.next_action,
    warnings: [...(Array.isArray(account.warnings) ? account.warnings : []), ...db.warnings],
  };
}

async function evaluateAccount(account, options = {}) {
  const authMode = String(account.auth_mode ?? '');
  const base = {
    account_id: String(account.account_id ?? ''),
    platform: String(account.platform ?? ''),
    account_label: String(account.account_label ?? ''),
    display_name: String(account.display_name ?? ''),
    auth_mode: authMode,
    enabled: Boolean(account.enabled),
    capabilities: {
      upload: Boolean(account.capabilities?.upload),
      status_check: Boolean(account.capabilities?.status_check),
      refresh_supported: Boolean(account.capabilities?.refresh_supported ?? account.capabilities?.refresh_token),
      analytics: Boolean(account.capabilities?.analytics),
      manual_fallback: Boolean(account.capabilities?.manual_fallback),
    },
    default_privacy: String(account.default_privacy ?? 'private'),
    allowed_privacy: Array.isArray(account.allowed_privacy) ? account.allowed_privacy.map((value) => String(value)) : [],
    manual_fallback: Boolean(account.capabilities?.manual_fallback),
    notification_state: account.notification_policy?.channel ? String(account.notification_policy.channel) : 'dashboard',
    last_checked_at: null,
    next_action: 'No action required.',
    status: 'grey',
    warnings: [],
  };

  if (authMode === 'manual_only' || !base.enabled) {
    return {
      ...base,
      status: 'grey',
      next_action: 'Manual fallback available.',
      warnings: base.enabled ? [] : ['Account is disabled.'],
    };
  }

  const credentialReference = getCredentialReference(account);
  const referenceValidation = validateReference(credentialReference);
  if (!referenceValidation.ok) {
    return {
      ...base,
      status: 'red',
      next_action: 'Fix the credential reference before scheduling uploads.',
      warnings: [referenceValidation.error],
    };
  }

  if (!options.dryRun) {
    return {
      ...base,
      status: 'yellow',
      next_action: 'Dry-run only in this phase.',
      warnings: ['Live credential checks are intentionally not enabled.'],
    };
  }

  const summary = readYoutubeTokenSummary(credentialReference);
  if (!summary.ok) {
    return {
      ...base,
      status: 'red',
      next_action: 'Re-run the helper or repair the Keychain entry.',
      warnings: [summary.error || 'Credential summary failed.'],
    };
  }
  if (!summary.found) {
    return {
      ...base,
      status: 'red',
      next_action: 'Provision the Keychain credential before scheduling uploads.',
      warnings: ['No credential payload found in Keychain.'],
      last_checked_at: new Date().toISOString(),
    };
  }
  if (summary.scope_youtube_upload_present !== true) {
    return {
      ...base,
      status: 'red',
      next_action: 'Refresh the credential with the YouTube upload scope.',
      warnings: ['Required YouTube upload scope is missing.'],
      last_checked_at: new Date().toISOString(),
    };
  }
  if (!summary.access_token_present) {
    return {
      ...base,
      status: summary.refresh_token_present ? 'yellow' : 'red',
      next_action: summary.refresh_token_present ? 'Run a token refresh or prepare a fresh login.' : 'Provision a usable access token.',
      warnings: summary.refresh_token_present ? ['Access token is missing but refresh token exists.'] : ['No access token found.'],
      last_checked_at: new Date().toISOString(),
    };
  }
  const yellowWarnings = [];
  if (!summary.refresh_token_present) yellowWarnings.push('Refresh token is missing.');
  if (!summary.expires_in_present) yellowWarnings.push('Token expiry metadata is missing.');
  return {
    ...base,
    status: yellowWarnings.length ? 'yellow' : 'green',
    next_action: yellowWarnings.length ? 'Run a private upload soon and refresh credentials if needed.' : 'Ready for a manual-confirmed private upload.',
    warnings: yellowWarnings,
    last_checked_at: new Date().toISOString(),
  };
}

function buildSummary(accounts) {
  const summary = { green: 0, yellow: 0, red: 0, grey: 0 };
  for (const account of accounts) {
    summary[account.status] = (summary[account.status] || 0) + 1;
  }
  return summary;
}

function buildSnapshot(accounts) {
  return {
    version: '1.0',
    checked_at: new Date().toISOString(),
    accounts: accounts.map(redactAccountForSnapshot),
    summary: buildSummary(accounts),
  };
}

function redactAccountForSnapshot(account) {
  return {
    account_id: account.account_id,
    platform: account.platform,
    account_label: account.account_label,
    display_name: account.display_name,
    enabled: account.enabled,
    auth_mode: account.auth_mode,
    status: account.status,
    capabilities: account.capabilities,
    default_privacy: account.default_privacy,
    allowed_privacy: account.allowed_privacy,
    manual_fallback: account.manual_fallback,
    notification_state: account.notification_state,
    last_checked_at: account.last_checked_at,
    next_action: redactText(account.next_action),
    warnings: Array.isArray(account.warnings) ? account.warnings.map(redactText) : [],
  };
}

async function checkDatabaseAndPackage(videoId, packageTarget) {
  const warnings = [];
  let database_reachable = false;
  let package_target_present = false;
  let package_target_upload_ready = false;
  try {
    const sql = `SELECT manifest_content FROM production_packages WHERE video_id = '${escapeSqlLiteral(videoId)}' ORDER BY created_at DESC LIMIT 1;`;
    const stdout = execFileSync('psql', [
      DEFAULT_DB_URL,
      '--no-align',
      '--tuples-only',
      '--quiet',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ], { encoding: 'utf8' });
    database_reachable = true;
    const manifest = stdout.trim() ? JSON.parse(stdout.trim()) : null;
    const targets = manifest?.package_targets ?? [];
    const target = Array.isArray(targets) ? targets.find((item) => String(item?.package_target ?? '') === packageTarget) : null;
    package_target_present = Boolean(target);
    package_target_upload_ready = Boolean(target?.upload_ready);
    if (!package_target_present) warnings.push('Package target not found.');
    else if (!package_target_upload_ready) warnings.push('Package target is not upload-ready.');
  } catch (err) {
    warnings.push(`Database/package lookup unavailable: ${redactText(String(err))}`);
  }
  return { database_reachable, package_target_present, package_target_upload_ready, warnings };
}

function readYoutubeTokenSummary(credentialReference) {
  try {
    const stdout = execFileSync('node', [
      TOKEN_HELPER,
      'keychain-summary-youtube-token',
      credentialReference,
      '--confirm-real-keychain-read',
    ], { encoding: 'utf8' });
    const parsed = JSON.parse(stdout.trim() || '{}');
    return {
      ok: Boolean(parsed.ok),
      found: Boolean(parsed.found),
      access_token_present: Boolean(parsed.access_token_present),
      refresh_token_present: Boolean(parsed.refresh_token_present),
      expires_in_present: Boolean(parsed.expires_in_present),
      scope_youtube_upload_present: Boolean(parsed.scope_youtube_upload_present),
      scope: parsed.scope ?? null,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      found: false,
      access_token_present: false,
      refresh_token_present: false,
      expires_in_present: false,
      scope_youtube_upload_present: false,
      scope: null,
      error: redactText(String(err)),
    };
  }
}

function scanForSecretLikeValues(value, prefix = '') {
  const findings = [];
  if (value === null || value === undefined) return findings;
  if (typeof value === 'string') {
    if (isCredentialReferencePath(prefix) && REFERENCE_RE.test(value.trim())) {
      return findings;
    }
    if (TOKEN_ASSIGNMENT_RE.test(value) || SECRET_KEY_RE.test(prefix) && value.trim()) {
      findings.push({ path: prefix || '<root>', reason: 'secret-like field contains a value.' });
    }
    if (SECRET_VALUE_RE.test(value) || /keychain:\/\/video-orchestrator\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+/i.test(value)) {
      if (!isCredentialReferencePath(prefix)) {
        findings.push({ path: prefix || '<root>', reason: 'secret-like value detected.' });
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...scanForSecretLikeValues(item, `${prefix}[${index}]`)));
    return findings;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findings.push(...scanForSecretLikeValues(item, prefix ? `${prefix}.${key}` : key));
    }
  }
  return findings;
}

function isCredentialReferencePath(prefix) {
  return /(?:credential_reference|credentialReference)$/i.test(prefix);
}

function redactText(value) {
  return String(value ?? '')
    .replace(/\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization[_-]?code)\b\s*[:=]\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bcredential[_-]?ref(?:erence)?\b\s*[:=]\s*[^\s"'`]+/gi, 'credential_reference=[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/keychain:\/\/video-orchestrator\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+/gi, 'keychain://video-orchestrator/[REDACTED]/[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bsk_live_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bghp_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bgithub_pat_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bxoxb-[0-9A-Za-z-]{10,}\b/g, '[REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{12,}\b/g, '[REDACTED]');
}

function writeSnapshot(snapshotPath, snapshot) {
  if (!snapshotPath) return;
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function overallStatus(accounts) {
  if (!accounts.length) return 'grey';
  if (accounts.some((account) => account.status === 'red')) return 'red';
  if (accounts.some((account) => account.status === 'yellow')) return 'yellow';
  if (accounts.every((account) => account.status === 'grey')) return 'grey';
  return 'green';
}

function readOption(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCredentialReference(account) {
  return String(account?.credential_reference ?? account?.credentialReference ?? '');
}

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  printJson({ ok: false, error: redactText(message) });
  process.exit(1);
}

async function selfTest() {
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.buildflow/tmp/video-orchestrator-account-health-'));
  const registryPath = path.join(tmpDir, 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify({
    schema_version: '1.0',
    accounts: [
      {
        account_id: 'youtube-main-placeholder',
        platform: 'youtube',
        account_label: 'main-channel',
        display_name: 'Main YouTube Channel Placeholder',
        enabled: false,
        auth_mode: 'oauth',
        credential_reference: 'keychain://video-orchestrator/youtube/main-channel-placeholder',
        capabilities: {
          upload: true,
          status_check: true,
          refresh_token: true,
          analytics: false,
          manual_fallback: true,
        },
        default_privacy: 'private',
        allowed_privacy: ['private'],
        health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 7, keep_warm: true },
        notification_policy: { on_red: true, on_yellow: true, channel: 'dashboard' },
      },
      {
        account_id: 'youtube-manual-placeholder',
        platform: 'youtube',
        account_label: 'manual-fallback',
        display_name: 'Manual Fallback Placeholder',
        enabled: true,
        auth_mode: 'manual_only',
        capabilities: {
          upload: false,
          status_check: false,
          refresh_token: false,
          analytics: false,
          manual_fallback: true,
        },
        default_privacy: 'private',
        allowed_privacy: ['private'],
        health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 0, keep_warm: false },
        notification_policy: { on_red: false, on_yellow: true, channel: 'dashboard' },
      },
    ],
  }, null, 2));

  const valid = validateRegistryFile(registryPath);
  if (!valid.ok) throw new Error('validate-registry failed in self-test.');
  if (!validateReference('keychain://video-orchestrator/youtube/main-channel-placeholder').ok) throw new Error('youtube reference validation failed.');
  if (!validateReference('keychain://video-orchestrator/bluesky/main-channel-placeholder').ok) throw new Error('bluesky reference validation failed.');
  if (!validateReference('keychain://video-orchestrator/instagram/main-channel-placeholder').ok) throw new Error('instagram reference validation failed.');
  if (validateReference('keychain://video-orchestrator/randomplatform/example').ok) throw new Error('unsupported platform should fail.');
  if (validateReference('keychain://video-orchestrator/youtube/../bad').ok) throw new Error('traversal label should fail.');
  if (validateReference('keychain://video-orchestrator/youtube/bad;rm-rf').ok) throw new Error('shell-dangerous label should fail.');
  const redacted = redactText('credential_reference=keychain://video-orchestrator/youtube/main-channel-placeholder access_token=abc');
  if (/keychain:\/\/video-orchestrator\/youtube\/main-channel-placeholder/i.test(redacted)) throw new Error('redaction failed.');
  const manual = validateAccountShape({
    account_id: 'youtube-manual-placeholder',
    platform: 'youtube',
    account_label: 'manual-fallback',
    display_name: 'Manual Fallback Placeholder',
    enabled: true,
    auth_mode: 'manual_only',
    capabilities: {
      upload: false,
      status_check: false,
      refresh_token: false,
      analytics: false,
      manual_fallback: true,
    },
    default_privacy: 'private',
    allowed_privacy: ['private'],
    health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 0, keep_warm: false },
    notification_policy: { on_red: false, on_yellow: true, channel: 'dashboard' },
  });
  if (manual.errors.length) throw new Error('manual_only validation failed.');
  const manualHealth = await evaluateAccount({
    account_id: 'youtube-manual-placeholder',
    platform: 'youtube',
    account_label: 'manual-fallback',
    display_name: 'Manual Fallback Placeholder',
    enabled: true,
    auth_mode: 'manual_only',
    capabilities: {
      upload: false,
      status_check: false,
      refresh_token: false,
      analytics: false,
      manual_fallback: true,
    },
    default_privacy: 'private',
    allowed_privacy: ['private'],
    health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 0, keep_warm: false },
    notification_policy: { on_red: false, on_yellow: true, channel: 'dashboard' },
  }, { dryRun: true });
  if (manualHealth.status !== 'grey') throw new Error('manual_only account should be grey.');
  fs.writeFileSync(path.join(tmpDir, 'camel.json'), JSON.stringify({
    schema_version: '1.0',
    accounts: [{
      account_id: 'youtube-camel-placeholder',
      platform: 'youtube',
      account_label: 'camel-channel',
      display_name: 'Camel Credential Placeholder',
      enabled: true,
      auth_mode: 'oauth',
      credentialReference: 'keychain://video-orchestrator/youtube/camel-channel-placeholder',
      capabilities: { upload: true, status_check: true, refresh_token: true, analytics: false, manual_fallback: true },
      default_privacy: 'private',
      allowed_privacy: ['private'],
      health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 7, keep_warm: true },
      notification_policy: { on_red: true, on_yellow: true, channel: 'dashboard' },
    }],
  }, null, 2));
  const camelValidation = validateRegistryFile(path.join(tmpDir, 'camel.json'));
  if (!camelValidation.ok) throw new Error('camelCase credentialReference should validate.');
  const camelAccountHealth = await evaluateAccount({
    account_id: 'youtube-camel-placeholder',
    platform: 'youtube',
    account_label: 'camel-channel',
    display_name: 'Camel Credential Placeholder',
    enabled: true,
    auth_mode: 'oauth',
    credentialReference: 'keychain://video-orchestrator/youtube/camel-channel-placeholder',
    capabilities: { upload: true, status_check: true, refresh_token: true, analytics: false, manual_fallback: true },
    default_privacy: 'private',
    allowed_privacy: ['private'],
    health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 7, keep_warm: true },
    notification_policy: { on_red: true, on_yellow: true, channel: 'dashboard' },
  }, { dryRun: true });
  if (camelAccountHealth.status === 'grey' && camelAccountHealth.next_action.includes('credential reference')) throw new Error('camelCase credentialReference should not be treated as missing.');
  if (!Array.isArray(camelAccountHealth.warnings)) throw new Error('camelCase account warnings should be an array.');
  fs.writeFileSync(path.join(tmpDir, 'secret.json'), JSON.stringify({
    schema_version: '1.0',
    accounts: [{ account_id: 'x', platform: 'youtube', account_label: 'a', display_name: 'b', enabled: true, auth_mode: 'oauth', credential_reference: 'keychain://video-orchestrator/youtube/a', capabilities: { upload: true, status_check: true, refresh_token: true, analytics: false, manual_fallback: true }, default_privacy: 'private', allowed_privacy: ['private'], health_check: { enabled: true, frequency: 'nightly', warn_before_expiry_days: 7, keep_warm: true }, notification_policy: { on_red: true, on_yellow: true, channel: 'dashboard' }, notes: 'access_token=abc' }],
  }, null, 2));
  const secretValidation = validateRegistryFile(path.join(tmpDir, 'secret.json'));
  if (secretValidation.ok) throw new Error('secret-looking registry should fail.');
  const defaults = JSON.parse(JSON.stringify({
    ok: true,
    operator_registry: DEFAULT_LOCAL_REGISTRY_PATH,
    account_health_snapshot: DEFAULT_SNAPSHOT_PATH,
    account_health_log: DEFAULT_LOG_PATH,
  }));
  if (!defaults.operator_registry.includes('runtime/local/video-orchestrator/account-registry.local.json')) throw new Error(`default registry path mismatch: ${defaults.operator_registry}`);
  if (!defaults.account_health_snapshot.includes('runtime/local/video-orchestrator/account-health-snapshot.json')) throw new Error(`default snapshot path mismatch: ${defaults.account_health_snapshot}`);
  if (!defaults.account_health_log.includes('runtime/local/video-orchestrator/account-health.log')) throw new Error(`default log path mismatch: ${defaults.account_health_log}`);
  const initSource = path.join(tmpDir, 'example.json');
  const initTarget = path.join(tmpDir, 'account-registry.local.json');
  fs.copyFileSync(path.resolve(REPO_ROOT, 'operations/specs/video-orchestrator/examples/account-registry.example.json'), initSource);
  const initResult = initLocalRegistry(initSource, initTarget, false);
  if (!initResult.ok || !fs.existsSync(initTarget)) throw new Error('init-local-registry failed.');
  const initOverwrite = initLocalRegistry(initSource, initTarget, false);
  if (initOverwrite.ok) throw new Error('init-local-registry should refuse overwrite without --force.');
  const snapshotPath = path.join(tmpDir, 'account-health-snapshot.json');
  const nightly = await evaluateRegistry(initTarget, { dryRun: true, writeSnapshotPath: snapshotPath });
  if (!nightly.ok || !fs.existsSync(snapshotPath)) throw new Error('write-nightly-snapshot failed.');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (JSON.stringify(snapshot).includes('credential_reference')) throw new Error('snapshot must not expose credential references.');
  if (JSON.stringify(snapshot).includes('keychain://')) throw new Error('snapshot must not expose keychain URLs.');
  if (JSON.stringify(snapshot).includes('access_token')) throw new Error('snapshot must not expose token values.');
  const readinessRegistry = await evaluateRegistry(registryPath, { dryRun: true });
  const readiness = await evaluatePrivateUploadReadiness(registryPath, 'youtube-manual-placeholder', '00000000-0000-4000-8000-000000000001', 'long-form');
  if (readiness.requires_manual_confirmation !== true) throw new Error('readiness gate failed.');
  if (!Array.isArray(readiness.warnings)) throw new Error('readiness warnings should be an array.');
  if (!readinessRegistry.ok) throw new Error('readiness registry evaluation failed.');
  if (readiness.safe_to_run_private_upload !== false) throw new Error('manual-only readiness should not be safe to run.');
  printJson({
    ok: true,
    checked: ['validate-registry', 'redaction', 'manual-only-account', 'readiness-gate', 'init-local-registry', 'write-nightly-snapshot', 'print-default-paths', 'camelCase-credentialReference', 'readiness-warnings'],
    redacted_preview: redacted,
  });
}
