import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const main = await readFile(new URL('./main.js', import.meta.url), 'utf8');
const spec = await readFile(new URL('../../operations/specs/brain-console-obsidian-plugin.md', import.meta.url), 'utf8');
const contract = 'brain-console-obsidian-widget-contract-v1';
const widgetIds = [
  'brain-status',
  'brain-sessions',
  'brain-repos',
  'brain-orchestrators',
  'brain-capabilities',
  'brain-scheduler',
  'brain-local-apps',
  'brain-video',
  'brain-approvals',
  'brain-runtime-reports',
];

test('source plugin and contract spec carry the same versioned widget contract', () => {
  assert.match(main, new RegExp(contract));
  assert.match(spec, new RegExp(contract));
  for (const id of widgetIds) {
    assert.match(main, new RegExp(`'${id}'`));
    assert.match(spec, new RegExp(`^${id}$`, 'm'));
  }
});
