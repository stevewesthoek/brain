import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'src/main.js',
  'src/styles.css',
  'README.md',
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const html = await readFile('index.html', 'utf8');
const js = await readFile('src/main.js', 'utf8');
const css = await readFile('src/styles.css', 'utf8');

const checks = [
  ['HTML loads src/main.js', html.includes('/src/main.js')],
  ['AWS Video title present', js.includes('AWS Video Pipeline')],
  ['Brain Core URL default present', js.includes('http://localhost:4877')],
  ['Recent jobs endpoint present', js.includes('/api/video-orchestrator/jobs/recent')],
  ['Create prompt endpoint present', js.includes('/api/video-orchestrator/jobs/create-from-prompt')],
  ['Approve endpoint present', js.includes('/approve')],
  ['Generate endpoint present', js.includes('/generate')],
  ['Publish action intentionally absent', !js.includes('publish-job') && !js.includes('Publish to YouTube')],
  ['Styles present', css.includes('.modalBackdrop') && css.includes('.job.selected')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Brain Console Web validation passed.');
}
