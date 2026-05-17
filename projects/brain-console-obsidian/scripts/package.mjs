import { mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

const distDir = new URL('../dist/', import.meta.url);
const releaseDir = new URL('../release/', import.meta.url);

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

// Copy only the bundled main.js (not individual modules)
try {
  await copyFile(new URL('../dist/main.js', import.meta.url), new URL('../release/main.js', import.meta.url));
} catch (err) {
  console.error('Error: dist/main.js not found. Did build succeed?');
  process.exit(1);
}

console.log(`✓ Brain Console package staged at ${path.relative(process.cwd(), new URL('../release/', import.meta.url).pathname)}`);
