import { mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = new URL('../dist/', import.meta.url);
const releaseDir = new URL('../release/', import.meta.url);
const currentMarker = 'v2.14';
const staleMarkers = [
  'v2.13',
  'v2.12',
  'v2.11',
  'v2.10',
  'v2.9',
  'v2.8',
  'v2.7',
  'v2.6',
  'v2.5',
  'v2.4',
  'v2.3',
  'v2.2',
  'v2.1',
  'v2.0',
  'brain-console-local-apps-live-actions-2026-05-19-01',
  'brain-console-local-apps-functional-2026-05-19-01',
  'brain-console-local-apps-actions-2026-05-19-01',
  'brain-console-local-apps-orchestrator-2026-05-19-01',
  'brain-console-local-apps-migration-2026-05-19-01',
  'brain-console-dashboard-stable-2026-05-19-01',
  'brain-console-polished-main-dashboard-2026-05-19-01',
  'brain-console-main-dashboard-2026-05-19-01',
  'brain-console-design-system-2026-05-19-01',
  'brain-console-section-guard-2026-05-19-01',
  'brain-console-state-loader-fix-2026-05-19-01',
  'brain-console-open-fix-2026-05-19-01',
  'brain-console-connection-diagnostics-2026-05-19-01',
  'brain-console-emergency-restore-2026-05-19-01',
  'probot-decommission-gap-closure-2026-05-19-01',
  'probot-functional-polish-2026-05-19-01',
  'probot-functional-parity-2026-05-19-01',
  'native-card-ui-2026-05-19-01',
  'scaffold 2026-05-18',
];

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

// Copy only the bundled main.js and static files
for (const file of ['manifest.json', 'styles.css']) {
  try {
    await copyFile(new URL(`../${file}`, import.meta.url), new URL(`../release/${file}`, import.meta.url));
  } catch (err) {
    console.warn(`Warning: could not copy ${file}`);
  }
}

// Copy only the bundled main.js (not individual modules), after removing historical marker strings.
try {
  const distMainPath = new URL('../dist/main.js', import.meta.url);
  const releaseMainPath = new URL('../release/main.js', import.meta.url);
  let main = await readFile(distMainPath, 'utf8');
  if (!main.includes(currentMarker)) {
    throw new Error(`dist/main.js does not contain current marker ${currentMarker}.`);
  }
  // Protect the current marker before replacing stale ones (guards against prefix collisions like v2.1 vs v2.10)
  const SENTINEL = '__BRAIN_CONSOLE_CURRENT_MARKER__';
  main = main.replaceAll(currentMarker, SENTINEL);
  for (const marker of staleMarkers) {
    main = main.replaceAll(marker, '[stale-brain-console-marker-removed]');
  }
  main = main.replaceAll(SENTINEL, currentMarker);
  await writeFile(releaseMainPath, main);
} catch (err) {
  console.error(`Error: dist/main.js could not be packaged. ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

console.log(`✓ Brain Console package staged at ${path.relative(process.cwd(), new URL('../release/', import.meta.url).pathname)}`);
