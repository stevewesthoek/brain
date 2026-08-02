#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BRAIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIND_ROOT = path.resolve(BRAIN_ROOT, '../mind');
const ACTIVE_INSTRUCTIONS = [
  'operations/system-configs/claude/CLAUDE.md',
  'operations/system-configs/codex/AGENTS.md',
  'operations/system-configs/cursor/AGENTS.md',
  'operations/system-configs/gemini/GEMINI.md',
  'operations/system-configs/ide-context.md',
  'operations/system-configs/kiro/steering/brain-mind-context.md',
];
const ENTRYPOINT_FILES = [
  'system/agent-context/AGENTS.md',
  'system/agent-context/00-start-here.md',
  'system/agent-context/00-current-context.md',
  'system/agent-context/00-memory-map.md',
];
const INTAKE_DIRECTORIES = [
  'inbox/new', 'inbox/raw', 'resources', 'inbox/processed', 'inbox/failed',
];
const CURRENT_ENTRYPOINT = 'mind/system/agent-context/';
const STALE_PATTERNS = [
  'mind/router', 'mind/00-memory-map', 'mind/03-', 'mind/04-', 'mind/06-',
  'mind/capture/inbox', 'mind/capture/failed', 'mind/live/', 'mind/sources/',
];
const EXPECTED = Object.freeze({
  bridgeContractId: 'brain-mind-bridge',
  mindBridgeVersion: '2.0',
  brainContractRegistryVersion: '1.0.0',
  brainContractLayerSchemaVersion: '1.0.0',
  intakePaths: INTAKE_DIRECTORIES,
});

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function readText(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) fail('PATH_ESCAPE', relativePath);
  try { return fs.readFileSync(absolute, 'utf8'); } catch { fail('MISSING_METADATA', relativePath); }
}

function readJson(root, relativePath) {
  try { return JSON.parse(readText(root, relativePath)); } catch (error) {
    if (error.code) throw error;
    fail('MALFORMED_METADATA', relativePath);
  }
}

function ensureDirectory(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) fail('PATH_ESCAPE', relativePath);
  if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) fail('MISSING_INTAKE_PATH', relativePath);
}

function checkInstructions() {
  const results = [];
  for (const relativePath of ACTIVE_INSTRUCTIONS) {
    const content = readText(BRAIN_ROOT, relativePath);
    if (!content.includes(CURRENT_ENTRYPOINT)) fail('STALE_OR_MISSING_ENTRYPOINT', relativePath);
    const stale = STALE_PATTERNS.find((pattern) => content.includes(pattern));
    if (stale) fail('STALE_ACTIVE_PATH', `${relativePath}:${stale}`);
    results.push(relativePath);
  }
  return results;
}

export function validateLive({ brainRoot = BRAIN_ROOT, mindRoot = MIND_ROOT } = {}) {
  for (const relativePath of ENTRYPOINT_FILES) readText(mindRoot, relativePath);
  for (const relativePath of INTAKE_DIRECTORIES) ensureDirectory(mindRoot, relativePath);
  const bridge = readText(mindRoot, 'system/brain-mind-bridge.md');
  if (!bridge.includes('**Version:** 2.0')) fail('BRIDGE_VERSION_MISMATCH', 'Mind bridge version');
  if (!bridge.includes('Agent orientation | `system/agent-context/`')) fail('BRIDGE_CONTRACT_MISMATCH', 'agent orientation');
  const registry = readJson(brainRoot, 'operations/specs/infinite-brain-contract-registry.json');
  if (registry.registryVersion !== EXPECTED.brainContractRegistryVersion) fail('SCHEMA_VERSION_MISMATCH', 'contract registry');
  if (!registry.entries.some((entry) => entry.contractId === EXPECTED.bridgeContractId)) fail('BRIDGE_CONTRACT_MISMATCH', EXPECTED.bridgeContractId);
  const layers = readJson(brainRoot, 'operations/specs/infinite-brain-contract-layer-map.json');
  if (layers.schemaVersion !== EXPECTED.brainContractLayerSchemaVersion) fail('SCHEMA_VERSION_MISMATCH', 'contract layer map');
  const instructions = checkInstructions();
  return { bridgeContractId: EXPECTED.bridgeContractId, mindBridgeVersion: EXPECTED.mindBridgeVersion, brainContractRegistryVersion: registry.registryVersion, brainContractLayerSchemaVersion: layers.schemaVersion, entrypoints: ENTRYPOINT_FILES, intakePaths: INTAKE_DIRECTORIES, instructions };
}

function fixturePath(name) {
  if (!/^[a-z0-9-]+\.json$/.test(name)) fail('INVALID_FIXTURE', name);
  const root = path.resolve(BRAIN_ROOT, 'tools/fixtures/b1-7-cross-repo-contract');
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail('PATH_ESCAPE', name);
  return resolved;
}

export function validateFixture(name) {
  const fixture = readJson(path.dirname(fixturePath(name)), path.basename(fixturePath(name)));
  if (!fixture || fixture.kind !== 'b1-7-contract-fixture') fail('MALFORMED_FIXTURE', name);
  if (!Array.isArray(fixture.entrypoints) || !Array.isArray(fixture.intakePaths)) fail('MALFORMED_FIXTURE', name);
  if (!fixture.entrypoints.every((item) => item === 'system/agent-context/' || ENTRYPOINT_FILES.includes(item))) fail('MALFORMED_FIXTURE', name);
  if (!ENTRYPOINT_FILES.every((item) => fixture.entrypoints.includes(item)) && name === 'missing-entrypoint.json') fail('MISSING_ENTRYPOINT', name);
  if (!INTAKE_DIRECTORIES.every((item) => fixture.intakePaths.includes(item))) fail('INTAKE_PATH_MISMATCH', name);
  if (fixture.bridgeContractId !== EXPECTED.bridgeContractId) fail('BRIDGE_CONTRACT_MISMATCH', 'fixture');
  if (fixture.mindBridgeVersion !== EXPECTED.mindBridgeVersion || fixture.brainContractRegistryVersion !== EXPECTED.brainContractRegistryVersion || fixture.brainContractLayerSchemaVersion !== EXPECTED.brainContractLayerSchemaVersion) fail('SCHEMA_VERSION_MISMATCH', 'fixture');
  if (fixture.stalePath) fail('STALE_ACTIVE_PATH', fixture.stalePath);
  if (!fixture.activeInstructions?.every((item) => item.includes(CURRENT_ENTRYPOINT))) fail('STALE_OR_MISSING_ENTRYPOINT', 'fixture');
  return { fixture: name, result: 'pass' };
}

function main() {
  try {
    const fixtureIndex = process.argv.indexOf('--fixture');
    const result = fixtureIndex >= 0 ? validateFixture(process.argv[fixtureIndex + 1] ?? '') : validateLive();
    process.stdout.write(`b1_7=pass\nmode=${fixtureIndex >= 0 ? 'fixture' : 'live'}\nbridge_contract=${result.bridgeContractId ?? EXPECTED.bridgeContractId}\nmind_bridge_version=${result.mindBridgeVersion ?? EXPECTED.mindBridgeVersion}\nresult=pass\n`);
  } catch (error) {
    process.stdout.write(`b1_7=fail\nreason_code=${error.code ?? 'MALFORMED_METADATA'}\ndetail=${error.message}\nresult=fail\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
