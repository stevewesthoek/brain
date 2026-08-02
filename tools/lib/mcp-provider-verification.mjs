/**
 * mcp-provider-verification.mjs
 *
 * Shared provider-verification module used by both:
 *   - tools/validate-mcp-provider-admissions.mjs
 *   - tools/validate-mcp-runtime-truth.mjs
 *
 * Returns structured verification results with separate fields:
 *   revisionVerified, sourceArtifactsVerified, runtimeEntrypointVerified,
 *   runtimeArtifactsVerified, admissionEligible, issues, warnings
 *
 * Semantics:
 *   - Git provider root: HEAD must equal admitted revision. Mismatch = failure.
 *   - Non-Git exported root: requires --provider-revision attestation. Missing = failure.
 *   - Working-tree-only artifacts: never count as source-verified or runtime-verified.
 *   - Working-tree-only entrypoint: runtimeEntrypointVerified=false.
 *   - Candidate with source-only: may have admissionEligible=false (incomplete, not fully failed).
 *   - Active-local: must pass all verification fields or it fails.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * @typedef {Object} ProviderVerificationResult
 * @property {string} providerId
 * @property {string} admissionId
 * @property {string} status - admission status
 * @property {boolean} revisionVerified
 * @property {boolean} sourceArtifactsVerified
 * @property {boolean} runtimeEntrypointVerified
 * @property {boolean} runtimeArtifactsVerified
 * @property {boolean} admissionEligible
 * @property {string[]} issues
 * @property {string[]} warnings
 */

function digest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isWorkingTreeOnly(artifact) {
  return typeof artifact.note === 'string' && artifact.note.includes('working-tree-only');
}

function isVirtualPath(artifactPath) {
  return artifactPath.startsWith('archive:') || artifactPath.startsWith('npm:');
}

/**
 * Verify a single provider against its admission entry.
 *
 * @param {Object} params
 * @param {Object} params.admission - full admission record from registry
 * @param {string} params.rootPath - absolute path to provider root (exported or git)
 * @param {string|null} params.explicitRevision - revision from --provider-revision, or null
 * @returns {ProviderVerificationResult}
 */
export function verifyProvider({ admission, rootPath, explicitRevision = null }) {
  const providerId = admission.provider?.providerId ?? admission.admissionId;
  const admissionId = admission.admissionId;
  const admittedRevision = admission.provider?.revision;
  const status = admission.status;
  const issues = [];
  const warnings = [];

  let revisionVerified = false;
  let sourceArtifactsVerified = false;
  let runtimeEntrypointVerified = false;
  let runtimeArtifactsVerified = false;

  // Resolve root path
  const root = path.resolve(rootPath);

  // Validate root is a non-symlink directory
  try {
    const stat = fs.lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      issues.push(`${providerId}: provider root must be a non-symlink directory`);
      return { providerId, admissionId, status, revisionVerified, sourceArtifactsVerified, runtimeEntrypointVerified, runtimeArtifactsVerified, admissionEligible: false, issues, warnings };
    }
  } catch {
    issues.push(`${providerId}: provider root does not exist`);
    return { providerId, admissionId, status, revisionVerified, sourceArtifactsVerified, runtimeEntrypointVerified, runtimeArtifactsVerified, admissionEligible: false, issues, warnings };
  }

  // Determine if root is a Git repo
  let headRevision = null;
  let isGitRoot = false;
  try {
    headRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    isGitRoot = true;
  } catch {
    // not a git repo — exported tree
  }

  // Revision verification
  if (isGitRoot) {
    // Git root: HEAD must match admitted revision
    if (headRevision === admittedRevision) {
      revisionVerified = true;
      // If caller also supplied an explicit revision, it must agree
      if (explicitRevision !== null && explicitRevision !== headRevision) {
        issues.push(`${providerId}: explicit-revision-disagrees-with-git-head`);
        revisionVerified = false;
      }
    } else {
      issues.push(`${providerId}: revision-mismatch (HEAD=${headRevision} admitted=${admittedRevision})`);
    }
  } else {
    // Non-Git exported root: require explicit revision binding
    if (explicitRevision === null) {
      issues.push(`${providerId}: non-git-root-requires-explicit-provider-revision`);
    } else if (explicitRevision !== admittedRevision) {
      issues.push(`${providerId}: explicit-revision-mismatch (given=${explicitRevision} admitted=${admittedRevision})`);
    } else {
      revisionVerified = true;
    }
  }

  // Artifact verification (source and runtime)
  const artifacts = admission.provider?.artifacts ?? [];
  const entrypoint = admission.provider?.entrypoint;

  let allSourceArtifactsVerified = true;
  let allRuntimeArtifactsVerified = true;
  let entrypointFound = false;
  let entrypointIsWorkingTreeOnly = false;

  for (const artifact of artifacts) {
    // Skip virtual paths (archive:, npm:)
    if (isVirtualPath(artifact.path)) continue;

    const isWTO = isWorkingTreeOnly(artifact);
    const isEntrypoint = artifact.path === entrypoint;

    if (isEntrypoint) {
      entrypointFound = true;
      if (isWTO) {
        entrypointIsWorkingTreeOnly = true;
      }
    }

    if (isWTO) {
      // Working-tree-only: never counts as source-verified or runtime-verified
      if (isEntrypoint) {
        issues.push(`${providerId}: runtime-entrypoint-unverified (${entrypoint} is working-tree-only)`);
      }
      allSourceArtifactsVerified = false;
      if (isEntrypoint) allRuntimeArtifactsVerified = false;
      continue;
    }

    // Attempt to verify committed artifact
    const artifactPath = path.join(root, artifact.path);
    try {
      const actualDigest = digest(artifactPath);
      if (actualDigest !== artifact.sha256) {
        issues.push(`${providerId}/${artifact.path}: artifact-digest-mismatch`);
        allSourceArtifactsVerified = false;
        if (isEntrypoint) allRuntimeArtifactsVerified = false;
      }
    } catch {
      issues.push(`${providerId}/${artifact.path}: artifact-read-error`);
      allSourceArtifactsVerified = false;
      if (isEntrypoint) allRuntimeArtifactsVerified = false;
    }
  }

  // Only set sourceArtifactsVerified if revision is verified AND all non-WTO artifacts pass
  if (revisionVerified && allSourceArtifactsVerified && artifacts.length > 0) {
    sourceArtifactsVerified = true;
  }

  // Runtime entrypoint verification
  if (entrypoint && !entrypointIsWorkingTreeOnly && revisionVerified) {
    runtimeEntrypointVerified = allRuntimeArtifactsVerified;
  } else if (entrypoint && entrypointIsWorkingTreeOnly) {
    runtimeEntrypointVerified = false;
  }

  // Runtime artifacts verified (all non-WTO artifacts pass digest check and revision verified)
  if (revisionVerified && allRuntimeArtifactsVerified && artifacts.length > 0) {
    runtimeArtifactsVerified = true;
  }

  // Admission eligibility
  // Active-local: must have all four fields true
  // Candidate: may have sourceArtifactsVerified=true but runtimeEntrypointVerified=false → incomplete, not eligible
  let admissionEligible = false;
  if (status === 'active-local' || status === 'active') {
    admissionEligible = revisionVerified && sourceArtifactsVerified && runtimeEntrypointVerified && runtimeArtifactsVerified;
    if (!admissionEligible) {
      if (!issues.some((i) => i.includes(providerId))) {
        issues.push(`${providerId}: active-local admission does not meet full verification requirements`);
      }
    }
  } else if (status === 'candidate') {
    // Candidate: source-verified but runtime not required
    admissionEligible = false; // candidates are never eligible for active-local use
    if (sourceArtifactsVerified && !runtimeEntrypointVerified) {
      warnings.push(`${providerId}: candidate source-verified but runtime entrypoint not verified — incomplete`);
    }
  }

  return {
    providerId,
    admissionId,
    status,
    revisionVerified,
    sourceArtifactsVerified,
    runtimeEntrypointVerified,
    runtimeArtifactsVerified,
    admissionEligible,
    issues,
    warnings,
  };
}

/**
 * Verify all providers with given roots.
 * Returns aggregate results and per-provider details.
 *
 * @param {Object} params
 * @param {Object} params.admissionRegistry - full registry JSON
 * @param {Map<string,string>} params.providerRoots - map of providerId → rootPath
 * @param {Map<string,string>} params.providerRevisions - map of providerId → explicit revision
 * @returns {{ results: ProviderVerificationResult[], admissionsCount: number, sourceVerifiedCount: number, runtimeVerifiedCount: number, incompleteCount: number, issues: string[], warnings: string[] }}
 */
export function verifyAllProviders({ admissionRegistry, providerRoots, providerRevisions = new Map() }) {
  const allIssues = [];
  const allWarnings = [];
  const results = [];

  // Check for duplicate provider bindings
  const seenIds = new Set();
  for (const providerId of providerRoots.keys()) {
    if (seenIds.has(providerId)) {
      allIssues.push(`duplicate-provider-binding: ${providerId}`);
    }
    seenIds.add(providerId);
  }

  if (allIssues.length > 0) {
    return { results, admissionsCount: admissionRegistry?.admissions?.length ?? 0, sourceVerifiedCount: 0, runtimeVerifiedCount: 0, incompleteCount: 0, issues: allIssues, warnings: allWarnings };
  }

  for (const [providerId, rootPath] of providerRoots) {
    // Find the admission by providerId or admissionId
    const admission = admissionRegistry?.admissions?.find(
      (a) => (a.provider?.providerId ?? a.admissionId) === providerId
    );

    if (!admission) {
      allIssues.push(`${providerId}: unknown-provider-id`);
      results.push({
        providerId,
        admissionId: providerId,
        status: 'unknown',
        revisionVerified: false,
        sourceArtifactsVerified: false,
        runtimeEntrypointVerified: false,
        runtimeArtifactsVerified: false,
        admissionEligible: false,
        issues: [`${providerId}: unknown-provider-id`],
        warnings: [],
      });
      continue;
    }

    const explicitRevision = providerRevisions.get(providerId) ?? null;
    const result = verifyProvider({ admission, rootPath, explicitRevision });
    results.push(result);
    allIssues.push(...result.issues);
    allWarnings.push(...result.warnings);
  }

  const sourceVerifiedCount = results.filter((r) => r.sourceArtifactsVerified).length;
  const runtimeVerifiedCount = results.filter((r) => r.runtimeEntrypointVerified && r.runtimeArtifactsVerified).length;
  const incompleteCount = results.filter((r) => r.sourceArtifactsVerified && !r.runtimeEntrypointVerified).length;

  return {
    results,
    admissionsCount: admissionRegistry?.admissions?.length ?? 0,
    sourceVerifiedCount,
    runtimeVerifiedCount,
    incompleteCount,
    issues: allIssues,
    warnings: allWarnings,
  };
}

/**
 * Format the structured output summary line.
 * Does NOT print providers_verified — only separate source/runtime counts.
 */
export function formatVerificationSummary({ admissionsCount, sourceVerifiedCount, runtimeVerifiedCount, incompleteCount }) {
  return [
    `admissions=${admissionsCount}`,
    `providers_source_verified=${sourceVerifiedCount}`,
    `providers_runtime_verified=${runtimeVerifiedCount}`,
    `providers_incomplete=${incompleteCount}`,
  ].join('\n');
}
