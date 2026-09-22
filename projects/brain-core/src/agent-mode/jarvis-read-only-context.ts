import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { JarvisAdmittedContextV1 } from './jarvis-local-context.js';

const MAX_CONTEXT_CHARS = 12_000;
const MAX_DIRECTORY_ENTRIES = 96;
const MAX_FILE_CHARS = 4_000;
const SUMMARY_FILES = new Set(['README', 'README.md', 'README.txt', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'tsconfig.json']);
const SENSITIVE_SEGMENT = /(?:^|[\\/.])(?:\.env(?:\.|$)|\.aws(?:[\\/.]|$)|\.ssh(?:[\\/.]|$)|credentials?(?:[\\/.]|$)|secrets?(?:[\\/.]|$)|private-keys?(?:[\\/.]|$))/iu;

function bounded(value: string): string {
  return value.length <= MAX_CONTEXT_CHARS ? value : `${value.slice(0, MAX_CONTEXT_CHARS)}\n[context truncated]`;
}

function safeRoot(context: JarvisAdmittedContextV1): string | undefined {
  if (context.admittedAccess !== 'read' || SENSITIVE_SEGMENT.test(context.canonicalPath)) return undefined;
  try {
    const resolved = realpathSync(context.canonicalPath);
    return resolved === context.canonicalPath && lstatSync(resolved).isDirectory() ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function directorySummary(root: string): string {
  try {
    const entries = readdirSync(root, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && !SENSITIVE_SEGMENT.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_DIRECTORY_ENTRIES)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
    return entries.length > 0 ? entries.join(', ') : '(empty)';
  } catch {
    return '(unavailable)';
  }
}

function branchSummary(root: string): string {
  try {
    const gitPath = path.join(root, '.git');
    const gitStat = lstatSync(gitPath);
    const gitRoot = gitStat.isDirectory()
      ? gitPath
      : path.resolve(root, readFileSync(gitPath, 'utf8').trim().replace(/^gitdir:\s*/u, ''));
    const head = readFileSync(path.join(gitRoot, 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : '(detached HEAD)';
  } catch {
    return '(unavailable)';
  }
}

function summaryFile(root: string, name: string): string | undefined {
  const filePath = path.join(root, name);
  try {
    if (SENSITIVE_SEGMENT.test(filePath) || !lstatSync(filePath).isFile()) return undefined;
    const content = readFileSync(filePath, 'utf8');
    if (name === 'package.json') {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const summary = {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 512) : undefined,
        scripts: parsed.scripts && typeof parsed.scripts === 'object' && !Array.isArray(parsed.scripts) ? Object.keys(parsed.scripts as Record<string, unknown>).sort() : undefined,
        dependencies: parsed.dependencies && typeof parsed.dependencies === 'object' && !Array.isArray(parsed.dependencies) ? Object.keys(parsed.dependencies as Record<string, unknown>).sort().slice(0, 64) : undefined,
      };
      return JSON.stringify(summary);
    }
    return content.slice(0, MAX_FILE_CHARS);
  } catch {
    return undefined;
  }
}

/**
 * Builds a bounded read-only prompt supplement from contexts already admitted
 * by Brain policy. It contains no tool authority and never writes to the
 * repository; model runtimes receive only this snapshot, not arbitrary paths.
 */
export function buildJarvisReadOnlyContext(contexts: readonly JarvisAdmittedContextV1[]): string | undefined {
  const sections: string[] = [];
  for (const context of contexts.slice().sort((a, b) => a.contextKey.localeCompare(b.contextKey)).slice(0, 4)) {
    const root = safeRoot(context);
    if (!root) continue;
    const files = [...SUMMARY_FILES]
      .sort()
      .map((name) => ({ name, content: summaryFile(root, name) }))
      .filter((entry): entry is { name: string; content: string } => entry.content !== undefined)
      .map((entry) => `### ${entry.name}\n${entry.content}`)
      .join('\n');
    const header = [
      `repositoryRef: ${context.repositoryRef ?? '(none)'}`,
      `repositoryRoot: ${path.basename(root)}`,
      `gitBranch: ${branchSummary(root)}`,
      `admittedAccess: ${context.admittedAccess}`,
      `topLevelEntries: ${directorySummary(root)}`,
    ].join('\n');
    sections.push(`${header}${files ? `\n${files}` : ''}`);
  }
  if (sections.length === 0) return undefined;
  return bounded([
    '[Brain read-only context snapshot]',
    'Use this bounded snapshot to answer the user request. Do not claim tool execution or access to files not represented here.',
    sections.join('\n\n'),
  ].join('\n'));
}
