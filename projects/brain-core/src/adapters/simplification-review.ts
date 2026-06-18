import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreSimplificationReviewView } from '../types/api.js';
import { getApprovalStorePath } from './approval-store.js';

const SAFETY = {
  readOnly: true,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  runsWorkflowNow: false,
  deletesFiles: false,
  archivesFiles: false,
} as const;

export interface SimplificationReviewOptions {
  mindRoot?: string;
  now?: Date;
  /** For deterministic failure tests only — injected filesystem reader. */
  _testOnlyReaddirFn?: ReaddirFn;
  /**
   * For tests: inject a known approval store path instead of deriving it from process.env.
   * When provided, this path is treated as the configured persistent store path
   * (i.e., persistence is considered configured).
   */
  _testOnlyApprovalStorePath?: string;
  /**
   * For tests: explicitly control whether persistence is configured.
   * When _testOnlyApprovalStorePath is provided, this defaults to true.
   * Use this to test the "persistence not configured" path without mutating process.env.
   */
  _testOnlyPersistenceConfigured?: boolean;
}

interface FolderScanResult {
  rootReadable: boolean;
  scanComplete: boolean;
  unreadablePaths: string[];
  blockers: string[];
  topLevelFolders: string[];
  totalDirectoryCount: number;
  directoryCountByDepth: Record<number, number>;
  observedMaximumDepth: number;
  deepestPaths: string[];
}

type ReaddirFn = (dir: string) => Array<{ name: string; isDirectory(): boolean }>;

function defaultReaddirFn(dir: string): Array<{ name: string; isDirectory(): boolean }> {
  return fs.readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
}

function scanFolderStructure(root: string, readdirFn: ReaddirFn = defaultReaddirFn): FolderScanResult {
  const UNREADABLE: FolderScanResult = {
    rootReadable: false,
    scanComplete: false,
    unreadablePaths: [],
    blockers: ['mindRootMissingOrUnreadable'],
    topLevelFolders: [],
    totalDirectoryCount: 0,
    directoryCountByDepth: {},
    observedMaximumDepth: 0,
    deepestPaths: [],
  };

  // Fail closed: verify root exists and is a directory before any traversal.
  let isDir: boolean;
  try {
    isDir = fs.statSync(root).isDirectory();
  } catch {
    return UNREADABLE;
  }
  if (!isDir) {
    return UNREADABLE;
  }

  // Fail closed: if root readdir fails, report blocked rather than empty.
  let rootEntries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    rootEntries = readdirFn(root);
  } catch {
    return {
      rootReadable: false,
      scanComplete: false,
      unreadablePaths: ['.'],
      blockers: ['rootReaddirFailed'],
      topLevelFolders: [],
      totalDirectoryCount: 0,
      directoryCountByDepth: {},
      observedMaximumDepth: 0,
      deepestPaths: [],
    };
  }

  const countByDepth: Record<number, number> = {};
  let maxDepth = 0;
  const deepestRelPaths: string[] = [];
  const unreadablePaths: string[] = [];

  function traverse(dir: string, depth: number): void {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = readdirFn(dir);
    } catch {
      // Record the relative unreadable path; do not silently skip.
      unreadablePaths.push(path.relative(root, dir));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      countByDepth[depth] = (countByDepth[depth] ?? 0) + 1;
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestRelPaths.length = 0;
        deepestRelPaths.push(path.relative(root, path.join(dir, entry.name)));
      } else if (depth === maxDepth) {
        deepestRelPaths.push(path.relative(root, path.join(dir, entry.name)));
      }
      traverse(path.join(dir, entry.name), depth + 1);
    }
  }

  // Use pre-read rootEntries for depth-1 dirs; recurse into each.
  const topLevel: string[] = [];
  for (const entry of rootEntries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    topLevel.push(entry.name);
    countByDepth[1] = (countByDepth[1] ?? 0) + 1;
    const childPath = path.join(root, entry.name);
    if (1 > maxDepth) {
      maxDepth = 1;
      deepestRelPaths.length = 0;
      deepestRelPaths.push(entry.name);
    } else if (1 === maxDepth) {
      deepestRelPaths.push(entry.name);
    }
    traverse(childPath, 2);
  }
  topLevel.sort();

  const total = Object.values(countByDepth).reduce((s, c) => s + c, 0);
  const sorted = deepestRelPaths.slice().sort();
  const scanComplete = unreadablePaths.length === 0;

  return {
    rootReadable: true,
    scanComplete,
    unreadablePaths,
    blockers: [],
    topLevelFolders: topLevel,
    totalDirectoryCount: total,
    directoryCountByDepth: countByDepth,
    observedMaximumDepth: maxDepth,
    deepestPaths: sorted,
  };
}

interface InboxAgeResult {
  status: 'available' | 'missing' | 'blocked';
  captureCount: number | null;
  oldestAgeHours: number | null;
  newestAgeHours: number | null;
  validTimestampCount: number | null;
  invalidTimestampCount: number | null;
  source: string;
  blockers: string[];
}

function measureInboxAge(inboxPath: string, now: Date): InboxAgeResult {
  const nowMs = now.getTime();

  // Distinguish missing inbox from unreadable inbox.
  let stat: ReturnType<typeof fs.statSync> | null = null;
  try { stat = fs.statSync(inboxPath); } catch { /* not present */ }
  if (stat === null) {
    return { status: 'missing', captureCount: null, oldestAgeHours: null, newestAgeHours: null, validTimestampCount: null, invalidTimestampCount: null, source: inboxPath, blockers: ['inboxDirectoryMissing'] };
  }
  if (!stat.isDirectory()) {
    return { status: 'blocked', captureCount: null, oldestAgeHours: null, newestAgeHours: null, validTimestampCount: null, invalidTimestampCount: null, source: inboxPath, blockers: ['inboxPathIsNotADirectory'] };
  }

  let entries: ReturnType<typeof fs.readdirSync>;
  try {
    entries = fs.readdirSync(inboxPath, { withFileTypes: true });
  } catch {
    return { status: 'blocked', captureCount: null, oldestAgeHours: null, newestAgeHours: null, validTimestampCount: null, invalidTimestampCount: null, source: inboxPath, blockers: ['inboxReaddirFailed'] };
  }

  // Only non-hidden files are captures. README.md is excluded by the hidden-file rule
  // per the canonical policy that hidden files are ignored (name starts with '.').
  // README.md is not hidden, but is not a capture — caller filters by name pattern.
  // Per canonical policy we include all non-hidden files as capture candidates.
  const files = entries.filter(e => e.isFile() && !e.name.startsWith('.'));

  if (files.length === 0) {
    return { status: 'available', captureCount: 0, oldestAgeHours: null, newestAgeHours: null, validTimestampCount: 0, invalidTimestampCount: 0, source: inboxPath, blockers: [] };
  }

  let oldestMs: number | null = null;
  let newestMs: number | null = null;
  let validCount = 0;
  let invalidCount = 0;

  for (const file of files) {
    let mtime: number;
    try {
      mtime = fs.statSync(path.join(inboxPath, file.name)).mtime.getTime();
    } catch {
      invalidCount++;
      continue;
    }
    // Future timestamps fail closed.
    if (!Number.isFinite(mtime) || mtime > nowMs) {
      invalidCount++;
      continue;
    }
    validCount++;
    if (oldestMs === null || mtime < oldestMs) oldestMs = mtime;
    if (newestMs === null || mtime > newestMs) newestMs = mtime;
  }

  // Age is exact (fractional hours floored to whole hours for readability).
  const oldestAgeHours = oldestMs !== null ? Math.floor((nowMs - oldestMs) / 3600000) : null;
  const newestAgeHours = newestMs !== null ? Math.floor((nowMs - newestMs) / 3600000) : null;

  return {
    status: 'available',
    captureCount: files.length,
    oldestAgeHours,
    newestAgeHours,
    validTimestampCount: validCount,
    invalidTimestampCount: invalidCount,
    source: inboxPath,
    blockers: invalidCount > 0 ? ['someTimestampsInvalidOrFuture'] : [],
  };
}

// Canonical finding status values per system/maintenance-report-contract.md
const CANONICAL_FINDING_STATUSES = new Set(['open', 'accepted', 'dismissed', 'resolved', 'superseded']);
// Statuses that count as resolved/not-open backlog
const RESOLVED_FINDING_STATUSES = new Set(['dismissed', 'resolved', 'superseded']);

// Canonical decision values per system/maintenance-report-contract.md review record
const CANONICAL_DECISION_VALUES = new Set(['accepted', 'dismissed', 'resolved', 'superseded', 'open']);

interface MaintenanceBacklogResult {
  status: 'available' | 'partial' | 'insufficient-evidence';
  validFindingCount: number | null;
  malformedFindingCount: number | null;
  unresolvedFindingCount: number | null;
  validDecisionCount: number | null;
  malformedDecisionCount: number | null;
  pendingDecisionCount: number | null;
  failedFindingCount: number | null;
  overdueMaintenanceCount: number | null;
  source: string[];
  measuredAt: string;
  blockers: string[];
}

function measureMaintenanceBacklog(mindRoot: string, now: Date): MaintenanceBacklogResult {
  const latestReportPath = path.join(mindRoot, 'system', 'reports', 'maintenance-latest.json');
  const decisionStorePath = path.join(mindRoot, 'system', 'reports', 'maintenance-decisions.json');
  const measuredAt = now.toISOString();
  const sources: string[] = [];
  const blockers: string[] = [];

  // Read the canonical latest maintenance report.
  let report: Record<string, unknown> | null = null;
  try {
    const raw = fs.readFileSync(latestReportPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      report = parsed as Record<string, unknown>;
      sources.push(latestReportPath);
    } else {
      blockers.push('maintenanceReportMalformed');
    }
  } catch {
    blockers.push('maintenanceReportMissing');
  }

  // Read the optional decision store.
  // Per contract: "may be absent when the decision ledger is empty" — absence is not a blocker.
  // A present but malformed store IS a blocker and must add a blocker entry.
  let decisions: unknown[] | null = null;
  let decisionStorePresent = false;
  try {
    const raw = fs.readFileSync(decisionStorePath, 'utf8');
    decisionStorePresent = true;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const doc = parsed as Record<string, unknown>;
      if (Array.isArray(doc.decisions)) {
        decisions = doc.decisions;
        sources.push(decisionStorePath);
      } else {
        blockers.push('maintenanceDecisionStoreMalformed');
      }
    } else {
      blockers.push('maintenanceDecisionStoreMalformed');
    }
  } catch {
    if (decisionStorePresent) {
      // File exists but couldn't be read/parsed — this is a malformed present store.
      blockers.push('maintenanceDecisionStoreMalformed');
    }
    // If file simply doesn't exist, decisions remains null with no blocker.
  }

  if (report === null) {
    return {
      status: 'insufficient-evidence',
      validFindingCount: null,
      malformedFindingCount: null,
      unresolvedFindingCount: null,
      validDecisionCount: null,
      malformedDecisionCount: null,
      pendingDecisionCount: null,
      failedFindingCount: null,
      overdueMaintenanceCount: null,
      source: sources,
      measuredAt,
      blockers,
    };
  }

  // Extract findings from the report.
  const findingsArr = Array.isArray(report.findings) ? (report.findings as unknown[]) : null;
  const errorsArr = Array.isArray(report.errors) ? (report.errors as unknown[]) : null;

  if (findingsArr === null) {
    blockers.push('maintenanceFindingsMalformed');
    return {
      status: 'partial',
      validFindingCount: null,
      malformedFindingCount: null,
      unresolvedFindingCount: null,
      validDecisionCount: null,
      malformedDecisionCount: null,
      pendingDecisionCount: null,
      failedFindingCount: null,
      overdueMaintenanceCount: null,
      source: sources,
      measuredAt,
      blockers,
    };
  }

  // Validate every finding entry. Malformed entries add a blocker and are tracked.
  let validFindingCount = 0;
  let malformedFindingCount = 0;
  let unresolvedFindingCount = 0;

  for (const f of findingsArr) {
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      malformedFindingCount++;
      continue;
    }
    const finding = f as Record<string, unknown>;
    const status = finding.status;

    // A finding without a canonical status is malformed — do not silently count as open.
    if (!CANONICAL_FINDING_STATUSES.has(status as string)) {
      malformedFindingCount++;
      continue;
    }
    validFindingCount++;
    // Only 'open' and 'accepted' findings are unresolved backlog.
    // 'dismissed', 'resolved', 'superseded' are explicitly not unresolved.
    if (!RESOLVED_FINDING_STATUSES.has(status as string)) {
      unresolvedFindingCount++;
    }
  }

  if (malformedFindingCount > 0) {
    blockers.push('maintenanceFindingsMalformed');
  }

  // Failed findings = detector errors array length.
  // Per schema, errors[] is a required field — if absent, it is malformed evidence.
  let failedFindingCount: number | null = null;
  if (errorsArr !== null) {
    failedFindingCount = errorsArr.length;
  } else {
    blockers.push('maintenanceErrorsFieldMissing');
  }

  // Pending decisions: decisions from the optional decision store.
  // Per contract: decision record has a `decision` field.
  // `accepted` without a `resolutionRef` means the follow-up action has not been completed.
  let pendingDecisionCount: number | null = null;
  let validDecisionCount: number | null = null;
  let malformedDecisionCount: number | null = null;

  if (decisions !== null) {
    // Decision store present and parseable.
    pendingDecisionCount = 0;
    validDecisionCount = 0;
    malformedDecisionCount = 0;
    for (const d of decisions) {
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        malformedDecisionCount++;
        continue;
      }
      const dec = d as Record<string, unknown>;
      if (!CANONICAL_DECISION_VALUES.has(dec.decision as string)) {
        malformedDecisionCount++;
        continue;
      }
      validDecisionCount++;
      if (dec.decision === 'accepted' && !dec.resolutionRef) pendingDecisionCount++;
    }
    if (malformedDecisionCount > 0) {
      blockers.push('maintenanceDecisionsMalformed');
    }
  }
  // If decisions is null and no decisionStorePresent, pendingDecisionCount remains null.
  // That means the store was absent — must not be described as zero or empty evidence.

  const hasPartial = blockers.length > 0;
  return {
    status: hasPartial ? 'partial' : 'available',
    validFindingCount,
    malformedFindingCount,
    unresolvedFindingCount,
    validDecisionCount,
    malformedDecisionCount,
    pendingDecisionCount,
    failedFindingCount,
    overdueMaintenanceCount: null,
    source: sources,
    measuredAt,
    blockers,
  };
}

function measureFalsePositiveRate(mindRoot: string): { measured: boolean; falsePositiveRate: number; totalNegativeCases: number; falsePositives: number; source: string } {
  const reportPath = path.join(mindRoot, 'system', 'reports', 'maintenance-history', '2026-06-17-false-positive-measurement.md');
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const fpMatch = content.match(/False positives\s*\|\s*(\d+)/);
    const negMatch = content.match(/Explicit negative cases\s*\|\s*(\d+)/);
    if (!fpMatch || !negMatch) {
      return {
        measured: false,
        falsePositiveRate: 0,
        totalNegativeCases: 0,
        falsePositives: 0,
        source: reportPath,
      };
    }

    const falsePositives = parseInt(fpMatch[1]!, 10);
    const totalNegativeCases = parseInt(negMatch[1]!, 10);
    if (!Number.isFinite(falsePositives) || !Number.isFinite(totalNegativeCases) || totalNegativeCases <= 0) {
      return {
        measured: false,
        falsePositiveRate: 0,
        totalNegativeCases: 0,
        falsePositives: 0,
        source: reportPath,
      };
    }

    const rate = falsePositives / totalNegativeCases;
    return { measured: true, falsePositiveRate: rate, totalNegativeCases, falsePositives, source: reportPath };
  } catch {
    return { measured: false, falsePositiveRate: 0, totalNegativeCases: 0, falsePositives: 0, source: reportPath };
  }
}

interface ApprovalVolumeResult {
  status: 'available' | 'partial' | 'insufficient-evidence';
  persistenceConfigured: boolean;
  configuredStorePath: string | null;
  storeStatus: 'not-configured' | 'configured-missing' | 'configured-readable' | 'configured-malformed';
  evidenceAvailability: 'none' | 'partial' | 'full';
  totalRequestCount: number | null;
  pendingCount: number | null;
  approvedCount: number | null;
  rejectedCount: number | null;
  expiredCount: number | null;
  malformedRecordCount: number | null;
  source: string[];
  measuredAt: string;
  blockers: string[];
}

function measureApprovalVolume(
  approvalStorePath: string | null,
  persistenceConfigured: boolean,
  now: Date,
): ApprovalVolumeResult {
  const measuredAt = now.toISOString();

  // Canonical approval statuses per approval-store.ts schema.
  const CANONICAL_APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'expired']);

  // Case 1: no configured persistent store.
  // This does not mean no approvals ever existed — it means the
  // Brain Core workflow approval persistence surface is not configured in this environment.
  if (!persistenceConfigured || approvalStorePath === null) {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: false,
      configuredStorePath: null,
      storeStatus: 'not-configured',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [],
      measuredAt,
      blockers: ['approvalPersistenceNotConfigured'],
    };
  }

  // Case 2: configured store path is missing.
  // A missing file does not prove no approvals were ever requested —
  // it only means no readable persistent evidence exists at the configured path.
  let stat: ReturnType<typeof fs.statSync> | null = null;
  try { stat = fs.statSync(approvalStorePath); } catch { /* absent */ }

  if (stat === null) {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: true,
      configuredStorePath: approvalStorePath,
      storeStatus: 'configured-missing',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [],
      measuredAt,
      blockers: ['approvalStoreMissing'],
    };
  }

  if (!stat.isFile()) {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: true,
      configuredStorePath: approvalStorePath,
      storeStatus: 'configured-malformed',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [],
      measuredAt,
      blockers: ['approvalStoreNotAFile'],
    };
  }

  // Case 3: configured store exists but is malformed.
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(approvalStorePath, 'utf8'));
  } catch {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: true,
      configuredStorePath: approvalStorePath,
      storeStatus: 'configured-malformed',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [approvalStorePath],
      measuredAt,
      blockers: ['approvalStoreMalformed'],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: true,
      configuredStorePath: approvalStorePath,
      storeStatus: 'configured-malformed',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [approvalStorePath],
      measuredAt,
      blockers: ['approvalStoreMalformed'],
    };
  }

  const doc = parsed as Record<string, unknown>;
  if (!Array.isArray(doc.records)) {
    return {
      status: 'insufficient-evidence',
      persistenceConfigured: true,
      configuredStorePath: approvalStorePath,
      storeStatus: 'configured-malformed',
      evidenceAvailability: 'none',
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [approvalStorePath],
      measuredAt,
      blockers: ['approvalStoreRecordsMalformed'],
    };
  }

  // Case 4: configured readable store.
  const records = doc.records as unknown[];
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let expiredCount = 0;
  let malformedRecordCount = 0;
  const seenIds = new Set<string>();
  const blockers: string[] = [];

  for (const r of records) {
    if (typeof r !== 'object' || r === null || Array.isArray(r)) {
      malformedRecordCount++;
      continue;
    }
    const rec = r as Record<string, unknown>;
    const status = rec.status;
    if (!CANONICAL_APPROVAL_STATUSES.has(status as string)) {
      malformedRecordCount++;
      continue;
    }
    // Deduplicate by stable ID when available.
    const id = typeof rec.id === 'string' ? rec.id : null;
    if (id !== null) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    if (status === 'pending') pendingCount++;
    else if (status === 'approved') approvedCount++;
    else if (status === 'rejected') rejectedCount++;
    else if (status === 'expired') expiredCount++;
  }

  if (malformedRecordCount > 0) {
    blockers.push('approvalRecordsMalformed');
  }

  const hasPartial = blockers.length > 0;
  const evidenceAvailability = hasPartial ? 'partial' : 'full';
  return {
    status: hasPartial ? 'partial' : 'available',
    persistenceConfigured: true,
    configuredStorePath: approvalStorePath,
    storeStatus: 'configured-readable',
    evidenceAvailability,
    totalRequestCount: records.length - malformedRecordCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    expiredCount,
    malformedRecordCount,
    source: [approvalStorePath],
    measuredAt,
    blockers,
  };
}

function checkNavigationFromHome(mindRoot: string): { homeExists: boolean; linksChecked: number; brokenLinks: string[] } {
  const homePath = path.join(mindRoot, 'home.md');
  try {
    const content = fs.readFileSync(homePath, 'utf8');
    const linkPattern = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1]!);
    }
    const broken: string[] = [];
    for (const link of links.slice(0, 50)) {
      const candidates = [
        path.join(mindRoot, `${link}.md`),
        path.join(mindRoot, link),
        path.join(mindRoot, link, 'index.md'),
        path.join(mindRoot, link, 'README.md'),
      ];
      if (!candidates.some(c => fs.existsSync(c))) {
        broken.push(link);
      }
    }
    return { homeExists: true, linksChecked: Math.min(links.length, 50), brokenLinks: broken };
  } catch {
    return { homeExists: false, linksChecked: 0, brokenLinks: [] };
  }
}

export function getSimplificationReviewView(
  options: SimplificationReviewOptions = {},
): BrainCoreSimplificationReviewView {
  const now = options.now ?? new Date();
  const MODULE_DIR = path.dirname(new URL(import.meta.url).pathname);
  const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
  const mindRoot = options.mindRoot ?? path.resolve(BRAIN_ROOT, '..', 'mind');

  // Resolve approval persistence state without mutating process.env.
  // Test injection: _testOnlyApprovalStorePath is treated as a configured path.
  // Production: use getApprovalStorePath() which reads BRAIN_CORE_APPROVAL_STORE_PATH.
  let approvalStorePath: string | null;
  let persistenceConfigured: boolean;
  if (options._testOnlyApprovalStorePath !== undefined) {
    approvalStorePath = options._testOnlyApprovalStorePath;
    persistenceConfigured = options._testOnlyPersistenceConfigured ?? true;
  } else if (options._testOnlyPersistenceConfigured === false) {
    approvalStorePath = null;
    persistenceConfigured = false;
  } else {
    const resolved = getApprovalStorePath();
    approvalStorePath = resolved ?? null;
    persistenceConfigured = resolved !== undefined;
  }

  const scan = scanFolderStructure(mindRoot, options._testOnlyReaddirFn);

  if (!scan.rootReadable) {
    const nullInboxAge = {
      status: 'missing' as const,
      captureCount: null,
      oldestAgeHours: null,
      newestAgeHours: null,
      validTimestampCount: null,
      invalidTimestampCount: null,
      source: path.join(mindRoot, 'capture', 'inbox'),
      blockers: ['mindRootMissingOrUnreadable'],
    };
    const nullBacklog = {
      status: 'insufficient-evidence' as const,
      validFindingCount: null,
      malformedFindingCount: null,
      unresolvedFindingCount: null,
      validDecisionCount: null,
      malformedDecisionCount: null,
      pendingDecisionCount: null,
      failedFindingCount: null,
      overdueMaintenanceCount: null,
      source: [] as string[],
      measuredAt: now.toISOString(),
      blockers: ['mindRootMissingOrUnreadable'],
    };
    const nullApprovalVolume = {
      status: 'insufficient-evidence' as const,
      persistenceConfigured,
      configuredStorePath: approvalStorePath,
      storeStatus: 'not-configured' as const,
      evidenceAvailability: 'none' as const,
      totalRequestCount: null,
      pendingCount: null,
      approvedCount: null,
      rejectedCount: null,
      expiredCount: null,
      malformedRecordCount: null,
      source: [] as string[],
      measuredAt: now.toISOString(),
      blockers: ['mindRootMissingOrUnreadable'],
    };
    return {
      id: 'simplification-review-view',
      status: 'missing',
      source: 'mind-filesystem-scan',
      generatedAt: now.toISOString(),
      folderStructure: {
        topLevelFolderCount: 0,
        topLevelFolders: [],
        totalDirectoryCount: 0,
        directoryCountByDepth: {},
        observedMaximumDepth: 0,
        deepestPaths: [],
        scanComplete: false,
        unreadablePaths: [],
        recommendedMaximumUsefulDepth: null,
        recommendationStatus: 'insufficient-evidence',
        recommendationEvidence: [],
        recommendationBlockers: ['mindRootMissingOrUnreadable'],
      },
      navigation: { homeExists: false, linksChecked: 0, brokenLinkCount: 0, brokenLinks: [] },
      inboxAge: nullInboxAge,
      maintenanceBacklog: nullBacklog,
      falsePositiveRate: { measured: false, rate: 0, totalNegativeCases: 0, falsePositives: 0, source: mindRoot },
      approvalVolume: nullApprovalVolume,
      blockers: ['mindRootMissingOrUnreadable'],
      safety: SAFETY,
    };
  }

  const inboxAge = measureInboxAge(path.join(mindRoot, 'capture', 'inbox'), now);
  const maintenanceBacklog = measureMaintenanceBacklog(mindRoot, now);
  const navigation = checkNavigationFromHome(mindRoot);
  const falsePositiveRate = measureFalsePositiveRate(mindRoot);
  const approvalVolume = measureApprovalVolume(approvalStorePath, persistenceConfigured, now);

  return {
    id: 'simplification-review-view',
    status: 'available',
    source: 'mind-filesystem-scan',
    generatedAt: now.toISOString(),
    folderStructure: {
      topLevelFolderCount: scan.topLevelFolders.length,
      topLevelFolders: scan.topLevelFolders,
      totalDirectoryCount: scan.totalDirectoryCount,
      directoryCountByDepth: scan.directoryCountByDepth,
      observedMaximumDepth: scan.observedMaximumDepth,
      deepestPaths: scan.deepestPaths,
      scanComplete: scan.scanComplete,
      unreadablePaths: scan.unreadablePaths,
      recommendedMaximumUsefulDepth: null,
      recommendationStatus: 'insufficient-evidence',
      recommendationEvidence: [],
      recommendationBlockers: [
        'noNavigationDepthMeasurementFromHomeOrIndexes',
        'noMaintenanceCostEvidenceByDepth',
        'noUsabilityEvidenceByDepth',
      ],
    },
    navigation: {
      homeExists: navigation.homeExists,
      linksChecked: navigation.linksChecked,
      brokenLinkCount: navigation.brokenLinks.length,
      brokenLinks: navigation.brokenLinks.slice(0, 10),
    },
    inboxAge: {
      status: inboxAge.status,
      captureCount: inboxAge.captureCount,
      oldestAgeHours: inboxAge.oldestAgeHours,
      newestAgeHours: inboxAge.newestAgeHours,
      validTimestampCount: inboxAge.validTimestampCount,
      invalidTimestampCount: inboxAge.invalidTimestampCount,
      source: inboxAge.source,
      blockers: inboxAge.blockers,
    },
    maintenanceBacklog: {
      status: maintenanceBacklog.status,
      validFindingCount: maintenanceBacklog.validFindingCount,
      malformedFindingCount: maintenanceBacklog.malformedFindingCount,
      unresolvedFindingCount: maintenanceBacklog.unresolvedFindingCount,
      validDecisionCount: maintenanceBacklog.validDecisionCount,
      malformedDecisionCount: maintenanceBacklog.malformedDecisionCount,
      pendingDecisionCount: maintenanceBacklog.pendingDecisionCount,
      failedFindingCount: maintenanceBacklog.failedFindingCount,
      overdueMaintenanceCount: maintenanceBacklog.overdueMaintenanceCount,
      source: maintenanceBacklog.source,
      measuredAt: maintenanceBacklog.measuredAt,
      blockers: maintenanceBacklog.blockers,
    },
    falsePositiveRate: {
      measured: falsePositiveRate.measured,
      rate: falsePositiveRate.falsePositiveRate,
      totalNegativeCases: falsePositiveRate.totalNegativeCases,
      falsePositives: falsePositiveRate.falsePositives,
      source: falsePositiveRate.source,
    },
    approvalVolume: {
      status: approvalVolume.status,
      persistenceConfigured: approvalVolume.persistenceConfigured,
      configuredStorePath: approvalVolume.configuredStorePath,
      storeStatus: approvalVolume.storeStatus,
      evidenceAvailability: approvalVolume.evidenceAvailability,
      totalRequestCount: approvalVolume.totalRequestCount,
      pendingCount: approvalVolume.pendingCount,
      approvedCount: approvalVolume.approvedCount,
      rejectedCount: approvalVolume.rejectedCount,
      expiredCount: approvalVolume.expiredCount,
      malformedRecordCount: approvalVolume.malformedRecordCount,
      source: approvalVolume.source,
      measuredAt: approvalVolume.measuredAt,
      blockers: approvalVolume.blockers,
    },
    blockers: [],
    safety: SAFETY,
  };
}
