import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'tools/generate-capability-manifest.mjs');
function run(repoRoot = root) { return execFileSync('node', [generator, '--root', repoRoot], { encoding: 'utf8', stdio: 'pipe' }); }
function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'capability-manifest-'));
  for (const file of ['operations/specs/capability-state.json', 'operations/specs/infinite-brain-contract-registry.json', 'operations/specs/infinite-brain-path-registry.json']) {
    const target = path.join(temp, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target);
  }
  fs.mkdirSync(path.join(temp, 'evidence'), { recursive: true }); fs.writeFileSync(path.join(temp, 'evidence/proof.txt'), 'safe proof\n');
  const modelPath = path.join(temp, 'operations/specs/capability-state.json'); const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  model.capabilities[0].evidencePaths = ['evidence/proof.txt']; fs.writeFileSync(modelPath, JSON.stringify(model)); return temp;
}
test('manifest generation is deterministic and limits verified live state to the guarded deployment', () => { const a = run(), b = run(), manifest = JSON.parse(a); assert.equal(a, b); assert.equal(manifest.capabilities.length, 17); assert.equal(manifest.capabilities.find((capability) => capability.capabilityId === 'save-to-mind-live-deployment').liveState, 'verified'); assert(manifest.capabilities.filter((capability) => capability.capabilityId !== 'save-to-mind-live-deployment').every((capability) => capability.liveState === 'unknown')); assert.equal(manifest.capabilities.find((capability) => capability.capabilityId === 'graphify').safetyContained, true); });
test('source hash changes invalidate the manifest evidence hash', () => { const temp = fixture(); try { const first = JSON.parse(run(temp)); fs.writeFileSync(path.join(temp, 'evidence/proof.txt'), 'changed proof\n'); const second = JSON.parse(run(temp)); const before = first.capabilities.find((capability) => capability.capabilityId === 'brain-core-api'); const after = second.capabilities.find((capability) => capability.capabilityId === 'brain-core-api'); assert.notEqual(before.evidence[0].sha256, after.evidence[0].sha256); } finally { fs.rmSync(temp, { recursive: true, force: true }); } });
test('secret-like evidence is rejected', () => { const temp = fixture(); try { fs.writeFileSync(path.join(temp, 'evidence/proof.txt'), 'api_key=abcdefghijklmnopqrstuvwxyz\n'); assert.throws(() => run(temp)); } finally { fs.rmSync(temp, { recursive: true, force: true }); } });
test('unapproved deployment claims are rejected', () => { const temp = fixture(); try { const modelPath = path.join(temp, 'operations/specs/capability-state.json'); const model = JSON.parse(fs.readFileSync(modelPath, 'utf8')); model.capabilities[0].deploymentState = 'deployed'; fs.writeFileSync(modelPath, JSON.stringify(model)); assert.throws(() => run(temp), /unsupported live deployment claim/); } finally { fs.rmSync(temp, { recursive: true, force: true }); } });
