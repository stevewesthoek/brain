import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'src/main.js',
  'src/styles.css',
  'README.md',
  'scripts/dev-server.mjs',
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const html = await readFile('index.html', 'utf8');
const js = await readFile('src/main.js', 'utf8');
const css = await readFile('src/styles.css', 'utf8');
const server = await readFile('scripts/dev-server.mjs', 'utf8');

const checks = [
  ['HTML loads src/main.js', html.includes('/src/main.js')],
  ['HTML links stylesheet', html.includes('/src/styles.css')],
  ['JS does not import CSS as a module', !js.includes("import './styles.css'")],
  ['AWS Video title present', js.includes('AWS Video Pipeline')],
  ['Uses same-origin API by default', js.includes("window.BRAIN_CORE_URL || ''")],
  ['Recent jobs endpoint present', js.includes('/api/video-orchestrator/jobs/recent')],
  ['Create prompt endpoint present', js.includes('/api/video-orchestrator/jobs/create-from-prompt')],
  ['Approve endpoint present', js.includes('/approve')],
  ['Generate endpoint present', js.includes('/generate')],
  ['Generate timeout is long enough for AWS workflow start', js.includes('GENERATE_TIMEOUT_MS = 120000')],
  ['Publish action intentionally absent', !js.includes('publish-job') && !js.includes('Publish to YouTube')],
  ['Styles present', css.includes('.modalBackdrop') && css.includes('.job.selected')],
  ['Left navigation layout present', js.includes('MENU_ITEMS') && css.includes('.sidebar') && css.includes('.mainPane')],
  ['Jobs-derived status fallback present', js.includes('Pipeline status unavailable; using jobs-derived summary')],
  ['Server root points at web project, not projects parent', server.includes("const rootDir = fileURLToPath(new URL('..', import.meta.url));")],
  ['Server proxies API to Brain Core', server.includes("path.startsWith('api/')") && server.includes('Proxying /api/*')],
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
