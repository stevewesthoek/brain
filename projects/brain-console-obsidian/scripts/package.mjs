import { mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const distDir = new URL('../dist/', import.meta.url);
const releaseDir = new URL('../release/', import.meta.url);

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

for (const file of ['manifest.json', 'README.md', 'styles.css']) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(`../release/${file}`, import.meta.url));
}

const distFiles = await readdir(distDir);
for (const file of distFiles) {
  if (file.endsWith('.js')) {
    await copyFile(new URL(`../dist/${file}`, import.meta.url), new URL(`../release/${file}`, import.meta.url));
  }
}

console.log(`Brain Console package staged at ${path.relative(process.cwd(), new URL('../release/', import.meta.url).pathname)}`);
