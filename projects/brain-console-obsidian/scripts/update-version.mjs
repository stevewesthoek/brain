#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const version = process.argv[2];

if (!version || !version.match(/^v?\d+\.\d+$/)) {
  console.error('Usage: node scripts/update-version.mjs v2.18');
  console.error('Version format: v<major>.<minor>');
  process.exit(1);
}

// Normalize to v-prefix
const versionWithPrefix = version.startsWith('v') ? version : `v${version}`;
const versionWithoutPrefix = versionWithPrefix.slice(1);

console.log(`Updating version to ${versionWithPrefix}...`);

// 1. Update src/main.ts
const mainTsPath = './src/main.ts';
let mainTs = readFileSync(mainTsPath, 'utf8');
mainTs = mainTs.replace(
  /export const BRAIN_CONSOLE_BUILD_ID = 'v[\d.]+';/,
  `export const BRAIN_CONSOLE_BUILD_ID = '${versionWithPrefix}';`
);
writeFileSync(mainTsPath, mainTs);
console.log('✓ Updated src/main.ts');

// 2. Update scripts/package.mjs
const packageMjsPath = './scripts/package.mjs';
let packageMjs = readFileSync(packageMjsPath, 'utf8');
packageMjs = packageMjs.replace(
  /const currentMarker = 'v[\d.]+';/,
  `const currentMarker = '${versionWithPrefix}';`
);
writeFileSync(packageMjsPath, packageMjs);
console.log('✓ Updated scripts/package.mjs');

// 3. Update scripts/install-active-vault.mjs
const installMjsPath = './scripts/install-active-vault.mjs';
let installMjs = readFileSync(installMjsPath, 'utf8');
installMjs = installMjs.replace(
  /const expectedMarker = 'v[\d.]+';/,
  `const expectedMarker = '${versionWithPrefix}';`
);
writeFileSync(installMjsPath, installMjs);
console.log('✓ Updated scripts/install-active-vault.mjs');

// 4. Update manifest.json
const manifestPath = './manifest.json';
let manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = versionWithoutPrefix;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✓ Updated manifest.json');

console.log(`\n✓ Version updated to ${versionWithPrefix}`);
console.log('\nNext steps:');
console.log('  1. npm run build');
console.log('  2. npm run package');
console.log('  3. npm run install:active-vault');
console.log('  4. Restart Obsidian');
