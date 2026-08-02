import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'tools/validate-capability-state.mjs');
const source = path.join(root, 'operations/specs/capability-state.json');
function invalid(mutator) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-state-')); try { const model = JSON.parse(fs.readFileSync(source, 'utf8')); mutator(model); const file = path.join(dir, 'bad.json'); fs.writeFileSync(file, JSON.stringify(model)); assert.throws(() => execFileSync('node', [validator, file], { stdio: 'pipe' })); } finally { fs.rmSync(dir, { recursive: true, force: true }); } }
test('capability state model binds evidence to registered contracts and implementations', () => assert.match(execFileSync('node', [validator], { encoding: 'utf8' }), /evidence-chain=bound/));
test('promotion, stale evidence, generated authority, duplicate IDs, unregistered contracts, and missing implementation fail closed', () => invalid((model) => { model.capabilities[0].capabilityId = model.capabilities[1].capabilityId; model.capabilities[6].deploymentState = 'deployed'; model.capabilities[1].evidencePaths = ['operations/reports/bs0-11-scheduler-reconciliation-2026-07-14.md']; model.capabilities[2].reviewedAt = '2026-07-01'; model.capabilities[3].contractId = 'not-registered'; model.capabilities[4].implementationPaths = ['missing.ts']; }));
