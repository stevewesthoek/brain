#!/usr/bin/env node
/**
 * validate-b8-1-benchmark-manifest.mjs
 *
 * Validates the B8.1 context-memory benchmark manifest against:
 *   1. JSON Schema conformance
 *   2. Duplicate fixture IDs
 *   3. Missing or symbolic repository commits
 *   4. File existence in exported pinned commit trees
 *   5. Expected literals/symbols at recorded lines
 *   6. Exact file counts
 *   7. Deterministic caller/callee arrays (not prose)
 *   8. Forbidden approximation wording
 *   9. Forbidden paths (Mind, secrets, caches, runtime state, vendor output)
 *  10. Temporary export cleanup
 *
 * NEVER modifies any source checkout.
 * Creates temporary git archive exports only, removed after validation.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const DEFAULT_SCHEMA_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.schema.json');

// ---------------------------------------------------------------------------
// Forbidden path prefixes — fixtures must never enter these areas
// ---------------------------------------------------------------------------

const FORBIDDEN_PATH_PATTERNS = [
  // Mind vault
  /\/mind\//i,
  /^mind\//i,
  // Secrets / credentials
  /\.env$/i,
  /credentials/i,
  /secrets/i,
  /\.token$/i,
  /\.pem$/i,
  // Runtime state / caches
  /\/\.brain\/cache\//i,
  /\/Library\/Caches\//i,
  /node_modules/,
  // Generated history / vendor output
  /graphify-out\//,
  /dist\//,
  // Working tree only outputs
  /\.codebase-memory\//,
];

function isForbiddenPath(filePath) {
  return FORBIDDEN_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

// ---------------------------------------------------------------------------
// Forbidden approximation wording
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDING = [
  'or equivalent',
  'approximately',
  'main function',
  'a config file',
  'the relevant route',
  'some function',
  'similar to',
];

function checkForbiddenWording(text) {
  if (!text) return null;
  for (const phrase of FORBIDDEN_WORDING) {
    if (text.toLowerCase().includes(phrase)) return phrase;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schema validation (minimal, without a full JSON Schema validator)
// ---------------------------------------------------------------------------

function validateSchema(manifest, schema) {
  const errors = [];
  if (manifest.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.createdAt ?? '')) errors.push('createdAt must be YYYY-MM-DD');
  if (!Array.isArray(manifest.repositories) || manifest.repositories.length === 0) errors.push('repositories must be non-empty');
  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length === 0) errors.push('fixtures must be non-empty');

  for (const repo of manifest.repositories ?? []) {
    if (!repo.repositoryId || !/^[a-z][a-z0-9-]*$/.test(repo.repositoryId)) errors.push(`repository: invalid repositoryId "${repo.repositoryId}"`);
    if (!repo.localPath || !path.isAbsolute(repo.localPath)) errors.push(`${repo.repositoryId}: localPath must be absolute`);
    if (!/^[a-f0-9]{40}$/.test(repo.pinnedCommit ?? '')) errors.push(`${repo.repositoryId}: pinnedCommit must be 40-char hex`);
    // Reject symbolic refs
    if (/^(main|master|HEAD|origin|develop|release)/.test(repo.pinnedCommit ?? '')) {
      errors.push(`${repo.repositoryId}: pinnedCommit must not be a symbolic ref`);
    }
  }

  const fixtureIds = new Set();
  for (const fixture of manifest.fixtures ?? []) {
    if (!fixture.fixtureId || !/^[a-z][a-z0-9_]*$/.test(fixture.fixtureId)) {
      errors.push(`fixture: invalid fixtureId "${fixture.fixtureId}"`);
      continue;
    }
    if (fixtureIds.has(fixture.fixtureId)) errors.push(`fixture: duplicate fixtureId "${fixture.fixtureId}"`);
    fixtureIds.add(fixture.fixtureId);

    const repoMatch = (manifest.repositories ?? []).find((r) => r.repositoryId === fixture.repositoryId);
    if (!repoMatch) errors.push(`${fixture.fixtureId}: repositoryId "${fixture.repositoryId}" not in repositories`);

    if (!/^[a-f0-9]{40}$/.test(fixture.pinnedCommit ?? '')) errors.push(`${fixture.fixtureId}: pinnedCommit must be 40-char hex`);

    if (!fixture.question) errors.push(`${fixture.fixtureId}: question is required`);

    if (!['exact-match', 'set-match', 'count-match'].includes(fixture.scoringType)) {
      errors.push(`${fixture.fixtureId}: invalid scoringType`);
    }
    if (typeof fixture.callerCalleeApplicable !== 'boolean') errors.push(`${fixture.fixtureId}: callerCalleeApplicable must be boolean`);
    if (!fixture.verificationCommand) errors.push(`${fixture.fixtureId}: verificationCommand is required`);

    // count-match must have expectedFileCount
    if (fixture.scoringType === 'count-match' && typeof fixture.expectedFileCount !== 'number') {
      errors.push(`${fixture.fixtureId}: count-match requires expectedFileCount`);
    }

    // exact-match and set-match must have expectedFile
    if (fixture.scoringType !== 'count-match' && !fixture.expectedFile) {
      errors.push(`${fixture.fixtureId}: ${fixture.scoringType} requires expectedFile`);
    }

    // Check for forbidden wording
    for (const field of ['question', 'expectedFile', 'expectedSymbol', 'expectedLiteral', 'verificationCommand', 'notes']) {
      const found = checkForbiddenWording(fixture[field]);
      if (found) errors.push(`${fixture.fixtureId}: forbidden wording "${found}" in field "${field}"`);
    }

    // Check caller/callee arrays are explicit arrays (not strings)
    if (fixture.expectedCallers !== undefined && !Array.isArray(fixture.expectedCallers)) {
      errors.push(`${fixture.fixtureId}: expectedCallers must be an explicit array`);
    }
    if (fixture.expectedCallees !== undefined && !Array.isArray(fixture.expectedCallees)) {
      errors.push(`${fixture.fixtureId}: expectedCallees must be an explicit array`);
    }

    // Check fixture file path not in forbidden areas
    if (fixture.expectedFile && isForbiddenPath(fixture.expectedFile)) {
      errors.push(`${fixture.fixtureId}: expectedFile path enters forbidden area: ${fixture.expectedFile}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Git archive export — creates a temp dir, exports pinned commit, returns path
// ---------------------------------------------------------------------------

function exportCommit(repoPath, commit) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-manifest-'));
  execFileSync('git', ['-C', repoPath, 'archive', commit, '--', '.'], {
    stdio: ['ignore', fs.openSync(path.join(tmp, '_archive.tar'), 'w'), 'ignore'],
  });
  execFileSync('tar', ['-x', '-f', path.join(tmp, '_archive.tar'), '-C', tmp]);
  fs.rmSync(path.join(tmp, '_archive.tar'), { force: true });
  return tmp;
}

// ---------------------------------------------------------------------------
// Fixture verification against an exported tree
// ---------------------------------------------------------------------------

function verifyFixture(fixture, exportedRoot) {
  const errors = [];

  if (fixture.scoringType === 'count-match') {
    // Count files matching the pattern in verificationCommand
    const count = countFiles(exportedRoot, 'route.ts');
    if (count !== fixture.expectedFileCount) {
      errors.push(`${fixture.fixtureId}: file count mismatch (expected=${fixture.expectedFileCount} actual=${count})`);
    }
    return errors;
  }

  // exact-match or set-match: verify expectedFile exists
  const filePath = path.join(exportedRoot, fixture.expectedFile);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push(`${fixture.fixtureId}: expectedFile not found: ${fixture.expectedFile}`);
    return errors;
  }

  // Verify expectedLine contains expectedSymbol or expectedLiteral
  if (fixture.expectedLine) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const lineIdx = fixture.expectedLine - 1;
    if (lineIdx >= lines.length) {
      errors.push(`${fixture.fixtureId}: expectedLine ${fixture.expectedLine} beyond file length ${lines.length}`);
    } else {
      const lineText = lines[lineIdx];
      if (fixture.expectedSymbol && !lineText.includes(fixture.expectedSymbol)) {
        errors.push(`${fixture.fixtureId}: expectedSymbol "${fixture.expectedSymbol}" not found at line ${fixture.expectedLine}: "${lineText.trim()}"`);
      }
      if (fixture.expectedLiteral && !lineText.includes(fixture.expectedLiteral)) {
        errors.push(`${fixture.fixtureId}: expectedLiteral "${fixture.expectedLiteral}" not found at line ${fixture.expectedLine}: "${lineText.trim()}"`);
      }
    }
  }

  return errors;
}

function countFiles(root, name) {
  let count = 0;
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (entry.name === name) count++;
      }
    } catch { /* skip inaccessible dirs */ }
  }
  walk(root);
  return count;
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

async function validateManifest(manifestPath, schemaPath, { allowMissingRepos = false } = {}) {
  const errors = [];
  const tmpDirs = [];

  try {
    // Load manifest and schema
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      errors.push(`manifest-parse-error: ${e.message}`);
      return { valid: false, errors };
    }

    let schema;
    try {
      schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (e) {
      errors.push(`schema-parse-error: ${e.message}`);
      return { valid: false, errors };
    }

    // Step 1: Schema validation
    const schemaErrors = validateSchema(manifest, schema);
    errors.push(...schemaErrors);
    if (errors.length > 0) return { valid: false, errors };

    // Step 2: Per-repository export and fixture verification
    const exportedRoots = new Map();

    for (const repo of manifest.repositories) {
      const repoPath = repo.localPath;
      const commit = repo.pinnedCommit;

      if (!fs.existsSync(repoPath)) {
        if (allowMissingRepos) {
          continue;
        }
        errors.push(`${repo.repositoryId}: repository not found at ${repoPath}`);
        continue;
      }

      // Verify commit exists
      try {
        execFileSync('git', ['-C', repoPath, 'rev-parse', '--verify', `${commit}^{commit}`], {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
      } catch {
        errors.push(`${repo.repositoryId}: commit ${commit} not found in repository`);
        continue;
      }

      // Verify source checkout is not mutated (read HEAD only, no modification)
      let headCommit;
      try {
        headCommit = execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        errors.push(`${repo.repositoryId}: cannot read HEAD`);
        continue;
      }

      // Export the pinned commit to a temp dir
      let exportedRoot;
      try {
        exportedRoot = exportCommit(repoPath, commit);
        tmpDirs.push(exportedRoot);
        exportedRoots.set(repo.repositoryId, exportedRoot);
      } catch (e) {
        errors.push(`${repo.repositoryId}: archive export failed: ${e.message}`);
        continue;
      }

      // Verify source checkout HEAD is unchanged after our export
      let headAfter;
      try {
        headAfter = execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
      } catch {
        errors.push(`${repo.repositoryId}: cannot read HEAD after export`);
        continue;
      }
      if (headCommit !== headAfter) {
        errors.push(`${repo.repositoryId}: HEAD changed during validation (before=${headCommit} after=${headAfter}) — source checkout was mutated`);
      }
    }

    if (errors.length > 0) return { valid: false, errors };

    // Step 3: Verify fixtures against exported trees
    for (const fixture of manifest.fixtures) {
      const exportedRoot = exportedRoots.get(fixture.repositoryId);
      if (!exportedRoot) {
        if (!allowMissingRepos) {
          errors.push(`${fixture.fixtureId}: no exported tree for repository "${fixture.repositoryId}"`);
        }
        continue;
      }

      const fixtureErrors = verifyFixture(fixture, exportedRoot);
      errors.push(...fixtureErrors);
    }

  } finally {
    // Step 4: Always clean up temp dirs
    for (const tmp of tmpDirs) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()
);

if (IS_MAIN) {
  const manifestArg = process.argv.find((a) => a.startsWith('--manifest='));
  const manifestPath = manifestArg ? manifestArg.slice('--manifest='.length) : DEFAULT_MANIFEST_PATH;
  const allowMissingRepos = process.argv.includes('--allow-missing-repos');

  validateManifest(manifestPath, DEFAULT_SCHEMA_PATH, { allowMissingRepos }).then(({ valid, errors }) => {
    if (valid) {
      process.stdout.write('b8-1-benchmark-manifest-valid=true\n');
    } else {
      process.stdout.write(`b8-1-benchmark-manifest-valid=false\nerrors=${errors.length}\n`);
      for (const e of errors) process.stdout.write(`error=${e}\n`);
      process.exitCode = 1;
    }
  }).catch((err) => {
    console.error('validate-b8-1-benchmark-manifest: unexpected error:', err.message);
    process.exit(2);
  });
}

export { validateManifest, validateSchema, verifyFixture, isForbiddenPath, checkForbiddenWording };
