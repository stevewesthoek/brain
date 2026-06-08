/**
 * Infinite Brain Entity Metadata Writer
 * Updates YAML frontmatter and entity metadata
 * Phase Z: Disabled stub, always returns blocked
 */

import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

export function evaluateMetadataWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'frontmatterPatcherImplemented',
      status: 'blocked',
      reason: 'Frontmatter patcher not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'conflictDetectionAvailable',
      status: 'blocked',
      reason: 'Conflict detection for concurrent edits not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'yamlValidationAvailable',
      status: 'blocked',
      reason: 'YAML validation layer not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'metadataWriterImplemented',
      status: 'blocked',
      reason: 'Metadata writer not yet implemented',
      requiredForWrite: true,
    },
  ];
}

export async function runMetadataWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateMetadataWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('entity-metadata', blockers);
  result.preconditions = preconditions;

  return result;
}
