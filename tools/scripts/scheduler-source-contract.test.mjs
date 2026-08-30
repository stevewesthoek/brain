import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const registryPath = path.join(root, 'operations/specs/typed-scheduler-jobs.json');
const plistPath = path.join(root, 'operations/system-configs/launchagents/com.office.nightly-scheduler.plist');

test('canonical registry and LaunchAgent agree on launch identity', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')).scheduler;
  const plist = fs.readFileSync(plistPath, 'utf8');
  const wrapper = fs.readFileSync(path.join(root, 'tools/scripts/mind-steward-dry-run-report.sh'), 'utf8');
  const strings = [...plist.matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)].reduce((out, [, key, value]) => ({ ...out, [key]: value }), {});
  const booleans = [...plist.matchAll(/<key>([^<]+)<\/key>\s*<(true|false)\s*\/>/g)].reduce((out, [, key, value]) => ({ ...out, [key]: value === 'true' }), {});
  assert.equal(registry.launchAgentLabel, 'com.office.nightly-scheduler');
  assert.equal(strings.Label, registry.launchAgentLabel);
  assert.equal(registry.runAtLoad, false);
  assert.equal(booleans.RunAtLoad, registry.runAtLoad);
  assert.equal(registry.hour, 3);
  assert.equal(registry.minute, 0);
  assert.match(plist, /<key>Hour<\/key>\s*<integer>3<\/integer>/);
  assert.match(plist, /<key>Minute<\/key>\s*<integer>0<\/integer>/);
  assert.match(plist, /<string>\/Users\/Office\/Repos\/stevewesthoek\/brain-runtime\/tools\/scripts\/brain-scheduler-runner\.mjs<\/string>/);
  assert.doesNotMatch(wrapper, /npx\s+--yes/);
  assert.match(wrapper, /node_modules\/\.bin\/tsx/);
  assert.equal(registry.bootstrap, registry.runner);
  assert.equal(registry.runner, 'tools/scripts/brain-scheduler-runner.mjs');
});
