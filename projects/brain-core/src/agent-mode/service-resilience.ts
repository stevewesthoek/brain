import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { verifyRuntimePackage, type BrainRuntimePackage } from './runtime-package.js';

export const BRAIN_SERVICE_RESILIENCE_SCHEMA_VERSION = 'brain-service-resilience-v1' as const;
export const BRAIN_SERVICE_CORE_LABEL = 'com.office.brain-core' as const;
export const BRAIN_SERVICE_CONSOLE_LABEL = 'com.office.brain-console' as const;
export const BRAIN_SERVICE_MIN_NODE_MAJOR = 26 as const;
export const BRAIN_SERVICE_MIN_NODE_VERSION = '26.8.2' as const;
export const BRAIN_SERVICE_STATE_STORE_SCHEMA_VERSION = 10 as const;

export type LaunchdDescriptor = {
  label: string;
  programArguments: string[];
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  runAtLoad: boolean;
  keepAlive: boolean | Record<string, unknown>;
  standardOutPath?: string;
  standardErrorPath?: string;
};

export type NodeRuntimeInspection = {
  ok: boolean;
  executable: string;
  resolvedExecutable?: string;
  version?: string;
  major?: number;
  minor?: number;
  patch?: number;
  sha256?: string;
  reason?: 'missing' | 'not-a-file' | 'version-failed' | 'unsupported-version';
};

export type ServiceDoctorExpected = {
  runtimeRoot: string;
  runtimeBasePath?: string;
  packageId: string;
  sourceRevision: string;
  nodeExecutable: string;
  nodeMajor: number;
  stateStorePath: string;
  configPath?: string;
};

export type ServiceDoctorObserved = {
  node: NodeRuntimeInspection;
  coreDescriptor?: LaunchdDescriptor;
  consoleDescriptor?: LaunchdDescriptor;
  launchd: { coreLoaded: boolean; consoleLoaded: boolean };
  processes: { core: number; console: number };
  store: { exists: boolean; schemaVersion: number; integrity: 'ok' | 'failed' | 'unknown'; foreignKeyErrors: number | null };
  package: { verified: boolean; manifest?: BrainRuntimePackage; detail?: string };
};

export type ServiceDoctorCheck = {
  id: string;
  status: 'pass' | 'fail';
  detail: string;
};

export type ServiceDoctorResult = {
  schemaVersion: typeof BRAIN_SERVICE_RESILIENCE_SCHEMA_VERSION;
  outcome: 'PASS' | 'FAIL';
  checks: ServiceDoctorCheck[];
  identity: {
    runtimeRoot: string;
    packageId: string;
    sourceRevision: string;
    nodeExecutable: string;
    nodeVersion: string | null;
    nodeResolvedExecutable: string | null;
    stateStorePath: string;
  };
};

type RawPlist = Record<string, unknown>;

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function versionParts(value: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function atLeastVersion(actual: [number, number, number], minimum: [number, number, number]): boolean {
  if (actual[0] !== minimum[0]) return actual[0] > minimum[0];
  if (actual[1] !== minimum[1]) return actual[1] > minimum[1];
  return actual[2] >= minimum[2];
}

function truthyKeepAlive(value: boolean | Record<string, unknown>): boolean {
  return value === true || (typeof value === 'object' && value !== null);
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function normalizeLaunchdDescriptor(raw: RawPlist): LaunchdDescriptor | undefined {
  const label = raw.Label;
  const programArguments = raw.ProgramArguments;
  const workingDirectory = raw.WorkingDirectory;
  const runAtLoad = raw.RunAtLoad;
  const keepAlive = raw.KeepAlive;
  if (typeof label !== 'string' || !Array.isArray(programArguments) || !programArguments.every((value) => typeof value === 'string') || typeof workingDirectory !== 'string' || typeof runAtLoad !== 'boolean' || (typeof keepAlive !== 'boolean' && (typeof keepAlive !== 'object' || keepAlive === null || Array.isArray(keepAlive)))) return undefined;
  return {
    label,
    programArguments: programArguments as string[],
    workingDirectory,
    environmentVariables: asStringRecord(raw.EnvironmentVariables),
    runAtLoad,
    keepAlive: keepAlive as boolean | Record<string, unknown>,
    ...(typeof raw.StandardOutPath === 'string' ? { standardOutPath: raw.StandardOutPath } : {}),
    ...(typeof raw.StandardErrorPath === 'string' ? { standardErrorPath: raw.StandardErrorPath } : {}),
  };
}

export function inspectNodeExecutable(executable: string, expectedMajor: number = BRAIN_SERVICE_MIN_NODE_MAJOR): NodeRuntimeInspection {
  const base = { ok: false, executable } satisfies Pick<NodeRuntimeInspection, 'ok' | 'executable'>;
  if (!path.isAbsolute(executable) || !existsSync(executable)) return { ...base, reason: 'missing' };
  try {
    if (!statSync(executable).isFile()) return { ...base, reason: 'not-a-file' };
    const version = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 5_000 }).trim();
    const parts = versionParts(version);
    if (!parts || parts[0] !== expectedMajor || !atLeastVersion(parts, [BRAIN_SERVICE_MIN_NODE_MAJOR, 8, 2])) return { ...base, version, ...(parts ? { major: parts[0], minor: parts[1], patch: parts[2] } : {}), reason: 'unsupported-version' };
    return { ok: true, executable, resolvedExecutable: realpathSync(executable), version, major: parts[0], minor: parts[1], patch: parts[2], sha256: sha256(Buffer.from(readFileSync(executable))) };
  } catch {
    return { ...base, reason: 'version-failed' };
  }
}

function checkDescriptor(checks: ServiceDoctorCheck[], component: 'core' | 'console', descriptor: LaunchdDescriptor | undefined, expected: ServiceDoctorExpected): void {
  const label = component === 'core' ? BRAIN_SERVICE_CORE_LABEL : BRAIN_SERVICE_CONSOLE_LABEL;
  const entrypoint = component === 'core' ? path.join(expected.runtimeRoot, 'core', 'dist', 'index.js') : path.join(expected.runtimeRoot, 'console', 'standalone', 'server.js');
  const expectedConfig = expected.configPath;
  const expectedRuntimeBasePath = expected.runtimeBasePath ?? path.dirname(path.dirname(expected.runtimeRoot));
  const environment = descriptor?.environmentVariables ?? {};
  const argumentsMatch = descriptor?.programArguments.length === 4
    && descriptor.programArguments[0] === expected.nodeExecutable
    && descriptor.programArguments[1] === '--env-file'
    && descriptor.programArguments[2]?.endsWith('/config/secrets.env') === true
    && descriptor.programArguments[3] === entrypoint;
  checks.push({ id: `${component}.descriptor-present`, status: descriptor ? 'pass' : 'fail', detail: descriptor ? 'descriptor is readable' : 'descriptor is missing or malformed' });
  if (!descriptor) return;
  checks.push({ id: `${component}.label`, status: descriptor.label === label ? 'pass' : 'fail', detail: descriptor.label === label ? label : `unexpected label ${descriptor.label}` });
  checks.push({ id: `${component}.arguments`, status: argumentsMatch ? 'pass' : 'fail', detail: argumentsMatch ? 'Node, env-file, and immutable entrypoint are correct' : 'ProgramArguments do not bind the expected Node and immutable entrypoint' });
  checks.push({ id: `${component}.working-directory`, status: descriptor.workingDirectory === expected.runtimeRoot ? 'pass' : 'fail', detail: descriptor.workingDirectory === expected.runtimeRoot ? 'immutable runtime root' : 'working directory is not the expected runtime root' });
  checks.push({ id: `${component}.lifecycle`, status: descriptor.runAtLoad && truthyKeepAlive(descriptor.keepAlive) ? 'pass' : 'fail', detail: descriptor.runAtLoad && truthyKeepAlive(descriptor.keepAlive) ? 'RunAtLoad and KeepAlive are enabled' : 'RunAtLoad/KeepAlive policy is not resilient' });
  checks.push({ id: `${component}.runtime-environment`, status: environment.BRAIN_RUNTIME_PATH === expectedRuntimeBasePath && environment.BRAIN_DEPLOYMENT_REVISION === expected.sourceRevision && environment.BRAIN_RUNTIME_SQLITE_PATH === expected.stateStorePath && (expectedConfig === undefined || environment.BRAIN_RUNTIME_CONFIG_PATH === expectedConfig) ? 'pass' : 'fail', detail: environment.BRAIN_RUNTIME_PATH === expectedRuntimeBasePath && environment.BRAIN_DEPLOYMENT_REVISION === expected.sourceRevision && environment.BRAIN_RUNTIME_SQLITE_PATH === expected.stateStorePath ? 'runtime, source, and StateStore bindings are correct' : 'runtime environment points at the wrong release, source, or StateStore' });
  checks.push({ id: `${component}.secret-reference`, status: descriptor.programArguments[2]?.endsWith('/config/secrets.env') === true && environment.BRAIN_SECRETS_FILE?.endsWith('/config/secrets.env') === true ? 'pass' : 'fail', detail: descriptor.programArguments[2]?.endsWith('/config/secrets.env') === true ? 'secret reference is external and bounded' : 'secret reference is missing or malformed' });
}

export function evaluateServiceDoctor(expected: ServiceDoctorExpected, observed: ServiceDoctorObserved): ServiceDoctorResult {
  const checks: ServiceDoctorCheck[] = [];
  const runtimeRoot = path.normalize(expected.runtimeRoot);
  const node = observed.node;
  checks.push({ id: 'runtime-root', status: path.isAbsolute(runtimeRoot) && !runtimeRoot.includes('/Repos/') && !runtimeRoot.includes('/rollback') ? 'pass' : 'fail', detail: 'runtime root is absolute and not a checkout or rollback path' });
  checks.push({ id: 'node-runtime', status: node.ok && node.executable === expected.nodeExecutable && node.major === expected.nodeMajor ? 'pass' : 'fail', detail: node.ok ? `Node ${node.version ?? 'unknown'} at the expected executable path` : `Node runtime rejected: ${node.reason ?? 'unknown'}` });
  checks.push({ id: 'package-identity', status: observed.package.verified && observed.package.manifest?.packageId === expected.packageId && observed.package.manifest.releaseRevision === expected.sourceRevision ? 'pass' : 'fail', detail: observed.package.verified ? 'runtime package and source revision match support expectations' : `runtime package rejected: ${observed.package.detail ?? 'unverified'}` });
  checks.push({ id: 'core-launchd-ownership', status: observed.launchd.coreLoaded ? 'pass' : 'fail', detail: observed.launchd.coreLoaded ? 'Core label is loaded by launchd' : 'Core label is not loaded by launchd' });
  checks.push({ id: 'console-launchd-ownership', status: observed.launchd.consoleLoaded ? 'pass' : 'fail', detail: observed.launchd.consoleLoaded ? 'Console label is loaded by launchd' : 'Console label is not loaded by launchd' });
  checkDescriptor(checks, 'core', observed.coreDescriptor, expected);
  checkDescriptor(checks, 'console', observed.consoleDescriptor, expected);
  checks.push({ id: 'core-process-cardinality', status: observed.processes.core === 1 ? 'pass' : 'fail', detail: `expected one Core process, observed ${observed.processes.core}` });
  checks.push({ id: 'console-process-cardinality', status: observed.processes.console === 1 ? 'pass' : 'fail', detail: `expected one Console process, observed ${observed.processes.console}` });
  checks.push({ id: 'state-store', status: observed.store.exists && observed.store.schemaVersion === BRAIN_SERVICE_STATE_STORE_SCHEMA_VERSION && observed.store.integrity === 'ok' && observed.store.foreignKeyErrors === 0 ? 'pass' : 'fail', detail: observed.store.exists && observed.store.schemaVersion === BRAIN_SERVICE_STATE_STORE_SCHEMA_VERSION && observed.store.integrity === 'ok' && observed.store.foreignKeyErrors === 0 ? 'schema 10, integrity clean, foreign keys clean' : 'StateStore is missing or failed schema/integrity/foreign-key checks' });
  const failed = checks.filter((check) => check.status === 'fail');
  return {
    schemaVersion: BRAIN_SERVICE_RESILIENCE_SCHEMA_VERSION,
    outcome: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    identity: { runtimeRoot, packageId: expected.packageId, sourceRevision: expected.sourceRevision, nodeExecutable: expected.nodeExecutable, nodeVersion: node.version ?? null, nodeResolvedExecutable: node.resolvedExecutable ?? null, stateStorePath: expected.stateStorePath },
  };
}

function readPlist(filePath: string): LaunchdDescriptor | undefined {
  try {
    const raw = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '--', filePath], { encoding: 'utf8', timeout: 5_000 })) as RawPlist;
    return normalizeLaunchdDescriptor(raw);
  } catch {
    return undefined;
  }
}

function launchdService(label: string, uid: number): { loaded: boolean; pid: number | null } {
  try {
    const output = execFileSync('/bin/launchctl', ['print', `gui/${uid}/${label}`], { encoding: 'utf8', timeout: 5_000 });
    const pid = /\n\s*pid = (\d+)\n/u.exec(output)?.[1];
    return { loaded: true, pid: pid ? Number(pid) : null };
  } catch {
    return { loaded: false, pid: null };
  }
}

function storeHealth(databasePath: string): ServiceDoctorObserved['store'] {
  if (!existsSync(databasePath)) return { exists: false, schemaVersion: 0, integrity: 'unknown', foreignKeyErrors: null };
  try {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    const schema = database.prepare("SELECT value FROM store_meta WHERE key = 'schema_version'").get() as { value?: string } | undefined;
    const integrity = database.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
    const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
    database.close();
    return { exists: true, schemaVersion: Number(schema?.value ?? 0), integrity: Object.values(integrity ?? {})[0] === 'ok' ? 'ok' : 'failed', foreignKeyErrors: foreignKeys.length };
  } catch {
    return { exists: true, schemaVersion: 0, integrity: 'failed', foreignKeyErrors: null };
  }
}

function packageFacts(runtimeRoot: string): ServiceDoctorObserved['package'] {
  const verification = verifyRuntimePackage(runtimeRoot);
  if (!verification.ok) return { verified: false, detail: verification.detail };
  try { return { verified: true, manifest: JSON.parse(readFileSync(path.join(runtimeRoot, 'manifest.json'), 'utf8')) as BrainRuntimePackage }; } catch { return { verified: false, detail: 'runtime manifest could not be read' }; }
}

export function runProductionServiceDoctor(input: { expected: ServiceDoctorExpected; coreDescriptorPath: string; consoleDescriptorPath: string; uid?: number }): ServiceDoctorResult {
  const { expected } = input;
  const coreDescriptor = readPlist(input.coreDescriptorPath);
  const consoleDescriptor = readPlist(input.consoleDescriptorPath);
  const coreService = launchdService(BRAIN_SERVICE_CORE_LABEL, input.uid ?? (process.getuid?.() ?? 0));
  const consoleService = launchdService(BRAIN_SERVICE_CONSOLE_LABEL, input.uid ?? (process.getuid?.() ?? 0));
  const observed: ServiceDoctorObserved = {
    node: inspectNodeExecutable(expected.nodeExecutable, expected.nodeMajor),
    launchd: { coreLoaded: coreService.loaded, consoleLoaded: consoleService.loaded },
    processes: { core: coreService.pid === null ? 0 : 1, console: consoleService.pid === null ? 0 : 1 },
    store: storeHealth(expected.stateStorePath),
    package: packageFacts(expected.runtimeRoot),
    ...(coreDescriptor ? { coreDescriptor } : {}),
    ...(consoleDescriptor ? { consoleDescriptor } : {}),
  };
  return evaluateServiceDoctor(expected, observed);
}
