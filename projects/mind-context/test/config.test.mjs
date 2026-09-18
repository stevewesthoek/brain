import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CONFIG_SCHEMA_VERSION,
  ensureConfiguredDirectory,
  readLocalConfig,
  resolveLocalPaths,
  writeLocalConfig,
} from '../src/config/local-config.mjs';

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-config-'));
  return {home, configPath: path.join(home, 'Library', 'Application Support', 'Evermind', 'config.json')};
}

test('persisted local config is versioned, atomic, and readable', () => {
  const {home, configPath} = fixture();
  const saved = writeLocalConfig({home, configPath, rootPath: path.join(home, 'Documents', 'Evermind'), dropFolder: path.join(home, 'Downloads', 'Evermind')});
  assert.equal(saved.schemaVersion, CONFIG_SCHEMA_VERSION);
  assert.equal(readLocalConfig({home, configPath}).dropFolder, path.join(home, 'Downloads', 'Evermind'));
  assert.equal(fs.statSync(configPath).mode & 0o077, 0);
  assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).schemaVersion, CONFIG_SCHEMA_VERSION);
});

test('configuration precedence is CLI, environment, persisted, then no Drop value', () => {
  const {home, configPath} = fixture();
  const persisted = {path: configPath, rootPath: '/persisted/root', dropFolder: '/persisted/drop'};
  const environment = {EVERMIND_ROOT: '/environment/root', EVERMIND_DROP_FOLDER: '/environment/drop'};
  assert.deepEqual(resolveLocalPaths({home, config: persisted, env: environment, root: '/cli/root', dropFolder: '/cli/drop'}), {
    root: '/cli/root', dropFolder: '/cli/drop', rootSource: 'cli', dropFolderSource: 'cli', configPath,
  });
  assert.deepEqual(resolveLocalPaths({home, config: persisted, env: environment}), {
    root: '/environment/root', dropFolder: '/environment/drop', rootSource: 'environment', dropFolderSource: 'environment', configPath,
  });
  assert.deepEqual(resolveLocalPaths({home, config: persisted, env: {}}), {
    root: '/persisted/root', dropFolder: '/persisted/drop', rootSource: 'persisted', dropFolderSource: 'persisted', configPath,
  });
  const noDrop = resolveLocalPaths({home, config: {path: configPath, rootPath: null, dropFolder: null}, env: {}});
  assert.equal(noDrop.dropFolder, null);
  assert.equal(noDrop.root, path.join(home, 'Documents', 'Evermind'));
});

test('malformed and symlinked config files fail safely', () => {
  const {home, configPath} = fixture();
  fs.mkdirSync(path.dirname(configPath), {recursive: true});
  fs.writeFileSync(configPath, '{not-json');
  assert.throws(() => readLocalConfig({home, configPath}), /invalid_local_config/);
  fs.unlinkSync(configPath);
  const target = path.join(path.dirname(configPath), 'real-config.json');
  fs.writeFileSync(target, JSON.stringify({schemaVersion: 1, rootPath: '/safe/root', dropFolder: '/safe/drop'}));
  fs.symlinkSync(target, configPath);
  assert.throws(() => readLocalConfig({home, configPath}), /unsafe_config_file/);
});

test('configured Drop directory is created once and symlink paths are rejected', () => {
  const {home} = fixture();
  const drop = path.join(home, 'Downloads', 'Evermind');
  const first = ensureConfiguredDirectory(drop);
  assert.deepEqual(first, {path: fs.realpathSync(drop), created: true});
  assert.deepEqual(ensureConfiguredDirectory(drop), {path: first.path, created: false});
  const target = path.join(home, 'real-drop');
  fs.mkdirSync(target);
  const link = path.join(home, 'linked-drop');
  fs.symlinkSync(target, link, 'dir');
  assert.throws(() => ensureConfiguredDirectory(link), /unsafe_configured_directory/);
});

test('default root is relative to the active home and never Steve-specific', () => {
  const {home, configPath} = fixture();
  const resolved = resolveLocalPaths({home, config: {path: configPath, rootPath: null, dropFolder: null}, env: {}});
  assert.equal(resolved.root, path.join(home, 'Documents', 'Evermind'));
  assert.ok(resolved.root.startsWith(`${home}${path.sep}`));
});
