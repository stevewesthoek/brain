#!/usr/bin/env node
/**
 * validate-b8-1-benchmark-manifest.mjs
 *
 * Validates the B8.1 context-memory benchmark manifest using real JSON Schema
 * validation (Ajv 2020-12) plus semantic fixture verification against exported trees.
 *
 * NEVER modifies any source checkout.
 * Creates temporary git archive exports only, removed after validation.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const Ajv2020 = require('ajv/dist/2020');

const DEFAULT_MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const DEFAULT_SCHEMA_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.schema.json');

// ---------------------------------------------------------------------------
// Forbidden path prefixes
// ---------------------------------------------------------------------------

const FORBIDDEN_PATH_PATTERNS = [
  /\/mind\//i, /^mind\//i,
  /\.env$/i, /credentials/i, /secrets/i, /\.token$/i, /\.pem$/i,
  /\/\.brain\/cache\//i, /\/Library\/Caches\//i, /node_modules/,
  /graphify-out\//, /dist\//,
  /\.codebase-memory\//,
];

function isForbiddenPath(filePath) {
  return FORBIDDEN_PATH_PATTERNS.some(p => p.test(filePath));
}

// ---------------------------------------------------------------------------
// Forbidden approximation wording
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDING = [
  'or equivalent', 'approximately', 'main function',
  'a config file', 'the relevant route', 'some function', 'similar to',
];

function checkForbiddenWording(text) {
  if (!text) return null;
  for (const phrase of FORBIDDEN_WORDING) {
    if (text.toLowerCase().includes(phrase)) return phrase;
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSON Schema validation with Ajv 2020-12
// ---------------------------------------------------------------------------

function validateSchemaWithAjv(manifest, schemaObj) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schemaObj);
  const valid = validate(manifest);
  if (!valid) {
    return (validate.errors || []).map(e => `Schema: ${e.instancePath || '/'} ${e.message}`);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Semantic validation (beyond what JSON Schema catches)
// ---------------------------------------------------------------------------

function validateSchema(manifest, schemaObj) {
  const errors = [];

  // Run Ajv first
  const ajvErrors = validateSchemaWithAjv(manifest, schemaObj);
  errors.push(...ajvErrors);
  if (ajvErrors.length > 0) return errors;

  // Additional semantic checks
  const fixtureIds = new Set();
  for (const fixture of manifest.fixtures ?? []) {
    if (fixtureIds.has(fixture.fixtureId)) errors.push(`fixture: duplicate fixtureId "${fixture.fixtureId}"`);
    fixtureIds.add(fixture.fixtureId);

    const repoMatch = (manifest.repositories ?? []).find(r => r.repositoryId === fixture.repositoryId);
    if (!repoMatch) {
      errors.push(`${fixture.fixtureId}: repositoryId "${fixture.repositoryId}" not in repositories`);
      continue;
    }

    // Fixture pinnedCommit must equal repository pinnedCommit
    if (fixture.pinnedCommit && repoMatch.pinnedCommit && fixture.pinnedCommit !== repoMatch.pinnedCommit) {
      errors.push(`${fixture.fixtureId}: pinnedCommit ${fixture.pinnedCommit.slice(0, 12)} differs from repository ${repoMatch.pinnedCommit.slice(0, 12)}`);
    }

    // Symbolic ref rejection
    if (/^(main|master|HEAD|origin|develop|release)/.test(fixture.pinnedCommit ?? '')) {
      errors.push(`${fixture.fixtureId}: pinnedCommit must not be a symbolic ref`);
    }

    // Path normalization checks
    if (fixture.expectedFile) {
      if (path.isAbsolute(fixture.expectedFile)) errors.push(`${fixture.fixtureId}: expectedFile must be relative`);
      if (fixture.expectedFile.includes('..')) errors.push(`${fixture.fixtureId}: expectedFile contains path traversal`);
      if (isForbiddenPath(fixture.expectedFile)) errors.push(`${fixture.fixtureId}: expectedFile enters forbidden area`);
    }

    // Verification path checks
    if (fixture.verification?.path) {
      if (path.isAbsolute(fixture.verification.path)) errors.push(`${fixture.fixtureId}: verification.path must be relative`);
      if (fixture.verification.path.includes('..')) errors.push(`${fixture.fixtureId}: verification.path contains path traversal`);
    }

    // Forbidden wording
    for (const field of ['question', 'expectedFile', 'expectedSymbol', 'expectedLiteral', 'notes']) {
      const found = checkForbiddenWording(fixture[field]);
      if (found) errors.push(`${fixture.fixtureId}: forbidden wording "${found}" in field "${field}"`);
    }

    // Caller/callee must be arrays
    if (fixture.expectedCallers !== undefined && !Array.isArray(fixture.expectedCallers)) {
      errors.push(`${fixture.fixtureId}: expectedCallers must be an explicit array`);
    }
    if (fixture.expectedCallees !== undefined && !Array.isArray(fixture.expectedCallees)) {
      errors.push(`${fixture.fixtureId}: expectedCallees must be an explicit array`);
    }

    // callerCalleeApplicable with non-empty arrays: arrays must be verifiable
    if (fixture.callerCalleeApplicable && fixture.expectedCallers?.length > 0) {
      for (const caller of fixture.expectedCallers) {
        if (path.isAbsolute(caller)) errors.push(`${fixture.fixtureId}: caller path must be relative: ${caller}`);
        if (caller.includes('..')) errors.push(`${fixture.fixtureId}: caller path has traversal: ${caller}`);
      }
    }
  }

  // Repository symbolic ref rejection
  for (const repo of manifest.repositories ?? []) {
    if (/^(main|master|HEAD|origin|develop|release)/.test(repo.pinnedCommit ?? '')) {
      errors.push(`${repo.repositoryId}: pinnedCommit must not be a symbolic ref`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Symlink escape detection in exported tree (defect #8)
// ---------------------------------------------------------------------------

/**
 * Returns an error string if relPath (relative to exportedRoot) resolves outside
 * exportedRoot via symlinks, or null if safe (or path doesn't exist).
 */
function checkSymlinkEscape(exportedRoot, relPath) {
  const fullPath = path.join(exportedRoot, relPath);
  let resolvedPath;
  try {
    resolvedPath = fs.realpathSync(fullPath);
  } catch {
    return null; // path doesn't exist; handled by the caller as a missing-file error
  }
  let resolvedRoot;
  try {
    resolvedRoot = fs.realpathSync(exportedRoot);
  } catch {
    return null;
  }
  const rel = path.relative(resolvedRoot, resolvedPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return `symlink escape: "${relPath}" resolves outside exported root (→ ${resolvedPath})`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Structured verification execution
// ---------------------------------------------------------------------------

/**
 * Verify a structured verification object against an exported tree root.
 *
 * @param {object} verification
 * @param {string} exportedRoot  - Absolute path to the exported tree root.
 * @returns {string[]} errors (empty = pass)
 */
function verifyStructuredVerification(verification, exportedRoot) {
  const errors = [];
  const algo = verification.algorithm;

  if (algo === 'line-contains' || algo === 'symbol-at-line') {
    // Symlink escape check
    const escapeErr = checkSymlinkEscape(exportedRoot, verification.path);
    if (escapeErr) { errors.push(`verification: ${escapeErr}`); return errors; }

    const filePath = path.join(exportedRoot, verification.path);
    if (!fs.existsSync(filePath)) {
      errors.push(`verification: file not found: ${verification.path}`);
      return errors;
    }
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const lineIdx = verification.line - 1;
    if (lineIdx >= lines.length) {
      errors.push(`verification: line ${verification.line} beyond file length ${lines.length}`);
      return errors;
    }
    const lineText = lines[lineIdx];
    for (const needle of verification.contains || []) {
      if (!lineText.includes(needle)) {
        errors.push(`verification: "${needle}" not found at line ${verification.line} of ${verification.path}: "${lineText.trim()}"`);
      }
    }
  } else if (algo === 'file-name-count') {
    const root = path.join(exportedRoot, verification.root || '.');
    const count = countFiles(root, verification.fileName);
    if (count !== verification.expectedCount) {
      errors.push(`verification: file count mismatch for ${verification.fileName} (expected=${verification.expectedCount} actual=${count})`);
    }
  } else if (algo === 'json-pointer-set') {
    // Symlink escape check
    const escapeErr = checkSymlinkEscape(exportedRoot, verification.path);
    if (escapeErr) { errors.push(`verification: ${escapeErr}`); return errors; }

    const filePath = path.join(exportedRoot, verification.path);
    if (!fs.existsSync(filePath)) {
      errors.push(`verification: file not found: ${verification.path}`);
      return errors;
    }
    let data;
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {
      errors.push(`verification: JSON parse error: ${e.message}`);
      return errors;
    }
    const value = resolveJsonPointer(data, verification.jsonPointer);
    if (value === undefined) {
      errors.push(`verification: JSON pointer ${verification.jsonPointer} resolved to undefined`);
      return errors;
    }
    const expected = verification.expected;
    let actual;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].name) {
      actual = value.map(v => v.name);
    } else if (Array.isArray(value)) {
      actual = value;
    } else {
      actual = [value];
    }
    const expectedSet = new Set(Array.isArray(expected) ? expected : [expected]);
    const actualSet = new Set(actual);
    if (expectedSet.size !== actualSet.size || ![...expectedSet].every(e => actualSet.has(e))) {
      errors.push(`verification: set mismatch at ${verification.jsonPointer}: expected=[${[...expectedSet]}] actual=[${[...actualSet]}]`);
    }
  } else if (algo === 'file-exists') {
    // Symlink escape check
    if (verification.path) {
      const escapeErr = checkSymlinkEscape(exportedRoot, verification.path);
      if (escapeErr) { errors.push(`verification: ${escapeErr}`); return errors; }
    }

    const filePath = path.join(exportedRoot, verification.path);
    if (!fs.existsSync(filePath)) {
      errors.push(`verification: file not found: ${verification.path}`);
    }
  }

  return errors;
}

function resolveJsonPointer(obj, pointer) {
  const parts = pointer.split('/').slice(1);
  let current = obj;
  for (const part of parts) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(key, 10);
      current = current[idx];
    } else {
      current = current[key];
    }
  }
  return current;
}

function countFiles(root, name) {
  let count = 0;
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else if (entry.name === name) count++;
      }
    } catch { /* skip inaccessible */ }
  }
  walk(root);
  return count;
}

// ---------------------------------------------------------------------------
// Git archive export
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
// Legacy verifyFixture (for backward compatibility with tests)
// ---------------------------------------------------------------------------

/**
 * Verify a fixture against an exported tree root.
 * Supports both structured verification objects and legacy expectedFile/expectedLine checks.
 *
 * @param {object} fixture
 * @param {string} exportedRoot  - Absolute path to the exported tree root.
 * @returns {string[]} errors (empty = pass)
 */
function verifyFixture(fixture, exportedRoot) {
  const errors = [];

  if (fixture.verification) {
    return verifyStructuredVerification(fixture.verification, exportedRoot);
  }

  if (fixture.scoringType === 'count-match') {
    const count = countFiles(exportedRoot, fixture.verification?.fileName || 'route.ts');
    if (count !== fixture.expectedFileCount) {
      errors.push(`${fixture.fixtureId}: file count mismatch (expected=${fixture.expectedFileCount} actual=${count})`);
    }
    return errors;
  }

  if (!fixture.expectedFile) return errors;

  // Symlink escape check
  const escapeErr = checkSymlinkEscape(exportedRoot, fixture.expectedFile);
  if (escapeErr) {
    errors.push(`${fixture.fixtureId}: ${escapeErr}`);
    return errors;
  }

  const filePath = path.join(exportedRoot, fixture.expectedFile);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push(`${fixture.fixtureId}: expectedFile not found: ${fixture.expectedFile}`);
    return errors;
  }

  if (fixture.expectedLine) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const lineIdx = fixture.expectedLine - 1;
    if (lineIdx >= lines.length) {
      errors.push(`${fixture.fixtureId}: expectedLine ${fixture.expectedLine} beyond file length`);
    } else {
      const lineText = lines[lineIdx];
      if (fixture.expectedSymbol && !lineText.includes(fixture.expectedSymbol)) {
        errors.push(`${fixture.fixtureId}: expectedSymbol "${fixture.expectedSymbol}" not found at line ${fixture.expectedLine}`);
      }
      if (fixture.expectedLiteral && !lineText.includes(fixture.expectedLiteral)) {
        errors.push(`${fixture.fixtureId}: expectedLiteral not found at line ${fixture.expectedLine}`);
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

/**
 * Validate a manifest file.
 *
 * @param {string} manifestPath
 * @param {string} schemaPath
 * @param {{
 *   allowMissingRepos?: boolean,
 *   exportedRootBindings?: Record<string, string>
 * }} [options]
 *   exportedRootBindings: map of repositoryId → absolute path to pre-exported tree.
 *     When provided for a repository, skips git archive export and uses the path directly.
 *     The caller is responsible for cleanup of provided paths.
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
async function validateManifest(manifestPath, schemaPath, { allowMissingRepos = false, exportedRootBindings = {} } = {}) {
  const errors = [];
  const tmpDirs = []; // only dirs WE created via git archive; not caller-provided bindings

  try {
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {
      errors.push(`manifest-parse-error: ${e.message}`);
      return { valid: false, errors };
    }

    let schema;
    try { schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')); } catch (e) {
      errors.push(`schema-parse-error: ${e.message}`);
      return { valid: false, errors };
    }

    const schemaErrors = validateSchema(manifest, schema);
    errors.push(...schemaErrors);
    if (errors.length > 0) return { valid: false, errors };

    const exportedRoots = new Map();

    for (const repo of manifest.repositories) {
      // Defect #8: Use caller-provided exported root bindings when available
      if (exportedRootBindings[repo.repositoryId]) {
        const providedRoot = exportedRootBindings[repo.repositoryId];
        if (!fs.existsSync(providedRoot)) {
          errors.push(`${repo.repositoryId}: provided exported root not found: ${providedRoot}`);
          continue;
        }
        // Verify no symlink escape from the provided root itself
        let resolvedProvided;
        try {
          resolvedProvided = fs.realpathSync(providedRoot);
        } catch (e) {
          errors.push(`${repo.repositoryId}: cannot resolve provided root: ${e.message}`);
          continue;
        }
        exportedRoots.set(repo.repositoryId, resolvedProvided);
        continue; // skip git archive export
      }

      if (!fs.existsSync(repo.localPath)) {
        if (allowMissingRepos) continue;
        errors.push(`${repo.repositoryId}: repository not found at ${repo.localPath}`);
        continue;
      }

      try {
        execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] });
      } catch {
        errors.push(`${repo.repositoryId}: commit ${repo.pinnedCommit} not found`);
        continue;
      }

      let headBefore;
      try { headBefore = execFileSync('git', ['-C', repo.localPath, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {
        errors.push(`${repo.repositoryId}: cannot read HEAD`);
        continue;
      }

      let exportedRoot;
      try {
        exportedRoot = exportCommit(repo.localPath, repo.pinnedCommit);
        tmpDirs.push(exportedRoot);
        exportedRoots.set(repo.repositoryId, exportedRoot);
      } catch (e) {
        errors.push(`${repo.repositoryId}: archive export failed: ${e.message}`);
        continue;
      }

      let headAfter;
      try { headAfter = execFileSync('git', ['-C', repo.localPath, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {
        errors.push(`${repo.repositoryId}: cannot read HEAD after export`);
        continue;
      }

      // Defect #8: commit diff detection
      if (headBefore !== headAfter) {
        errors.push(`${repo.repositoryId}: HEAD changed during validation (before=${headBefore.slice(0,12)} after=${headAfter.slice(0,12)})`);
      }
    }

    if (errors.length > 0) return { valid: false, errors };

    for (const fixture of manifest.fixtures) {
      const exportedRoot = exportedRoots.get(fixture.repositoryId);
      if (!exportedRoot) {
        if (!allowMissingRepos) errors.push(`${fixture.fixtureId}: no exported tree for "${fixture.repositoryId}"`);
        continue;
      }

      if (fixture.verification) {
        const verErrors = verifyStructuredVerification(fixture.verification, exportedRoot);
        errors.push(...verErrors.map(e => `${fixture.fixtureId}: ${e}`));
      } else {
        const fixtureErrors = verifyFixture(fixture, exportedRoot);
        errors.push(...fixtureErrors);
      }
    }

  } finally {
    for (const tmp of tmpDirs) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
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
  const manifestArg = process.argv.find(a => a.startsWith('--manifest='));
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
  }).catch(err => {
    console.error('validate-b8-1-benchmark-manifest: unexpected error:', err.message);
    process.exit(2);
  });
}

export { validateManifest, validateSchema, verifyFixture, verifyStructuredVerification, isForbiddenPath, checkForbiddenWording };
