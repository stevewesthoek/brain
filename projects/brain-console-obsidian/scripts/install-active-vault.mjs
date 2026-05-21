import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const expectedMarker = 'v2.3';
const pluginDir = '/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console';
const managedFiles = ['main.js', 'styles.css', 'manifest.json'];

const releaseMain = await readFile(new URL('../release/main.js', import.meta.url), 'utf8');
if (!releaseMain.includes(expectedMarker)) {
  throw new Error(`Release main.js does not contain expected marker ${expectedMarker}. Run npm run build && npm run package first.`);
}

await mkdir(pluginDir, { recursive: true });
for (const file of managedFiles) {
  await copyFile(new URL(`../release/${file}`, import.meta.url), path.join(pluginDir, file));
}

const mainPath = path.join(pluginDir, 'main.js');
const stylesPath = path.join(pluginDir, 'styles.css');
const main = await readFile(mainPath, 'utf8');
const mainStat = await stat(mainPath);
const stylesStat = await stat(stylesPath);

if (!main.includes(expectedMarker)) {
  throw new Error(`Installed main.js does not contain marker ${expectedMarker} — install failed.`);
}

console.table([{
  pluginDir,
  marker: expectedMarker,
  mainModifiedAt: mainStat.mtime.toISOString(),
  stylesModifiedAt: stylesStat.mtime.toISOString(),
}]);

console.log('✓ Brain Console installed to active vault.');
