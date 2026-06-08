/**
 * Infinite Brain Wiki Writer
 * Generates and posts wiki pages
 * Phase Z: Disabled stub, always returns blocked
 */

import { type InfiniteBrainWriterPrecondition, type InfiniteBrainWriterResult, createBlockedWriterResult, type InfiniteBrainWriterInput } from './types.js';

export function evaluateWikiWriterPreconditions(): InfiniteBrainWriterPrecondition[] {
  return [
    {
      name: 'wikiPathPolicyApproved',
      status: 'blocked',
      reason: 'Wiki path policy not yet approved',
      requiredForWrite: true,
    },
    {
      name: 'wikiContentValidation',
      status: 'blocked',
      reason: 'Wiki content validation and markdown checks not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'wikiLinkResolution',
      status: 'blocked',
      reason: 'Wiki link resolution to entities not yet implemented',
      requiredForWrite: true,
    },
    {
      name: 'wikiWriterImplemented',
      status: 'blocked',
      reason: 'Wiki writer not yet implemented',
      requiredForWrite: true,
    },
  ];
}

export async function runWikiWriterDisabled(
  _input: InfiniteBrainWriterInput
): Promise<InfiniteBrainWriterResult> {
  const preconditions = evaluateWikiWriterPreconditions();
  const blockers = preconditions
    .filter(p => p.status === 'blocked' && p.requiredForWrite)
    .map(p => p.reason);

  const result = createBlockedWriterResult('wiki-writing', blockers);
  result.preconditions = preconditions;

  return result;
}
