/**
 * Unit tests for normalizeAwsVideoControlPlaneResponse.
 * Pure normalizer — no React Query provider needed.
 * Run with: npx tsx components/aws-video/use-aws-video-control-plane.test.ts
 */

import { normalizeAwsVideoControlPlaneResponse } from './use-aws-video-control-plane';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label}`);
  }
}

// --- Wrapped response: { ok: true, data: {...} } ---

const wrappedResponse = {
  ok: true,
  data: {
    jobId: 'job-123',
    phase: 'ready_to_publish',
    allowedActions: { approve_review: { enabled: true } },
  },
};

const wrapped = normalizeAwsVideoControlPlaneResponse(wrappedResponse);

assert(wrapped !== null, 'wrapped: result is not null');
assert(
  (wrapped as Record<string, unknown>)?.jobId === 'job-123',
  'wrapped: jobId extracted from data',
);
assert(
  (wrapped as Record<string, unknown>)?.phase === 'ready_to_publish',
  'wrapped: phase extracted from data',
);

// keyed allowedActions preserved
const actions = (wrapped as Record<string, unknown>)?.allowedActions as Record<string, unknown> | undefined;
assert(
  typeof actions === 'object' && actions !== null,
  'wrapped: allowedActions is object',
);
assert(
  (actions?.approve_review as Record<string, unknown>)?.enabled === true,
  'wrapped: approve_review.enabled preserved',
);

// --- Direct data object (jobId at root) ---

const directResponse = {
  jobId: 'job-456',
  phase: 'generating',
  allowedActions: { generate: { enabled: false, reason: 'already generating' } },
};

const direct = normalizeAwsVideoControlPlaneResponse(directResponse);

assert(direct !== null, 'direct: result is not null');
assert(
  (direct as Record<string, unknown>)?.jobId === 'job-456',
  'direct: jobId preserved at root',
);
assert(
  (direct as Record<string, unknown>)?.phase === 'generating',
  'direct: phase preserved',
);
const directActions = (direct as Record<string, unknown>)?.allowedActions as Record<string, unknown> | undefined;
assert(
  (directActions?.generate as Record<string, unknown>)?.enabled === false,
  'direct: generate.enabled=false preserved',
);

// --- Null response ---

assert(
  normalizeAwsVideoControlPlaneResponse(null) === null,
  'null: returns null',
);
assert(
  normalizeAwsVideoControlPlaneResponse(undefined) === null,
  'undefined: returns null',
);

// --- Summary ---

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
