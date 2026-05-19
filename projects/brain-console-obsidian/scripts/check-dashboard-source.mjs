import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const main = await readFile(new URL('src/main.ts', root), 'utf8');
const view = await readFile(new URL('src/view.ts', root), 'utf8');
const styles = await readFile(new URL('styles.css', root), 'utf8');

assert(main.includes('brain-console-design-system-2026-05-19-01'), 'main.ts missing current build marker');
assert(!main.includes('getRightLeaf'), 'main.ts still references getRightLeaf');
assert(view.includes('renderActiveSectionContent('), 'view.ts missing renderActiveSectionContent');
assert(view.includes('Dashboard Self Check'), 'view.ts missing Dashboard Self Check card');
assert(view.includes('Reports & System Health'), 'view.ts missing Reports & System Health card');
for (const label of ['Pipeline Overview', 'Video Orchestrator', 'Provider Planning', 'Controlled Execution', 'STB / Video Migration', 'Safety Summary']) {
  assert(view.includes(label), `view.ts missing grouped pipelines label: ${label}`);
}
assert(styles.includes('.brain-console__card'), 'styles.css missing card design system');
assert(styles.includes('minmax(320px, 1fr)'), 'styles.css missing dashboard grid minmax(320px, 1fr)');

console.log('✓ Dashboard source checks passed.');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
