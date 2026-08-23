import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadJson,
  stableJsonHash,
  validateJsonSchema
} from './context-learning-core.mjs';

export const SESSION_CONTINUITY_SCHEMA_VERSION = '1.0.0';
const FRESHNESS_STATES = new Set(['fresh', 'review_due', 'stale', 'superseded', 'contradicted', 'unknown']);
const ACTIVE_STATES = new Set(['not_started', 'in_progress', 'paused', 'blocked', 'acceptance_pending']);
const JSON_EXTENSIONS = new Set(['.json']);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(directory) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.md') || JSON_EXTENSIONS.has(path.extname(entry.name))))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function firstText(lines) {
  return lines.map((line) => line.trim()).find((line) => line.length > 0) ?? null;
}

function parseSections(markdown) {
  const sections = new Map();
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const title = matches[index][1].trim().toLowerCase();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    sections.set(title, markdown.slice(start, end).trim());
  }
  return sections;
}

function parseRepoAndBranch(value) {
  const text = firstText(String(value ?? '').split(/\r?\n/));
  if (!text) return { repository: null, branch: null };
  const match = text.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!match) return { repository: text, branch: null };
  return { repository: match[1].trim(), branch: match[2].trim() };
}

function parseBullets(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && !/^none( recorded)?$/i.test(line));
}

function parseTouchedFiles(value) {
  return parseBullets(value).map((item) => item.split(/\s+—\s+|\s+--\s+/)[0].trim()).filter(Boolean);
}

function parseMarkdownCandidate(markdown) {
  const sections = parseSections(markdown);
  const repo = parseRepoAndBranch(sections.get('repo'));
  const files = parseTouchedFiles(sections.get('files touched'));
  const decisions = parseBullets(sections.get('decisions made'));
  const blockers = parseBullets(sections.get('blockers'));
  const nextAction = firstText([
    ...parseBullets(sections.get('next step')),
    ...parseBullets(sections.get('next steps')),
    firstText(String(sections.get('next step') ?? '').split(/\r?\n/)) ?? '',
    firstText(String(sections.get('next steps') ?? '').split(/\r?\n/)) ?? ''
  ].filter(Boolean));

  return {
    repository: repo.repository,
    branch: repo.branch,
    tool: firstText(String(sections.get('tool') ?? '').split(/\r?\n/)),
    goal: firstText(String(sections.get('goal') ?? '').split(/\r?\n/)),
    status: firstText(String(sections.get('status') ?? '').split(/\r?\n/)),
    files_touched: files,
    decisions,
    blockers,
    next_action: nextAction,
    resume_prompt: firstText(String(sections.get('resume prompt') ?? '').split(/\r?\n/))
  };
}

function currentGitSnapshot(repoRoot) {
  const run = (args) => childProcess.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  const worktree = run(['rev-parse', '--show-toplevel']);
  const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = run(['rev-parse', 'HEAD']);
  const dirtyPaths = run(['status', '--porcelain=v1'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''))
    .sort();
  return {
    repository: path.basename(worktree),
    worktree: path.resolve(worktree),
    branch,
    head,
    dirty_paths: dirtyPaths
  };
}

function referencePath(repoRoot, reference) {
  if (typeof reference !== 'string' || reference.length === 0) return null;
  if (path.isAbsolute(reference)) return null;
  const resolved = path.resolve(repoRoot, reference);
  const relative = path.relative(path.resolve(repoRoot), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function collectRecordReferences(record) {
  const refs = [];
  for (const file of record.artifacts.changed_files ?? []) refs.push({ path: file.path, kind: 'changed_file', change: file.change });
  for (const validation of record.artifacts.validations ?? []) {
    for (const reference of validation.references ?? []) refs.push({ path: reference, kind: 'validation' });
  }
  for (const report of [...(record.artifacts.reports ?? []), ...(record.artifacts.acceptance_evidence ?? [])]) {
    refs.push({ path: report.path, kind: report.kind });
  }
  return refs;
}

function issue(code, detail, references = []) {
  return { code, detail, references: [...new Set(references)].sort() };
}

function validateRecord(record, schema, repoRoot, gitSnapshot, now) {
  const issues = validateJsonSchema(schema, record, schema);
    if (issues.length > 0) return issues.map((detail) => issue('schema_invalid', detail));

  const currentRepository = gitSnapshot.repository;
  const recordRepository = path.basename(record.repository.replace(/[\\/]$/, ''));
  if (recordRepository !== currentRepository) {
    issues.push(issue('repository_mismatch', `${record.repository} does not match ${currentRepository}`));
  }

  if (path.resolve(record.worktree) !== path.resolve(gitSnapshot.worktree)) {
    issues.push(issue('worktree_mismatch', `${record.worktree} does not match ${gitSnapshot.worktree}`));
  }

  if (record.branch !== gitSnapshot.branch) {
    issues.push(issue('branch_mismatch', `${record.branch} does not match ${gitSnapshot.branch}`));
  }

  if (record.base_revision !== gitSnapshot.head) {
    issues.push(issue('base_revision_stale', `${record.base_revision} does not match current HEAD ${gitSnapshot.head}`));
  }

  if (record.brain_revision !== gitSnapshot.head) {
    issues.push(issue('brain_revision_stale', `${record.brain_revision} does not match current HEAD ${gitSnapshot.head}`));
  }

  if (!FRESHNESS_STATES.has(record.freshness.state) || record.freshness.state !== 'fresh') {
    issues.push(issue('freshness_not_fresh', `session freshness is ${record.freshness.state}`));
  }

  if (record.objective.completion_state === 'superseded' || record.freshness.state === 'superseded') {
    issues.push(issue('session_superseded', 'session is superseded'));
  }

  const recordRefs = collectRecordReferences(record);
  for (const reference of recordRefs) {
    const resolved = referencePath(repoRoot, reference.path);
    if (!resolved) {
      issues.push(issue('reference_outside_repository', `${reference.kind} reference is not a relative repository path`, [reference.path]));
      continue;
    }
    if (reference.change !== 'deleted' && !fs.existsSync(resolved)) {
      issues.push(issue('missing_reference', `${reference.kind} reference does not exist`, [reference.path]));
    }
  }

  for (const validation of record.artifacts.validations ?? []) {
    if (validation.result !== 'passed') {
      issues.push(issue('validation_not_passed', `${validation.name} result is ${validation.result}`, validation.references));
    }
    if (Date.parse(validation.observed_at) > now.getTime()) {
      issues.push(issue('validation_timestamp_in_future', `${validation.name} is newer than inventory time`, validation.references));
    }
    if (Date.parse(validation.observed_at) < Date.parse(record.timestamps.updated_at)) {
      issues.push(issue('validation_precedes_session_update', `${validation.name} predates session update`, validation.references));
    }
  }

  return issues;
}

function extractCandidate(sourcePath, repoRoot, schema, gitSnapshot, now) {
  const sourceContent = readText(sourcePath);
  const sourceRevision = stableJsonHash(sourceContent);
  const relativeSourcePath = path.relative(repoRoot, sourcePath);
  const extension = path.extname(sourcePath);
  let extracted = {};
  let record = null;
  const issues = [];

  if (extension === '.json') {
    try {
      record = JSON.parse(sourceContent);
      extracted = {
        repository: record.repository ?? null,
        branch: record.branch ?? null,
        goal: record.objective?.goal ?? null,
        current_packet: record.objective?.current_packet ?? null,
        completed_work: record.state?.completed_work?.length ?? 0,
        pending_work: record.state?.pending_work?.length ?? 0,
        blockers: record.state?.blockers?.length ?? 0,
        decisions: record.state?.decisions?.length ?? 0,
        validation_evidence: record.artifacts?.validations?.length ?? 0,
        next_action: record.handoff?.next_action ?? null
      };
    } catch (error) {
      issues.push(issue('json_invalid', error instanceof Error ? error.message : String(error)));
    }
  } else {
    extracted = parseMarkdownCandidate(sourceContent);
    issues.push(issue('unstructured_handoff', 'Markdown handoff is an inventory candidate, not a validated session-continuity record'));
  }

  if (record) issues.push(...validateRecord(record, schema, repoRoot, gitSnapshot, now));

  return {
    candidate_id: `candidate-${sourceRevision.slice(0, 24)}`,
    source_path: relativeSourcePath,
    source_kind: path.basename(sourcePath) === 'current.md' ? 'current_handoff' : 'archived_handoff',
    source_revision: sourceRevision,
    extracted,
    record,
    valid: issues.length === 0,
    issues
  };
}

function changedFilePaths(candidate) {
  return new Set((candidate.record?.artifacts?.changed_files ?? []).map((file) => file.path));
}

function activeCandidate(candidate) {
  return candidate.valid && ACTIVE_STATES.has(candidate.record?.objective?.completion_state);
}

function detectConflicts(candidates) {
  const conflicts = [];
  const comparable = candidates.filter((candidate) => candidate.record && !candidate.record.freshness?.state?.includes('superseded'));
  for (let leftIndex = 0; leftIndex < comparable.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < comparable.length; rightIndex += 1) {
      const left = comparable[leftIndex];
      const right = comparable[rightIndex];
      const sameLocation = left.record.repository === right.record.repository
        && left.record.worktree === right.record.worktree
        && left.record.branch === right.record.branch;
      if (!sameLocation) continue;

      const leftFiles = changedFilePaths(left);
      const rightFiles = changedFilePaths(right);
      const overlap = [...leftFiles].filter((file) => rightFiles.has(file)).sort();
      if (activeCandidate(left) && activeCandidate(right)) {
        conflicts.push({
          type: overlap.length > 0 ? 'overlapping_active_sessions' : 'concurrent_active_sessions',
          candidate_ids: [left.candidate_id, right.candidate_id].sort(),
          references: overlap
        });
      } else if (overlap.length > 0) {
        conflicts.push({
          type: 'overlapping_session_artifacts',
          candidate_ids: [left.candidate_id, right.candidate_id].sort(),
          references: overlap
        });
      }
    }
  }
  return conflicts;
}

export function inventorySessionContinuity({
  repoRoot = process.cwd(),
  now = new Date(),
  gitSnapshot = null,
  schema = null
} = {}) {
  const root = path.resolve(repoRoot);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('valid_now_required');
  const snapshot = gitSnapshot ?? currentGitSnapshot(root);
  const contractSchema = schema ?? loadJson(path.join(root, 'operations/specs/context-learning/session-continuity.v1.schema.json'));
  const currentPath = path.join(root, '.ai', 'current.md');
  const handoffRoot = path.join(root, '.ai', 'handoffs');
  const sourcePaths = [
    ...(fs.existsSync(currentPath) ? [currentPath] : []),
    ...listFiles(handoffRoot)
  ];
  const candidates = sourcePaths.map((sourcePath) => extractCandidate(sourcePath, root, contractSchema, snapshot, now));
  const conflicts = detectConflicts(candidates);
  const validCandidates = candidates.filter((candidate) => candidate.valid);
  const selection = conflicts.length > 0
    ? { status: 'ambiguous', candidate_id: null, reason: 'conflicting_sessions', resume_allowed: false }
    : validCandidates.length === 1
      ? { status: 'single_candidate', candidate_id: validCandidates[0].candidate_id, reason: 'inventory_only', resume_allowed: false }
      : { status: validCandidates.length === 0 ? 'none_valid' : 'ambiguous', candidate_id: null, reason: validCandidates.length === 0 ? 'no_valid_session_record' : 'multiple_valid_session_records', resume_allowed: false };

  return {
    schema_version: SESSION_CONTINUITY_SCHEMA_VERSION,
    mode: 'READ_ONLY_INVENTORY',
    repository: snapshot,
    candidates,
    conflicts,
    selection
  };
}

function parseArgs(argv) {
  const options = {};
  const rootIndex = argv.indexOf('--repo-root');
  if (rootIndex >= 0) options.repoRoot = argv[rootIndex + 1];
  const nowIndex = argv.indexOf('--now');
  if (nowIndex >= 0) options.now = new Date(argv[nowIndex + 1]);
  return options;
}

const invokedAsScript = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  try {
    console.log(JSON.stringify(inventorySessionContinuity(parseArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(`session-continuity-inventory failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
