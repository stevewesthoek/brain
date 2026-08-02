import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const STEWARD_ROOT = path.resolve(TEST_DIR, '..', '..');
const CLI_PATH = path.join(STEWARD_ROOT, 'src/cli/classify-captures.ts');
const TSX_PATH = path.join(STEWARD_ROOT, 'node_modules/.bin/tsx');

function runCli(args: string[]): void {
  execFileSync(TSX_PATH, [CLI_PATH, ...args], {
    env: { PATH: process.env.PATH ?? '' },
    stdio: 'pipe',
  });
}

test('classification CLI defaults to dry-run and legacy false cannot opt into apply', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-cli-'));
  const mindRoot = path.join(root, 'mind');
  const outputJson = path.join(root, 'reports', 'result.json');
  const outputMd = path.join(root, 'reports', 'result.md');
  fs.mkdirSync(path.join(mindRoot, 'inbox/new'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  runCli(['--mind-root', mindRoot, '--output-json', outputJson, '--output-md', outputMd]);
  let report = JSON.parse(fs.readFileSync(outputJson, 'utf8')) as {
    mode: string;
    writesToMind: boolean;
    executableActions: boolean;
    processed?: number;
  };
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.writesToMind, false);
  assert.equal(report.executableActions, false);

  runCli([
    '--mind-root', mindRoot,
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--dry-run=false',
  ]);
  report = JSON.parse(fs.readFileSync(outputJson, 'utf8')) as typeof report;
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.writesToMind, false);

  runCli([
    '--mind-root', mindRoot,
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--mode=dry-run',
  ]);
  report = JSON.parse(fs.readFileSync(outputJson, 'utf8')) as typeof report;
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.writesToMind, false);

  runCli([
    '--mind-root', mindRoot,
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--limit=1',
  ]);
  report = JSON.parse(fs.readFileSync(outputJson, 'utf8')) as typeof report;
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.writesToMind, false);
  assert.equal(report.executableActions, false);
  assert.equal(report.processed, 0);

  assert.throws(() => runCli([
    '--mind-root', mindRoot,
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--limit=bogus',
  ]), /Command failed/);

  assert.throws(() => runCli([
    '--mind-root', mindRoot,
    '--output-json', outputJson,
    '--output-md', outputMd,
    '--mode=apply',
  ]), /Command failed/);
});

test('classification CLI rejects conflicting execution forms before work begins', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-cli-'));
  const mindRoot = path.join(root, 'mind');
  fs.mkdirSync(path.join(mindRoot, 'inbox/new'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => runCli(['--mind-root', mindRoot, '--mode=apply', '--dry-run=true']),
    /Command failed/,
  );
  assert.throws(
    () => runCli(['--mind-root', mindRoot, '--mode=unsafe']),
    /Command failed/,
  );
});
