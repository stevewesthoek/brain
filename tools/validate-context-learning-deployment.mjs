import path from 'node:path';
import process from 'node:process';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';
import {
  PROFILE_KINDS,
  createDryRunLifecycleReceipt,
  createSafeLifecyclePlan,
  validateLifecyclePlan,
} from './context-learning/deployment-runtime.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schema = loadJson(path.join(root, 'operations/specs/context-learning/deployment-profile-v1.schema.json'));
const lifecycleSchema = loadJson(path.join(root, 'operations/specs/context-learning/lifecycle-contract-v1.schema.json'));
const fixtures = loadJson(path.join(root, 'operations/fixtures/context-learning-deployment-profiles-v1.json'));
const errors = [];
const seenKinds = new Set();
const seenIds = new Set();

if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  errors.push('deployment schema must use Draft 2020-12');
}
if (!schema.$id) errors.push('deployment schema requires stable $id');
for (const required of ['providerBinding', 'transportCandidate', 'cachePolicy', 'lifecyclePolicy']) {
  if (!schema.$defs?.[required]) errors.push(`missing schema definition: ${required}`);
}

for (const [index, profile] of (fixtures.profiles ?? []).entries()) {
  errors.push(...validateJsonSchema(schema, profile, schema, `$.profiles[${index}]`));
  if (seenIds.has(profile.profileId)) errors.push(`duplicate profileId: ${profile.profileId}`);
  seenIds.add(profile.profileId);
  seenKinds.add(profile.profileKind);
}
for (const kind of PROFILE_KINDS) {
  if (!seenKinds.has(kind)) errors.push(`missing deployment profile kind: ${kind}`);
}

const genericProfiles = fixtures.profiles.filter(
  (profile) => profile.profileId !== 'steve-personal-dual-host-reference',
);
const genericText = JSON.stringify(genericProfiles).toLowerCase();
for (const forbidden of [
  'steve',
  'office-repos-tb',
  'office-repos-ts',
  '/users/office',
  'macbook',
  'obsidian',
]) {
  if (genericText.includes(forbidden)) errors.push(`generic profile coupling detected: ${forbidden}`);
}

const schemaText = JSON.stringify(schema).toLowerCase();
for (const forbidden of ['steve', 'office', 'macbook', 'obsidian', 'claude', 'codex']) {
  if (schemaText.includes(forbidden)) errors.push(`public schema coupling detected: ${forbidden}`);
}

for (const operation of ['install', 'update', 'export', 'backup', 'rollback']) {
  const plan = createSafeLifecyclePlan({
    operation,
    profileId: 'generic-personal-local',
    receiptRef: `receipt://${operation}`,
    rollbackRef: `rollback://${operation}`,
  });
  errors.push(...validateLifecyclePlan(plan).map((error) => `${operation}: ${error}`));
  errors.push(...validateJsonSchema(
    lifecycleSchema.$defs.plan,
    plan,
    lifecycleSchema,
    `$.lifecycle.${operation}.plan`,
  ));

  const receipt = createDryRunLifecycleReceipt({
    plan,
    createdAt: new Date('2026-08-16T12:45:00.000Z'),
  });
  errors.push(...validateJsonSchema(
    lifecycleSchema.$defs.receipt,
    receipt,
    lifecycleSchema,
    `$.lifecycle.${operation}.receipt`,
  ));
  if (receipt.writesPerformed !== false) errors.push(`${operation}: lifecycle receipt must report writesPerformed=false`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `context-learning-deployment-valid schema=${schema.$id} profiles=${fixtures.profiles.length} kinds=${seenKinds.size} lifecycleOps=5`,
);
