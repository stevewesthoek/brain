#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const appPath = path.join(process.env.HOME ?? os.homedir(), 'Applications', 'Brain Console.app');
const executablePath = path.join(appPath, 'Contents', 'MacOS', 'Brain Console');
const infoPath = path.join(appPath, 'Contents', 'Info.plist');
const launcherPath = path.join(repoRoot, 'tools', 'brain-console-launcher.mjs');
const consoleServicePlistPath = path.join(repoRoot, 'operations', 'system-configs', 'launchagents', 'com.office.brain-console.plist');
const installedConsoleServicePlistPath = path.join(process.env.HOME ?? os.homedir(), 'Library', 'LaunchAgents', 'com.office.brain-console.plist');

if (process.argv.includes('--dry-run')) {
  process.stdout.write(`${JSON.stringify({ appPath, launcherPath, consoleServicePlistPath, installedConsoleServicePlistPath, action: 'install-or-update-owned-app' }, null, 2)}\n`);
  process.exit(0);
}

if (!fs.existsSync(launcherPath)) throw new Error(`launcher source is missing: ${launcherPath}`);
if (!fs.existsSync(consoleServicePlistPath)) throw new Error(`Console LaunchAgent source is missing: ${consoleServicePlistPath}`);
fs.mkdirSync(path.dirname(appPath), { recursive: true });

if (fs.existsSync(appPath)) {
  if (!isOwnedApp()) throw new Error(`refusing to replace an app not owned by Brain Console: ${appPath}`);
  fs.rmSync(appPath, { recursive: true, force: true });
}

const temporaryApp = fs.mkdtempSync(path.join(path.dirname(appPath), '.Brain Console.app.install-'));
try {
  const temporaryExecutable = path.join(temporaryApp, 'Contents', 'MacOS', 'Brain Console');
  const temporaryInfo = path.join(temporaryApp, 'Contents', 'Info.plist');
  fs.mkdirSync(path.dirname(temporaryExecutable), { recursive: true });
  fs.writeFileSync(temporaryExecutable, `#!/bin/zsh\nexec /opt/homebrew/bin/node ${shellQuote(launcherPath)}\n`, { mode: 0o755 });
  fs.writeFileSync(temporaryInfo, infoPlist(), 'utf8');
  fs.renameSync(temporaryApp, appPath);
} catch (error) {
  fs.rmSync(temporaryApp, { recursive: true, force: true });
  throw error;
}

process.stdout.write(`Installed ${appPath}\n`);

installConsoleServicePlist();

process.stdout.write(`Installed ${installedConsoleServicePlistPath}\n`);

function installConsoleServicePlist() {
  const canonicalRoot = '/Users/Office/Repos/stevewesthoek/brain';
  const source = fs.readFileSync(consoleServicePlistPath, 'utf8');
  if (!source.includes(canonicalRoot)) throw new Error('Console LaunchAgent source root is not recognized');
  const rendered = source.replaceAll(canonicalRoot, repoRoot);
  fs.mkdirSync(path.dirname(installedConsoleServicePlistPath), { recursive: true });
  const temporaryPath = `${installedConsoleServicePlistPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, rendered, { mode: 0o600 });
  fs.renameSync(temporaryPath, installedConsoleServicePlistPath);
}

function isOwnedApp() {
  try {
    const contents = fs.readFileSync(infoPath, 'utf8');
    return contents.includes('<string>com.office.brain.console</string>');
  } catch {
    return false;
  }
}

function infoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Brain Console</string>
    <key>CFBundleExecutable</key>
    <string>Brain Console</string>
    <key>CFBundleIdentifier</key>
    <string>com.office.brain.console</string>
    <key>CFBundleName</key>
    <string>Brain Console</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
`;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
