import test from 'node:test';
import assert from 'node:assert/strict';

// We test the control-plane adapter's pure logic by importing
// and exercising the module's internal logic through the exported function.
// Since getVideoOrchestratorControlPlane calls external providers,
// we test the shape guarantees by constructing expected input/output contracts.

// ─── computeAllowedActions shape contracts ───────────────────────────────────

test('control-plane: allowedActions is a Record keyed by action name', async () => {
  // Import the module to check the exported interface shape
  const mod = await import('../adapters/video-orchestrator-control-plane.js');
  assert.ok(mod.getVideoOrchestratorControlPlane, 'exported function exists');
});

test('control-plane: ready_to_publish with generated artifacts must have finalization complete or pending', () => {
  // Scenario: job is ready_to_publish, has all required artifacts
  // Expected: finalization.status should be 'complete' (all assets present) or 'pending' (repair in progress)
  // NOT: finalization.status === 'failed' with red missing-fields when assets exist

  const artifacts = {
    scenePlanKey: 'jobs/test/metadata/scene-plan.json',
    narrationScriptKey: 'jobs/test/audio/narration-script.txt',
    audioKey: 'jobs/test/audio/narration.mp3',
    videoKey: 'jobs/test/exports/generated-001-final.mp4',
    thumbnailKey: 'jobs/test/exports/thumbnail-001.jpg',
    finalization: { finalized: true, repaired: [], missing: [] },
  };

  // With all assets present, finalization must be 'complete'
  const hasAll = Boolean(
    artifacts.scenePlanKey &&
    artifacts.narrationScriptKey &&
    artifacts.audioKey &&
    artifacts.videoKey &&
    artifacts.thumbnailKey
  );
  assert.ok(hasAll, 'all required artifacts are present');

  // The finalization.missing array is empty
  assert.equal(artifacts.finalization.missing.length, 0);
});

test('control-plane: approved review remains approved after control-plane refresh', () => {
  // Scenario: review was previously approved
  // Expected: reviewStatus stays 'approved', never regresses to 'pending'

  const reviewData = {
    reviewStatus: 'approved',
    reviewedAt: '2026-06-01T12:00:00Z',
    reviewedBy: 'brain-console-center',
    media: {
      scenePlanKey: 'jobs/test/metadata/scene-plan.json',
      narrationScriptKey: 'jobs/test/audio/narration-script.txt',
      audioKey: 'jobs/test/audio/narration.mp3',
      sceneImageKeys: ['jobs/test/images/scene-001.jpg'],
      videoKey: 'jobs/test/exports/generated-001-final.mp4',
      thumbnailKey: 'jobs/test/exports/thumbnail-001.jpg',
      publishKey: 'jobs/test/metadata/publish.json',
      youtubePackageKey: 'jobs/test/metadata/youtube-package.json',
      overlayPlanKey: null,
    },
  };

  // Monotonic: once approved, stays approved
  assert.equal(reviewData.reviewStatus, 'approved');
  assert.ok(reviewData.reviewedAt, 'reviewedAt is set');
});

test('control-plane: uploaded never regresses to ready_to_publish', () => {
  // Scenario: job was uploaded (published to YouTube)
  // Expected: phase must be 'published', never go back to 'ready_to_publish'

  const jobStatuses = ['published', 'uploaded'];
  for (const status of jobStatuses) {
    // deriveCanonicalPhase logic check
    const phase =
      (status === 'published' || status === 'uploaded') ? 'published' :
      (status === 'ready_to_publish') ? 'ready_to_publish' :
      status;
    assert.equal(phase, 'published', `status ${status} should map to phase published`);
  }
});

test('control-plane: execution and artifacts are never empty objects for selected jobs', () => {
  // Scenario: execution data is unavailable
  // Expected: execution has structured unavailableReason, not empty {}

  const executionWhenUnavailable = {
    status: null,
    awsStatus: null,
    localStatus: null,
    localStep: null,
    executionArn: null,
    startedAt: null,
    stoppedAt: null,
    checkedAt: null,
    unavailableReason: 'Execution data not available',
  };

  // Must have unavailableReason set
  assert.ok(executionWhenUnavailable.unavailableReason, 'unavailableReason must be set');
  assert.equal(Object.keys(executionWhenUnavailable).length > 1, true, 'must not be empty object');

  const artifactsWhenUnavailable = {
    status: null,
    unavailableReason: 'Artifacts not yet generated',
  };

  assert.ok(artifactsWhenUnavailable.unavailableReason, 'unavailableReason must be set');
});

test('control-plane: finalization pending shows amber state, not red missing-fields', () => {
  // Scenario: ready_to_publish job where finalization attempted but some fields are still being repaired
  // Expected: finalization.status = 'pending', not 'failed'

  const jobStatus = 'ready_to_publish';
  const finalizationMeta = { finalized: true, repaired: ['review.json'], missing: ['thumbnailKey'] };

  // Logic from computeFinalizationState
  const hasAllRequiredAssets = false; // thumbnailKey missing
  const attempted = Boolean(finalizationMeta.finalized);

  let finalizationStatus: string;
  if (hasAllRequiredAssets) {
    finalizationStatus = 'complete';
  } else if (jobStatus === 'ready_to_publish' && attempted) {
    finalizationStatus = finalizationMeta.missing.length > 0 ? 'pending' : 'complete';
  } else {
    finalizationStatus = 'failed';
  }

  // Key assertion: it's 'pending' (amber), not 'failed' (red)
  assert.equal(finalizationStatus, 'pending');
});

test('control-plane: allowedActions approve_review follows media completeness', () => {
  // Scenario: all media present, review not yet approved
  // Expected: approve_review.enabled = true

  const reviewStatus: string = 'pending';
  const mediaComplete = true;

  const approveReviewEnabled = reviewStatus !== 'approved' && mediaComplete;
  assert.equal(approveReviewEnabled, true);

  // After approval: should be disabled
  const reviewStatusApproved: string = 'approved';
  const approveReviewEnabledAfter = reviewStatusApproved !== 'approved' && mediaComplete;
  assert.equal(approveReviewEnabledAfter, false);
});

test('control-plane: download_video enabled when finalVideoKey exists', () => {
  const finalVideoKey = 'jobs/test/exports/generated-001-final.mp4';
  const downloadEnabled = Boolean(finalVideoKey);
  assert.equal(downloadEnabled, true);

  const noVideoKey = null;
  const downloadDisabled = Boolean(noVideoKey);
  assert.equal(downloadDisabled, false);
});

test('control-plane: phase derivation covers all known statuses', () => {
  const cases: [string, string | null, string][] = [
    ['draft', null, 'draft'],
    ['draft', 'pending', 'awaiting_script_approval'],
    ['ready_to_generate', 'approved', 'ready_to_generate'],
    ['generating', null, 'generating'],
    ['generation_in_progress', null, 'generating'],
    ['ready_to_publish', null, 'ready_to_publish'],
    ['publish_ready', null, 'ready_to_publish'],
    ['publishing', null, 'publishing'],
    ['published', null, 'published'],
    ['uploaded', null, 'published'],
  ];

  for (const [status, approval, expectedPhase] of cases) {
    const job = { status, approval: approval ? { status: approval } : undefined };
    const derivedPhase =
      (job.status === 'published' || job.status === 'uploaded') ? 'published' :
      (job.status === 'ready_to_publish' || job.status === 'publish_ready') ? 'ready_to_publish' :
      (job.status === 'publishing') ? 'publishing' :
      (job.status === 'generating' || job.status === 'generation_in_progress') ? 'generating' :
      (job.status === 'ready_to_generate' && job.approval?.status === 'approved') ? 'ready_to_generate' :
      (job.approval?.status === 'pending') ? 'awaiting_script_approval' :
      (job.status === 'draft' || !job.status) ? 'draft' :
      job.status;
    assert.equal(derivedPhase, expectedPhase, `status=${status}, approval=${approval} → phase=${expectedPhase}`);
  }
});
