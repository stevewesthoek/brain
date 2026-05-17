import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreSessionSummary } from '../types/api.js';

const DEFAULT_SESSION_LIMIT = 10;
const MAX_FILES_PER_ROOT = 200;
const SESSION_EXTENSIONS = new Set(['.jsonl', '.json', '.md', '.txt']);

export function listSessions(): BrainCoreSessionSummary[] {
  const configuredDirs = getConfiguredSessionDirs();
  const sessions = configuredDirs.flatMap((dir) => readSessionRoot(dir));

  if (sessions.length === 0) {
    return [
      {
        id: 'phase-1-placeholder',
        tool: 'unknown',
        title: 'No readable session directories configured yet',
        age: 'unknown',
        intent: 'setup',
        score: 0,
        source: 'placeholder',
      },
    ];
  }

  return sessions
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
    .slice(0, DEFAULT_SESSION_LIMIT);
}

function getConfiguredSessionDirs(): string[] {
  const rawDirs = [
    process.env.BRAIN_CORE_SESSION_DIRS,
    process.env.CLAUDE_PROJECTS_DIR,
    process.env.CODEX_SESSIONS_DIR,
    process.env.GEMINI_SESSIONS_DIR,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(':');

  if (!rawDirs) {
    return [];
  }

  return rawDirs
    .split(':')
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0)
    .filter((dir) => !dir.includes('..'));
}

function readSessionRoot(root: string): BrainCoreSessionSummary[] {
  const absoluteRoot = path.resolve(root);

  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const files = walkSessionFiles(absoluteRoot).slice(0, MAX_FILES_PER_ROOT);
  return files
    .map((filePath) => toSessionSummary(absoluteRoot, filePath))
    .filter((session): session is BrainCoreSessionSummary => session !== undefined);
}

function walkSessionFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0 && files.length < MAX_FILES_PER_ROOT) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && SESSION_EXTENSIONS.has(getExtension(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function toSessionSummary(root: string, filePath: string): BrainCoreSessionSummary | undefined {
  const stat = fs.statSync(filePath);
  const relativePath = path.relative(root, filePath);
  const id = relativePath;
  const tool = inferTool(relativePath);
  const updatedAt = stat.mtime.toISOString();
  const title = toTitle(stripExtension(getFilename(relativePath)));
  const repo = inferRepo(relativePath);
  const intent = inferIntent(`${relativePath} ${title}`);
  const age = formatAge(updatedAt);
  const score = scoreSession(updatedAt, intent);

  const session: BrainCoreSessionSummary = {
    id,
    tool,
    title,
    updatedAt,
    age,
    intent,
    score,
    source: 'adapter',
  };

  if (repo !== undefined) {
    session.repo = repo;
  }

  return session;
}

function inferTool(value: string): BrainCoreSessionSummary['tool'] {
  const lower = value.toLowerCase();

  if (lower.includes('claude')) {
    return 'claude';
  }

  if (lower.includes('codex')) {
    return 'codex';
  }

  if (lower.includes('gemini')) {
    return 'gemini';
  }

  return 'unknown';
}

function inferRepo(relativePath: string): string | undefined {
  const parts = relativePath.split('/').filter((part) => part.length > 0);
  if (parts.length <= 1) {
    return undefined;
  }

  return parts.slice(0, -1).join('/');
}

function inferIntent(value: string): string {
  const lower = value.toLowerCase();
  const rules: Array<{ label: string; keywords: string[] }> = [
    { label: 'deploy', keywords: ['deploy', 'release', 'ship', 'prod', 'production', 'vercel', 'dokploy'] },
    { label: 'ops', keywords: ['monitor', 'uptime', 'alert', 'infra', 'server', 'ssh', 'tmux', 'scheduler'] },
    { label: 'analytics', keywords: ['analytics', 'tracking', 'telemetry', 'metrics'] },
    { label: 'bugfix', keywords: ['bug', 'fix', 'broken', 'error', 'failing', 'issue', 'debug'] },
    { label: 'review', keywords: ['review', 'pull request', 'diff', 'comments'] },
    { label: 'docs', keywords: ['docs', 'readme', 'spec', 'documentation', 'handoff'] },
    { label: 'design', keywords: ['design', 'ui', 'ux', 'visual', 'layout'] },
    { label: 'auth', keywords: ['auth', 'oauth', 'token', 'login', 'slack', 'telegram'] },
    { label: 'data', keywords: ['migration', 'database', 'sql', 'schema', 'supabase', 'postgres'] },
    { label: 'research', keywords: ['research', 'notebooklm', 'investigate', 'analyze', 'strategy'] },
  ];

  return rules.find((rule) => rule.keywords.some((keyword) => lower.includes(keyword)))?.label ?? 'general';
}

function scoreSession(updatedAt: string, intent: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageMinutes = Number.isFinite(ageMs) ? Math.max(0, ageMs / 60_000) : Number.POSITIVE_INFINITY;
  let score = 0;

  if (ageMinutes <= 30) score += 80;
  else if (ageMinutes <= 120) score += 60;
  else if (ageMinutes <= 12 * 60) score += 40;
  else if (ageMinutes <= 24 * 60) score += 25;
  else if (ageMinutes <= 3 * 24 * 60) score += 10;

  if (intent !== 'general') {
    score += 5;
  }

  return score;
}

function formatAge(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Number.isFinite(diffMs) ? Math.max(0, Math.floor(diffMs / 60_000)) : 0;
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getFilename(value: string): string {
  const parts = value.split('/');
  return parts[parts.length - 1] ?? value;
}

function getExtension(value: string): string {
  const dotIndex = value.lastIndexOf('.');
  return dotIndex >= 0 ? value.slice(dotIndex) : '';
}

function stripExtension(value: string): string {
  const dotIndex = value.lastIndexOf('.');
  return dotIndex >= 0 ? value.slice(0, dotIndex) : value;
}

function toTitle(value: string): string {
  const compact = value
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return compact || 'Untitled session';
}
