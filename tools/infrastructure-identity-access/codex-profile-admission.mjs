import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateIdentityAccessCatalog } from '../validate-infrastructure-identity-access.mjs';

const RAW_ACCESS_KEYS = new Set([
  'value', 'token', 'password', 'secret', 'apikey', 'api_key', 'privatekey', 'private_key',
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken', 'client_secret', 'clientsecret',
]);

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]));
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function scanRawAccessKeys(value, label, errors, keyPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanRawAccessKeys(entry, label, errors, `${keyPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (RAW_ACCESS_KEYS.has(key.toLowerCase())) errors.push(`${label}: forbidden raw-access field ${keyPath}.${key}`);
    scanRawAccessKeys(child, label, errors, `${keyPath}.${key}`);
  }
}

function evidenceRef(acceptanceReport) {
  return `codex-cli-pilot-finalize:${path.basename(acceptanceReport)}`;
}

function withEvidence(provenance, ref, now) {
  const verifiedAt = new Date(now).toISOString();
  return {
    ...provenance,
    verifiedAt,
    freshnessDeadline: new Date(Date.parse(verifiedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
    evidenceRefs: unique([...(provenance?.evidenceRefs ?? []), ref]),
  };
}

function setAttestedBinding(binding, ref, now) {
  return {
    ...binding,
    state: 'user_attested',
    provenance: withEvidence(binding?.provenance, ref, now),
  };
}

function mergeRecords(existing, proposed, idField, errors) {
  const byId = new Map((existing ?? []).map((record) => [record[idField], record]));
  for (const record of proposed ?? []) {
    const prior = byId.get(record[idField]);
    if (prior && !same(prior, record)) errors.push(`catalog_id_conflict:${record[idField]}`);
    else if (!prior) byId.set(record[idField], record);
  }
  return [...byId.values()].sort((left, right) => left[idField].localeCompare(right[idField]));
}

function assertAcceptanceReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return ['acceptance_report_missing'];
  if (report.operation !== 'finalize' || report.status !== 'OK') errors.push('acceptance_report_not_successful_finalize');
  if (report.catalog?.candidateOnly !== true || report.catalog?.canonicalCatalogMutated !== false) errors.push('acceptance_report_catalog_controls_invalid');
  if (report.identity?.attribution !== 'operator_attested') errors.push('operator_attestation_not_complete');
  const selected = report.identity?.selectedProfiles;
  const attested = report.identity?.attestedProfiles;
  if (!Array.isArray(selected) || selected.length === 0 || new Set(selected).size !== selected.length) errors.push('selected_profile_collection_missing_or_duplicate');
  if (!Array.isArray(selected) || !Array.isArray(attested) || !selected.every((profileId) => attested.includes(profileId))) errors.push('every_selected_profile_must_be_attested');
  if (report.evidence?.targetScope !== 'profile_scoped') errors.push('profile_scoped_target_evidence_missing');
  if (report.evidence?.profileIsolationProven !== true) errors.push('profile_isolation_evidence_missing');
  if (report.evidence?.rootsDistinct !== true) errors.push('distinct_runtime_root_evidence_missing');
  if (report.evidence?.sharedDefaultRootPolicy?.mutation !== 'forbidden') errors.push('shared_default_root_mutation_not_forbidden');
  const unsafeControls = [
    ['authContentsRead', false], ['authCopied', false], ['loginExecuted', false], ['logoutExecuted', false],
    ['routeMutation', false], ['canonicalCatalogMutation', false], ['sharedDefaultRootMutation', false],
  ];
  for (const [key, expected] of unsafeControls) if (report.controls?.[key] !== expected) errors.push(`unsafe_control:${key}`);
  const profiles = new Map((report.evidence?.profiles ?? []).map((profile) => [profile.runtimeProfileId, profile]));
  for (const profileId of selected ?? []) {
    const profile = profiles.get(profileId);
    if (!profile) errors.push(`missing_final_profile_evidence:${profileId}`);
    else {
      if (profile.authentication?.status !== 'authenticated') errors.push(`profile_not_authenticated:${profileId}`);
      if (profile.security?.rootExists !== true || profile.security?.safe !== true) errors.push(`profile_root_not_safe:${profileId}`);
      if (profile.configuration?.state !== 'owned') errors.push(`profile_configuration_not_owned:${profileId}`);
    }
  }
  return unique(errors);
}

function selectedClosure(candidate, selectedProfileIds, ref, now) {
  const selected = new Set(selectedProfileIds);
  const profiles = (candidate.runtimeProfiles ?? []).filter((profile) => selected.has(profile.runtimeProfileId));
  const selectedRuntimeInstanceIds = new Set(profiles.flatMap((profile) => profile.runtimeInstanceIds ?? []));
  const accountIds = new Set(profiles.map((profile) => profile.accountId).filter(Boolean));
  const bindingIds = new Set(profiles.map((profile) => profile.surfaceBindingId).filter(Boolean));
  const sessions = (candidate.sessions ?? []).filter((session) => selected.has(session.runtimeProfileId));
  sessions.forEach((session) => {
    if (session.surfaceBindingId) bindingIds.add(session.surfaceBindingId);
    if (session.accountId) accountIds.add(session.accountId);
  });
  const credentials = (candidate.credentials ?? []).filter((credential) => accountIds.has(credential.accountId));
  if (credentials.length > 0) throw new Error('credential_records_require_the_separate_keychain_admission_flow');

  const admittedProfiles = profiles.map((profile) => ({
    ...profile,
    runtimeInstanceIds: (profile.runtimeInstanceIds ?? []).filter((instanceId) => selectedRuntimeInstanceIds.has(instanceId)),
    binding: setAttestedBinding(profile.binding, ref, now),
    authenticationStorage: {
      ...profile.authenticationStorage,
      isolationState: 'confirmed',
      profileIsolationProven: true,
      healthState: 'healthy',
      provenance: withEvidence(profile.authenticationStorage?.provenance, ref, now),
    },
    // The final pilot proves sequential profile isolation, not concurrent authenticated use.
    switchPolicy: {
      ...profile.switchPolicy,
      allowsConcurrentProfiles: false,
      concurrencySupport: 'unknown',
      maxConcurrentProfiles: null,
    },
    provenance: withEvidence(profile.provenance, ref, now),
  }));
  const admittedAccounts = (candidate.accounts ?? []).filter((account) => accountIds.has(account.accountId)).map((account) => ({
    ...account,
    lifecycleState: 'enrolled',
    credentialIds: [],
    sessionIds: (account.sessionIds ?? []).filter((sessionId) => sessions.some((session) => session.sessionId === sessionId)),
    surfaceBindingIds: (account.surfaceBindingIds ?? []).filter((surfaceBindingId) => bindingIds.has(surfaceBindingId)),
    runtimeProfileIds: (account.runtimeProfileIds ?? []).filter((profileId) => selected.has(profileId)),
    provenance: withEvidence(account.provenance, ref, now),
  }));
  const admittedBindings = (candidate.surfaceBindings ?? []).filter((binding) => bindingIds.has(binding.surfaceBindingId)).map((binding) => ({
    ...binding,
    lifecycleState: 'enrolled',
    binding: setAttestedBinding(binding.binding, ref, now),
    sessionIds: (binding.sessionIds ?? []).filter((sessionId) => sessions.some((session) => session.sessionId === sessionId)),
    runtimeProfileIds: (binding.runtimeProfileIds ?? []).filter((profileId) => selected.has(profileId)),
    capabilityEvidence: {
      ...(binding.capabilityEvidence ?? {}),
      isolatedRuntime: 'supported',
      authIsolation: 'supported',
      concurrentProfiles: 'unknown',
    },
    provenance: withEvidence(binding.provenance, ref, now),
  }));
  const admittedSessions = sessions.map((session) => ({
    ...session,
    binding: setAttestedBinding(session.binding, ref, now),
    provenance: withEvidence(session.provenance, ref, now),
  }));
  const admittedRuntimeInstances = (candidate.runtimeInstances ?? []).filter((instance) => selectedRuntimeInstanceIds.has(instance.runtimeInstanceId)).map((instance) => ({
    ...instance,
    lifecycleState: 'enrolled',
    binding: setAttestedBinding(instance.binding, ref, now),
    authenticationStorage: {
      ...instance.authenticationStorage,
      isolationState: 'confirmed',
      profileIsolationProven: true,
      healthState: 'healthy',
      provenance: withEvidence(instance.authenticationStorage?.provenance, ref, now),
    },
    provenance: withEvidence(instance.provenance, ref, now),
  }));
  const admittedAccessPaths = (candidate.accessPaths ?? []).filter((accessPath) => accessPath.runtimeInstanceIds?.every((instanceId) => selectedRuntimeInstanceIds.has(instanceId))).map((accessPath) => ({
    ...accessPath,
    provenance: withEvidence(accessPath.provenance, ref, now),
  }));
  const lifecyclePolicyIds = new Set(admittedProfiles.map((profile) => profile.lifecyclePolicyId));
  const verificationPolicyIds = new Set(admittedAccounts.map((account) => account.verificationPolicyId));
  return {
    accounts: admittedAccounts,
    credentials: [],
    sessions: admittedSessions,
    surfaceBindings: admittedBindings,
    runtimeProfiles: admittedProfiles,
    runtimeInstances: admittedRuntimeInstances,
    accessPaths: admittedAccessPaths,
    secretStoreAdapters: [],
    lifecyclePolicies: (candidate.lifecyclePolicies ?? []).filter((policy) => lifecyclePolicyIds.has(policy.lifecyclePolicyId)).map((policy) => ({ ...policy, provenance: withEvidence(policy.provenance, ref, now) })),
    verificationPolicies: (candidate.verificationPolicies ?? []).filter((policy) => verificationPolicyIds.has(policy.verificationPolicyId)).map((policy) => ({ ...policy, provenance: withEvidence(policy.provenance, ref, now) })),
  };
}

export function buildCodexProfileAdmissionPlan({ canonicalCatalog, candidateCatalog, acceptanceReport, acceptanceReportPath = 'acceptance-report.json', schema, now = new Date() } = {}) {
  const reportSecretErrors = [];
  scanRawAccessKeys(acceptanceReport, '.acceptance', reportSecretErrors);
  const reasons = [
    ...assertAcceptanceReport(acceptanceReport),
    ...reportSecretErrors,
  ];
  const candidateValidation = validateIdentityAccessCatalog({ schema, catalog: candidateCatalog, label: '.candidate' });
  const canonicalValidation = validateIdentityAccessCatalog({ schema, catalog: canonicalCatalog, label: '.canonical' });
  reasons.push(...candidateValidation.errors, ...canonicalValidation.errors);
  const selectedProfileIds = acceptanceReport?.identity?.selectedProfiles ?? [];
  const candidateProfileIds = new Set((candidateCatalog?.runtimeProfiles ?? []).map((profile) => profile.runtimeProfileId));
  for (const profileId of selectedProfileIds) if (!candidateProfileIds.has(profileId)) reasons.push(`selected_profile_not_in_candidate_catalog:${profileId}`);
  const candidateProfilesById = new Map((candidateCatalog?.runtimeProfiles ?? []).map((profile) => [profile.runtimeProfileId, profile]));
  for (const profileId of selectedProfileIds) {
    const profile = candidateProfilesById.get(profileId);
    if (!profile) continue;
    if (profile.profileKind !== 'cli' || profile.runtimeAdapterRef !== 'runtime_adapter:codex-cli') reasons.push(`unsupported_profile_surface:${profileId}`);
    if (!profile.accountId || !profile.surfaceBindingId) reasons.push(`profile_identity_binding_incomplete:${profileId}`);
  }
  if (reasons.length > 0) return { status: 'BLOCKED', reasons: unique(reasons), selectedProfileIds: unique(selectedProfileIds) };

  let closure;
  try {
    closure = selectedClosure(candidateCatalog, selectedProfileIds, evidenceRef(acceptanceReportPath), now);
  } catch (error) {
    return { status: 'BLOCKED', reasons: [error instanceof Error ? error.message : String(error)], selectedProfileIds: unique(selectedProfileIds) };
  }
  const mergeErrors = [];
  const mergedCatalog = {
    ...structuredClone(canonicalCatalog),
    catalogVersion: (() => {
      const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(canonicalCatalog.catalogVersion ?? '0.1.0');
      return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : canonicalCatalog.catalogVersion;
    })(),
    accounts: mergeRecords(canonicalCatalog.accounts, closure.accounts, 'accountId', mergeErrors),
    credentials: mergeRecords(canonicalCatalog.credentials, closure.credentials, 'credentialId', mergeErrors),
    sessions: mergeRecords(canonicalCatalog.sessions, closure.sessions, 'sessionId', mergeErrors),
    surfaceBindings: mergeRecords(canonicalCatalog.surfaceBindings, closure.surfaceBindings, 'surfaceBindingId', mergeErrors),
    runtimeProfiles: mergeRecords(canonicalCatalog.runtimeProfiles, closure.runtimeProfiles, 'runtimeProfileId', mergeErrors),
    runtimeInstances: mergeRecords(canonicalCatalog.runtimeInstances, closure.runtimeInstances, 'runtimeInstanceId', mergeErrors),
    accessPaths: mergeRecords(canonicalCatalog.accessPaths, closure.accessPaths, 'accessPathId', mergeErrors),
    secretStoreAdapters: mergeRecords(canonicalCatalog.secretStoreAdapters, closure.secretStoreAdapters, 'adapterId', mergeErrors),
    lifecyclePolicies: mergeRecords(canonicalCatalog.lifecyclePolicies, closure.lifecyclePolicies, 'lifecyclePolicyId', mergeErrors),
    verificationPolicies: mergeRecords(canonicalCatalog.verificationPolicies, closure.verificationPolicies, 'verificationPolicyId', mergeErrors),
    provenance: withEvidence(canonicalCatalog.provenance, evidenceRef(acceptanceReportPath), now),
  };
  if (mergeErrors.length > 0) return { status: 'BLOCKED', reasons: unique(mergeErrors), selectedProfileIds: unique(selectedProfileIds) };
  const mergedValidation = validateIdentityAccessCatalog({ schema, catalog: mergedCatalog, label: '.admitted' });
  if (mergedValidation.errors.length > 0) return { status: 'BLOCKED', reasons: unique(mergedValidation.errors), selectedProfileIds: unique(selectedProfileIds) };
  return {
    status: 'READY',
    reasons: [],
    selectedProfileIds: unique(selectedProfileIds),
    evidenceRef: evidenceRef(acceptanceReportPath),
    changes: {
      accounts: closure.accounts.map((record) => record.accountId),
      surfaceBindings: closure.surfaceBindings.map((record) => record.surfaceBindingId),
      runtimeProfiles: closure.runtimeProfiles.map((record) => record.runtimeProfileId),
      runtimeInstances: closure.runtimeInstances.map((record) => record.runtimeInstanceId),
      accessPaths: closure.accessPaths.map((record) => record.accessPathId),
      sessions: closure.sessions.map((record) => record.sessionId),
      credentials: [],
    },
    controls: {
      oauthRead: false,
      oauthCopied: false,
      keychainRead: false,
      webGptTouched: false,
      defaultCodexRootTouched: false,
      rawSecrets: false,
    },
    mergedCatalog,
  };
}

export function applyCodexProfileAdmission({ plan, targetPath, backupDir = path.join(os.homedir(), '.brain', 'backups', 'identity-access-admission'), now = new Date() } = {}) {
  if (plan?.status !== 'READY') throw new Error(`admission blocked: ${(plan?.reasons ?? ['unknown']).join(',')}`);
  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedTarget)) throw new Error(`catalog target does not exist: ${resolvedTarget}`);
  const targetStat = fs.lstatSync(resolvedTarget);
  if (!targetStat.isFile() || targetStat.isSymbolicLink()) throw new Error(`catalog target must be a regular file: ${resolvedTarget}`);
  const resolvedBackupDir = path.resolve(backupDir);
  fs.mkdirSync(resolvedBackupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(resolvedBackupDir, 0o700);
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupPath = path.join(resolvedBackupDir, `${path.basename(resolvedTarget)}.${stamp}.bak`);
  fs.copyFileSync(resolvedTarget, backupPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backupPath, 0o600);
  const temporaryPath = `${resolvedTarget}.admission-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(plan.mergedCatalog, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(temporaryPath, 0o600);
    const staged = JSON.parse(fs.readFileSync(temporaryPath, 'utf8'));
    if (!same(staged, plan.mergedCatalog)) throw new Error('staged catalog readback did not match the validated admission plan');
    fs.renameSync(temporaryPath, resolvedTarget);
    fs.chmodSync(resolvedTarget, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
  return { status: 'OK', targetPath: resolvedTarget, backupPath, catalogVersion: plan.mergedCatalog.catalogVersion };
}
