/**
 * Infinite Brain Writers
 * Category-specific disabled writer stubs
 * All writers blocked, return disabled status
 */

export * from './types.js';
export * from './writer-atomization.js';
export * from './writer-metadata.js';
export * from './writer-edges.js';
export * from './writer-wiki.js';
export * from './writer-live-status.js';
export * from './writer-supersede-archive.js';
export * from './writer-source-routing.js';
export * from './writer-audit-log.js';
export * from './writer-recovery-procedure.js';
export * from './writer-tasks.js';
export * from './writer-cleanup.js';

export interface InfiniteBrainWriterIndex {
  atomization: {
    evaluate: typeof import('./writer-atomization.js').evaluateAtomizationWriterPreconditions;
    run: typeof import('./writer-atomization.js').runAtomizationWriterDisabled;
  };
  metadata: {
    evaluate: typeof import('./writer-metadata.js').evaluateMetadataWriterPreconditions;
    run: typeof import('./writer-metadata.js').runMetadataWriterDisabled;
  };
  edges: {
    evaluate: typeof import('./writer-edges.js').evaluateEdgesWriterPreconditions;
    run: typeof import('./writer-edges.js').runEdgesWriterDisabled;
  };
  wiki: {
    evaluate: typeof import('./writer-wiki.js').evaluateWikiWriterPreconditions;
    run: typeof import('./writer-wiki.js').runWikiWriterDisabled;
  };
  tasks: {
    evaluate: typeof import('./writer-tasks.js').evaluateTasksWriterPreconditions;
    run: typeof import('./writer-tasks.js').runTasksWriterDisabled;
  };
  cleanup: {
    evaluate: typeof import('./writer-cleanup.js').evaluateCleanupWriterPreconditions;
    run: typeof import('./writer-cleanup.js').runCleanupWriterDisabled;
  };
}
