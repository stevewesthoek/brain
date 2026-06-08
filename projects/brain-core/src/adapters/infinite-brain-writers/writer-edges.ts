/**
 * Infinite Brain Edge/Evidence Writer
 * Records relationship edges and supporting evidence
 * Phase Z: Disabled stub, always returns blocked
 */

import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

export function evaluateEdgesWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'evidenceStoreWriteGateConnected',
      status: 'blocked',
      reason: 'Evidence store write gate not yet connected',
      requiredForWrite: true,
    },
    {
      name: 'edgeValidationComplete',
      status: 'blocked',
      reason: 'Edge validation layer not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'confidenceScoreValidation',
      status: 'blocked',
      reason: 'Confidence score validation not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'edgeWriterImplemented',
      status: 'blocked',
      reason: 'Edge/evidence writer not yet implemented',
      requiredForWrite: true,
    },
  ];
}

export async function runEdgesWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateEdgesWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('edge-review', blockers);
  result.preconditions = preconditions;

  return result;
}
