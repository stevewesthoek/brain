#!/usr/bin/env node

/**
 * Cross-lifecycle handoff for the Codex identity/profile closeout.
 *
 * `prepare` is safe to run from the active Codex task. It writes an owner-only
 * packet and never stops processes, changes Git worktrees, logs in, reads
 * authentication material, or touches WebGPT.
 *
 * `execute` is intentionally a separate external phase. It refuses to run
 * while native Codex/ChatGPT/Computer Use processes are present, never kills
 * them, and writes only redacted evidence. Provider login remains an explicit
 * human step inside the external terminal.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFileSync, spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SOURCE_CHECKOUT = '/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01';
const DEFAULT_CANONICAL_CHECKOUT = '/Users/Office/Repos/stevewesthoek/brain';
const DEFAULT_PROFILES_ROOT = '/Users/Office/.brain/codex-runtime-profiles';
const DEFAULT_HANDOFF_ROOT = path.join(os.homedir(), '.brain', 'codex-identity-handoff');
const DEFAULT_CANDIDATE_CATALOG = 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json';
const DEFAULT_CANONICAL_CATALOG = 'operations/infrastructure/catalog/identity-access.v1.json';
const HANDOFF_KIND = 'brain.codex.identity.lifecycle-handoff';
const HANDOFF_SCHEMA_VERSION = '1.0.0';
const PROFILE_SPECS = [
  {
    accountId: 'account:openai.personal.01',
    runtimeProfileId: 'runtime_profile:openai.personal.01.cli',
    role: 'primary',
    preferred: true,
    purpose: 'personal/default',
  },
  {
    accountId: 'account:openai.personal.02',
    runtimeProfileId: 'runtime_profile:openai.personal.02.cli',
    role: 'secondary',
    preferred: false,
    purpose: 'overflow capacity',
  },
];

function usage() {
  return [
    'Usage: node tools/codex-identity-lifecycle-handoff.mjs <prepare|execute> [options]',
    '',
    'Options:',
    '  --packet PATH             owner-only Phase-A packet (execute input)',
    '  --source-checkout PATH   clean main source checkout',
    '  --canonical-checkout PATH canonical Brain path',
    '  --profiles-root PATH     dedicated Codex profile parent',
    '  --handoff-root PATH      owner-only local packet/evidence directory',
    '  --confirm                 required for execute',
    '  --login                   perform explicit human login handoffs',
    '',
    'prepare is read-only except for its owner-only packet.',
    'execute never kills processes and never reads or copies secrets.',
  ].join('\n');
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = {
    sourceCheckout: DEFAULT_SOURCE_CHECKOUT,
    canonicalCheckout: DEFAULT_CANONICAL_CHECKOUT,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    handoffRoot: DEFAULT_HANDOFF_ROOT,
    packet: undefined,
    confirm: false,
    login: false,
  };
  const valueOptions = new Map([
    ['--packet', 'packet'],
    ['--source-checkout', 'sourceCheckout'],
    ['--canonical-checkout', 'canonicalCheckout'],
    ['--profiles-root', 'profilesRoot'],
    ['--handoff-root', 'handoffRoot'],
  ]);
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--confirm') options.confirm = true;
    else if (arg === '--login') options.login = true;
    else if (valueOptions.has(arg)) {
      const value = rest[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[valueOptions.get(arg)] = value;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else throw new Error(`unknown option: ${arg}\n${usage()}`);
  }
  if (!['prepare', 'execute'].includes(operation)) throw new Error(usage());
  if (operation === 'execute' && !options.confirm) throw new Error('execute requires --confirm');
  if (operation === 'execute' && !options.packet) throw new Error('execute requires --packet PATH');
  return { operation, options };
}

function resolvedAbsolute(value, label) {
  const resolved = path.resolve(value);
  if (!path.isAbsolute(resolved)) throw new Error(`${label} must resolve to an absolute path`);
  return resolved;
}

function metadata(file) {
  try {
    const stat = fs.lstatSync(file);
    return {
      path: path.resolve(file),
      exists: true,
      type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : stat.isSymbolicLink() ? 'symlink' : 'other',
      ownerUid: stat.uid,
      mode: stat.mode & 0o777,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (error) {
    return { path: path.resolve(file), exists: false, reason: error?.code ?? 'stat_failed' };
  }
}

function assertOwnerOnlyPath(file, { directory = false, allowMissing = false } = {}) {
  const info = metadata(file);
  if (!info.exists && allowMissing) return info;
  if (!info.exists) throw new Error(`required path is missing: ${file}`);
  if (info.type === 'symlink') throw new Error(`symlink is not allowed: ${file}`);
  if (directory ? info.type !== 'directory' : info.type !== 'file') throw new Error(`unexpected path type: ${file}`);
  if (info.ownerUid !== process.getuid?.()) throw new Error(`path owner is not the current user: ${file}`);
  if ((info.mode & 0o077) !== 0) throw new Error(`path permissions are not owner-only: ${file}`);
  return info;
}

function assertDirectoryPath(file) {
  const info = metadata(file);
  if (!info.exists || info.type !== 'directory') throw new Error(`required directory is missing or invalid: ${file}`);
  if (info.ownerUid !== process.getuid?.()) throw new Error(`directory owner is not the current user: ${file}`);
  return info;
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch (error) {
    const reason = error?.status ? `exit_${error.status}` : error?.code ?? 'git_failed';
    throw new Error(`git operation failed (${reason})`);
  }
}

function gitState(checkout) {
  const root = resolvedAbsolute(checkout, 'checkout');
  assertDirectoryPath(root);
  const head = runGit(['rev-parse', '--verify', 'HEAD'], root);
  const branch = runGit(['branch', '--show-current'], root) || null;
  const status = runGit(['status', '--porcelain=v1'], root);
  let originMain = null;
  try {
    originMain = runGit(['rev-parse', '--verify', 'origin/main'], root);
  } catch {
    originMain = null;
  }
  let uniqueCommitsVsMain = null;
  try {
    uniqueCommitsVsMain = Number(runGit(['rev-list', '--count', 'main..HEAD'], root));
  } catch {
    uniqueCommitsVsMain = null;
  }
  return {
    path: root,
    head,
    branch,
    originMain,
    clean: status.length === 0,
    modifiedPathCount: status ? status.split('\n').filter((line) => line.length > 0 && !line.startsWith('??')).length : 0,
    untrackedPathCount: status ? status.split('\n').filter((line) => line.startsWith('??')).length : 0,
    uniqueCommitsVsMain,
  };
}

function profileMetadata(profilesRoot) {
  const parent = metadata(profilesRoot);
  const profiles = PROFILE_SPECS.map((spec) => {
    const root = path.join(profilesRoot, spec.runtimeProfileId.slice('runtime_profile:'.length));
    return {
      ...spec,
      root,
      rootMetadata: metadata(root),
    };
  });
  return { parent, profiles };
}

function safeEnv(profileRoot) {
  const keep = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR'];
  const env = {};
  for (const key of keep) if (process.env[key]) env[key] = process.env[key];
  env.HOME = os.homedir();
  env.CODEX_HOME = profileRoot;
  return env;
}

function writeOwnerOnlyJson(file, value, { replace = false } = {}) {
  const destination = resolvedAbsolute(file, 'output');
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  assertOwnerOnlyPath(parent, { directory: true });
  const existing = metadata(destination);
  if (existing.exists && !replace) throw new Error(`refusing to overwrite existing evidence: ${destination}`);
  if (existing.exists) assertOwnerOnlyPath(destination);
  const temp = `${destination}.tmp-${process.pid}`;
  const descriptor = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fchmodSync(descriptor, 0o600);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temp, destination);
  return destination;
}

function packetId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `codex-identity-${stamp}-${process.pid}`;
}

function buildPacket(options) {
  const sourceCheckout = resolvedAbsolute(options.sourceCheckout, 'source checkout');
  const canonicalCheckout = resolvedAbsolute(options.canonicalCheckout, 'canonical checkout');
  const profilesRoot = resolvedAbsolute(options.profilesRoot, 'profiles root');
  const handoffRoot = resolvedAbsolute(options.handoffRoot, 'handoff root');
  const source = gitState(sourceCheckout);
  if (source.branch !== 'main' || !source.clean || !source.originMain) {
    throw new Error('source checkout must be clean main with a resolvable origin/main');
  }
  const canonical = metadata(canonicalCheckout);
  let legacy = null;
  if (canonical.exists && canonical.type === 'directory') {
    try {
      legacy = gitState(canonicalCheckout);
    } catch {
      legacy = { path: canonicalCheckout, state: 'not_a_git_checkout' };
    }
  } else {
    legacy = { path: canonicalCheckout, state: canonical.exists ? 'unexpected_path_type' : 'missing' };
  }
  const profileState = profileMetadata(profilesRoot);
  const id = packetId();
  const packetPath = path.join(handoffRoot, `${id}.packet.json`);
  const evidencePath = path.join(handoffRoot, `${id}.evidence.json`);
  const archiveParent = path.join(path.dirname(canonicalCheckout), 'brain-identity-handoff-archives', id);
  const packet = {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    kind: HANDOFF_KIND,
    handoffId: id,
    phase: 'A',
    status: 'READY_FOR_EXTERNAL_PHASE',
    preparedAt: new Date().toISOString(),
    expectedMainSha: source.head,
    expectedOriginMainSha: source.originMain,
    sourceCheckout,
    canonicalCheckout,
    profilesRoot,
    candidateCatalog: path.join(sourceCheckout, DEFAULT_CANDIDATE_CATALOG),
    canonicalCatalog: path.join(sourceCheckout, DEFAULT_CANONICAL_CATALOG),
    profiles: PROFILE_SPECS.map((spec) => ({
      ...spec,
      root: path.join(profilesRoot, spec.runtimeProfileId.slice('runtime_profile:'.length)),
    })),
    configOwnership: {
      configWriter: 'brain:runtime-profile-config-materializer',
      configurationCustody: 'brain',
      authenticationCustody: 'codex_application',
      route: 'direct_native_openai',
      allowedMutation: 'profile_config_only',
      sharedDefaultRoot: 'application_owned_observe_only',
      webGpt: 'separate_application_owned_surface',
    },
    processAbsencePredicates: [
      'native_chatgpt_application',
      'native_codex_application',
      'native_codex_app_server',
      'native_computer_use_service',
      'native_computer_use_guardian',
      'native_codex_node_repl',
      'native_codex_browser_extension_host',
    ],
    externalOperations: [
      'verify_stable_native_process_absence',
      'verify_source_main_and_origin_alignment',
      'relocate_canonical_only_if_legacy_checkout_is_clean_and_unique_work_is_zero',
      'create_or_verify_dedicated_profile_roots',
      'materialize_non_secret_profile_configurations',
      'invoke_human_official_login_per_profile',
      'run_profile_scoped_read_only_observation_and_cli_proof',
      'enroll_only_explicitly_brain_owned_keychain_credentials',
      'write_redacted_continuation_evidence',
    ],
    webGptPolicy: {
      action: 'untouched',
      excludedPaths: ['/Users/Office/Repos/vendors/codex-chatgpt-web', '/Users/Office/.codex-chatgpt-web'],
      noStop: true,
      noRouteChange: true,
      noBrowserStateChange: true,
    },
    rollback: {
      mode: 'retain_and_restore_exact_worktree_state',
      archiveParent,
      evidencePath,
      noDelete: true,
      noForcePush: true,
      noApplicationStateDeletion: true,
    },
    preparationEvidence: {
      source,
      legacy,
      canonicalMetadata: canonical,
      profiles: profileState,
      secretsExcluded: true,
      oauthExcluded: true,
      keychainValuesExcluded: true,
      webGptUntouched: true,
    },
    continuationEvidencePath: evidencePath,
    containsSecrets: false,
  };
  return { packet, packetPath };
}

function processCategory(command) {
  const lower = command.toLowerCase();
  if (command.startsWith('/Applications/ChatGPT.app/') || command.startsWith('/Applications/ChatGPT Classic.app/')) return 'native_chatgpt_application';
  if (command.startsWith('/Applications/Codex.app/')) return 'native_codex_application';
  if (command.includes('/Codex Computer Use.app/') || lower.includes('skycomputeruse') || lower.includes('/unified-computer-use/')) return 'native_computer_use_service';
  if (lower.includes('cualockscreenguardian')) return 'native_computer_use_guardian';
  if (command.includes('/cua_node/bin/node_repl')) return 'native_codex_node_repl';
  if (lower.includes('chatgpt for chrome chrome-extension://')) return 'native_codex_browser_extension_host';
  if (/\bcodex\b/.test(lower) && /\bapp-server\b/.test(lower)) return 'native_codex_app_server';
  return null;
}

function nativeProcessSnapshot() {
  let output = '';
  try {
    output = execFileSync('ps', ['-axo', 'pid=,ppid=,user=,command='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error('unable to inspect process table');
  }
  const owner = process.env.USER ?? os.userInfo().username;
  const processes = [];
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (!match || match[3] !== owner) continue;
    const category = processCategory(match[4]);
    if (!category) continue;
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      category,
      commandFingerprint: `sha256:${crypto.createHash('sha256').update(match[4]).digest('hex')}`,
    });
  }
  return processes;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stableQuiescence({ samples = 3, delayMs = 1000 } = {}) {
  const observations = [];
  for (let index = 0; index < samples; index += 1) {
    const processes = nativeProcessSnapshot();
    observations.push({ sample: index + 1, processCount: processes.length, processes });
    if (processes.length > 0) return { status: 'BLOCKED', observations, reason: 'native_processes_present' };
    if (index + 1 < samples) await sleep(delayMs);
  }
  return { status: 'OK', observations, reason: null };
}

function loadPacket(file) {
  const packetPath = resolvedAbsolute(file, 'packet');
  assertOwnerOnlyPath(packetPath);
  let packet;
  try {
    packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  } catch {
    throw new Error('packet is not valid JSON');
  }
  if (!packet || packet.schemaVersion !== HANDOFF_SCHEMA_VERSION || packet.kind !== HANDOFF_KIND) throw new Error('packet schema or kind is invalid');
  if (packet.containsSecrets !== false || packet.preparationEvidence?.secretsExcluded !== true) throw new Error('packet secret-exclusion marker is invalid');
  if (!Array.isArray(packet.profiles) || packet.profiles.length < 2) throw new Error('packet must contain the selected profile collection');
  for (const field of ['sourceCheckout', 'canonicalCheckout', 'profilesRoot', 'candidateCatalog', 'canonicalCatalog', 'continuationEvidencePath']) {
    if (typeof packet[field] !== 'string' || !path.isAbsolute(packet[field])) throw new Error(`packet path is invalid: ${field}`);
  }
  const serialized = JSON.stringify(packet);
  if (serialized.includes('@') || serialized.match(/"(?:access[_-]?token|refresh[_-]?token|password|secret|cookie|authorization)"\s*:/i)) {
    throw new Error('packet contains a forbidden credential-like field or value');
  }
  return { packet, packetPath };
}

function runJsonNode(sourceCheckout, scriptName, args, { profileRoot } = {}) {
  const script = path.join(sourceCheckout, 'tools', scriptName);
  try {
    const output = execFileSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      env: profileRoot ? safeEnv(profileRoot) : safeEnv(path.join(os.homedir(), '.codex')),
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 4 * 1024 * 1024,
    });
    const lines = output.trim().split('\n');
    const jsonStart = lines.findIndex((line) => line.trim().startsWith('{'));
    return JSON.parse(lines.slice(jsonStart < 0 ? 0 : jsonStart).join('\n'));
  } catch (error) {
    throw new Error(`profile tooling failed (${error?.status ? `exit_${error.status}` : error?.code ?? 'invalid_output'})`);
  }
}

function runProfileCommand(profileRoot, args, { interactive = false } = {}) {
  const executable = 'codex';
  const result = spawnSync(executable, args, {
    env: safeEnv(profileRoot),
    stdio: interactive ? 'inherit' : 'ignore',
  });
  return { status: result.error ? 'error' : result.status === 0 ? 'ok' : 'failed', exitCode: result.status ?? null };
}

async function operatorAttestation(profile) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const expected = `CONFIRM_${profile.role.toUpperCase()}`;
    const answer = (await prompt.question(`After the provider UI shows the intended ${profile.role} account, type ${expected}: `)).trim();
    return answer === expected;
  } finally {
    prompt.close();
  }
}

async function executePacket(options) {
  const { packet, packetPath } = loadPacket(options.packet);
  const events = [];
  const evidencePath = packet.continuationEvidencePath;
  const writeEvidence = (status, reasons = []) => {
    const evidence = {
      schemaVersion: HANDOFF_SCHEMA_VERSION,
      kind: HANDOFF_KIND,
      handoffId: packet.handoffId,
      phase: 'B',
      status,
      packetPath,
      startedAt: events[0]?.at ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      expectedMainSha: packet.expectedMainSha,
      canonicalCheckout: packet.canonicalCheckout,
      acceptancePath: events.find((event) => event.event === 'collection_acceptance')?.acceptancePath ?? null,
      profiles: packet.profiles.map(({ accountId, runtimeProfileId, role, preferred, root }) => ({ accountId, runtimeProfileId, role, preferred, root })),
      events,
      reasons: [...new Set(reasons)],
      webGpt: 'untouched',
      secretsExcluded: true,
      oauthCopied: false,
      keychainValuesRead: false,
      processesKilled: false,
      forceUsed: false,
    };
    return writeOwnerOnlyJson(evidencePath, evidence);
  };
  events.push({ at: new Date().toISOString(), event: 'external_phase_started' });
  let quiescence;
  try {
    quiescence = await stableQuiescence();
  } catch (error) {
    events.push({ at: new Date().toISOString(), event: 'quiescence_probe_failed' });
    const outputPath = writeEvidence('HANDOFF_BLOCKED', [error.message]);
    return { status: 'HANDOFF_BLOCKED', reasons: [error.message], evidencePath: outputPath };
  }
  events.push({ at: new Date().toISOString(), event: 'quiescence_checked', status: quiescence.status, observations: quiescence.observations });
  if (quiescence.status !== 'OK') {
    const outputPath = writeEvidence('HANDOFF_BLOCKED', [quiescence.reason]);
    return { status: 'HANDOFF_BLOCKED', reasons: [quiescence.reason], evidencePath: outputPath };
  }

  let source;
  try {
    source = gitState(packet.sourceCheckout);
  } catch (error) {
    const outputPath = writeEvidence('HANDOFF_BLOCKED', ['source_checkout_unreadable']);
    return { status: 'HANDOFF_BLOCKED', reasons: [error.message], evidencePath: outputPath };
  }
  if (source.head !== packet.expectedMainSha || source.branch !== 'main' || !source.clean || source.originMain !== packet.expectedOriginMainSha) {
    const outputPath = writeEvidence('HANDOFF_BLOCKED', ['source_main_changed_or_dirty']);
    return { status: 'HANDOFF_BLOCKED', reasons: ['source_main_changed_or_dirty'], evidencePath: outputPath };
  }
  events.push({ at: new Date().toISOString(), event: 'source_main_verified', mainSha: source.head });

  let canonical = null;
  try {
    canonical = gitState(packet.canonicalCheckout);
  } catch {
    canonical = null;
  }
  let relocation = { status: 'skipped', reason: 'canonical_checkout_not_clean_and_unique_free' };
  if (canonical?.clean && canonical.uniqueCommitsVsMain === 0 && canonical.head === packet.expectedMainSha && canonical.branch === 'main') {
    relocation = { status: 'already_canonical', path: packet.canonicalCheckout };
  } else if (!canonical) {
    relocation = { status: 'blocked', reason: 'canonical_checkout_not_git_or_unreadable' };
  } else if (!canonical.clean || (canonical.uniqueCommitsVsMain ?? 1) > 0) {
    relocation = { status: 'skipped_protected_residual', clean: canonical.clean, uniqueCommitsVsMain: canonical.uniqueCommitsVsMain };
  }
  events.push({ at: new Date().toISOString(), event: 'canonical_relocation_evaluated', relocation });
  if (relocation.status === 'blocked') {
    const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', ['canonical_relocation_not_safe']);
    return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['canonical_relocation_not_safe'], evidencePath: outputPath };
  }

  const executionSource = packet.sourceCheckout;
  const candidateCatalog = path.join(executionSource, DEFAULT_CANDIDATE_CATALOG);
  const profileResults = [];
  for (const profile of packet.profiles) {
    try {
      const create = runJsonNode(executionSource, 'runtime-profile-manager.mjs', [
        'create', '--catalog', candidateCatalog, '--profiles-root', packet.profilesRoot,
        '--profile', profile.runtimeProfileId, '--execute', '--confirm',
      ], { profileRoot: profile.root });
      const materialize = runJsonNode(executionSource, 'runtime-profile-manager.mjs', [
        'materialize-config', '--catalog', candidateCatalog, '--profiles-root', packet.profilesRoot,
        '--profile', profile.runtimeProfileId, '--execute', '--confirm',
      ], { profileRoot: profile.root });
      if (!['OK', 'NOT_NEEDED'].includes(create.status) || !['OK', 'NOT_NEEDED'].includes(materialize.status)) throw new Error('profile preparation was not accepted');
      profileResults.push({ runtimeProfileId: profile.runtimeProfileId, role: profile.role, create: create.status, materialize: materialize.status });
      events.push({ at: new Date().toISOString(), event: 'profile_prepared', runtimeProfileId: profile.runtimeProfileId, role: profile.role, create: create.status, materialize: materialize.status });
    } catch (error) {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`profile_preparation_failed:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: [error.message], evidencePath: outputPath };
    }
  }

  if (!options.login) {
    events.push({ at: new Date().toISOString(), event: 'login_handoff_deferred', reason: 'execute_requires_explicit_login_switch' });
    const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', ['human_login_not_requested']);
    return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['human_login_not_requested'], evidencePath: outputPath };
  }

  for (const profile of packet.profiles) {
    const login = runJsonNode(executionSource, 'runtime-profile-manager.mjs', [
      'login', '--catalog', candidateCatalog, '--profiles-root', packet.profilesRoot,
      '--profile', profile.runtimeProfileId,
    ], { profileRoot: profile.root });
    if (login.status !== 'READY' || !login.handoff?.humanMustComplete) {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`login_handoff_unavailable:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['login_handoff_unavailable'], evidencePath: outputPath };
    }
    process.stdout.write(`LOGIN REQUIRED: ${profile.role} profile ${profile.runtimeProfileId}. Choose the intended provider account in the official login flow.\n`);
    const loginResult = runProfileCommand(profile.root, login.handoff.args, { interactive: true });
    if (loginResult.status !== 'ok') {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`official_login_failed:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['official_login_failed'], evidencePath: outputPath };
    }
    const attested = await operatorAttestation(profile);
    if (!attested) {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`operator_attestation_failed:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['operator_attestation_failed'], evidencePath: outputPath };
    }
    events.push({ at: new Date().toISOString(), event: 'official_login_completed', runtimeProfileId: profile.runtimeProfileId, role: profile.role, operatorAttestation: 'confirmed' });
  }

  const verificationSequence = [packet.profiles[0], packet.profiles[1], packet.profiles[0]];
  for (const profile of verificationSequence) {
    const doctor = runJsonNode(executionSource, 'runtime-profile-manager.mjs', [
      'doctor', '--catalog', candidateCatalog, '--profiles-root', packet.profilesRoot,
      '--profile', profile.runtimeProfileId,
    ], { profileRoot: profile.root });
    if (doctor.status !== 'OK' || doctor.authentication?.status !== 'authenticated') {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`coexistence_verification_failed:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['coexistence_verification_failed'], evidencePath: outputPath };
    }
    events.push({ at: new Date().toISOString(), event: 'coexistence_verification', runtimeProfileId: profile.runtimeProfileId, role: profile.role, authentication: 'authenticated' });
  }

  for (const profile of verificationSequence) {
    const proof = runProfileCommand(profile.root, ['exec', '--ephemeral', '--skip-git-repo-check', '--json', 'Reply with exactly OK.']);
    events.push({ at: new Date().toISOString(), event: 'profile_cli_proof', runtimeProfileId: profile.runtimeProfileId, role: profile.role, result: proof.status, exitCode: proof.exitCode });
    if (proof.status !== 'ok') {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', [`cli_proof_failed:${profile.runtimeProfileId}`]);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['cli_proof_failed'], evidencePath: outputPath };
    }
  }
  const acceptancePath = path.join(path.dirname(packetPath), `${packet.handoffId}.acceptance.json`);
  try {
    const acceptance = runJsonNode(executionSource, 'codex-cli-pilot.mjs', [
      'acceptance', '--catalog', candidateCatalog, '--profiles-root', packet.profilesRoot,
      '--profiles', packet.profiles.map((profile) => profile.runtimeProfileId).join(','),
      ...packet.profiles.flatMap((profile) => ['--attest-profile', profile.runtimeProfileId]),
      '--output', acceptancePath,
    ]);
    if (acceptance.status !== 'OK') {
      const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', ['collection_acceptance_failed']);
      return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['collection_acceptance_failed'], evidencePath: outputPath };
    }
    events.push({ at: new Date().toISOString(), event: 'collection_acceptance', status: 'OK', acceptancePath });
  } catch (error) {
    const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', ['collection_acceptance_failed']);
    return { status: 'HANDOFF_PARTIAL_SAFE', reasons: [error.message], evidencePath: outputPath };
  }
  events.push({ at: new Date().toISOString(), event: 'keychain_enrollment', status: 'deferred_until_explicit_brain_owned_credential_selection' });
  const outputPath = writeEvidence('HANDOFF_PARTIAL_SAFE', ['canonical_admission_and_operator_attestation_remain_phase_c']);
  return { status: 'HANDOFF_PARTIAL_SAFE', reasons: ['canonical_admission_and_operator_attestation_remain_phase_c'], evidencePath: outputPath, profiles: profileResults };
}

async function main(argv = process.argv.slice(2)) {
  const { operation, options } = parseArgs(argv);
  if (operation === 'prepare') {
    const { packet, packetPath } = buildPacket(options);
    const outputPath = writeOwnerOnlyJson(packetPath, packet);
    process.stdout.write(`PHASE_A=HANDOFF_READY\n${JSON.stringify({ status: packet.status, packetPath: outputPath, expectedMainSha: packet.expectedMainSha, continuationEvidencePath: packet.continuationEvidencePath, secretsExcluded: true }, null, 2)}\n`);
    return 0;
  }
  const result = await executePacket(options);
  process.stdout.write(`${result.status}\n${JSON.stringify({ status: result.status, evidencePath: result.evidencePath, reasons: result.reasons ?? [] }, null, 2)}\n`);
  return result.status === 'HANDOFF_OK' ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`HANDOFF_BLOCKED\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  HANDOFF_KIND,
  HANDOFF_SCHEMA_VERSION,
  PROFILE_SPECS,
  buildPacket,
  nativeProcessSnapshot,
  processCategory,
  stableQuiescence,
};
