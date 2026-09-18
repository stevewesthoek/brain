import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readLocalConfig, resolveLocalPaths} from '../config/local-config.mjs';
import {defaultStoreRoot} from './request-store.mjs';

const HELPER_BUNDLE_ID = 'tools.prochat.evermind.notification-helper';
const HELPER_EXECUTABLE = 'EvermindNotificationHelper';
const HELPER_BUNDLE_NAME = 'EvermindNotificationHelper.app';
const COMPANION_BUNDLE_ID = 'tools.prochat.evermind';
const COMPANION_EXECUTABLE = 'Evermind';
const COMPANION_BUNDLE_NAME = 'Evermind.app';
const LSREGISTER_PATH = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
const LAUNCH_AGENT_LABEL = 'tools.prochat.evermind.notification-drain';
const MAX_STATUS_EVENTS = 10_000;
const RUNTIME_FILES = [
  ['capture/capture.mjs', 'capture/capture.mjs'],
  ['config/local-config.mjs', 'config/local-config.mjs'],
  ['notifications/action-cli.mjs', 'notifications/action-cli.mjs'],
  ['notifications/action-router.mjs', 'notifications/action-router.mjs'],
  ['notifications/request-store.mjs', 'notifications/request-store.mjs'],
  ['review/decision-request.mjs', 'review/decision-request.mjs'],
  ['review/review.mjs', 'review/review.mjs'],
];

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function isDarwin(platform = process.platform) {
  return platform === 'darwin';
}

function applicationSupportRoot({home = os.homedir()} = {}) {
  return path.join(home, 'Library', 'Application Support', 'Evermind');
}

function helperInstallDirectory({appSupportRoot = applicationSupportRoot()} = {}) {
  return path.join(appSupportRoot, 'helpers');
}

function installedHelperPath(options = {}) {
  return path.join(helperInstallDirectory(options), HELPER_BUNDLE_NAME);
}

function runtimeInstallDirectory({appSupportRoot = applicationSupportRoot()} = {}) {
  return path.join(appSupportRoot, 'runtime');
}

function runtimeActionPath({appSupportRoot = applicationSupportRoot()} = {}) {
  return path.join(runtimeInstallDirectory({appSupportRoot}), 'src', 'notifications', 'action-cli.mjs');
}

function companionInstallDirectory({appSupportRoot = applicationSupportRoot()} = {}) {
  return path.join(appSupportRoot, 'app');
}

function installedCompanionPath(options = {}) {
  return path.join(companionInstallDirectory(options), COMPANION_BUNDLE_NAME);
}

function launchAgentsDirectory({home = os.homedir()} = {}) {
  return path.join(home, 'Library', 'LaunchAgents');
}

function launchAgentPath({home = os.homedir()} = {}) {
  return path.join(launchAgentsDirectory({home}), `${LAUNCH_AGENT_LABEL}.plist`);
}

function logDirectory({appSupportRoot = applicationSupportRoot()} = {}) {
  return path.join(appSupportRoot, 'logs');
}

function resolveEvermindRoot(root, {home = os.homedir(), platform = process.platform, env = process.env} = {}) {
  return resolveLocalPaths({root, home, platform, env}).root;
}

function safeDirectory(directory, {create = false, mode = 0o700} = {}) {
  const absolute = path.resolve(directory);
  if (create) fs.mkdirSync(absolute, {recursive: true, mode});
  let stat;
  try { stat = fs.lstatSync(absolute); }
  catch { throw new Error('directory_not_found'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_directory');
  const real = fs.realpathSync(absolute);
  try { fs.chmodSync(real, mode); } catch {}
  return real;
}

function safeRegularFile(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch { return false; }
  return stat.isFile() && !stat.isSymbolicLink();
}

function safeBundlePath(bundlePath, expectedRoot) {
  const absolute = path.resolve(bundlePath);
  let stat;
  try { stat = fs.lstatSync(absolute); }
  catch { return {usable: false, path: absolute, reason: 'missing_helper'}; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return {usable: false, path: absolute, reason: 'unsafe_helper_bundle'};
  const realBundle = fs.realpathSync(absolute);
  if (expectedRoot) {
    let realRoot;
    try { realRoot = fs.realpathSync(path.resolve(expectedRoot)); }
    catch { return {usable: false, path: absolute, reason: 'missing_helper_root'}; }
    const relative = path.relative(realRoot, realBundle);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return {usable: false, path: absolute, reason: 'helper_outside_install_root'};
  }
  const infoPath = path.join(realBundle, 'Contents', 'Info.plist');
  const executablePath = path.join(realBundle, 'Contents', 'MacOS', HELPER_EXECUTABLE);
  if (!safeRegularFile(infoPath) || !safeRegularFile(executablePath)) return {usable: false, path: absolute, reason: 'invalid_helper_structure'};
  let plist;
  try { plist = fs.readFileSync(infoPath, 'utf8'); }
  catch { return {usable: false, path: absolute, reason: 'invalid_helper_plist'}; }
  const bundleId = plist.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
  const executable = plist.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
  if (bundleId !== HELPER_BUNDLE_ID || executable !== HELPER_EXECUTABLE) return {usable: false, path: absolute, reason: 'helper_provenance_mismatch'};
  try {
    if ((fs.statSync(executablePath).mode & 0o111) === 0) return {usable: false, path: absolute, reason: 'helper_not_executable'};
  } catch { return {usable: false, path: absolute, reason: 'helper_not_executable'}; }
  const signature = verifyCodeSignature(realBundle);
  return {usable: true, path: realBundle, bundleId, executable, signature};
}

function safeCompanionPath(bundlePath, expectedRoot) {
  const absolute = path.resolve(bundlePath);
  let stat;
  try { stat = fs.lstatSync(absolute); }
  catch { return {usable: false, path: absolute, reason: 'missing_companion'}; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return {usable: false, path: absolute, reason: 'unsafe_companion_bundle'};
  const realBundle = fs.realpathSync(absolute);
  if (expectedRoot) {
    let realRoot;
    try { realRoot = fs.realpathSync(path.resolve(expectedRoot)); }
    catch { return {usable: false, path: absolute, reason: 'missing_companion_root'}; }
    const relative = path.relative(realRoot, realBundle);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return {usable: false, path: absolute, reason: 'companion_outside_install_root'};
  }
  const infoPath = path.join(realBundle, 'Contents', 'Info.plist');
  const executablePath = path.join(realBundle, 'Contents', 'MacOS', COMPANION_EXECUTABLE);
  if (!safeRegularFile(infoPath) || !safeRegularFile(executablePath)) return {usable: false, path: absolute, reason: 'invalid_companion_structure'};
  let plist;
  try { plist = fs.readFileSync(infoPath, 'utf8'); }
  catch { return {usable: false, path: absolute, reason: 'invalid_companion_plist'}; }
  const bundleId = plist.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
  const executable = plist.match(/<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/)?.[1] ?? null;
  if (bundleId !== COMPANION_BUNDLE_ID || executable !== COMPANION_EXECUTABLE) return {usable: false, path: absolute, reason: 'companion_provenance_mismatch'};
  if (!plist.includes('<key>CFBundleURLSchemes</key>') || !plist.match(/<array>\s*<string>evermind<\/string>\s*<\/array>/)) return {usable: false, path: absolute, reason: 'companion_url_scheme_missing'};
  try {
    if ((fs.statSync(executablePath).mode & 0o111) === 0) return {usable: false, path: absolute, reason: 'companion_not_executable'};
  } catch { return {usable: false, path: absolute, reason: 'companion_not_executable'}; }
  return {usable: true, path: realBundle, bundleId, executable, signature: verifyCodeSignature(realBundle)};
}

function verifyCodeSignature(bundlePath, execute = defaultExecute) {
  const result = execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundlePath]);
  if (!result || result.error || result.status === undefined) return 'unavailable';
  return result.status === 0 ? 'valid' : 'invalid';
}

function defaultExecute(file, args, options = {}) {
  return spawnSync(file, args, {encoding: 'utf8', ...options});
}

function sourceHelperPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'macos', HELPER_BUNDLE_NAME);
}

function sourceCompanionPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'macos', COMPANION_BUNDLE_NAME);
}

function discoverHelper({platform = process.platform, env = process.env, appSupportRoot = applicationSupportRoot(), sourcePath = sourceHelperPath()} = {}) {
  if (!isDarwin(platform)) return {path: null, source: null, reason: 'unsupported_platform', validation: null};
  const override = typeof env.EVERMIND_NOTIFICATION_HELPER === 'string' && env.EVERMIND_NOTIFICATION_HELPER.trim()
    ? env.EVERMIND_NOTIFICATION_HELPER.trim()
    : null;
  if (override) {
    const validation = safeBundlePath(override);
    return validation.usable
      ? {path: validation.path, source: 'environment', reason: null, validation}
      : {path: null, source: 'environment', reason: validation.reason, validation};
  }
  const installRoot = helperInstallDirectory({appSupportRoot});
  const installed = safeBundlePath(installedHelperPath({appSupportRoot}), installRoot);
  if (installed.usable) return {path: installed.path, source: 'installed', reason: null, validation: installed};
  const source = safeBundlePath(sourcePath);
  if (source.usable) return {path: source.path, source: 'source', reason: null, validation: source};
  return {path: null, source: null, reason: installed.reason === 'missing_helper' ? source.reason : installed.reason, validation: {installed, source}};
}

function writeAtomic(file, contents, mode = 0o600) {
  const parent = path.dirname(file);
  safeDirectory(parent, {create: true});
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, contents, {encoding: 'utf8', flag: 'wx', mode});
    fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
    fs.chmodSync(file, mode);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function launchAgentPlist({nodePath = process.execPath, actionCliPath, storeRoot, evermindRoot, logRoot}) {
  const args = [nodePath, actionCliPath, '--drain', '--store-root', storeRoot, '--root', evermindRoot];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    `<key>Label</key><string>${xmlEscape(LAUNCH_AGENT_LABEL)}</string>`,
    `<key>ProgramArguments</key><array>${args.map((value) => `<string>${xmlEscape(value)}</string>`).join('')}</array>`,
    '<key>RunAtLoad</key><true/>',
    '<key>StartInterval</key><integer>30</integer>',
    '<key>ProcessType</key><string>Background</string>',
    '<key>LowPriorityIO</key><true/>',
    `<key>StandardOutPath</key><string>${xmlEscape(path.join(logRoot, 'notification-drain.out.log'))}</string>`,
    `<key>StandardErrorPath</key><string>${xmlEscape(path.join(logRoot, 'notification-drain.err.log'))}</string>`,
    '</dict></plist>',
  ].join('');
}

function launchctlCommand({launchctl = '/bin/launchctl', execute = defaultExecute} = {}, args) {
  return execute(launchctl, args);
}

function launchDomain(uid = typeof process.getuid === 'function' ? process.getuid() : null) {
  if (!uid) throw new Error('missing_user_id');
  return `gui/${uid}`;
}

function launchAgentTarget({uid} = {}) {
  return `${launchDomain(uid)}/${LAUNCH_AGENT_LABEL}`;
}

function unloadLaunchAgent({uid, launchctl, execute} = {}) {
  const result = launchctlCommand({launchctl, execute}, ['bootout', launchAgentTarget({uid})]);
  return {loaded: result?.status === 0, result};
}

function loadLaunchAgent({plistPath, uid, launchctl, execute} = {}) {
  const domain = launchDomain(uid);
  const result = launchctlCommand({launchctl, execute}, ['bootstrap', domain, plistPath]);
  if (result?.error || result?.status !== 0) throw new Error('launchagent_bootstrap_failed');
  return {loaded: true, result};
}

function launchAgentLoaded({uid, launchctl, execute} = {}) {
  const result = launchctlCommand({launchctl, execute}, ['print', launchAgentTarget({uid})]);
  return result?.status === 0;
}

function buildHelper({outputDir, scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'macos', 'build-helper.sh'), execute = defaultExecute} = {}) {
  const result = execute(scriptPath, ['--output', outputDir], {encoding: 'utf8'});
  if (result?.error || result?.status !== 0) throw new Error('helper_build_failed');
  const bundlePath = path.join(outputDir, HELPER_BUNDLE_NAME);
  const validation = safeBundlePath(bundlePath);
  if (!validation.usable) throw new Error(`helper_build_invalid:${validation.reason}`);
  return validation.path;
}

function buildCompanion({outputDir, scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'macos', 'build-companion.sh'), execute = defaultExecute} = {}) {
  const result = execute(scriptPath, ['--output', outputDir], {encoding: 'utf8'});
  if (result?.error || result?.status !== 0) throw new Error('companion_build_failed');
  const bundlePath = path.join(outputDir, COMPANION_BUNDLE_NAME);
  const validation = safeCompanionPath(bundlePath);
  if (!validation.usable) throw new Error(`companion_build_invalid:${validation.reason}`);
  return validation.path;
}

function copyBundleAtomic(sourceBundle, targetBundle, installRoot) {
  const parent = safeDirectory(installRoot, {create: true});
  const target = path.resolve(targetBundle);
  if (path.dirname(target) !== parent) throw new Error('helper_install_path_mismatch');
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('unsafe_helper_install_target');
  const staging = path.join(parent, `.${HELPER_BUNDLE_NAME}.installing-${crypto.randomUUID()}`);
  const backup = path.join(parent, `.${HELPER_BUNDLE_NAME}.previous-${crypto.randomUUID()}`);
  let movedExisting = false;
  try {
    fs.cpSync(sourceBundle, staging, {recursive: true, force: false, errorOnExist: true});
    const stagedValidation = safeBundlePath(staging, parent);
    if (!stagedValidation.usable) throw new Error(`helper_install_invalid:${stagedValidation.reason}`);
    if (fs.existsSync(target)) {
      fs.renameSync(target, backup);
      movedExisting = true;
    }
    fs.renameSync(staging, target);
    try { fs.chmodSync(target, 0o700); } catch {}
    if (movedExisting) fs.rmSync(backup, {recursive: true, force: true});
    return safeBundlePath(target, parent);
  } catch (error) {
    try { if (fs.existsSync(staging)) fs.rmSync(staging, {recursive: true, force: true}); } catch {}
    try { if (movedExisting && !fs.existsSync(target)) fs.renameSync(backup, target); } catch {}
    throw error;
  }
}

function copyCompanionAtomic(sourceBundle, targetBundle, installRoot) {
  const parent = safeDirectory(installRoot, {create: true});
  const target = path.resolve(targetBundle);
  if (path.dirname(target) !== parent) throw new Error('companion_install_path_mismatch');
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('unsafe_companion_install_target');
  const staging = path.join(parent, `.${COMPANION_BUNDLE_NAME}.installing-${crypto.randomUUID()}`);
  const backup = path.join(parent, `.${COMPANION_BUNDLE_NAME}.previous-${crypto.randomUUID()}`);
  let movedExisting = false;
  try {
    fs.cpSync(sourceBundle, staging, {recursive: true, force: false, errorOnExist: true});
    const stagedValidation = safeCompanionPath(staging, parent);
    if (!stagedValidation.usable) throw new Error(`companion_install_invalid:${stagedValidation.reason}`);
    if (fs.existsSync(target)) { fs.renameSync(target, backup); movedExisting = true; }
    fs.renameSync(staging, target);
    try { fs.chmodSync(target, 0o700); } catch {}
    if (movedExisting) fs.rmSync(backup, {recursive: true, force: true});
    return safeCompanionPath(target, parent);
  } catch (error) {
    try { if (fs.existsSync(staging)) fs.rmSync(staging, {recursive: true, force: true}); } catch {}
    try { if (movedExisting && !fs.existsSync(target)) fs.renameSync(backup, target); } catch {}
    throw error;
  }
}

function installRuntime({appSupportRoot, execute = defaultExecute} = {}) {
  const targetRoot = runtimeInstallDirectory({appSupportRoot});
  const parent = safeDirectory(appSupportRoot, {create: true});
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const staging = path.join(parent, `.runtime.installing-${crypto.randomUUID()}`);
  const backup = path.join(parent, `.runtime.previous-${crypto.randomUUID()}`);
  let movedExisting = false;
  try {
    for (const [sourceRelative, targetRelative] of RUNTIME_FILES) {
      const source = path.join(sourceRoot, sourceRelative);
      if (!safeRegularFile(source)) throw new Error(`runtime_source_missing:${sourceRelative}`);
      const target = path.join(staging, 'src', targetRelative);
      fs.mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(target, 0o600);
    }
    fs.writeFileSync(path.join(staging, 'package.json'), '{"private":true,"type":"module"}\n', {flag: 'wx', mode: 0o600});
    if (fs.existsSync(targetRoot)) {
      const stat = fs.lstatSync(targetRoot);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe_runtime_install_target');
      fs.renameSync(targetRoot, backup);
      movedExisting = true;
    }
    fs.renameSync(staging, targetRoot);
    try { fs.chmodSync(targetRoot, 0o700); } catch {}
    if (movedExisting) fs.rmSync(backup, {recursive: true, force: true});
    return {root: targetRoot, actionPath: runtimeActionPath({appSupportRoot})};
  } catch (error) {
    try { if (fs.existsSync(staging)) fs.rmSync(staging, {recursive: true, force: true}); } catch {}
    try { if (movedExisting && !fs.existsSync(targetRoot)) fs.renameSync(backup, targetRoot); } catch {}
    throw error;
  }
}

function configureCompanionInfo({appPath, nodePath, actionPath, evermindRoot, dropFolder, storeRoot, execute = defaultExecute}) {
  const infoPath = path.join(appPath, 'Contents', 'Info.plist');
  const original = fs.readFileSync(infoPath, 'utf8');
  const values = {
    '__EVERMIND_NODE_PATH__': nodePath,
    '__EVERMIND_RUNTIME_ACTION_PATH__': actionPath,
    '__EVERMIND_ROOT_PATH__': evermindRoot,
    '__EVERMIND_DROP_FOLDER__': dropFolder ?? '',
    '__EVERMIND_STORE_ROOT__': storeRoot,
  };
  const configured = Object.entries(values).reduce((text, [token, value]) => text.replaceAll(token, xmlEscape(value)), original);
  writeAtomic(infoPath, configured);
  execute('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], {encoding: 'utf8'});
  const validation = safeCompanionPath(appPath, path.dirname(appPath));
  if (!validation.usable) throw new Error(`companion_install_invalid:${validation.reason}`);
  return validation;
}

function registerCompanionApp({appPath, execute = defaultExecute} = {}) {
  const result = execute(LSREGISTER_PATH, ['-f', appPath], {encoding: 'utf8'});
  if (result?.error || result?.status !== 0) throw new Error('companion_registration_failed');
  return true;
}

function unregisterCompanionApp({appPath, execute = defaultExecute} = {}) {
  const result = execute(LSREGISTER_PATH, ['-u', appPath], {encoding: 'utf8'});
  return !result?.error && result?.status === 0;
}

function companionConfiguration(companionPath) {
  const infoPath = path.join(companionPath, 'Contents', 'Info.plist');
  if (!safeRegularFile(infoPath)) return {root: null, storeRoot: null, urlSchemeDeclared: false};
  const plist = fs.readFileSync(infoPath, 'utf8');
  const value = (key) => plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? null;
  return {
    root: value('EvermindRootPath'),
    dropFolder: value('EvermindDropFolder'),
    storeRoot: value('EvermindStoreRoot'),
    urlSchemeDeclared: Boolean(plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>evermind<\/string>/)),
  };
}

function companionURLRegistered({companionPath, execute = defaultExecute} = {}) {
  if (!companionPath) return false;
  const result = execute(LSREGISTER_PATH, ['-dump'], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  const boundedDump = typeof result?.stdout === 'string' && result.stdout.includes(companionPath);
  return boundedDump && (result?.status === 0 || result?.error?.code === 'ENOBUFS');
}

function countActionEvents(storeRoot) {
  const actionsRoot = path.join(path.resolve(storeRoot), 'actions');
  if (!fs.existsSync(actionsRoot)) return 0;
  if (!safeDirectory(actionsRoot)) throw new Error('unsafe_action_store');
  return Math.min(MAX_STATUS_EVENTS, fs.readdirSync(actionsRoot).filter((name) => name.startsWith('action-') && name.endsWith('.json')).length);
}

export function installNotifications({
  root,
  platform = process.platform,
  home = os.homedir(),
  appSupportRoot = applicationSupportRoot({home}),
  storeRoot = defaultStoreRoot(platform),
  launchctl = '/bin/launchctl',
  execute = defaultExecute,
  build = buildHelper,
  buildApp = buildCompanion,
  uid = typeof process.getuid === 'function' ? process.getuid() : null,
  nodePath = process.execPath,
  actionCliPath = null,
} = {}) {
  if (!isDarwin(platform)) throw new Error('unsupported_platform');
  const safeSupport = safeDirectory(appSupportRoot, {create: true});
  const safeStore = safeDirectory(storeRoot, {create: true});
  const helpers = safeDirectory(path.join(safeSupport, 'helpers'), {create: true});
  const logs = safeDirectory(path.join(safeSupport, 'logs'), {create: true});
  const apps = safeDirectory(companionInstallDirectory({appSupportRoot: safeSupport}), {create: true});
  const temporaryBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-notification-install-'));
  let helper;
  let companion;
  const localConfig = readLocalConfig({home, platform});
  const configured = resolveLocalPaths({root, home, platform, config: localConfig});
  const evermindRoot = configured.root;
  try {
    const built = build({outputDir: temporaryBuild, execute});
    helper = copyBundleAtomic(built, path.join(helpers, HELPER_BUNDLE_NAME), helpers);
    const builtCompanion = buildApp({outputDir: temporaryBuild, execute});
    const copiedCompanion = copyCompanionAtomic(builtCompanion, path.join(apps, COMPANION_BUNDLE_NAME), apps);
    const runtime = installRuntime({appSupportRoot: safeSupport, execute});
    companion = configureCompanionInfo({appPath: copiedCompanion.path, nodePath, actionPath: runtime.actionPath, evermindRoot, dropFolder: configured.dropFolder, storeRoot: safeStore, execute}).path;
    registerCompanionApp({appPath: companion, execute});
    actionCliPath = actionCliPath ?? runtime.actionPath;
  } finally {
    try { fs.rmSync(temporaryBuild, {recursive: true, force: true}); } catch {}
  }
  const plistPath = launchAgentPath({home});
  const plistRoot = safeDirectory(path.dirname(plistPath), {create: true});
  if (fs.existsSync(plistPath) && fs.lstatSync(plistPath).isSymbolicLink()) throw new Error('unsafe_launchagent_plist');
  const plist = launchAgentPlist({nodePath, actionCliPath, storeRoot: safeStore, evermindRoot, logRoot: logs});
  writeAtomic(plistPath, plist);
  unloadLaunchAgent({uid, launchctl, execute});
  loadLaunchAgent({plistPath, uid, launchctl, execute});
  return {
    helperPath: helper.path,
    companionPath: companion,
    runtimeActionPath: actionCliPath,
    storeRoot: safeStore,
    launchAgentPath: path.join(plistRoot, path.basename(plistPath)),
    launchAgentLabel: LAUNCH_AGENT_LABEL,
    loaded: true,
  };
}

export function notificationStatus({platform = process.platform, home = os.homedir(), appSupportRoot = applicationSupportRoot({home}), storeRoot = defaultStoreRoot(platform), launchctl = '/bin/launchctl', execute = defaultExecute, uid = typeof process.getuid === 'function' ? process.getuid() : null, env = process.env} = {}) {
  const discovery = discoverHelper({platform, env, appSupportRoot});
  const companion = safeCompanionPath(installedCompanionPath({appSupportRoot}), companionInstallDirectory({appSupportRoot}));
  const runtime = safeRegularFile(runtimeActionPath({appSupportRoot}));
  let localConfig;
  let configurationError = null;
  try { localConfig = readLocalConfig({home, platform}); }
  catch (error) {
    configurationError = typeof error?.message === 'string' ? error.message : 'invalid_local_config';
    localConfig = {path: path.join(appSupportRoot, 'config.json'), exists: false, rootPath: null, dropFolder: null};
  }
  const resolvedConfig = configurationError ? {root: null, dropFolder: null, rootSource: null, dropFolderSource: null, configPath: localConfig.path} : resolveLocalPaths({home, platform, env, config: localConfig});
  const companionInfo = companion.usable ? companionConfiguration(companion.path) : {root: null, dropFolder: null, storeRoot: null, urlSchemeDeclared: false};
  const plistPath = launchAgentPath({home});
  const plistInstalled = safeRegularFile(plistPath);
  let loaded = false;
  try { loaded = isDarwin(platform) ? launchAgentLoaded({uid, launchctl, execute}) : false; } catch {}
  let pendingActionEvents = 0;
  try { pendingActionEvents = countActionEvents(storeRoot); } catch {}
  return {
    supported: isDarwin(platform),
    helperInstalled: Boolean(discovery.path && discovery.source === 'installed'),
    helperPath: discovery.path,
    helperSource: discovery.source,
    helperReason: discovery.reason,
    helperExecutablePresent: Boolean(discovery.validation?.usable),
    helperBundleId: discovery.validation?.bundleId ?? null,
    helperSignature: discovery.validation?.signature ?? null,
    actionSupportAvailable: Boolean(discovery.path),
    companionInstalled: companion.usable,
    companionPath: companion.usable ? companion.path : null,
    companionReason: companion.reason ?? null,
    urlSchemeDeclared: companionInfo.urlSchemeDeclared,
    urlSchemeRegistered: companion.usable ? companionURLRegistered({companionPath: companion.path, execute}) : false,
    configurationPath: localConfig.path,
    configurationError,
    configuredEvermindRoot: resolvedConfig.root ?? companionInfo.root,
    configuredDropFolder: resolvedConfig.dropFolder ?? companionInfo.dropFolder,
    dropFolderSource: resolvedConfig.dropFolderSource,
    companionConfiguredEvermindRoot: companionInfo.root,
    companionConfiguredDropFolder: companionInfo.dropFolder,
    runtimeInstalled: runtime,
    runtimeActionPath: runtime ? runtimeActionPath({appSupportRoot}) : null,
    requestStorePath: path.resolve(storeRoot),
    launchAgentInstalled: plistInstalled,
    launchAgentLoaded: loaded,
    launchAgentLabel: LAUNCH_AGENT_LABEL,
    pendingActionEvents,
  };
}

export function uninstallNotifications({platform = process.platform, home = os.homedir(), appSupportRoot = applicationSupportRoot({home}), launchctl = '/bin/launchctl', execute = defaultExecute, uid = typeof process.getuid === 'function' ? process.getuid() : null} = {}) {
  if (!isDarwin(platform)) throw new Error('unsupported_platform');
  const plistPath = launchAgentPath({home});
  const unload = unloadLaunchAgent({uid, launchctl, execute});
  if (fs.existsSync(plistPath)) {
    const stat = fs.lstatSync(plistPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('unsafe_launchagent_plist');
    fs.unlinkSync(plistPath);
  }
  const helperPath = installedHelperPath({appSupportRoot});
  let helperRemoved = false;
  if (fs.existsSync(helperPath)) {
    const validation = safeBundlePath(helperPath, helperInstallDirectory({appSupportRoot}));
    if (!validation.usable) throw new Error(`refusing_helper_removal:${validation.reason}`);
    fs.rmSync(helperPath, {recursive: true, force: false});
    helperRemoved = true;
  }
  const companionPath = installedCompanionPath({appSupportRoot});
  let companionRemoved = false;
  if (fs.existsSync(companionPath)) {
    const validation = safeCompanionPath(companionPath, companionInstallDirectory({appSupportRoot}));
    if (!validation.usable) throw new Error(`refusing_companion_removal:${validation.reason}`);
    unregisterCompanionApp({appPath: companionPath, execute});
    fs.rmSync(companionPath, {recursive: true, force: false});
    companionRemoved = true;
  }
  const runtimePath = runtimeInstallDirectory({appSupportRoot});
  let runtimeRemoved = false;
  if (fs.existsSync(runtimePath)) {
    const stat = fs.lstatSync(runtimePath);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe_runtime_removal');
    fs.rmSync(runtimePath, {recursive: true, force: false});
    runtimeRemoved = true;
  }
  return {
    launchAgentPath: plistPath,
    launchAgentRemoved: !fs.existsSync(plistPath),
    wasLoaded: unload.loaded,
    helperPath,
    helperRemoved,
    companionPath,
    companionRemoved,
    runtimePath,
    runtimeRemoved,
    preservedStatePath: path.resolve(appSupportRoot),
  };
}

export {
  HELPER_BUNDLE_ID,
  HELPER_BUNDLE_NAME,
  HELPER_EXECUTABLE,
  COMPANION_BUNDLE_ID,
  COMPANION_BUNDLE_NAME,
  COMPANION_EXECUTABLE,
  LAUNCH_AGENT_LABEL,
  applicationSupportRoot,
  discoverHelper,
  helperInstallDirectory,
  installedHelperPath,
  runtimeInstallDirectory,
  runtimeActionPath,
  companionInstallDirectory,
  installedCompanionPath,
  launchAgentPath,
  launchAgentPlist,
  logDirectory,
  resolveEvermindRoot,
  safeBundlePath,
  safeCompanionPath,
  safeDirectory,
  sourceHelperPath,
  sourceCompanionPath,
  registerCompanionApp,
  unregisterCompanionApp,
  LSREGISTER_PATH,
  verifyCodeSignature,
};
