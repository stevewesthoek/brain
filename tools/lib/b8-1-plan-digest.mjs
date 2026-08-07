/**
 * b8-1-plan-digest.mjs
 *
 * Authoritative single-source digest contract for B8.1 benchmark plans.
 *
 * All five B8.1 tools import from here so the digest projection is computed
 * identically everywhere:
 *   - prepare-b8-1-context-memory-benchmark.mjs  (preflight)
 *   - execute-b8-1-benchmark.mjs                 (executor)
 *   - validate-b8-1-benchmark-evidence.mjs       (evidence validator)
 *   - verify-b8-1-plan-digest.mjs                (standalone verifier)
 *   - *.test.mjs                                 (tests)
 *
 * Digest contract (planVersion 7.1.0 — v7r):
 *   Hashed fields  — logical authority over what was approved:
 *     - plan/run metadata (planVersion, runId, partialEvidence, subjects, excludedSubjects)
 *     - repo-relative Brain artifact paths + content hashes
 *     - pinned repository commits
 *     - subject binary identity (stable path, resolved path, version, sha256)
 *     - network isolation: adapter identity (path+sha256) and runtime identity (path+sha256+version)
 *       [both are external binaries, intentionally machine-bound]
 *     - network isolation: child sha256 and profile sha256
 *       [content-addressed; paths are Brain-worktree-local and excluded]
 *     - graphify status, governance sha256, profile sha256
 *       [paths are Brain-worktree-local and excluded]
 *     - disk result, source state hash, source logical identity
 *     - normalized checks (name, status, detail)
 *
 *   Excluded fields — run-local / observational / injected after hashing:
 *     - planSha256       (injected by --write-plan or materialize)
 *     - createdAt        (observational timestamp)
 *     - runContext       (physical run-dir and planned-write-path list)
 *
 *   Brain-worktree paths excluded from digest (content SHAs remain):
 *     - networkIsolationProof.childIdentity.path
 *     - networkIsolationProof.profilePath
 *     - cbmVerification.networkIsolationProof.childIdentity.path
 *     - cbmVerification.networkIsolationProof.profilePath
 *     - graphifyStatus.governancePath
 *     - graphifyStatus.profilePath
 *   These paths differ across worktrees and machines; their SHA-256 hashes remain in the digest.
 *   External binary/runtime paths (sandbox-exec, Node.js) are retained as intentionally machine-bound.
 */

import crypto from 'node:crypto';

export const PLAN_VERSION = '7.1.0';
export const DIGEST_CONTRACT_VERSION = '7.1.0';

// ---------------------------------------------------------------------------
// Known stale digests — must not be accepted as valid by any consumer.
// ---------------------------------------------------------------------------
export const KNOWN_STALE_DIGESTS = new Set([
  'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4', // v1 (path-dependent /tmp paths)
  '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda', // v2 (path-dependent brain-b8-1-authorization worktree)
  '40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0', // v4 (stale — wrong env/sandbox/one-index contract; v4r supersedes)
  'c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4', // v4r (stale — stale pins brain 257fd72c/workbench f482851/prochat e404821; v5 supersedes)
  'd9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42', // v5 (stale — path-dependent source-root-overrides check detail; v5r supersedes)
  '87c0569a3b643cf628684b10b95ee76f0f2edc6fc2aa2261904075bec3b6ce3f', // v5r (stale — Brain-worktree paths in childIdentity.path, profilePath, governancePath; v5s supersedes)
  '47ed2a0392c7e8606980ca1bce2a796c9dbee4ae1e9f5ba7f8a373d7f1a7f4f0', // v5s (stale for new runs — executed 2026-08-05, rejected as insufficient; harness defects + missing per-subject metrics; v6 supersedes)
  'ac5b3c79a9cce3e2463dceac8097dada7bb883f313ebef5e696078296a1359dc', // v6 (stale — missing implementationIdentity, missing subjectMetrics, offlineMetrics only; v6r supersedes)
  '44ebf1c49863d4cacaa6d26af348781473440f43b774ea69f52ae0aab6cc100d', // v6r (stale — CPU hardcoded 0, RSS measures executor not subject, no CBM refresh measurement, shared cache duplicated, false cl100k_base identity, validator gaps; v7 supersedes)
  '331695165eb9dd91b061efc414d7a4e9711828d581c4c46511dea1c5812038e2', // claimed v7r digest from incomplete 0-byte/untracked plan; never established or approvable
  '0eec69c1befd7ce11f359fe53aef4f033dbb38a5f767f73bad2800b8db37efa0', // v7r (failed 2026-08-06 — CBM query output not array; incrementalReindex SHA256 2b15855f obsolete; v7s supersedes with fixed marker-query)
  '90ef52be30be8db5f2df34d04ba8c07f7e16d32798f131c741d627b3f60bcc66', // v7s (noncanonical hand-simplified dry-run; missing implementationIdentity, missing source-state-binding checks, receiptVersion=1.0.0 not 7.1.0; v7t supersedes with real CLI output)
  '1c0892469683acba82534d3cd7c3f27aae9368a54a5a5fe49989de13aca067e4', // v7t (Node v25.9.0 runtime binding — violated required Node 20 stop condition; canonical plan but noncompliant authorization; never materialized/executed; v7u supersedes with explicit Node 20.20.2 binding)
]);

// ---------------------------------------------------------------------------
// Top-level fields excluded from the digest.
// ---------------------------------------------------------------------------
export const DIGEST_EXCLUDED_TOP_LEVEL = new Set(['planSha256', 'createdAt', 'runContext']);

// Annotation prefix — fields starting with '_' are template-only.
export const ANNOTATION_PREFIX = '_';

// ---------------------------------------------------------------------------
// Canonical top-level allowed fields (explicit allowlist for unknown-field rejection).
// Fields in DIGEST_EXCLUDED_TOP_LEVEL are valid but excluded from the hash.
// ---------------------------------------------------------------------------
export const DIGEST_ALLOWED_TOP_LEVEL = new Set([
  // Excluded fields (valid in plan, excluded from hash)
  'planSha256',
  'createdAt',
  'runContext',
  // Digest fields
  'planVersion',
  'runId',
  'partialEvidence',
  'selectedSubjects',
  'excludedSubjects',
  'manifestRepoRelPath',
  'manifestHash',
  'manifestSchemaRepoRelPath',
  'manifestSchemaHash',
  'evidenceSchemaRepoRelPath',
  'evidenceSchemaHash',
  'pinnedRepositoryCommits',
  'subjectBinaryIdentity',
  'networkIsolationProof',
  'cbmVerification',
  'graphifyStatus',
  'diskResult',
  'sourceStateHash',
  'sourceLogicalIdentity',
  'checks',
  'implementationIdentity',
]);

// ---------------------------------------------------------------------------
// Deep projection helpers — strip Brain-worktree-local paths from proof objects
// before hashing, while retaining content-addressable SHAs.
// ---------------------------------------------------------------------------

/** Project a networkIsolationProof object for hashing. Strips childIdentity.path and profilePath. */
function projectNetworkProof(proof) {
  if (!proof || typeof proof !== 'object') return proof;
  const {
    childIdentity,
    profilePath: _profilePath,   // Brain-worktree-local path — excluded from digest
    ...rest
  } = proof;
  const projected = { ...rest };
  if (childIdentity && typeof childIdentity === 'object') {
    // Retain sha256 only; path is Brain-worktree-local
    const { path: _childPath, ...childRest } = childIdentity;
    projected.childIdentity = childRest;
  }
  return projected;
}

/** Project a graphifyStatus object for hashing. Strips governancePath and profilePath. */
function projectGraphifyStatus(status) {
  if (!status || typeof status !== 'object') return status;
  const {
    governancePath: _governancePath, // Brain-worktree-local — excluded
    profilePath: _profilePath,       // Brain-worktree-local — excluded
    ...rest
  } = status;
  return rest;
}

/** Project a cbmVerification object for hashing. Strips nested networkIsolationProof paths. */
function projectCbmVerification(cbmVerif) {
  if (!cbmVerif || typeof cbmVerif !== 'object') return cbmVerif;
  const { networkIsolationProof, ...rest } = cbmVerif;
  const projected = { ...rest };
  if (networkIsolationProof) {
    projected.networkIsolationProof = projectNetworkProof(networkIsolationProof);
  }
  return projected;
}

// ---------------------------------------------------------------------------
// Core digest algorithm
// ---------------------------------------------------------------------------

/** Deep-sort object keys canonically for deterministic JSON serialization. */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
}

/**
 * Project a raw canonical plan object to its digest input.
 * Excludes top-level excluded fields (planSha256, createdAt, runContext).
 * Strips Brain-worktree-local absolute paths from nested proof objects.
 * The result is the exact value that gets JSON-serialized and hashed.
 *
 * @param {object} plan
 * @returns {object} digest input
 */
export function projectForDigest(plan) {
  const digestInput = {};
  for (const [key, value] of Object.entries(plan)) {
    if (DIGEST_EXCLUDED_TOP_LEVEL.has(key)) continue;
    if (key.startsWith(ANNOTATION_PREFIX)) continue;
    switch (key) {
      case 'networkIsolationProof':
        digestInput[key] = projectNetworkProof(value);
        break;
      case 'graphifyStatus':
        digestInput[key] = projectGraphifyStatus(value);
        break;
      case 'cbmVerification':
        digestInput[key] = projectCbmVerification(value);
        break;
      default:
        digestInput[key] = value;
    }
  }
  return digestInput;
}

/**
 * Compute the deterministic SHA-256 digest of a canonical plan.
 *
 * This is the authoritative single implementation used by all B8.1 tools.
 * Accepts the raw plan object (with or without planSha256/createdAt/runContext);
 * those fields are excluded automatically via projectForDigest().
 *
 * @param {object} plan  - The canonical plan object as returned by buildCanonicalPlan or loaded from file.
 * @returns {string} 64-character lowercase hex SHA-256.
 */
export function computePlanDigest(plan) {
  const digestInput = projectForDigest(plan);
  const canonical = canonicalize(digestInput);
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

// ---------------------------------------------------------------------------
// Validation helpers (used by standalone verifier and tests)
// ---------------------------------------------------------------------------

/**
 * Scan any value recursively for BOUND_AT_PREFLIGHT placeholder strings.
 * Returns an array of dotted field paths containing placeholders.
 *
 * @param {any} value
 * @param {string} fieldPath
 * @returns {string[]}
 */
export function findPlaceholders(value, fieldPath = '') {
  if (typeof value === 'string' && value === 'BOUND_AT_PREFLIGHT') return [fieldPath];
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findPlaceholders(v, `${fieldPath}[${i}]`));
  }
  return Object.entries(value).flatMap(([k, v]) =>
    findPlaceholders(v, fieldPath ? `${fieldPath}.${k}` : k)
  );
}

/**
 * Recompute the plan digest from a plan object, also returning metadata about
 * which fields were excluded and which annotation fields were found.
 * Used by the standalone verifier to prove independent recomputability.
 *
 * @param {object} plan
 * @returns {{ digest: string, excludedFields: string[], annotationFields: string[] }}
 */
export function recomputeDigest(plan) {
  const excludedFields = [];
  const annotationFields = [];

  for (const key of Object.keys(plan)) {
    if (DIGEST_EXCLUDED_TOP_LEVEL.has(key)) excludedFields.push(key);
    else if (key.startsWith(ANNOTATION_PREFIX)) annotationFields.push(key);
  }

  const digest = computePlanDigest(plan);
  return { digest, excludedFields, annotationFields };
}

/**
 * Check a plan object for unknown top-level fields.
 * Returns an array of field names that are not in DIGEST_ALLOWED_TOP_LEVEL and
 * are not annotation fields (which are separately flagged).
 *
 * @param {object} plan
 * @returns {string[]} unknown field names
 */
export function findUnknownTopLevelFields(plan) {
  return Object.keys(plan).filter(
    key => !DIGEST_ALLOWED_TOP_LEVEL.has(key) && !key.startsWith(ANNOTATION_PREFIX)
  );
}
