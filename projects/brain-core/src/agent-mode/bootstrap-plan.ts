import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { BrainRuntimeConfig } from './portable-runtime-config.js';

export const BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION = 'brain-bootstrap-plan-v1' as const;
export const BRAIN_BOOTSTRAP_NODE_RANGE = '>=22.5.0' as const;
export const BRAIN_BOOTSTRAP_NPM_RANGE = '>=10.0.0' as const;

export type BootstrapPlatform = 'darwin' | 'linux' | 'unsupported';
export type BootstrapArchitecture = 'arm64' | 'x64' | 'unsupported';
export type BootstrapMode = 'source-development' | 'packaged-release';
export type BootstrapCheckStatus = 'ready' | 'missing' | 'unsupported' | 'invalid' | 'optional-unavailable';
export type BootstrapInstallationState = 'fresh' | 'existing-compatible' | 'existing-unknown' | 'conflict';
export type BootstrapActionKind = 'verify-file' | 'run-package-command' | 'smoke-check';

export type BootstrapPrerequisite = {
  id: string;
  status: BootstrapCheckStatus;
  detail: string;
};

export type BootstrapAction =
  | { kind: 'verify-file'; component: 'brain-core' | 'brain-console'; path: string }
  | { kind: 'run-package-command'; component: 'brain-core' | 'brain-console'; executable: 'npm'; args: ['ci'] | ['run', 'build']; cwd: string }
  | { kind: 'smoke-check'; component: 'brain-core' | 'brain-console'; check: 'config-validate' | 'core-api' | 'console-core-reachability' };

export type BootstrapComponent = {
  id: 'brain-core' | 'brain-console' | 'brain-node' | 'voice-stt' | 'browser-tts' | 'bedrock' | 'personal-integrations';
  status: 'required' | 'optional' | 'excluded' | 'client-capability';
  sourcePath?: string;
  installPath?: string;
  packageManager?: 'npm';
};

export type BrainBootstrapPlan = {
  schemaVersion: typeof BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION;
  planId: string;
  mode: BootstrapMode;
  platform: { os: BootstrapPlatform; architecture: BootstrapArchitecture };
  runtime: { nodeRange: typeof BRAIN_BOOTSTRAP_NODE_RANGE; npmRange: typeof BRAIN_BOOTSTRAP_NPM_RANGE; observedNode: string; observedNpm: string | null };
  source: { root: string; revision: string | null; provenance: 'git' | 'release-manifest' | 'unresolved' };
  layout: { installationRoot: string; stateRoot: string; sqlitePath: string; profilePath: string | null; hostProfilePath: string | null };
  installation: { state: BootstrapInstallationState; overwrite: false };
  components: BootstrapComponent[];
  prerequisites: BootstrapPrerequisite[];
  actions: BootstrapAction[];
  startup: {
    core: { executable: 'node'; args: ['dist/index.js']; cwd: string };
    console: { executable: 'npm'; args: ['run', 'start']; cwd: string };
    brainNode: { status: 'optional-not-installed'; command: null };
  };
  servicePlan: { status: 'not-installed'; registration: false; start: false };
  smokeChecks: string[];
  rollback: { mode: 'none-for-dry-run'; stagingRoot: null; action: 'no-op' };
  warnings: string[];
};

export type BootstrapPlanInput = {
  sourceRoot: string;
  installationRoot: string;
  runtimeConfig: BrainRuntimeConfig;
  mode?: BootstrapMode;
  sourceRevision?: string | null;
  profilePath?: string | null;
  hostProfilePath?: string | null;
  platform?: string;
  architecture?: string;
  nodeVersion?: string;
  npmVersion?: string | null;
  npmAvailable?: boolean;
  serviceAuthConfigured?: boolean;
  operatorAuthConfigured?: boolean;
};

const MAX_PLAN_STEPS = 32;
const MAX_WARNING_COUNT = 32;
const MAX_PATH_LENGTH = 1_024;
const PERSONAL_PATH_PATTERN = /\/Users\/(?:Office|Steve)(?:\/|$)/u;
const PROTECTED_ROOTS = new Set(['/bin', '/sbin', '/usr', '/System', '/Library', '/etc']);

function boundedPath(value: string, label: string): string {
  if (!path.isAbsolute(value) || value.length === 0 || value.length > MAX_PATH_LENGTH || value.includes('\\') || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} must be an absolute host-neutral path`);
  const normalized = path.normalize(value);
  const segments = normalized.split(path.sep);
  if (segments.includes('..') || segments.includes('.git') || segments.includes('node_modules') || normalized === '/dev' || normalized.startsWith('/dev/')) throw new Error(`${label} is unsafe`);
  return normalized;
}

function safeInstallationPath(value: string): string {
  const normalized = boundedPath(value, 'installationRoot');
  if (PROTECTED_ROOTS.has(normalized) || [...PROTECTED_ROOTS].some((root) => isWithin(normalized, root))) throw new Error('installationRoot is unsafe');
  return normalized;
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function inspectDirectory(root: string, label: string): BootstrapPrerequisite {
  if (!existsSync(root)) {
    const parent = path.dirname(root);
    if (!existsSync(parent)) return { id: label, status: 'missing', detail: `${root} and its parent do not exist` };
    try { accessSync(parent, constants.W_OK); } catch { return { id: label, status: 'invalid', detail: `${root} parent is not writable` }; }
    return { id: label, status: 'ready', detail: `${root} may be created by a future explicit staging executor` };
  }
  try {
    const stat = statSync(root);
    if (!stat.isDirectory()) return { id: label, status: 'invalid', detail: `${root} is not a directory` };
    accessSync(root, constants.R_OK | constants.W_OK);
  } catch { return { id: label, status: 'invalid', detail: `${root} is not readable and writable` }; }
  return { id: label, status: 'ready', detail: `${root} is accessible` };
}

function installationState(installationRoot: string, sourceRoot: string, mode: BootstrapMode): BootstrapInstallationState {
  if (installationRoot === sourceRoot && mode !== 'source-development') return 'conflict';
  if (!existsSync(installationRoot)) return 'fresh';
  let entries: string[];
  try { entries = readdirSync(installationRoot, { withFileTypes: true }).map((entry) => entry.name); } catch { return 'existing-unknown'; }
  if (entries.length === 0) return 'fresh';
  const compatible = entries.includes('projects') || entries.includes('dist') || entries.includes('package.json');
  return compatible ? 'existing-compatible' : 'existing-unknown';
}

function semver(value: string | null | undefined): [number, number, number] | undefined {
  if (!value) return undefined;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function atLeast(value: string | null | undefined, minimum: [number, number, number]): boolean {
  const parsed = semver(value);
  return parsed !== undefined && parsed[0] > minimum[0] || parsed !== undefined && parsed[0] === minimum[0] && (parsed[1] > minimum[1] || parsed[1] === minimum[1] && parsed[2] >= minimum[2]);
}

function observedNpmVersion(): string | null {
  try { return execFileSync('npm', ['--version'], { encoding: 'utf8', timeout: 2_000, maxBuffer: 128 }).trim(); } catch { return null; }
}

function sourceRevision(sourceRoot: string, supplied: string | null | undefined): { revision: string | null; provenance: 'git' | 'release-manifest' | 'unresolved' } {
  if (supplied) return { revision: supplied, provenance: 'release-manifest' };
  try {
    const revision = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 2_000, maxBuffer: 256 }).trim();
    return revision ? { revision, provenance: 'git' } : { revision: null, provenance: 'unresolved' };
  } catch { return { revision: null, provenance: 'unresolved' }; }
}

function hashMaterial(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function inspectBootstrapPrerequisites(input: BootstrapPlanInput): BootstrapPrerequisite[] {
  const platform = input.platform ?? process.platform;
  const architecture = input.architecture ?? process.arch;
  const nodeVersion = input.nodeVersion ?? process.versions.node;
  const npmVersion = input.npmVersion === undefined ? observedNpmVersion() : input.npmVersion;
  const sourceRoot = boundedPath(input.sourceRoot, 'sourceRoot');
  const installRoot = safeInstallationPath(input.installationRoot);
  const stateRoot = boundedPath(input.runtimeConfig.stateRoot, 'stateRoot');
  const checks: BootstrapPrerequisite[] = [
    { id: 'platform', status: platform === 'darwin' || platform === 'linux' ? 'ready' : 'unsupported', detail: platform },
    { id: 'architecture', status: architecture === 'arm64' || architecture === 'x64' ? 'ready' : 'unsupported', detail: architecture },
    { id: 'node', status: atLeast(nodeVersion, [22, 5, 0]) ? 'ready' : 'unsupported', detail: `${nodeVersion}; requires ${BRAIN_BOOTSTRAP_NODE_RANGE}` },
    { id: 'npm', status: input.npmAvailable === false || npmVersion === null ? 'missing' : atLeast(npmVersion, [10, 0, 0]) ? 'ready' : 'unsupported', detail: `${npmVersion ?? 'unavailable'}; requires ${BRAIN_BOOTSTRAP_NPM_RANGE}` },
    { id: 'source-root', status: existsSync(sourceRoot) ? 'ready' : 'missing', detail: sourceRoot },
    { id: 'brain-core-manifests', status: existsSync(path.join(sourceRoot, 'projects', 'brain-core', 'package.json')) && existsSync(path.join(sourceRoot, 'projects', 'brain-core', 'package-lock.json')) ? 'ready' : 'missing', detail: 'Core package.json and package-lock.json' },
    { id: 'brain-console-manifests', status: existsSync(path.join(sourceRoot, 'projects', 'brain-console', 'package.json')) && existsSync(path.join(sourceRoot, 'projects', 'brain-console', 'package-lock.json')) ? 'ready' : 'missing', detail: 'Console package.json and package-lock.json' },
    inspectDirectory(installRoot, 'installation-root'),
    inspectDirectory(stateRoot, 'state-root'),
    { id: 'state-layout', status: isWithin(stateRoot, sourceRoot) || isWithin(stateRoot, installRoot) ? 'invalid' : 'ready', detail: 'mutable state is separate from source/install roots' },
    { id: 'service-auth', status: input.serviceAuthConfigured ? 'ready' : 'missing', detail: 'required external Brain service secret name; value is never inspected or printed' },
    { id: 'operator-auth', status: input.operatorAuthConfigured ? 'ready' : 'missing', detail: 'required external Console operator secret name; value is never inspected or printed' },
    { id: 'voice-stt', status: input.runtimeConfig.optionalCapabilities.voiceStt === 'configured' ? 'ready' : 'optional-unavailable', detail: input.runtimeConfig.optionalCapabilities.voiceStt },
    { id: 'browser-tts', status: input.runtimeConfig.optionalCapabilities.voiceTts === 'client-capability' ? 'ready' : 'optional-unavailable', detail: input.runtimeConfig.optionalCapabilities.voiceTts },
  ];
  return checks;
}

function componentManifest(sourceRoot: string, installationRoot: string, config: BrainRuntimeConfig): BootstrapComponent[] {
  const component = (id: BootstrapComponent['id'], status: BootstrapComponent['status'], sourcePath?: string): BootstrapComponent => ({ id, status, ...(sourcePath ? { sourcePath, installPath: sourcePath.replace(sourceRoot, installationRoot) } : {}), ...(id === 'brain-core' || id === 'brain-console' ? { packageManager: 'npm' as const } : {}) });
  return [
    component('brain-core', 'required', path.join(sourceRoot, 'projects', 'brain-core')),
    component('brain-console', 'required', path.join(sourceRoot, 'projects', 'brain-console')),
    component('brain-node', config.optionalCapabilities.nodeLocal === 'configured' ? 'optional' : 'optional'),
    component('voice-stt', config.optionalCapabilities.voiceStt === 'configured' ? 'optional' : 'optional'),
    component('browser-tts', 'client-capability'),
    component('bedrock', config.optionalCapabilities.modelBedrock === 'configured' ? 'optional' : 'optional'),
    component('personal-integrations', 'excluded'),
  ];
}

export function createBrainBootstrapPlan(input: BootstrapPlanInput): BrainBootstrapPlan {
  const mode = input.mode ?? 'source-development';
  if (mode !== 'source-development' && mode !== 'packaged-release') throw new Error('bootstrap mode is unsupported');
  const sourceRoot = boundedPath(input.sourceRoot, 'sourceRoot');
  const installationRoot = safeInstallationPath(input.installationRoot);
  const stateRoot = boundedPath(input.runtimeConfig.stateRoot, 'stateRoot');
  if (isWithin(stateRoot, sourceRoot) || isWithin(stateRoot, installationRoot)) throw new Error('stateRoot must be separate from sourceRoot and installationRoot');
  const installation = installationState(installationRoot, sourceRoot, mode);
  if (installation === 'conflict') throw new Error('installationRoot conflicts with sourceRoot for packaged mode');
  const provenance = sourceRevision(sourceRoot, input.sourceRevision);
  const prerequisites = inspectBootstrapPrerequisites(input);
  const coreRoot = path.join(installationRoot, 'projects', 'brain-core');
  const consoleRoot = path.join(installationRoot, 'projects', 'brain-console');
  const actions: BootstrapAction[] = [
    { kind: 'verify-file', component: 'brain-core', path: path.join(sourceRoot, 'projects', 'brain-core', 'package-lock.json') },
    { kind: 'verify-file', component: 'brain-console', path: path.join(sourceRoot, 'projects', 'brain-console', 'package-lock.json') },
    { kind: 'run-package-command', component: 'brain-core', executable: 'npm', args: ['ci'], cwd: coreRoot },
    { kind: 'run-package-command', component: 'brain-core', executable: 'npm', args: ['run', 'build'], cwd: coreRoot },
    { kind: 'run-package-command', component: 'brain-console', executable: 'npm', args: ['ci'], cwd: consoleRoot },
    { kind: 'run-package-command', component: 'brain-console', executable: 'npm', args: ['run', 'build'], cwd: consoleRoot },
    { kind: 'smoke-check', component: 'brain-core', check: 'config-validate' },
    { kind: 'smoke-check', component: 'brain-core', check: 'core-api' },
    { kind: 'smoke-check', component: 'brain-console', check: 'console-core-reachability' },
  ];
  if (actions.length > MAX_PLAN_STEPS) throw new Error('bootstrap plan exceeds step bound');
  const warnings = [
    ...(installation === 'existing-compatible' ? ['installation root already contains a compatible-looking installation; D0-B never overwrites it'] : []),
    ...(installation === 'existing-unknown' ? ['installation root is not a fresh target; explicit staging/install executor must refuse overwrite'] : []),
    ...(provenance.provenance === 'unresolved' ? ['source revision is unavailable; provide a release manifest revision for packaged mode'] : []),
    ...(input.serviceAuthConfigured ? [] : ['Brain service auth remains an external required secret']),
    ...(input.operatorAuthConfigured ? [] : ['Console operator auth remains an external required secret']),
    'dry-run only: package commands, services, network, and runtime effects are not executed',
  ];
  if (warnings.length > MAX_WARNING_COUNT) throw new Error('bootstrap plan exceeds warning bound');
  const requestedPlatform = input.platform ?? process.platform;
  const requestedArchitecture = input.architecture ?? process.arch;
  const platform: BootstrapPlatform = requestedPlatform === 'darwin' || requestedPlatform === 'linux' ? requestedPlatform : 'unsupported';
  const architecture: BootstrapArchitecture = requestedArchitecture === 'arm64' || requestedArchitecture === 'x64' ? requestedArchitecture : 'unsupported';
  const startup = { core: { executable: 'node' as const, args: ['dist/index.js'] as ['dist/index.js'], cwd: coreRoot }, console: { executable: 'npm' as const, args: ['run', 'start'] as ['run', 'start'], cwd: consoleRoot } };
  const servicePlan = { status: 'not-installed' as const, registration: false as const, start: false as const };
  const planMaterial = {
    schemaVersion: BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION,
    mode,
    platform: { os: platform, architecture },
    runtime: { nodeRange: BRAIN_BOOTSTRAP_NODE_RANGE, npmRange: BRAIN_BOOTSTRAP_NPM_RANGE },
    source: { root: sourceRoot, revision: provenance.revision, provenance: provenance.provenance },
    layout: { installationRoot, stateRoot, sqlitePath: input.runtimeConfig.stateStore.path, profilePath: input.profilePath ?? null, hostProfilePath: input.hostProfilePath ?? null },
    components: componentManifest(sourceRoot, installationRoot, input.runtimeConfig),
    actions,
    startup,
    servicePlan,
  };
  return {
    schemaVersion: BRAIN_BOOTSTRAP_PLAN_SCHEMA_VERSION,
    planId: `brain-bootstrap-plan:sha256:${hashMaterial(planMaterial)}`,
    mode,
    platform: planMaterial.platform,
    runtime: { ...planMaterial.runtime, observedNode: input.nodeVersion ?? process.versions.node, observedNpm: input.npmVersion === undefined ? observedNpmVersion() : input.npmVersion },
    source: planMaterial.source,
    layout: planMaterial.layout,
    installation: { state: installation, overwrite: false },
    components: planMaterial.components,
    prerequisites,
    actions,
    startup: { ...startup, brainNode: { status: 'optional-not-installed' as const, command: null } },
    servicePlan,
    smokeChecks: ['brain-agent config validate', 'Brain Core local API responds', 'Console reaches configured Brain Core'],
    rollback: { mode: 'none-for-dry-run', stagingRoot: null, action: 'no-op' },
    warnings,
  };
}

export function bootstrapPlanJson(plan: BrainBootstrapPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}
