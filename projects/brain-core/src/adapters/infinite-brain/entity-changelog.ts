/**
 * Infinite Brain Runtime — Entity Changelog Adapter
 * Append-only JSONL log of entity mutations (created/updated/deleted)
 * Never overwrites; strictly append-only semantics
 */

import fs from 'fs/promises';
import path from 'path';
import type { EntityMutation } from './types.js';

const CHANGELOG_PATH = process.env.IBR_ENTITY_CHANGELOG_PATH
  ? path.resolve(process.env.IBR_ENTITY_CHANGELOG_PATH)
  : path.resolve(process.cwd(), '../..', 'runtime/local/infinite-brain/entity-changelog.jsonl');

/**
 * Ensure changelog directory exists
 */
async function ensureChangelogDirectory(): Promise<void> {
  const dir = path.dirname(CHANGELOG_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * Validate mutation record before writing
 */
function validateMutation(mutation: EntityMutation): void {
  if (!mutation.timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(mutation.timestamp)) {
    throw new Error(`Invalid timestamp: ${mutation.timestamp}`);
  }
  if (!mutation.entityId || typeof mutation.entityId !== 'string') {
    throw new Error(`Invalid entityId: ${mutation.entityId}`);
  }
  if (!mutation.entityType || typeof mutation.entityType !== 'string') {
    throw new Error(`Invalid entityType: ${mutation.entityType}`);
  }
  if (!['created', 'updated', 'deleted'].includes(mutation.action)) {
    throw new Error(`Invalid action: ${mutation.action}`);
  }
  if (!['system', 'steve'].includes(mutation.author)) {
    throw new Error(`Invalid author: ${mutation.author}`);
  }
  if (!mutation.sourceJob || typeof mutation.sourceJob !== 'string') {
    throw new Error(`Invalid sourceJob: ${mutation.sourceJob}`);
  }
  if (typeof mutation.diffSummary !== 'string') {
    throw new Error(`Invalid diffSummary: ${mutation.diffSummary}`);
  }
}

/**
 * Log a mutation to the append-only changelog
 * Validates before writing; never overwrites existing lines
 */
export async function logMutation(mutation: EntityMutation): Promise<void> {
  try {
    validateMutation(mutation);
    await ensureChangelogDirectory();

    const line = JSON.stringify(mutation);
    await fs.appendFile(CHANGELOG_PATH, line + '\n', 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to log mutation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Read recent mutations from changelog (last N lines)
 * Returns JSON-parsed objects
 */
export async function getRecentMutations(limit: number = 20): Promise<EntityMutation[]> {
  try {
    const content = await fs.readFile(CHANGELOG_PATH, 'utf8');
    const lines = content
      .split('\n')
      .filter((line) => line.trim())
      .slice(-limit);

    return lines.map((line) => JSON.parse(line) as EntityMutation);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(
      `Failed to read mutations: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Filter mutations by entity type or author
 */
export async function filterMutations(
  predicate: (mutation: EntityMutation) => boolean
): Promise<EntityMutation[]> {
  try {
    const content = await fs.readFile(CHANGELOG_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    return lines
      .map((line) => JSON.parse(line) as EntityMutation)
      .filter(predicate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(
      `Failed to filter mutations: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get changelog statistics
 */
export async function getChangelogStats(): Promise<{
  totalMutations: number;
  byAction: Record<string, number>;
  byAuthor: Record<string, number>;
  byEntityType: Record<string, number>;
}> {
  try {
    const content = await fs.readFile(CHANGELOG_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());
    const mutations = lines.map((line) => JSON.parse(line) as EntityMutation);

    const stats = {
      totalMutations: mutations.length,
      byAction: { created: 0, updated: 0, deleted: 0 },
      byAuthor: { system: 0, steve: 0 },
      byEntityType: {} as Record<string, number>,
    };

    mutations.forEach((m) => {
      stats.byAction[m.action]++;
      stats.byAuthor[m.author]++;
      stats.byEntityType[m.entityType] = (stats.byEntityType[m.entityType] || 0) + 1;
    });

    return stats;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        totalMutations: 0,
        byAction: { created: 0, updated: 0, deleted: 0 },
        byAuthor: { system: 0, steve: 0 },
        byEntityType: {},
      };
    }
    throw new Error(
      `Failed to compute stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get path to changelog file (for testing/inspection)
 */
export function getChangelogPath(): string {
  return CHANGELOG_PATH;
}
