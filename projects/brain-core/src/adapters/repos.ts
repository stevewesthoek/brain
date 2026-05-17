import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreRepoSummary } from '../types/api.js';

const HANDOFF_CANDIDATES = [
  'docs/system/mind-os-migration-handoff-2026-05-16.md',
  'MIND-OS-HANDOFF-2026-05-16.md',
  'CURRENT-HANDOFF.md',
  'handoff.md',
] as const;

export function listRepos(): BrainCoreRepoSummary[] {
  const aliases = parseRepoAliases(process.env.BRAIN_CORE_REPO_ALIASES || process.env.PROBOT_REPO_ALIASES || '');

  if (aliases.length === 0) {
    return [
      {
        alias: 'configure-repos',
        path: 'Set BRAIN_CORE_REPO_ALIASES=name:/absolute/path,name2:/absolute/path',
        exists: false,
        handoffExists: false,
        source: 'placeholder',
      },
    ];
  }

  return aliases.map(([alias, repoPath]) => toRepoSummary(alias, repoPath));
}

function parseRepoAliases(raw: string): Array<[string, string]> {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item): [string, string] | undefined => {
      const colonIndex = item.indexOf(':');
      if (colonIndex < 1) {
        return undefined;
      }

      const alias = item.slice(0, colonIndex).trim();
      const repoPath = item.slice(colonIndex + 1).trim();
      if (!alias || !repoPath || repoPath.includes('..')) {
        return undefined;
      }

      return [alias, path.resolve(repoPath)];
    })
    .filter((entry): entry is [string, string] => entry !== undefined);
}

function toRepoSummary(alias: string, repoPath: string): BrainCoreRepoSummary {
  const exists = fs.existsSync(repoPath);
  const handoffPath = exists ? findHandoff(repoPath) : undefined;
  const summary: BrainCoreRepoSummary = {
    alias,
    path: repoPath,
    exists,
    handoffExists: handoffPath !== undefined,
    source: 'env',
  };

  if (handoffPath !== undefined) {
    summary.handoffPath = handoffPath;
  }

  return summary;
}

function findHandoff(repoPath: string): string | undefined {
  return HANDOFF_CANDIDATES.find((candidate) => fs.existsSync(path.join(repoPath, candidate)));
}
