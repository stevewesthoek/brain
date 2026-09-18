import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { verifyRuntimePackage, type BrainRuntimePackage } from './runtime-package.js';

export const BRAIN_LOCAL_INSTALL_SCHEMA_VERSION = 'brain-local-install-v1' as const;
export const BRAIN_SERVICE_PACKAGE_SCHEMA_VERSION = 'brain-service-package-v1' as const;

export type LocalInstallPlatform = 'darwin' | 'linux';
export type LocalInstall = {
  schemaVersion: typeof BRAIN_LOCAL_INSTALL_SCHEMA_VERSION;
  installId: string;
  packageId: string;
  releaseRevision: string;
  platform: LocalInstallPlatform;
  architecture: 'arm64' | 'x64';
  nodeExecutable: string;
  releaseRoot: string;
  stateRoot: string;
  configPath: string;
  secretRef: string;
  components: ['brain-core', 'brain-console'];
  dependencyHydration: { strategy: 'npm-production-hydration'; executable: 'npm'; args: ['ci', '--omit=dev']; status: 'required' | 'verified-by-fixture' };
  servicePackages: string[];
  installedAt: string;
};

export type BrainServicePackage = {
  schemaVersion: typeof BRAIN_SERVICE_PACKAGE_SCHEMA_VERSION;
  component: 'brain-core' | 'brain-console';
  releaseRevision: string;
  platform: LocalInstallPlatform;
  label: string;
  executable: string;
  argv: string[];
  workingDirectory: string;
  configPath: string;
  secretFileRef: string;
  environmentRefs: string[];
  restart: { policy: 'on-failure'; delaySeconds: 5; maxBurst: 3 };
  scope: 'user';
  activation: 'not-registered';
  descriptorPath: string;
};

export type LocalInstallInput = {
  packageRoot: string;
  installRoot: string;
  platform: LocalInstallPlatform;
  architecture: 'arm64' | 'x64';
  nodeExecutable: string;
  nodeVersion: string;
  secretRef: string;
  now?: string;
  hydrate?: () => 'verified-by-fixture';
};

export type LocalInstallPlan = {
  schemaVersion: typeof BRAIN_LOCAL_INSTALL_SCHEMA_VERSION;
  installId: string;
  packageId: string;
  releaseRoot: string;
  stateRoot: string;
  configPath: string;
  secretRef: string;
  hydration: { executable: 'npm'; args: ['ci', '--omit=dev']; network: 'required-for-live-hydration'; execution: 'not-run-in-plan' };
  servicePackages: BrainServicePackage[];
  activation: { registration: 'not-run'; start: 'not-run'; manager: 'explicit-future-operation' };
  rollback: { beforeActivation: 'discard-unactivated-release-and-descriptors'; preserves: ['state', 'config', 'secrets'] };
};

export type LocalInstallResult = { ok: true; install: LocalInstall; plan: LocalInstallPlan } | { ok: false; reason: 'package-unverified' | 'target-conflict' | 'invalid-input' | 'install-failed'; detail: string };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }

function safeAbsolute(value: string, label: string): string {
  if (!path.isAbsolute(value) || value.length > 1_024 || value.includes('\\') || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} is unsafe`);
  const normalized = path.normalize(value);
  if (normalized === '/' || normalized.includes('/.git/') || normalized.includes('/node_modules/')) throw new Error(`${label} is unsafe`);
  return normalized;
}

function safeRef(value: string): string {
  if (!/^[A-Za-z0-9._/-]{1,256}$/u.test(value) || value.includes('..') || value.startsWith('/')) throw new Error('secretRef is unsafe');
  return value;
}

function assertNodeVersion(value: string): void {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(value);
  if (!match || Number(match[1]) < 22 || (Number(match[1]) === 22 && Number(match[2]) < 5)) throw new Error('Node >=22.5.0 is required');
}

function xml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }

function servicePackages(input: { platform: LocalInstallPlatform; nodeExecutable: string; releaseRoot: string; releaseRevision: string; configPath: string; secretRef: string; servicesRoot: string; installRoot: string }): BrainServicePackage[] {
  const secretFileRef = path.join(input.installRoot, input.secretRef);
  const base = { schemaVersion: BRAIN_SERVICE_PACKAGE_SCHEMA_VERSION as typeof BRAIN_SERVICE_PACKAGE_SCHEMA_VERSION, platform: input.platform, executable: input.nodeExecutable, workingDirectory: input.releaseRoot, releaseRevision: input.releaseRevision, configPath: input.configPath, secretFileRef, environmentRefs: ['BRAIN_RUNTIME_CONFIG_PATH', 'BRAIN_SECRETS_FILE'], restart: { policy: 'on-failure' as const, delaySeconds: 5 as const, maxBurst: 3 as const }, scope: 'user' as const, activation: 'not-registered' as const };
  const core: BrainServicePackage = { ...base, component: 'brain-core', label: input.platform === 'darwin' ? 'com.office.brain-core' : 'brain-core.service', argv: ['--env-file', secretFileRef, path.join(input.releaseRoot, 'core', 'dist', 'index.js')], descriptorPath: path.join(input.servicesRoot, input.platform === 'darwin' ? 'com.brain.core.plist' : 'brain-core.service') };
  const consoleService: BrainServicePackage = { ...base, component: 'brain-console', label: input.platform === 'darwin' ? 'com.office.brain-console' : 'brain-console.service', argv: ['--env-file', secretFileRef, path.join(input.releaseRoot, 'console', 'standalone', 'server.js')], descriptorPath: path.join(input.servicesRoot, input.platform === 'darwin' ? 'com.brain.console.plist' : 'brain-console.service') };
  return [core, consoleService];
}

function descriptor(service: BrainServicePackage): string {
  const runtimeBasePath = path.dirname(path.dirname(service.workingDirectory));
  const stateStorePath = path.join(runtimeBasePath, 'state', 'agent-mode.db');
  if (service.platform === 'darwin') return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${xml(service.label)}</string><key>ProgramArguments</key><array>${[service.executable, ...service.argv].map((arg) => `<string>${xml(arg)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(service.workingDirectory)}</string><key>EnvironmentVariables</key><dict><key>BRAIN_RUNTIME_PATH</key><string>${xml(runtimeBasePath)}</string><key>BRAIN_DEPLOYMENT_REVISION</key><string>${xml(service.releaseRevision)}</string><key>BRAIN_RUNTIME_SQLITE_PATH</key><string>${xml(stateStorePath)}</string><key>BRAIN_RUNTIME_CONFIG_PATH</key><string>${xml(service.configPath)}</string><key>BRAIN_SECRETS_FILE</key><string>${xml(service.secretFileRef)}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>5</integer></dict></plist>\n`;
  return `[Unit]\nDescription=${service.component}\nAfter=network.target\n\n[Service]\nExecStart=${[service.executable, ...service.argv].map((arg) => JSON.stringify(arg)).join(' ')}\nWorkingDirectory=${JSON.stringify(service.workingDirectory)}\nEnvironment=BRAIN_RUNTIME_PATH=${JSON.stringify(runtimeBasePath)}\nEnvironment=BRAIN_DEPLOYMENT_REVISION=${JSON.stringify(service.releaseRevision)}\nEnvironment=BRAIN_RUNTIME_SQLITE_PATH=${JSON.stringify(stateStorePath)}\nEnvironment=BRAIN_RUNTIME_CONFIG_PATH=${JSON.stringify(service.configPath)}\nEnvironment=BRAIN_SECRETS_FILE=${JSON.stringify(service.secretFileRef)}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`;
}

function existingTarget(target: string): 'fresh' | 'same-package' | 'unknown' {
  if (!existsSync(target)) return 'fresh';
  if (!lstatSync(target).isDirectory()) return 'unknown';
  return readdirSync(target, { withFileTypes: true }).length === 0 ? 'fresh' : 'unknown';
}

export function createLocalInstallPlan(input: LocalInstallInput, pkg: BrainRuntimePackage): LocalInstallPlan {
  const installRoot = safeAbsolute(input.installRoot, 'installRoot');
  const releaseRoot = path.join(installRoot, 'releases', pkg.packageId);
  const stateRoot = path.join(installRoot, 'state');
  const configPath = path.join(installRoot, 'config', 'brain-runtime-config.json');
  const servicesRoot = path.join(installRoot, 'services');
  const installMaterial = { schemaVersion: BRAIN_LOCAL_INSTALL_SCHEMA_VERSION, packageId: pkg.packageId, releaseRoot, stateRoot, configPath, platform: input.platform, architecture: input.architecture, nodeExecutable: input.nodeExecutable, serviceStrategy: input.platform === 'darwin' ? 'launch-agent' : 'systemd-user' };
  const secretRef = safeRef(input.secretRef);
  return { schemaVersion: BRAIN_LOCAL_INSTALL_SCHEMA_VERSION, installId: `brain-local-install:sha256:${digest(installMaterial)}`, packageId: pkg.packageId, releaseRoot, stateRoot, configPath, secretRef, hydration: { executable: 'npm', args: ['ci', '--omit=dev'], network: 'required-for-live-hydration', execution: 'not-run-in-plan' }, servicePackages: servicePackages({ platform: input.platform, nodeExecutable: input.nodeExecutable, releaseRoot, releaseRevision: pkg.releaseRevision, configPath, secretRef, servicesRoot, installRoot }), activation: { registration: 'not-run', start: 'not-run', manager: 'explicit-future-operation' }, rollback: { beforeActivation: 'discard-unactivated-release-and-descriptors', preserves: ['state', 'config', 'secrets'] } };
}

export function renderServiceDescriptor(service: BrainServicePackage): string { return descriptor(service); }

export function readRuntimePackageManifest(packageRoot: string): BrainRuntimePackage {
  const verification = verifyRuntimePackage(packageRoot);
  if (!verification.ok) throw new Error(`package is not verified: ${verification.detail}`);
  return JSON.parse(readFileSync(path.join(safeAbsolute(packageRoot, 'packageRoot'), 'manifest.json'), 'utf8')) as BrainRuntimePackage;
}

export function installRuntimePackage(input: LocalInstallInput): LocalInstallResult {
  let packageRoot: string;
  let installRoot: string;
  try { packageRoot = safeAbsolute(input.packageRoot, 'packageRoot'); installRoot = safeAbsolute(input.installRoot, 'installRoot'); safeAbsolute(input.nodeExecutable, 'nodeExecutable'); safeRef(input.secretRef); assertNodeVersion(input.nodeVersion); } catch (error) { return { ok: false, reason: 'invalid-input', detail: error instanceof Error ? error.message : String(error) }; }
  const verification = verifyRuntimePackage(packageRoot);
  if (!verification.ok) return { ok: false, reason: 'package-unverified', detail: verification.detail };
  let pkg: BrainRuntimePackage;
  try { pkg = JSON.parse(readFileSync(path.join(packageRoot, 'manifest.json'), 'utf8')) as BrainRuntimePackage; } catch (error) { return { ok: false, reason: 'package-unverified', detail: error instanceof Error ? error.message : String(error) }; }
  if (pkg.platformClass !== input.platform || pkg.architectureClass !== input.architecture) return { ok: false, reason: 'invalid-input', detail: 'package platform or architecture does not match install target' };
  const plan = createLocalInstallPlan(input, pkg);
  const targetState = existingTarget(installRoot);
  if (targetState === 'unknown' && existsSync(path.join(installRoot, 'install.json'))) {
    try {
      const existing = JSON.parse(readFileSync(path.join(installRoot, 'install.json'), 'utf8')) as LocalInstall;
      if (existing.packageId === pkg.packageId && existing.installId === plan.installId && verifyInstalledRelease(installRoot).ok) return { ok: true, install: existing, plan };
    } catch { /* fall through to deterministic conflict */ }
  }
  if (targetState === 'unknown') return { ok: false, reason: 'target-conflict', detail: 'installRoot must be fresh or empty' };
  try {
    mkdirSync(installRoot, { recursive: true });
    mkdirSync(plan.releaseRoot, { recursive: true });
    cpSync(packageRoot, plan.releaseRoot, { recursive: true });
    mkdirSync(plan.stateRoot, { recursive: true }); mkdirSync(path.dirname(plan.configPath), { recursive: true }); mkdirSync(path.dirname(plan.servicePackages[0]?.descriptorPath ?? path.join(installRoot, 'services')), { recursive: true });
    if (!existsSync(plan.configPath)) writeFileSync(plan.configPath, readFileSync(path.join(plan.releaseRoot, 'config', 'brain-runtime-config.example.json'), 'utf8'), { mode: 0o600 });
    const hydrated = input.hydrate ? input.hydrate() : undefined;
    for (const service of plan.servicePackages) writeFileSync(service.descriptorPath, descriptor(service), { mode: 0o644 });
    const install: LocalInstall = { schemaVersion: BRAIN_LOCAL_INSTALL_SCHEMA_VERSION, installId: plan.installId, packageId: pkg.packageId, releaseRevision: pkg.releaseRevision, platform: input.platform, architecture: input.architecture, nodeExecutable: input.nodeExecutable, releaseRoot: plan.releaseRoot, stateRoot: plan.stateRoot, configPath: plan.configPath, secretRef: input.secretRef, components: ['brain-core', 'brain-console'], dependencyHydration: { strategy: 'npm-production-hydration', executable: 'npm', args: ['ci', '--omit=dev'], status: hydrated ?? 'required' }, servicePackages: plan.servicePackages.map((service) => service.descriptorPath), installedAt: input.now ?? new Date().toISOString() };
    writeFileSync(path.join(installRoot, 'install.json'), `${JSON.stringify(install, null, 2)}\n`, { mode: 0o600 });
    return { ok: true, install, plan };
  } catch (error) {
    if (targetState === 'fresh') rmSync(installRoot, { recursive: true, force: true });
    return { ok: false, reason: 'install-failed', detail: error instanceof Error ? error.message : String(error) };
  }
}

export function verifyInstalledRelease(installRoot: string): { ok: true; install: LocalInstall } | { ok: false; reason: string } {
  try { const root = safeAbsolute(installRoot, 'installRoot'); const install = JSON.parse(readFileSync(path.join(root, 'install.json'), 'utf8')) as LocalInstall; const verification = verifyRuntimePackage(path.join(install.releaseRoot)); if (!verification.ok || verification.packageId !== install.packageId) return { ok: false, reason: 'installed release payload is not verified' }; for (const service of install.servicePackages) if (!existsSync(service)) return { ok: false, reason: 'service descriptor is missing' }; return { ok: true, install }; } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error) }; }
}
