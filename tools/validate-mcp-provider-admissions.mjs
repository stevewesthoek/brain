#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { verifyAllProviders, formatVerificationSummary } from './lib/mcp-provider-verification.mjs';

export const DEFAULT_REGISTRY_PATH = 'operations/specs/mcp-provider-admissions.json';
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const SAFE_PATH = (value) => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..');

function collectForbiddenSecretFields(value, location = 'registry', errors = []) {
  if (Array.isArray(value)) value.forEach((item, index) => collectForbiddenSecretFields(item, `${location}[${index}]`, errors));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/^(token|secret|password|credential|credentialValue)$/i.test(key)) errors.push(`${location}.${key}: secret values are forbidden`);
      collectForbiddenSecretFields(item, `${location}.${key}`, errors);
    }
  }
  return errors;
}

// Synchronous core validation (schema, structure, policy) — does NOT do filesystem checks
function validateAdmissionRegistryCore(registry, errors) {
  if (registry?.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registry?.reviewedAt ?? '')) errors.push('reviewedAt must be YYYY-MM-DD');
  if (!Array.isArray(registry?.admissions) || registry.admissions.length === 0) { errors.push('admissions must be non-empty'); return; }
  const admissionIds = new Set();
  const serverNames = new Set();
  for (const admission of registry.admissions) {
    const prefix = admission?.admissionId ?? '<missing-admission>';
    if (!ID.test(prefix) || admissionIds.has(prefix)) errors.push(`${prefix}: invalid or duplicate admissionId`);
    admissionIds.add(prefix);
    if (!['candidate', 'active-local', 'paused', 'revoked'].includes(admission?.status)) errors.push(`${prefix}: invalid status`);
    if (admission?.owner !== 'brain-runtime') errors.push(`${prefix}: Brain must own admission`);
    if (admission?.consumer !== 'brain') errors.push(`${prefix}: consumer must be brain`);
    const provider = admission?.provider;
    if (!ID.test(provider?.providerId ?? '') || typeof provider?.repository !== 'string' || !/^[a-f0-9]{40}$/.test(provider?.revision ?? '')) errors.push(`${prefix}: provider identity or revision is invalid`);
    if (!['committed', 'pinned-working-tree', 'mixed'].includes(provider?.sourceState)) errors.push(`${prefix}: provider sourceState is invalid`);
    if (!SAFE_PATH(provider?.entrypoint) || !Array.isArray(provider?.artifacts) || provider.artifacts.length === 0) errors.push(`${prefix}: provider entrypoint/artifacts are invalid`);
    const artifactPaths = new Set();
    for (const artifact of provider?.artifacts ?? []) {
      if (!SAFE_PATH(artifact?.path) || !SHA256.test(artifact?.sha256 ?? '') || artifactPaths.has(artifact?.path)) errors.push(`${prefix}: invalid or duplicate provider artifact ${artifact?.path}`);
      artifactPaths.add(artifact?.path);
    }
    if (!artifactPaths.has(provider?.entrypoint)) errors.push(`${prefix}: entrypoint must be digest-pinned`);
    const transport = admission?.transport;
    const validNetworkPolicies = ['loopback-only', 'loopback-with-bounded-egress'];
    if (transport?.kind !== 'stdio' || transport?.projectScoped !== true || transport?.shell !== false || !validNetworkPolicies.includes(transport?.networkPolicy)) errors.push(`${prefix}: stdio must be project-scoped, shell-free, and loopback-only or loopback-with-bounded-egress`);
    if (transport?.networkPolicy === 'loopback-with-bounded-egress') {
      if (!Array.isArray(transport?.boundedEgressExceptions) || transport.boundedEgressExceptions.length === 0) errors.push(`${prefix}: loopback-with-bounded-egress requires non-empty boundedEgressExceptions`);
      for (const exception of transport?.boundedEgressExceptions ?? []) {
        if (!exception?.host || !exception?.purpose) errors.push(`${prefix}: boundedEgressException requires host and purpose`);
        if (!['https', 'http'].includes(exception?.protocol)) errors.push(`${prefix}: boundedEgressException protocol must be https or http`);
        if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(exception?.method)) errors.push(`${prefix}: boundedEgressException method must be a valid HTTP method`);
        if (!['non-blocking-non-fatal', 'blocking-fatal', 'blocking-non-fatal'].includes(exception?.failureBehavior)) errors.push(`${prefix}: boundedEgressException failureBehavior is invalid`);
        if (exception?.sourceDataTransmitted !== false) errors.push(`${prefix}: boundedEgressException must declare sourceDataTransmitted=false`);
      }
    }
    if (transport?.networkPolicy === 'loopback-only' && transport?.boundedEgressExceptions !== undefined) errors.push(`${prefix}: loopback-only must not have boundedEgressExceptions`);
    if (!ID.test(transport?.serverName ?? '') || serverNames.has(transport?.serverName)) errors.push(`${prefix}: invalid or duplicate serverName`);
    serverNames.add(transport?.serverName);
    const auth = admission?.authentication;
    const validAuthModes = ['derived-credential-file', 'none'];
    if (!validAuthModes.includes(auth?.mode) || auth?.relayAllowed !== false) errors.push(`${prefix}: authentication mode must be one of [${validAuthModes.join(', ')}] and relay must be disallowed`);
    if (auth?.mode === 'derived-credential-file') {
      if (!ENV_NAME.test(auth?.credentialFileEnvironmentVariable ?? '')) errors.push(`${prefix}: derived-credential-file authentication requires a valid credentialFileEnvironmentVariable`);
      if (!auth?.principal || !auth?.audience || auth?.storage !== 'outside-repositories-owner-only') errors.push(`${prefix}: derived-credential-file authentication requires principal, audience, and outside-repositories-owner-only storage`);
    }
    if (auth?.mode === 'none') {
      for (const forbidden of ['credentialFileEnvironmentVariable', 'principal', 'audience', 'storage']) {
        if (auth?.[forbidden] !== undefined) errors.push(`${prefix}: none-auth admissions must not set ${forbidden}`);
      }
    }
    const scope = admission?.scope;
    if (!ENV_NAME.test(scope?.toolAllowlistEnvironmentVariable ?? '') || !ENV_NAME.test(scope?.suboperationAllowlistEnvironmentVariable ?? '')) errors.push(`${prefix}: scope environment bindings are invalid`);
    if (scope?.fixedEnvironment !== undefined) {
      if (!scope.fixedEnvironment || typeof scope.fixedEnvironment !== 'object' || Array.isArray(scope.fixedEnvironment)) errors.push(`${prefix}: fixedEnvironment must be an object`);
      const providerEnvironmentPrefix = `${String(provider?.providerId ?? '').replace(/-/g, '_').toUpperCase()}_`;
      for (const [name, value] of Object.entries(scope.fixedEnvironment ?? {})) {
        if (!ENV_NAME.test(name) || typeof value !== 'string' || /[\0\r\n]/.test(value)) errors.push(`${prefix}: invalid fixed environment binding ${name}`);
        if (!name.startsWith(providerEnvironmentPrefix)) errors.push(`${prefix}: fixedEnvironment binding ${name} must use provider prefix ${providerEnvironmentPrefix}`);
        if (/(TOKEN|SECRET|PASSWORD|CREDENTIAL)/.test(name)) errors.push(`${prefix}: fixedEnvironment must not contain secret-bearing binding ${name}`);
        if (name === scope.toolAllowlistEnvironmentVariable || name === scope.suboperationAllowlistEnvironmentVariable) errors.push(`${prefix}: fixedEnvironment must not override admission allowlist bindings`);
      }
    }
    if (!Array.isArray(scope?.tools) || scope.tools.length === 0) errors.push(`${prefix}: admitted tools must be non-empty`);
    const toolNames = new Set();
    for (const tool of scope?.tools ?? []) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(tool?.name ?? '') || toolNames.has(tool?.name)) errors.push(`${prefix}: invalid or duplicate tool ${tool?.name}`);
      toolNames.add(tool?.name);
      if (!['read', 'write', 'external-mutation'].includes(tool?.risk) || !['none', 'per-call', 'two-phase'].includes(tool?.approval)) errors.push(`${prefix}:${tool?.name}: invalid risk/approval`);
      if (tool?.risk !== 'read' && tool?.approval === 'none') errors.push(`${prefix}:${tool?.name}: mutation requires approval`);
      if (!Array.isArray(tool?.allowedSuboperations)) errors.push(`${prefix}:${tool?.name}: allowedSuboperations must be an array`);
    }
    if ((scope?.tools ?? []).some((tool) => tool.name === 'runWorkbenchCommand' && tool.allowedSuboperations.length === 0)) errors.push(`${prefix}: runWorkbenchCommand requires exact suboperations`);
    const limits = admission?.limits;
    for (const field of ['startupTimeoutSeconds', 'toolTimeoutSeconds', 'maxRequestBytes', 'maxResponseBytes']) if (!Number.isInteger(limits?.[field]) || limits[field] <= 0) errors.push(`${prefix}: invalid limit ${field}`);
    for (const field of ['maxSourceFiles', 'maxSourceBytes', 'maxCorpusBytes']) if (limits?.[field] !== undefined && (!Number.isInteger(limits[field]) || limits[field] <= 0)) errors.push(`${prefix}: invalid optional limit ${field}`);
    if (!Array.isArray(admission?.verification?.commands) || admission.verification.commands.length === 0) errors.push(`${prefix}: verification commands are required`);
    if (!admission?.revocation?.procedure || admission.revocation?.preserveEvidence !== true) errors.push(`${prefix}: revocation must preserve evidence`);
  }
}

/**
 * Synchronous validation of admission registry.
 * Used by existing tests that import this function directly.
 * @param {Object} registry
 * @param {{ providerRoots?: Map<string,string>, providerRevisions?: Map<string,string> }} opts
 * @returns {string[]}
 */
export function validateAdmissionRegistry(registry, { providerRoots = new Map(), providerRevisions = new Map() } = {}) {
  const errors = collectForbiddenSecretFields(registry);
  validateAdmissionRegistryCore(registry, errors);
  if (providerRoots.size > 0) {
    const aggregate = verifyAllProviders({ admissionRegistry: registry, providerRoots, providerRevisions });
    errors.push(...aggregate.issues);
  }
  return errors;
}

export function loadAdmissionRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(path.resolve(registryPath), 'utf8'));
}

function parseProviderRoots(argv) {
  const roots = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--provider-root') continue;
    const binding = argv[index + 1] ?? '';
    const separator = binding.indexOf('=');
    if (separator < 1 || !path.isAbsolute(binding.slice(separator + 1))) throw new Error('--provider-root requires provider-id=/absolute/path');
    roots.set(binding.slice(0, separator), binding.slice(separator + 1));
    index += 1;
  }
  return roots;
}

function parseProviderRevisions(argv) {
  const revisions = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--provider-revision') continue;
    const binding = argv[index + 1] ?? '';
    const separator = binding.indexOf('=');
    if (separator < 1) throw new Error('--provider-revision requires provider-id=<sha>');
    revisions.set(binding.slice(0, separator), binding.slice(separator + 1));
    index += 1;
  }
  return revisions;
}

async function main() {
  const argv = process.argv.slice(2);
  const registryArg = process.argv.find((value) => value.startsWith('--registry='));
  const registry = loadAdmissionRegistry(registryArg ? registryArg.slice('--registry='.length) : DEFAULT_REGISTRY_PATH);
  const providerRoots = parseProviderRoots(argv);
  const providerRevisions = parseProviderRevisions(argv);

  // Core schema/policy validation (always synchronous)
  const coreErrors = collectForbiddenSecretFields(registry);
  validateAdmissionRegistryCore(registry, coreErrors);
  if (coreErrors.length) {
    process.stderr.write(`${coreErrors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  if (providerRoots.size > 0) {
    // Use shared verification module for structured output
    const aggr = verifyAllProviders({ admissionRegistry: registry, providerRoots, providerRevisions });

    if (aggr.issues.length > 0) {
      process.stderr.write(`${aggr.issues.join('\n')}\n`);
      process.exitCode = 1;
      return;
    }

    const summary = formatVerificationSummary({
      admissionsCount: registry.admissions.length,
      sourceVerifiedCount: aggr.sourceVerifiedCount,
      runtimeVerifiedCount: aggr.runtimeVerifiedCount,
      incompleteCount: aggr.incompleteCount,
    });
    process.stdout.write(`mcp-provider-admissions-valid\n${summary}\n`);
  } else {
    process.stdout.write(`mcp-provider-admissions-valid\nadmissions=${registry.admissions.length}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('validate-mcp-provider-admissions: unexpected error:', err.message);
    process.exit(2);
  });
}
