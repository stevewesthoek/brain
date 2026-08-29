import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

export const LIFECYCLES = Object.freeze(['active', 'manual-only', 'policy-blocked', 'disabled', 'deprecated']);
export const RUNTIME_STATUSES = Object.freeze(['success', 'failed', 'running', 'skipped', 'disabled', 'blocked', 'never-run']);

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const DEFAULT_MANIFEST = path.join(ROOT_DIR, 'operations/specs/typed-scheduler-jobs.json');
const DEFAULT_SCHEMA = path.join(ROOT_DIR, 'operations/specs/typed-scheduler-jobs.schema.json');

function formatAjvErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message || 'is invalid'}`).join('; ');
}

function assertRegistryInvariants(registry, { rootDir = ROOT_DIR, checkEntrypoints = false } = {}) {
  const errors = [];
  const ids = new Set();
  const jobsById = new Map();

  for (const job of registry.jobs) {
    if (ids.has(job.id)) errors.push(`duplicate job id: ${job.id}`);
    ids.add(job.id);
    jobsById.set(job.id, job);
    for (const dependency of job.dependencies) {
      if (!registry.jobs.some((candidate) => candidate.id === dependency)) errors.push(`${job.id}: unknown dependency ${dependency}`);
    }
    if (job.fixedArguments.some((argument) => argument.includes('\0'))) errors.push(`${job.id}: fixed arguments contain NUL`);
    if (job.lifecycle === 'active') {
      if (job.mode === 'disabled') errors.push(`${job.id}: active job is disabled`);
      if (job.networkAccess === 'external-write-capable' || job.credentialSensitive || job.destructive || job.mindWrite) errors.push(`${job.id}: unsafe capability cannot be active`);
      if (!['brain', 'mind-read-only'].includes(job.authority)) errors.push(`${job.id}: active job has unapproved authority`);
      if (!['report-only', 'dry-run-report-only'].includes(job.mode)) errors.push(`${job.id}: active job is not report-only`);
    }
    if (['policy-blocked', 'disabled', 'deprecated'].includes(job.lifecycle) && job.mode !== 'disabled') errors.push(`${job.id}: ${job.lifecycle} job must be disabled`);
    if (job.lifecycle === 'manual-only' && job.scheduleType !== 'manual') errors.push(`${job.id}: manual-only job must use manual schedule type`);
    if (checkEntrypoints && job.lifecycle === 'active') {
      if (job.entrypoint.includes(':') || job.entrypoint.startsWith('~')) {
        errors.push(`${job.id}: active entrypoint is not a repository path`);
      } else {
        const resolved = path.resolve(rootDir, job.entrypoint);
        const relative = path.relative(rootDir, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolved)) errors.push(`${job.id}: active entrypoint is missing or outside repository`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      errors.push(`dependency cycle includes ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of jobsById.get(id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const job of registry.jobs) visit(job.id);

  const bootstrap = path.resolve(rootDir, registry.scheduler.bootstrap);
  const runner = path.resolve(rootDir, registry.scheduler.runner);
  if (checkEntrypoints && !fs.existsSync(bootstrap)) errors.push(`scheduler bootstrap is missing: ${registry.scheduler.bootstrap}`);
  if (checkEntrypoints && !fs.existsSync(runner)) errors.push(`scheduler runner is missing: ${registry.scheduler.runner}`);
  return errors;
}

export function validateRegistry(registry, options = {}) {
  const schemaPath = options.schemaPath ?? DEFAULT_SCHEMA;
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const valid = ajv.compile(schema)(registry);
  const errors = valid ? [] : [`schema validation failed: ${formatAjvErrors(ajv.errors ?? [])}`];
  errors.push(...assertRegistryInvariants(registry, options));
  if (errors.length > 0) {
    const error = new Error(errors.join('\n'));
    error.code = 'INVALID_SCHEDULER_REGISTRY';
    throw error;
  }
  return registry;
}

export function loadAndValidateRegistry(options = {}) {
  const manifestPath = options.manifestPath ?? process.env.BRAIN_SCHEDULER_MANIFEST_PATH ?? DEFAULT_MANIFEST;
  const registry = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { registry: validateRegistry(registry, { ...options, schemaPath: options.schemaPath ?? DEFAULT_SCHEMA }), manifestPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { registry, manifestPath } = loadAndValidateRegistry({ checkEntrypoints: true });
    const counts = Object.fromEntries(LIFECYCLES.map((lifecycle) => [lifecycle, registry.jobs.filter((job) => job.lifecycle === lifecycle).length]));
    console.log(JSON.stringify({ valid: true, manifestPath, jobs: registry.jobs.length, lifecycleCounts: counts }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
