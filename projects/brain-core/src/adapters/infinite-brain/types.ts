/**
 * Infinite Brain Runtime type definitions
 * Machine-maintained metadata for entity and relationship tracking
 */

export interface EntityMutation {
  timestamp: string; // ISO8601
  entityId: string;
  entityType: string;
  action: 'created' | 'updated' | 'deleted';
  author: 'system' | 'steve';
  sourceJob: string;
  diffSummary: string;
}

export interface EvidenceRecord {
  evidenceId: string;
  sourceRepo: 'mind' | 'brain';
  sourcePath: string;
  sourceKind: 'file' | 'markdown-link' | 'frontmatter' | 'api-response';
  capturedAt: string; // ISO8601
  summary: string;
  quoteOrSnippet?: string;
  hash?: string;
  relatedEntityIds: string[];
  confidence: number; // 0.0–1.0
}

export interface EdgeRecord {
  edgeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  edgeType: 'supports' | 'contradicts' | 'depends_on' | 'derived_from' | 'related_to' | 'part_of' | 'preceded_by' | 'followed_by' | 'authored' | 'tagging';
  sourceEvidenceIds: string[];
  strengthScore: number; // 0.0–1.0
  addedBy: 'system' | 'steve';
  timestamp: string; // ISO8601
}

export interface VersionSnapshot {
  entityId: string;
  type: string;
  versions: Array<{
    timestamp: string; // ISO8601
    author: string;
    commitHash: string;
    summary: string;
  }>;
  lastUpdated: string; // ISO8601
}

export interface GitLockStatus {
  locked: boolean;
  waitTimeMs: number;
  message: string;
}

export interface WriteLockAcquisition {
  acquired: boolean;
  reason?: string;
  queuePosition?: number;
}

export type InfiniteBrainConfig = {
  version: string;
  entityTypes: {
    internal: string[];
    whitelist: string[];
  };
  edgeTypes: {
    list: string[];
  };
  atomicNoteRules: {
    minLines: number;
    maxLines: number;
    requireOneSentenceSummary: boolean;
    requireProvenance: boolean;
    requiredFrontmatterFields: string[];
  };
  confidenceThresholds: {
    inferenceDefault: number;
    autoCreationDefault: number;
  };
  writeModes: string[];
  repoRoles: {
    mind: string;
    brain: string;
  };
  modelPolicy: {
    mustUseAiModelSelector: boolean;
    noProviderFallbackInRuntime: boolean;
  };
  graphPolicy: {
    graphifyEnabled: boolean;
    graphifyOwnsRepoContextGraphs: boolean;
    knowledgeGraphEdgesOwnedByInfiniteBrainRuntime: boolean;
  };
  safety: {
    noDestructiveMindConversion: boolean;
    noSilentDeletion: boolean;
    noHiddenContinuousLoop: boolean;
    approvalRequiredForKnowledgeWrites: boolean;
  };
};
