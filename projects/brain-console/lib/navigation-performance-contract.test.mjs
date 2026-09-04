import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const shell = fs.readFileSync(path.join(root, 'components/shell.tsx'), 'utf8');

test('navigation does not idle-prefetch the whole application', () => {
  assert.doesNotMatch(shell, /IDLE_PREFETCH_ROUTES/);
  assert.doesNotMatch(shell, /setTimeout\(\(\) => \{[\s\S]*router\.prefetch/);
  assert.match(shell, /prefetchTopLevel\(item\.href\)/);
  assert.match(shell, /prefetchBrainChild/);
});

test('Brain navigation keeps normal prefetch and deferred subroute prefetch', () => {
  assert.match(shell, /href === '\/command-center' \|\| href === '\/brain'/);
  assert.match(shell, /pathname\.startsWith\('\/brain'\)/);
  assert.match(shell, /onMouseEnter=\{\(\) => prefetch\(child\.href\)\}/);
  assert.match(shell, /onFocus=\{\(\) => prefetch\(child\.href\)\}/);
});

test('relative-time labels cannot fail hydration on task detail', () => {
  const freshness = fs.readFileSync(path.join(root, 'components', 'freshness-label.tsx'), 'utf8');
  assert.match(shell, /className="meta" suppressHydrationWarning>updated/);
  assert.match(freshness, /aria-label=\{detail \? `\$\{label\}: \$\{detail\}` : label\} suppressHydrationWarning/);
});
