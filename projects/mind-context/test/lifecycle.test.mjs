import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {createReviewReadyCaptureRequest} from '../src/review/decision-request.mjs';
import {createRequestStore} from '../src/notifications/request-store.mjs';
import {
  HELPER_BUNDLE_ID,
  HELPER_EXECUTABLE,
  COMPANION_BUNDLE_ID,
  COMPANION_EXECUTABLE,
  discoverHelper,
  installNotifications,
  launchAgentPlist,
  notificationStatus,
  safeBundlePath,
  uninstallNotifications,
} from '../src/notifications/lifecycle.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-lifecycle-'));
}

function createFakeHelper(root, {bundleId = HELPER_BUNDLE_ID, executable = HELPER_EXECUTABLE, symlink = false} = {}) {
  const app = path.join(root, 'EvermindNotificationHelper.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), {recursive: true});
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0"><dict>',
    `<key>CFBundleIdentifier</key><string>${bundleId}</string>`,
    `<key>CFBundleExecutable</key><string>${executable}</string>`,
    '</dict></plist>',
  ].join(''));
  fs.writeFileSync(path.join(app, 'Contents', 'MacOS', HELPER_EXECUTABLE), '#!/bin/sh\n');
  fs.chmodSync(path.join(app, 'Contents', 'MacOS', HELPER_EXECUTABLE), 0o755);
  if (symlink) {
    const link = `${app}.link`;
    fs.symlinkSync(app, link, 'dir');
    return link;
  }
  return app;
}

function fakeBuild({outputDir}) {
  return createFakeHelper(outputDir);
}

function fakeBuildCompanion({outputDir}) {
  const app = path.join(outputDir, 'Evermind.app');
  fs.mkdirSync(path.join(app, 'Contents', 'MacOS'), {recursive: true});
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist version="1.0"><dict>',
    `<key>CFBundleIdentifier</key><string>${COMPANION_BUNDLE_ID}</string>`,
    `<key>CFBundleExecutable</key><string>${COMPANION_EXECUTABLE}</string>`,
    '<key>CFBundleURLSchemes</key><array><string>evermind</string></array>',
    '</dict></plist>',
  ].join(''));
  fs.writeFileSync(path.join(app, 'Contents', 'MacOS', COMPANION_EXECUTABLE), '#!/bin/sh\n');
  fs.chmodSync(path.join(app, 'Contents', 'MacOS', COMPANION_EXECUTABLE), 0o755);
  return app;
}

function launchctlMock(calls) {
  return (file, args) => {
    calls.push({file, args});
    return {status: 0, stdout: '', stderr: ''};
  };
}

test('helper provenance requires expected bundle identity, executable, and non-symlink structure', () => {
  const root = tempRoot();
  const valid = createFakeHelper(root);
  assert.equal(safeBundlePath(valid).usable, true);
  assert.equal(safeBundlePath(createFakeHelper(root, {bundleId: 'wrong.bundle'})).reason, 'helper_provenance_mismatch');
  const missing = createFakeHelper(root);
  fs.unlinkSync(path.join(missing, 'Contents', 'MacOS', HELPER_EXECUTABLE));
  assert.equal(safeBundlePath(missing).reason, 'invalid_helper_structure');
  assert.equal(safeBundlePath(createFakeHelper(root, {symlink: true})).reason, 'unsafe_helper_bundle');
});

test('helper discovery prefers override, then installed, then source, and rejects unsafe override', () => {
  const root = tempRoot();
  const support = path.join(root, 'support');
  const source = createFakeHelper(path.join(root, 'source'));
  fs.mkdirSync(path.join(support, 'helpers'), {recursive: true});
  const installed = createFakeHelper(path.join(support, 'helpers'));
  fs.renameSync(installed, path.join(support, 'helpers', 'EvermindNotificationHelper.app'));
  const preferred = discoverHelper({platform: 'darwin', appSupportRoot: support, sourcePath: source, env: {}});
  assert.equal(preferred.source, 'installed');
  assert.equal(discoverHelper({platform: 'darwin', appSupportRoot: support, sourcePath: source, env: {EVERMIND_NOTIFICATION_HELPER: source}}).source, 'environment');
  const unsafe = createFakeHelper(root, {symlink: true});
  assert.equal(discoverHelper({platform: 'darwin', appSupportRoot: support, sourcePath: source, env: {EVERMIND_NOTIFICATION_HELPER: unsafe}}).reason, 'unsafe_helper_bundle');
});

test('install generates a safe LaunchAgent and uninstall preserves notification state', () => {
  const root = tempRoot();
  const home = path.join(root, 'home');
  const support = path.join(root, 'support');
  const storeRoot = path.join(support, 'notifications');
  const calls = [];
  const installed = installNotifications({
    platform: 'darwin',
    home,
    appSupportRoot: support,
    storeRoot,
    root: path.join(root, 'fixture-evermind'),
    build: fakeBuild,
    buildApp: fakeBuildCompanion,
    execute: launchctlMock(calls),
    uid: 501,
    nodePath: '/usr/local/bin/node',
  });
  assert.equal(fs.existsSync(installed.helperPath), true);
  assert.equal(fs.existsSync(installed.companionPath), true);
  assert.equal(fs.existsSync(installed.runtimeActionPath), true);
  assert.equal(fs.existsSync(installed.launchAgentPath), true);
  assert.equal(calls.some(({args}) => args[0] === 'bootout' && args[1] === 'gui/501/tools.prochat.evermind.notification-drain'), true);
  assert.equal(calls.some(({args}) => args[0] === 'bootstrap'), true);
  const plist = fs.readFileSync(installed.launchAgentPath, 'utf8');
  assert.match(plist, /<key>ProgramArguments<\/key>/);
  assert.doesNotMatch(plist, /\/bin\/sh| -c |<key>Program<\/key>/);
  assert.match(plist, /<integer>30<\/integer>/);
  assert.match(plist, new RegExp(`${support.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/runtime\\/src\\/notifications\\/action-cli\\.mjs`));
  assert.doesNotMatch(plist, /brain-evermind-e1.*src\/notifications\/action-cli\.mjs/);
  assert.equal(notificationStatus({platform: 'darwin', home, appSupportRoot: support, storeRoot, execute: launchctlMock([]), uid: 501}).helperInstalled, true);
  assert.equal(notificationStatus({platform: 'darwin', home, appSupportRoot: support, storeRoot, execute: launchctlMock([]), uid: 501}).companionInstalled, true);
  assert.equal(notificationStatus({platform: 'darwin', home, appSupportRoot: support, storeRoot, execute: launchctlMock([]), uid: 501}).runtimeInstalled, true);

  const store = createRequestStore({root: storeRoot});
  const request = createReviewReadyCaptureRequest({captureId: '66666666-6666-4666-8666-666666666666'});
  store.put(request);
  const evermindRoot = path.join(root, 'fixture-evermind');
  fs.mkdirSync(path.join(evermindRoot, 'knowledge'), {recursive: true});
  fs.writeFileSync(path.join(evermindRoot, 'knowledge', 'keep.md'), 'human-owned memory');
  fs.mkdirSync(path.join(evermindRoot, 'inbox', 'processed'), {recursive: true});
  fs.writeFileSync(path.join(evermindRoot, 'inbox', 'processed', 'receipt.md'), 'review history');
  const removed = uninstallNotifications({platform: 'darwin', home, appSupportRoot: support, execute: launchctlMock([]), uid: 501});
  assert.equal(removed.helperRemoved, true);
  assert.equal(removed.companionRemoved, true);
  assert.equal(removed.runtimeRemoved, true);
  assert.equal(fs.existsSync(installed.launchAgentPath), false);
  assert.equal(fs.existsSync(path.join(store.requestsRoot, `${request.requestId}.json`)), true);
  assert.equal(fs.existsSync(storeRoot), true);
  assert.equal(fs.readFileSync(path.join(evermindRoot, 'knowledge', 'keep.md'), 'utf8'), 'human-owned memory');
  assert.equal(fs.existsSync(path.join(evermindRoot, 'inbox', 'processed', 'receipt.md')), true);
});

test('LaunchAgent plist uses structured arguments and bounded support paths', () => {
  const plist = launchAgentPlist({
    nodePath: '/usr/bin/node',
    actionCliPath: '/safe/action-cli.mjs',
    storeRoot: '/safe/Evermind/notifications',
    evermindRoot: '/safe/Evermind',
    logRoot: '/safe/Evermind/logs',
  });
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plist, /<key>StartInterval<\/key><integer>30<\/integer>/);
  assert.doesNotMatch(plist, /shell|command -|eval|`/i);
  assert.match(plist, /<string>--drain<\/string>/);
});
