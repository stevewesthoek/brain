#!/usr/bin/env node
/**
 * B8.1 Contract V2 disposable provider evaluator and rehearsal runner.
 *
 * This tool never writes a canonical run directory. It exports pinned Git trees
 * into a caller-selected diagnostic directory, uses fresh CBM state for every
 * repetition, disables persistence/auto-watch, and runs under the fixed V2
 * sandbox profile. Graphify is neither loaded nor invoked.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runChildWithTimeMetrics } from './lib/b8-1-process-metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');
const PROFILE = path.join(ROOT, 'operations/specs/b8-1-v2-network-isolation.sb');
const PROBE = path.join(ROOT, 'tools/lib/b8-1-v2-isolation-probe.mjs');
const STRUCTURAL_LABELS = ['Function', 'Method', 'Route'];

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function mkdir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); }
function isStrictDescendant(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
function rel(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort(); }
function dirBytes(root) {
  let total = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    }
  }
  if (fs.existsSync(root)) walk(root);
  return total;
}
function freeMemoryPercent() {
  if (process.platform === 'darwin') {
    try {
      const output = execFileSync('/usr/bin/memory_pressure', ['-Q'], { encoding: 'utf8' });
      const match = output.match(/System-wide memory free percentage:\s*([0-9.]+)%/);
      if (match) return Number(match[1]);
    } catch {}
  }
  return os.freemem() / os.totalmem() * 100;
}
function providerProcesses(binary) {
  try {
    return execFileSync('/bin/ps', ['-axo', 'pid=,rss=,%cpu=,command='], { encoding: 'utf8' }).split('\n').map(line => line.trim()).filter(Boolean).flatMap(line => {
      const match = line.match(/^(\d+)\s+(\d+)\s+([0-9.]+)\s+(.+)$/); if (!match) return [];
      const command = match[4];
      return command === binary || command.startsWith(`${binary} `)
        ? [{ pid: Number(match[1]), rssMiB: Number(match[2]) / 1024, cpuPercent: Number(match[3]), command }]
        : [];
    }).filter(item => item.pid !== process.pid);
  } catch {
    return [{ pid: -1, rssMiB: Number.POSITIVE_INFINITY, cpuPercent: Number.POSITIVE_INFINITY, command: 'process-inspection-failed' }];
  }
}
function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}
function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { minimum: sorted[0] ?? null, median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), maximum: sorted.at(-1) ?? null };
}
function groupBy(values, keyFn) {
  const groups = {};
  for (const value of values) (groups[keyFn(value)] ??= []).push(value);
  return groups;
}
export function setScore(expected, predicted, matcher = (a, b) => a === b) {
  const truth = uniq(expected); const guess = uniq(predicted);
  const matchedGuessForTruth = Array(truth.length).fill(-1);
  function augment(guessIndex, seenTruth) {
    for (let truthIndex = 0; truthIndex < truth.length; truthIndex += 1) {
      if (seenTruth.has(truthIndex) || !matcher(guess[guessIndex], truth[truthIndex])) continue;
      seenTruth.add(truthIndex);
      if (matchedGuessForTruth[truthIndex] === -1 || augment(matchedGuessForTruth[truthIndex], seenTruth)) {
        matchedGuessForTruth[truthIndex] = guessIndex;
        return true;
      }
    }
    return false;
  }
  let tp = 0;
  for (let guessIndex = 0; guessIndex < guess.length; guessIndex += 1) if (augment(guessIndex, new Set())) tp += 1;
  const precision = guess.length ? tp / guess.length : (truth.length ? 0 : 1);
  const recall = truth.length ? tp / truth.length : (guess.length ? 0 : 1);
  return { expected: truth, predicted: guess, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
}
function calleeMatch(predicted, expected) {
  return predicted === expected || predicted.endsWith(`.${expected}`) || expected.endsWith(`.${predicted}`);
}
function parseToolJson(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      const structured = parsed?.structuredContent ?? parsed;
      if (typeof structured?.text === 'string' && structured.text.startsWith('rows:')) {
        const tableLines = structured.text.trim().split('\n');
        const columns = tableLines[0].match(/\(cols: (.+)\)$/)?.[1]?.split(/\s+/) ?? [];
        const tableRows = tableLines.slice(1, -1).filter(line => line.startsWith('  ')).map(line => {
          const tokens = line.trim().match(/"(?:[^"\\]|\\.)*"|\S+/g) ?? [];
          return tokens.map(token => token.startsWith('"') ? JSON.parse(token) : token);
        });
        return { columns, rows: tableRows };
      }
      return structured;
    } catch {}
  }
  throw new Error('provider output contained no JSON value');
}
function rows(value) {
  const columns = value?.columns ?? value?.cols;
  if (!Array.isArray(columns) || !Array.isArray(value?.rows)) return [];
  return value.rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}
function searchResults(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (!Array.isArray(value?.columns ?? value?.cols) || !Array.isArray(value?.rows)) throw new Error('provider search output used an unrecognized result contract');
  return rows(value).map(row => {
    const [startLine, endLine] = String(row.lines ?? '').split('-').map(Number);
    return { ...row, start_line: startLine, end_line: endLine, match_lines: row.matches ?? [], source: row.source?.source ?? row.source ?? '' };
  });
}
function importBindingInfo(source) {
  const bindings = new Set(); const platform = new Set();
  for (const match of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm)) {
    const clause = match[1].replace(/^type\s+/, ''); const specifier = match[2];
    for (const token of clause.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
      if (!['type', 'as'].includes(token)) { bindings.add(token); if (specifier.startsWith('node:')) platform.add(token); }
    }
  }
  return { bindings, platform };
}
function resolveRepoRoot(manifest, repository) {
  return path.resolve(path.dirname(MANIFEST_PATH), repository.localPath);
}
function exportPinnedTree(manifest, repository, destination) {
  mkdir(destination);
  const source = resolveRepoRoot(manifest, repository);
  const archive = spawnSync('git', ['-C', source, 'archive', '--format=tar', repository.pinnedCommit], { encoding: null, maxBuffer: 1024 ** 3 });
  if (archive.status !== 0) throw new Error(`git archive failed for ${repository.repositoryId}: ${archive.stderr?.toString()}`);
  const extract = spawnSync('/usr/bin/tar', ['-xf', '-', '-C', destination], { input: archive.stdout, encoding: null, maxBuffer: 1024 ** 3 });
  if (extract.status !== 0) throw new Error(`tar extract failed for ${repository.repositoryId}: ${extract.stderr?.toString()}`);
  for (const symlink of repository.excludedSymlinkPaths ?? []) {
    const target = path.join(destination, symlink);
    try { if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target); } catch {}
  }
}
function eligibleFiles(root, policy) {
  const extensions = new Set(policy.eligibleExtensions);
  const excluded = new Set(policy.excludedDirectoryNames);
  const result = [];
  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, relative);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) result.push(relative);
    }
  }
  walk(root);
  return result.sort();
}
async function runProvider(binary, argv, state, timeout = 60000) {
  const ipcRoot = `/private/tmp/cbm-daemon-${process.getuid()}`;
  mkdir(ipcRoot);
  const ipcStat = fs.lstatSync(ipcRoot);
  if (!ipcStat.isDirectory() || ipcStat.isSymbolicLink() || ipcStat.uid !== process.getuid()) throw new Error('CBM IPC root failed ownership/type validation');
  fs.chmodSync(ipcRoot, 0o700);
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: state.home, TMPDIR: state.tmp,
    XDG_CACHE_HOME: state.cache, XDG_CONFIG_HOME: state.config, CBM_CACHE_DIR: state.cache,
  };
  return runChildWithTimeMetrics({
    executable: '/usr/bin/sandbox-exec',
    argv: ['-D', `CBM_IPC_ROOT=${ipcRoot}`, '-f', PROFILE, binary, ...argv],
    cwd: state.cache, env, timeout, detached: true,
  });
}
async function tool(binary, name, args, state, timeout) {
  const result = await runProvider(binary, ['cli', '--json', name, ...args], state, timeout);
  if (!result.success) throw new Error(`${name} failed: exit=${result.exitCode} ${result.stderr}`);
  return { value: parseToolJson(result.stdout), measurement: result };
}
async function query(binary, project, statement, state) {
  const result = await tool(binary, 'query_graph', ['--query', statement, '--project', project, '--max-rows', '100000'], state, 30000);
  return rows(result.value);
}
async function nodeSource(binary, project, label, file, symbol, state) {
  const matches = await query(binary, project,
    `MATCH (n:${label}) WHERE n.file_path = '${rel(file)}'${symbol ? ` AND n.name = '${symbol}'` : ''} RETURN n.qualified_name AS qualified_name`, state);
  const qualifiedName = matches[0]?.qualified_name;
  if (!qualifiedName) return null;
  const snippet = await tool(binary, 'get_code_snippet', ['--qualified-name', qualifiedName, '--project', project], state, 30000);
  return snippet.value?.source ?? snippet.value?.text ?? null;
}
export async function isolationProof() {
  const ipcRoot = `/private/tmp/cbm-daemon-${process.getuid()}`; mkdir(ipcRoot);
  const ipcStat = fs.lstatSync(ipcRoot);
  if (!ipcStat.isDirectory() || ipcStat.isSymbolicLink() || ipcStat.uid !== process.getuid()) throw new Error('CBM IPC root failed ownership/type validation');
  fs.chmodSync(ipcRoot, 0o700);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'b81-v2-outside-'));
  const allowedPath = path.join(ipcRoot, `selftest-${process.pid}.sock`);
  const deniedPath = path.join(outside, 'outside.sock');
  const tcp4 = net.createServer(); await new Promise((resolve, reject) => tcp4.listen(0, '127.0.0.1', resolve).once('error', reject));
  const tcp6 = net.createServer(); await new Promise((resolve, reject) => tcp6.listen(0, '::1', resolve).once('error', reject));
  const unixAllowed = net.createServer(); await new Promise((resolve, reject) => unixAllowed.listen(allowedPath, resolve).once('error', reject));
  const unixDenied = net.createServer(); await new Promise((resolve, reject) => unixDenied.listen(deniedPath, resolve).once('error', reject));
  const base = ['-D', `CBM_IPC_ROOT=${ipcRoot}`, '-f', PROFILE, process.execPath, PROBE];
  const cases = [
    ['deny-ipv4-loopback-connect', ['ipv4', '-', String(tcp4.address().port)], 1],
    ['deny-ipv6-loopback-connect', ['ipv6', '-', String(tcp6.address().port)], 1],
    ['allow-declared-unix-socket-connect', ['unix', allowedPath, '0'], 0],
    ['deny-outside-unix-socket-connect', ['unix', deniedPath, '0'], 1],
  ].map(([name, args, expectedExit]) => {
    const result = spawnSync('/usr/bin/sandbox-exec', [...base, ...args], { encoding: 'utf8', timeout: 5000 });
    const lines = result.stdout.trim().split('\n');
    let outcome = null;
    try { outcome = JSON.parse(lines.at(-1)); } catch {}
    const expectedResult = expectedExit === 0 ? 'connected' : 'denied-permission';
    const passed = result.status === expectedExit
      && lines[0] === 'B8_1_V2_ISOLATION_PROBE_STARTED'
      && outcome?.kind === args[0]
      && outcome?.result === expectedResult
      && outcome?.exitCode === expectedExit;
    return { name, expectedExit, actualExit: result.status, expectedResult, actualResult: outcome?.result ?? null, started: lines[0] === 'B8_1_V2_ISOLATION_PROBE_STARTED', passed };
  });
  for (const server of [tcp4, tcp6, unixAllowed, unixDenied]) await new Promise(resolve => server.close(resolve));
  for (const socketPath of [allowedPath, deniedPath]) { try { fs.unlinkSync(socketPath); } catch {} }
  fs.rmdirSync(outside);
  return {
    passed: cases.length === 4 && cases.every(item => item.passed), allowedUnixSocketRoot: ipcRoot,
    allowedUnixSocketRootValidation: { ownerUid: ipcStat.uid, mode: '0700', directory: true, symlink: false },
    profileSha256: sha256File(PROFILE), helperSha256: sha256File(PROBE), adapterPath: '/usr/bin/sandbox-exec',
    adapterSha256: sha256File('/usr/bin/sandbox-exec'), runtimePath: fs.realpathSync(process.execPath),
    runtimeVersion: process.version, runtimeSha256: sha256File(fs.realpathSync(process.execPath)), selfTests: cases,
  };
}
function exactSourceFiles(root, policy) {
  const excluded = new Set(policy.excludedDirectoryNames); const files = [];
  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name; const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, relative); else if (entry.isFile()) files.push(relative);
    }
  }
  walk(root); return files.sort();
}
function verifyExactSource(fixture, sourceRoot, coveragePolicy) {
  const verification = fixture.verification;
  const allFiles = exactSourceFiles(sourceRoot, coveragePolicy);
  const candidates = verification.algorithm === 'file-name-count'
    ? allFiles.filter(file => path.posix.basename(file) === verification.fileName)
    : allFiles.filter(file => {
      try { return fs.readFileSync(path.join(sourceRoot, file), 'utf8').includes(fixture.retrievalPattern); }
      catch { return false; }
    });
  const located = verification.algorithm === 'file-name-count' || candidates.includes(rel(fixture.expectedFile));
  let contentVerified = false;
  if (verification.algorithm === 'line-contains' || verification.algorithm === 'symbol-at-line') {
    const lines = fs.readFileSync(path.join(sourceRoot, verification.path), 'utf8').split(/\r?\n/);
    contentVerified = verification.contains.every(value => lines[verification.line - 1]?.includes(value));
  }
  else if (verification.algorithm === 'json-pointer-set') {
    let value = JSON.parse(fs.readFileSync(path.join(sourceRoot, verification.path), 'utf8'));
    for (const segment of verification.jsonPointer.split('/').slice(1)) value = value[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
    const actual = value.map(item => verification.itemProperty ? item[verification.itemProperty] : item).sort();
    contentVerified = JSON.stringify(actual) === JSON.stringify([...verification.expected].sort());
  }
  else if (verification.algorithm === 'file-name-count') contentVerified = candidates.length === verification.expectedCount;
  return { passed: located && contentVerified, located, contentVerified, candidates };
}
function jsonPointerSetFromSource(source, verification) {
  let value;
  try { value = JSON.parse(source); }
  catch { value = JSON.parse(`{${source}}`); }
  for (const segment of verification.jsonPointer.split('/').slice(1)) value = value[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
  if (!Array.isArray(value)) throw new Error('JSON pointer did not resolve to an array');
  return value.map(item => verification.itemProperty ? item[verification.itemProperty] : item).sort();
}
async function structuralPrediction(binary, project, fixture, state) {
  if (!fixture.callerCalleeApplicable) return null;
  const targetFile = rel(fixture.expectedFile);
  const symbol = fixture.expectedSymbol;
  let callers = [];
  if (fixture.structuralTruth.callerRelation === 'import-consumers') {
    const result = await query(binary, project,
      `MATCH (source:Module)-[r:IMPORTS]->(target:Module) WHERE target.file_path = '${targetFile}' RETURN source.file_path AS source_file, r.local_name AS local_name`, state);
    callers = result.filter(row => !symbol || row.local_name === symbol).map(row => rel(row.source_file));
    if (callers.length === 0) {
      const found = await tool(binary, 'search_code', ['--pattern', symbol, '--project', project, '--mode', 'full', '--limit', '100'], state, 30000);
      for (const file of uniq(searchResults(found.value).map(item => rel(item.file))).filter(file => file !== targetFile)) {
        const source = await nodeSource(binary, project, 'Module', file, null, state);
        if (!source) continue;
        const symbolPattern = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const directImport = [...source.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm)].some(match => symbolPattern.test(match[0].slice(0, match[0].lastIndexOf('from'))));
        if (directImport) callers.push(file);
      }
    }
  } else {
    for (const label of STRUCTURAL_LABELS) {
      const result = await query(binary, project,
        `MATCH (source:Module)-[r:CALLS]->(target:${label}) WHERE target.file_path = '${targetFile}' AND target.name = '${symbol}' RETURN source.file_path AS source_file`, state);
      callers.push(...result.map(row => rel(row.source_file)));
    }
  }
  let callees = [];
  if (fixture.structuralTruth.calleeRelation === 'body-code-targets') {
    for (const sourceLabel of STRUCTURAL_LABELS) {
      const result = await query(binary, project,
        `MATCH (source:${sourceLabel})-[r:CALLS]->(target) WHERE source.file_path = '${targetFile}' AND source.name = '${symbol}' RETURN target.name AS target_name, r.callee AS callee`, state);
      callees.push(...result.map(row => row.callee || row.target_name));
    }
    const moduleSource = await nodeSource(binary, project, 'Module', targetFile, null, state);
    let bodySource = null;
    for (const sourceLabel of STRUCTURAL_LABELS) bodySource ??= await nodeSource(binary, project, sourceLabel, targetFile, symbol, state);
    if (moduleSource && bodySource) {
      const imports = importBindingInfo(moduleSource);
      const isLocalDefinition = name => new RegExp(`(?:function|class)\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(moduleSource);
      callees = [];
      for (const match of bodySource.matchAll(/<([A-Z][A-Za-z0-9_$.]*)\b/g)) {
        const candidate = match[1]; const root = candidate.split('.')[0];
        if (root !== symbol && ((imports.bindings.has(root) && !imports.platform.has(root)) || isLocalDefinition(root))) callees.push(candidate);
      }
      for (const match of bodySource.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)\s*\(/g)) {
        const candidate = match[1]; const root = candidate.split('.')[0];
        if (root !== symbol && ((imports.bindings.has(root) && !imports.platform.has(root)) || isLocalDefinition(root))) callees.push(candidate);
      }
    }
  } else if (fixture.structuralTruth.calleeRelation === 'initializer-dependencies') {
    for (const relation of ['USAGE', 'CALLS', 'IMPORTS']) {
      for (const targetLabel of ['Variable', 'Function', 'Class', 'Module']) {
        const result = await query(binary, project,
          `MATCH (source:Variable)-[r:${relation}]->(target:${targetLabel}) WHERE source.file_path = '${targetFile}' AND source.name = '${symbol}' RETURN target.name AS target_name, r.callee AS callee`, state);
        callees.push(...result.map(row => row.callee || row.target_name));
      }
    }
    if (callees.length === 0) {
      const source = await nodeSource(binary, project, 'Variable', targetFile, symbol, state);
      if (source) {
        const moduleSource = await nodeSource(binary, project, 'Module', targetFile, null, state);
        const imports = importBindingInfo(moduleSource ?? '').bindings;
        const constructors = [...source.matchAll(/\bnew\s+([A-Z][A-Za-z0-9_$]*)/g)].map(match => match[1]);
        const constants = [...source.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)].map(match => match[1]);
        callees.push(...constructors, ...constants.filter(name => name !== symbol && imports.has(name)));
      }
    }
  }
  return {
    caller: setScore(fixture.expectedCallers ?? [], callers.map(rel)),
    callee: setScore(fixture.expectedCallees ?? [], callees, calleeMatch),
  };
}
async function fixtureResult(binary, project, fixture, sourceRoot, indexedSet, inventoryRows, state, retrievalPolicy, coveragePolicy) {
  const exactSource = verifyExactSource(fixture, sourceRoot, coveragePolicy);
  const targetIndexed = fixture.expectedFile ? indexedSet.has(rel(fixture.expectedFile)) : true;
  let fileCorrect = false; let lineCorrect = null; let setAccuracy = null; let literalCorrect = null; let targetRank = null; let retrievedFiles = [];
  if (fixture.verification.algorithm === 'file-name-count') {
    const actual = inventoryRows.filter(row => path.posix.basename(rel(row.file_path)) === fixture.verification.fileName).length;
    fileCorrect = actual === fixture.verification.expectedCount; setAccuracy = fileCorrect ? 1 : 0;
  } else {
    const found = await tool(binary, 'search_code', ['--pattern', fixture.retrievalPattern, '--project', project, '--mode', 'full', '--limit', String(retrievalPolicy.maximumCandidates)], state, 30000);
    const results = searchResults(found.value).slice(0, retrievalPolicy.maximumCandidates);
    retrievedFiles = [...new Set(results.map(result => rel(result.file ?? result.file_path)).filter(Boolean))];
    const sameFile = results.filter(result => rel(result.file ?? result.file_path) === rel(fixture.expectedFile));
    const targetIndex = results.findIndex(result => rel(result.file ?? result.file_path) === rel(fixture.expectedFile));
    targetRank = targetIndex >= 0 ? targetIndex + 1 : null;
    fileCorrect = sameFile.length > 0;
    if (fixture.verification.algorithm === 'json-pointer-set') {
      const sources = sameFile.map(match => match.source ?? match.text).filter(source => typeof source === 'string');
      for (const match of sameFile.filter(item => item.qualified_name)) {
        const snippet = await tool(binary, 'get_code_snippet', ['--qualified-name', match.qualified_name, '--project', project], state, 30000);
        const source = snippet.value?.source ?? snippet.value?.text;
        if (typeof source === 'string') sources.push(source);
      }
      setAccuracy = 0;
      for (const source of uniq(sources)) {
        try { setAccuracy = Math.max(setAccuracy, setScore(fixture.verification.expected, jsonPointerSetFromSource(source, fixture.verification)).f1); }
        catch {}
      }
    } else {
      if (fixture.expectedLiteral) {
        const source = sameFile.map(item => item.source ?? item.text ?? '').join('\n');
        literalCorrect = fixture.expectedLiteral.split(',').every(value => source.includes(value));
        fileCorrect = fileCorrect && literalCorrect;
      }
      if (Number.isInteger(fixture.expectedLine)) {
        lineCorrect = sameFile.some(match => {
          const startLine = Number(match?.start_line); const endLine = Number(match?.end_line);
          const candidates = [match?.line, match?.start_line, ...(match?.match_lines ?? [])].map(Number).filter(Number.isInteger);
          return candidates.some(line => Math.abs(line - fixture.expectedLine) <= 5)
            || (Number.isInteger(startLine) && Number.isInteger(endLine) && fixture.expectedLine >= startLine && fixture.expectedLine <= endLine);
        });
      }
      if (fixture.expectedLiteral) setAccuracy = fileCorrect ? 1 : 0;
    }
  }
  const structural = targetIndexed ? await structuralPrediction(binary, project, fixture, state) : null;
  return { fixtureId: fixture.fixtureId, scoringType: fixture.scoringType, retrievalPattern: fixture.retrievalPattern ?? fixture.verification.fileName, retrievedFiles, targetRank, targetIndexed, fallbackRequired: !targetIndexed, exactSource, exactSourcePassed: exactSource.passed, fileCorrect, lineCorrect, literalCorrect, setAccuracy, structural };
}
async function evaluateRepository({ binary, manifest, repository, repetition, root }) {
  const runRoot = path.join(root, `r${repetition}`, repository.repositoryId);
  const source = path.join(runRoot, 'source'); const state = { cache: path.join(runRoot, 'cache'), config: path.join(runRoot, 'config'), home: path.join(runRoot, 'home'), tmp: path.join(runRoot, 'tmp') };
  for (const dir of [state.cache, state.config, state.home, state.tmp]) mkdir(dir);
  exportPinnedTree(manifest, repository, source);
  const project = `b81-v2-diag-${path.basename(root).replace(/[^a-zA-Z0-9_-]/g, '-')}-r${repetition}-${repository.repositoryId}`;
  const autoWatch = await runProvider(binary, ['config', 'set', 'auto_watch', 'false'], state, 10000);
  if (!autoWatch.success) throw new Error(`${repository.repositoryId} could not disable auto_watch: ${autoWatch.stderr}`);
  const cold = await runProvider(binary, ['cli', 'index_repository', '--repo-path', source, '--mode', manifest.providerContract.requiredIndexMode, '--name', project, '--persistence', 'false'], state, 120000);
  if (!cold.success) throw new Error(`${repository.repositoryId} cold index failed: ${cold.stderr}`);
  parseToolJson(cold.stdout);
  const inventory = await query(binary, project, 'MATCH (n:File) RETURN n.file_path AS file_path', state);
  const projectList = await tool(binary, 'list_projects', [], state, 30000);
  const visibleProjects = (projectList.value.projects ?? []).map(item => item.name).sort();
  const eligible = eligibleFiles(source, manifest.coveragePolicy);
  const indexedSet = new Set(inventory.map(row => rel(row.file_path)));
  const indexed = eligible.filter(file => indexedSet.has(file)); const unindexed = eligible.filter(file => !indexedSet.has(file));
  const fallbackProbe = unindexed.length > 0 ? (() => {
    const allFiles = exactSourceFiles(source, manifest.coveragePolicy); const fallbackFile = unindexed[0]; const bytes = fs.readFileSync(path.join(source, fallbackFile)); const text = bytes.toString('utf8');
    const tokens = uniq(text.match(/[A-Za-z_$][A-Za-z0-9_$]{7,}/g) ?? []);
    let query = null; let candidates = [];
    for (const token of tokens) {
      const hits = allFiles.filter(file => { try { return fs.readFileSync(path.join(source, file), 'utf8').includes(token); } catch { return false; } });
      if (hits.includes(fallbackFile) && hits.length <= manifest.retrievalPolicy.maximumCandidates) { query = token; candidates = hits; break; }
    }
    const question = query ? `Where is ${query} defined?` : 'No deterministic exact-source token was available';
    return { question, retrievalPattern: query, file: fallbackFile, exactSourceCandidates: candidates, targetIndexed: false, cbmStructuralCredit: 0, exactSourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), exactSourcePassed: Boolean(query) && candidates.includes(fallbackFile) && bytes.length > 0 };
  })() : { status: 'not-required-no-unindexed-files', exactSourcePassed: true, cbmStructuralCredit: 0 };
  const fixtures = [];
  for (const fixture of manifest.fixtures.filter(item => item.repositoryId === repository.repositoryId)) fixtures.push(await fixtureResult(binary, project, fixture, source, indexedSet, inventory, state, manifest.retrievalPolicy, manifest.coveragePolicy));
  const refreshTarget = manifest.fixtures.find(item => item.repositoryId === repository.repositoryId && item.expectedFile && /\.(?:ts|tsx|js|mjs|cjs)$/.test(item.expectedFile)).expectedFile;
  const refreshFile = path.join(source, refreshTarget); const original = fs.readFileSync(refreshFile); const marker = `B8_1_V2_${crypto.randomBytes(12).toString('hex')}`;
  fs.appendFileSync(refreshFile, `\n// ${marker}\n`);
  const refresh = await runProvider(binary, ['cli', 'index_repository', '--repo-path', source, '--mode', manifest.providerContract.requiredIndexMode, '--name', project, '--persistence', 'false'], state, 120000);
  if (!refresh.success) throw new Error(`${repository.repositoryId} refresh failed: ${refresh.stderr}`);
  const visible = await tool(binary, 'search_code', ['--pattern', marker, '--project', project, '--mode', 'full', '--limit', '20'], state, 30000);
  const visibleResults = searchResults(visible.value);
  const markerVisible = visibleResults.some(item => rel(item.file) === refreshTarget && String(item.source ?? item.text ?? '').includes(marker));
  fs.writeFileSync(refreshFile, original);
  const restore = await runProvider(binary, ['cli', 'index_repository', '--repo-path', source, '--mode', manifest.providerContract.requiredIndexMode, '--name', project, '--persistence', 'false'], state, 120000);
  const absent = await tool(binary, 'search_code', ['--pattern', marker, '--project', project, '--mode', 'full', '--limit', '20'], state, 30000);
  const absentResults = searchResults(absent.value);
  const markerAbsentAfterRestore = restore.success && absentResults.length === 0;
  const idleProcesses = providerProcesses(binary);
  const idleRssMiB = idleProcesses.reduce((sum, item) => sum + item.rssMiB, 0);
  const idleCpuPercent = idleProcesses.reduce((sum, item) => sum + item.cpuPercent, 0);
  await runProvider(binary, ['daemon', 'stop'], state, 10000).catch(() => null);
  const residualProcesses = providerProcesses(binary);
  const residualPids = residualProcesses.map(item => item.pid);
  return {
    repositoryId: repository.repositoryId, project, coverage: { eligibleCount: eligible.length, indexedCount: indexed.length, unindexedCount: unindexed.length, unknownCount: 0, ratio: eligible.length ? indexed.length / eligible.length : 1, unindexedFiles: unindexed },
    coldStart: { wallMs: cold.wallMs, peakRssMiB: cold.peakRssMb, peakCpuPercent: cold.cpuPercent },
    steadyState: { idleRssMiB, idleCpuPercent, totalServiceRssMiB: idleRssMiB, idleProvenance: { method: '/bin/ps -axo pid=,rss=,%cpu=,command=', observedProcesses: idleProcesses }, refreshMs: refresh.wallMs, refreshPeakRssMiB: refresh.peakRssMb, refreshPeakCpuPercent: refresh.cpuPercent, markerVisible, markerAbsentAfterRestore },
    indexBytes: dirBytes(state.cache), repositoryIsolation: { visibleProjects, passed: visibleProjects.length === 1 && visibleProjects[0] === project },
    processCleanup: { residualPids, passed: residualPids.length === 0 }, fallbackProbe, fixtures,
  };
}
export function buildGates(manifest, repetitions, host = null) {
  const repos = repetitions.flatMap(run => run.repositories);
  const structural = repos.flatMap(repo => repo.fixtures).filter(fixture => fixture.structural).flatMap(fixture => [fixture.structural.caller.f1, fixture.structural.callee.f1]);
  const indexedFixtures = repos.flatMap(repo => repo.fixtures).filter(fixture => fixture.targetIndexed);
  const applicableLines = indexedFixtures.filter(fixture => fixture.lineCorrect !== null);
  const exact = repos.flatMap(repo => repo.fixtures);
  const aggregateEligible = repos.reduce((sum, repo) => sum + repo.coverage.eligibleCount, 0);
  const aggregateIndexed = repos.reduce((sum, repo) => sum + repo.coverage.indexedCount, 0);
  const policy = manifest;
  const groupedRepos = groupBy(repos, repo => repo.repositoryId);
  const headroom = 1 - policy.rehearsalPolicy.requiredHeadroomRatio;
  const coreGates = (selectedRepos, selectedHost = host) => {
    const selectedStructural = selectedRepos.flatMap(repo => repo.fixtures).filter(fixture => fixture.structural).flatMap(fixture => [fixture.structural.caller.f1, fixture.structural.callee.f1]);
    const selectedIndexed = selectedRepos.flatMap(repo => repo.fixtures).filter(fixture => fixture.targetIndexed);
    const selectedLines = selectedIndexed.filter(fixture => fixture.lineCorrect !== null);
    const selectedSets = selectedIndexed.filter(fixture => fixture.scoringType === 'set-match');
    const selectedRanked = selectedIndexed.filter(fixture => fixture.scoringType !== 'count-match');
    const selectedExact = selectedRepos.flatMap(repo => repo.fixtures);
    const selectedEligible = selectedRepos.reduce((sum, repo) => sum + repo.coverage.eligibleCount, 0);
    const selectedIndexedCount = selectedRepos.reduce((sum, repo) => sum + repo.coverage.indexedCount, 0);
    const selectedGroups = groupBy(selectedRepos, repo => repo.repositoryId);
    return {
    startMemory: selectedHost !== null && selectedHost.freeMemoryPercentAtStart >= policy.resourceBudget.basis.minimumStartFreeMemoryPercent,
    startDisk: selectedHost !== null && selectedHost.freeDiskBytesAtStart >= policy.resourceBudget.basis.minimumStartFreeDiskBytes,
    coveragePerRepository: selectedRepos.length > 0 && selectedRepos.every(repo => repo.coverage.ratio >= policy.coveragePolicy.minimumPerRepositoryCoverage),
    coverageAggregate: selectedEligible > 0 && selectedIndexedCount / selectedEligible >= policy.coveragePolicy.minimumAggregateCoverage,
    coverageKnown: selectedRepos.length > 0 && selectedRepos.every(repo => repo.coverage.unknownCount === 0),
    exactSourceAccuracy: selectedExact.length > 0 && selectedExact.every(fixture => fixture.exactSourcePassed),
    fallbackAccuracy: selectedExact.filter(fixture => fixture.fallbackRequired).every(fixture => fixture.exactSourcePassed),
    indexedFileAccuracy: selectedIndexed.length > 0 && selectedIndexed.filter(fixture => fixture.fileCorrect).length / selectedIndexed.length >= policy.acceptancePolicy.minimumIndexedFixtureFileAccuracy,
    indexedLineAccuracy: selectedLines.length > 0 && selectedLines.filter(fixture => fixture.lineCorrect).length / selectedLines.length >= policy.acceptancePolicy.minimumIndexedFixtureLineAccuracy,
    meanReciprocalRank: selectedRanked.length > 0 && selectedRanked.reduce((sum, fixture) => sum + (fixture.targetRank ? 1 / fixture.targetRank : 0), 0) / selectedRanked.length >= policy.retrievalPolicy.minimumMeanReciprocalRank,
    setOutcomeAccuracy: selectedSets.length > 0 && selectedSets.every(fixture => fixture.setAccuracy >= policy.acceptancePolicy.minimumSetOutcomeAccuracy),
    callerCalleeF1: selectedStructural.length > 0 && selectedStructural.reduce((sum, value) => sum + value, 0) / selectedStructural.length >= policy.acceptancePolicy.minimumCallerCalleeF1,
    coldTime: selectedRepos.length > 0 && selectedRepos.every(repo => repo.coldStart.wallMs <= policy.resourceBudget.coldStart.maximumIndexingTimeMsPerRepository),
    coldRss: selectedRepos.length > 0 && selectedRepos.every(repo => repo.coldStart.peakRssMiB <= policy.resourceBudget.coldStart.maximumPeakRssMiB),
    coldCpu: selectedRepos.length > 0 && selectedRepos.every(repo => repo.coldStart.peakCpuPercent <= policy.resourceBudget.coldStart.maximumPeakCpuPercent),
    refreshP95: Object.values(selectedGroups).length > 0 && Object.values(selectedGroups).every(group => stats(group.map(repo => repo.steadyState.refreshMs)).p95 <= policy.resourceBudget.steadyState.maximumRefreshP95Ms),
    refreshMaximum: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.refreshMs <= policy.resourceBudget.steadyState.maximumRefreshMs),
    refreshRss: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.refreshPeakRssMiB <= policy.resourceBudget.steadyState.maximumRefreshPeakRssMiB),
    refreshCpu: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.refreshPeakCpuPercent <= policy.resourceBudget.steadyState.maximumRefreshPeakCpuPercent),
    idleRss: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.idleRssMiB <= policy.resourceBudget.steadyState.maximumIdleRssMiB),
    idleCpu: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.idleCpuPercent <= policy.resourceBudget.steadyState.maximumIdleCpuPercent),
    totalServiceRss: selectedRepos.length > 0 && selectedRepos.reduce((sum, repo) => sum + repo.steadyState.idleRssMiB, 0) <= policy.resourceBudget.capacity.maximumTotalServiceRssMiB,
    refreshVisibleAndRestored: selectedRepos.length > 0 && selectedRepos.every(repo => repo.steadyState.markerVisible && repo.steadyState.markerAbsentAfterRestore),
    indexCapacity: selectedRepos.length > 0 && selectedRepos.every(repo => repo.indexBytes <= policy.resourceBudget.capacity.maximumIndexBytesPerRepository),
    repositoryIsolation: selectedRepos.length > 0 && selectedRepos.every(repo => repo.repositoryIsolation.passed),
    processCleanup: selectedRepos.length > 0 && selectedRepos.every(repo => repo.processCleanup.passed),
    fallbackBehavior: selectedRepos.length > 0 && selectedRepos.every(repo => repo.fallbackProbe.exactSourcePassed && repo.fallbackProbe.cbmStructuralCredit === 0),
    requiredHeadroom: selectedRepos.length > 0 && selectedRepos.every(repo => (
      repo.coldStart.wallMs <= policy.resourceBudget.coldStart.maximumIndexingTimeMsPerRepository * headroom
      && repo.coldStart.peakRssMiB <= policy.resourceBudget.coldStart.maximumPeakRssMiB * headroom
      && repo.coldStart.peakCpuPercent <= policy.resourceBudget.coldStart.maximumPeakCpuPercent * headroom
      && repo.steadyState.refreshMs <= policy.resourceBudget.steadyState.maximumRefreshMs * headroom
      && repo.steadyState.refreshPeakRssMiB <= policy.resourceBudget.steadyState.maximumRefreshPeakRssMiB * headroom
      && repo.steadyState.refreshPeakCpuPercent <= policy.resourceBudget.steadyState.maximumRefreshPeakCpuPercent * headroom
      && repo.steadyState.idleRssMiB <= policy.resourceBudget.steadyState.maximumIdleRssMiB * headroom
      && repo.steadyState.idleCpuPercent <= policy.resourceBudget.steadyState.maximumIdleCpuPercent * headroom
      && repo.indexBytes <= policy.resourceBudget.capacity.maximumIndexBytesPerRepository * headroom
    )) && selectedRepos.reduce((sum, repo) => sum + repo.steadyState.idleRssMiB, 0) <= policy.resourceBudget.capacity.maximumTotalServiceRssMiB * headroom,
    };
  };
  const aggregateGates = coreGates(repos);
  aggregateGates.startMemory = repetitions.length > 0 && repetitions.every(run => coreGates(run.repositories, run.hostAtStart ?? host).startMemory);
  aggregateGates.startDisk = repetitions.length > 0 && repetitions.every(run => coreGates(run.repositories, run.hostAtStart ?? host).startDisk);
  aggregateGates.totalServiceRss = repetitions.length > 0 && repetitions.every(run => run.repositories.reduce((sum, repo) => sum + repo.steadyState.idleRssMiB, 0) <= policy.resourceBudget.capacity.maximumTotalServiceRssMiB);
  aggregateGates.requiredHeadroom = repetitions.length > 0 && repetitions.every(run => coreGates(run.repositories, run.hostAtStart ?? host).requiredHeadroom);
  const passingRuns = repetitions.filter(run => Object.values(coreGates(run.repositories, run.hostAtStart ?? host)).every(Boolean)).length;
  const gates = {
    repetitions: repetitions.length >= policy.rehearsalPolicy.minimumIndependentRuns,
    requiredPassingRuns: passingRuns >= policy.rehearsalPolicy.requiredPassingRuns,
    ...aggregateGates,
  };
  const metrics = {
    aggregateCoverage: aggregateIndexed / aggregateEligible,
    passingRuns,
    requiredPassingRuns: policy.rehearsalPolicy.requiredPassingRuns,
    indexedFileAccuracy: indexedFixtures.filter(fixture => fixture.fileCorrect).length / indexedFixtures.length,
    indexedLineAccuracy: applicableLines.filter(fixture => fixture.lineCorrect).length / applicableLines.length,
    meanReciprocalRank: (() => { const values = indexedFixtures.filter(fixture => fixture.scoringType !== 'count-match').map(fixture => fixture.targetRank ? 1 / fixture.targetRank : 0); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; })(),
    setOutcomeAccuracy: (() => { const values = indexedFixtures.filter(fixture => fixture.scoringType === 'set-match').map(fixture => fixture.setAccuracy); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; })(),
    callerCalleeF1: structural.reduce((sum, value) => sum + value, 0) / structural.length,
    coldWallMs: stats(repos.map(repo => repo.coldStart.wallMs)), coldPeakRssMiB: stats(repos.map(repo => repo.coldStart.peakRssMiB)), coldPeakCpuPercent: stats(repos.map(repo => repo.coldStart.peakCpuPercent)),
    refreshMsByRepository: Object.fromEntries(Object.entries(groupedRepos).map(([id, group]) => [id, stats(group.map(repo => repo.steadyState.refreshMs))])),
    refreshPeakRssMiB: stats(repos.map(repo => repo.steadyState.refreshPeakRssMiB)), refreshPeakCpuPercent: stats(repos.map(repo => repo.steadyState.refreshPeakCpuPercent)),
    idleRssMiB: stats(repos.map(repo => repo.steadyState.idleRssMiB)), idleCpuPercent: stats(repos.map(repo => repo.steadyState.idleCpuPercent)),
    projectedSimultaneousServiceRssMiB: stats(repetitions.map(run => run.repositories.reduce((sum, repo) => sum + repo.steadyState.idleRssMiB, 0))), indexBytes: stats(repos.map(repo => repo.indexBytes)),
  };
  return { gates, metrics, passed: Object.values(gates).every(Boolean) };
}

export function validateDiagnosticReport(manifest, report) {
  const errors = []; const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const requiredRepositories = manifest.repositories.map(repository => repository.repositoryId).sort();
  const selectedRepositories = report.selectedRepositories ?? [];
  if (selectedRepositories.length !== requiredRepositories.length || JSON.stringify([...selectedRepositories].sort()) !== JSON.stringify(requiredRepositories)) errors.push('selected repository set/cardinality mismatch');
  if (!Array.isArray(report.repetitions) || report.repetitions.length !== manifest.rehearsalPolicy.requiredPassingRuns) errors.push('repetition cardinality mismatch');
  for (const [runIndex, run] of (report.repetitions ?? []).entries()) {
    if (run.repetition !== runIndex + 1) errors.push(`repetition ${runIndex + 1}: identity mismatch`);
    if (!finite(run.hostAtStart?.freeMemoryPercentAtStart) || !finite(run.hostAtStart?.freeDiskBytesAtStart)) errors.push(`repetition ${runIndex + 1}: invalid start capacity sample`);
    const repositories = run.repositories ?? []; const repositoryIds = repositories.map(repository => repository.repositoryId);
    if (repositories.length !== requiredRepositories.length || new Set(repositoryIds).size !== repositories.length || JSON.stringify([...repositoryIds].sort()) !== JSON.stringify(requiredRepositories)) errors.push(`repetition ${runIndex + 1}: repository set/cardinality mismatch`);
    for (const repository of repositories) {
      const prefix = `repetition ${runIndex + 1}/${repository.repositoryId}`;
      const expectedFixtures = manifest.fixtures.filter(fixture => fixture.repositoryId === repository.repositoryId).map(fixture => fixture.fixtureId).sort();
      const fixtureIds = (repository.fixtures ?? []).map(fixture => fixture.fixtureId);
      if (fixtureIds.length !== expectedFixtures.length || new Set(fixtureIds).size !== fixtureIds.length || JSON.stringify([...fixtureIds].sort()) !== JSON.stringify(expectedFixtures)) errors.push(`${prefix}: fixture set/cardinality mismatch`);
      const coverage = repository.coverage ?? {};
      if (![coverage.eligibleCount, coverage.indexedCount, coverage.unindexedCount, coverage.unknownCount].every(Number.isInteger)
        || coverage.indexedCount + coverage.unindexedCount !== coverage.eligibleCount || coverage.unknownCount !== 0
        || coverage.unindexedFiles?.length !== coverage.unindexedCount || new Set(coverage.unindexedFiles ?? []).size !== coverage.unindexedFiles?.length
        || Math.abs(coverage.ratio - (coverage.eligibleCount ? coverage.indexedCount / coverage.eligibleCount : 1)) > Number.EPSILON) errors.push(`${prefix}: inconsistent coverage inventory`);
      const numericMetrics = [repository.coldStart?.wallMs, repository.coldStart?.peakRssMiB, repository.coldStart?.peakCpuPercent,
        repository.steadyState?.idleRssMiB, repository.steadyState?.idleCpuPercent, repository.steadyState?.totalServiceRssMiB,
        repository.steadyState?.refreshMs, repository.steadyState?.refreshPeakRssMiB, repository.steadyState?.refreshPeakCpuPercent, repository.indexBytes];
      if (!numericMetrics.every(finite)) errors.push(`${prefix}: invalid lifecycle metric`);
      if (repository.steadyState?.totalServiceRssMiB !== repository.steadyState?.idleRssMiB || repository.steadyState?.idleProvenance?.method !== '/bin/ps -axo pid=,rss=,%cpu=,command=' || !Array.isArray(repository.steadyState?.idleProvenance?.observedProcesses)) errors.push(`${prefix}: invalid idle resource provenance`);
      if (repository.repositoryIsolation?.passed !== true || repository.repositoryIsolation.visibleProjects?.length !== 1 || repository.repositoryIsolation.visibleProjects[0] !== repository.project) errors.push(`${prefix}: invalid repository isolation proof`);
      if (repository.processCleanup?.passed !== true || repository.processCleanup.residualPids?.length !== 0) errors.push(`${prefix}: invalid cleanup proof`);
      if (repository.fallbackProbe?.status !== 'not-required-no-unindexed-files' && (!repository.fallbackProbe?.retrievalPattern || !repository.fallbackProbe?.exactSourceCandidates?.includes(repository.fallbackProbe.file) || repository.fallbackProbe?.targetIndexed !== false || repository.fallbackProbe?.cbmStructuralCredit !== 0 || repository.fallbackProbe?.exactSourcePassed !== true)) errors.push(`${prefix}: invalid exact-source fallback probe`);
      for (const fixture of repository.fixtures ?? []) {
        const authority = manifest.fixtures.find(item => item.fixtureId === fixture.fixtureId);
        if (!authority || fixture.scoringType !== authority.scoringType || fixture.retrievalPattern !== (authority.retrievalPattern ?? authority.verification.fileName)) errors.push(`${prefix}/${fixture.fixtureId}: authority mismatch`);
        if (typeof fixture.targetIndexed !== 'boolean' || typeof fixture.exactSourcePassed !== 'boolean' || fixture.exactSourcePassed !== fixture.exactSource?.passed || fixture.exactSource?.located !== true || fixture.exactSource?.contentVerified !== true) errors.push(`${prefix}/${fixture.fixtureId}: invalid exact-source lookup proof`);
        if (typeof fixture.fileCorrect !== 'boolean' || (Number.isInteger(authority.expectedLine) ? typeof fixture.lineCorrect !== 'boolean' : fixture.lineCorrect !== null)) errors.push(`${prefix}/${fixture.fixtureId}: invalid metric applicability`);
        if (authority.scoringType === 'set-match' && !finite(fixture.setAccuracy)) errors.push(`${prefix}/${fixture.fixtureId}: missing set-outcome evidence`);
        if (authority.scoringType !== 'count-match' && fixture.targetIndexed) {
          const validHit = fixture.fileCorrect && Number.isInteger(fixture.targetRank) && fixture.targetRank >= 1 && fixture.targetRank <= manifest.retrievalPolicy.maximumCandidates;
          const validMiss = !fixture.fileCorrect && fixture.targetRank === null;
          if (!validHit && !validMiss) errors.push(`${prefix}/${fixture.fixtureId}: invalid ranked retrieval proof`);
        }
        if (authority.callerCalleeApplicable && fixture.targetIndexed && (!fixture.structural || !finite(fixture.structural.caller?.f1) || fixture.structural.caller.f1 > 1 || !finite(fixture.structural.callee?.f1) || fixture.structural.callee.f1 > 1)) errors.push(`${prefix}/${fixture.fixtureId}: missing structural evidence`);
        if (!authority.callerCalleeApplicable && fixture.structural !== null) errors.push(`${prefix}/${fixture.fixtureId}: nonapplicable structural evidence present`);
      }
    }
  }
  if (errors.length === 0) {
    const recomputed = buildGates(manifest, report.repetitions, report.host);
    if (JSON.stringify(recomputed) !== JSON.stringify(report.acceptance)) errors.push('acceptance summary does not match raw repetitions');
  }
  return { valid: errors.length === 0, errors };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const index = arg.indexOf('='); return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)]; }));
  if (!args.provider || !args.output) throw new Error('usage: --provider=/absolute/path --output=/absolute/diagnostic-dir [--repetitions=5] [--repositories=brain,workbench,prochat]');
  const binary = fs.realpathSync(args.provider); const output = path.resolve(args.output);
  const diagnosticsRoot = '/Users/Office/.brain/benchmark/b8-1/diagnostics';
  const diagnosticsStat = fs.lstatSync(diagnosticsRoot);
  if (diagnosticsStat.isSymbolicLink() || !diagnosticsStat.isDirectory() || fs.realpathSync(diagnosticsRoot) !== diagnosticsRoot) throw new Error('B8.1 diagnostics root must be a physical directory');
  if (!isStrictDescendant(diagnosticsRoot, output) || path.dirname(output) !== diagnosticsRoot) throw new Error('output must be a direct child of the B8.1 diagnostics root');
  if (fs.existsSync(output)) throw new Error(`diagnostic output already exists: ${output}`);
  fs.mkdirSync(output, { mode: 0o700 });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const wanted = new Set(String(args.repositories ?? 'brain,workbench,prochat').split(','));
  const repositories = manifest.repositories.filter(repo => wanted.has(repo.repositoryId));
  const unknownRepositories = [...wanted].filter(id => !manifest.repositories.some(repo => repo.repositoryId === id));
  if (repositories.length === 0 || unknownRepositories.length > 0) throw new Error(`invalid repository selection: ${unknownRepositories.join(',') || 'empty'}`);
  const repetitions = Number(args.repetitions ?? 5);
  const isolation = await isolationProof(); if (!isolation.passed) throw new Error('isolation self-test failed');
  const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
  const sampleHost = () => ({ memoryBytes: os.totalmem(), logicalCpuCount: os.cpus().length, freeMemoryPercentAtStart: freeMemoryPercent(), freeDiskBytesAtStart: fs.statfsSync(output).bavail * fs.statfsSync(output).bsize });
  const host = sampleHost();
  const runs = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const hostAtStart = sampleHost();
    const repoResults = [];
    for (const repository of repositories) repoResults.push(await evaluateRepository({ binary, manifest, repository, repetition, root: output }));
    runs.push({ repetition, hostAtStart, repositories: repoResults });
    writeJson(path.join(output, `rehearsal-r${repetition}.json`), runs.at(-1));
  }
  const acceptance = buildGates(manifest, runs, host);
  const repetitionReceipts = runs.map((run, index) => {
    const receiptPath = path.join(output, `rehearsal-r${index + 1}.json`);
    return { repetition: run.repetition, path: receiptPath, sha256: sha256File(receiptPath) };
  });
  const report = {
    schemaVersion: '1.0.0', contractVersion: manifest.contractVersion, diagnosticOnly: true, canonicalAuthority: false,
    createdAt: new Date().toISOString(), manifestPath: MANIFEST_PATH, manifestSha256: sha256File(MANIFEST_PATH), provider: { path: binary, version, sha256: sha256File(binary), indexMode: manifest.providerContract.requiredIndexMode, persistence: false },
    isolation, host, implementationIdentity: { evaluatorSha256: sha256File(fileURLToPath(import.meta.url)), contractValidatorSha256: sha256File(path.join(ROOT, 'tools/validate-b8-1-v2-contract.mjs')) },
    selectedRepositories: repositories.map(repo => repo.repositoryId), repetitionReceipts, repetitions: runs, acceptance,
  };
  writeJson(path.join(output, 'evaluation-report.json'), report);
  console.log(JSON.stringify({ output, provider: report.provider, passed: acceptance.passed, gates: acceptance.gates, metrics: acceptance.metrics }, null, 2));
  process.exitCode = acceptance.passed ? 0 : 1;
}

const IS_MAIN = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (IS_MAIN) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 2; });
