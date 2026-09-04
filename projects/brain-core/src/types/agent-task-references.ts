/**
 * Bounded references carried by the agent task projections.
 *
 * These are descriptors, not packet bodies. Consumers can render the
 * provenance and freshness boundary without loading a potentially large
 * Context Pack or evidence payload.
 */
export type BrainCoreTaskReferenceStatus =
  | 'persisted'
  | 'available_by_ref'
  | 'not_persisted'
  | 'unavailable'
  | 'stale'
  | 'missing';

export type BrainCoreTaskReferenceFreshness = 'fresh' | 'stale' | 'mixed' | 'unknown' | 'unavailable';

export interface BrainCoreAgentContextPackRef {
  packetId: string;
  type: 'context-pack';
  revision: string | null;
  source: string | null;
  freshness: BrainCoreTaskReferenceFreshness;
  status: BrainCoreTaskReferenceStatus;
  authority: string | null;
  locator: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  selectedItemCount?: number | null;
}

export interface BrainCoreAgentEvidencePacketRef {
  packetId: string;
  type: 'evidence-packet';
  revision: string | null;
  source: string | null;
  freshness: BrainCoreTaskReferenceFreshness;
  status: BrainCoreTaskReferenceStatus;
  authority: string | null;
  locator: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  evidenceIds?: string[];
  relation?: string | null;
}
