import test from 'node:test';
import assert from 'node:assert/strict';
import { makePhase8dCohort, makePhase8dSubstantivePlans } from './run-phase8d-research-default.mjs';

test('Phase 8D cohort has the required default-path coverage', () => {
  const cohort = makePhase8dCohort();
  assert.equal(cohort.length, 100);
  assert.equal(cohort.filter((item) => item.expectedQualification).length, 2);
  assert.ok(cohort.filter((item) => item.category.startsWith('BIBLE_')).length >= 20);
  assert.ok(cohort.some((item) => item.category === 'OUTDOOR_LOCATION'));
  assert.ok(cohort.some((item) => item.category === 'MIXED_CONTRADICTION'));
});

test('Phase 8D substantive evidence matrix meets its explicit minimums', () => {
  const plans = makePhase8dSubstantivePlans();
  assert.equal(plans.length, 25);
  assert.equal(plans.filter((item) => item.label === 'general/deep').length, 5);
  assert.equal(plans.filter((item) => item.label === 'business/company').length, 5);
  assert.equal(plans.filter((item) => item.label === 'technical/comparative').length, 4);
  assert.equal(plans.filter((item) => item.label === 'outdoor/specialist').length, 3);
  assert.equal(plans.filter((item) => item.label === 'bible').length, 8);
});
