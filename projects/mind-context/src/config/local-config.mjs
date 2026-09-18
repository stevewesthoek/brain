import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_SCHEMA_VERSION = 1;
const MAX_CONFIG_BYTES = 64 * 1024;

function applicationSupportRoot({home = os.homedir(), platform = process.platform} = {}) {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Evermind');
  if (platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? home, 'Evermind');
  return path.join(process.env.XDG_STATE_HOME ?? path.join(home, '.local', 'state'), 'evermind');
}

function defaultConfigPath(options = {}) {
  return path.join(applicationSupportRoot(options), 'config.json');
}

function normalizeConfiguredPath(value, code = 'invalid_config_path') {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(code);
  const resolved = path.resolve(value.trim());
  if (resolved === path.parse(resolved).root) throw new Error(code);
  return resolved;
}

function ensureDirectory(directory) {
  const absolute = path.resolve(directory);
  fs.mkdirSync(absolute, {recursive: true, mode: 0o700});
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_config_directory');
  const real = fs.realpathSync(absolute);
  try { fs.chmodSync(real, 0o700); } catch {}
  return real;
}

function readConfigFile(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error('config_unavailable');
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_config_file');
  if (stat.size > MAX_CONFIG_BYTES) throw new Error('config_too_large');
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('invalid_local_config'); }
  if (!parsed || parsed.schemaVersion !== CONFIG_SCHEMA_VERSION || Array.isArray(parsed)) throw new Error('unsupported_local_config_version');
  const rootPath = parsed.rootPath === undefined || parsed.rootPath === null ? null : normalizeConfiguredPath(parsed.rootPath, 'invalid_config_root');
  const dropFolder = parsed.dropFolder === undefined || parsed.dropFolder === null ? null : normalizeConfiguredPath(parsed.dropFolder, 'invalid_config_drop_folder');
  if (!rootPath && !dropFolder) throw new Error('empty_local_config');
  return {schemaVersion: CONFIG_SCHEMA_VERSION, rootPath, dropFolder};
}

export function readLocalConfig({home = os.homedir(), platform = process.platform, configPath = defaultConfigPath({home, platform})} = {}) {
  const file = path.resolve(configPath);
  const config = readConfigFile(file);
  return {
    path: file,
    exists: config !== null,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    rootPath: config?.rootPath ?? null,
    dropFolder: config?.dropFolder ?? null,
  };
}

function writeAtomicJson(file, value) {
  const parent = ensureDirectory(path.dirname(file));
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) throw new Error('config_too_large');
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('unsafe_config_file');
  }
  const temporary = path.join(parent, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, serialized, {encoding: 'utf8', flag: 'wx', mode: 0o600});
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

export function writeLocalConfig({rootPath, dropFolder, home = os.homedir(), platform = process.platform, configPath = defaultConfigPath({home, platform})} = {}) {
  const current = readLocalConfig({home, platform, configPath});
  const root = rootPath === undefined ? current.rootPath : rootPath === null ? null : normalizeConfiguredPath(rootPath, 'invalid_config_root');
  const drop = dropFolder === undefined ? current.dropFolder : dropFolder === null ? null : normalizeConfiguredPath(dropFolder, 'invalid_config_drop_folder');
  if (!root && !drop) throw new Error('empty_local_config');
  const value = {schemaVersion: CONFIG_SCHEMA_VERSION, rootPath: root, dropFolder: drop};
  writeAtomicJson(path.resolve(configPath), value);
  return {...value, path: path.resolve(configPath)};
}

function environmentValue(env, name) {
  return typeof env?.[name] === 'string' && env[name].trim() ? env[name].trim() : null;
}

export function resolveLocalPaths({root, dropFolder, home = os.homedir(), platform = process.platform, env = process.env, config = readLocalConfig({home, platform})} = {}) {
  const explicitRoot = root === undefined || root === null ? null : normalizeConfiguredPath(root, 'invalid_config_root');
  const environmentRoot = environmentValue(env, 'EVERMIND_ROOT') ?? environmentValue(env, 'MIND_CONTEXT_ROOT');
  const explicitDrop = dropFolder === undefined || dropFolder === null ? null : normalizeConfiguredPath(dropFolder, 'invalid_config_drop_folder');
  const environmentDrop = environmentValue(env, 'EVERMIND_DROP_FOLDER');
  const resolvedRoot = explicitRoot ?? (environmentRoot ? normalizeConfiguredPath(environmentRoot, 'invalid_config_root') : config.rootPath) ?? path.resolve(home, 'Documents', 'Evermind');
  const resolvedDrop = explicitDrop ?? (environmentDrop ? normalizeConfiguredPath(environmentDrop, 'invalid_config_drop_folder') : config.dropFolder);
  return {
    root: resolvedRoot,
    dropFolder: resolvedDrop,
    rootSource: explicitRoot ? 'cli' : environmentRoot ? 'environment' : config.rootPath ? 'persisted' : 'default',
    dropFolderSource: explicitDrop ? 'cli' : environmentDrop ? 'environment' : config.dropFolder ? 'persisted' : null,
    configPath: config.path,
  };
}

export function ensureConfiguredDirectory(directory) {
  const resolved = normalizeConfiguredPath(directory, 'invalid_config_path');
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe_configured_directory');
    return {path: fs.realpathSync(resolved), created: false};
  }
  fs.mkdirSync(resolved, {recursive: true, mode: 0o700});
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe_configured_directory');
  return {path: fs.realpathSync(resolved), created: true};
}

export {CONFIG_SCHEMA_VERSION, MAX_CONFIG_BYTES, applicationSupportRoot, defaultConfigPath};
