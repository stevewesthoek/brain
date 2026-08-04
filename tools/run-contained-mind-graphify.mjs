#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BRAIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROFILE_CATALOG = path.join(BRAIN_ROOT, 'operations/specs/graphify-operational-profiles.json');
const RUNNER_PATH = fileURLToPath(import.meta.url);
const PROFILE_ID = 'graphify-mind-knowledge';
const AUTHORIZATION_ID = 'M7.1-user-request-2026-08-04';
const SHA256 = /^[a-f0-9]{64}$/;

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(stableJson(value), null, 2)}\n`, { mode: 0o600 });
}

function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function requireAbsoluteDirectory(value, label) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${label}_must_be_absolute`);
  const resolved = path.resolve(value);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label}_must_be_real_directory`);
  return resolved;
}

function git(repo, args, options = {}) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function normalizeGitPath(value) {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('unsafe_git_path');
  return normalized;
}

function excludedReason(repoPath, profile) {
  const lower = repoPath.toLowerCase();
  const segments = lower.split('/');
  const excludedSegments = new Set([
    '.git', '.obsidian', 'archive', 'archives', 'history', 'generated', 'runtime',
    'vendor', 'node_modules', 'graphify-out', '.graphify-out', 'dist', 'build', 'coverage',
  ]);
  if (segments.some((segment) => excludedSegments.has(segment))) return `excluded-segment:${segments.find((segment) => excludedSegments.has(segment))}`;
  if (segments.some((segment) => segment.startsWith('.env'))) return 'excluded-secret:.env';
  if (segments.some((segment) => /(credential|secret|backup)/i.test(segment))) return 'excluded-sensitive-marker';
  const extension = path.posix.extname(lower);
  if (!profile.corpus.includedExtensions.includes(extension)) return 'extension-not-allowlisted';
  return null;
}

function parseTree(repo, commit, profile) {
  const output = git(repo, ['ls-tree', '-r', '-z', '--long', commit], { encoding: 'buffer' });
  const entries = output.toString('utf8').split('\0').filter(Boolean).map((record) => {
    const match = record.match(/^\d+\s+blob\s+([a-f0-9]{40})\s+(\d+)\t(.+)$/s);
    if (!match) throw new Error('unexpected_git_ls_tree_record');
    return { blob: match[1], bytes: Number.parseInt(match[2], 10), path: normalizeGitPath(match[3]) };
  });
  const included = [];
  const exclusions = new Map();
  for (const entry of entries) {
    const reason = excludedReason(entry.path, profile);
    if (reason) exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1);
    else included.push(entry);
  }
  return { entries, included, exclusions: Object.fromEntries([...exclusions.entries()].sort()) };
}

function resolveExecutable(command) {
  const resolved = command.includes(path.sep)
    ? path.resolve(command)
    : execFileSync('which', [command], { encoding: 'utf8' }).trim();
  const real = fs.realpathSync(resolved);
  const stat = fs.statSync(real);
  if (!stat.isFile() || (stat.mode & 0o111) === 0) throw new Error('graphify_executable_invalid');
  return { requested: command, resolved, real };
}

function verifyGenerator(profile, graphifyBin) {
  const executable = resolveExecutable(graphifyBin ?? profile.generator.executable);
  const actualSha256 = sha256File(executable.real);
  if (actualSha256 !== profile.generator.sha256) throw new Error(`graphify_digest_mismatch:${actualSha256}`);
  const versionResult = spawnSync(executable.resolved, ['--version'], { encoding: 'utf8', timeout: 10_000 });
  if (versionResult.status !== 0) throw new Error('graphify_version_probe_failed');
  const versionText = `${versionResult.stdout ?? ''}${versionResult.stderr ?? ''}`.trim();
  if (!versionText.includes(profile.generator.version)) throw new Error(`graphify_version_mismatch:${versionText}`);
  return { ...executable, version: profile.generator.version, sha256: actualSha256, versionText };
}

function ensureOutputBoundary(outputRoot) {
  const normalized = path.resolve(outputRoot);
  if (!normalized.endsWith(path.join('runtime', 'local', 'graphify', 'mind-knowledge'))) throw new Error('output_root_outside_approved_boundary');
  let current = normalized;
  while (!fs.existsSync(current)) current = path.dirname(current);
  if (fs.lstatSync(current).isSymbolicLink()) throw new Error('output_root_ancestor_symlink');
  fs.mkdirSync(normalized, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(normalized).isSymbolicLink()) throw new Error('output_root_symlink');
  return normalized;
}

function exportCorpus(repo, commit, selected, corpusRoot, maxBytes) {
  const paths = selected.map((entry) => entry.path);
  const totalBytes = selected.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > maxBytes) throw new Error(`input_bytes_cap_exceeded:${totalBytes}`);
  const archive = spawnSync('git', ['-C', repo, 'archive', '--format=tar', commit, '--', ...paths], {
    encoding: null,
    maxBuffer: maxBytes + 8 * 1024 * 1024,
    timeout: 120_000,
  });
  if (archive.status !== 0) throw new Error(`git_archive_failed:${String(archive.stderr ?? '').trim()}`);
  fs.mkdirSync(corpusRoot, { recursive: true, mode: 0o700 });
  const extract = spawnSync('tar', ['-xf', '-', '-C', corpusRoot], {
    input: archive.stdout,
    encoding: null,
    maxBuffer: 4 * 1024 * 1024,
    timeout: 120_000,
  });
  if (extract.status !== 0) throw new Error(`tar_extract_failed:${String(extract.stderr ?? '').trim()}`);
  return totalBytes;
}

function buildSourceManifest(corpusRoot, selected) {
  return selected.map((entry) => {
    const file = path.join(corpusRoot, entry.path);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`exported_source_invalid:${entry.path}`);
    return { path: entry.path, bytes: stat.size, blob: entry.blob, sha256: sha256File(file) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function directoryBytes(root) {
  let total = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) total += directoryBytes(file);
    else if (entry.isFile()) total += fs.statSync(file).size;
  }
  return total;
}

function normalizedGraphSource(value, corpusRoot) {
  if (typeof value !== 'string' || !value) return null;
  const absoluteCorpus = `${path.resolve(corpusRoot)}${path.sep}`;
  const stripped = path.isAbsolute(value) && value.startsWith(absoluteCorpus)
    ? value.slice(absoluteCorpus.length)
    : value.replace(/^\.\//, '');
  return stripped.replace(/\\/g, '/');
}

function validateGraph(graphFile, corpusRoot, sourceManifest, caps) {
  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.links) ? graph.links : Array.isArray(graph.edges) ? graph.edges : [];
  if (nodes.length === 0) throw new Error('graph_has_no_nodes');
  if (nodes.length > caps.maxNodes) throw new Error(`node_cap_exceeded:${nodes.length}`);
  if (edges.length > caps.maxEdges) throw new Error(`edge_cap_exceeded:${edges.length}`);
  const allowed = new Set(sourceManifest.map((entry) => entry.path));
  const referenced = new Set();
  for (const item of [...nodes, ...edges]) {
    const source = normalizedGraphSource(item.source_file, corpusRoot);
    if (!source) continue;
    if (!allowed.has(source)) throw new Error(`graph_references_non_corpus_source:${source}`);
    referenced.add(source);
  }
  const markdownReferenced = [...referenced].some((source) => source.toLowerCase().endsWith('.md'));
  const scriptReferenced = [...referenced].some((source) => /\.(mjs|cjs|js|ts|tsx|sh|py)$/i.test(source));
  if (!markdownReferenced) throw new Error('graph_missing_markdown_sources');
  if (!scriptReferenced) throw new Error('graph_missing_script_sources');
  if ([...referenced].some((source) => source.toLowerCase().startsWith('.obsidian/plugins/'))) throw new Error('plugin_internal_in_graph');
  return { nodeCount: nodes.length, edgeCount: edges.length, referencedSourceCount: referenced.size, markdownReferenced, scriptReferenced };
}

function publishCurrent(outputRoot, runDir) {
  const current = path.join(outputRoot, 'current');
  if (fs.existsSync(current) && !fs.lstatSync(current).isSymbolicLink()) throw new Error('current_pointer_not_symlink');
  const temporary = path.join(outputRoot, `.current-${process.pid}`);
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  fs.symlinkSync(path.relative(outputRoot, runDir), temporary, 'dir');
  fs.renameSync(temporary, current);
}

function enforceRetention(outputRoot, maxRuns) {
  const runsRoot = path.join(outputRoot, 'runs');
  const runs = fs.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.staging-'))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const stale of runs.slice(maxRuns)) fs.rmSync(path.join(runsRoot, stale), { recursive: true, force: true });
}

export function runContainedMindGraphify(options) {
  const startedAt = new Date();
  if (options.authorizationId !== AUTHORIZATION_ID) throw new Error('one_shot_authorization_required');
  const mindRoot = requireAbsoluteDirectory(options.mindRoot, 'mind_root');
  const catalogPath = path.resolve(options.profileCatalog ?? DEFAULT_PROFILE_CATALOG);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const profile = catalog.profiles?.find((item) => item.profileId === PROFILE_ID);
  if (!profile) throw new Error('mind_graphify_profile_missing');
  const baseCaps = JSON.parse(fs.readFileSync(path.join(BRAIN_ROOT, 'operations/specs/graphify-operational-profile.json'), 'utf8')).caps;
  if (profile.currentCommitsOnly !== true || profile.corpus?.sourceState !== 'exact-commit-git-archive') throw new Error('profile_not_exact_commit_contained');
  if (!Array.isArray(profile.corpus?.includedExtensions) || profile.corpus.includedExtensions.length === 0) throw new Error('profile_extension_allowlist_missing');
  const outputRoot = ensureOutputBoundary(options.outputRoot ?? path.join(BRAIN_ROOT, profile.operationalOutputRoot));
  const sourceHeadBefore = git(mindRoot, ['rev-parse', 'HEAD']).trim();
  const brainCommit = git(BRAIN_ROOT, ['rev-parse', 'HEAD']).trim();
  const brainBranch = git(BRAIN_ROOT, ['branch', '--show-current']).trim();
  const requestedCommit = options.commit ?? sourceHeadBefore;
  if (!/^[a-f0-9]{40}$/.test(requestedCommit)) throw new Error('invalid_source_commit');
  if (requestedCommit !== sourceHeadBefore) throw new Error('requested_commit_not_current_mind_head');
  const generator = verifyGenerator(profile, options.graphifyBin);
  const tree = parseTree(mindRoot, requestedCommit, profile);
  if (tree.included.length === 0) throw new Error('empty_corpus');
  if (tree.included.length > baseCaps.maxFiles) throw new Error(`file_cap_exceeded:${tree.included.length}`);
  const pluginInternalsAtCommit = tree.entries.filter((entry) => entry.path.toLowerCase().startsWith('.obsidian/plugins/')).length;
  const includedPluginInternals = tree.included.filter((entry) => entry.path.toLowerCase().startsWith('.obsidian/plugins/')).length;
  if (includedPluginInternals !== 0) throw new Error('plugin_internals_not_excluded');
  const timestamp = startedAt.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
  const runId = `${timestamp}-${requestedCommit.slice(0, 12)}`;
  const runsRoot = path.join(outputRoot, 'runs');
  fs.mkdirSync(runsRoot, { recursive: true, mode: 0o700 });
  const staging = path.join(runsRoot, `.staging-${runId}-${process.pid}`);
  const corpusRoot = path.join(staging, 'corpus');
  const graphRoot = path.join(corpusRoot, 'graphify-out');
  let publishedRun = null;
  try {
    fs.mkdirSync(staging, { recursive: false, mode: 0o700 });
    const inputBytes = exportCorpus(mindRoot, requestedCommit, tree.included, corpusRoot, baseCaps.maxBytes);
    const sources = buildSourceManifest(corpusRoot, tree.included);
    const sourceManifest = {
      schemaVersion: '1.0.0',
      sourceRepository: 'mind',
      sourceCommit: requestedCommit,
      corpusRules: profile.corpus,
      fileCount: sources.length,
      totalBytes: inputBytes,
      files: sources,
    };
    const sourceManifestBytes = Buffer.from(`${JSON.stringify(stableJson(sourceManifest), null, 2)}\n`);
    const env = { ...process.env, GRAPHIFY_NO_TIPS: '1', GRAPHIFY_MAX_WORKERS: '4' };
    for (const name of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'MOONSHOT_API_KEY', 'DEEPSEEK_API_KEY', 'MTPLX_API_KEY']) delete env[name];
    const invocation = spawnSync(generator.resolved, ['update', corpusRoot, '--force', '--no-cluster'], {
      cwd: staging,
      env,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: baseCaps.maxRuntimeSeconds * 1000,
    });
    if (invocation.error?.code === 'ETIMEDOUT') throw new Error('graphify_runtime_cap_exceeded');
    if (invocation.status !== 0) {
      const diagnostic = [invocation.stdout, invocation.stderr].filter(Boolean).join('\n').trim();
      throw new Error(`graphify_failed:${diagnostic}`);
    }
    const graphFile = path.join(graphRoot, 'graph.json');
    if (!fs.existsSync(graphFile)) throw new Error('graphify_graph_missing');
    const graphStats = validateGraph(graphFile, corpusRoot, sources, baseCaps);
    const graphSha256 = sha256File(graphFile);
    const sourceHeadAfter = git(mindRoot, ['rev-parse', 'HEAD']).trim();
    if (sourceHeadAfter !== requestedCommit) throw new Error(`mind_head_changed_during_run:${sourceHeadAfter}`);
    const finalRoot = path.join(staging, 'snapshot');
    fs.mkdirSync(finalRoot, { mode: 0o700 });
    fs.renameSync(graphRoot, path.join(finalRoot, 'graph'));
    fs.writeFileSync(path.join(finalRoot, 'source-manifest.json'), sourceManifestBytes, { mode: 0o600 });
    const completedAt = new Date();
    const acceptance = {
      status: 'pass',
      exactMindHead: sourceHeadBefore === requestedCommit && sourceHeadAfter === requestedCommit,
      gitObjectExportOnly: true,
      includedMarkdownFiles: sources.filter((entry) => entry.path.toLowerCase().endsWith('.md')).length,
      includedMindOwnedScripts: sources.filter((entry) => /\.(mjs|cjs|js|ts|tsx|sh|py)$/i.test(entry.path)).length,
      pluginInternalsAtCommit,
      includedPluginInternals,
      pluginInternalsExcluded: pluginInternalsAtCommit > 0 && includedPluginInternals === 0,
      exclusions: tree.exclusions,
      graph: graphStats,
    };
    const receipt = {
      schemaVersion: '1.0.0',
      status: 'success',
      authorization: { id: AUTHORIZATION_ID, scope: 'one-bounded-mind-graphify-run', recurringAuthorityGranted: false },
      runner: { owner: 'brain-runtime', path: path.relative(BRAIN_ROOT, RUNNER_PATH), sha256: sha256File(RUNNER_PATH), brainCommit, brainBranch },
      profile: { id: profile.profileId, catalogVersion: catalog.catalogVersion, sha256: sha256File(catalogPath) },
      generator: { name: profile.generator.name, version: generator.version, sha256: generator.sha256, arguments: profile.generator.arguments, networkAccess: false, modelAccess: false },
      timestamps: { startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() },
      source: { repository: 'mind', commit: requestedCommit, headBefore: sourceHeadBefore, headAfter: sourceHeadAfter, exactHead: true, workingTreeRead: false },
      corpus: { sourceManifestSha256: sha256Buffer(sourceManifestBytes), fileCount: sources.length, totalBytes: inputBytes, rules: profile.corpus },
      graph: { ...graphStats, sha256: graphSha256 },
      publication: { operationalOutputRoot: outputRoot, mode: profile.publication, generatedOutputAuthority: profile.generatedOutputAuthority },
      acceptance,
    };
    writeJson(path.join(finalRoot, 'acceptance.json'), acceptance);
    writeJson(path.join(finalRoot, 'receipt.json'), receipt);
    fs.rmSync(corpusRoot, { recursive: true, force: true });
    const outputBytes = directoryBytes(finalRoot);
    if (outputBytes > baseCaps.maxOutputBytes) throw new Error(`output_bytes_cap_exceeded:${outputBytes}`);
    publishedRun = path.join(runsRoot, runId);
    fs.renameSync(finalRoot, publishedRun);
    fs.rmdirSync(staging);
    publishCurrent(outputRoot, publishedRun);
    enforceRetention(outputRoot, profile.retention.maxRuns);
    return { runId, runPath: publishedRun, currentPath: path.join(outputRoot, 'current'), receipt, acceptance, outputBytes };
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    const failureRoot = path.join(outputRoot, 'failures');
    fs.mkdirSync(failureRoot, { recursive: true, mode: 0o700 });
    writeJson(path.join(failureRoot, `${runId}.json`), {
      schemaVersion: '1.0.0', status: 'failed', authorizationId: AUTHORIZATION_ID,
      startedAt: startedAt.toISOString(), failedAt: new Date().toISOString(), sourceCommit: requestedCommit,
      reason: error instanceof Error ? error.message : String(error), writesToMind: false,
    });
    throw error;
  }
}

function main(argv = process.argv.slice(2)) {
  const result = runContainedMindGraphify({
    mindRoot: option(argv, '--mind-root'),
    outputRoot: option(argv, '--output-root'),
    commit: option(argv, '--commit'),
    graphifyBin: option(argv, '--graphify-bin'),
    profileCatalog: option(argv, '--profile-catalog'),
    authorizationId: option(argv, '--authorization-id'),
  });
  process.stdout.write(`${JSON.stringify({ status: 'success', runId: result.runId, runPath: result.runPath, currentPath: result.currentPath, receipt: result.receipt }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { AUTHORIZATION_ID, excludedReason, parseTree, validateGraph };
