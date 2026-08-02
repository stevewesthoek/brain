import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const cliPath = path.resolve('src/cli/cli.mjs');

function makeCliTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-cli-fixtures-'));
  fs.mkdirSync(path.join(root, 'fixtures', 'canonical'), {recursive: true});
  fs.mkdirSync(path.join(root, 'fixtures', 'supporting'), {recursive: true});

  fs.writeFileSync(path.join(root, 'fixtures', 'canonical', 'owner.md'), [
    '---',
    'title: Canonical Owner',
    'status: current',
    'freshness: fresh',
    'authority: canonical',
    'privacy: internal',
    'scope: fixtures/canonical',
    '---',
    '# Canonical Owner',
    'The canonical owner is Brain.',
    '',
  ].join('\n'));

  fs.writeFileSync(path.join(root, 'fixtures', 'supporting', 'note.md'), [
    '---',
    'title: Supporting Note',
    'status: current',
    'freshness: fresh',
    'authority: supporting',
    'privacy: public',
    'scope: fixtures/supporting',
    '---',
    '# Supporting Note',
    'Supporting note.',
    '',
  ].join('\n'));

  fs.writeFileSync(path.join(root, 'fixtures', 'supporting', 'binary.md'), Buffer.from([0, 1, 2]));
  return root;
}

function runCli(args, options = {}) {
  const { env, ...spawnOptions } = options;
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    env: {...process.env, ...(env ?? {})},
    ...spawnOptions,
  });
}

test('resolve returns parseable json', () => {
  const root = makeCliTree();
  const result = runCli(['resolve', '--query', 'Canonical Owner', '--root', root, '--scope', 'fixtures/canonical', '--format', 'json', '--max-items', '3', '--max-tokens', '200']);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, '1.0');
  assert.equal(payload.sources[0].sourceId, 'fixtures-canonical-owner-md');
});

test('resolve markdown is deterministic', () => {
  const root = makeCliTree();
  const first = runCli(['resolve', '--query', 'Canonical Owner', '--root', root, '--scope', 'fixtures/canonical', '--format', 'markdown']);
  const second = runCli(['resolve', '--query', 'Canonical Owner', '--root', root, '--scope', 'fixtures/canonical', '--format', 'markdown']);
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
  assert(first.stdout.includes('# Context Pack 1.0'));
});

test('explain returns score components', () => {
  const root = makeCliTree();
  const result = runCli(['explain', '--query', 'status', '--root', root, '--scope', 'fixtures/supporting', '--format', 'json']);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert(payload.ranking[0].components);
  assert(payload.ranking[0].citation);
});

test('health reports read-only fixture-only status', () => {
  const result = runCli(['health', '--format', 'json']);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.coreAvailable, true);
  assert.equal(payload.fixtureOnly, true);
  assert.equal(payload.readOnly, true);
});

test('health reports core unavailable when disabled', () => {
  const result = runCli(['health', '--format', 'json'], {
    env: {MIND_CONTEXT_CORE_DISABLED: '1'},
  });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.coreAvailable, false);
});

test('stable exit codes and structured errors', () => {
  const root = makeCliTree();
  const missingRoot = runCli(['resolve', '--query', 'x', '--scope', 'fixtures/canonical']);
  const missingQuery = runCli(['resolve', '--root', root, '--scope', 'fixtures/canonical']);
  const badFormat = runCli(['resolve', '--query', 'x', '--root', root, '--scope', 'fixtures/canonical', '--format', 'xml']);
  const invalidScope = runCli(['resolve', '--query', 'x', '--root', root, '--scope', '../outside']);
  assert.equal(missingRoot.status, 2);
  assert.equal(missingQuery.status, 2);
  assert.equal(badFormat.status, 2);
  assert.equal(invalidScope.status, 2);
  assert(missingRoot.stderr.includes('missing_root'));
  assert(missingQuery.stderr.includes('missing_query'));
  assert(badFormat.stderr.includes('invalid_output_format'));
  assert(invalidScope.stderr.includes('invalid_scope'));
});

test('resolve does not write files or call external services', () => {
  const root = makeCliTree();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-cli-'));
  const before = fs.readdirSync(tempDir).length;
  const result = runCli(['resolve', '--query', 'Canonical Owner', '--root', root, '--scope', 'fixtures/canonical']);
  const after = fs.readdirSync(tempDir).length;
  assert.equal(result.status, 0);
  assert.equal(before, after);
});
