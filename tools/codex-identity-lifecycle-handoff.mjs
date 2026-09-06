#!/usr/bin/env node

/**
 * Profile-scoped Codex identity lifecycle coordinator.
 *
 * Version 1.0 packets from the retired global-quiescence workflow are
 * intentionally rejected. This coordinator operates only on dedicated
 * CODEX_HOME roots and never stops, inspects, or mutates shared native
 * Codex/ChatGPT/WebGPT surfaces.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { runRuntimeProfileManager } from './runtime-profile-manager.mjs';
import { createCodexCliRuntimeProfileAdapter } from './runtime-profile-manager/codex-cli-adapter.mjs';
import {
  buildRuntimeProfileConfigurationArtifact,
  compileCodexProfileConfig,
  inspectRuntimeProfileConfiguration,
} from './runtime-profile-manager/runtime-profile-configuration.mjs';

const DEFAULT_SOURCE_CHECKOUT = '/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01';
const DEFAULT_CANONICAL_CHECKOUT = '/Users/Office/Repos/stevewesthoek/brain';
const DEFAULT_PROFILES_ROOT = path.join(os.homedir(), '.brain', 'codex-runtime-profiles');
const DEFAULT_HANDOFF_ROOT = path.join(os.homedir(), '.brain', 'codex-identity-handoff');
const DEFAULT_RETIREMENT_ROOT = path.join(os.homedir(), '.brain', 'codex-runtime-profile-retirements');
const DEFAULT_CANDIDATE_CATALOG = 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json';
const DEFAULT_CANONICAL_CATALOG = 'operations/infrastructure/catalog/identity-access.v1.json';
const HANDOFF_KIND = 'brain.codex.identity.profile-lifecycle-handoff';
const EVIDENCE_KIND = 'brain.codex.identity.profile-lifecycle-evidence';
const SCHEMA_VERSION = '2.0.0';
const SHARED_DEFAULT_ROOT = path.join(os.homedir(), '.codex');
const LEGACY_PROFILE_IDS = Object.freeze([
  'runtime_profile:openai.personal.01.cli',
  'runtime_profile:openai.personal.02.cli',
]);

const PROFILE_SPECS = Object.freeze([
  Object.freeze({
    accountId: 'account:openai.01',
    runtimeProfileId: 'runtime_profile:openai.01.cli',
    role: 'primary',
    preferred: true,
    purpose: 'default',
  }),
  Object.freeze({
    accountId: 'account:openai.02',
    runtimeProfileId: 'runtime_profile:openai.02.cli',
    role: 'secondary',
    preferred: false,
    purpose: 'overflow_capacity',
  }),
]);

function usage() {
  return [
    'Usage: node tools/codex-identity-lifecycle-handoff.mjs <prepare|inspect|execute|retire-stale> [options]',
    '',
    'This is the profile-scoped v2 coordinator. It does not require global',
    'Codex, ChatGPT, WebGPT, Computer Use, SSH, or MCP shutdown.',
    '',
    'Options:',
    '  --packet PATH             v2 packet path for inspect/execute',
    '  --source-checkout PATH   clean main source checkout for prepare',
    '  --canonical-checkout PATH canonical Brain path for observation only',
    '  --profiles-root PATH     dedicated CODEX_HOME parent',
    '  --handoff-root PATH      owner-only packet/evidence directory',
    '  --retirement-root PATH   owner-only archive for retired bootstrap roots',
    '  --confirm                 required for execute',
    '  --login                   emit official per-profile login handoffs',
    '',
    'Old v1 packets, including 91992, are permanently retired and rejected.',
    'No operation reads, copies, or prints authentication material.',
  ].join('\n');
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = {
    sourceCheckout: DEFAULT_SOURCE_CHECKOUT,
    canonicalCheckout: DEFAULT_CANONICAL_CHECKOUT,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    handoffRoot: DEFAULT_HANDOFF_ROOT,
    retirementRoot: DEFAULT_RETIREMENT_ROOT,
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
    ['--retirement-root', 'retirementRoot'],
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
  if (!['prepare', 'inspect', 'execute', 'retire-stale'].includes(operation)) throw new Error(usage());
  if (['inspect', 'execute'].includes(operation) && !options.packet) throw new Error(`${operation} requires --packet PATH`);
  if (['execute', 'retire-stale'].includes(operation) && !options.confirm) throw new Error(`${operation} requires --confirm`);
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

function assertOwnerOnly(file, { directory = false } = {}) {
  const info = metadata(file);
  if (!info.exists) throw new Error(`required path is missing: ${file}`);
  if (info.type === 'symlink') throw new Error(`symlink is not allowed: ${file}`);
  if (directory ? info.type !== 'directory' : info.type !== 'file') throw new Error(`unexpected path type: ${file}`);
  if (info.ownerUid !== process.getuid?.()) throw new Error(`path owner is not the current user: ${file}`);
  if ((info.mode & 0o077) !== 0) throw new Error(`path permissions are not owner-only: ${file}`);
  return info;
}

function assertDirectory(file) {
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
  assertDirectory(root);
  const head = runGit(['rev-parse', '--verify', 'HEAD'], root);
  const branch = runGit(['branch', '--show-current'], root) || null;
  const status = runGit(['status', '--porcelain=v1'], root);
  let originMain = null;
  try {
    originMain = runGit(['rev-parse', '--verify', 'origin/main'], root);
  } catch {
    originMain = null;
  }
  return {
    path: root,
    head,
    branch,
    originMain,
    clean: status.length === 0,
    modifiedPathCount: status ? status.split('\n').filter((line) => line && !line.startsWith('??')).length : 0,
    untrackedPathCount: status ? status.split('\n').filter((line) => line.startsWith('??')).length : 0,
  };
}

function isPathWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function profileRoot(profilesRoot, runtimeProfileId) {
  if (path.resolve(profilesRoot) === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error('profile root parent may not be shared ~/.codex');
  const suffix = runtimeProfileId.slice('runtime_profile:'.length);
  const root = path.resolve(profilesRoot, suffix);
  if (!isPathWithin(profilesRoot, root) || root === path.resolve(profilesRoot)) throw new Error(`profile root escaped profiles root: ${runtimeProfileId}`);
  if (root === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error('profile root may not be shared ~/.codex');
  return root;
}

function assertProfileCollection(packet) {
  if (!Array.isArray(packet.profiles) || packet.profiles.length === 0) throw new Error('handoff packet contains no profiles');
  const profilesRoot = resolvedAbsolute(packet.profilesRoot, 'profiles root');
  if (profilesRoot === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error('profiles root may not be shared ~/.codex');
  for (const profile of packet.profiles) {
    if (!profile || typeof profile.runtimeProfileId !== 'string' || typeof profile.root !== 'string') throw new Error('profile metadata is incomplete');
    const expectedRoot = profileRoot(profilesRoot, profile.runtimeProfileId);
    if (path.resolve(profile.root) !== expectedRoot) throw new Error(`profile root does not match its runtime profile: ${profile.runtimeProfileId}`);
    if (path.resolve(profile.root) === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error('profile targets shared ~/.codex');
  }
  return profilesRoot;
}

function writeOwnerOnlyJson(file, value) {
  const destination = resolvedAbsolute(file, 'output');
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  assertOwnerOnly(parent, { directory: true });
  if (metadata(destination).exists) throw new Error(`refusing to overwrite existing evidence: ${destination}`);
  const temp = `${destination}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const descriptor = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fchmodSync(descriptor, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temp, destination);
  return destination;
}

function packetId() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace(/Z$/, 'Z');
  return `codex-profile-${stamp}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
}

function buildPacket(options) {
  const sourceCheckout = resolvedAbsolute(options.sourceCheckout, 'source checkout');
  const canonicalCheckout = resolvedAbsolute(options.canonicalCheckout, 'canonical checkout');
  const profilesRoot = resolvedAbsolute(options.profilesRoot, 'profiles root');
  const handoffRoot = resolvedAbsolute(options.handoffRoot, 'handoff root');
  const source = gitState(sourceCheckout);
  if (source.branch !== 'main' || !source.clean || !source.originMain) throw new Error('source checkout must be clean main with a resolvable origin/main');
  const canonical = metadata(canonicalCheckout);
  const id = packetId();
  const packetPath = path.join(handoffRoot, `${id}.packet.json`);
  const evidencePath = path.join(handoffRoot, `${id}.evidence.json`);
  const packet = {
    schemaVersion: SCHEMA_VERSION,
    kind: HANDOFF_KIND,
    handoffId: id,
    phase: 'PROFILE_SCOPED',
    status: 'READY_FOR_PROFILE_SCOPED_EXECUTION',
    preparedAt: new Date().toISOString(),
    expectedMainSha: source.head,
    expectedOriginMainSha: source.originMain,
    sourceCheckout,
    canonicalCheckout,
    profilesRoot,
    candidateCatalog: path.join(sourceCheckout, DEFAULT_CANDIDATE_CATALOG),
    canonicalCatalog: path.join(sourceCheckout, DEFAULT_CANONICAL_CATALOG),
    profiles: PROFILE_SPECS.map((spec) => ({ ...spec, root: profileRoot(profilesRoot, spec.runtimeProfileId) })),
    policy: {
      lifecycleScope: 'profile_scoped',
      globalProcessQuiescenceRequired: false,
      targetProfileLeaseRequired: true,
      sharedDefaultRootMutation: false,
      webGptMutation: false,
      oauthReadOrCopy: false,
      canonicalCatalogMutation: false,
      canonicalCheckoutRelocation: 'deferred_separate_maintenance',
      nAccountModel: 'dynamic_collection',
    },
    retiredV1PacketPolicy: {
      schemaVersion: '1.0.0',
      action: 'reject_without_execution',
      evidencePreserved: true,
    },
    webGptPolicy: {
      action: 'untouched',
      excludedPaths: ['/Users/Office/Repos/vendors/codex-chatgpt-web', '/Users/Office/.codex-chatgpt-web'],
      noStop: true,
      noRouteChange: true,
      noBrowserStateChange: true,
    },
    preparationEvidence: {
      source,
      canonicalMetadata: canonical,
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

function loadPacket(file) {
  const packetPath = resolvedAbsolute(file, 'packet');
  assertOwnerOnly(packetPath);
  let packet;
  try {
    packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  } catch {
    throw new Error('packet is not valid JSON');
  }
  if (packet?.schemaVersion !== SCHEMA_VERSION || packet?.kind !== HANDOFF_KIND) {
    throw new Error('packet is retired or belongs to an unsupported lifecycle version; prepare a fresh v2 packet');
  }
  if (packet.containsSecrets !== false || packet.preparationEvidence?.secretsExcluded !== true) throw new Error('packet secret-exclusion marker is invalid');
  if (JSON.stringify(packet).includes('@')) throw new Error('packet contains an unexpected identity value');
  assertProfileCollection(packet);
  for (const field of ['sourceCheckout', 'canonicalCheckout', 'candidateCatalog', 'canonicalCatalog', 'continuationEvidencePath']) {
    if (typeof packet[field] !== 'string' || !path.isAbsolute(packet[field])) throw new Error(`packet path is invalid: ${field}`);
  }
  if (packet.policy?.lifecycleScope !== 'profile_scoped' || packet.policy?.globalProcessQuiescenceRequired !== false) throw new Error('packet does not declare the profile-scoped safety policy');
  return { packet, packetPath };
}

function deriveAttemptEvidencePath(packet) {
  const original = packet.continuationEvidencePath;
  const parent = path.dirname(original);
  const stem = path.basename(original, '.json').replace(/\.evidence$/, '');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace(/Z$/, 'Z');
  return path.join(parent, `${stem}.attempt-${stamp}-${process.pid}-${crypto.randomBytes(4).toString('hex')}.evidence.json`);
}

function relativeEntries(root) {
  const entries = [];
  function visit(current, relative) {
    for (const name of fs.readdirSync(current)) {
      const child = path.join(current, name);
      const childRelative = relative ? path.join(relative, name) : name;
      const info = metadata(child);
      entries.push({ relativePath: childRelative, ...info });
      if (info.type === 'directory') visit(child, childRelative);
    }
  }
  visit(root, '');
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isKnownBootstrapEntry(entry) {
  if (['config.toml', 'config.toml.brain-ownership.json', 'tmp', 'tmp/arg0'].includes(entry.relativePath)) return true;
  if (/^tmp\/arg0\/codex-arg0[A-Za-z0-9]+$/.test(entry.relativePath)) return entry.type === 'directory';
  if (/^tmp\/arg0\/codex-arg0[A-Za-z0-9]+\/.lock$/.test(entry.relativePath)) return entry.type === 'file' && entry.size === 0;
  if (/^tmp\/arg0\/codex-arg0[A-Za-z0-9]+\/(?:apply_patch|applypatch|codex-execve-wrapper)$/.test(entry.relativePath)) {
    if (entry.type !== 'symlink') return false;
    const target = fs.readlinkSync(path.join(entry.rootPath, entry.relativePath));
    return path.isAbsolute(target) && target.startsWith('/opt/homebrew/lib/node_modules/@openai/codex/') && path.basename(target) === 'codex';
  }
  return false;
}

function inspectLegacyBootstrapRoot({ profilesRoot, runtimeProfileId, adapter }) {
  const root = profileRoot(profilesRoot, runtimeProfileId);
  const rootInfo = metadata(root);
  if (!rootInfo.exists) return { runtimeProfileId, root, status: 'NOT_NEEDED', reason: 'root_absent' };
  if (rootInfo.type !== 'directory' || rootInfo.ownerUid !== process.getuid?.() || (rootInfo.mode & 0o077) !== 0) {
    return { runtimeProfileId, root, status: 'BLOCKED', reason: 'root_not_owner_only_directory' };
  }
  const entries = relativeEntries(root);
  const entriesWithRoot = entries.map((entry) => ({ ...entry, rootPath: root }));
  const unexpected = entriesWithRoot.filter((entry) => !isKnownBootstrapEntry(entry));
  const unsafe = entries.filter((entry) => {
    const knownRuntimeResidue = entry.relativePath === 'tmp'
      || entry.relativePath === 'tmp/arg0'
      || /^tmp\/arg0\/codex-arg0[A-Za-z0-9]+(?:\/\.lock)?$/.test(entry.relativePath)
      || /^tmp\/arg0\/codex-arg0[A-Za-z0-9]+\/(?:apply_patch|applypatch|codex-execve-wrapper)$/.test(entry.relativePath);
    return entry.type === 'symlink' ? !isKnownBootstrapEntry({ ...entry, rootPath: root }) : entry.ownerUid !== process.getuid?.() || (!knownRuntimeResidue && (entry.mode & 0o077) !== 0);
  });
  const configPath = path.join(root, 'config.toml');
  const profile = { runtimeProfileId, profileKind: 'cli' };
  const artifact = buildRuntimeProfileConfigurationArtifact({ profile, root, configPath });
  const configuration = inspectRuntimeProfileConfiguration({ artifact });
  let configMatchesBootstrap = false;
  if (metadata(configPath).exists && metadata(configPath).type === 'file') {
    const expected = compileCodexProfileConfig({ profile, artifact });
    configMatchesBootstrap = fs.readFileSync(configPath, 'utf8') === expected;
  }
  const authentication = adapter.inspectAuthentication({ root });
  const processState = adapter.inspectProcessOwnership({ profile, root, context: {} });
  const resourceProbe = adapter.inspectProcessOwnership({ profile, root, context: {} });
  const reasons = [
    ...(unexpected.length ? ['unexpected_root_entries'] : []),
    ...(unsafe.length ? ['unsafe_root_entry_permissions_or_type'] : []),
    ...(configuration.state !== 'owned' ? ['brain_configuration_not_owned'] : []),
    ...(!configMatchesBootstrap ? ['configuration_is_not_exact_bootstrap_policy'] : []),
    ...(authentication.status !== 'not_authenticated' || authentication.state !== 'confirmed' ? ['authentication_not_confirmed_absent'] : []),
    ...(processState.state !== 'none' ? ['profile_process_or_lease_present'] : []),
    ...(resourceProbe.resourceOwners?.length ? ['profile_resource_in_use'] : []),
    ...(resourceProbe.state === 'unknown' ? ['profile_resource_ownership_unresolved'] : []),
  ];
  return {
    runtimeProfileId,
    root,
    status: reasons.length ? 'BLOCKED' : 'READY',
    reasons,
    entries: entries.map(({ relativePath, type, ownerUid, mode, size }) => ({ relativePath, type, ownerUid, mode, size })),
    configuration: { state: configuration.state, reasons: configuration.reasons },
    authentication: { state: authentication.state, status: authentication.status },
    process: { state: processState.state },
    resourceOwners: { state: processState.resourceOwners?.length ? 'active' : processState.state, owners: processState.resourceOwners ?? [] },
  };
}

function retireLegacyBootstrapRoots(options, adapter = createCodexCliRuntimeProfileAdapter()) {
  const profilesRoot = resolvedAbsolute(options.profilesRoot, 'profiles root');
  const retirementRoot = resolvedAbsolute(options.retirementRoot, 'retirement root');
  assertOwnerOnly(profilesRoot, { directory: true });
  fs.mkdirSync(retirementRoot, { recursive: true, mode: 0o700 });
  assertOwnerOnly(retirementRoot, { directory: true });
  const inspections = LEGACY_PROFILE_IDS.map((runtimeProfileId) => inspectLegacyBootstrapRoot({ profilesRoot, runtimeProfileId, adapter }));
  if (inspections.some((inspection) => inspection.status === 'BLOCKED')) {
    return { status: 'BLOCKED', inspections, retired: [] };
  }
  const retired = [];
  for (const inspection of inspections.filter((item) => item.status === 'READY')) {
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace(/Z$/, 'Z');
    const archive = path.join(retirementRoot, `${inspection.runtimeProfileId.slice('runtime_profile:'.length)}.retired-${stamp}-${crypto.randomBytes(4).toString('hex')}`);
    if (metadata(archive).exists) throw new Error(`retirement archive collision: ${archive}`);
    fs.renameSync(inspection.root, archive);
    retired.push({ runtimeProfileId: inspection.runtimeProfileId, from: inspection.root, to: archive, reason: 'superseded_before_authentication', namespaceReason: 'canonical_namespace_normalization' });
  }
  return { status: 'OK', inspections, retired };
}

function resolveCatalog(packet) {
  const candidate = resolvedAbsolute(packet.candidateCatalog, 'candidate catalog');
  const info = metadata(candidate);
  if (!info.exists || info.type !== 'file') throw new Error('candidate catalog is missing or invalid');
  return candidate;
}

function safeProfileResult(profile, created, materialized, doctor, login) {
  return {
    runtimeProfileId: profile.runtimeProfileId,
    accountId: profile.accountId,
    role: profile.role,
    preferred: profile.preferred,
    root: profile.root,
    status: 'READY',
    created: created.status,
    materialized: materialized.status,
    doctor: {
      status: doctor.status,
      readiness: doctor.readiness,
      runtimeRoot: doctor.runtimeRoot,
      authenticationStatus: doctor.authentication?.status ?? 'not_probed',
      configurationState: doctor.configuration?.state ?? 'unknown',
      processState: doctor.process?.state ?? 'unknown',
      reasons: doctor.reasons ?? [],
      warnings: doctor.warnings ?? [],
    },
    login: login ? {
      status: login.status,
      executable: login.handoff?.executable ?? null,
      args: login.handoff?.args ?? null,
      envOverlay: login.handoff?.envOverlay ?? null,
      humanMustComplete: login.handoff?.humanMustComplete ?? false,
      managerDoesNotExecute: login.handoff?.managerDoesNotExecute ?? true,
    } : null,
  };
}

async function prepareProfile(profile, catalog, profilesRoot, includeLogin) {
  const common = ['--catalog', catalog, '--profiles-root', profilesRoot, '--profile', profile.runtimeProfileId];
  const created = await runRuntimeProfileManager(['create', ...common, '--execute', '--confirm']);
  if (!['OK', 'NOT_NEEDED'].includes(created.status)) return { status: 'BLOCKED', stage: 'create', runtimeProfileId: profile.runtimeProfileId, reason: 'profile_root_creation_failed', details: created };
  const materialized = await runRuntimeProfileManager(['materialize-config', ...common, '--execute', '--confirm']);
  if (!['OK', 'NOT_NEEDED'].includes(materialized.status)) return { status: 'BLOCKED', stage: 'materialize-config', runtimeProfileId: profile.runtimeProfileId, reason: 'profile_config_materialization_failed', details: materialized };
  const doctor = await runRuntimeProfileManager(['doctor', ...common, '--no-login-probe']);
  if (!['OK', 'NOT_OK'].includes(doctor.status)) return { status: 'BLOCKED', stage: 'doctor', runtimeProfileId: profile.runtimeProfileId, reason: 'profile_doctor_failed', details: doctor };
  const login = includeLogin ? await runRuntimeProfileManager(['login', ...common]) : null;
  if (includeLogin && login.status !== 'READY') return { status: 'BLOCKED', stage: 'login-handoff', runtimeProfileId: profile.runtimeProfileId, reason: 'profile_login_handoff_unavailable', details: login };
  return safeProfileResult(profile, created, materialized, doctor, login);
}

async function executePacket(options) {
  const { packet, packetPath } = loadPacket(options.packet);
  const catalog = resolveCatalog(packet);
  const source = gitState(packet.sourceCheckout);
  if (source.head !== packet.expectedMainSha || source.branch !== 'main' || !source.clean || source.originMain !== packet.expectedOriginMainSha) throw new Error('source main changed, is dirty, or no longer matches the prepared packet');
  const startedAt = new Date().toISOString();
  const results = [];
  let terminal = 'READY_FOR_PROVIDER_LOGIN';
  for (const profile of packet.profiles) {
    let result;
    try {
      result = await prepareProfile(profile, catalog, packet.profilesRoot, options.login);
    } catch (error) {
      result = {
        status: 'BLOCKED',
        stage: 'profile-operation',
        runtimeProfileId: profile.runtimeProfileId,
        reason: 'profile_operation_failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
    results.push(result);
    if (result.status !== 'READY') {
      terminal = 'BLOCKED';
      break;
    }
  }
  const evidencePath = deriveAttemptEvidencePath(packet);
  const evidence = {
    schemaVersion: SCHEMA_VERSION,
    kind: EVIDENCE_KIND,
    handoffId: packet.handoffId,
    attemptId: path.basename(evidencePath, '.evidence.json'),
    phase: 'PROFILE_SCOPED',
    terminal,
    startedAt,
    completedAt: new Date().toISOString(),
    packetPath,
    sourceMainSha: source.head,
    profilesRoot: packet.profilesRoot,
    policy: packet.policy,
    results,
    providerLogin: options.login ? 'waiting_for_provider_login' : 'not_requested',
    deferredMaintenance: {
      canonicalCheckout: 'separate_git_maintenance_not_profile_prerequisite',
      canonicalCatalogAdmission: 'deferred_until_real_identity_and_isolation_evidence',
      keychainEnrollment: 'deferred_until_explicit_brain_owned_credential_selection',
    },
    redaction: {
      secretsExcluded: true,
      oauthRead: false,
      authContentsRead: false,
      keychainValuesRead: false,
      webGptStateRead: false,
      globalProcessProbeUsed: false,
      processesKilled: false,
      sharedDefaultRootMutated: false,
      canonicalCatalogMutated: false,
    },
    previousEvidencePreserved: packet.continuationEvidencePath !== evidencePath,
  };
  writeOwnerOnlyJson(evidencePath, evidence);
  return { status: terminal, evidencePath, evidence };
}

async function main(argv = process.argv.slice(2)) {
  const { operation, options } = parseArgs(argv);
  if (operation === 'prepare') {
    const { packet, packetPath } = buildPacket(options);
    const outputPath = writeOwnerOnlyJson(packetPath, packet);
    process.stdout.write(`PROFILE_LIFECYCLE=PACKET_READY\n${JSON.stringify({ status: packet.status, packetPath: outputPath, profilesRoot: packet.profilesRoot, secretsExcluded: true }, null, 2)}\n`);
    return 0;
  }
  if (operation === 'retire-stale') {
    const result = retireLegacyBootstrapRoots(options);
    process.stdout.write(`PROFILE_LIFECYCLE=RETIRE_${result.status}\n${JSON.stringify(result, null, 2)}\n`);
    return result.status === 'BLOCKED' ? 1 : 0;
  }
  const loaded = loadPacket(options.packet);
  if (operation === 'inspect') {
    process.stdout.write(`PROFILE_LIFECYCLE=INSPECT_OK\n${JSON.stringify({ status: 'OK', handoffId: loaded.packet.handoffId, policy: loaded.packet.policy, profiles: loaded.packet.profiles }, null, 2)}\n`);
    return 0;
  }
  const result = await executePacket(options);
  process.stdout.write(`PROFILE_LIFECYCLE=${result.status}\n${JSON.stringify({
    status: result.status,
    evidencePath: result.evidencePath,
    profiles: result.evidence.results.map((item) => ({ runtimeProfileId: item.runtimeProfileId, status: item.status, stage: item.stage ?? null })),
    login: options.login ? 'waiting_for_provider_login' : 'not_requested',
    loginHandoffs: options.login
      ? result.evidence.results.filter((item) => item.login?.status === 'READY').map((item) => ({
        runtimeProfileId: item.runtimeProfileId,
        executable: item.login.executable,
        args: item.login.args,
        envOverlay: item.login.envOverlay,
      }))
      : [],
  }, null, 2)}\n`);
  return result.status === 'BLOCKED' ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`PROFILE_LIFECYCLE=NOT_OK\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  EVIDENCE_KIND,
  HANDOFF_KIND,
  PROFILE_SPECS,
  SCHEMA_VERSION,
  buildPacket,
  deriveAttemptEvidencePath,
  loadPacket,
  profileRoot,
  retireLegacyBootstrapRoots,
};
