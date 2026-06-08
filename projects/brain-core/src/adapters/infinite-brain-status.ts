/**
 * Infinite Brain Runtime — Status Adapter
 * Exposes runtime status summary (read-only)
 */

import fs from 'fs/promises';
import path from 'path';

const RUNTIME_DIR = path.resolve(process.cwd(), '../..', 'runtime/local/infinite-brain');

interface AtomizerReport {
  timestamp: string;
  summary: {
    totalFilesAnalyzed: number;
    keepAtomic: number;
    considerSplit: number;
  };
  candidates?: Array<{ path: string; totalLines: number }>;
}

interface ClassifierReport {
  timestamp: string;
  summary: {
    totalFilesAnalyzed: number;
    withExistingType: number;
    inferred: number;
    needsAtomization: number;
    avgConfidence: number;
  };
}

interface EdgeInferenceReport {
  timestamp: string;
  summary: {
    totalEntities: number;
    totalInferredEdges: number;
    highConfidenceEdges: number;
    candidates: number;
  };
}

interface ChangelogStats {
  totalMutations: number;
  byAction: Record<string, number>;
  byAuthor: Record<string, number>;
  byEntityType: Record<string, number>;
}

interface EvidenceStats {
  totalRecords: number;
  evidenceCount: number;
  edgeCount: number;
  bySourceRepo: Record<string, number>;
  bySourceKind: Record<string, number>;
}

/**
 * Load JSON report safely
 */
async function loadReport<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Get atomizer status
 */
async function getAtomizerStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      filesAnalyzed: number;
      keepAtomic: number;
      considerSplit: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<AtomizerReport>(
    path.join(RUNTIME_DIR, 'atomizer-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Atomizer report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    filesAnalyzed: report.summary.totalFilesAnalyzed,
    keepAtomic: report.summary.keepAtomic,
    considerSplit: report.summary.considerSplit,
  };
}

/**
 * Get classifier status
 */
async function getClassifierStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalFiles: number;
      withExistingType: number;
      inferred: number;
      needsAtomization: number;
      avgConfidence: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<ClassifierReport>(
    path.join(RUNTIME_DIR, 'entity-classifier-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Classifier report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalFiles: report.summary.totalFilesAnalyzed,
    withExistingType: report.summary.withExistingType,
    inferred: report.summary.inferred,
    needsAtomization: report.summary.needsAtomization,
    avgConfidence: report.summary.avgConfidence,
  };
}

/**
 * Get edge inference status
 */
async function getEdgeInferenceStatus(): Promise<
  | {
      available: true;
      timestamp: string;
      totalEntities: number;
      totalInferredEdges: number;
      highConfidenceEdges: number;
      candidates: number;
    }
  | { available: false; reason: string }
> {
  const report = await loadReport<EdgeInferenceReport>(
    path.join(RUNTIME_DIR, 'edge-inference-latest.json')
  );

  if (!report) {
    return { available: false, reason: 'Edge inference report not found' };
  }

  return {
    available: true,
    timestamp: report.timestamp,
    totalEntities: report.summary.totalEntities,
    totalInferredEdges: report.summary.totalInferredEdges,
    highConfidenceEdges: report.summary.highConfidenceEdges,
    candidates: report.summary.candidates,
  };
}

/**
 * Get changelog statistics (stub)
 */
async function getChangelogStats(): Promise<ChangelogStats> {
  return {
    totalMutations: 0,
    byAction: { created: 0, updated: 0, deleted: 0 },
    byAuthor: { system: 0, steve: 0 },
    byEntityType: {},
  };
}

/**
 * Get evidence store statistics (stub)
 */
async function getEvidenceStats(): Promise<EvidenceStats> {
  return {
    totalRecords: 0,
    evidenceCount: 0,
    edgeCount: 0,
    bySourceRepo: {},
    bySourceKind: {},
  };
}

/**
 * Get full Infinite Brain status
 */
export async function getInfiniteBrainStatus() {
  const [atomizer, classifier, edges, changelogStats, evidenceStats] = await Promise.all([
    getAtomizerStatus(),
    getClassifierStatus(),
    getEdgeInferenceStatus(),
    getChangelogStats(),
    getEvidenceStats(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    runtime: {
      atomizer,
      classifier,
      edges,
    },
    infrastructure: {
      changelog: {
        available: changelogStats.totalMutations >= 0,
        stats: changelogStats,
      },
      evidenceStore: {
        available: evidenceStats.totalRecords >= 0,
        stats: evidenceStats,
      },
    },
    safety: {
      writesToMind: false,
      continuousRuntime: false,
      modelFallbackHardcoded: false,
      iosSyncCoordination: true,
    },
    readiness: {
      mindWriteReady: false,
      reason: 'Mind git status not checked by allowlisted Brain action; writes remain blocked.',
    },
  };
}
