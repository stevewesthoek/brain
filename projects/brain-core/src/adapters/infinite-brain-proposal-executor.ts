/**
 * Infinite Brain Proposal Executor
 * Disabled skeleton for future proposal execution layer
 * This phase: disabled-by-default, always returns blocked status
 *
 * Future: Applies approved proposals to Mind vault after all preconditions pass
 * Current: Returns blocked status for all execution attempts
 *
 * Safety: canExecute: false, executed: false, executionBlocked: true, writesToMind: false
 */

import crypto from 'node:crypto';

export type ExecutionPreconditionName =
  | 'readinessCanExecute'
  | 'dryRunAvailable'
  | 'explicitOperatorApproval'
  | 'allowlistedWriterAvailable'
  | 'iosSyncSafe'
  | 'rollbackPlanAvailable'
  | 'postWriteVerificationAvailable';

export interface InfiniteBrainExecutionPrecondition {
  name: ExecutionPreconditionName;
  status: 'pass' | 'blocked' | 'uncertain';
  reason: string;
}

export interface InfiniteBrainExecutionAttempt {
  attemptId: string;
  generatedAt: string;
  dryRunId: string | null;
  preconditions: InfiniteBrainExecutionPrecondition[];
  blockedReasons: string[];
}

export interface InfiniteBrainExecutionResult {
  ok: false; // Always false in disabled phase
  status: 'blocked';
  attemptId: string;
  generatedAt: string;
  canExecute: false; // Always false
  executed: false; // Always false
  appliedSteps: 0; // Always zero
  totalSteps: number;
  blockedSteps: number;
  attempt: InfiniteBrainExecutionAttempt;
  safety: {
    writesToMind: false;
    appliesProposals: false;
    canExecute: false;
    executed: false;
    executionBlocked: true;
    deletesFiles: false;
    movesFiles: false;
    continuousRuntime: false;
    modelCalls: false;
  };
}

/**
 * Generate deterministic attempt ID from dry-run ID and precondition statuses
 * No randomness, no timestamps in the ID itself
 */
function generateAttemptId(dryRunId: string | null, preconditions: InfiniteBrainExecutionPrecondition[]): string {
  const preconditionString = preconditions
    .map(p => `${p.name}:${p.status}`)
    .sort()
    .join(',');

  const hash = crypto
    .createHash('sha256')
    .update((dryRunId || 'no-dry-run') + preconditionString)
    .digest('hex')
    .substring(0, 12);

  return `attempt-${hash}`;
}

/**
 * Evaluate all execution preconditions
 * All preconditions block execution in this phase
 */
function evaluateExecutorPreconditions(): InfiniteBrainExecutionPrecondition[] {
  return [
    {
      name: 'readinessCanExecute',
      status: 'blocked',
      reason: 'Execution readiness checks not all passing. See execution readiness report for details.',
    },
    {
      name: 'dryRunAvailable',
      status: 'blocked',
      reason: 'Dry-run report must be generated and validated before execution.',
    },
    {
      name: 'explicitOperatorApproval',
      status: 'blocked',
      reason: 'Operator approval gate not yet implemented. Manual approval required before execution.',
    },
    {
      name: 'allowlistedWriterAvailable',
      status: 'blocked',
      reason: 'Proposal writer not yet implemented. Execution blocked until writer is available.',
    },
    {
      name: 'iosSyncSafe',
      status: 'blocked',
      reason: 'iOS sync safety verification not yet implemented. Mind writes remain blocked.',
    },
    {
      name: 'rollbackPlanAvailable',
      status: 'blocked',
      reason: 'Rollback capability not yet implemented for all proposal types.',
    },
    {
      name: 'postWriteVerificationAvailable',
      status: 'blocked',
      reason: 'Post-write verification layer not yet implemented.',
    },
  ];
}

/**
 * Read executor dry-run report for potential execution
 * Returns null if dry-run doesn't exist or is invalid
 */
export function readExecutorDryRunForExecution(dryRunId: string | null): { id: string; totalSteps: number } | null {
  // Stub: In real implementation, would read runtime JSON file
  // For now, return null to indicate no dry-run available
  if (!dryRunId) {
    return null;
  }
  return {
    id: dryRunId,
    totalSteps: 0,
  };
}

/**
 * Attempt proposal execution
 * Always returns blocked status in this phase
 *
 * Returns:
 * - ok: false (always)
 * - status: 'blocked'
 * - executed: false (always)
 * - appliedSteps: 0 (always)
 * - canExecute: false (always)
 * - executionBlocked: true (always)
 * - writesToMind: false (always)
 */
export function executeInfiniteBrainProposalPlanDisabled(
  dryRunId: string | null,
  totalSteps: number
): InfiniteBrainExecutionResult {
  const preconditions = evaluateExecutorPreconditions();
  const blockedReasons = preconditions
    .filter(p => p.status === 'blocked')
    .map(p => p.reason);

  const attemptId = generateAttemptId(dryRunId, preconditions);

  return {
    ok: false,
    status: 'blocked',
    attemptId,
    generatedAt: new Date().toISOString(),
    canExecute: false,
    executed: false,
    appliedSteps: 0,
    totalSteps,
    blockedSteps: totalSteps,
    attempt: {
      attemptId,
      generatedAt: new Date().toISOString(),
      dryRunId: dryRunId || null,
      preconditions,
      blockedReasons,
    },
    safety: {
      writesToMind: false,
      appliesProposals: false,
      canExecute: false,
      executed: false,
      executionBlocked: true,
      deletesFiles: false,
      movesFiles: false,
      continuousRuntime: false,
      modelCalls: false,
    },
  };
}

