import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const modelPath = process.argv[2] ?? path.join(root, 'operations/specs/capability-state.json');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'operations/specs/infinite-brain-contract-registry.json'), 'utf8'));
const contractIds = new Set(registry.entries.map((entry) => entry.contractId));
const errors = [];
const ids = new Set();
const capabilities = model.capabilities ?? [];

function isSafePath(value) { return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('..'); }
for (const capability of capabilities) {
  const id = capability.capabilityId;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id ?? '') || ids.has(id)) errors.push(`invalid or duplicate capability ID: ${id}`);
  ids.add(id);
  for (const field of ['owner', 'contractId', 'configurationState', 'deploymentState', 'observationState', 'verificationState', 'safetyState', 'reviewedAt']) if (!capability[field]) errors.push(`${id}: missing ${field}`);
  if (!contractIds.has(capability.contractId)) errors.push(`${id}: unknown contract ID ${capability.contractId}`);
  for (const field of ['implementationPaths', 'evidencePaths', 'validationCommands', 'blockers', 'dependencies']) if (!Array.isArray(capability[field])) errors.push(`${id}: ${field} must be an array`);
  for (const evidencePath of capability.evidencePaths ?? []) { if (!isSafePath(evidencePath) || !fs.existsSync(path.join(root, evidencePath))) errors.push(`${id}: evidence missing or unsafe ${evidencePath}`); }
  for (const implementationPath of capability.implementationPaths ?? []) { if (!isSafePath(implementationPath) || !fs.existsSync(path.join(root, implementationPath))) errors.push(`${id}: implementation missing or unsafe ${implementationPath}`); }
  if (capability.configurationState === 'candidate' && capability.deploymentState === 'deployed') errors.push(`${id}: candidate represented as deployed`);
  if (capability.configurationState === 'configured' && capability.observationState === 'observed' && capability.evidencePaths.length === 0) errors.push(`${id}: configured represented as observed`);
  if (capability.observationState === 'observed' && capability.verificationState === 'verified' && capability.evidencePaths.length === 0) errors.push(`${id}: observed represented as verified`);
  if (capability.verificationState === 'verified' && (capability.evidencePaths.length === 0 || capability.evidencePaths.some((value) => value.includes('/reports/')) || capability.validationCommands.length === 0)) errors.push(`${id}: verified state requires non-generated evidence and validation command`);
  if (capability.safetyState === 'verified' && (capability.evidencePaths.length === 0 || capability.validationCommands.length === 0)) errors.push(`${id}: verified safety requires evidence and validation command`);
  if (capability.verificationState === 'unknown' && /\bsuccess\b/i.test(capability.notes ?? '')) errors.push(`${id}: unknown represented as success`);
  if (capability.reviewedAt !== model.reviewedAt) errors.push(`${id}: stale evidence review date`);
}
for (const capability of capabilities) for (const dependency of capability.dependencies ?? []) if (!ids.has(dependency) && !contractIds.has(dependency)) errors.push(`${capability.capabilityId}: unknown dependency ${dependency}`);
if (capabilities.length < 16) errors.push('at least 16 capabilities required');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`capability-state-valid capabilities=${ids.size} schema=${model.schemaVersion} evidence-chain=bound`);
