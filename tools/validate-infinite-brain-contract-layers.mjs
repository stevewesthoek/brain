#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPathRegistry } from './mind-canonical-path-registry.mjs';

export const LAYER_MAP_PATH = 'operations/specs/infinite-brain-contract-layer-map.json';
const REQUIRED_FAMILIES = new Set(['automation', 'maintenance', 'graphify', 'folder-path', 'task-authority', 'brain-mind-bridge', 'generated-output', 'capability-state', 'save-to-mind-deployment-status']);

function sourceExists(repoRoot, source) {
  if (!source || !['brain', 'mind'].includes(source.repository) || typeof source.path !== 'string' || source.path.startsWith('/') || source.path.includes('..')) return false;
  const root = source.repository === 'brain' ? repoRoot : resolve(repoRoot, '../mind');
  return existsSync(resolve(root, source.path));
}

function validateMethod(repoRoot, method) {
  if (typeof method !== 'string' || method.length === 0) return false;
  const first = method.split(' ')[0];
  return existsSync(resolve(repoRoot, first));
}

export function validateContractLayers(map, { repoRoot = process.cwd() } = {}) {
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(map?.schemaVersion ?? '')) errors.push('schemaVersion must be semver');
  if (!Array.isArray(map?.families)) return [...errors, 'families must be an array'];
  const seen = new Set();
  const pathRegistry = loadPathRegistry({ repoRoot });
  const pathEntries = new Map(pathRegistry.entries.map((entry) => [entry.pathId, entry]));
  for (const family of map.families) {
    const id = family?.familyId || '<missing-family-id>';
    if (seen.has(id)) errors.push(`${id} is duplicated`);
    seen.add(id);
    const required = ['normativeMindSource', 'brainExecutableSchema', 'brainValidator', 'runtimeConfiguration', 'deploymentEvidence', 'observedEvidence', 'verifiedEvidence', 'compatibilityLayer', 'deprecationState', 'unresolvedOwnerDecision'];
    required.forEach((field) => { if (!(field in (family ?? {}))) errors.push(`${id} is missing ${field}`); });
    if (!(family?.normativeMindSource?.repository === 'mind' && family.normativeMindSource.owner === 'mind-human' && sourceExists(repoRoot, family.normativeMindSource))) {
      errors.push(`${id} must identify an existing Mind-owned normative source`);
    }
    if (!(family?.brainExecutableSchema?.repository === 'brain' && family.brainExecutableSchema.owner === 'brain-runtime' && sourceExists(repoRoot, family.brainExecutableSchema))) {
      errors.push(`${id} must identify an existing Brain-owned executable schema`);
    }
    if (!(family?.brainValidator?.repository === 'brain' && family.brainValidator.owner === 'brain-runtime' && sourceExists(repoRoot, family.brainValidator))) {
      errors.push(`${id} must identify an existing Brain-owned validator`);
    }
    const config = family?.runtimeConfiguration;
    if (!config || typeof config.kind !== 'string') errors.push(`${id} runtime configuration must be typed`);
    if (config?.kind === 'not-applicable') {
      if (config.repository !== null || config.path !== null) errors.push(`${id} not-applicable configuration cannot name a source`);
    } else if (!(config?.repository === 'brain' && sourceExists(repoRoot, config))) {
      errors.push(`${id} runtime configuration must be an existing Brain source, never a Mind document`);
    }
    const deployment = family?.deploymentEvidence;
    if (!deployment || typeof deployment.status !== 'string') errors.push(`${id} deployment evidence must be typed`);
    const isSaveToMindDeployment = id === 'save-to-mind-deployment-status';
    if (!isSaveToMindDeployment && (deployment?.status === 'deployed' || deployment?.status === 'verified')) errors.push(`${id} cannot claim deployed or verified state in this registry-only lane`);
    if (deployment?.source && !(deployment.immutable === true && /^[a-f0-9]{64}$/.test(deployment.sha256 ?? ''))) errors.push(`${id} immutable deployment evidence requires SHA-256`);
    const observed = family?.observedEvidence;
    if (!observed || typeof observed.status !== 'string') errors.push(`${id} observed evidence must be typed`);
    if (!['not-observed', 'generator-dependent', 'unresolved'].includes(observed?.status) && !(typeof observed?.timestamp === 'string' && typeof observed?.provenance === 'string')) {
      errors.push(`${id} observed evidence requires timestamp and provenance`);
    }
    const verified = family?.verifiedEvidence;
    if (!verified || typeof verified.status !== 'string' || typeof verified.live !== 'boolean') errors.push(`${id} verified evidence must identify status and live flag`);
    if (!verified?.status?.startsWith('not-') && !validateMethod(repoRoot, verified?.method)) errors.push(`${id} verified evidence requires an existing validation method`);
    if (config?.kind === 'repository-candidate-config' && (deployment?.status !== 'unverified' || verified?.live !== false)) errors.push(`${id} candidate configuration cannot satisfy deployed or verified state`);
    if (!Array.isArray(family?.compatibilityLayer?.pathIds)) errors.push(`${id} compatibility layer must name path IDs`);
    for (const pathId of family?.compatibilityLayer?.pathIds ?? []) {
      const entry = pathEntries.get(pathId);
      if (!entry) errors.push(`${id} references unknown compatibility path ${pathId}`);
      else if (entry.activeDefaultAllowed) errors.push(`${id} compatibility path ${pathId} cannot satisfy canonical write policy`);
    }
    if (family?.compatibilityLayer?.activeDefaultAllowed !== false) errors.push(`${id} compatibility layer cannot allow active defaults`);
    if (isSaveToMindDeployment) {
      if (family?.b1_0a !== 'complete') errors.push('save-to-mind deployment status must record B1.0a complete');
      if (config?.kind !== 'controlled-live-config' || deployment?.status !== 'deployed') errors.push('save-to-mind deployment status requires controlled live deployment evidence');
      if (observed?.status !== 'exact-candidate-readback' || verified?.status !== 'live-verified' || verified?.live !== true) errors.push('save-to-mind deployment status requires exact live readback verification');
    }
  }
  for (const family of REQUIRED_FAMILIES) if (!seen.has(family)) errors.push(`missing required family ${family}`);
  return errors;
}

export function loadContractLayers({ mapPath = LAYER_MAP_PATH, repoRoot = process.cwd() } = {}) {
  return JSON.parse(readFileSync(resolve(repoRoot, mapPath), 'utf8'));
}

function main() {
  const map = loadContractLayers();
  const errors = validateContractLayers(map);
  if (errors.length) {
    process.stdout.write(`layers=fail\nerrors=${errors.length}\n`);
    errors.forEach((error) => process.stdout.write(`error=${error}\n`));
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`layers=pass\nschema_version=${map.schemaVersion}\nfamilies=${map.families.length}\nruntime_behavior_changed=false\nmind_content_read=false\nnetwork_access=false\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
