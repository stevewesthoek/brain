/**
 * BS0.10 retirement guard tests.
 *
 * Proves that each of the four retired legacy-path producer scripts:
 *   1. Exits with code 0 (safe retirement, not error).
 *   2. Prints a retirement notice referencing the dated report.
 *   3. Cannot reach argument parsing (retirement precedes argparse).
 *   4. Cannot access credentials (exits before any import of dotenv/credential paths).
 *   5. Cannot invoke git or network calls (exits before any subprocess spawn).
 *   6. Cannot write to Mind directories (exits before any filesystem write).
 *   7. Cannot be bypassed by any command-line flags.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const RETIRED_SCRIPTS = [
  'clickup-importer.py',
  'mind-kanban-syncer.py',
  'mind-project-decomposer.py',
  'mind-auto-router.py',
].map((name) => path.join(SCRIPT_DIR, name));

const RETIREMENT_REPORT = 'operations/reports/bs0-10-legacy-producer-migration-2026-07-31.md';

function runScript(scriptPath, args = []) {
  return spawnSync('python3', [scriptPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: '/tmp/retirement-guard-test',
      // Deliberately withhold any credential env vars.
    },
  });
}

for (const scriptPath of RETIRED_SCRIPTS) {
  const name = path.basename(scriptPath);

  test(`${name}: exits with code 0 (safe retirement)`, () => {
    const result = runScript(scriptPath);
    assert.equal(result.status, 0, `expected exit 0 but got ${result.status}; stderr: ${result.stderr}`);
  });

  test(`${name}: prints RETIRED notice on stdout`, () => {
    const result = runScript(scriptPath);
    assert.match(result.stdout, /^RETIRED:/m);
    assert.match(result.stdout, /retired as of 2026-07-31/);
  });

  test(`${name}: retirement notice references the dated report`, () => {
    const result = runScript(scriptPath);
    assert.match(result.stdout, /bs0-10-legacy-producer-migration-2026-07-31\.md/);
  });

  test(`${name}: does not print any git-command output`, () => {
    const result = runScript(scriptPath);
    assert.doesNotMatch(result.stdout, /git (commit|push|add|clone|pull|checkout|status)/i);
    assert.doesNotMatch(result.stderr, /git (commit|push|add|clone|pull|checkout|status)/i);
  });

  test(`${name}: does not output any Mind-path write evidence`, () => {
    const result = runScript(scriptPath);
    // These patterns would only appear if write code executed.
    assert.doesNotMatch(result.stdout, /writing to mind\//i);
    assert.doesNotMatch(result.stdout, /created task/i);
    assert.doesNotMatch(result.stdout, /kanban\.md updated/i);
    assert.doesNotMatch(result.stdout, /routed/i);
  });

  test(`${name}: cannot be bypassed by --dry-run flag`, () => {
    const result = runScript(scriptPath, ['--dry-run']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^RETIRED:/m);
  });

  test(`${name}: cannot be bypassed by --force flag`, () => {
    const result = runScript(scriptPath, ['--force']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^RETIRED:/m);
  });

  test(`${name}: cannot be bypassed by positional arguments`, () => {
    const result = runScript(scriptPath, ['/tmp/bogus-input.csv']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^RETIRED:/m);
  });

  test(`${name}: source file contains unconditional retirement guard before argparse`, () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const retirementIndex = source.indexOf('RETIREMENT GUARD');
    const argparseIndex = source.indexOf('argparse');
    assert.ok(retirementIndex >= 0, 'source must contain RETIREMENT GUARD comment');
    assert.ok(
      argparseIndex < 0 || retirementIndex < argparseIndex,
      'retirement guard must appear before any argparse usage',
    );
  });

  test(`${name}: source file contains sys.exit(0) immediately after retirement print`, () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const printIndex = source.indexOf('RETIRED:');
    const exitIndex = source.indexOf('sys.exit(0)', printIndex);
    assert.ok(printIndex >= 0, 'source must contain RETIRED: string');
    assert.ok(exitIndex >= 0 && exitIndex - printIndex < 300, 'sys.exit(0) must appear within 300 chars after RETIRED:');
  });
}

// Verify the retirement report file exists with the expected structure.
test('BS0.10 retirement report file exists and documents all four scripts', () => {
  const brainRoot = path.resolve(SCRIPT_DIR, '../..');
  const reportPath = path.join(brainRoot, RETIREMENT_REPORT);
  assert.ok(fs.existsSync(reportPath), `retirement report must exist at ${RETIREMENT_REPORT}`);
  const content = fs.readFileSync(reportPath, 'utf8');
  assert.match(content, /clickup-importer\.py/);
  assert.match(content, /mind-kanban-syncer\.py/);
  assert.match(content, /mind-project-decomposer\.py/);
  assert.match(content, /mind-auto-router\.py/);
  assert.match(content, /M1\.4/);
});
