#!/usr/bin/env node
/**
 * sync-ai-skills.mjs
 *
 * Hardened skill sync: exports only ai/skills/active/ to all configured AI/IDE consumers.
 *
 * Invariant:
 * - ai/skills/active/ is the ONLY canonical source of activated skills.
 * - Every active skill must be visible at <consumer-target>/<skill>/SKILL.md for all consumers.
 * - --check must fail if any consumer is not synced to ai/skills/active.
 * - Vendor/custom source folders are not exposed directly; only active symlinks are.
 *
 * Usage:
 *   node tools/scripts/sync-ai-skills.mjs [--dry-run] [--check] [--verbose]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkMode = args.includes('--check');
const verbose = args.includes('--verbose');

// Target mapping: ALL tools must point to ai/skills/active
const targets = [
  {
    name: 'Claude Code',
    target: 'operations/system-configs/claude/skills',
    mode: 'root-symlink',
    expectTarget: '../../../ai/skills/active',
  },
  {
    name: 'Codex',
    target: 'operations/system-configs/codex/skills/user',
    mode: 'root-symlink',
    expectTarget: '../../../../ai/skills/active',
  },
  {
    name: 'Gemini CLI',
    target: 'operations/system-configs/gemini/skills',
    mode: 'root-symlink',
    expectTarget: '../../../ai/skills/active',
  },
  {
    name: 'Cursor',
    target: 'operations/system-configs/cursor/skills',
    mode: 'root-symlink',
    expectTarget: '../../../ai/skills/active',
  },
  {
    name: 'Kiro',
    target: 'operations/system-configs/kiro/skills',
    mode: 'entry-symlinks',
  },
  {
    name: 'Antigravity',
    target: 'operations/system-configs/gemini/antigravity/skills',
    mode: 'root-symlink',
    expectTarget: '../../../../ai/skills/active',
  },
];

const activeDir = path.join(repoRoot, 'ai/skills/active');
const activeDirReal = fs.realpathSync(activeDir);

// State tracking
let stats = {
  activeSkills: 0,
  targetsOk: 0,
  targetsChanged: 0,
  targetsBlocked: 0,
  reachabilityFailures: [],
  codexRootViolations: [],
  warnings: [],
};

function log(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn('⚠️  ', ...args);
  stats.warnings.push(args.join(' '));
}

function error(...args) {
  console.error('❌ ', ...args);
}

function success(...args) {
  console.log('✓ ', ...args);
}

/**
 * Get active skills: array of skill names in ai/skills/active/
 */
function getActiveSkills() {
  if (!fs.existsSync(activeDir)) {
    error(`Active skills directory not found: ${activeDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(activeDir, { withFileTypes: true });
  return entries.map((e) => e.name).sort();
}

/**
 * Resolve a path, handling symlinks. Returns: { type, target?, resolvedTo?, isValid }
 */
function resolvePath(p) {
  try {
    const lstat = fs.lstatSync(p);
    if (lstat.isSymbolicLink()) {
      const target = fs.readlinkSync(p);
      try {
        const realPath = fs.realpathSync(p);
        return { type: 'symlink', target, resolvedTo: realPath };
      } catch {
        return { type: 'broken', target };
      }
    } else if (lstat.isDirectory()) {
      const isEmpty = fs.readdirSync(p).length === 0;
      return { type: isEmpty ? 'empty-dir' : 'dir' };
    } else if (lstat.isFile()) {
      return { type: 'file' };
    }
    return { type: 'unknown' };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { type: 'missing' };
    }
    throw e;
  }
}

/**
 * Check if a symlink resolves to the intended target by comparing realpaths
 */
function isSymlinkCorrectByRealpath(p, expectedAbsPath) {
  const res = resolvePath(p);
  if (res.type !== 'symlink') return false;
  try {
    return res.resolvedTo === expectedAbsPath;
  } catch {
    return false;
  }
}

/**
 * Sync a root-symlink target to ai/skills/active
 */
function syncRootSymlink(targetPath, toolName, expectTarget) {
  const absTarget = path.join(repoRoot, targetPath);
  const absExpect = path.join(path.dirname(absTarget), expectTarget);
  const absExpectReal = fs.realpathSync(absExpect);

  const res = resolvePath(absTarget);

  // Already correct
  if (res.type === 'symlink' && res.resolvedTo === absExpectReal) {
    if (verbose) success(`${toolName}: symlink OK → ${res.target}`);
    stats.targetsOk++;
    return true;
  }

  // Wrong symlink target - try to replace it
  if (res.type === 'symlink' && res.resolvedTo !== absExpectReal) {
    // Check if it's pointing to ai/skills (legacy) - we can fix that
    const aiSkillsReal = fs.realpathSync(path.join(repoRoot, 'ai/skills'));
    if (res.resolvedTo === aiSkillsReal) {
      // Legacy symlink to full tree - replace with active-only symlink
      if (!dryRun && !checkMode) {
        fs.rmSync(absTarget);
        fs.symlinkSync(expectTarget, absTarget, 'dir');
        success(`${toolName}: corrected symlink from ai/skills → ai/skills/active`);
      } else if (dryRun) {
        log(`  [DRY-RUN] Would correct: ${targetPath} (ai/skills → ai/skills/active)`);
      }
      stats.targetsChanged++;
      return true;
    }

    // Other wrong symlink - blocked
    error(
      `${toolName}: symlink points elsewhere (${res.target}); expected ai/skills/active`,
    );
    stats.targetsBlocked++;
    return false;
  }

  // Missing: create it
  if (res.type === 'missing') {
    if (!dryRun && !checkMode) {
      const parent = path.dirname(absTarget);
      fs.mkdirSync(parent, { recursive: true });
      fs.symlinkSync(expectTarget, absTarget, 'dir');
      success(`${toolName}: created symlink → ai/skills/active`);
    } else if (dryRun) {
      log(`  [DRY-RUN] Would create: ${targetPath} → ai/skills/active`);
    }
    stats.targetsChanged++;
    return true;
  }

  // Empty dir: replace with symlink
  if (res.type === 'empty-dir') {
    if (!dryRun && !checkMode) {
      fs.rmSync(absTarget, { recursive: true });
      fs.symlinkSync(expectTarget, absTarget, 'dir');
      success(`${toolName}: replaced empty dir with symlink → ai/skills/active`);
    } else if (dryRun) {
      log(`  [DRY-RUN] Would replace empty dir with symlink: ${targetPath}`);
    }
    stats.targetsChanged++;
    return true;
  }

  // Blocked: non-empty dir, file, or broken symlink
  if (res.type === 'dir') {
    error(`${toolName}: non-empty directory exists; cannot replace`);
  } else if (res.type === 'file') {
    error(`${toolName}: file exists; cannot replace`);
  } else if (res.type === 'broken') {
    error(`${toolName}: broken symlink (${res.target}); remove manually first`);
  } else {
    error(`${toolName}: unexpected state; cannot proceed`);
  }
  stats.targetsBlocked++;
  return false;
}

/**
 * Sync entry-symlinks mode (Kiro): each active skill gets a symlink inside target dir
 */
function syncEntrySymlinks(targetPath, toolName, activeSkills) {
  const absTarget = path.join(repoRoot, targetPath);

  const res = resolvePath(absTarget);

  // Ensure target directory exists and is a real directory, not a symlink
  if (res.type === 'missing') {
    if (!dryRun && !checkMode) {
      fs.mkdirSync(absTarget, { recursive: true });
    } else if (dryRun) {
      log(`  [DRY-RUN] Would create directory: ${targetPath}`);
    }
  } else if (res.type === 'symlink') {
    error(`${toolName}: target is a symlink; expected a real directory for entry mode`);
    stats.targetsBlocked++;
    return false;
  } else if (res.type === 'file') {
    error(`${toolName}: file exists at target; cannot use as skills directory`);
    stats.targetsBlocked++;
    return false;
  } else if (res.type === 'dir') {
    // OK, real directory exists
  }

  let allOk = true;

  // Sync each active skill as an entry symlink
  for (const skill of activeSkills) {
    const skillTarget = path.join(absTarget, skill);
    const skillActiveEntry = path.join(activeDir, skill);
    const relTarget = path.relative(path.dirname(skillTarget), skillActiveEntry);

    const res = resolvePath(skillTarget);

    // Check if symlink resolves to the right place (accounting for nested symlinks in active/)
    let isCorrect = false;
    if (res.type === 'symlink') {
      try {
        const actualReal = fs.realpathSync(skillTarget);
        const expectedReal = fs.realpathSync(skillActiveEntry);
        isCorrect = actualReal === expectedReal;
      } catch {
        isCorrect = false;
      }
    }

    if (isCorrect) {
      if (verbose) success(`${toolName}/${skill}: symlink OK`);
      stats.targetsOk++;
      continue;
    }

    if (res.type === 'missing') {
      if (!dryRun && !checkMode) {
        fs.symlinkSync(relTarget, skillTarget, 'dir');
        success(`${toolName}/${skill}: created symlink`);
      } else if (dryRun) {
        log(`  [DRY-RUN] Would create: ${toolName}/${skill}`);
      }
      stats.targetsChanged++;
      allOk = true;
      continue;
    }

    if (res.type === 'empty-dir') {
      if (!dryRun && !checkMode) {
        fs.rmSync(skillTarget, { recursive: true });
        fs.symlinkSync(relTarget, skillTarget, 'dir');
        success(`${toolName}/${skill}: replaced empty dir with symlink`);
      } else if (dryRun) {
        log(`  [DRY-RUN] Would replace empty dir with symlink: ${toolName}/${skill}`);
      }
      stats.targetsChanged++;
      allOk = true;
      continue;
    }

    // Blocked cases
    if (res.type === 'dir') {
      error(`${toolName}/${skill}: non-empty directory exists; cannot replace`);
    } else if (res.type === 'file') {
      error(`${toolName}/${skill}: file exists; cannot replace`);
    } else if (res.type === 'symlink') {
      error(`${toolName}/${skill}: symlink points elsewhere; expected active skill`);
    } else if (res.type === 'broken') {
      error(`${toolName}/${skill}: broken symlink; remove manually first`);
    }
    stats.targetsBlocked++;
    allOk = false;
  }

  // Remove or report stale entries that no longer correspond to active skills.
  try {
    const entries = fs.readdirSync(absTarget, { withFileTypes: true });
    for (const entry of entries) {
      if (activeSkills.includes(entry.name) || entry.name === '.DS_Store') continue;

      const stalePath = path.join(absTarget, entry.name);
      const staleRes = resolvePath(stalePath);
      const message = `${toolName}: stale entry '${entry.name}' does not correspond to any active skill`;

      if (staleRes.type === 'symlink' || staleRes.type === 'broken') {
        if (!dryRun && !checkMode) {
          fs.rmSync(stalePath);
          success(`${message}; removed stale symlink`);
        } else if (dryRun) {
          log(`  [DRY-RUN] Would remove stale symlink: ${toolName}/${entry.name}`);
        } else {
          error(`${message}; run sync-ai-skills.mjs to remove it`);
        }
        stats.targetsChanged++;
        if (checkMode) allOk = false;
        continue;
      }

      error(`${message}; non-symlink entries must be inspected manually`);
      stats.targetsBlocked++;
      allOk = false;
    }
  } catch {
    // Ignore if dir doesn't exist yet.
  }

  return allOk;
}

/**
 * Validate that every active skill is reachable at top-level path for each target
 * Skip entries that are not real directories (e.g., .md files used as skill placeholders)
 */
function validateActiveSkillReachability(activeSkills) {
  const failures = [];

  for (const target of targets) {
    const absTarget = path.join(repoRoot, target.target);

    for (const skill of activeSkills) {
      // Skip placeholder .md files (e.g., notebooklm.md, playwright.md)
      if (skill.endsWith('.md')) {
        continue;
      }

      const skillMd1 = path.join(absTarget, skill, 'SKILL.md');
      const skillMd2 = path.join(absTarget, skill, 'skill.md');

      const exists1 = fs.existsSync(skillMd1);
      const exists2 = fs.existsSync(skillMd2);

      if (!exists1 && !exists2) {
        failures.push(`${target.name}: ${skill}/SKILL.md not reachable`);
      }
    }
  }

  return failures;
}

/**
 * Validate the repository projection used to build/check Codex skill exports.
 * The live ~/.codex/skills directory is machine-local; the managed-home linker
 * points its user entry directly to ai/skills/active. Keeping this projection
 * constrained prevents future linkers or migrations from exporting additional
 * default-active user skills by accident.
 */
function validateCodexRepositoryProjection() {
  const codexSkillsRoot = path.join(repoRoot, 'operations/system-configs/codex/skills');
  const allowedEntries = new Set(['.system', 'user']);
  const ignoredEntries = new Set(['.DS_Store']);

  if (!fs.existsSync(codexSkillsRoot)) {
    return [`Codex skills repository projection missing: ${path.relative(repoRoot, codexSkillsRoot)}`];
  }

  const violations = [];
  const entries = fs.readdirSync(codexSkillsRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (allowedEntries.has(entry.name) || ignoredEntries.has(entry.name)) continue;

    violations.push(
      `Codex repository projection bypasses default profile: operations/system-configs/codex/skills/${entry.name}`,
    );
  }

  return violations;
}

/**
 * Main
 */
function main() {
  if (checkMode && dryRun) {
    error('Cannot use --check and --dry-run together');
    process.exit(1);
  }

  log('Skill sync — active-only mode');
  log(`Active skills dir: ${activeDir}`);
  log(`Repo root: ${repoRoot}`);
  log('');

  const activeSkills = getActiveSkills();
  stats.activeSkills = activeSkills.length;
  log(`Found ${activeSkills.length} active skills`);

  // Validate that active skills have SKILL.md
  let validSkillCount = 0;
  for (const skill of activeSkills) {
    const skillPath = path.join(activeDir, skill);
    const skillMd1 = path.join(skillPath, 'SKILL.md');
    const skillMd2 = path.join(skillPath, 'skill.md');
    if (fs.existsSync(skillMd1) || fs.existsSync(skillMd2)) {
      validSkillCount++;
    }
  }

  if (validSkillCount < activeSkills.length) {
    warn(
      `${activeSkills.length - validSkillCount} active skill(s) missing SKILL.md`,
    );
  }
  log('');

  // Process each target
  for (const target of targets) {
    log(`\n${target.name}:`);
    log(`  Target: ${target.target}`);
    log(`  Mode: ${target.mode}`);

    if (target.mode === 'root-symlink') {
      syncRootSymlink(target.target, target.name, target.expectTarget);
    } else if (target.mode === 'entry-symlinks') {
      syncEntrySymlinks(target.target, target.name, activeSkills);
    }
  }

  // Validate reachability
  log('\n--- Reachability Validation ---');
  const reachFailures = validateActiveSkillReachability(activeSkills);
  if (reachFailures.length > 0) {
    for (const failure of reachFailures) {
      error(failure);
      stats.reachabilityFailures.push(failure);
    }
  } else {
    success(`All ${activeSkills.length} active skills reachable at all targets`);
  }

  // Validate Codex root does not contain profile-bypassing default skills.
  log('\n--- Codex Root Validation ---');
  const codexRootViolations = validateCodexRepositoryProjection();
  if (codexRootViolations.length > 0) {
    for (const violation of codexRootViolations) {
      error(violation);
      stats.codexRootViolations.push(violation);
    }
  } else {
    success('Codex skills root contains only .system and profile-controlled user skills');
  }

  // Summary
  log('\n--- Summary ---');
  log(`Active skills:        ${stats.activeSkills}`);
  log(`Targets OK:           ${stats.targetsOk}`);
  log(`Targets changed:      ${stats.targetsChanged}`);
  log(`Targets blocked:      ${stats.targetsBlocked}`);
  log(`Reachability failures: ${stats.reachabilityFailures.length}`);
  log(`Codex root violations: ${stats.codexRootViolations.length}`);
  if (stats.warnings.length > 0) {
    log(`Warnings:             ${stats.warnings.length}`);
  }

  const syncOk =
    stats.targetsBlocked === 0 &&
    stats.reachabilityFailures.length === 0 &&
    stats.codexRootViolations.length === 0;

  if (checkMode) {
    if (!syncOk || stats.targetsChanged > 0) {
      error('\n❌ SYNC CHECK FAILED: corrections needed or invariant violated');
      process.exit(1);
    }
    success('\n✓ SYNC CHECK PASSED: all active skills consistently available');
    process.exit(0);
  }

  if (stats.targetsBlocked > 0 || stats.reachabilityFailures.length > 0) {
    error('\n❌ SYNC FAILED: blocked items or reachability issues exist');
    process.exit(1);
  }

  success('\n✓ SYNC OK: all active skills exported and verified');
  process.exit(0);
}

main();
