import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const ALLOWED_STATES = new Set(['planned', 'candidate', 'configured', 'deployed', 'observed', 'verified', 'paused', 'blocked', 'retired', 'unknown']);
export const ALLOWED_SAFETY_MODES = new Set(['read-only', 'fixture-only', 'report-only', 'approval-gated', 'external-mutation', 'paused', 'blocked', 'retired', 'unknown']);
export const ALLOWED_APPROVAL_REQUIREMENTS = new Set(['none', 'required', 'two-phase']);

export const DEFAULT_ALLOWED_EVIDENCE_COMMANDS = new Set([
  'npm --prefix projects/mind-context test',
  'npm --prefix projects/mind-context run smoke',
  'npm --prefix projects/mind-context run eval',
  'npm --prefix projects/mind-context run eval:gate',
  'node tools/validate-context-pack.mjs',
  'node tools/validate-retrieval-evaluation-corpus.mjs',
  'node tools/validate-capability-state.mjs',
  'node tools/validate-mcp-provider-admissions.mjs',
  'node tools/validate-capability-manifest.mjs',
  'node tools/validate-infinite-brain-capabilities.mjs',
  'node tools/generate-infinite-brain-capability-status.mjs --check',
  'npm --prefix projects/mind-context run eval:gate',
  'node tools/run-semantic-ranker-gate-smoke.mjs',
]);

function isSafeRepoPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && !value.includes('..')
    && !value.includes('\\');
}

function unique(values) {
  return [...new Set(values)];
}

function runEvidenceCommand(command) {
  const result = spawnSync('sh', ['-lc', command], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function validateCapabilityManifest(manifest, {
  runEvidence = false,
  allowedEvidenceCommands = DEFAULT_ALLOWED_EVIDENCE_COMMANDS,
} = {}) {
  const errors = [];
  if (manifest?.schemaVersion !== '1.0.0') errors.push('schemaVersion');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest?.reviewedAt ?? '')) errors.push('reviewedAt');
  if (!Array.isArray(manifest?.capabilities) || manifest.capabilities.length === 0) errors.push('capabilities');
  const ids = new Map();
  const evidenceCache = new Map();
  for (const [index, capability] of (manifest?.capabilities ?? []).entries()) {
    const prefix = capability?.capabilityId ?? `capability:${index}`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(capability?.capabilityId ?? '')) errors.push(`${prefix}:capabilityId`);
    if (ids.has(capability?.capabilityId)) errors.push(`${prefix}:duplicate`);
    ids.set(capability?.capabilityId, capability);
    if (typeof capability?.displayName !== 'string' || capability.displayName.trim() === '') errors.push(`${prefix}:displayName`);
    if (typeof capability?.owner !== 'string' || capability.owner.trim() === '' || /model/i.test(capability.owner)) errors.push(`${prefix}:owner`);
    if (typeof capability?.description !== 'string' || capability.description.trim() === '') errors.push(`${prefix}:description`);
    if (!ALLOWED_STATES.has(capability?.state)) errors.push(`${prefix}:state`);
    if (!ALLOWED_SAFETY_MODES.has(capability?.safetyMode)) errors.push(`${prefix}:safetyMode`);
    if (typeof capability?.contractId !== 'string' || capability.contractId.trim() === '') errors.push(`${prefix}:contractId`);
    if (!isSafeRepoPath(capability?.schemaPath)) errors.push(`${prefix}:schemaPath`);
    if (typeof capability?.entrypoint !== 'string' || capability.entrypoint.trim() === '') errors.push(`${prefix}:entrypoint`);
    if (typeof capability?.evidenceCommand !== 'string' || capability.evidenceCommand.trim() === '') errors.push(`${prefix}:evidenceCommand`);
    if (!isSafeRepoPath(capability?.evidenceReport)) errors.push(`${prefix}:evidenceReport`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(capability?.lastVerified ?? '')) errors.push(`${prefix}:lastVerified`);
    if (!Array.isArray(capability?.dependencies)) errors.push(`${prefix}:dependencies`);
    if (typeof capability?.featureFlag !== 'string' || capability.featureFlag.trim() === '') errors.push(`${prefix}:featureFlag`);
    if (typeof capability?.rollbackOrDisableCommand !== 'string' || capability.rollbackOrDisableCommand.trim() === '') errors.push(`${prefix}:rollbackOrDisableCommand`);
    if (!ALLOWED_STATES.has(capability?.repositoryState)) errors.push(`${prefix}:repositoryState`);
    if (!ALLOWED_STATES.has(capability?.deployedState)) errors.push(`${prefix}:deployedState`);
    if (!ALLOWED_STATES.has(capability?.observedState)) errors.push(`${prefix}:observedState`);
    if (!ALLOWED_STATES.has(capability?.verifiedState)) errors.push(`${prefix}:verifiedState`);
    if (!Array.isArray(capability?.readScope)) errors.push(`${prefix}:readScope`);
    if (!Array.isArray(capability?.writeScope)) errors.push(`${prefix}:writeScope`);
    if (typeof capability?.externalMutation !== 'boolean') errors.push(`${prefix}:externalMutation`);
    if (!ALLOWED_APPROVAL_REQUIREMENTS.has(capability?.approvalRequirement)) errors.push(`${prefix}:approvalRequirement`);
    if (!Array.isArray(capability?.evidenceReferences)) errors.push(`${prefix}:evidenceReferences`);

    if (Array.isArray(capability?.readScope) && capability.readScope.some((item) => !isSafeRepoPath(item))) errors.push(`${prefix}:readScope`);
    if (Array.isArray(capability?.writeScope) && capability.writeScope.some((item) => !isSafeRepoPath(item))) errors.push(`${prefix}:writeScope`);
    if (Array.isArray(capability?.dependencies)) {
      for (const dependency of capability.dependencies) {
        if (typeof dependency !== 'string' || dependency.trim() === '') errors.push(`${prefix}:dependency`);
      }
    }
    if (capability?.externalMutation === true && capability.approvalRequirement === 'none') errors.push(`${prefix}:approvalRequirement`);
    if ((capability?.externalMutation === true || (capability?.writeScope ?? []).length > 0) && ['none', '', 'n/a'].includes(capability?.rollbackOrDisableCommand)) errors.push(`${prefix}:rollbackOrDisableCommand`);

    const isExecutable = ['candidate', 'configured', 'deployed', 'observed', 'verified'].includes(capability?.state);
    if (isExecutable && ['n/a', 'none', ''].includes(capability?.entrypoint)) errors.push(`${prefix}:entrypoint`);
    if ((capability?.state === 'verified' || capability?.verifiedState === 'verified') && ((capability?.evidenceReferences ?? []).length === 0 || ['none', ''].includes(capability?.evidenceCommand))) errors.push(`${prefix}:evidence`);
    if (capability?.verifiedState === 'verified' && !['observed', 'verified'].includes(capability?.observedState)) errors.push(`${prefix}:verified-without-observed`);
    if (['deployed', 'observed', 'verified'].includes(capability?.deployedState) && ['planned', 'unknown'].includes(capability?.repositoryState)) errors.push(`${prefix}:deployed-without-repo`);
    if (capability?.owner === 'model-supplied' || capability?.owner === 'authority') errors.push(`${prefix}:owner`);

    if (runEvidence && capability?.state === 'verified') {
      if (!allowedEvidenceCommands.has(capability.evidenceCommand)) {
        errors.push(`${prefix}:evidence-command-not-allowlisted`);
      } else {
        if (!evidenceCache.has(capability.evidenceCommand)) {
          evidenceCache.set(capability.evidenceCommand, runEvidenceCommand(capability.evidenceCommand));
        }
        const evidence = evidenceCache.get(capability.evidenceCommand);
        if (!evidence.ok) errors.push(`${prefix}:evidence-command-failed`);
      }
    }
  }
  const idSet = new Set(ids.keys());
  for (const capability of manifest?.capabilities ?? []) {
    const prefix = capability?.capabilityId ?? 'capability';
    for (const dependency of capability?.dependencies ?? []) {
      if (!idSet.has(dependency)) errors.push(`${prefix}:missing-dependency:${dependency}`);
    }
  }
  return unique(errors);
}

export function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}
