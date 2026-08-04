import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSources} from '../src/core/discover.mjs';

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-discover-'));
  fs.mkdirSync(path.join(root, 'allowed', 'canonical'), {recursive: true});
  fs.mkdirSync(path.join(root, 'allowed', 'archive'), {recursive: true});
  fs.mkdirSync(path.join(root, 'allowed', 'runtime'), {recursive: true});
  fs.mkdirSync(path.join(root, 'allowed', 'binary'), {recursive: true});
  fs.mkdirSync(path.join(root, 'allowed', 'link-target'), {recursive: true});
  fs.writeFileSync(path.join(root, 'allowed', 'canonical', 'one.md'), '---\ntitle: First\nfreshness: fresh\nauthority: canonical\nprivacy: internal\n---\n# One\nSee [ref](../canonical/two.md)\n');
  fs.writeFileSync(path.join(root, 'allowed', 'canonical', 'two.md'), '# Two\n');
  fs.writeFileSync(path.join(root, 'allowed', 'archive', 'old.md'), '# Old\n');
  fs.writeFileSync(path.join(root, 'allowed', 'runtime', 'cache.md'), '# Cache\n');
  fs.writeFileSync(path.join(root, 'allowed', 'binary', 'blob.md'), Buffer.from([0, 1, 2, 3]));
  fs.writeFileSync(path.join(root, 'allowed', '.env.secret.md'), '# Secret\n');
  return root;
}

test('allowed scope included and ordered', () => {
  const root = makeTree();
  const sources = discoverSources({root, scopes: ['allowed/canonical']});
  assert.equal(sources.length, 2);
  assert.deepEqual(sources.map((source) => source.path), ['allowed/canonical/one.md', 'allowed/canonical/two.md']);
  assert(sources.every((source) => source.authorizedScope === 'allowed/canonical'));
  assert(sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
});

test('parent scope is projected as the authorized scope for nested sources', () => {
  const root = makeTree();
  const [source] = discoverSources({root, scopes: ['allowed']});
  assert.equal(source.authorizedScope, 'allowed');
});

test('forbidden scope excluded', () => {
  const root = makeTree();
  const sources = discoverSources({root, scopes: ['allowed'], forbiddenScopes: ['allowed/archive']});
  assert.equal(sources.some((source) => source.path.includes('archive')), false);
});

test('markdown included and binary excluded', () => {
  const root = makeTree();
  const sources = discoverSources({root, scopes: ['allowed']});
  assert(sources.some((source) => source.path === 'allowed/canonical/one.md'));
  assert.equal(sources.some((source) => source.path === 'allowed/binary/blob.md'), false);
});

test('archive history runtime and secret paths excluded', () => {
  const root = makeTree();
  const sources = discoverSources({root, scopes: ['allowed']});
  assert.equal(sources.some((source) => source.path.includes('archive')), false);
  assert.equal(sources.some((source) => source.path.includes('runtime')), false);
  assert.equal(sources.some((source) => source.path.includes('.env.secret.md')), false);
});

test('symlink escape rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-symlink-'));
  const outside = path.join(os.tmpdir(), 'mind-context-outside.md');
  fs.writeFileSync(outside, '# Outside\n');
  fs.mkdirSync(path.join(root, 'allowed', 'escape'), {recursive: true});
  fs.symlinkSync(outside, path.join(root, 'allowed', 'escape.md'));
  assert.throws(() => discoverSources({root, scopes: ['allowed']}), /symlink_escape/);
});

test('missing root returns empty list', () => {
  assert.deepEqual(discoverSources({root: path.join(os.tmpdir(), 'missing-root'), scopes: ['allowed']}), []);
});
