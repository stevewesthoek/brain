import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const files = Object.fromEntries(await Promise.all([
  ['loading', '../app/loading.tsx'],
  ['shell', '../components/shell.tsx'],
  ['providers', '../components/providers.tsx'],
  ['pulse', '../components/global-pulse-strip.tsx'],
  ['service', '../../../tools/brain-console-service.mjs'],
  ['cockpitCss', '../app/globals.css'],
].map(async ([key, path]) => [key, await readFile(new URL(path, import.meta.url), 'utf8')])));

test('Brain Console keeps the instant-navigation contract', () => {
  assert.match(files.loading, /route-loading/);
  assert.match(files.shell, /router\.prefetch/);
  assert.match(files.providers, /gcTime: 10 \* 60_000/);
  assert.match(files.providers, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(files.pulse, /refetchInterval: 1_000/);
  assert.match(files.pulse, /refetchIntervalInBackground: false/);
  assert.match(files.service, /productionBuild/);
  assert.match(files.service, /nextMode/);
  assert.match(files.cockpitCss, /\.command-center-shell \{[\s\S]*overflow: hidden;/);
  assert.match(files.cockpitCss, /@media \(max-width: 1200px\) and \(min-width: 981px\)/);
});
