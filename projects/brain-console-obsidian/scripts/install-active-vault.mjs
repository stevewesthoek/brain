import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const expectedMarker = 'brain-console-open-fix-2026-05-19-01';
const releaseDir = new URL('../release/', import.meta.url);
const activePluginDir = '/Users/Office/mind/.obsidian/plugins/brain-console';

await mkdir(activePluginDir, { recursive: true });

for (const file of ['main.js', 'styles.css', 'manifest.json']) {
  await copyFile(new URL(`../release/${file}`, import.meta.url), path.join(activePluginDir, file));
}

const installedMain = await readFile(path.join(activePluginDir, 'main.js'), 'utf8');
if (!installedMain.includes(expectedMarker)) {
  throw new Error(`Installed main.js does not contain expected marker ${expectedMarker}`);
}
if (installedMain.includes('scaffold 2026-05-18')) {
  throw new Error('Installed main.js still contains stale scaffold marker');
}

const manifest = JSON.parse(await readFile(path.join(activePluginDir, 'manifest.json'), 'utf8'));
if (manifest.id !== 'brain-console') {
  throw new Error(`Installed manifest id mismatch: ${manifest.id}`);
}

const stylesStat = await stat(path.join(activePluginDir, 'styles.css'));
console.log(`✓ Installed Brain Console to ${activePluginDir}`);
console.log(`✓ Build marker verified: ${expectedMarker}`);
console.log(`✓ styles.css size: ${stylesStat.size} bytes`);
