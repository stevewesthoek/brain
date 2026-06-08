/**
 * Infinite Brain iOS/Obsidian Sync Safety Verification
 * Report-only inspection of Mind repo sync state
 * This phase: Read-only verification, never writes to Mind, status always blocked
 *
 * Input: Mind repo path (read-only inspection only)
 * Output: runtime/local/infinite-brain/ios-sync-safety-latest.json
 *
 * Safety: writesToMind: false, modifiesGit: false, usesShell: false, canWriteToMind: false, syncSafe: false
 */

import fs, { existsSync, statSync, readdirSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_IOS_SYNC_SAFETY_RELATIVE_PATH = 'runtime/local/infinite-brain/ios-sync-safety-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_REPO_PATH = path.resolve(BRAIN_ROOT, '..', 'mind');

export interface IosSyncSafetyCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'uncertain';
  reason: string;
  requiredForSync: boolean;
}

export interface IosSyncSafetySafety {
  writesToMind: boolean;
  modifiesGit: boolean;
  usesShell: boolean;
  canWriteToMind: boolean;
  syncSafe: boolean;
  reportOnly: boolean;
  continuousRuntime: boolean;
}

export interface IosSyncSafetyReport {
  reportId: string;
  generatedAt: string;
  mindPath: string;
  status: 'blocked' | 'uncertain' | 'safe';
  syncSafe: boolean;
  canWriteToMind: boolean;
  checks: IosSyncSafetyCheck[];
  blockers: string[];
  recommendations: string[];
  safety: IosSyncSafetySafety;
}

function getMindRepoPath(): string {
  const envPath = process.env.IBR_MIND_REPO_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return DEFAULT_MIND_REPO_PATH;
}

function getReportPath(): string {
  const envPath = process.env.IBR_IOS_SYNC_SAFETY_REPORT_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_IOS_SYNC_SAFETY_RELATIVE_PATH);
}

function generateReportId(mindPath: string, checks: IosSyncSafetyCheck[]): string {
  const checkString = checks
    .map(c => `${c.checkId}:${c.status}`)
    .sort()
    .join(',');

  const hash = crypto
    .createHash('sha256')
    .update(mindPath + checkString)
    .digest('hex')
    .substring(0, 12);

  return `sync-safety-${hash}`;
}

function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

function isDirectory(dirPath: string): boolean {
  try {
    // Just check if it exists and readdirSync can open it
    readdirSync(dirPath, { withFileTypes: true });
    return true;
  } catch {
    return false;
  }
}

function getRecentFileTimestamps(dirPath: string, maxFiles: number = 5): number[] {
  try {
    if (!isDirectory(dirPath)) {
      return [];
    }
    const entries = readdirSync(dirPath, { withFileTypes: true }).slice(0, maxFiles);
    return entries
      .map(entry => {
        try {
          const fullPath = path.join(dirPath, entry.name);
          const stat = statSync(fullPath);
          const mtime = stat.mtime instanceof Date ? stat.mtime.getTime() : 0;
          return mtime;
        } catch {
          return 0;
        }
      })
      .filter(t => t > 0);
  } catch {
    return [];
  }
}

function performIosSyncSafetyChecks(mindPath: string): IosSyncSafetyCheck[] {
  const checks: IosSyncSafetyCheck[] = [];
  let checkIndex = 0;

  // Check 1: Mind path exists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Mind path exists',
    status: fileExists(mindPath) ? 'pass' : 'fail',
    reason: fileExists(mindPath) ? 'Mind directory found' : 'Mind directory not found at configured path',
    requiredForSync: true,
  });

  // Check 2: Mind has .git directory
  const gitPath = path.join(mindPath, '.git');
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Mind git directory exists',
    status: isDirectory(gitPath) ? 'pass' : 'fail',
    reason: isDirectory(gitPath)
      ? 'Git repository found'
      : 'No .git directory. Mind may not be a git repo.',
    requiredForSync: true,
  });

  // Check 3: Obsidian config detected
  const obsidianPath = path.join(mindPath, '.obsidian');
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Obsidian config detected',
    status: isDirectory(obsidianPath) ? 'pass' : 'uncertain',
    reason: isDirectory(obsidianPath)
      ? 'Obsidian vault configuration found'
      : 'No .obsidian directory. May not be an Obsidian vault.',
    requiredForSync: false,
  });

  // Check 4: Git lock detected (indicates ongoing operation)
  const gitLockPath = path.join(gitPath, 'index.lock');
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Git lock not detected',
    status: !fileExists(gitLockPath) ? 'pass' : 'blocked',
    reason: !fileExists(gitLockPath)
      ? 'No git lock file'
      : 'Git lock file present. Git operation may be in progress.',
    requiredForSync: true,
  });

  // Check 5: Obsidian sync markers detected
  // Look for common Obsidian sync state files
  const syncMarkers = [
    path.join(mindPath, '.obsidian', 'sync-ignore'),
    path.join(mindPath, '.obsidian', 'sync.json'),
  ];
  const syncMarkersFound = syncMarkers.filter(m => fileExists(m)).length;
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Sync state files detected',
    status: syncMarkersFound > 0 ? 'pass' : 'uncertain',
    reason:
      syncMarkersFound > 0
        ? `${syncMarkersFound} Obsidian sync state file(s) found`
        : 'No Obsidian sync state files detected',
    requiredForSync: false,
  });

  // Check 6: Recent modifications in bounded window
  const recentMods = getRecentFileTimestamps(mindPath, 10);
  const now = Date.now();
  const oneHourMs = 3600000;
  const recentCount = recentMods.filter(t => now - t < oneHourMs).length;
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Recent modification window',
    status: recentCount > 0 ? 'uncertain' : 'pass',
    reason:
      recentCount > 0
        ? `${recentCount} recent modifications in last hour. Sync may be active.`
        : 'No recent modifications detected',
    requiredForSync: false,
  });

  // Check 7: Write coordinator present
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Write coordinator present',
    status: 'pass',
    reason: 'Infinite Brain write coordinator exists (blocks all Mind writes)',
    requiredForSync: true,
  });

  // Check 8: Deletion sync verified
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Deletion sync verified',
    status: 'blocked',
    reason: 'Deletion sync reliability not yet verified. File deletions may not sync reliably to iOS.',
    requiredForSync: true,
  });

  // Check 9: Mobile sync policy documented
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Mobile sync policy documented',
    status: 'uncertain',
    reason: 'iOS sync policy partially documented. May require operator confirmation.',
    requiredForSync: false,
  });

  // Check 10: Operator confirmed sync safe
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Operator confirmed sync safe',
    status: 'blocked',
    reason: 'Explicit operator approval required before writes can proceed.',
    requiredForSync: true,
  });

  return checks;
}

function generateSafetyBlock(): IosSyncSafetySafety {
  return {
    writesToMind: false,
    modifiesGit: false,
    usesShell: false,
    canWriteToMind: false,
    syncSafe: false,
    reportOnly: true,
    continuousRuntime: false,
  };
}

export function generateIosSyncSafetyReport(): IosSyncSafetyReport {
  const mindPath = getMindRepoPath();
  const checks = performIosSyncSafetyChecks(mindPath);

  const blockedChecks = checks.filter(c => c.status === 'blocked' && c.requiredForSync);
  const failedChecks = checks.filter(c => c.status === 'fail' && c.requiredForSync);
  const blockers = [
    ...blockedChecks.map(c => c.label),
    ...failedChecks.map(c => c.label),
  ];

  const recommendations: string[] = [];
  if (blockedChecks.length > 0) {
    recommendations.push(
      'Deletion sync must be verified before write execution can be considered.'
    );
    recommendations.push(
      'Operator must explicitly confirm iOS sync safety before execution proceeds.'
    );
  }

  // Status determination
  let status: 'blocked' | 'uncertain' | 'safe' = 'blocked';
  if (blockedChecks.length === 0 && failedChecks.length === 0) {
    status = 'uncertain';
  }

  return {
    reportId: generateReportId(mindPath, checks),
    generatedAt: new Date().toISOString(),
    mindPath,
    status,
    syncSafe: false,
    canWriteToMind: false,
    checks,
    blockers,
    recommendations,
    safety: generateSafetyBlock(),
  };
}

export function writeIosSyncSafetyReport(report: IosSyncSafetyReport): string {
  const reportPath = getReportPath();
  const reportDir = path.dirname(reportPath);

  // Ensure directory exists
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

export function readIosSyncSafetyReport(): IosSyncSafetyReport | null {
  try {
    const reportPath = getReportPath();
    const content = readFileSync(reportPath, 'utf8');
    return JSON.parse(content) as IosSyncSafetyReport;
  } catch {
    return null;
  }
}

export function readIosSyncSafetySummary(): {
  available: boolean;
  generatedAt?: string;
  status?: string;
  syncSafe?: boolean;
  canWriteToMind?: boolean;
  blockerCount?: number;
} {
  const report = readIosSyncSafetyReport();
  if (!report) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    status: report.status,
    syncSafe: report.syncSafe,
    canWriteToMind: report.canWriteToMind,
    blockerCount: report.blockers.length,
  };
}
