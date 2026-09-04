import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const page = await readFile(new URL('../app/command-center/page.tsx', import.meta.url), 'utf8');
const component = await readFile(new URL('../components/command-center.tsx', import.meta.url), 'utf8');
const shell = await readFile(new URL('../components/shell.tsx', import.meta.url), 'utf8');

test('Command Center is a real route backed by one bounded operational snapshot query', () => {
  assert.match(page, /CommandCenter/);
  assert.match(component, /getOperationalSnapshot/);
  assert.equal((component.match(/useQuery\(/g) ?? []).length, 1);
  assert.match(component, /queryFn: getOperationalSnapshot/);
  assert.match(component, /refetchInterval: REFRESH_INTERVAL_MS/);
  assert.match(component, /const REFRESH_INTERVAL_MS = 10_000/);
  assert.match(component, /skeleton-command-title/);
  assert.match(component, /Brain Core unavailable/);
  assert.match(component, /Showing the last valid snapshot/);
  assert.match(shell, /href: '\/command-center'/);
  assert.match(shell, /href: '\/', label: 'Overview'/);
  assert.match(shell, /pathname !== '\/command-center' \? <GlobalPulseStrip \/> : null/);
});
