import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveMindInboxSyncMode, syncMindInbox } from './mind-steward-sync-inbox.mjs';

const SYNC_CLI = path.join(path.dirname(new URL(import.meta.url).pathname), 'mind-steward-sync-inbox.mjs');

function runSyncCli(args) {
  return execFileSync(process.execPath, [SYNC_CLI, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' },
  });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-sync-'));
  const sourceRoot = path.join(root, 'source');
  const mindRoot = path.join(root, 'mind');
  fs.mkdirSync(path.join(sourceRoot, 'inbox/new'), { recursive: true });
  fs.mkdirSync(path.join(mindRoot, 'inbox/new'), { recursive: true });
  return { root, sourceRoot, mindRoot };
}

test('copies only missing inbox/new markdown files in exact apply mode', (t) => {
  const { root, sourceRoot, mindRoot } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/new.md'), 'new');
  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/existing.md'), 'remote');
  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/README.md'), 'ignored');
  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/ignored.txt'), 'ignored');
  fs.writeFileSync(path.join(mindRoot, 'inbox/new/existing.md'), 'local');

  const result = syncMindInbox({ sourceRoot, mindRoot, mode: 'apply' });

  assert.equal(result.mode, 'apply');
  assert.deepEqual(result.copied, [path.join('inbox', 'new', 'new.md')]);
  assert.deepEqual(result.skipped, [path.join('inbox', 'new', 'existing.md')]);
  assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/new.md'), 'utf8'), 'new');
  assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/existing.md'), 'utf8'), 'local');
  assert.equal(fs.existsSync(path.join(mindRoot, 'capture/inbox/new.md')), false);
});

test('omitted write intent defaults to a dry run without creating a Mind directory', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-sync-'));
  const sourceRoot = path.join(root, 'source');
  const mindRoot = path.join(root, 'mind');
  fs.mkdirSync(path.join(sourceRoot, 'inbox/new'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/dry.md'), 'dry');

  const result = syncMindInbox({ sourceRoot, mindRoot });

  assert.equal(result.mode, 'dry-run');
  assert.deepEqual(result.copied, [path.join('inbox', 'new', 'dry.md')]);
  assert.equal(fs.existsSync(mindRoot), false);
});

test('legacy dry-run false cannot enable a sync, and conflicts fail closed', () => {
  assert.equal(resolveMindInboxSyncMode({ dryRun: false }), 'dry-run');
  assert.throws(
    () => resolveMindInboxSyncMode({ mode: 'apply', dryRun: true }),
    /conflict/,
  );
  assert.throws(
    () => resolveMindInboxSyncMode({ mode: 'unsafe' }),
    /exactly/,
  );
});

test('sync CLI defaults to dry-run and only exact apply creates the fixture target', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-sync-cli-'));
  const sourceRoot = path.join(root, 'source');
  const mindRoot = path.join(root, 'mind');
  fs.mkdirSync(path.join(sourceRoot, 'inbox/new'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'inbox/new/fixture.md'), 'fixture');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const dryRun = JSON.parse(runSyncCli(['--source-root', sourceRoot, '--mind-root', mindRoot]));
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(fs.existsSync(mindRoot), false);

  const apply = JSON.parse(runSyncCli([
    '--source-root', sourceRoot,
    '--mind-root', mindRoot,
    '--mode=apply',
  ]));
  assert.equal(apply.mode, 'apply');
  assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/fixture.md'), 'utf8'), 'fixture');

  assert.throws(
    () => runSyncCli([
      '--source-root', sourceRoot,
      '--mind-root', mindRoot,
      '--mode=apply',
      '--dry-run=true',
    ]),
    /Command failed/,
  );
  assert.throws(
    () => runSyncCli(['--source-root', sourceRoot, '--mind-root', mindRoot, '--mode=unsafe']),
    /Command failed/,
  );
});
