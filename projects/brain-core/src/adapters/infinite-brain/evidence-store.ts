/**
 * Infinite Brain Runtime — Evidence Store Adapter
 * Append-only JSONL log linking edges to supporting sources
 * Every inferred edge must have evidence tracing to sources
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { EvidenceRecord, EdgeRecord } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EVIDENCE_STORE_PATH = path.join(
  __dirname,
  '../../../../runtime/local/infinite-brain/evidence-store.jsonl'
);

/**
 * Ensure evidence store directory exists
 */
async function ensureEvidenceDirectory(): Promise<void> {
  const dir = path.dirname(EVIDENCE_STORE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

/**
 * Validate evidence record before writing
 */
function validateEvidence(record: EvidenceRecord): void {
  if (!record.evidenceId || typeof record.evidenceId !== 'string') {
    throw new Error(`Invalid evidenceId: ${record.evidenceId}`);
  }
  if (!['mind', 'brain'].includes(record.sourceRepo)) {
    throw new Error(`Invalid sourceRepo: ${record.sourceRepo}`);
  }
  if (!record.sourcePath || typeof record.sourcePath !== 'string') {
    throw new Error(`Invalid sourcePath: ${record.sourcePath}`);
  }
  if (!['file', 'markdown-link', 'frontmatter', 'api-response'].includes(record.sourceKind)) {
    throw new Error(`Invalid sourceKind: ${record.sourceKind}`);
  }
  if (!record.capturedAt || !/^\d{4}-\d{2}-\d{2}T/.test(record.capturedAt)) {
    throw new Error(`Invalid capturedAt: ${record.capturedAt}`);
  }
  if (!record.summary || typeof record.summary !== 'string') {
    throw new Error(`Invalid summary: ${record.summary}`);
  }
  if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
    throw new Error(`Invalid confidence: ${record.confidence}`);
  }
  if (!Array.isArray(record.relatedEntityIds)) {
    throw new Error(`Invalid relatedEntityIds: must be array`);
  }
}

/**
 * Validate edge record before writing
 */
function validateEdge(record: EdgeRecord): void {
  if (!record.edgeId || typeof record.edgeId !== 'string') {
    throw new Error(`Invalid edgeId: ${record.edgeId}`);
  }
  if (!record.sourceEntityId || typeof record.sourceEntityId !== 'string') {
    throw new Error(`Invalid sourceEntityId: ${record.sourceEntityId}`);
  }
  if (!record.targetEntityId || typeof record.targetEntityId !== 'string') {
    throw new Error(`Invalid targetEntityId: ${record.targetEntityId}`);
  }
  const validEdgeTypes = [
    'supports',
    'contradicts',
    'depends_on',
    'derived_from',
    'related_to',
    'part_of',
    'preceded_by',
    'followed_by',
    'authored',
    'tagging',
  ];
  if (!validEdgeTypes.includes(record.edgeType)) {
    throw new Error(`Invalid edgeType: ${record.edgeType}`);
  }
  if (typeof record.strengthScore !== 'number' || record.strengthScore < 0 || record.strengthScore > 1) {
    throw new Error(`Invalid strengthScore: ${record.strengthScore}`);
  }
  if (!['system', 'steve'].includes(record.addedBy)) {
    throw new Error(`Invalid addedBy: ${record.addedBy}`);
  }
  if (!record.timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(record.timestamp)) {
    throw new Error(`Invalid timestamp: ${record.timestamp}`);
  }
}

/**
 * Link evidence to an edge
 * Creates both evidence record and edge record
 */
export async function linkEvidence(evidence: EvidenceRecord, edge: EdgeRecord): Promise<void> {
  try {
    validateEvidence(evidence);
    validateEdge(edge);
    await ensureEvidenceDirectory();

    const evidenceLine = JSON.stringify(evidence);
    const edgeLine = JSON.stringify(edge);

    await fs.appendFile(EVIDENCE_STORE_PATH, evidenceLine + '\n', 'utf8');
    await fs.appendFile(EVIDENCE_STORE_PATH, edgeLine + '\n', 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to link evidence: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get evidence records by confidence threshold
 */
export async function getEvidenceByConfidence(
  minConfidence: number = 0.75
): Promise<EvidenceRecord[]> {
  try {
    const content = await fs.readFile(EVIDENCE_STORE_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    return lines
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed as EvidenceRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is EvidenceRecord => r !== null && 'confidence' in r && r.confidence >= minConfidence);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(
      `Failed to get evidence: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get edge records by strength threshold
 */
export async function getEdgesByStrength(
  minStrength: number = 0.75
): Promise<EdgeRecord[]> {
  try {
    const content = await fs.readFile(EVIDENCE_STORE_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    return lines
      .map((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed as EdgeRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is EdgeRecord => r !== null && 'strengthScore' in r && r.strengthScore >= minStrength);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(
      `Failed to get edges: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all evidence for a specific edge
 */
export async function getEvidenceForEdge(edgeId: string): Promise<EvidenceRecord[]> {
  try {
    const content = await fs.readFile(EVIDENCE_STORE_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    const allRecords = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((r): r is EvidenceRecord | EdgeRecord => r !== null);

    // Get the edge record first
    const edgeRecord = allRecords.find((r): r is EdgeRecord => 'edgeId' in r && r.edgeId === edgeId);
    if (!edgeRecord) {
      return [];
    }

    // Find evidence records referenced by this edge
    return allRecords.filter(
      (r): r is EvidenceRecord =>
        'evidenceId' in r && edgeRecord.sourceEvidenceIds.includes(r.evidenceId)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(
      `Failed to get edge evidence: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get evidence store statistics
 */
export async function getEvidenceStats(): Promise<{
  totalRecords: number;
  evidenceCount: number;
  edgeCount: number;
  bySourceRepo: Record<string, number>;
  bySourceKind: Record<string, number>;
}> {
  try {
    const content = await fs.readFile(EVIDENCE_STORE_PATH, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim());

    const records = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((r) => r !== null);

    const stats = {
      totalRecords: records.length,
      evidenceCount: 0,
      edgeCount: 0,
      bySourceRepo: {} as Record<string, number>,
      bySourceKind: {} as Record<string, number>,
    };

    records.forEach((r) => {
      if ('evidenceId' in r) {
        stats.evidenceCount++;
        stats.bySourceRepo[r.sourceRepo] = (stats.bySourceRepo[r.sourceRepo] || 0) + 1;
        stats.bySourceKind[r.sourceKind] = (stats.bySourceKind[r.sourceKind] || 0) + 1;
      } else if ('edgeId' in r) {
        stats.edgeCount++;
      }
    });

    return stats;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        totalRecords: 0,
        evidenceCount: 0,
        edgeCount: 0,
        bySourceRepo: {},
        bySourceKind: {},
      };
    }
    throw new Error(
      `Failed to compute stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get path to evidence store (for testing/inspection)
 */
export function getEvidenceStorePath(): string {
  return EVIDENCE_STORE_PATH;
}
