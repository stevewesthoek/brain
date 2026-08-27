import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../components/canonical-infrastructure-telemetry.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/monitoring/page.tsx', import.meta.url), 'utf8');
const legacyComponent = readFileSync(new URL('../components/monitoring-dashboard.tsx', import.meta.url), 'utf8');

test('canonical New Relic tab is bound to the Brain Core telemetry contract', () => {
  assert.match(page, /CanonicalInfrastructureTelemetry/);
  assert.match(component, /brainCoreRequest\('\/infra\/telemetry'/);
  assert.doesNotMatch(component, /\/infra\/monitoring/);
  assert.doesNotMatch(component, /NEW_RELIC_(?:USER_API_KEY|ACCOUNT_ID)/);
});

test('canonical tab renders exactly the three approved host identities', () => {
  for (const host of ['dokploy-aws', 'cloudpanel-aws', 'vm-supabase']) {
    assert.match(component, new RegExp(host));
  }
  assert.match(component, /name: 'dokploy-aws', resourceId: 'host:dokploy-aws'/);
  assert.match(component, /name: 'cloudpanel-aws', resourceId: 'host:cloudpanel-aws'/);
  assert.match(component, /name: 'vm-supabase', resourceId: 'host:vm-supabase'/);
  assert.match(component, /aria-label="Exactly three canonical production hosts"/);
});

test('legacy monitoring component remains available for its legacy contract', () => {
  assert.match(legacyComponent, /brainCoreRequest\('\/infra\/monitoring'/);
});
