#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { runRuntimeProfileManager } from './runtime-profile-manager.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FALLBACK_CATALOG = path.join(ROOT, 'operations/fixtures/infrastructure-codex-cli-pilot-candidates-v1.json');
const DEFAULT_PROFILES_ROOT = path.join(process.env.HOME || '', '.brain', 'codex-runtime-profiles');
const SHARED_DEFAULT_ROOT = path.join(process.env.HOME || '', '.codex');

function usage() {
  return [
    'Usage: node tools/codex-identity-lifecycle-handoff.mjs <inspect|execute> --packet PATH [--confirm] [--login]',
    '',
    'This coordinator is profile-scoped. It does not require global Codex/ChatGPT/WebGPT shutdown.',
    'It never mutates the shared default ~/.codex root or WebGPT-owned route/session state.',
    '--login emits official per-profile login handoffs only; it does not perform OAuth itself.',
  ].join('\n');
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = { packet: null, confirm: false, login: false };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--confirm') options.confirm = true;
    else if (arg === '--login') options.login = true;
    else if (arg === '--packet') options.packet = rest[++index] ?? null;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!['inspect', 'execute'].includes(operation)) throw new Error(usage());
  if (!options.packet) throw new Error('--packet is required');
  if (operation === 'execute' && !options.confirm) throw new Error('execute requires --confirm');
  return { operation, options };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafePacket(packet) {
  if (packet?.kind !== 'brain.codex.identity.lifecycle-handoff') throw new Error('unsupported handoff packet kind');
  if (!Array.isArray(packet.profiles) || packet.profiles.length === 0) throw new Error('handoff packet contains no profiles');
  const profilesRoot = path.resolve(packet.profilesRoot || DEFAULT_PROFILES_ROOT);
  if (path.resolve(profilesRoot) === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error('profiles root may not be shared ~/.codex');
  for (const profile of packet.profiles) {
    if (!profile.runtimeProfileId || !profile.root) throw new Error('profile missing runtimeProfileId/root');
    if (!isInside(profilesRoot, profile.root)) throw new Error(`profile root escapes profiles root: ${profile.runtimeProfileId}`);
    if (path.resolve(profile.root) === path.resolve(SHARED_DEFAULT_ROOT)) throw new Error(`profile targets shared ~/.codex: ${profile.runtimeProfileId}`);
  }
  if (packet.configOwnership?.sharedDefaultRoot && packet.configOwnership.sharedDefaultRoot !== 'application_owned_observe_only') {
    throw new Error('handoff packet requests unsupported shared-root ownership');
  }
  if (packet.configOwnership?.webGpt && packet.configOwnership.webGpt !== 'separate_application_owned_surface') {
    throw new Error('handoff packet requests unsupported WebGPT ownership');
  }
  return profilesRoot;
}

function resolveCatalog(packet) {
  const candidates = [packet.candidateCatalog, FALLBACK_CATALOG].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  throw new Error('no usable candidate catalog for profile-local lifecycle operation');
}

export function deriveAttemptEvidencePath(packet) {
  const original = packet.continuationEvidencePath || packet.rollback?.evidencePath;
  const parent = original ? path.dirname(original) : path.join(process.env.HOME || '', '.brain', 'codex-identity-handoff');
  const stem = original ? path.basename(original, '.json').replace(/\.evidence$/, '') : packet.handoffId;
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
  let candidate = path.join(parent, `${stem}.attempt-${timestamp}-${process.pid}.evidence.json`);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${stem}.attempt-${timestamp}-${process.pid}-${suffix++}.evidence.json`);
  }
  return candidate;
}

export function buildProfileScopedPlan(packet) {
  const profilesRoot = assertSafePacket(packet);
  return {
    schemaVersion: '1.1.0',
    kind: 'brain.codex.identity.lifecycle-handoff-plan',
    handoffId: packet.handoffId,
    policy: {
      lifecycleScope: 'profile_scoped',
      globalProcessQuiescenceRequired: false,
      targetProfileLeaseRequired: true,
      sharedDefaultRootMutation: false,
      webGptMutation: false,
      oauthReadOrCopy: false,
      canonicalCheckoutRelocationRequired: false,
      sharedRootMaintenanceContract: 'operations/scripts/codex-home-managed-root.sh',
    },
    profilesRoot,
    profiles: packet.profiles.map((profile) => ({
      accountId: profile.accountId ?? null,
      runtimeProfileId: profile.runtimeProfileId,
      role: profile.role ?? null,
      preferred: Boolean(profile.preferred),
      root: path.resolve(profile.root),
      operations: ['create_or_verify_root', 'materialize_owned_config', 'build_official_login_handoff'],
    })),
    ignoredLegacyGlobalPredicates: [...(packet.processAbsencePredicates ?? [])],
    deferredMaintenance: {
      canonicalCheckoutRelocation: packet.canonicalCheckout ? 'separate_git_maintenance_not_profile_prerequisite' : 'not_requested',
      sharedDefaultRoot: 'observe_only',
      webGpt: 'application_owned_untouched',
    },
  };
}

async function executeProfile({ profile, catalog, profilesRoot, includeLogin }) {
  const common = ['--catalog', catalog, '--profiles-root', profilesRoot, '--profile', profile.runtimeProfileId];
  const created = await runRuntimeProfileManager(['create', ...common, '--execute', '--confirm']);
  if (!['OK', 'NOT_NEEDED'].includes(created.status)) {
    return { runtimeProfileId: profile.runtimeProfileId, status: 'BLOCKED', stage: 'create', created };
  }

  const materialized = await runRuntimeProfileManager(['materialize-config', ...common, '--execute', '--confirm']);
  if (!['OK', 'NOT_NEEDED'].includes(materialized.status)) {
    return { runtimeProfileId: profile.runtimeProfileId, status: 'BLOCKED', stage: 'materialize-config', created, materialized };
  }

  const doctor = await runRuntimeProfileManager(['doctor', ...common, '--no-login-probe']);
  const result = {
    runtimeProfileId: profile.runtimeProfileId,
    status: 'READY',
    stage: 'prepared',
    readiness: 'prepared_for_login',
    created,
    materialized,
    doctor,
    diagnostics: {
      doctorStatus: doctor.status,
      doctorReadiness: doctor.readiness,
      doctorReasons: [...(doctor.reasons ?? [])],
      unknownIsNotHealthy: true,
    },
  };
  if (includeLogin) {
    result.login = await runRuntimeProfileManager(['login', ...common]);
    if (result.login.status !== 'READY') {
      result.status = 'BLOCKED';
      result.stage = 'login-handoff';
      result.readiness = 'login_handoff_blocked';
    } else {
      result.readiness = 'login_handoff_ready';
    }
  }
  return result;
}

export async function runIdentityLifecycleHandoff(argv = process.argv.slice(2)) {
  const { operation, options } = parseArgs(argv);
  const packet = readJson(path.resolve(options.packet));
  const plan = buildProfileScopedPlan(packet);
  if (operation === 'inspect') return { status: 'READY', plan };

  const catalog = resolveCatalog(packet);
  const attemptEvidencePath = deriveAttemptEvidencePath(packet);
  const startedAt = new Date().toISOString();
  const results = [];
  let terminal = 'HANDOFF_OK';

  try {
    for (const profile of plan.profiles) {
      const result = await executeProfile({ profile, catalog, profilesRoot: plan.profilesRoot, includeLogin: options.login });
      results.push(result);
      if (result.status !== 'READY') {
        terminal = 'HANDOFF_BLOCKED';
        break;
      }
    }
  } catch (error) {
    terminal = 'HANDOFF_BLOCKED';
    results.push({ status: 'BLOCKED', stage: 'exception', reason: error instanceof Error ? error.message : String(error) });
  }

  const evidence = {
    schemaVersion: '1.1.0',
    kind: 'brain.codex.identity.lifecycle-handoff-evidence',
    handoffId: packet.handoffId,
    attemptId: path.basename(attemptEvidencePath, '.evidence.json'),
    terminal,
    startedAt,
    completedAt: new Date().toISOString(),
    policy: plan.policy,
    catalog: path.relative(ROOT, catalog) || path.basename(catalog),
    profilesRoot: plan.profilesRoot,
    results,
    deferredMaintenance: plan.deferredMaintenance,
    previousEvidencePreserved: Boolean(packet.continuationEvidencePath && fs.existsSync(packet.continuationEvidencePath)),
    redaction: { secretsExcluded: true, oauthRead: false, authContentsRead: false, webGptStateRead: false },
  };
  writeJsonAtomic(attemptEvidencePath, evidence);
  return { status: terminal === 'HANDOFF_OK' ? 'OK' : 'BLOCKED', terminal, attemptEvidencePath, evidence };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIdentityLifecycleHandoff().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'BLOCKED') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
