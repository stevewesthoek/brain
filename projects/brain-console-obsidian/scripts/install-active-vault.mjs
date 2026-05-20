import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const expectedMarker = 'brain-console-local-apps-live-actions-2026-05-19-01';
const searchRoot = '/Users/Office';
const managedFiles = ['main.js', 'styles.css', 'manifest.json'];
const skippedDirectoryNames = new Set(['node_modules', '.git', 'Library', 'Applications']);
const staleMarkers = [
  'brain-console-local-apps-functional-2026-05-19-01',
  'brain-console-local-apps-actions-2026-05-19-01',
  'brain-console-local-apps-orchestrator-2026-05-19-01',
  'brain-console-local-apps-migration-2026-05-19-01',
  'brain-console-design-system-2026-05-19-01',
  'brain-console-section-guard-2026-05-19-01',
  'brain-console-state-loader-fix-2026-05-19-01',
  'brain-console-open-fix-2026-05-19-01',
  'brain-console-main-dashboard-2026-05-19-01',
  'brain-console-polished-main-dashboard-2026-05-19-01',
  'brain-console-dashboard-stable-2026-05-19-01',
  'native-card-ui-2026-05-19-01',
  'brain-console-connection-diagnostics-2026-05-19-01',
  'brain-console-emergency-restore-2026-05-19-01',
  'probot-decommission-gap-closure-2026-05-19-01',
  'probot-functional-polish-2026-05-19-01',
  'probot-functional-parity-2026-05-19-01',
  'scaffold 2026-05-18',
];

const discoveredPluginDirs = new Set();

await discoverBrainConsolePluginDirs(searchRoot);

if (discoveredPluginDirs.size === 0) {
  throw new Error(`No installed brain-console plugin folders found under ${searchRoot}`);
}

const releaseMain = await readFile(new URL('../release/main.js', import.meta.url), 'utf8');
if (!releaseMain.includes(expectedMarker)) {
  throw new Error(`Release main.js does not contain expected marker ${expectedMarker}. Run npm run build && npm run package first.`);
}

const installed = [];
for (const pluginDir of [...discoveredPluginDirs].sort()) {
  await installToPluginDir(pluginDir);
  installed.push(await verifyPluginDir(pluginDir));
}

const stale = installed.filter((entry) => !entry.markerOk || entry.staleMarkers.length > 0 || entry.manifestId !== 'brain-console');

console.table(installed.map((entry) => ({
  pluginDir: entry.pluginDir,
  markerOk: entry.markerOk ? 'yes' : 'no',
  staleMarkers: entry.staleMarkers.join(', ') || 'none',
  mainModifiedAt: entry.mainModifiedAt,
  stylesModifiedAt: entry.stylesModifiedAt,
})));

if (stale.length > 0) {
  throw new Error(`Brain Console install verification failed for ${stale.length} plugin folder(s).`);
}

console.log(`✓ Installed and verified Brain Console in ${installed.length} plugin folder(s).`);
console.log('✓ No stale Brain Console bundles remain in discovered plugin folders.');

async function discoverBrainConsolePluginDirs(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  if (root.endsWith(path.join('.obsidian', 'plugins', 'brain-console'))) {
    discoveredPluginDirs.add(root);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skippedDirectoryNames.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.obsidian') continue;
    await discoverBrainConsolePluginDirs(path.join(root, entry.name));
  }
}

async function installToPluginDir(pluginDir) {
  await mkdir(pluginDir, { recursive: true });
  for (const file of managedFiles) {
    await copyFile(new URL(`../release/${file}`, import.meta.url), path.join(pluginDir, file));
  }
}

async function verifyPluginDir(pluginDir) {
  const mainPath = path.join(pluginDir, 'main.js');
  const manifestPath = path.join(pluginDir, 'manifest.json');
  const stylesPath = path.join(pluginDir, 'styles.css');
  const main = await readFile(mainPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const mainStat = await stat(mainPath);
  const stylesStat = await stat(stylesPath);

  return {
    pluginDir,
    markerOk: main.includes(expectedMarker),
    staleMarkers: staleMarkers.filter((marker) => main.includes(marker)),
    manifestId: manifest.id ?? 'missing',
    mainModifiedAt: mainStat.mtime.toISOString(),
    stylesModifiedAt: stylesStat.mtime.toISOString(),
  };
}
