#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadJson } from './context-learning/context-learning-core.mjs';
import { validateIdentityAccessCatalog } from './validate-infrastructure-identity-access.mjs';
import {
  buildLaunchPlan,
  doctorRuntimeProfile,
  executeLaunchPlan,
  listRuntimeProfiles,
} from './runtime-profile-manager/runtime-profile-manager-core.mjs';
import { createCodexCliRuntimeProfileAdapter } from './runtime-profile-manager/codex-cli-adapter.mjs';
import { buildIncrementalProfileVerificationPlan } from './infrastructure-catalog/account-runtime-architecture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_CATALOG = path.join(ROOT, 'operations/infrastructure/catalog/identity-access.v1.json');
const SCHEMA = path.join(ROOT, 'operations/specs/infrastructure-identity-access-v1.schema.json');
const DEFAULT_PROFILES_ROOT = path.join(os.homedir(), '.brain', 'codex-runtime-profiles');

function usage() {
  return [
    'Usage: npm run codex:cli-pilot -- <plan|check|acceptance|launch|launch-check|finalize> [options]',
    '',
    'Options:',
    '  --catalog PATH          Identity & Access catalog (default: canonical catalog)',
    '  --profiles-root PATH    parent directory for dedicated CODEX_HOME roots',
    '  --profile ID            selected profile; repeat for a collection',
    '  --profiles ID,...       comma-separated selected profile collection',
    '  --all-admitted          select every admitted CLI profile in the catalog',
    '  --new-account-profile ID  verify an incremental new-account admission',
    '  --attest-profile ID     explicit operator attestation; repeat for selected profiles',
    '  --acceptance PATH       successful acceptance report required for launch',
    '  --launch-check PATH     successful launch-check report; repeat for finalize',
    '  --baseline PATH         optional legacy default-root observation (never an admission gate)',
    '  --execute --confirm     execute a selected launch after the acceptance gate',
    '  --output PATH           write the non-secret report once, owner-only',
    '',
    'plan is metadata-only. check probes one selected root. acceptance probes a selected collection once, or uses a linear existing/new/recheck sequence.',
    'All admission and launch checks are exact-profile scoped; unrelated processes are not a gate.',
    'No operation performs login, logout, auth-file reads, OAuth copying, route writes, or catalog mutation.',
  ].join('\n');
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = {
    catalog: DEFAULT_CATALOG,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    profiles: [],
    allAdmitted: false,
    newAccountProfile: undefined,
    attestProfiles: [],
    output: undefined,
    acceptance: undefined,
    launchChecks: [],
    baseline: undefined,
    execute: false,
    confirm: false,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const valueOptions = new Map([
      ['--catalog', 'catalog'],
      ['--profiles-root', 'profilesRoot'],
      ['--output', 'output'],
      ['--acceptance', 'acceptance'],
      ['--baseline', 'baseline'],
    ]);
    if (arg === '--attest-profile') {
      const value = rest[++index];
      if (!value) throw new Error('--attest-profile requires a value');
      options.attestProfiles.push(value);
    } else if (arg === '--profile' || arg === '--profiles') {
      const value = rest[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options.profiles.push(...value.split(',').map((entry) => entry.trim()).filter(Boolean));
    } else if (arg === '--all-admitted') {
      options.allAdmitted = true;
    } else if (arg === '--new-account-profile') {
      const value = rest[++index];
      if (!value) throw new Error('--new-account-profile requires a value');
      options.newAccountProfile = value;
    } else if (arg === '--launch-check') {
      const value = rest[++index];
      if (!value) throw new Error('--launch-check requires a value');
      options.launchChecks.push(value);
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--confirm') {
      options.confirm = true;
    } else if (valueOptions.has(arg)) {
      const value = rest[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[valueOptions.get(arg)] = value;
    } else {
      throw new Error(`unknown option: ${arg}\n${usage()}`);
    }
  }
  if (!['plan', 'check', 'acceptance', 'launch', 'launch-check', 'finalize'].includes(operation)) throw new Error(usage());
  if (['check', 'launch', 'launch-check'].includes(operation) && options.profiles.length !== 1) throw new Error(`exactly one --profile is required for ${operation}`);
  if (operation === 'finalize' && options.profiles.length > 0) throw new Error('--profile is not valid for finalize');
  if (operation !== 'acceptance' && options.newAccountProfile) throw new Error('--new-account-profile is only valid for acceptance');
  if (operation !== 'finalize' && options.launchChecks.length > 0) throw new Error('--launch-check is only valid for finalize');
  if (options.execute && !options.confirm) throw new Error('--execute requires --confirm');
  if (options.execute && operation !== 'launch') throw new Error('--execute is only valid for launch');
  if (['launch', 'launch-check'].includes(operation) && !options.acceptance) throw new Error('--acceptance is required for launch operations');
  if (operation === 'finalize' && (!options.acceptance || options.launchChecks.length === 0)) {
    throw new Error('--acceptance and at least one --launch-check are required for finalize');
  }
  if (options.allAdmitted && options.profiles.length > 0) throw new Error('--all-admitted cannot be combined with explicit profiles');
  return { operation, options };
}

function loadCatalog(catalogPath) {
  const schema = loadJson(SCHEMA);
  const catalog = loadJson(path.resolve(catalogPath));
  const validation = validateIdentityAccessCatalog({ schema, catalog, label: '.codex-cli-pilot' });
  if (validation.errors.length > 0) throw new Error(`catalog validation failed:\n${validation.errors.map((error) => `ERROR ${error}`).join('\n')}`);
  return catalog;
}

function profileIndex(catalog) {
  return new Map((catalog.runtimeProfiles ?? []).map((profile) => [profile.runtimeProfileId, profile]));
}

function selectProfileIds(catalog, options, operation) {
  if (['check', 'launch', 'launch-check'].includes(operation)) return [...options.profiles];
  if (operation === 'finalize') return [];
  if (options.profiles.length > 0) return [...new Set(options.profiles)].sort();
  const accounts = new Map((catalog.accounts ?? []).map((account) => [account.accountId, account]));
  return (catalog.runtimeProfiles ?? [])
    .filter((profile) => profile.profileKind === 'cli')
    .filter((profile) => !options.allAdmitted || accounts.get(profile.accountId)?.lifecycleState === 'enrolled')
    .map((profile) => profile.runtimeProfileId)
    .sort();
}

function assertPilotProfiles(catalog, profileIds, { requireNonEmpty = true } = {}) {
  const profiles = profileIndex(catalog);
  if (requireNonEmpty && profileIds.length === 0) throw new Error('no CLI runtime profiles selected; pass --profile/--profiles or admit profiles into the catalog');
  const errors = [];
  for (const profileId of profileIds) {
    const profile = profiles.get(profileId);
    if (!profile) errors.push(`profile_not_found:${profileId}`);
    else {
      if (profile.profileKind !== 'cli') errors.push(`profile_not_cli:${profileId}`);
      if (profile.authenticationStorage?.mode !== 'file') errors.push(`profile_storage_not_file:${profileId}`);
    }
  }
  if (new Set(profileIds).size !== profileIds.length) errors.push('profiles_must_be_distinct');
  if (errors.length > 0) throw new Error(`pilot candidate validation failed: ${errors.join(',')}`);
  return profiles;
}

function makeContext(profilesRoot) {
  return {
    profilesRoot: path.resolve(profilesRoot),
    routeOwnerRef: 'brain:runtime-profile-route-intent',
    routeMutationRequested: false,
    cwd: ROOT,
  };
}

function writeOwnerOnlyReport(file, report) {
  const outputPath = path.resolve(file);
  const descriptor = fs.openSync(outputPath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.fchmodSync(descriptor, 0o600);
  } finally {
    fs.closeSync(descriptor);
  }
  return outputPath;
}

function safePathMetadata(file) {
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

function defaultRootEvidence() {
  return safePathMetadata(path.join(os.homedir(), '.codex'));
}

function profileParentEvidence(profilesRoot, profileIds) {
  const parent = safePathMetadata(profilesRoot);
  if (!parent.exists || parent.type !== 'directory') return { parent, entries: [], unexpectedEntries: [] };
  let entries = [];
  try {
    entries = fs.readdirSync(profilesRoot).sort();
  } catch (error) {
    return { parent, entries: [], unexpectedEntries: [`directory_read_failed:${error?.code ?? 'unknown'}`] };
  }
  const expected = new Set(profileIds.map((profileId) => profileId.slice('runtime_profile:'.length)));
  return {
    parent,
    entries,
    selectedEntries: entries.filter((entry) => expected.has(entry)),
    unselectedEntries: entries.filter((entry) => !expected.has(entry)),
    unexpectedEntries: [],
  };
}

function accountMappingEvidence(catalog) {
  const profilesByAccount = new Map();
  for (const profile of catalog.runtimeProfiles ?? []) {
    const profiles = profilesByAccount.get(profile.accountId) ?? [];
    profiles.push(profile.runtimeProfileId);
    profilesByAccount.set(profile.accountId, profiles);
  }
  const sessionsById = new Map((catalog.sessions ?? []).map((session) => [session.sessionId, session]));
  const accounts = (catalog.accounts ?? []).map((account) => ({
    accountId: account.accountId,
    displayName: account.displayName,
    role: account.accountRole?.class ?? 'unknown',
    isPreferred: account.accountRole?.isPreferred ?? null,
    preferenceRank: account.accountRole?.rank ?? null,
    intendedProfileIds: [...(profilesByAccount.get(account.accountId) ?? [])].sort(),
  }));
  const currentObservedApplicationSessions = (catalog.currentObservedSessionIds ?? []).map((sessionId) => {
    const session = sessionsById.get(sessionId);
    if (!session) return { sessionId, state: 'missing' };
    return {
      sessionId: session.sessionId,
      accountId: session.accountId,
      applicationRef: session.applicationRef,
      sessionKind: session.sessionKind,
      stateOwner: session.stateOwner,
      bindingState: session.binding?.state ?? 'unknown',
      bindingProvenance: session.binding?.provenance?.classification ?? 'UNKNOWN',
      lastKnownState: session.lastKnownState,
      storageMode: session.authenticationStorage?.mode ?? 'unknown',
    };
  });
  return {
    preferredAccountIds: accounts.filter((account) => account.isPreferred === true).map((account) => account.accountId),
    accounts,
    currentObservedApplicationSessions,
  };
}

function loadAcceptanceReport(file) {
  const report = loadJson(path.resolve(file));
  if (report?.operation !== 'acceptance' || report?.status !== 'OK') {
    throw new Error('launch requires a successful codex-cli-pilot acceptance report');
  }
  if (
    report?.controls?.authContentsRead !== false
    || report?.controls?.authCopied !== false
    || report?.controls?.loginExecuted !== false
    || report?.controls?.logoutExecuted !== false
    || report?.controls?.routeMutation !== false
    || report?.controls?.canonicalCatalogMutation !== false
  ) {
    throw new Error('acceptance report has unsafe control markers');
  }
  if (report?.evidence?.profileIsolationProven !== true) {
    throw new Error('acceptance report does not prove profile isolation');
  }
  if (report?.evidence?.sharedDefaultRootPolicy?.mutation !== 'forbidden') {
    throw new Error('acceptance report does not prove shared default-root mutation is forbidden');
  }
  if (report?.evidence?.targetScope !== 'profile_scoped') {
    throw new Error('acceptance report does not prove profile-scoped target operation');
  }
  const selectedProfiles = report?.identity?.selectedProfiles;
  if (!Array.isArray(selectedProfiles) || selectedProfiles.length === 0 || new Set(selectedProfiles).size !== selectedProfiles.length) {
    throw new Error('acceptance report does not identify a distinct selected profile collection');
  }
  const attestedProfiles = report?.identity?.attestedProfiles;
  if (!Array.isArray(attestedProfiles) || new Set(attestedProfiles).size !== selectedProfiles.length || !selectedProfiles.every((profileId) => attestedProfiles.includes(profileId))) {
    throw new Error('acceptance report does not attest every selected profile');
  }
  return report;
}

function loadLaunchCheckReport(file) {
  const report = loadJson(path.resolve(file));
  if (report?.operation !== 'launch-check' || report?.status !== 'OK') {
    throw new Error(`launch-check report is not successful: ${path.resolve(file)}`);
  }
  if (!report?.evidence?.launchCheck?.runtimeProfileId || report?.evidence?.launchCheckResult !== 'pass') {
    throw new Error(`launch-check report has no successful profile evidence: ${path.resolve(file)}`);
  }
  return { ...report, sourcePath: path.resolve(file) };
}

function catalogWithPilotEvidence(catalog, profileIds, acceptancePath) {
  const effective = structuredClone(catalog);
  const profiles = new Set(profileIds);
  const evidenceRef = `pilot-report:${path.basename(acceptancePath)}`;
  for (const profile of effective.runtimeProfiles ?? []) {
    if (!profiles.has(profile.runtimeProfileId)) continue;
    profile.binding = {
      ...profile.binding,
      state: 'user_attested',
      provenance: {
        ...profile.binding.provenance,
        classification: 'USER-PROPOSED',
        evidenceRefs: [...new Set([...(profile.binding.provenance?.evidenceRefs ?? []), evidenceRef])],
      },
    };
    profile.authenticationStorage = {
      ...profile.authenticationStorage,
      isolationState: 'confirmed',
      profileIsolationProven: true,
      provenance: {
        ...profile.authenticationStorage.provenance,
        classification: 'USER-PROPOSED',
        evidenceRefs: [...new Set([...(profile.authenticationStorage.provenance?.evidenceRefs ?? []), evidenceRef])],
      },
    };
  }
  for (const binding of effective.surfaceBindings ?? []) {
    if (!(binding.runtimeProfileIds ?? []).some((profileId) => profiles.has(profileId))) continue;
    binding.binding = {
      ...binding.binding,
      state: 'user_attested',
      provenance: {
        ...binding.binding.provenance,
        classification: 'USER-PROPOSED',
        evidenceRefs: [...new Set([...(binding.binding.provenance?.evidenceRefs ?? []), evidenceRef])],
      },
    };
  }
  return effective;
}

function reportEnvelope({ operation, status, reasons, catalog, profilesRoot, evidence, attestProfiles = [], selectedProfileIds = [] }) {
  return {
    pilotVersion: '2.0.0',
    generatedAt: new Date().toISOString(),
    operation,
    status,
    reasons: [...new Set(reasons)].sort(),
    catalog: {
      catalogId: catalog.catalogId,
      candidateOnly: true,
      canonicalCatalogMutated: false,
    },
    profilesRoot: path.resolve(profilesRoot),
    accountMapping: accountMappingEvidence(catalog),
    evidence: {
      targetScope: 'profile_scoped',
      sharedDefaultRootPolicy: {
        state: 'observe_only',
        mutation: 'forbidden',
        globalProcessProbeUsed: false,
      },
      ...evidence,
    },
    identity: {
      attribution: selectedProfileIds.length > 0 && attestProfiles.length === selectedProfileIds.length ? 'operator_attested' : 'pending_operator_attestation',
      providerPrincipalMachineEvidence: false,
      attestedProfiles: [...new Set(attestProfiles)].sort(),
      selectedProfiles: [...new Set(selectedProfileIds)].sort(),
    },
    controls: {
      secretsExcluded: true,
      authContentsRead: false,
      rawOutputCaptured: false,
      processArgumentsRead: false,
      processMetadataOnly: true,
      loginExecuted: false,
      logoutExecuted: false,
      authCopied: false,
      routeMutation: false,
      canonicalCatalogMutation: false,
      globalProcessProbeUsed: false,
      sharedDefaultRootMutation: false,
      targetRootScoped: true,
    },
  };
}

function safeDoctorEvidence(doctor) {
  return {
    runtimeProfileId: doctor.runtimeProfileId,
    runtimeRoot: doctor.runtimeRoot,
    readiness: doctor.readiness,
    authentication: doctor.authentication,
    security: doctor.security,
    process: doctor.process,
    accountObservation: doctor.accountObservation,
    configuration: doctor.configuration,
    binding: doctor.binding,
    route: doctor.route,
    reasons: doctor.reasons,
    warnings: doctor.warnings,
  };
}

function mechanicalProfileCheck(doctor) {
  const reasons = [];
  if (doctor.status !== 'OK') reasons.push('doctor_not_ok');
  if (doctor.authentication?.status !== 'authenticated') reasons.push('authentication_not_confirmed');
  if (doctor.security?.rootExists !== true || doctor.security?.safe !== true) reasons.push('runtime_root_not_safe');
  if (doctor.security?.authFile?.exists === true && doctor.security?.authFile?.state !== 'owner_only') {
    reasons.push('auth_file_not_owner_only');
  }
  if (doctor.configuration?.state !== 'owned') reasons.push('profile_configuration_not_owned');
  if (!['none', 'not_provisioned', 'active'].includes(doctor.process?.state)) reasons.push(`process_state_${doctor.process?.state ?? 'unknown'}`);
  return [...new Set(reasons)].sort();
}

async function runPilot(argv = process.argv.slice(2), dependencies = {}) {
  const { operation, options } = parseArgs(argv);
  const catalog = dependencies.catalog ?? loadCatalog(options.catalog);
  const adapter = dependencies.adapter ?? createCodexCliRuntimeProfileAdapter({ executable: dependencies.executable ?? 'codex', run: dependencies.run });
  const context = dependencies.context ?? makeContext(options.profilesRoot);
  const profileIds = selectProfileIds(catalog, options, operation);
  if (operation !== 'finalize') assertPilotProfiles(catalog, profileIds);

  let report;
  if (operation === 'plan') {
    const listing = listRuntimeProfiles({ catalog, adapter, context });
    const selected = listing.profiles.filter((profile) => profileIds.includes(profile.runtimeProfileId));
    const roots = selected.map((profile) => profile.runtimeRoot).filter(Boolean);
    const reasons = [];
    if (listing.status !== 'OK') reasons.push('profile_listing_not_ok');
    if (new Set(roots).size !== roots.length) reasons.push('runtime_roots_not_distinct');
    if (selected.length === 0) reasons.push('no_profiles_selected');
    report = reportEnvelope({
      operation,
      status: reasons.length === 0 ? 'OK' : 'NOT_OK',
      reasons,
      catalog,
      profilesRoot: context.profilesRoot,
      evidence: {
        profiles: selected,
        sequence: profileIds,
        storageModeRequired: 'file',
        rootsDistinct: new Set(roots).size === roots.length,
        defaultCodexRoot: defaultRootEvidence(),
        targetScope: 'profile_scoped',
        sharedDefaultRootPolicy: {
          state: 'observe_only',
          mutation: 'forbidden',
          globalProcessProbeUsed: false,
        },
        profileParent: profileParentEvidence(context.profilesRoot, profileIds),
      },
      selectedProfileIds: profileIds,
    });
  } else if (operation === 'check') {
    const profileId = profileIds[0];
    const doctor = await doctorRuntimeProfile({ catalog, profileId, adapter, context, probeAuthentication: true });
    const reasons = mechanicalProfileCheck(doctor);
    const attested = options.attestProfiles.includes(profileId);
    report = reportEnvelope({
      operation,
      status: reasons.length === 0 ? 'OK' : 'NOT_OK',
      reasons,
      catalog,
      profilesRoot: context.profilesRoot,
      evidence: {
        sequence: [profileId],
        profiles: [safeDoctorEvidence(doctor)],
        mechanicalCheck: reasons.length === 0 ? 'pass' : 'fail',
        operatorAttestationRecorded: attested,
        profileIsolationProven: false,
        defaultCodexRoot: defaultRootEvidence(),
        profileParent: profileParentEvidence(context.profilesRoot, profileIds),
      },
      attestProfiles: attested ? [profileId] : [],
      selectedProfileIds: profileIds,
    });
  } else if (operation === 'acceptance') {
    const verificationPlan = buildIncrementalProfileVerificationPlan(profileIds, { newProfileId: options.newAccountProfile });
    const checks = [];
    for (const phase of verificationPlan.phases) {
      for (const profileId of phase.profileIds) {
        const doctor = await doctorRuntimeProfile({ catalog, profileId, adapter, context, probeAuthentication: true });
        checks.push({ phase: phase.phase, doctor });
      }
    }
    const doctorsByProfile = new Map();
    for (const check of checks) doctorsByProfile.set(check.doctor.runtimeProfileId, check.doctor);
    const doctors = [...doctorsByProfile.values()];
    const reasons = checks.flatMap(({ doctor }) => mechanicalProfileCheck(doctor));
    const distinctRoots = new Set(doctors.map((doctor) => doctor.runtimeRoot)).size === profileIds.length;
    if (!distinctRoots) reasons.push('runtime_roots_not_distinct');
    const attestProfiles = [...new Set(options.attestProfiles.filter((profileId) => profileIds.includes(profileId)))].sort();
    if (attestProfiles.length !== profileIds.length) reasons.push('operator_attestation_required_for_each_selected_profile');
    const defaultAfter = defaultRootEvidence();
    let legacyBaselineComparison = { state: 'not_requested', changed: null };
    if (options.baseline) {
      const baseline = loadJson(path.resolve(options.baseline));
      const defaultBefore = baseline?.evidence?.defaultCodexRoot;
      if (baseline?.operation !== 'plan' || baseline?.status !== 'OK' || !defaultBefore) {
        legacyBaselineComparison = { state: 'invalid_observation', changed: null };
      } else {
        const comparable = ['path', 'exists', 'type', 'ownerUid', 'mode', 'size', 'mtimeMs'];
        const changed = comparable.some((field) => defaultBefore[field] !== defaultAfter[field]);
        legacyBaselineComparison = { state: changed ? 'changed' : 'unchanged', changed };
      }
    }
    const parent = profileParentEvidence(context.profilesRoot, profileIds);
    report = reportEnvelope({
      operation,
      status: reasons.length === 0 ? 'OK' : 'NOT_OK',
      reasons,
      catalog,
      profilesRoot: context.profilesRoot,
      evidence: {
        sequence: checks.map(({ phase, doctor }) => ({ phase, runtimeProfileId: doctor.runtimeProfileId })),
        profiles: doctors.map(safeDoctorEvidence),
        rootsDistinct: distinctRoots,
        defaultCodexRoot: defaultAfter,
        targetScope: 'profile_scoped',
        sharedDefaultRootPolicy: {
          state: 'observe_only',
          mutation: 'forbidden',
          globalProcessProbeUsed: false,
        },
        defaultProfileComparison: { state: 'not_required', changed: null },
        legacyBaselineComparison,
        profileParent: parent,
        mechanicalCheck: reasons.length === 0 ? 'pass' : 'fail',
        profileIsolationProven: reasons.length === 0,
        concurrency: 'not_tested_and_not_authorized',
        persistence: verificationPlan,
      },
      attestProfiles,
      selectedProfileIds: profileIds,
    });
  } else if (operation === 'finalize') {
    const acceptance = loadAcceptanceReport(options.acceptance);
    const acceptedProfiles = [...new Set(acceptance.identity?.selectedProfiles ?? acceptance.identity?.attestedProfiles ?? [])].sort();
    assertPilotProfiles(catalog, acceptedProfiles);
    const launchReports = options.launchChecks.map((file) => loadLaunchCheckReport(file));
    const launchByProfile = new Map();
    for (const launch of launchReports) {
      if (launchByProfile.has(launch.evidence.launchCheck.runtimeProfileId)) throw new Error(`duplicate launch-check report for ${launch.evidence.launchCheck.runtimeProfileId}`);
      launchByProfile.set(launch.evidence.launchCheck.runtimeProfileId, launch);
    }
    for (const profileId of acceptedProfiles) if (!launchByProfile.has(profileId)) throw new Error(`missing launch-check report for ${profileId}`);
    const effectiveCatalog = catalogWithPilotEvidence(catalog, acceptedProfiles, options.acceptance);
    const doctors = [];
    for (const profileId of acceptedProfiles) {
      doctors.push(await doctorRuntimeProfile({ catalog: effectiveCatalog, profileId, adapter, context, probeAuthentication: true }));
    }
    const reasons = doctors.flatMap(mechanicalProfileCheck);
    for (const doctor of doctors) {
      if (doctor.readiness !== 'ready_for_account_use') reasons.push(`profile_not_ready_for_account_use:${doctor.runtimeProfileId}`);
    }
    if (new Set(doctors.map((doctor) => doctor.runtimeRoot)).size !== acceptedProfiles.length) reasons.push('runtime_roots_not_distinct');
    const parent = profileParentEvidence(context.profilesRoot, acceptedProfiles);
    const defaultAfter = defaultRootEvidence();
    report = reportEnvelope({
      operation,
      status: reasons.length === 0 ? 'OK' : 'NOT_OK',
      reasons,
      catalog,
      profilesRoot: context.profilesRoot,
      evidence: {
        profiles: doctors.map(safeDoctorEvidence),
        coexistence: acceptance.evidence,
        sequentialLaunch: {
          profiles: acceptedProfiles.map((profileId) => ({ status: 'proven', report: launchByProfile.get(profileId).sourcePath, evidence: launchByProfile.get(profileId).evidence.launchCheck })),
        },
        rootsDistinct: new Set(doctors.map((doctor) => doctor.runtimeRoot)).size === acceptedProfiles.length,
        defaultCodexRoot: defaultAfter,
        targetScope: 'profile_scoped',
        sharedDefaultRootPolicy: {
          state: 'observe_only',
          mutation: 'forbidden',
          globalProcessProbeUsed: false,
        },
        profileParent: parent,
        concurrency: 'not_tested_and_not_authorized',
        route: doctors.map((doctor) => doctor.route),
        webGpt: 'untouched_by_pilot',
        mechanicalCheck: reasons.length === 0 ? 'pass' : 'fail',
      },
      attestProfiles: acceptance.identity?.attestedProfiles ?? [],
      selectedProfileIds: acceptedProfiles,
    });
  } else {
    const acceptance = loadAcceptanceReport(options.acceptance);
    const acceptedProfiles = new Set(acceptance.identity?.attestedProfiles ?? []);
    const profileId = profileIds[0];
    const reasons = acceptedProfiles.has(profileId) ? [] : ['profile_not_attested_in_acceptance_report'];
    const effectiveCatalog = catalogWithPilotEvidence(catalog, [profileId], options.acceptance);
    const plan = await buildLaunchPlan({ catalog: effectiveCatalog, profileId, adapter, context, bootstrap: false });
    reasons.push(...(plan.reasons ?? []));
    let execution = null;
    let status = reasons.length === 0 ? 'READY' : 'BLOCKED';
    if (options.execute && status === 'READY') {
      execution = executeLaunchPlan({ plan, adapter, context });
      status = execution.status;
    }
    report = reportEnvelope({
      operation,
      status,
      reasons,
      catalog,
      profilesRoot: context.profilesRoot,
      evidence: {
        sequence: [profileId],
        acceptanceReport: path.resolve(options.acceptance),
        launchPlan: {
          status: plan.status,
          runtimeProfileId: plan.runtimeProfileId,
          runtimeRoot: plan.runtimeRoot,
          command: plan.command,
          processPolicy: plan.processPolicy,
          route: plan.route,
        },
        execution,
        defaultCodexRoot: defaultRootEvidence(),
        targetScope: 'profile_scoped',
        sharedDefaultRootPolicy: {
          state: 'observe_only',
          mutation: 'forbidden',
          globalProcessProbeUsed: false,
        },
      },
      attestProfiles: acceptedProfiles.has(profileId) ? [profileId] : [],
      selectedProfileIds: [profileId],
    });
    if (operation === 'launch-check') {
      const doctor = await doctorRuntimeProfile({ catalog: effectiveCatalog, profileId, adapter, context, probeAuthentication: true });
      const checkReasons = mechanicalProfileCheck(doctor);
      if (doctor.readiness !== 'ready_for_account_use') checkReasons.push('profile_not_ready_for_account_use');
      report.status = checkReasons.length === 0 ? 'OK' : 'NOT_OK';
      report.reasons = [...new Set(checkReasons)].sort();
      report.evidence.launchCheck = safeDoctorEvidence(doctor);
      report.evidence.launchCheckResult = report.status === 'OK' ? 'pass' : 'fail';
    }
  }

  if (options.output) {
    if (operation === 'plan' && report.status !== 'OK') {
      report.outputSuppressedReason = 'baseline_not_written_plan_not_ok';
    } else {
      report.outputPath = writeOwnerOnlyReport(options.output, report);
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPilot().then((report) => {
    process.stdout.write(`CODEX_CLI_PILOT=${report.status}\n${JSON.stringify(report, null, 2)}\n`);
    if (!['OK', 'READY', 'STARTED'].includes(report.status)) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { runPilot };
