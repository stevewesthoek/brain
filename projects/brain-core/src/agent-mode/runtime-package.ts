import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const BRAIN_RUNTIME_PACKAGE_SCHEMA_VERSION = 'brain-runtime-package-v1' as const;
export const BRAIN_RUNTIME_PACKAGE_MAX_FILES = 20_000;
export const BRAIN_RUNTIME_PACKAGE_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const BRAIN_RUNTIME_PACKAGE_MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export type RuntimePackagePlatform = 'darwin' | 'linux' | 'unsupported';
export type RuntimePackageArchitecture = 'arm64' | 'x64' | 'unsupported';
export type RuntimePackageComponent = 'brain-core' | 'brain-console' | 'brain-core-support' | 'runtime-config-template';
export type RuntimePackageDependencyStrategy = 'npm-production-hydration' | 'standalone-traced' | 'none';

export type RuntimePackageFile = {
  relativePath: string;
  component: RuntimePackageComponent;
  sha256: string;
  size: number;
  contentClass: 'runtime-entry' | 'runtime-metadata' | 'runtime-dependency-metadata' | 'static-asset' | 'config-template';
};

export type BrainRuntimePackage = {
  schemaVersion: typeof BRAIN_RUNTIME_PACKAGE_SCHEMA_VERSION;
  packageId: string;
  releaseRevision: string;
  platformClass: RuntimePackagePlatform;
  architectureClass: RuntimePackageArchitecture;
  nodeRange: '>=22.5.0';
  npmRange: '>=10.0.0';
  components: Array<{ id: RuntimePackageComponent; dependencyStrategy: RuntimePackageDependencyStrategy; required: boolean }>;
  files: RuntimePackageFile[];
  startup: {
    core: { executable: 'node'; args: ['core', 'dist', 'index.js']; cwd: '.' };
    console: { executable: 'node'; args: ['console', 'standalone', 'server.js']; cwd: '.' };
  };
  configContract: 'brain-runtime-config-v1';
  requiredExternalSecrets: ['BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET', 'BRAIN_CONSOLE_OPERATOR_ID', 'BRAIN_CONSOLE_OPERATOR_SECRET'];
  optionalCapabilities: ['brain-node', 'voice-stt', 'browser-tts', 'bedrock'];
  manifestHash: string;
};

export type RuntimePackageInput = {
  sourceRoot: string;
  outputRoot: string;
  releaseRevision: string;
  requireCleanSource?: boolean;
  platform?: string;
  architecture?: string;
};

export type RuntimePackageVerification = {
  ok: true;
  packageId: string;
  manifestHash: string;
  fileCount: number;
  totalBytes: number;
} | {
  ok: false;
  reason: 'invalid-manifest' | 'unsafe-path' | 'unexpected-file' | 'missing-file' | 'hash-mismatch' | 'size-mismatch' | 'bounds-exceeded' | 'forbidden-content' | 'unsupported-runtime';
  detail: string;
};

const MAX_PATH_LENGTH = 512;
const PACKAGE_ROOT_SEGMENTS = new Set(['.git', 'cache', 'logs', 'coverage', 'tmp']);
const FORBIDDEN_FILE_PATTERN = /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|db|sqlite|sqlite3|log|tmp|bak))$/u;
const PERSONAL_PATH_PATTERN = /\/Users\/(?:Office|Steve)(?:\/|$)/iu;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function absolutePath(value: string, label: string): string {
  if (!path.isAbsolute(value) || value.length > MAX_PATH_LENGTH || value.includes('\\') || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} is unsafe`);
  const normalized = path.normalize(value);
  if (normalized === '/' || normalized.includes('/.git/') || normalized.includes('/node_modules/')) throw new Error(`${label} is unsafe`);
  return normalized;
}

export type RuntimeSourceProvenance = { revision: string; tree: string; dirty: boolean };

export function assertCleanSourceProvenance(sourceRoot: string, expectedRevision: string): RuntimeSourceProvenance {
  const root = absolutePath(sourceRoot, 'sourceRoot');
  const git = (args: string[]): string => execFileSync('git', ['-C', root, ...args], { cwd: '/', encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let revision: string;
  let tree: string;
  let status: string;
  try {
    revision = git(['rev-parse', '--verify', 'HEAD']);
    tree = git(['rev-parse', '--verify', 'HEAD^{tree}']);
    status = git(['status', '--porcelain', '--untracked-files=all']);
  } catch {
    throw new Error('sourceRoot must be a Git worktree for a verified release package');
  }
  if (!/^[0-9a-f]{40}$/u.test(revision) || !/^[0-9a-f]{40}$/u.test(tree)) throw new Error('Git source provenance is malformed');
  if (revision !== expectedRevision) throw new Error('source revision does not match Git HEAD');
  if (status.length > 0) throw new Error('source tree must be clean for a verified release package');
  return { revision, tree, dirty: false };
}

function relativePath(value: string): string {
  const normalized = value.split(path.sep).join('/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\') || normalized.length > MAX_PATH_LENGTH || normalized.split('/').some((part) => PACKAGE_ROOT_SEGMENTS.has(part)) || FORBIDDEN_FILE_PATTERN.test(normalized) || PERSONAL_PATH_PATTERN.test(normalized)) throw new Error(`unsafe package path: ${value}`);
  return normalized;
}

function packageBytes(sourceFile: string, sourceRoot: string): Buffer {
  const data = readFileSync(sourceFile);
  const text = data.toString();
  if (text.includes('\uFFFD')) return data as unknown as Buffer;
  const sanitized = text.replaceAll(sourceRoot, '/brain-package-root').replaceAll('/Users/Office', '/brain-package-root').replaceAll('/Users/Steve', '/brain-package-root');
  if (sanitized === text) return data as unknown as Buffer;
  return (Buffer as unknown as { from(value: string): Buffer }).from(sanitized);
}

function platform(value: string | undefined): RuntimePackagePlatform {
  return value === 'darwin' || value === 'linux' ? value : 'unsupported';
}

function architecture(value: string | undefined): RuntimePackageArchitecture {
  return value === 'arm64' || value === 'x64' ? value : 'unsupported';
}

function walkFiles(root: string, prefix = ''): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (lstatSync(absolute).isSymbolicLink()) throw new Error(`symlink is not permitted: ${relative}`);
    if (entry.isDirectory()) results.push(...walkFiles(absolute, relative));
    else if (entry.isFile()) results.push(absolute);
    else throw new Error(`unsupported package filesystem entry: ${relative}`);
  }
  return results;
}

function ensureFreshOutput(root: string): { root: string; created: boolean } {
  const normalized = absolutePath(root, 'outputRoot');
  if (!existsSync(normalized)) {
    mkdirSync(normalized, { recursive: true });
    return { root: normalized, created: true };
  }
  throw new Error('outputRoot must be a fresh nonexistent directory');
}

function copyTree(sourceRoot: string, outputRoot: string, component: RuntimePackageComponent, contentClass: RuntimePackageFile['contentClass'], files: RuntimePackageFile[], packagePrefix = '', include: (relative: string) => boolean = () => true, contentSourceRoot = sourceRoot): void {
  const sourceFiles = walkFiles(sourceRoot);
  for (const sourceFile of sourceFiles) {
    const sourceRelative = path.relative(sourceRoot, sourceFile);
    if (!include(sourceRelative)) continue;
    const relative = relativePath(packagePrefix ? `${packagePrefix}/${sourceRelative}` : sourceRelative);
    const destination = path.join(outputRoot, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(sourceFile, destination);
    const data = packageBytes(destination, contentSourceRoot);
    writeFileSync(destination, data);
    chmodSync(destination, 0o644);
    const stat = statSync(destination);
    if (stat.size > BRAIN_RUNTIME_PACKAGE_MAX_FILE_BYTES) throw new Error(`package file exceeds size bound: ${relative}`);
    files.push({ relativePath: relative, component, sha256: sha256(data), size: stat.size, contentClass });
  }
}

function copyFile(sourceFile: string, destination: string, relative: string, component: RuntimePackageComponent, contentClass: RuntimePackageFile['contentClass'], files: RuntimePackageFile[], sourceRoot: string): void {
  if (lstatSync(sourceFile).isSymbolicLink()) throw new Error(`symlink is not permitted: ${relative}`);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(sourceFile, destination);
  const data = packageBytes(destination, sourceRoot);
  writeFileSync(destination, data);
  chmodSync(destination, 0o644);
  const stat = statSync(destination);
  if (stat.size > BRAIN_RUNTIME_PACKAGE_MAX_FILE_BYTES) throw new Error(`package file exceeds size bound: ${relative}`);
  files.push({ relativePath: relative, component, sha256: sha256(data), size: stat.size, contentClass });
}

function copyCoreSupport(sourceRoot: string, outputRoot: string, files: RuntimePackageFile[]): boolean {
  const supportFiles = [
    ['tools/mind-canonical-path-registry.mjs', 'tools/mind-canonical-path-registry.mjs'],
    ['tools/infrastructure-catalog/governance-core.mjs', 'tools/infrastructure-catalog/governance-core.mjs'],
    ['tools/context-learning/context-learning-core.mjs', 'tools/context-learning/context-learning-core.mjs'],
    ['operations/specs/infinite-brain-boundary-contracts.js', 'operations/specs/infinite-brain-boundary-contracts.js'],
    ['operations/specs/infinite-brain-path-registry.json', 'operations/specs/infinite-brain-path-registry.json'],
  ] as const;
  if (!supportFiles.every(([source]) => existsSync(path.join(sourceRoot, source)))) return false;
  for (const [source, relative] of supportFiles) copyFile(path.join(sourceRoot, source), path.join(outputRoot, relative), relative, 'brain-core-support', relative.endsWith('.json') ? 'runtime-metadata' : 'runtime-entry', files, sourceRoot);
  return true;
}

function rewritePackagedCoreImports(outputRoot: string, files: RuntimePackageFile[]): void {
  const rewrites = new Map<string, Array<[string, string]>>([
    ['core/dist/canonical-mind-path-registry.js', [["../../../tools/mind-canonical-path-registry.mjs", "../../tools/mind-canonical-path-registry.mjs"]]],
    ['core/dist/mind-paths.js', [["../../../operations/specs/infinite-brain-boundary-contracts.js", "../../operations/specs/infinite-brain-boundary-contracts.js"]]],
    ['core/dist/contracts/mind-contract.js', [["../../../../operations/specs/infinite-brain-boundary-contracts.js", "../../../operations/specs/infinite-brain-boundary-contracts.js"]]],
    ['core/dist/adapters/infinite-brain-exact-scope-approval.js', [["../../../../operations/specs/infinite-brain-boundary-contracts.js", "../../../operations/specs/infinite-brain-boundary-contracts.js"]]],
    ['core/dist/adapters/infrastructure-action-safety.mjs', [["../../../../tools/infrastructure-catalog/governance-core.mjs", "../../../tools/infrastructure-catalog/governance-core.mjs"]]],
    ['core/dist/adapters/infrastructure-plane.mjs', [["../../../../tools/infrastructure-catalog/governance-core.mjs", "../../../tools/infrastructure-catalog/governance-core.mjs"]]],
  ]);
  for (const [relative, replacements] of rewrites) {
    const file = files.find((candidate) => candidate.relativePath === relative);
    if (!file) continue;
    const target = path.join(outputRoot, relative);
    const before = readFileSync(target, 'utf8');
    const after = replacements.reduce((value, [from, to]) => value.replaceAll(from, to), before);
    if (after === before) continue;
    writeFileSync(target, after);
    file.sha256 = sha256(Buffer.from(after));
    file.size = Buffer.byteLength(after, 'utf8');
  }
}

function manifestForIdentity(manifest: BrainRuntimePackage): Record<string, unknown> {
  const { packageId: _packageId, manifestHash: _manifestHash, ...identity } = manifest;
  return identity;
}

function manifestHash(manifest: BrainRuntimePackage): string {
  return sha256(canonicalJson({ ...manifest, manifestHash: null }));
}

function packageId(manifest: BrainRuntimePackage): string {
  return `brain-runtime-package:sha256:${sha256(canonicalJson(manifestForIdentity(manifest)))}`;
}

function requiredArtifacts(sourceRoot: string): { core: string; console: string; staticAssets: string | null; publicAssets: string | null } {
  const core = path.join(sourceRoot, 'projects', 'brain-core');
  const consoleRoot = path.join(sourceRoot, 'projects', 'brain-console');
  const standaloneBase = path.join(consoleRoot, '.next', 'standalone');
  const nestedConsole = path.join(standaloneBase, 'projects', 'brain-console');
  const console = existsSync(path.join(nestedConsole, 'server.js')) ? nestedConsole : standaloneBase;
  if (!existsSync(path.join(core, 'dist', 'index.js')) || !existsSync(path.join(core, 'package.json')) || !existsSync(path.join(core, 'package-lock.json'))) throw new Error('Core build artifacts are incomplete');
  if (!existsSync(path.join(console, 'server.js'))) throw new Error('Console standalone build artifact is missing');
  return { core, console, staticAssets: existsSync(path.join(consoleRoot, '.next', 'static')) ? path.join(consoleRoot, '.next', 'static') : null, publicAssets: existsSync(path.join(consoleRoot, 'public')) ? path.join(consoleRoot, 'public') : null };
}

export function buildRuntimePackage(input: RuntimePackageInput): BrainRuntimePackage {
  const sourceRoot = absolutePath(input.sourceRoot, 'sourceRoot');
  if (!input.releaseRevision || /[\u0000-\u001f\u007f]/u.test(input.releaseRevision)) throw new Error('releaseRevision is required and bounded');
  if (input.requireCleanSource) assertCleanSourceProvenance(sourceRoot, input.releaseRevision);
  const output = ensureFreshOutput(input.outputRoot);
  try {
    const artifacts = requiredArtifacts(sourceRoot);
    const files: RuntimePackageFile[] = [];
    copyTree(path.join(artifacts.core, 'dist'), output.root, 'brain-core', 'runtime-entry', files, 'core/dist', (relative) => (relative.endsWith('.js') || relative.endsWith('.mjs')) && !relative.startsWith('tests/'), sourceRoot);
    const hasCoreSupport = copyCoreSupport(sourceRoot, output.root, files);
    rewritePackagedCoreImports(output.root, files);
    copyFile(path.join(artifacts.core, 'package.json'), path.join(output.root, 'core', 'package.json'), 'core/package.json', 'brain-core', 'runtime-metadata', files, sourceRoot);
    copyFile(path.join(artifacts.core, 'package-lock.json'), path.join(output.root, 'core', 'package-lock.json'), 'core/package-lock.json', 'brain-core', 'runtime-dependency-metadata', files, sourceRoot);
    copyTree(artifacts.console, output.root, 'brain-console', 'runtime-entry', files, 'console/standalone', (relative) => relative !== '.next/trace', sourceRoot);
    if (artifacts.staticAssets) copyTree(artifacts.staticAssets, output.root, 'brain-console', 'static-asset', files, 'console/static', () => true, sourceRoot);
    if (artifacts.publicAssets) copyTree(artifacts.publicAssets, output.root, 'brain-console', 'static-asset', files, 'console/public', () => true, sourceRoot);
    const configPath = path.join(output.root, 'config', 'brain-runtime-config.example.json');
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify({ schemaVersion: 'brain-runtime-config-v1', profile: 'core', deploymentMode: 'server', stateRoot: '~/state', stateStore: { kind: 'sqlite', path: '~/state/agent-mode/agent-mode.db' }, core: { bindHost: '127.0.0.1', port: 4877 }, console: { coreUrl: 'http://127.0.0.1:4877', port: 4881 }, optionalCapabilities: { voiceStt: 'unavailable', voiceTts: 'client-capability', modelBedrock: 'unavailable', nodeLocal: 'unavailable', workcells: 'unavailable' }, providerRefs: [], resourceRefs: [] }, null, 2)}\n`);
    const configStat = statSync(configPath);
    files.push({ relativePath: 'config/brain-runtime-config.example.json', component: 'runtime-config-template', sha256: sha256(readFileSync(configPath)), size: configStat.size, contentClass: 'config-template' });
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (files.length > BRAIN_RUNTIME_PACKAGE_MAX_FILES) throw new Error('package file count exceeds bound');
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > BRAIN_RUNTIME_PACKAGE_MAX_TOTAL_BYTES) throw new Error('package total size exceeds bound');
    const manifest: BrainRuntimePackage = {
      schemaVersion: BRAIN_RUNTIME_PACKAGE_SCHEMA_VERSION,
      packageId: '', releaseRevision: input.releaseRevision, platformClass: platform(input.platform), architectureClass: architecture(input.architecture),
      nodeRange: '>=22.5.0', npmRange: '>=10.0.0',
      components: [
        { id: 'brain-core', dependencyStrategy: 'npm-production-hydration', required: true },
        { id: 'brain-console', dependencyStrategy: 'standalone-traced', required: true },
        { id: 'runtime-config-template', dependencyStrategy: 'none', required: true },
        ...(hasCoreSupport ? [{ id: 'brain-core-support' as const, dependencyStrategy: 'none' as const, required: true }] : []),
      ], files,
      startup: { core: { executable: 'node', args: ['core', 'dist', 'index.js'], cwd: '.' }, console: { executable: 'node', args: ['console', 'standalone', 'server.js'], cwd: '.' } },
      configContract: 'brain-runtime-config-v1', requiredExternalSecrets: ['BRAIN_CORE_SERVICE_ID', 'BRAIN_CORE_SERVICE_SECRET', 'BRAIN_CONSOLE_OPERATOR_ID', 'BRAIN_CONSOLE_OPERATOR_SECRET'], optionalCapabilities: ['brain-node', 'voice-stt', 'browser-tts', 'bedrock'], manifestHash: '',
    };
    manifest.packageId = packageId(manifest);
    manifest.manifestHash = manifestHash(manifest);
    writeFileSync(path.join(output.root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } catch (error) {
    if (output.created) rmSync(output.root, { recursive: true, force: true });
    throw error;
  }
}

function packageFiles(root: string): string[] {
  return walkFiles(root).map((file) => relativePath(path.relative(root, file))).sort((a, b) => a.localeCompare(b));
}

export function verifyRuntimePackage(packageRoot: string): RuntimePackageVerification {
  let root: string;
  try { root = absolutePath(packageRoot, 'packageRoot'); } catch (error) { return { ok: false, reason: 'unsafe-path', detail: error instanceof Error ? error.message : String(error) }; }
  try {
    const manifestPath = path.join(root, 'manifest.json');
    if (!existsSync(manifestPath)) return { ok: false, reason: 'invalid-manifest', detail: 'manifest.json is missing' };
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BrainRuntimePackage;
    if (manifest.schemaVersion !== BRAIN_RUNTIME_PACKAGE_SCHEMA_VERSION || !Array.isArray(manifest.files) || manifest.files.length > BRAIN_RUNTIME_PACKAGE_MAX_FILES) return { ok: false, reason: 'invalid-manifest', detail: 'unsupported or malformed manifest' };
    if (manifest.nodeRange !== '>=22.5.0' || manifest.npmRange !== '>=10.0.0' || manifest.configContract !== 'brain-runtime-config-v1') return { ok: false, reason: 'unsupported-runtime', detail: 'runtime contract mismatch' };
    if (manifest.platformClass === 'unsupported' || manifest.architectureClass === 'unsupported') return { ok: false, reason: 'unsupported-runtime', detail: 'unsupported package platform or architecture' };
    if (manifest.manifestHash !== manifestHash(manifest) || manifest.packageId !== packageId(manifest)) return { ok: false, reason: 'hash-mismatch', detail: 'manifest identity or hash mismatch' };
    const listed = new Set<string>();
    let totalBytes = 0;
    for (const file of manifest.files) {
      const relative = relativePath(file.relativePath);
      if (listed.has(relative)) return { ok: false, reason: 'invalid-manifest', detail: `duplicate manifest path: ${relative}` };
      listed.add(relative);
      const absolute = path.join(root, relative);
      if (!existsSync(absolute)) return { ok: false, reason: 'missing-file', detail: relative };
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) return { ok: false, reason: 'forbidden-content', detail: `symlink: ${relative}` };
      if (!stat.isFile()) return { ok: false, reason: 'invalid-manifest', detail: `not a file: ${relative}` };
      if ((stat.mode & 0o022) !== 0) return { ok: false, reason: 'forbidden-content', detail: `writable by group/other: ${relative}` };
      if (stat.size !== file.size) return { ok: false, reason: 'size-mismatch', detail: relative };
      if (stat.size > BRAIN_RUNTIME_PACKAGE_MAX_FILE_BYTES) return { ok: false, reason: 'bounds-exceeded', detail: relative };
      if (sha256(readFileSync(absolute)) !== file.sha256) return { ok: false, reason: 'hash-mismatch', detail: relative };
      if (PERSONAL_PATH_PATTERN.test(readFileSync(absolute, 'utf8'))) return { ok: false, reason: 'forbidden-content', detail: `personal path content: ${relative}` };
      totalBytes += stat.size;
    }
    const actual = packageFiles(root).filter((file) => file !== 'manifest.json');
    if (actual.length !== listed.size || actual.some((file) => !listed.has(file))) return { ok: false, reason: 'unexpected-file', detail: 'package file set differs from manifest' };
    if (totalBytes > BRAIN_RUNTIME_PACKAGE_MAX_TOTAL_BYTES) return { ok: false, reason: 'bounds-exceeded', detail: 'package total size exceeds bound' };
    for (const required of ['core/dist/index.js', 'core/package.json', 'core/package-lock.json', 'console/standalone/server.js', 'config/brain-runtime-config.example.json']) if (!listed.has(required)) return { ok: false, reason: 'missing-file', detail: required };
    return { ok: true, packageId: manifest.packageId, manifestHash: manifest.manifestHash, fileCount: manifest.files.length, totalBytes };
  } catch (error) { return { ok: false, reason: 'invalid-manifest', detail: error instanceof Error ? error.message : String(error) }; }
}
