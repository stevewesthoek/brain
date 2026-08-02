#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const defaultRoot = path.resolve(import.meta.dirname, '..');
const root = process.argv[2] === '--root' ? path.resolve(process.argv[3]) : (process.env.BRAIN_DOC_CONSISTENCY_ROOT ? path.resolve(process.env.BRAIN_DOC_CONSISTENCY_ROOT) : defaultRoot);
const files = [
  'operations/specs/infinite-brain-runtime-implementation-plan.md',
  'operations/specs/infinite-brain-runtime-roadmap.md',
  'operations/runbooks/infinite-brain-roadmap-status.md',
  'operations/specs/graphify-operational-profiles.json',
  'operations/specs/graphify-transition-governance.json',
];

const VERDICT_SOURCES = [
  'operations/specs/infinite-brain-runtime-implementation-plan.md',
  'operations/runbooks/infinite-brain-roadmap-status.md',
  'operations/reports/bs0-19-deletion-readiness-evaluation-2026-07-31.md',
  'operations/reports/roadmap-audit-2026-08-01.md',
];

const TEST_COUNT_SOURCES = [
  'operations/specs/infinite-brain-runtime-implementation-plan.md',
  'operations/runbooks/infinite-brain-roadmap-status.md',
  'operations/reports/bs0-19-deletion-readiness-evaluation-2026-07-31.md',
];

const DELETION_EVIDENCE_PATH = 'operations/specs/deletion-readiness-evidence.json';
const PATH_REGISTRY_PATH = 'operations/specs/infinite-brain-path-registry.json';
const inspectedFiles = [...new Set([
  ...files,
  ...VERDICT_SOURCES,
  ...TEST_COUNT_SOURCES,
  DELETION_EVIDENCE_PATH,
  PATH_REGISTRY_PATH,
])];

const stalePatterns = [
  'capture/inbox/',
  'capture/failed/',
  'live/tasks.md',
  'router/',
  'tasks.md',
  'tasks/',
  'graphify-out/',
];

const exceptionWords = ['historical', 'legacy', 'compatibility', 'archive', 'retained', 'retired', 'example'];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function checkStalePaths(content, relativePath, errors) {
  for (const pattern of stalePatterns) {
    const index = content.indexOf(pattern);
    if (index < 0) continue;
    const line = content.slice(0, index).split('\n').length;
    const lineText = content.split('\n')[line - 1] ?? '';
    if (!exceptionWords.some((word) => lineText.toLowerCase().includes(word))) {
      errors.push(`${relativePath}:${line}:stale-path:${pattern}`);
    }
  }
}

function checkBrokenLinks(content, relativePath, errors) {
  const linkPattern = /\[[^\]]+\]\((\.\.\/[^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const target = path.resolve(path.dirname(path.join(root, relativePath)), match[1]);
    if (!fs.existsSync(target)) errors.push(`${relativePath}:broken-link:${match[1]}`);
  }
}

function checkOwnerCounts(content, relativePath, errors) {
  const owners = [...content.matchAll(/^\*\*Owner:\*\*\s*(.+)$/gm)].map((match) => match[1].trim());
  if (owners.length !== new Set(owners).size) errors.push(`${relativePath}:duplicate-owner`);
}

function checkNextTaskClaims(content, relativePath, errors) {
  if (relativePath.includes('roadmap-status') && !content.includes('B1.0a — Deploy and verify Save-to-Mind target paths')) {
    errors.push(`${relativePath}:stale-next-task`);
  }
  if (relativePath.includes('infinite-brain-runtime-roadmap.md') && !content.includes('B1.0a guarded-deployment lane are complete')) {
    errors.push(`${relativePath}:stale-next-task`);
  }
}

function checkUnsupportedWording(content, relativePath, errors) {
  if (relativePath.includes('roadmap-status') && !content.includes('the first bounded measured-automation pilot batch')) errors.push(`${relativePath}:unsupported-capability-wording`);
}

// Prevents active roadmap/status documents from claiming P8 states that contradict
// documented evidence: a candidate CBM binary exists; historical B8 artifacts exist;
// an executable retention-policy validator exists; governance prohibits deletion.
function checkP8ContradictionClaims(content, relativePath, errors) {
  const isMd = relativePath.includes('roadmap-status') || relativePath.includes('roadmap.md') || relativePath.includes('implementation-plan.md');
  const isGovernanceJson = relativePath.includes('graphify-transition-governance.json');
  if (!isMd && !isGovernanceJson) return;

  if (isMd) {
    // Claim 1: "no Codebase Memory installation exists" — contradicted by provider-admission
    // README documenting the installed candidate binary at ~/.local/bin/codebase-memory-mcp.
    if (/no (codebase[- ]memory|CBM) installation exists/i.test(content)) {
      errors.push(`${relativePath}:p8-contradiction:false-no-cbm-installation`);
    }

    // Claim 1b: an installed preliminary candidate cannot coexist with wording that
    // places B8.1 before every Codebase Memory installation. B8.1 gates canonical
    // admission, activation, additional rollout, watcher/scheduler changes, and migration.
    const hasInstalledCandidateEvidence = /(?:candidate installation|existing pinned candidate binary|installed[^.\n]{0,100}(?:codebase[- ]memory|CBM)[^.\n]{0,80}candidate|(?:codebase[- ]memory|CBM)[^.\n]{0,100}candidate[^.\n]{0,80}installed)/i.test(content);
    const claimsB81PrecedesAnyInstallation = /B8\.1[^.\n]{0,240}before (?:any (?:codebase[- ]memory|CBM)(?: MCP)? installation|provider admission,\s*installation)/i.test(content);
    if (hasInstalledCandidateEvidence && claimsB81PrecedesAnyInstallation) {
      errors.push(`${relativePath}:p8-contradiction:false-preinstallation-sequencing`);
    }

    // Claim 1c: P8 is a phase; B8.1 is its first canonical task.
    if (/\bP8 is the first task\b/i.test(content)) {
      errors.push(`${relativePath}:p8-contradiction:phase-as-task`);
    }

    // Claim 2: P8 described as wholly or literally unstarted — contradicted by historical canary,
    // governance, and design artifacts under obsolete B8 numbering. Catches:
    //   "P8 is literally unstarted"
    //   "P8 ... is intentionally deferred and unstarted"
    //   "P8 has no prior work"
    //   "P8 was never started"
    if (/P8[^.]{0,80}(is literally unstarted|has no prior|was never started|deferred and unstarted)/i.test(content)) {
      errors.push(`${relativePath}:p8-contradiction:false-p8-wholly-unstarted`);
    }

    // Claim 3: historical B8.4/B8.5 labels treated as current canonical task authority —
    // those labels collide with canonical B8.4 (retrieval policy) and B8.5 (Graphify
    // semantic synthesis conversion).
    if (/\bB8\.4R\b.*current canonical/i.test(content) || /canonical.*\bB8\.5A\b/i.test(content)) {
      errors.push(`${relativePath}:p8-contradiction:obsolete-b8-label-as-canonical`);
    }

    // Claim 4: "Graphify has no executable retention policy" — contradicted by
    // validate-graphify-operational-profiles.mjs which enforces maxRuns and maxAgeDays.
    if (/graphify has no (executable )?retention.polic/i.test(content) || /no (executable )?retention.polic.*graphify/i.test(content)) {
      errors.push(`${relativePath}:p8-contradiction:false-no-graphify-retention-policy`);
    }
  }

  if (isGovernanceJson) {
    // Governance JSON must not expose obsolete B8 labels as current active phase or next task.
    // The validate-graphify-operational-profiles.mjs already checks this structurally;
    // this check provides a defense-in-depth scan of the raw text.
    let gov;
    try { gov = JSON.parse(content); } catch { return; }
    const migration = gov.migrationPath ?? {};
    const obsoletePattern = /\bB8\.[0-9]+[A-Z][-\w]*\b/;
    if (obsoletePattern.test(migration.currentPhase ?? '')) {
      errors.push(`${relativePath}:p8-contradiction:governance-obsolete-b8-current-phase`);
    }
    if (obsoletePattern.test(migration.nextTask ?? '')) {
      errors.push(`${relativePath}:p8-contradiction:governance-obsolete-b8-next-task`);
    }
  }
}

// Requires all documents that state BS0.19 deletion-readiness verdict counts or
// focused test counts to report identical numbers. Mismatches indicate a document
// was updated in isolation without reconciling its siblings.
function checkCrossDocumentCounts(contentsByPath, errors) {
  function getContent(relativePath) {
    return contentsByPath[relativePath] ?? null;
  }

  function extractVerdictTriple(content) {
    if (!content) return null;
    const m = content.match(/(\d+)\s+SAFE[,\s\/]+(\d+)\s+PARTIAL[,\s\/]+(\d+)\s+BLOCKED/);
    return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
  }

  function extractTestCount(content) {
    if (!content) return null;
    const m = content.match(/(\d+) focused tests pass \((\d+)\/(\d+)\)/);
    if (!m || m[1] !== m[2] || m[2] !== m[3]) return null;
    return m[1];
  }

  const verdictTriples = [];
  for (const p of VERDICT_SOURCES) {
    const content = getContent(p);
    if (!content) {
      errors.push(`cross-document-count-missing:source:${p}`);
      continue;
    }
    const triple = extractVerdictTriple(content);
    if (!triple) {
      errors.push(`cross-document-count-missing:verdict-triple:${p}`);
      continue;
    }
    verdictTriples.push({ path: p, triple });
  }
  const distinctTriples = new Set(verdictTriples.map((v) => v.triple));
  if (distinctTriples.size > 1) {
    const detail = verdictTriples.map((v) => `${path.basename(v.path)}=${v.triple}`).join(' ');
    errors.push(`cross-document-count-mismatch:verdict-triple:${detail}`);
  }

  const testCounts = [];
  for (const p of TEST_COUNT_SOURCES) {
    const content = getContent(p);
    if (!content) {
      errors.push(`cross-document-count-missing:source:${p}`);
      continue;
    }
    const count = extractTestCount(content);
    if (!count) {
      errors.push(`cross-document-count-missing:test-count:${p}`);
      continue;
    }
    testCounts.push({ path: p, count });
  }
  const distinctCounts = new Set(testCounts.map((v) => v.count));
  if (distinctCounts.size > 1) {
    const detail = testCounts.map((v) => `${path.basename(v.path)}=${v.count}`).join(' ');
    errors.push(`cross-document-count-mismatch:test-count:${detail}`);
  }
}

function checkPotentialSafeEvidenceStructure(content, registryContent, errors) {
  let evidenceIndex;
  let registry;
  try {
    evidenceIndex = JSON.parse(content);
  } catch {
    errors.push(`${DELETION_EVIDENCE_PATH}:invalid-json`);
    return;
  }
  try {
    registry = JSON.parse(registryContent);
  } catch {
    errors.push(`${PATH_REGISTRY_PATH}:invalid-json`);
    return;
  }

  const evaluatedPathIds = new Set((registry.entries ?? [])
    .filter((entry) => !entry.type.startsWith('canonical-') && entry.type !== 'future-target')
    .map((entry) => entry.pathId));

  const blockingFields = [
    'activeProducer', 'activeConsumer', 'unresolvedAuthority',
    'missingProvenance', 'missingRollback', 'missingApproval',
  ];
  const partialFields = [
    'ambiguousConsumer', 'pendingCleanupTask', 'activeGenerator', 'unverifiedFixtureReference',
  ];
  const universalFields = [
    'noActiveProducer', 'noActiveConsumer', 'provenanceProof',
    'rollbackProof', 'approvalProof', 'authorityProof',
  ];

  for (const [pathId, evidence] of Object.entries(evidenceIndex.entries ?? {})) {
    if (!evaluatedPathIds.has(pathId)) continue;
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) continue;
    const isAlreadyNonSafe = [...blockingFields, ...partialFields].some((field) => Boolean(evidence[field]));
    if (isAlreadyNonSafe) continue;

    for (const field of universalFields) {
      if (typeof evidence[field] === 'string') {
        errors.push(`${DELETION_EVIDENCE_PATH}:${pathId}:legacy-universal-proof:${field}`);
      }
    }
    const prerequisites = evidence.prerequisiteEvidence;
    if (prerequisites && typeof prerequisites === 'object' && !Array.isArray(prerequisites)) {
      for (const [prerequisiteId, value] of Object.entries(prerequisites)) {
        if (typeof value === 'string') {
          errors.push(`${DELETION_EVIDENCE_PATH}:${pathId}:legacy-prerequisite-proof:${prerequisiteId}`);
        }
      }
    }
  }
}

function main() {
  const errors = [];
  const contentsByPath = {};
  for (const relativePath of inspectedFiles) {
    contentsByPath[relativePath] = read(relativePath);
  }

  for (const relativePath of files) {
    const content = contentsByPath[relativePath];
    if (!relativePath.endsWith('.json')) {
      checkStalePaths(content, relativePath, errors);
      checkBrokenLinks(content, relativePath, errors);
      checkOwnerCounts(content, relativePath, errors);
      checkNextTaskClaims(content, relativePath, errors);
      checkUnsupportedWording(content, relativePath, errors);
    }
    checkP8ContradictionClaims(content, relativePath, errors);
  }
  checkCrossDocumentCounts(contentsByPath, errors);
  checkPotentialSafeEvidenceStructure(
    contentsByPath[DELETION_EVIDENCE_PATH],
    contentsByPath[PATH_REGISTRY_PATH],
    errors,
  );

  if (errors.length > 0) {
    process.stdout.write(`docs=fail\nerrors=${errors.length}\n`);
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`docs=pass\nfiles=${inspectedFiles.length}\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
