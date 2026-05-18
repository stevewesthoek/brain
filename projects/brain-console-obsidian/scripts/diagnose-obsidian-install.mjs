#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MARKER_STALE = 'scaffold 2026-05-18';
const MARKER_LATEST = 'native-card-ui-2026-05-19-01';

console.log('Brain Console Plugin Installation Diagnostic\n');

// Search for all possible plugin folders
const candidates = new Set([
  '/Users/Office/mind/.obsidian/plugins/brain-console',
  '/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console',
]);

// Add any other .obsidian folders found under /Users/Office
try {
  const result = execSync(
    `find /Users/Office -type d -name ".obsidian" 2>/dev/null | head -10`,
    { encoding: 'utf8' }
  );
  const vaultFolders = result.trim().split('\n');
  for (const vault of vaultFolders) {
    if (vault) {
      const pluginPath = path.join(vault, 'plugins/brain-console');
      candidates.add(pluginPath);
    }
  }
} catch (e) {
  // find command may fail, skip
}

function checkFolder(folderPath) {
  const info = {
    path: folderPath,
    exists: fs.existsSync(folderPath),
    mainjs: null,
    styles: null,
    manifest: null,
    hasStaleMarker: false,
    hasLatestMarker: false,
  };

  if (!info.exists) {
    return info;
  }

  // Check main.js markers and size using grep
  const mainPath = path.join(folderPath, 'main.js');
  if (fs.existsSync(mainPath)) {
    const stat = fs.statSync(mainPath);
    info.mainjs = {
      size: (stat.size / 1024).toFixed(1) + 'K',
      mtime: stat.mtimeMs,
    };

    try {
      const hasStale = execSync(`grep -c "${MARKER_STALE}" "${mainPath}" 2>/dev/null || echo 0`, {
        encoding: 'utf8',
      }).trim();
      const hasLatest = execSync(`grep -c "${MARKER_LATEST}" "${mainPath}" 2>/dev/null || echo 0`, {
        encoding: 'utf8',
      }).trim();
      info.hasStaleMarker = hasStale !== '0';
      info.hasLatestMarker = hasLatest !== '0';
    } catch (e) {
      // grep may fail
    }
  }

  // Check styles.css
  const stylesPath = path.join(folderPath, 'styles.css');
  if (fs.existsSync(stylesPath)) {
    const stat = fs.statSync(stylesPath);
    info.styles = {
      size: (stat.size / 1024).toFixed(1) + 'K',
      mtime: stat.mtimeMs,
    };
  }

  // Check manifest.json (safely)
  const manifestPath = path.join(folderPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      info.manifest = {
        id: manifest.id,
        name: manifest.name,
      };
    } catch (e) {
      info.manifest = { error: 'parse_error' };
    }
  }

  return info;
}

// Check all candidates
const results = Array.from(candidates)
  .map(checkFolder)
  .filter((r) => r.exists);

if (results.length === 0) {
  console.log('No Brain Console plugin folders found.');
  process.exit(0);
}

console.log(`Found ${results.length} Brain Console plugin folder(s):\n`);

for (const result of results) {
  console.log(`Path: ${result.path}`);

  if (result.mainjs) {
    const mtimeStr = new Date(result.mainjs.mtime).toISOString();
    console.log(`  main.js: ${result.mainjs.size} (${mtimeStr})`);
    if (result.hasStaleMarker) {
      console.log(`    ✗ STALE: Contains '${MARKER_STALE}'`);
    } else {
      console.log(`    ✓ Clean: No stale marker`);
    }
    if (result.hasLatestMarker) {
      console.log(`    ✓ LATEST: Contains '${MARKER_LATEST}'`);
    } else {
      console.log(`    ✗ Old: Missing latest marker`);
    }
  } else {
    console.log(`  main.js: NOT FOUND`);
  }

  if (result.styles) {
    const mtimeStr = new Date(result.styles.mtime).toISOString();
    console.log(`  styles.css: ${result.styles.size} (${mtimeStr})`);
  } else {
    console.log(`  styles.css: NOT FOUND`);
  }

  if (result.manifest) {
    if (result.manifest.error) {
      console.log(`  manifest.json: ERROR - ${result.manifest.error}`);
    } else {
      console.log(
        `  manifest.json: id="${result.manifest.id}" name="${result.manifest.name}"`
      );
    }
  } else {
    console.log(`  manifest.json: NOT FOUND`);
  }

  console.log();
}

// Identify active vault
console.log('Active Vault Detection:');
const vaultPrefs = [
  path.join('/Users/Office/mind/.obsidian/app.json'),
  path.join('/Users/Office/Repos/stevewesthoek/mind/.obsidian/app.json'),
];

let foundActive = false;
for (const prefPath of vaultPrefs) {
  if (fs.existsSync(prefPath)) {
    try {
      const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      if (prefs.vaultName) {
        console.log(`  Found: "${prefs.vaultName}" at ${path.dirname(path.dirname(prefPath))}`);
        foundActive = true;
      }
    } catch (e) {
      // skip parse errors
    }
  }
}

if (!foundActive) {
  console.log('  (Vault name detection skipped - insufficient info)');
}

console.log('\nRecommendation:');
const latest = results.find((r) => r.hasLatestMarker);
const stale = results.find((r) => r.hasStaleMarker);

if (latest && stale && latest.path !== stale.path) {
  console.log(`\n  ✗ Two copies found with different build versions:`);
  console.log(`    Stale:  ${stale.path}`);
  console.log(`    Latest: ${latest.path}`);
  console.log(`\n  Action: Copy latest build to active vault folder:`);
  console.log(`    cp projects/brain-console-obsidian/release/* ${stale.path}/`);
} else if (latest) {
  console.log(`\n  ✓ Latest build found: ${latest.path}`);
  console.log(`  Action: Reload Obsidian plugin (Cmd-Shift-P, "Reload app without saving")`);
} else if (stale) {
  console.log(`\n  ✗ Only stale build found: ${stale.path}`);
  console.log(`  Action: Update the plugin by copying release/ files:`);
  console.log(`    npm run --prefix projects/brain-console-obsidian build`);
  console.log(`    npm run --prefix projects/brain-console-obsidian package`);
  console.log(`    cp projects/brain-console-obsidian/release/* ${stale.path}/`);
} else {
  console.log(`\n  ? No recognizable markers found.`);
  console.log(`  Check ${candidates} manually.`);
}

console.log('\nTo see this diagnostic again, run:');
console.log('  npm run --prefix projects/brain-console-obsidian diagnose:obsidian-install');
