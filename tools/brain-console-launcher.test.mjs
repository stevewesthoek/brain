import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(repoRoot, 'tools', 'brain-console-launcher.mjs');
const installer = path.join(repoRoot, 'tools', 'scripts', 'install-brain-console-app.mjs');

test('launcher dry-run exposes only bounded canonical paths', () => {
  const output = execFileSync(process.execPath, [launcher, '--dry-run'], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.equal(result.consoleUrl, 'http://localhost:4881/monitoring');
  assert.match(result.coreEntry, /projects\/brain-core\/dist\/index\.js$/);
  assert.doesNotMatch(output, /NEW_RELIC|NRAK|eu01x/i);
});

test('app installer dry-run targets the owned user Applications location', () => {
  const output = execFileSync(process.execPath, [installer, '--dry-run'], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert.match(result.appPath, /\/Applications\/Brain Console\.app$/);
  assert.equal(result.action, 'install-or-update-owned-app');
});
