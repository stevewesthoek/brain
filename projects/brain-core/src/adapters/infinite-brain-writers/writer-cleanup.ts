/**
 * Infinite Brain Cleanup Writer
 * Reviews and cleanups marked-for-cleanup entities
 * Phase Z: DESTRUCTIVE OPERATIONS DISABLED, always returns blocked
 *
 * This writer is intentionally destructive and requires explicit per-item approval.
 * History-first approach: entities are moved to target history/ or legacy archive/ before deletion.
 * Cleanup writer is blocked until all safety gates are in place.
 */

import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

export function evaluateCleanupWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'destructiveOperationsDisabled',
      status: 'blocked',
      reason: 'DESTRUCTIVE: Cleanup writer disabled by design. Entity deletion is blocked.',
      requiredForWrite: true,
    },
    {
      name: 'perItemApprovalMissing',
      status: 'blocked',
      reason: 'DESTRUCTIVE: Explicit per-item operator approval not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'archiveStrategyIncomplete',
      status: 'blocked',
      reason: 'DESTRUCTIVE: Archive-before-delete strategy not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'deletionAuditTrailIncomplete',
      status: 'blocked',
      reason: 'DESTRUCTIVE: Deletion audit trail and recovery not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'iosSyncSafetyUncertain',
      status: 'blocked',
      reason: 'DESTRUCTIVE: iOS sync safety for deletions not verified. Deletions may not sync reliably.',
      requiredForWrite: true,
    },
    {
      name: 'cleanupWriterImplemented',
      status: 'blocked',
      reason: 'Cleanup writer not yet implemented',
      requiredForWrite: true,
    },
  ];
}

export async function runCleanupWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateCleanupWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('cleanup', blockers);
  result.preconditions = preconditions;

  // Explicitly mark cleanup as destructive-disabled
  result.blockers.unshift(
    'DESTRUCTIVE OPERATIONS DISABLED: Cleanup writer intentionally remains blocked until safety gates are in place.'
  );

  return result;
}
