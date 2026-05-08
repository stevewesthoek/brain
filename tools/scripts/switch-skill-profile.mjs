#!/usr/bin/env node
/**
 * switch-skill-profile.mjs
 *
 * Conservative profile switcher for brain skills.
 *
 * It keeps source skills intact and changes only ai/skills/active symlinks.
 * It refuses to delete or overwrite real files/directories in ai/skills/active.
 *
 * Usage:
 *   node tools/scripts/switch-skill-profile.mjs default --dry-run
 *   node tools/scripts/switch-skill-profile.mjs default --apply
 *   node tools/scripts/switch-skill-profile.mjs default --check
 *   node tools/scripts/switch-skill-profile.mjs --list
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const activeDir = path.join(repoRoot, 'ai/skills/active');
const customDir = path.join(repoRoot, 'ai/skills/custom');
const vendorsDir = path.join(repoRoot, 'ai/skills/vendors');
const profileDir = path.join(repoRoot, 'docs/skills/profiles');
const backupDir = path.join(repoRoot, 'runtime/local/skill-profiles/backups');
const syncScript = path.join(repoRoot, 'tools/scripts/sync-ai-skills.mjs');

const args = process.argv.slice(2);
const profileName = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const check = args.includes('--check');
const list = args.includes('--list');
const verbose = args.includes('--verbose');

function log(message = '') {
  console.log(message);
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.warn(`⚠️  ${message}`);
}

function ensureMode() {
  const modes = [dryRun, apply, check, list].filter(Boolean).length;
  if (modes !== 1) {
    fail('Choose exactly one mode: --dry-run, --apply, --check, or --list');
  }
  if (!list && !profileName) {
    fail('Missing profile name. Example: node tools/scripts/switch-skill-profile.mjs default --dry-run');
  }
}

function readProfile(name) {
  const profilePath = path.join(profileDir, `${name}.txt`);
  if (!fs.existsSync(profilePath)) {
    fail(`Profile not found: docs/skills/profiles/${name}.txt`);
  }

  const lines = fs.readFileSync(profilePath, 'utf8').split(/\r?\n/);
  const skills = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    skills.push(line);
  }

  const duplicates = skills.filter((skill, index) => skills.indexOf(skill) !== index);
  if (duplicates.length > 0) {
    fail(`Profile ${name} has duplicate skill entries: ${[...new Set(duplicates)].join(', ')}`);
  }

  return { profilePath, skills };
}

function listProfiles() {
  if (!fs.existsSync(profileDir)) {
    fail(`Profile directory not found: ${path.relative(repoRoot, profileDir)}`);
  }
  const profiles = fs
    .readdirSync(profileDir)
    .filter((name) => name.endsWith('.txt'))
    .map((name) => name.replace(/\.txt$/, ''))
    .sort();
  log('Available skill profiles:');
  for (const name of profiles) {
    const { skills } = readProfile(name);
    log(`  ${name} (${skills.length} skills)`);
  }
}

function lstatSafe(p) {
  try {
    return fs.lstatSync(p);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function isSkillSource(p) {
  return fs.existsSync(path.join(p, 'SKILL.md')) || fs.existsSync(path.join(p, 'skill.md'));
}

function getActiveEntries() {
  if (!fs.existsSync(activeDir)) {
    fail(`Active skill directory not found: ${path.relative(repoRoot, activeDir)}`);
  }
  return fs.readdirSync(activeDir).sort();
}

function resolveExistingActiveSource(skill) {
  const activePath = path.join(activeDir, skill);
  const stat = lstatSafe(activePath);
  if (!stat) return null;

  if (stat.isSymbolicLink()) {
    const real = fs.realpathSync(activePath);
    if (isSkillSource(real) || skill.endsWith('.md')) return real;
    return null;
  }

  // Some repo snapshots show active entries as directories through symlink resolution.
  // Never remove non-symlink active entries during switching, but allow source resolution.
  if (stat.isDirectory() && isSkillSource(activePath)) return activePath;
  if (stat.isFile() && skill.endsWith('.md')) return activePath;
  return null;
}

function walkForSkillSource(root, skill) {
  if (!fs.existsSync(root)) return null;

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const base = path.basename(current);

    if (base === skill && isSkillSource(current)) {
      return current;
    }

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(child);
      if (entry.isFile() && entry.name === skill && skill.endsWith('.md')) return child;
    }
  }

  return null;
}

function resolveSkillSource(skill) {
  const fromActive = resolveExistingActiveSource(skill);
  if (fromActive) return fromActive;

  // Common direct locations first.
  const directCandidates = [
    path.join(customDir, skill),
    path.join(customDir, 'learned', skill),
    path.join(vendorsDir, skill),
    path.join(activeDir, skill),
  ];

  for (const candidate of directCandidates) {
    if (skill.endsWith('.md') && fs.existsSync(candidate) && lstatSafe(candidate)?.isFile()) {
      return candidate;
    }
    if (isSkillSource(candidate)) return candidate;
  }

  const customMatch = walkForSkillSource(customDir, skill);
  if (customMatch) return customMatch;

  const vendorMatch = walkForSkillSource(vendorsDir, skill);
  if (vendorMatch) return vendorMatch;

  return null;
}

function validateProfileSkills(skills) {
  const resolved = new Map();
  const missing = [];

  for (const skill of skills) {
    const source = resolveSkillSource(skill);
    if (!source) {
      missing.push(skill);
    } else {
      resolved.set(skill, source);
    }
  }

  if (missing.length > 0) {
    fail(`Profile references missing/unresolvable skills: ${missing.join(', ')}`);
  }

  return resolved;
}

function backupActiveSet() {
  const entries = getActiveEntries();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `active-${stamp}.txt`);

  if (!dryRun && apply) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(
      backupPath,
      `# Active skill backup created ${new Date().toISOString()}\n${entries.join('\n')}\n`,
      'utf8',
    );
  }

  return { entries, backupPath };
}

function ensureActiveIsSafeToSwitch() {
  const entries = getActiveEntries();
  const unsafe = [];

  for (const entry of entries) {
    const p = path.join(activeDir, entry);
    const stat = lstatSafe(p);
    if (!stat) continue;

    if (!stat.isSymbolicLink()) {
      unsafe.push(entry);
    }
  }

  if (unsafe.length > 0) {
    fail(
      `Refusing to switch because ai/skills/active contains non-symlink entries: ${unsafe.join(', ')}. ` +
        'Resolve these manually or update the script after inspection.',
    );
  }
}

function relativeSymlinkTarget(fromPath, toPath) {
  return path.relative(path.dirname(fromPath), toPath);
}

function applyProfile(skills, resolved) {
  ensureActiveIsSafeToSwitch();
  const { entries, backupPath } = backupActiveSet();

  log(`Current active skills: ${entries.length}`);
  log(`Target active skills:  ${skills.length}`);
  if (dryRun) log('[DRY-RUN] No filesystem changes will be made.');
  if (apply) ok(`Backup will be written to ${path.relative(repoRoot, backupPath)}`);

  const targetSet = new Set(skills);

  for (const entry of entries) {
    if (targetSet.has(entry)) continue;
    const p = path.join(activeDir, entry);
    const stat = lstatSafe(p);
    if (!stat) continue;
    if (!stat.isSymbolicLink()) {
      fail(`Refusing to remove non-symlink active entry: ${entry}`);
    }
    if (dryRun) {
      log(`  [DRY-RUN] remove active entry: ${entry}`);
    } else if (apply) {
      fs.rmSync(p);
      if (verbose) log(`  removed: ${entry}`);
    }
  }

  for (const skill of skills) {
    const activePath = path.join(activeDir, skill);
    const sourcePath = resolved.get(skill);
    const stat = lstatSafe(activePath);

    if (stat) {
      if (verbose) log(`  keep existing: ${skill}`);
      continue;
    }

    if (dryRun) {
      log(`  [DRY-RUN] add active entry: ${skill} -> ${path.relative(repoRoot, sourcePath)}`);
    } else if (apply) {
      const rel = relativeSymlinkTarget(activePath, sourcePath);
      fs.symlinkSync(rel, activePath, skill.endsWith('.md') ? 'file' : 'dir');
      if (verbose) log(`  added: ${skill} -> ${rel}`);
    }
  }
}

function checkProfile(skills) {
  const active = getActiveEntries();
  const activeSet = new Set(active);
  const profileSet = new Set(skills);
  const missing = skills.filter((skill) => !activeSet.has(skill));
  const extra = active.filter((skill) => !profileSet.has(skill));

  log(`Active skills:  ${active.length}`);
  log(`Profile skills: ${skills.length}`);

  if (missing.length === 0 && extra.length === 0) {
    ok('Active set exactly matches profile');
    return;
  }

  if (missing.length > 0) {
    warn(`Missing from active: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    warn(`Extra active entries: ${extra.join(', ')}`);
  }
  process.exit(1);
}

function runSync() {
  if (!apply) return;

  log('\nSyncing active skills to all AI/IDE consumers...');
  let result = spawnSync(process.execPath, [syncScript], { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail('sync-ai-skills.mjs failed');

  result = spawnSync(process.execPath, [syncScript, '--check'], { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail('sync-ai-skills.mjs --check failed');

  ok('Skill sync verified for all configured consumers');
}

function main() {
  ensureMode();

  if (list) {
    listProfiles();
    return;
  }

  const { profilePath, skills } = readProfile(profileName);
  log(`Profile: ${profileName}`);
  log(`Path:    ${path.relative(repoRoot, profilePath)}`);
  log(`Skills:  ${skills.length}`);

  const resolved = validateProfileSkills(skills);
  ok('All profile skills resolved to source paths');

  if (check) {
    checkProfile(skills);
    return;
  }

  applyProfile(skills, resolved);

  if (dryRun) {
    ok('Dry run complete');
    return;
  }

  runSync();
  ok(`Applied skill profile: ${profileName}`);
}

main();
