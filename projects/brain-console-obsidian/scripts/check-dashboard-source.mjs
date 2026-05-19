import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const main = await readFile(new URL('src/main.ts', root), 'utf8');
const view = await readFile(new URL('src/view.ts', root), 'utf8');
const styles = await readFile(new URL('styles.css', root), 'utf8');

assert(main.includes('brain-console-local-apps-functional-2026-05-19-01'), 'main.ts missing current build marker');
assert(!main.includes('getRightLeaf'), 'main.ts still references getRightLeaf');
assert(view.includes('renderActiveSectionContent('), 'view.ts missing renderActiveSectionContent');
assert(view.includes('Dashboard Self Check'), 'view.ts missing Dashboard Self Check card');
assert(view.includes('Local Apps'), 'view.ts missing Local Apps section');
assert(view.includes('App Operations Policy'), 'view.ts missing App Operations Policy card');
assert(view.includes('Onboarding Standards'), 'view.ts missing Onboarding Standards card');
assert(view.includes('Model Router'), 'view.ts missing Model Router handling');
assert(view.includes('requestBrainCoreLocalAppAction'), 'view.ts missing local app action request wiring');
assert(view.includes('Reports & System Health'), 'view.ts missing Reports & System Health card');
assert(view.includes('readBrainCoreLocalAppsDashboard('), 'view.ts missing local apps dashboard reader');
assert(view.includes('Compact operations inventory with controlled Brain Core actions.'), 'view.ts missing local apps dashboard content');
for (const label of ['Pipeline Overview', 'Video Orchestrator', 'Provider Planning', 'Controlled Execution', 'STB / Video Migration', 'Safety Summary']) {
  assert(view.includes(label), `view.ts missing grouped pipelines label: ${label}`);
}
assert(styles.includes('.brain-console__card'), 'styles.css missing card design system');
assert(styles.includes('minmax(155px, 1fr)'), 'styles.css missing micro apps grid minmax(155px, 1fr)');
assert(!view.includes('child_process'), 'view.ts must not import or reference child_process');

console.log('✓ Dashboard source checks passed.');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
