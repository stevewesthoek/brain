import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { projectIncidents } from '../projects/brain-core/src/adapters/infrastructure-incident-engine.mjs';
import { DEFAULT_INCIDENT_STATE_PATH } from '../projects/brain-core/src/adapters/infrastructure-incident-runtime.mjs';
import { DEFAULT_NOTIFICATION_STATE_PATH, planIncidentAttention } from '../projects/brain-core/src/adapters/infrastructure-incident-notifications.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const readText = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];

const schema = readJson('operations/specs/infrastructure-incident-v1.schema.json');
const fixtures = readJson('operations/fixtures/infrastructure-incident-fixtures-v1.json');
const policies = readJson('operations/infrastructure/catalog/health-policies.v1.json');

if (fixtures.policyCatalogVersion !== policies.catalogVersion) {
  errors.push(`fixture policyCatalogVersion ${fixtures.policyCatalogVersion} != health policy catalogVersion ${policies.catalogVersion}`);
}

const expectedFingerprintInputs = ['resourceId', 'conditionCode', 'healthPolicyId', 'policyCatalogVersion'];
if (JSON.stringify(fixtures.fingerprintContract?.orderedInputs) !== JSON.stringify(expectedFingerprintInputs)) {
  errors.push('fixture fingerprint orderedInputs do not match IKHP3 contract');
}

if (schema.$defs?.conditionCode?.enum) errors.push('incident schema must not define a second condition-code enum/registry');
if (schema.$defs?.incident?.properties?.affectedResourceIds?.maxItems !== 1) errors.push('affectedResourceIds must remain direct-resource-only in IKHP3');
if (!schema.$defs?.severity?.enum?.includes('unknown')) errors.push('incident schema severity must include unknown');
if (!schema.$defs?.policyAuthority?.enum?.includes('unknown')) errors.push('incident schema policyAuthority must include unknown');

const publicSchemaText = JSON.stringify(schema).toLowerCase();
for (const forbidden of ['steve', 'office', 'macbook', 'obsidian', 'newrelic', 'cloudflare', 'tailscale', 'dokploy']) {
  if (publicSchemaText.includes(forbidden)) errors.push(`public incident schema contains implementation-specific coupling: ${forbidden}`);
}

const scenarioById = Object.fromEntries(fixtures.scenarios.map((scenario) => [scenario.scenarioId, scenario]));
for (const required of [
  'authoritative-critical-open',
  'authoritative-high-open',
  'repeated-condition-continues',
  'fresh-clean-recovers',
  'stale-does-not-recover',
  'unknown-policy-fails-closed',
  'recovered-reopens',
  'acknowledgement-does-not-change-health',
]) {
  if (!scenarioById[required]) errors.push(`missing deterministic incident fixture scenario: ${required}`);
}

const now = '2026-08-17T14:30:00Z';
const criticalScenario = scenarioById['authoritative-critical-open'];
if (criticalScenario) {
  const projected = projectIncidents({
    observations: [criticalScenario.observation],
    healthPolicies: policies.healthPolicies,
    policyCatalogVersion: policies.catalogVersion,
    now,
  });
  const incident = projected.incidents[0];
  if (!incident) errors.push('authoritative critical fixture produced no incident');
  else {
    const validationErrors = validateJsonSchema(schema.$defs.incident, incident, schema, '$.incident');
    errors.push(...validationErrors);
    if (incident.severity !== 'critical' || incident.policyAuthority !== 'authoritative') errors.push('authoritative severity mapping failed');
    if (incident.healthPolicyId !== 'health_policy:dokploy-aws-host') errors.push('authoritative healthPolicyId mapping failed');
    if (incident.affectedResourceIds.length !== 1 || incident.affectedResourceIds[0] !== incident.resourceId) errors.push('incident affectedResourceIds is not direct-resource-only');
  }
}

const unknownScenario = scenarioById['unknown-policy-fails-closed'];
if (unknownScenario) {
  const projected = projectIncidents({
    observations: [unknownScenario.observation],
    healthPolicies: policies.healthPolicies,
    policyCatalogVersion: policies.catalogVersion,
    now,
  });
  const incident = projected.incidents[0];
  if (!incident || incident.severity !== 'unknown' || incident.policyAuthority !== 'unknown' || incident.healthPolicyId !== null) {
    errors.push('unknown-policy fail-closed behavior failed');
  }
  if (incident) {
    const plan = planIncidentAttention({ incidents: [incident], transitions: [], now });
    if (!plan.digest || plan.digest.items?.[0]?.severity !== 'unknown') errors.push('unknown severity did not remain explicit in digest attention');
  }
}

const safeExample = fixtures.notificationSafeExample;
const safeErrors = validateJsonSchema(schema.$defs.notificationSafeFields, safeExample, schema, '$.notificationSafeExample');
errors.push(...safeErrors);
const safeKeys = new Set(['incidentId', 'resourceId', 'conditionCode', 'severity', 'transition', 'openIncidentCount', 'occurredAt']);
for (const key of Object.keys(safeExample ?? {})) if (!safeKeys.has(key)) errors.push(`notification safe example contains unexpected field: ${key}`);

const incidentRuntimeSource = readText('projects/brain-core/src/adapters/infrastructure-incident-runtime.mjs');
const notificationSource = readText('projects/brain-core/src/adapters/infrastructure-incident-notifications.mjs');
const engineSource = readText('projects/brain-core/src/adapters/infrastructure-incident-engine.mjs');

if (DEFAULT_INCIDENT_STATE_PATH !== path.join('runtime', 'local', 'infrastructure', 'incident-state.json')) errors.push('incident runtime path mismatch');
if (DEFAULT_NOTIFICATION_STATE_PATH !== path.join('runtime', 'local', 'infrastructure', 'incident-notification-state.json')) errors.push('notification runtime path mismatch');
for (const [name, source] of [['incident runtime', incidentRuntimeSource], ['notification runtime', notificationSource]]) {
  if (!source.includes('0o600')) errors.push(`${name} missing mode 0600`);
  if (!source.includes('renameSync')) errors.push(`${name} missing atomic rename`);
  if (!source.includes('.tmp-${process.pid}')) errors.push(`${name} missing sibling temporary write`);
}
if (!incidentRuntimeSource.includes("incident?.status === 'open' || incident?.status === 'suppressed'")) errors.push('active incident retention guard missing');
if (!notificationSource.includes('DEFAULT_MAX_IMMEDIATE_PER_RESOURCE_PER_HOUR = 5')) errors.push('default immediate noise ceiling is not 5');
if (!notificationSource.includes("['medium', 'low', 'unknown']")) errors.push('digest severity set missing medium/low/unknown');

for (const [name, source] of [['engine', engineSource], ['runtime', incidentRuntimeSource], ['notifications', notificationSource]]) {
  if (/infinite-brain-decision|DecisionCore|decision-core|createProposal/.test(source)) errors.push(`${name} contains Decision Core integration`);
}
for (const [name, source] of [['engine', engineSource], ['notifications', notificationSource]]) {
  if (/\bfetch\s*\(|child_process|execFile|spawn\s*\(|https?:\/\//.test(source)) errors.push(`${name} contains provider/live-call primitive`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

console.log(`infrastructure-incidents-valid scenarios=${fixtures.scenarios.length} policyCatalogVersion=${policies.catalogVersion} schema=1.0.0 directResourceOnly=true decisionCore=false runtimePaths=2`);
