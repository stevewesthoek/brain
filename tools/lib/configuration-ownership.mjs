import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CONFIGURATION_OWNERSHIP_VERSION = '1.0.0';
export const CONFIGURATION_ACTIONS = Object.freeze([
  'preserve',
  'create',
  'update',
  'remove',
  'conflict',
  'unknown',
]);

const MUTATING_ACTIONS = new Set(['create', 'update', 'remove']);

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

export function semanticFingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function statRevision(file, contents = null) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { exists: true, type: stat.isSymbolicLink() ? 'symlink' : 'other', mode: stat.mode & 0o777 };
    }
    return {
      exists: true,
      type: 'file',
      mode: stat.mode & 0o777,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      digest: crypto.createHash('sha256').update(contents ?? fs.readFileSync(file)).digest('hex'),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, type: 'missing' };
    return { exists: false, type: 'unknown', reason: error?.code ?? 'stat_failed' };
  }
}

/**
 * Return an opaque file revision. The digest is never a configuration value
 * and callers must not use this function to print or export file contents.
 */
export function readFileRevision(file) {
  return statRevision(path.resolve(file));
}

function revisionMatches(expected, actual) {
  return JSON.stringify(expected ?? null) === JSON.stringify(actual ?? null);
}

function planOneResource(resource) {
  const action = resource.action ?? 'unknown';
  const currentOwner = resource.currentOwner ?? 'unknown';
  const desiredOwner = resource.desiredOwner ?? 'unknown';
  const blockers = [];

  if (!CONFIGURATION_ACTIONS.includes(action)) blockers.push(`unsupported_action:${action}`);
  if (!resource.resourceId) blockers.push('resource_identity_missing');
  if (resource.actualRevision?.type === 'unknown') blockers.push('current_revision_unknown');
  if (resource.currentState === 'present' && resource.actualRevision?.type !== 'file') {
    blockers.push('current_resource_type_unresolved');
  }
  if (MUTATING_ACTIONS.has(action)) {
    if (currentOwner === 'unknown' || currentOwner === 'conflicted') blockers.push('current_ownership_unknown');
    if (desiredOwner === 'unknown' || desiredOwner === 'conflicted') blockers.push('desired_ownership_unknown');
    if (!resource.authorityRef) blockers.push('mutation_authority_missing');
    else if (resource.authorityRef !== desiredOwner) blockers.push('mutation_authority_mismatch');
    if (currentOwner !== desiredOwner && resource.currentState !== 'absent') blockers.push('ownership_transfer_requires_explicit_policy');
    if (resource.externalOwner === true && currentOwner !== desiredOwner) blockers.push('externally_owned_resource');
    if (resource.journalState && !['consistent', 'not_applicable'].includes(resource.journalState)) blockers.push('application_journal_inconsistent');
  }
  if (resource.expectedRevision !== undefined && !revisionMatches(resource.expectedRevision, resource.actualRevision)) {
    blockers.push('source_revision_changed_since_plan');
  }
  if (resource.expectedSemanticFingerprint !== undefined
    && resource.actualSemanticFingerprint !== resource.expectedSemanticFingerprint) {
    blockers.push('semantic_state_changed_since_plan');
  }

  let plannedAction = action;
  if (blockers.length > 0) plannedAction = blockers.some((reason) => reason.includes('unknown')) ? 'unknown' : 'conflict';
  return {
    resourceId: resource.resourceId ?? null,
    resourceKind: resource.resourceKind ?? 'configuration_resource',
    path: resource.path ?? null,
    currentOwner,
    desiredOwner,
    authorityRef: resource.authorityRef ?? null,
    currentState: resource.currentState ?? 'unknown',
    desiredState: resource.desiredState ?? 'unknown',
    currentSemanticState: resource.currentSemanticState ?? 'not_returned',
    desiredSemanticState: resource.desiredSemanticState ?? 'not_returned',
    action: plannedAction,
    requestedAction: action,
    reason: resource.reason ?? null,
    sourceRevision: resource.actualRevision ?? null,
    journalState: resource.journalState ?? 'not_applicable',
    blockers: unique(blockers),
  };
}

/**
 * Generic semantic ownership planner. Physical formats are adapter concerns;
 * this core only decides whether a resource may be preserved or mutated.
 */
export function planConfigurationMutations({ operation = 'configuration-mutation', resources = [] } = {}) {
  const plannedResources = resources.map(planOneResource);
  const blockers = plannedResources.flatMap((resource) => resource.blockers.map((reason) => `${resource.resourceId}:${reason}`));
  const executable = blockers.length === 0 && plannedResources.every((resource) => CONFIGURATION_ACTIONS.includes(resource.action));
  return {
    schemaVersion: CONFIGURATION_OWNERSHIP_VERSION,
    operation,
    status: executable ? 'READY' : 'BLOCKED',
    executable,
    resources: plannedResources,
    blockers: unique(blockers),
    redaction: { rawValuesReturned: false, secretsRead: false },
  };
}

function writeAndSync(file, contents, mode) {
  const descriptor = fs.openSync(file, 'wx', mode);
  try {
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * Atomically publish a Brain-owned non-secret text artifact after rechecking
 * the exact planned revision. The validator runs before publication and the
 * verifier runs after publication.
 */
export function applyAtomicTextConfiguration({ plan, resourceId, file, contents, mode = 0o600, validate, verify } = {}) {
  if (!plan || plan.status !== 'READY' || !plan.executable) throw new Error('configuration mutation plan is not executable');
  const resource = plan.resources.find((entry) => entry.resourceId === resourceId);
  if (!resource) throw new Error(`configuration resource is not in the plan: ${resourceId}`);
  if (!MUTATING_ACTIONS.has(resource.action)) throw new Error(`configuration action is not mutating: ${resource.action}`);
  if (path.resolve(resource.path) !== path.resolve(file)) throw new Error('configuration path changed after planning');

  const currentRevision = readFileRevision(file);
  if (!revisionMatches(resource.sourceRevision, currentRevision)) {
    throw new Error(`configuration drift detected before write: ${resourceId}`);
  }
  if (typeof validate === 'function') validate(contents);

  const destination = path.resolve(file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.brain-staging-${process.pid}-${Date.now()}`;
  try {
    writeAndSync(temporary, contents, mode);
    fs.renameSync(temporary, destination);
    fs.chmodSync(destination, mode);
    if (typeof verify === 'function') verify(destination);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  return {
    status: 'OK',
    resourceId,
    action: resource.action,
    path: destination,
    revision: readFileRevision(destination),
    redaction: { rawValuesReturned: false, secretsRead: false },
  };
}
