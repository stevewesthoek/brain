import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION = 'brain-runtime-config-v1' as const;
export const BRAIN_RUNTIME_DEFAULT_CORE_HOST = '127.0.0.1' as const;
export const BRAIN_RUNTIME_DEFAULT_CORE_PORT = 4877 as const;
export const BRAIN_RUNTIME_DEFAULT_CONSOLE_PORT = 4881 as const;

export type BrainRuntimeProfile = 'core' | 'personal' | 'test';
export type BrainRuntimeDeploymentMode = 'local' | 'server';
export type BrainRuntimeAvailability = 'configured' | 'unavailable' | 'client-capability';

export type BrainRuntimeConfig = {
  schemaVersion: typeof BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION;
  profile: BrainRuntimeProfile;
  deploymentMode: BrainRuntimeDeploymentMode;
  stateRoot: string;
  stateStore: { kind: 'sqlite'; path: string };
  core: { bindHost: string; port: number };
  console: { coreUrl: string; port: number };
  node: { configRoot: string; runtimeDataRoot: string; temporaryRoot: string };
  optionalCapabilities: {
    voiceStt: BrainRuntimeAvailability;
    voiceTts: BrainRuntimeAvailability;
    modelBedrock: BrainRuntimeAvailability;
    nodeLocal: BrainRuntimeAvailability;
    workcells: BrainRuntimeAvailability;
  };
  providerRefs: string[];
  resourceRefs: string[];
  repositoryRoots: string[];
};

type BrainRuntimeConfigLayer = {
  schemaVersion?: typeof BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION;
  profile?: BrainRuntimeProfile | undefined;
  deploymentMode?: BrainRuntimeDeploymentMode | undefined;
  stateRoot?: string;
  stateStore?: { kind?: 'sqlite'; path?: string };
  core?: { bindHost?: string; port?: number };
  console?: { coreUrl?: string; port?: number };
  node?: { configRoot?: string; runtimeDataRoot?: string; temporaryRoot?: string };
  optionalCapabilities?: Partial<BrainRuntimeConfig['optionalCapabilities']> | undefined;
  providerRefs?: string[];
  resourceRefs?: string[];
  repositoryRoots?: string[];
};

export type BrainRuntimeConfigLoadInput = {
  env?: NodeJS.ProcessEnv;
  home?: string;
  portableProfile?: unknown;
  hostProfile?: unknown;
  portableProfilePath?: string;
  hostProfilePath?: string;
};

const MAX_PATH_LENGTH = 1_024;
const MAX_URL_LENGTH = 512;
const MAX_REFERENCE_LENGTH = 256;
const MAX_REFERENCE_COUNT = 32;
const PORT_PATTERN = /^[0-9]{1,5}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) throw new Error(`${label} contains unknown key: ${key}`);
}

function boundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || CONTROL_CHARACTER_PATTERN.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function portablePath(value: unknown, label: string, home: string): string {
  const raw = boundedString(value, label, MAX_PATH_LENGTH);
  if (raw.startsWith('~/')) return path.join(home, raw.slice(2));
  if (raw === '~') return home;
  if (raw.includes('\\')) throw new Error(`${label} must use host-native path separators`);
  if (!path.isAbsolute(raw)) throw new Error(`${label} must be absolute or home-relative`);
  const segments = raw.split(path.sep);
  if (segments.includes('..') || segments.includes('.git') || raw.startsWith('/dev/') || raw === '/dev') throw new Error(`${label} is outside the portable runtime boundary`);
  return path.normalize(raw);
}

function port(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 65_535) throw new Error(`${label} is invalid`);
  return value;
}

function url(value: unknown, label: string): string {
  const raw = boundedString(value, label, MAX_URL_LENGTH);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`${label} is invalid`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(`${label} must be an HTTP(S) URL without credentials`);
  return raw.replace(/\/$/u, '');
}

function availability(value: unknown, label: string): BrainRuntimeAvailability {
  if (value !== 'configured' && value !== 'unavailable' && value !== 'client-capability') throw new Error(`${label} is invalid`);
  return value;
}

function references(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_REFERENCE_COUNT) throw new Error(`${label} is invalid`);
  return value.map((entry, index) => boundedString(entry, `${label}[${index}]`, MAX_REFERENCE_LENGTH));
}

function repositoryRoots(value: unknown, label: string, home: string): string[] {
  if (!Array.isArray(value) || value.length > 16) throw new Error(`${label} is invalid`);
  return value.map((entry, index) => portablePath(entry, `${label}[${index}]`, home));
}

function parseLayer(value: unknown, label: string, home: string): BrainRuntimeConfigLayer {
  const input = objectRecord(value, label);
  rejectUnknownKeys(input, ['schemaVersion', 'profile', 'deploymentMode', 'stateRoot', 'stateStore', 'core', 'console', 'node', 'optionalCapabilities', 'providerRefs', 'resourceRefs', 'repositoryRoots'], label);
  if (input.schemaVersion !== undefined && input.schemaVersion !== BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION) throw new Error(`${label}.schemaVersion is unsupported`);
  if (input.profile !== undefined && !['core', 'personal', 'test'].includes(input.profile as string)) throw new Error(`${label}.profile is invalid`);
  if (input.deploymentMode !== undefined && !['local', 'server'].includes(input.deploymentMode as string)) throw new Error(`${label}.deploymentMode is invalid`);
  const stateStore = input.stateStore === undefined ? undefined : objectRecord(input.stateStore, `${label}.stateStore`);
  if (stateStore) {
    rejectUnknownKeys(stateStore, ['kind', 'path'], `${label}.stateStore`);
    if (stateStore.kind !== undefined && stateStore.kind !== 'sqlite') throw new Error(`${label}.stateStore.kind is unsupported`);
  }
  const core = input.core === undefined ? undefined : objectRecord(input.core, `${label}.core`);
  if (core) { rejectUnknownKeys(core, ['bindHost', 'port'], `${label}.core`); }
  const consoleConfig = input.console === undefined ? undefined : objectRecord(input.console, `${label}.console`);
  if (consoleConfig) { rejectUnknownKeys(consoleConfig, ['coreUrl', 'port'], `${label}.console`); }
  const node = input.node === undefined ? undefined : objectRecord(input.node, `${label}.node`);
  if (node) { rejectUnknownKeys(node, ['configRoot', 'runtimeDataRoot', 'temporaryRoot'], `${label}.node`); }
  const capabilities = input.optionalCapabilities === undefined ? undefined : objectRecord(input.optionalCapabilities, `${label}.optionalCapabilities`);
  if (capabilities) { rejectUnknownKeys(capabilities, ['voiceStt', 'voiceTts', 'modelBedrock', 'nodeLocal', 'workcells'], `${label}.optionalCapabilities`); }
  return {
    ...(input.schemaVersion === undefined ? {} : { schemaVersion: input.schemaVersion as typeof BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION }),
    ...(input.profile === undefined ? {} : { profile: input.profile as BrainRuntimeProfile }),
    ...(input.deploymentMode === undefined ? {} : { deploymentMode: input.deploymentMode as BrainRuntimeDeploymentMode }),
    ...(input.stateRoot === undefined ? {} : { stateRoot: portablePath(input.stateRoot, `${label}.stateRoot`, home) }),
    ...(stateStore === undefined ? {} : { stateStore: { ...(stateStore.kind === undefined ? {} : { kind: 'sqlite' as const }), ...(stateStore.path === undefined ? {} : { path: portablePath(stateStore.path, `${label}.stateStore.path`, home) }) } }),
    ...(core === undefined ? {} : { core: { ...(core.bindHost === undefined ? {} : { bindHost: boundedString(core.bindHost, `${label}.core.bindHost`, 255) }), ...(core.port === undefined ? {} : { port: port(core.port, `${label}.core.port`) }) } }),
    ...(consoleConfig === undefined ? {} : { console: { ...(consoleConfig.coreUrl === undefined ? {} : { coreUrl: url(consoleConfig.coreUrl, `${label}.console.coreUrl`) }), ...(consoleConfig.port === undefined ? {} : { port: port(consoleConfig.port, `${label}.console.port`) }) } }),
    ...(node === undefined ? {} : { node: { ...(node.configRoot === undefined ? {} : { configRoot: portablePath(node.configRoot, `${label}.node.configRoot`, home) }), ...(node.runtimeDataRoot === undefined ? {} : { runtimeDataRoot: portablePath(node.runtimeDataRoot, `${label}.node.runtimeDataRoot`, home) }), ...(node.temporaryRoot === undefined ? {} : { temporaryRoot: portablePath(node.temporaryRoot, `${label}.node.temporaryRoot`, home) }) } }),
    ...(capabilities === undefined ? {} : { optionalCapabilities: Object.fromEntries(Object.entries(capabilities).map(([key, entry]) => [key, availability(entry, `${label}.optionalCapabilities.${key}`)])) as BrainRuntimeConfigLayer['optionalCapabilities'] }),
    ...(input.providerRefs === undefined ? {} : { providerRefs: references(input.providerRefs, `${label}.providerRefs`) }),
    ...(input.resourceRefs === undefined ? {} : { resourceRefs: references(input.resourceRefs, `${label}.resourceRefs`) }),
    ...(input.repositoryRoots === undefined ? {} : { repositoryRoots: repositoryRoots(input.repositoryRoots, `${label}.repositoryRoots`, home) }),
  };
}

function mergeLayers(...layers: BrainRuntimeConfigLayer[]): BrainRuntimeConfigLayer {
  const result: BrainRuntimeConfigLayer = {};
  for (const layer of layers) {
    const stateStore = result.stateStore;
    const core = result.core;
    const consoleConfig = result.console;
    const node = result.node;
    const capabilities = result.optionalCapabilities;
    Object.assign(result, layer);
    if (layer.stateStore) result.stateStore = { ...stateStore, ...layer.stateStore };
    if (layer.core) result.core = { ...core, ...layer.core };
    if (layer.console) result.console = { ...consoleConfig, ...layer.console };
    if (layer.node) result.node = { ...node, ...layer.node };
    if (layer.optionalCapabilities) result.optionalCapabilities = { ...capabilities, ...layer.optionalCapabilities };
  }
  return result;
}

function readLayer(filePath: string, label: string, home: string): BrainRuntimeConfigLayer {
  const resolved = portablePath(filePath, label, home);
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(resolved, 'utf8')) as unknown; } catch (error) { throw new Error(`${label} could not be read: ${error instanceof Error ? error.message : String(error)}`); }
  return parseLayer(parsed, label, home);
}

function envLayer(env: NodeJS.ProcessEnv, home: string): BrainRuntimeConfigLayer {
  const layer: BrainRuntimeConfigLayer = {};
  const profile = env.BRAIN_RUNTIME_PROFILE;
  if (profile !== undefined) layer.profile = parseLayer({ profile }, 'environment', home).profile;
  const deploymentMode = env.BRAIN_RUNTIME_DEPLOYMENT_MODE;
  if (deploymentMode !== undefined) layer.deploymentMode = parseLayer({ deploymentMode }, 'environment', home).deploymentMode;
  const stateRoot = env.BRAIN_RUNTIME_STATE_ROOT;
  if (stateRoot !== undefined) layer.stateRoot = portablePath(stateRoot, 'environment.stateRoot', home);
  else if (env.BRAIN_AGENT_MODE_STATE_DIR !== undefined) {
    const legacyStateDir = portablePath(env.BRAIN_AGENT_MODE_STATE_DIR, 'environment.BRAIN_AGENT_MODE_STATE_DIR', home);
    layer.stateStore = { kind: 'sqlite', path: path.join(legacyStateDir, 'agent-mode.db') };
  }
  const sqlitePath = env.BRAIN_RUNTIME_SQLITE_PATH;
  if (sqlitePath !== undefined) layer.stateStore = { kind: 'sqlite', path: portablePath(sqlitePath, 'environment.stateStore.path', home) };
  const bindHost = env.BRAIN_RUNTIME_CORE_HOST ?? env.BRAIN_CORE_HOST;
  const rawPort = env.BRAIN_RUNTIME_CORE_PORT ?? env.BRAIN_CORE_PORT;
  if (bindHost !== undefined || rawPort !== undefined) layer.core = { ...(bindHost === undefined ? {} : { bindHost: boundedString(bindHost, 'environment.core.bindHost', 255) }), ...(rawPort === undefined ? {} : { port: rawPort && PORT_PATTERN.test(rawPort) ? port(Number(rawPort), 'environment.core.port') : (() => { throw new Error('environment.core.port is invalid'); })() }) };
  const consoleCoreUrl = env.BRAIN_RUNTIME_CONSOLE_CORE_URL;
  const consolePort = env.BRAIN_RUNTIME_CONSOLE_PORT;
  if (consoleCoreUrl !== undefined || consolePort !== undefined) layer.console = { ...(consoleCoreUrl === undefined ? {} : { coreUrl: url(consoleCoreUrl, 'environment.console.coreUrl') }), ...(consolePort === undefined ? {} : { port: consolePort && PORT_PATTERN.test(consolePort) ? port(Number(consolePort), 'environment.console.port') : (() => { throw new Error('environment.console.port is invalid'); })() }) };
  const nodeConfigRoot = env.BRAIN_RUNTIME_NODE_CONFIG_ROOT;
  const runtimeDataRoot = env.BRAIN_RUNTIME_DATA_ROOT;
  const temporaryRoot = env.BRAIN_RUNTIME_TEMP_ROOT;
  if (nodeConfigRoot !== undefined || runtimeDataRoot !== undefined || temporaryRoot !== undefined) layer.node = { ...(nodeConfigRoot === undefined ? {} : { configRoot: portablePath(nodeConfigRoot, 'environment.node.configRoot', home) }), ...(runtimeDataRoot === undefined ? {} : { runtimeDataRoot: portablePath(runtimeDataRoot, 'environment.node.runtimeDataRoot', home) }), ...(temporaryRoot === undefined ? {} : { temporaryRoot: portablePath(temporaryRoot, 'environment.node.temporaryRoot', home) }) };
  return layer;
}

function defaults(home: string): BrainRuntimeConfig {
  const stateRoot = path.join(home, '.local', 'brain');
  return {
    schemaVersion: BRAIN_RUNTIME_CONFIG_SCHEMA_VERSION,
    profile: 'core',
    deploymentMode: 'local',
    stateRoot,
    stateStore: { kind: 'sqlite', path: path.join(stateRoot, 'agent-mode', 'agent-mode.db') },
    core: { bindHost: BRAIN_RUNTIME_DEFAULT_CORE_HOST, port: BRAIN_RUNTIME_DEFAULT_CORE_PORT },
    console: { coreUrl: `http://${BRAIN_RUNTIME_DEFAULT_CORE_HOST}:${BRAIN_RUNTIME_DEFAULT_CORE_PORT}`, port: BRAIN_RUNTIME_DEFAULT_CONSOLE_PORT },
    node: { configRoot: path.join(stateRoot, 'node'), runtimeDataRoot: path.join(stateRoot, 'runtime'), temporaryRoot: path.join(stateRoot, 'tmp') },
    optionalCapabilities: { voiceStt: 'unavailable', voiceTts: 'client-capability', modelBedrock: 'unavailable', nodeLocal: 'unavailable', workcells: 'unavailable' },
    providerRefs: [],
    resourceRefs: [],
    repositoryRoots: [],
  };
}

export function loadBrainRuntimeConfig(input: BrainRuntimeConfigLoadInput = {}): BrainRuntimeConfig {
  const env = input.env ?? process.env;
  const home = portablePath(input.home ?? env.HOME ?? os.homedir(), 'home', input.home ?? env.HOME ?? os.homedir());
  const portableProfilePath = input.portableProfilePath ?? env.BRAIN_RUNTIME_PROFILE_PATH ?? env.BRAIN_RUNTIME_CONFIG_PATH;
  const hostProfilePath = input.hostProfilePath ?? env.BRAIN_RUNTIME_HOST_PROFILE_PATH;
  const portable = portableProfilePath ? readLayer(portableProfilePath, 'portable profile', home) : input.portableProfile === undefined ? {} : parseLayer(input.portableProfile, 'portable profile', home);
  const host = hostProfilePath ? readLayer(hostProfilePath, 'host profile', home) : input.hostProfile === undefined ? {} : parseLayer(input.hostProfile, 'host profile', home);
  const effective = mergeLayers(portable, host, envLayer(env, home));
  const base = defaults(home);
  const stateRoot = effective.stateRoot ?? base.stateRoot;
  const derivedBase = {
    ...base,
    stateRoot,
    stateStore: { ...base.stateStore, path: path.join(stateRoot, 'agent-mode', 'agent-mode.db') },
    node: { configRoot: path.join(stateRoot, 'node'), runtimeDataRoot: path.join(stateRoot, 'runtime'), temporaryRoot: path.join(stateRoot, 'tmp') },
  };
  const merged = {
    ...derivedBase,
    ...effective,
    stateStore: { ...derivedBase.stateStore, ...(effective.stateStore ?? {}) },
    core: { ...derivedBase.core, ...(effective.core ?? {}) },
    console: { ...derivedBase.console, ...(effective.console ?? {}) },
    node: { ...derivedBase.node, ...(effective.node ?? {}) },
    optionalCapabilities: { ...derivedBase.optionalCapabilities, ...(effective.optionalCapabilities ?? {}) },
    providerRefs: effective.providerRefs ?? derivedBase.providerRefs,
    resourceRefs: effective.resourceRefs ?? derivedBase.resourceRefs,
    repositoryRoots: effective.repositoryRoots ?? derivedBase.repositoryRoots,
  } as BrainRuntimeConfig;
  if (merged.stateStore.kind !== 'sqlite') throw new Error('unsupported StateStore kind');
  if (merged.stateStore.path.includes(path.join('.git', ''))) throw new Error('stateStore.path cannot be inside .git');
  return merged;
}

export function safeBrainRuntimeConfigView(config: BrainRuntimeConfig): Omit<BrainRuntimeConfig, 'stateStore'> & { stateStore: { kind: 'sqlite'; path: string } } {
  return JSON.parse(JSON.stringify(config)) as Omit<BrainRuntimeConfig, 'stateStore'> & { stateStore: { kind: 'sqlite'; path: string } };
}
