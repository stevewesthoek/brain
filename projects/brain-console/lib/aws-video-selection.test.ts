/**
 * Regression tests for AWS Video dashboard selection logic.
 * Run with: npx tsx lib/aws-video-selection.test.ts
 */
import { resolveJobId, isPlaceholderSafe, isApproveReviewEnabled, isReviewMediaComplete, type JobListItem, type ControlPlaneSnapshot } from './aws-video-selection';

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

// --- resolveJobId ---

// When selectedJobId is set and jobList becomes empty, still returns selectedJobId
assert(
  resolveJobId('job-123', []) === 'job-123',
  'selectedJobId stable when jobList is empty'
);

// When selectedJobId is set and jobList has different jobs, selectedJobId is preserved
assert(
  resolveJobId('job-123', [{ jobId: 'job-456' }, { jobId: 'job-789' }]) === 'job-123',
  'selectedJobId not overwritten by jobList order change'
);

// When selectedJobId is null, falls back to jobList[0]
assert(
  resolveJobId(null, [{ jobId: 'job-first' }, { jobId: 'job-second' }]) === 'job-first',
  'fallback to jobList[0] when no selection'
);

// When both are empty, returns null
assert(
  resolveJobId(null, []) === null,
  'null when no selection and empty list'
);

// When jobList changes order, selectedJobId does not change
const list1: JobListItem[] = [{ jobId: 'a' }, { jobId: 'b' }, { jobId: 'c' }];
const list2: JobListItem[] = [{ jobId: 'c' }, { jobId: 'a' }, { jobId: 'b' }];
assert(
  resolveJobId('b', list1) === resolveJobId('b', list2),
  'selectedJobId stable across list reorder'
);

// --- isPlaceholderSafe ---

// Same jobId: placeholder is safe
assert(
  isPlaceholderSafe('job-123', 'job-123') === true,
  'placeholder safe for same jobId'
);

// Different jobId: placeholder is NOT safe
assert(
  isPlaceholderSafe('job-old', 'job-new') === false,
  'placeholder unsafe for different jobId'
);

// Null previous: unsafe
assert(
  isPlaceholderSafe(null, 'job-123') === false,
  'placeholder unsafe when prev is null'
);

// Null current: unsafe
assert(
  isPlaceholderSafe('job-123', null) === false,
  'placeholder unsafe when current is null'
);

// --- isApproveReviewEnabled ---

// Control-plane returns enabled=true
const cpEnabled: ControlPlaneSnapshot = {
  jobId: 'job-123',
  allowedActions: { approve_review: { enabled: true } },
  review: { media: {} },
  missingRequirements: [],
};
assert(
  isApproveReviewEnabled(cpEnabled) === true,
  'approve enabled when control-plane says enabled'
);

// Control-plane returns enabled=false
const cpDisabled: ControlPlaneSnapshot = {
  jobId: 'job-123',
  allowedActions: { approve_review: { enabled: false, reason: 'media incomplete' } },
  review: { media: {} },
  missingRequirements: [{ field: 'videoKey', label: 'Final MP4' }],
};
assert(
  isApproveReviewEnabled(cpDisabled) === false,
  'approve disabled when control-plane says disabled'
);

// No control-plane data: disabled
assert(
  isApproveReviewEnabled(null) === false,
  'approve disabled when no control-plane'
);

// --- isReviewMediaComplete ---

const completeMedia: ControlPlaneSnapshot = {
  jobId: 'job-123',
  review: {
    media: {
      scenePlanKey: 'key1',
      narrationScriptKey: 'key2',
      audioKey: 'key3',
      videoKey: 'key4',
      thumbnailKey: 'key5',
      publishKey: 'key6',
      youtubePackageKey: 'key7',
    },
  },
};
assert(
  isReviewMediaComplete(completeMedia) === true,
  'media complete when all keys present'
);

const incompleteMedia: ControlPlaneSnapshot = {
  jobId: 'job-123',
  review: {
    media: {
      scenePlanKey: 'key1',
      narrationScriptKey: 'key2',
      audioKey: 'key3',
      videoKey: null,
      thumbnailKey: 'key5',
      publishKey: 'key6',
      youtubePackageKey: 'key7',
    },
  },
};
assert(
  isReviewMediaComplete(incompleteMedia) === false,
  'media incomplete when videoKey is null'
);

const noMedia: ControlPlaneSnapshot = {
  jobId: 'job-123',
  review: { media: null },
};
assert(
  isReviewMediaComplete(noMedia) === false,
  'media incomplete when review.media is null'
);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
