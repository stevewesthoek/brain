#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REGISTRY_PATH = 'operations/specs/infinite-brain-contract-registry.json';
export const ALLOWED_CATEGORIES = new Set([
  'philosophy', 'strategy', 'roadmap', 'implementation-plan', 'repository-boundary',
  'bridge', 'folder', 'path', 'task', 'automation', 'maintenance', 'graph',
  'generated-output', 'capability-state', 'deployment', 'approval', 'security',
  'compatibility', 'historical',
]);
export const ALLOWED_LIFECYCLE_STATES = new Set([
  'draft', 'candidate', 'active', 'compatibility', 'deprecated', 'retired', 'historical',
]);
export const ALLOWED_OWNERS = new Set([
  'mind-human', 'brain-runtime', 'shared-interface', 'external-system', 'historical-only',
]);
export const ALLOWED_COMPATIBILITY_STATUSES = new Set([
  'none', 'scoped-exception', 'contains-compatibility', 'historical-evidence',
]);

function error(errors, message) {
  errors.push(message);
}

function isSafeRelativePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').includes('..');
}

function repositoryRoot(repoRoot, repository) {
  if (repository === 'brain') return repoRoot;
  if (repository === 'mind') return resolve(repoRoot, '../mind');
  return null;
}

function validateReference(errors, repoRoot, reference, label, requireExists = true) {
  if (!reference || !['brain', 'mind'].includes(reference.repository) || !isSafeRelativePath(reference.path)) {
    error(errors, `${label} must use a safe brain or mind repository-qualified path`);
    return;
  }
  if (requireExists && !existsSync(resolve(repositoryRoot(repoRoot, reference.repository), reference.path))) {
    error(errors, `${label} is missing: ${reference.repository}:${reference.path}`);
  }
}

export function validateContractRegistry(registry, { repoRoot = process.cwd() } = {}) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || !/^\d+\.\d+\.\d+$/.test(registry.registryVersion ?? '')) {
    error(errors, 'registryVersion must be semver');
  }
  if (!Array.isArray(registry?.entries) || registry.entries.length === 0) {
    error(errors, 'entries must be a non-empty array');
    return errors;
  }

  const ids = new Set();
  const requiredFields = [
    'contractId', 'title', 'category', 'lifecycleState', 'normativeOwner', 'executableOwner',
    'repository', 'normativeSources', 'executableSchemas', 'validators', 'runtimeConsumers',
    'documentationConsumers', 'generatedEvidence', 'deploymentEvidence', 'compatibilityStatus',
    'supersedes', 'supersededBy', 'dependencies', 'conformanceCommands', 'notes',
  ];
  for (const entry of registry.entries) {
    const prefix = entry?.contractId || '<missing-contract-id>';
    for (const field of requiredFields) if (!(field in (entry ?? {}))) error(errors, `${prefix} is missing ${field}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.contractId ?? '')) error(errors, `${prefix} has an invalid contractId`);
    if (ids.has(entry?.contractId)) error(errors, `${prefix} is duplicated`);
    ids.add(entry?.contractId);
    if (!ALLOWED_CATEGORIES.has(entry?.category)) error(errors, `${prefix} has an invalid category`);
    if (!ALLOWED_LIFECYCLE_STATES.has(entry?.lifecycleState)) error(errors, `${prefix} has an invalid lifecycleState`);
    if (!ALLOWED_OWNERS.has(entry?.normativeOwner)) error(errors, `${prefix} has an invalid normativeOwner`);
    if (entry?.executableOwner !== null && !ALLOWED_OWNERS.has(entry?.executableOwner)) error(errors, `${prefix} has an invalid executableOwner`);
    if (!['brain', 'mind', 'brain-mind-interface', 'external'].includes(entry?.repository)) error(errors, `${prefix} has an invalid repository`);
    if (!ALLOWED_COMPATIBILITY_STATUSES.has(entry?.compatibilityStatus)) error(errors, `${prefix} has an invalid compatibilityStatus`);
    if (entry?.executableOwner === 'mind-human') error(errors, `${prefix} incorrectly assigns runtime execution to Mind`);
    if (entry?.normativeOwner === 'brain-runtime' && ['philosophy', 'strategy'].includes(entry?.category)) error(errors, `${prefix} incorrectly assigns human meaning or product truth to Brain`);
    if (entry?.repository === 'brain-mind-interface' && !(entry?.normativeOwner === 'mind-human' && entry?.executableOwner === 'brain-runtime')) {
      error(errors, `${prefix} shared interface must identify distinct Mind policy and Brain execution sides`);
    }
    if (entry?.compatibilityStatus === 'scoped-exception' && (!entry.compatibilityException?.scope || !entry.compatibilityException?.reason)) {
      error(errors, `${prefix} compatibility exception requires explicit scope and reason`);
    }
    if (entry?.lifecycleState === 'historical' && (entry.runtimeConsumers?.length ?? 0) > 0) {
      error(errors, `${prefix} historical evidence cannot be current runtime truth`);
    }
    if (entry?.lifecycleState === 'candidate') {
      const claim = entry.stateClaims;
      if (claim && (claim.deployment !== 'unverified' || claim.verified !== false || claim.activation !== 'not-asserted' || claim.schedule !== 'not-asserted')) {
        error(errors, `${prefix} candidate state cannot be deployed, verified, activated, or scheduled`);
      }
    }
    if (!Array.isArray(entry?.executableSchemas) || !Array.isArray(entry?.validators)) error(errors, `${prefix} schemas and validators must be arrays`);
    if ((entry?.executableSchemas?.length ?? 0) > 0 && (entry?.validators?.length ?? 0) === 0 && !entry?.unresolvedValidatorFinding) {
      error(errors, `${prefix} executable schema requires a validator or explicit unresolved-validator finding`);
    }
    for (const [field, refs] of Object.entries({
      normativeSources: entry?.normativeSources,
      executableSchemas: entry?.executableSchemas,
      validators: entry?.validators,
      runtimeConsumers: entry?.runtimeConsumers,
      documentationConsumers: entry?.documentationConsumers,
      generatedEvidence: entry?.generatedEvidence,
      deploymentEvidence: entry?.deploymentEvidence,
    })) {
      if (!Array.isArray(refs)) {
        error(errors, `${prefix}.${field} must be an array`);
      } else {
        refs.forEach((reference, index) => validateReference(errors, repoRoot, reference, `${prefix}.${field}[${index}]`));
      }
    }
    if (!Array.isArray(entry?.missingExpectedSources)) continue;
    entry.missingExpectedSources.forEach((reference, index) => {
      validateReference(errors, repoRoot, reference, `${prefix}.missingExpectedSources[${index}]`, false);
      const root = repositoryRoot(repoRoot, reference?.repository);
      if (root && existsSync(resolve(root, reference.path))) error(errors, `${prefix}.missingExpectedSources[${index}] exists and must be registered instead`);
      if (!reference?.reason) error(errors, `${prefix}.missingExpectedSources[${index}] requires a reason`);
    });
  }
  for (const entry of registry.entries) {
    for (const dependency of entry.dependencies ?? []) if (!ids.has(dependency)) error(errors, `${entry.contractId} depends on unknown ${dependency}`);
    for (const replacement of [...(entry.supersedes ?? []), ...(entry.supersededBy ?? [])]) if (!ids.has(replacement)) error(errors, `${entry.contractId} references unknown replacement ${replacement}`);
  }
  return errors;
}

export function loadAndValidateContractRegistry({ registryPath = REGISTRY_PATH, repoRoot = process.cwd() } = {}) {
  const absolutePath = resolve(repoRoot, registryPath);
  let registry;
  try {
    registry = JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch {
    return { errors: [`registry JSON is invalid or unreadable: ${registryPath}`], registry: null };
  }
  return { errors: validateContractRegistry(registry, { repoRoot }), registry };
}

function main() {
  const { errors, registry } = loadAndValidateContractRegistry();
  if (errors.length) {
    process.stdout.write(`registry=fail\nerrors=${errors.length}\n`);
    errors.forEach((message) => process.stdout.write(`error=${message}\n`));
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`registry=pass\nregistry_version=${registry.registryVersion}\ncontracts=${registry.entries.length}\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
