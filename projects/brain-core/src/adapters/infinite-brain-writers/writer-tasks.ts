/**
 * Infinite Brain Task Extraction Writer
 * Extracts and creates tasks from proposals
 * Phase Z: Disabled stub, always returns blocked
 */

import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

export function evaluateTasksWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'taskSchemaApproved',
      status: 'blocked',
      reason: 'Task schema/write gate not yet approved',
      requiredForWrite: true,
    },
    {
      name: 'taskIdGeneration',
      status: 'blocked',
      reason: 'Deterministic task ID generation not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'kanbanIntegration',
      status: 'blocked',
      reason: 'Kanban.md integration and write gate not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'taskWriterImplemented',
      status: 'blocked',
      reason: 'Task writer not yet implemented',
      requiredForWrite: true,
    },
  ];
}

export async function runTasksWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateTasksWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('task-extraction', blockers);
  result.preconditions = preconditions;

  return result;
}
