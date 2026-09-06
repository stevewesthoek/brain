#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { loadAndValidateReferenceCatalog } from './infrastructure-catalog/catalog-core.mjs';
import {
  planInfrastructureAdmission,
  validateInfrastructureGovernance,
} from './infrastructure-catalog/governance-core.mjs';
import { loadJson } from './context-learning/context-learning-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schema = loadJson(path.join(root, 'operations/specs/infrastructure-catalog-v1.schema.json'));
const onboarding = loadJson(path.join(root, 'operations/fixtures/infrastructure-onboarding-alternate-v1.json'));
const codexMetadata = loadJson(path.join(root, 'operations/fixtures/infrastructure-codex-web-gpt-metadata-v1.json'));
const now = new Date('2026-09-05T00:00:00.000Z');
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const canonical = loadAndValidateReferenceCatalog(root, now);
const canonicalGovernance = validateInfrastructureGovernance({
  schema,
  bundle: canonical.bundle,
  now,
  label: 'canonical',
});
assert(canonicalGovernance.errors.length === 0, `canonical governance errors: ${canonicalGovernance.errors.join('; ')}`);

const onboardingReport = validateInfrastructureGovernance({
  schema,
  bundle: onboarding,
  now,
  label: 'onboarding-alternate',
});
assert(onboardingReport.errors.length === 0, `onboarding fixture errors: ${onboardingReport.errors.join('; ')}`);
assert(onboardingReport.counts.governedResources === 8, 'onboarding fixture must prove eight governed resources');
assert(onboardingReport.counts.admitted === 6, 'onboarding fixture must prove six admitted resources');
assert(onboardingReport.counts.candidates === 2, 'onboarding fixture must prove two candidate resources');
assert(onboardingReport.counts.unownedRoutes === 1, 'onboarding fixture must expose one unresolved candidate route owner');

const betaPlan = planInfrastructureAdmission({ resourceId: 'application:beta-consumer', bundle: onboarding, now });
assert(betaPlan.decision === 'remain_candidate', 'unresolved beta ownership must remain a candidate');
assert(betaPlan.executionEnabled === false && betaPlan.executionPerformed === false, 'admission planning must remain non-executable');
const originalState = onboarding.resources.find((resource) => resource.resourceId === 'application:beta-consumer')?.governance?.admissionState;
assert(originalState === 'candidate', 'admission planning must not mutate the fixture');

const codexReport = validateInfrastructureGovernance({
  schema,
  bundle: codexMetadata.catalog,
  now,
  label: 'codex-web-gpt-metadata',
});
assert(codexReport.errors.length === 0, `Codex Web GPT metadata errors: ${codexReport.errors.join('; ')}`);
const codexApp = codexMetadata.catalog.resources.find((resource) => resource.resourceId === 'application:codex-web-gpt');
const browserSession = codexMetadata.catalog.resources.find((resource) => resource.resourceKind === 'browser_session');
assert(codexApp?.governance?.accountCapacity === 'many', 'Codex metadata must model N-account capacity');
assert((codexApp?.governance?.identityBindingRefs ?? []).filter((ref) => ref.startsWith('account:')).length === 2, 'Codex metadata must retain two opaque account bindings');
assert(browserSession?.governance?.ownership?.custody === 'application', 'Codex browser session must remain application-custodied');
assert(codexMetadata.identityBindingNotes?.credentialCustody === 'unknown_until_evidence', 'Codex credential custody must remain unknown until evidence');
assert(codexMetadata.identityBindingNotes?.secretsIncluded === false, 'Codex metadata fixture must exclude secrets');

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'OK',
  providerNeutral: true,
  canonical: { errors: canonicalGovernance.errors.length, warnings: canonicalGovernance.warnings.length, coverage: canonicalGovernance.coverage },
  onboarding: { errors: onboardingReport.errors.length, warnings: onboardingReport.warnings.length, counts: onboardingReport.counts, betaAdmission: betaPlan.decision },
  codexWebGptMetadata: { errors: codexReport.errors.length, warnings: codexReport.warnings.length, accounts: 2, credentialCustody: codexMetadata.identityBindingNotes.credentialCustody, liveIntegration: false },
  executionEnabled: false,
  executionPerformed: false,
  containsSecrets: false,
}, null, 2));
