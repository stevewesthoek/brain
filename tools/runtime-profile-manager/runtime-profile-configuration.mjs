import fs from 'node:fs';
import path from 'node:path';
import {
  applyAtomicTextConfiguration,
  planConfigurationMutations,
  readFileRevision,
} from '../lib/configuration-ownership.mjs';

export const RUNTIME_PROFILE_CONFIGURATION_VERSION = '1.0.0';
export const BRAIN_PROFILE_CONFIG_WRITER = 'brain:runtime-profile-config-materializer';

const OWNERSHIP_FILE_MODE = 0o600;

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function isPathWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeLstat(file) {
  try {
    const stat = fs.lstatSync(file);
    return {
      exists: true,
      type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : stat.isSymbolicLink() ? 'symlink' : 'other',
      ownerUid: stat.uid,
      mode: stat.mode & 0o777,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (error) {
    return { exists: false, reason: error?.code ?? 'stat_failed' };
  }
}

function ownerOnlyMetadata(file) {
  const metadata = safeLstat(file);
  if (!metadata.exists) return metadata;
  return {
    ...metadata,
    safe: metadata.type === 'file'
      && metadata.ownerUid === process.getuid?.()
      && (metadata.mode & 0o077) === 0,
  };
}

function readOwnership(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function configurationOwnershipPath(configPath) {
  return `${path.resolve(configPath)}.brain-ownership.json`;
}

export function buildRuntimeProfileConfigurationArtifact({ profile, root, configPath, context = {} } = {}) {
  if (!profile?.runtimeProfileId) throw new Error('runtime profile is required');
  if (!root) throw new Error('runtime profile root is required');
  const resolvedConfigPath = path.resolve(configPath ?? path.join(root, 'config.toml'));
  const configured = profile.configurationOwnership ?? profile.configuration ?? {};
  const route = profile.routeBinding ?? {
    mode: profile.profileKind === 'cli' ? 'direct_native' : 'unknown',
    providerRef: profile.profileKind === 'cli' ? 'openai' : null,
  };
  return {
    schemaVersion: RUNTIME_PROFILE_CONFIGURATION_VERSION,
    configurationId: `runtime_config:${profile.runtimeProfileId.slice('runtime_profile:'.length)}`,
    runtimeProfileId: profile.runtimeProfileId,
    artifactKind: configured.artifactKind ?? 'codex_config',
    path: resolvedConfigPath,
    pathRelativeToRoot: configured.pathRelativeToRoot ?? 'config.toml',
    writerOwnerRef: configured.writerOwnerRef ?? BRAIN_PROFILE_CONFIG_WRITER,
    custody: configured.custody ?? 'brain',
    mutationAuthority: configured.mutationAuthority ?? 'owner-only',
    sourceIntentRef: configured.sourceIntentRef ?? context.configIntentSourceRef ?? 'brain:codex-profile-defaults',
    routeBinding: {
      mode: route.mode ?? 'unknown',
      providerRef: route.providerRef ?? null,
      ownerRef: route.ownerRef ?? 'brain:runtime-profile-route-intent',
      optional: route.optional === true,
    },
    allowedMutation: 'profile_config_only',
    excludedState: ['auth.json', 'sessions', 'logs', 'sqlite', 'sockets', 'locks', 'cookies', 'keychain_items'],
    ownershipMetadataPath: configurationOwnershipPath(resolvedConfigPath),
  };
}

export function inspectRuntimeProfileConfiguration({ artifact } = {}) {
  if (!artifact?.path) throw new Error('configuration artifact is required');
  const config = ownerOnlyMetadata(artifact.path);
  const ownershipFile = ownerOnlyMetadata(artifact.ownershipMetadataPath);
  const ownership = ownershipFile.exists && ownershipFile.safe ? readOwnership(artifact.ownershipMetadataPath) : null;
  const reasons = [];
  const revision = readFileRevision(artifact.path);

  if (config.exists && (!config.safe || config.type !== 'file')) reasons.push('config_file_permissions_or_type_invalid');
  if (ownershipFile.exists && !ownershipFile.safe) reasons.push('ownership_metadata_permissions_or_type_invalid');
  if (config.exists && !ownershipFile.exists) reasons.push('existing_config_has_no_brain_ownership_metadata');
  if (!config.exists && ownershipFile.exists) reasons.push('orphaned_config_ownership_metadata');
  if (ownership && ownership.writerOwnerRef !== artifact.writerOwnerRef) reasons.push('config_writer_owner_conflict');
  if (ownership && ownership.runtimeProfileId !== artifact.runtimeProfileId) reasons.push('config_profile_owner_conflict');
  if (ownership && ownership.path !== artifact.path) reasons.push('config_path_owner_conflict');
  if (ownership && !ownership.configRevision) reasons.push('config_ownership_revision_missing');
  if (ownership && ownership.configRevision && JSON.stringify(ownership.configRevision) !== JSON.stringify(revision)) reasons.push('config_semantic_state_drifted');

  let state = 'absent';
  if (reasons.length > 0) state = 'conflicted';
  else if (config.exists && ownership) state = 'owned';
  else if (config.exists) state = 'unowned';
  else if (ownershipFile.exists) state = 'orphaned';

  return {
    state,
    config,
    ownershipFile,
    ownership: ownership
      ? {
        schemaVersion: ownership.schemaVersion ?? null,
        runtimeProfileId: ownership.runtimeProfileId ?? null,
        writerOwnerRef: ownership.writerOwnerRef ?? null,
        path: ownership.path ?? null,
        configRevision: ownership.configRevision ?? null,
      }
      : null,
    revision,
    reasons: unique(reasons),
    configContentsRead: false,
  };
}

export function buildRuntimeProfileConfigurationPlan({ profile, root, adapter, context = {} } = {}) {
  if (!profile?.runtimeProfileId) throw new Error('runtime profile is required');
  if (!adapter?.profileConfigPath) throw new Error('runtime profile adapter must expose profileConfigPath()');
  const resolvedRoot = path.resolve(root);
  const configPath = adapter.profileConfigPath({ profile, root: resolvedRoot, context });
  const artifact = buildRuntimeProfileConfigurationArtifact({ profile, root: resolvedRoot, configPath, context });
  const security = adapter.inspectRootSecurity({ profile, root: resolvedRoot, context });
  const process = adapter.inspectProcessOwnership({ profile, root: resolvedRoot, context });
  const configuration = inspectRuntimeProfileConfiguration({ artifact });
  const ownershipPlan = planConfigurationMutations({
    operation: 'runtime-profile-config',
    resources: [{
      resourceId: artifact.configurationId,
      resourceKind: artifact.artifactKind,
      path: artifact.path,
      currentOwner: configuration.state === 'absent'
        ? artifact.writerOwnerRef
        : configuration.state === 'owned'
          ? artifact.writerOwnerRef
          : configuration.ownership?.writerOwnerRef ?? 'unknown',
      desiredOwner: artifact.writerOwnerRef,
      authorityRef: artifact.writerOwnerRef,
      currentState: configuration.state === 'absent' ? 'absent' : 'present',
      desiredState: 'present',
      action: configuration.state === 'absent' ? 'create' : configuration.state === 'owned' ? 'preserve' : 'update',
      currentSemanticState: configuration.state,
      desiredSemanticState: 'non_secret_profile_policy',
      actualRevision: configuration.revision,
      expectedRevision: configuration.revision,
      externalOwner: configuration.state === 'owned' ? false : configuration.ownership?.writerOwnerRef && configuration.ownership.writerOwnerRef !== artifact.writerOwnerRef,
      journalState: context.configurationJournalState ?? 'not_applicable',
      reason: 'profile configuration is a semantic resource, not an unscoped file',
    }],
  });
  const reasons = [
    ...(!isPathWithin(resolvedRoot, artifact.path) ? ['config_path_outside_runtime_root'] : []),
    ...(artifact.pathRelativeToRoot !== path.relative(resolvedRoot, artifact.path) ? ['config_path_relative_mapping_invalid'] : []),
    ...(security.reasons ?? []),
    ...(!security.rootExists ? ['runtime_root_not_provisioned'] : []),
    ...(security.rootExists && !security.safe ? ['runtime_root_not_safe'] : []),
    ...(process.state === 'active' ? ['target_profile_process_active'] : []),
    ...(process.state === 'unknown' || process.state === 'conflicted' ? ['target_profile_ownership_unresolved'] : []),
    ...(configuration.reasons ?? []),
    ...(configuration.state === 'unowned' ? ['existing_config_writer_unresolved'] : []),
    ...(ownershipPlan.status === 'BLOCKED' ? ownershipPlan.blockers : []),
    ...(adapter.isDefaultRuntimeRoot?.(resolvedRoot) ? ['shared_default_root_is_legacy_maintenance_only'] : []),
  ];
  const status = reasons.length > 0
    ? 'BLOCKED'
    : ['absent', 'owned'].includes(configuration.state) ? 'READY' : 'BLOCKED';
  return {
    managerVersion: RUNTIME_PROFILE_CONFIGURATION_VERSION,
    operation: 'materialize-config',
    status,
    runtimeProfileId: profile.runtimeProfileId,
    runtimeRoot: resolvedRoot,
    artifact,
    configuration,
    security,
    process,
    ownershipPlan,
    reasons: unique(reasons),
    writerPolicy: {
      authoritativeWriter: artifact.writerOwnerRef,
      onePhysicalConfigWriter: true,
      thirdPartyConfigMutation: 'forbidden',
      applicationAuthAndRuntimeStateRemainApplicationOwned: true,
    },
    redaction: { secretsExcluded: true, configContentsRead: false, authContentsRead: false },
  };
}

function renderTomlValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  throw new Error('profile configuration values must be scalar non-secret values');
}

export function compileCodexProfileConfig({ profile, artifact, settings = {} } = {}) {
  const lines = [
    '# Brain materialized profile configuration.',
    `# Runtime profile: ${profile.runtimeProfileId}`,
    `# Configuration writer: ${artifact.writerOwnerRef}`,
    '# This file contains non-secret policy only. Codex owns auth.json and runtime state.',
  ];
  const values = {
    cli_auth_credentials_store: 'file',
    ...(settings.model ? { model: settings.model } : {}),
    ...(settings.model_reasoning_effort ? { model_reasoning_effort: settings.model_reasoning_effort } : {}),
    ...(settings.personality ? { personality: settings.personality } : {}),
  };
  for (const [key, value] of Object.entries(values)) lines.push(`${key} = ${renderTomlValue(value)}`);
  if (artifact.routeBinding.mode === 'direct_native') lines.push('# Route: native/direct OpenAI provider.');
  else lines.push(`# Route provider: ${artifact.routeBinding.providerRef ?? 'unknown'} (${artifact.routeBinding.mode}).`);
  return `${lines.join('\n')}\n`;
}

function writeOwnerOnly(file, contents) {
  const descriptor = fs.openSync(file, 'wx', OWNERSHIP_FILE_MODE);
  try {
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fchmodSync(descriptor, OWNERSHIP_FILE_MODE);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeAtomicOwnerOnly(file, contents) {
  const temporary = `${file}.brain-staging-${process.pid}-${Date.now()}`;
  try {
    writeOwnerOnly(temporary, contents);
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function validateProfileConfigurationText(text) {
  if (typeof text !== 'string' || text.length === 0) throw new Error('profile configuration is empty');
  if (/^\s*(?:auth|access|refresh)[_-]?(?:token|cookie)\s*=/im.test(text) || /^\s*password\s*=/im.test(text)) {
    throw new Error('profile configuration contains a forbidden secret-bearing field');
  }
}

export function materializeRuntimeProfileConfiguration({ plan, profile, adapter, context = {}, settings = {} } = {}) {
  if (plan?.status !== 'READY') throw new Error(`profile configuration materialization blocked: ${(plan?.reasons ?? ['unknown']).join(',')}`);
  if (plan.ownershipPlan?.status !== 'READY') throw new Error(`profile configuration ownership plan blocked: ${(plan?.ownershipPlan?.blockers ?? ['unknown']).join(',')}`);
  if (plan.artifact.writerOwnerRef !== BRAIN_PROFILE_CONFIG_WRITER) {
    throw new Error(`unsupported profile configuration writer: ${plan.artifact.writerOwnerRef}`);
  }
  const text = adapter.compileProfileConfig
    ? adapter.compileProfileConfig({ profile, artifact: plan.artifact, context, settings })
    : compileCodexProfileConfig({ profile, artifact: plan.artifact, settings });
  const freshConfiguration = inspectRuntimeProfileConfiguration({ artifact: plan.artifact });
  const plannedConfiguration = plan.ownershipPlan.resources.find((resource) => resource.resourceId === plan.artifact.configurationId);
  if (!plannedConfiguration || JSON.stringify(plannedConfiguration.sourceRevision) !== JSON.stringify(freshConfiguration.revision)) {
    throw new Error('profile configuration drift detected after planning; re-plan before materialization');
  }
  if (freshConfiguration.state !== plan.configuration.state) {
    throw new Error('profile configuration ownership state changed after planning; re-plan before materialization');
  }
  const ownership = {
    schemaVersion: RUNTIME_PROFILE_CONFIGURATION_VERSION,
    runtimeProfileId: plan.runtimeProfileId,
    path: plan.artifact.path,
    writerOwnerRef: plan.artifact.writerOwnerRef,
    routeBinding: plan.artifact.routeBinding,
    sourceIntentRef: plan.artifact.sourceIntentRef,
    secretState: 'excluded',
  };
  if (plan.configuration.state === 'owned') {
    return { ...plan, status: 'OK', executed: false, executionReason: 'configuration_already_owned', ownership };
  }
  validateProfileConfigurationText(text);
  const configResult = applyAtomicTextConfiguration({
    plan: plan.ownershipPlan,
    resourceId: plan.artifact.configurationId,
    file: plan.artifact.path,
    contents: text,
    mode: OWNERSHIP_FILE_MODE,
    validate: validateProfileConfigurationText,
  });
  ownership.configRevision = configResult.revision;
  try {
    fs.mkdirSync(path.dirname(plan.artifact.ownershipMetadataPath), { recursive: true });
    writeAtomicOwnerOnly(plan.artifact.ownershipMetadataPath, `${JSON.stringify(ownership, null, 2)}\n`);
  } catch (error) {
    if (plan.configuration.state === 'absent') {
      try { fs.unlinkSync(plan.artifact.path); } catch {}
    }
    throw error;
  }
  const verification = inspectRuntimeProfileConfiguration({ artifact: plan.artifact });
  if (verification.state !== 'owned') throw new Error(`materialized profile configuration did not verify: ${verification.reasons.join(',')}`);
  if (verification.revision.digest !== configResult.revision.digest) throw new Error('materialized profile configuration revision changed unexpectedly');
  return {
    ...plan,
    status: 'OK',
    executed: true,
    ownership,
    verification,
    compiledBytes: Buffer.byteLength(text, 'utf8'),
  };
}
