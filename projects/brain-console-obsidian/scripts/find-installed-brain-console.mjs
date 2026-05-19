import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/Office';
const markers = [
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

const skippedNames = new Set(['node_modules', '.git', 'Library', 'Applications']);
const found = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const isPluginDir = dir.endsWith(path.join('.obsidian', 'plugins', 'brain-console'));
  if (isPluginDir) {
    await inspectPluginDir(dir);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skippedNames.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.obsidian') continue;
    await walk(path.join(dir, entry.name));
  }
}

async function inspectPluginDir(dir) {
  const mainPath = path.join(dir, 'main.js');
  const manifestPath = path.join(dir, 'manifest.json');
  const dataPath = path.join(dir, 'data.json');
  let main = '';
  let manifest = '';
  let data = '';
  let mainStat;
  try {
    main = await readFile(mainPath, 'utf8');
    mainStat = await stat(mainPath);
  } catch {}
  try {
    manifest = await readFile(manifestPath, 'utf8');
  } catch {}
  try {
    data = await readFile(dataPath, 'utf8');
  } catch {}

  found.push({
    dir,
    mainSize: mainStat?.size ?? 0,
    mainModifiedAt: mainStat?.mtime?.toISOString() ?? 'missing',
    manifestId: readManifestId(manifest),
    data,
    markers: markers.filter((marker) => main.includes(marker)),
    staleMarkers: markers.filter((marker) => marker !== 'brain-console-local-apps-functional-2026-05-19-01' && main.includes(marker)),
  });
}

function readManifestId(raw) {
  try {
    return JSON.parse(raw).id ?? 'missing';
  } catch {
    return raw ? 'invalid-json' : 'missing';
  }
}

await walk(root);

console.log(JSON.stringify({ root, found }, null, 2));

if (found.length === 0) {
  process.exitCode = 1;
}
