import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SECRET_SURFACE_POLICY } from '../operations/specs/infinite-brain-boundary-contracts.js';
import process from 'node:process';

const defaultRoot = path.resolve(import.meta.dirname, '..');
const root = process.argv[2] === '--root' ? path.resolve(process.argv[3]) : defaultRoot;

function readJson(relativePath) {
  if (relativePath.startsWith('/') || relativePath.includes('..')) throw new Error(`unsafe input path: ${relativePath}`);
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function evidence(relativePath) {
  if (relativePath.startsWith('/') || relativePath.includes('..') || SECRET_LIKE.test(relativePath)) throw new Error(`secret-like or unsafe evidence rejected: ${relativePath}`);
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { path: relativePath, state: 'missing', sha256: null };
  const text = fs.readFileSync(fullPath, 'utf8');
  if (SECRET_LIKE.test(text)) throw new Error(`secret-like evidence rejected: ${relativePath}`);
  return { path: relativePath, state: 'present', sha256: crypto.createHash('sha256').update(text).digest('hex') };
}

const SECRET_LIKE = SECRET_SURFACE_POLICY.valuePattern;
const state = readJson('operations/specs/capability-state.json');
const registry = readJson('operations/specs/infinite-brain-contract-registry.json');
const paths = readJson('operations/specs/infinite-brain-path-registry.json');
const contractIds = new Set(registry.entries.map((entry) => entry.contractId));
const manifest = {
  manifestVersion: '1.0.0',
  generatedFrom: 'repository-and-guarded-live-evidence',
  reviewedAt: state.reviewedAt,
  registries: { contractRegistryVersion: registry.registryVersion, pathRegistryVersion: paths.registryVersion },
  capabilities: state.capabilities.slice().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId)).map((capability) => ({
    capabilityId: capability.capabilityId,
    owner: capability.owner,
    contractId: capability.contractId,
    configured: capability.configurationState,
    deployed: capability.deploymentState,
    observed: capability.observationState,
    verified: capability.verificationState,
    safetyContained: ['paused', 'blocked', 'verified'].includes(capability.safetyState),
    blockers: [...capability.blockers].sort(),
    dependencies: [...capability.dependencies].sort(),
    evidence: capability.evidencePaths.slice().sort().map(evidence),
    evidenceFresh: capability.reviewedAt === state.reviewedAt,
    contractKnown: contractIds.has(capability.contractId),
    liveState: capability.capabilityId === 'save-to-mind-live-deployment'
      && capability.deploymentState === 'deployed'
      && capability.observationState === 'observed'
      && capability.verificationState === 'verified'
      ? 'verified'
      : 'unknown',
  })),
};

const unsupportedDeployment = manifest.capabilities.find((capability) => capability.deployed === 'deployed'
  && !(capability.capabilityId === 'save-to-mind-live-deployment'
    && capability.configured === 'configured'
    && capability.observed === 'observed'
    && capability.verified === 'verified'
    && capability.liveState === 'verified'
    && capability.blockers.length === 0));
if (unsupportedDeployment) throw new Error(`unsupported live deployment claim: ${unsupportedDeployment.capabilityId}`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
