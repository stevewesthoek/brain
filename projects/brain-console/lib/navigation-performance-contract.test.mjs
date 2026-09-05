import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const shell = fs.readFileSync(path.join(root, 'components/shell.tsx'), 'utf8');

test('navigation does not idle-prefetch the whole application', () => {
  assert.doesNotMatch(shell, /IDLE_PREFETCH_ROUTES/);
  assert.doesNotMatch(shell, /setTimeout\(\(\) => \{[\s\S]*router\.prefetch/);
  assert.match(shell, /<a href=\{item\.href\} className=\{cn\('nav-link'/);
  assert.doesNotMatch(shell, /prefetchTopLevel/);
  assert.match(shell, /prefetchBrainChild/);
});

test('Brain navigation keeps deferred subroute prefetch', () => {
  assert.match(shell, /pathname\.startsWith\('\/brain'\)/);
  assert.match(shell, /onMouseEnter=\{\(\) => prefetch\(child\.href\)\}/);
  assert.match(shell, /onFocus=\{\(\) => prefetch\(child\.href\)\}/);
});

test('relative-time labels cannot fail hydration on task detail', () => {
  const freshness = fs.readFileSync(path.join(root, 'components', 'freshness-label.tsx'), 'utf8');
  assert.match(shell, /className="meta" suppressHydrationWarning>updated/);
  assert.match(freshness, /aria-label=\{detail \? `\$\{label\}: \$\{detail\}` : label\} suppressHydrationWarning/);
});

test('the Core URL has one server/client-safe loopback fallback', () => {
  const client = fs.readFileSync(path.join(root, 'lib', 'braincore-client.ts'), 'utf8');
  assert.match(client, /NEXT_PUBLIC_BRAIN_CORE_URL \?\? 'http:\/\/127\.0\.0\.1:4877'/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_BRAIN_CORE_URL \?\? 'http:\/\/localhost:4877'/);
});

test('the app does not emit a favicon 404 during browser QA', () => {
  assert.ok(fs.existsSync(path.join(root, 'app', 'favicon.ico', 'route.ts')));
});
