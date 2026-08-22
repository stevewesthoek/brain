import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { evaluateInfrastructureActionSafety } from '../projects/brain-core/src/adapters/infrastructure-action-safety.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];

const schema = readJson('operations/specs/infrastructure-action-v1.schema.json');
const fixtures = readJson('operations/fixtures/infrastructure-action-fixtures-v1.json');
const safetyPoliciesDoc = readJson('operations/infrastructure/catalog/safety-policies.v1.json');
const evaluatorText = readText('projects/brain-core/src/adapters/infrastructure-action-safety.mjs');

if (fixtures.policyCatalogVersion !== safetyPoliciesDoc.catalogVersion) {
  errors.push(`fixture policyCatalogVersion ${fixtures.policyCatalogVersion} != safety policy catalogVersion ${safetyPoliciesDoc.catalogVersion}`);
}
if (schema.$defs?.actionPlan?.properties?.schemaVersion?.const !== '1.0.0') errors.push('action schema version must remain 1.0.0');
if (!schema.$defs?.actionSafetyClass?.enum?.includes('forbidden')) errors.push('action schema safety classes must include forbidden');
if (!schema.$defs?.requiredAuthority?.enum?.includes('decision_core_approval')) errors.push('action schema must expose Decision Core approval authority');
if (schema.$defs?.approvalRef?.properties?.system?.const !== 'clr3-decision-core') errors.push('approvalRef must bind to CLR3 Decision Core');
if (!schema.$defs?.actionPlan?.required?.includes('policyRefs')) errors.push('action plan must require explicit policyRefs');
if (!schema.$defs?.preconditions?.required?.includes('currentRevisions')) errors.push('preconditions must require current revision evidence');

const publicSchemaText = JSON.stringify(schema).toLowerCase();
for (const forbidden of ['newrelic', 'cloudflare', 'tailscale', 'dokploy', 'azure', 'aws', 'lightsail', 'hetzner', 'office', 'macbook']) {
  if (publicSchemaText.includes(forbidden)) errors.push(`public action schema contains provider/host-specific coupling: ${forbidden}`);
}

for (const [planName, actionPlan] of Object.entries(fixtures.plans ?? {})) {
  const validationErrors = validateJsonSchema(schema.$defs.actionPlan, actionPlan, schema, `$.plans.${planName}`);
  errors.push(...validationErrors);
}

const evaluate = (actionPlan, extra = {}) => evaluateInfrastructureActionSafety({
  actionPlan,
  resources: fixtures.resources,
  relations: fixtures.relations,
  safetyPolicies: fixtures.safetyPolicies,
  incidents: extra.incidents ?? [],
  canonicalPolicyCatalogVersion: fixtures.policyCatalogVersion,
  now: fixtures.now,
});

const readOnly = fixtures.plans?.readOnly && evaluate(fixtures.plans.readOnly);
if (!readOnly || readOnly.decision !== 'allowed_read_only') errors.push('read-only fixture must evaluate allowed_read_only');
if (readOnly?.executionEnabled !== false || readOnly?.executionPerformed !== false) errors.push('read-only evaluator must not enable or perform execution');

const highRisk = fixtures.plans?.highRiskApproved && evaluate(fixtures.plans.highRiskApproved);
if (!highRisk || highRisk.decision !== 'preflight_ready') errors.push('approved high-risk fixture must evaluate preflight_ready');
if (highRisk?.requiredAuthority !== 'decision_core_approval' || highRisk?.approvalStatus !== 'approved') errors.push('high-risk fixture must require valid CLR3 approval');
if (highRisk?.executionEnabled !== false || highRisk?.executionPerformed !== false || (highRisk?.actualEffects ?? []).length !== 0) {
  errors.push('preflight-ready high-risk action must remain non-executable with no actual effects');
}
if (highRisk?.receipt?.containsSecrets !== false) errors.push('receipt must explicitly contain no secrets');

const lowRisk = fixtures.plans?.lowRiskReady && evaluate(fixtures.plans.lowRiskReady);
if (!lowRisk || lowRisk.decision !== 'preflight_ready' || lowRisk.requiredAuthority !== 'none') {
  errors.push('low-risk reversible fixture must reach preflight_ready without Decision Core authority');
}

for (const forbiddenImport of ["node:fs", "node:child_process", "node:net", "node:http", "node:https", "node:dns", "node:tls"]) {
  if (evaluatorText.includes(`from '${forbiddenImport}'`) || evaluatorText.includes(`from \"${forbiddenImport}\"`)) {
    errors.push(`evaluator imports forbidden execution/network surface: ${forbiddenImport}`);
  }
}
for (const forbiddenPattern of ['process.env', 'fetch(', 'spawn(', 'exec(', 'execFile(', 'DecisionCore(', 'approvalStore']) {
  if (evaluatorText.includes(forbiddenPattern)) errors.push(`evaluator contains forbidden runtime/approval-write pattern: ${forbiddenPattern}`);
}
if (!evaluatorText.includes('executionEnabled: false')) errors.push('evaluator must hard-code executionEnabled=false');
if (!evaluatorText.includes('executionPerformed: false')) errors.push('evaluator must hard-code executionPerformed=false');
if (!evaluatorText.includes('actualEffects: []')) errors.push('evaluator must keep actualEffects empty');

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

console.log(`infrastructure-actions-valid schema=${schema.$id} fixturePlans=${Object.keys(fixtures.plans ?? {}).length} policyCatalogVersion=${fixtures.policyCatalogVersion} decisionCoreReferenceOnly=true executionEnabled=false providerNeutral=true`);
