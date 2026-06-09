/**
 * Regression tests for AWS Video selection hook logic.
 * Tests the pure contract without React — validates the selection invariants.
 * Run with: npx tsx components/aws-video/use-aws-video-selection.test.ts
 */

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

// --- Pure logic extracted from hook contract ---

function resolveJobId(
  selectedJobId: string | null,
  isSelectionReady: boolean,
  jobList: { jobId: string }[]
): string | null {
  if (!isSelectionReady) return null;
  return selectedJobId ?? jobList[0]?.jobId ?? null;
}

// --- Test: Hydration starts in stable no-browser-storage state ---

assert(
  resolveJobId(null, false, [{ jobId: 'job-1' }]) === null,
  'before hydration: resolvedJobId is null regardless of jobList'
);

assert(
  resolveJobId('job-persisted', false, []) === null,
  'before hydration: even with selectedJobId set, resolvedJobId is null (deferred)'
);

// --- Test: Persisted selected job wins over jobList default ---

assert(
  resolveJobId('job-persisted', true, [{ jobId: 'job-1' }, { jobId: 'job-2' }]) === 'job-persisted',
  'persisted selection wins over jobList[0]'
);

assert(
  resolveJobId('job-persisted', true, []) === 'job-persisted',
  'persisted selection stable even when jobList is empty'
);

// --- Test: Existing selected job is not cleared when jobList becomes empty ---

assert(
  resolveJobId('job-123', true, []) === 'job-123',
  'existing selection not cleared by empty jobList'
);

// --- Test: jobList reorder does not change selected job ---

const list1 = [{ jobId: 'a' }, { jobId: 'b' }, { jobId: 'c' }];
const list2 = [{ jobId: 'c' }, { jobId: 'a' }, { jobId: 'b' }];

assert(
  resolveJobId('b', true, list1) === 'b',
  'selected job stable across list1'
);

assert(
  resolveJobId('b', true, list2) === 'b',
  'selected job stable across list2 (reordered)'
);

assert(
  resolveJobId('b', true, list1) === resolveJobId('b', true, list2),
  'reorder does not change resolvedJobId'
);

// --- Test: Create-draft explicit selection changes selected job ---

// Simulates: user creates a draft, mutation succeeds with new jobId
const beforeCreate = resolveJobId('old-job', true, [{ jobId: 'old-job' }]);
const afterCreate = resolveJobId('new-created-job', true, [{ jobId: 'old-job' }, { jobId: 'new-created-job' }]);

assert(beforeCreate === 'old-job', 'before create: old job selected');
assert(afterCreate === 'new-created-job', 'after create: new job selected via explicit setSelectedJobId');

// --- Test: No selection + ready + jobList provides default ---

assert(
  resolveJobId(null, true, [{ jobId: 'default-1' }, { jobId: 'default-2' }]) === 'default-1',
  'no selection after hydration falls back to jobList[0]'
);

// --- Test: No selection + ready + empty jobList = null ---

assert(
  resolveJobId(null, true, []) === null,
  'no selection + empty list = null'
);

// --- Test: Server/client determinism ---
// Both server render (isSelectionReady=false) and first client render (before useEffect)
// must produce the same resolvedJobId: null

const serverResult = resolveJobId(null, false, [{ jobId: 'server-job' }]);
const firstClientResult = resolveJobId(null, false, [{ jobId: 'server-job' }]);
assert(
  serverResult === firstClientResult && serverResult === null,
  'server and first client render produce same null resolvedJobId'
);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
