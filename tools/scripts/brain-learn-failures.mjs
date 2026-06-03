#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_LIMIT = 200;
const DEFAULT_OUT = path.join(process.cwd(), 'runtime', 'local', 'failure-learning', 'latest.md');

function usage() {
  console.log(`Usage:
  brain-learn-failures [--repo PATH] [--limit N] [--write-report] [--json]

Purpose:
  Dry-run failure-pattern mining for Claude, Codex, and Gemini session logs.
  It reports recurring path, command, and environment gotchas. It never edits
  CLAUDE.md, AGENTS.md, GEMINI.md, skills, or memory.`);
}

function parseArgs(argv) {
  const args = { repo: process.cwd(), limit: DEFAULT_LIMIT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--write-report') args.writeReport = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--repo') {
      args.repo = argv[i + 1];
      i += 1;
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function walk(root, predicate, maxFiles = 5000) {
  const found = [];
  if (!fs.existsSync(root)) return found;
  const stack = [root];
  while (stack.length && found.length < maxFiles) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (predicate(full)) found.push(full);
    }
  }
  return found;
}

function candidateFiles() {
  const home = os.homedir();
  return [
    ...walk(path.join(home, '.claude', 'projects'), (file) => file.endsWith('.jsonl')),
    ...walk(path.join(home, '.codex', 'sessions'), (file) => /\.(json|jsonl)$/.test(file)),
    ...walk(path.join(home, '.gemini', 'tmp'), (file) => /session-.*\.json/.test(path.basename(file))),
  ];
}

function readRelevantText(file, repoName) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  if (repoName && !text.toLowerCase().includes(repoName.toLowerCase())) return '';
  return text;
}

function extractStrings(value, out = []) {
  if (out.length > 2000) return out;
  if (typeof value === 'string') {
    if (value.length > 8) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => extractStrings(item, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const key of ['content', 'text', 'stdout', 'stderr', 'output', 'error', 'message', 'result']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) extractStrings(value[key], out);
    }
    return out;
  }
  return out;
}

function sessionTextUnits(text) {
  const units = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      units.push(...extractStrings(parsed));
    } catch {
      units.push(trimmed);
    }
  }
  return units;
}

function classifyLine(line) {
  const rules = [
    ['missing_path', /(no such file|enoent|cannot find module|cannot find package|could not read|path does not exist|not in the working tree)/i],
    ['command_failed', /(command not found|exit code [1-9][0-9]*|exited with [1-9][0-9]*|non-zero|failed with exit)/i],
    ['permission', /(permission denied|operation not permitted|approval denied|sandbox denied|not allowed by policy)/i],
    ['module_runtime', /(module not found|cannot find module|importerror|modulenotfounderror|package not found)/i],
    ['test_failure', /(assertionerror|test failed|tests failed|failing test|expected .* received)/i],
  ];
  for (const [type, regex] of rules) {
    if (regex.test(line)) return type;
  }
  return null;
}

function compactSnippet(line) {
  return line
    .replace(/"?(access|refresh|api|client|auth|bearer|cookie|token|secret|password)[_-]?(key|token|secret)?"?\s*[:=]\s*["']?[^"',\s}]+/gi, '$1_$2=[REDACTED]')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function collectPatterns(files, repoName, limit) {
  const patterns = new Map();
  for (const file of files) {
    const text = readRelevantText(file, repoName);
    if (!text) continue;
    const units = sessionTextUnits(text);
    for (const unit of units) {
      const type = classifyLine(unit);
      if (!type) continue;
      const snippet = compactSnippet(unit);
      const key = `${type}:${snippet.toLowerCase().replace(/\d+/g, '#')}`;
      const current = patterns.get(key) || { type, count: 0, examples: [], files: new Set() };
      current.count += 1;
      if (current.examples.length < 3) current.examples.push(snippet);
      current.files.add(file);
      patterns.set(key, current);
      if (patterns.size >= limit) return patterns;
    }
  }
  return patterns;
}

function recommendationFor(type) {
  switch (type) {
    case 'missing_path':
      return 'Add a repo-specific path correction only if the correct path is stable and recurring.';
    case 'command_failed':
      return 'Document the working command form only if the failure repeats and the fix is non-obvious.';
    case 'permission':
      return 'Keep as a guardrail note; do not automate the blocked action.';
    case 'module_runtime':
      return 'Check whether the repo requires a specific runtime wrapper such as npm --prefix, uv, bun, or a venv.';
    case 'test_failure':
      return 'Promote only if the failure reveals a recurring local test/setup gotcha.';
    default:
      return 'Review manually before promoting.';
  }
}

function renderMarkdown(repo, files, patterns) {
  const sorted = [...patterns.values()].sort((a, b) => b.count - a.count);
  const lines = [
    '# Failure Learning Report',
    '',
    `Repo: ${repo}`,
    `Generated: ${new Date().toISOString()}`,
    `Session files scanned: ${files.length}`,
    '',
    'This report is advisory. It does not write agent instructions or create skills.',
    '',
    '## Candidate Patterns',
    '',
  ];
  if (sorted.length === 0) {
    lines.push('No recurring failure patterns found for this repo scope.');
    return lines.join('\n');
  }
  for (const pattern of sorted.slice(0, 25)) {
    lines.push(`### ${pattern.type} (${pattern.count})`);
    lines.push('');
    lines.push(`Recommendation: ${recommendationFor(pattern.type)}`);
    lines.push('');
    lines.push('Examples:');
    pattern.examples.forEach((example) => lines.push(`- ${example}`));
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const repo = path.resolve(args.repo);
  const repoName = path.basename(repo);
  const files = candidateFiles();
  const patterns = collectPatterns(files, repoName, args.limit);
  const report = renderMarkdown(repo, files, patterns);
  if (args.writeReport) {
    fs.mkdirSync(path.dirname(DEFAULT_OUT), { recursive: true });
    fs.writeFileSync(DEFAULT_OUT, report + '\n');
  }
  if (args.json) {
    console.log(JSON.stringify({
      repo,
      files_scanned: files.length,
      patterns: [...patterns.values()].map((pattern) => ({
        type: pattern.type,
        count: pattern.count,
        examples: pattern.examples,
        recommendation: recommendationFor(pattern.type),
      })),
      report_path: args.writeReport ? DEFAULT_OUT : null,
    }, null, 2));
  } else {
    console.log(report);
    if (args.writeReport) console.error(`brain-learn-failures: wrote ${DEFAULT_OUT}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`brain-learn-failures: ${error.message}`);
  process.exit(1);
}
