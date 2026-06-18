# Video Orchestrator Phase 1W — Conversation Handoff

**Purpose:** Resume Task 1W-I in a new conversation without re-discovery or scope drift.  
**Current milestone:** Phase 1W — Moving-Video-to-YouTube Approval Workflow  
**Current task:** Task 1W-I — End-to-End Verification and Operator Confirmation  
**Status:** Automated verification complete; one valid production workflow and operator confirmation remain.

## Authoritative documents

Read these first and treat them as the source of truth:

1. `projects/brain-core/docs/video-orchestrator-roadmap.md`
2. `projects/brain-core/docs/video-orchestrator-implementation-plan.md`

After completing any slice, update the implementation plan first, then keep the roadmap status synchronized. Do not proceed to work outside the next incomplete implementation-plan task.

## Scope boundary

Work only on the moving-video → approval workflow → one YouTube posting target → direct YouTube upload path.

Do not add slideshow generation, TikTok or other platform support, broad UI changes, a new OAuth2 client, resumable-upload redesign, or unrelated cleanup. Preserve the existing shell-backed OAuth2 YouTube uploader.

## Completed Phase 1W work

Tasks 1W-A through 1W-H are complete.

Implemented and verified:

- real moving-video intake and source updates;
- repository-owned FFmpeg thumbnail worker;
- two real 1280×720 JPEG thumbnail variants;
- canonical thumbnail approval required before YouTube publishing;
- YouTube-only metadata generation from the canonical content item;
- canonical metadata approval required before YouTube publishing;
- package creation and one bound YouTube posting target;
- `jobId`, account, and exact confirmation binding;
- controlled invocation of `runControlledYouTubePublish()`;
- duplicate/idempotency protection through canonical publish metadata;
- existing shell-backed OAuth2 upload path retained;
- exact live confirmation gate: `PUBLISH TO YOUTUBE`;
- persisted successful dry-run proof required before a live upload.

## Current validation evidence

The focused Phase 1W suite is:

```text
npm run test:phase-1w-e2e-focused
```

Latest verified result:

```text
44 tests passed
0 tests failed
```

The suite includes:

- cross-stage audit history for thumbnail, metadata, and package approvals sharing one project/content item;
- review-gate ordering;
- deterministic invalid/missing asset failures;
- job-owned generated-media asset validation;
- approval timeout, escalation, duplicate-decision, and unknown-ID behavior;
- YouTube-only package-route validation;
- controlled uploader invocation for the bound job;
- rejection without exact live confirmation;
- rejection without persisted `dryRunPassed: true`.

Important documentation note: the implementation plan currently records the earlier 42/42 result. The first documentation update in the resumed conversation should change this to 44/44 and include the live confirmation/dry-run gate evidence. The roadmap already records 44/44 and the invalid local candidate described below.

## Files changed during Tasks 1W-H and 1W-I

Primary implementation and tests:

- `projects/brain-core/src/adapters/vo-studio-write.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/providers/video-orchestrator-provider.ts`
- `projects/brain-core/src/tests/vo-studio-write.test.ts`
- `projects/brain-core/src/tests/video-orchestrator-youtube-package-route.test.ts`
- `projects/brain-core/src/tests/video-orchestrator-phase-1w-audit.test.ts`
- `projects/brain-core/src/tests/video-orchestrator-youtube-live-gates.test.ts`
- `projects/brain-core/package.json`

Documentation:

- `projects/brain-core/docs/video-orchestrator-implementation-plan.md`
- `projects/brain-core/docs/video-orchestrator-roadmap.md`

No commit was created during this work.

## Current blocker

Task 1W-I cannot be marked complete until one real moving-video job completes the live workflow and the operator explicitly confirms the result.

The only local candidate inspected was:

```text
motion-fallback-1781614196512
```

Location:

```text
projects/video-orchestrator/cloud/jobs/motion-fallback-1781614196512
```

It is not eligible for the live workflow because:

- `exports/` is empty;
- `frames/` is empty;
- no canonical `metadata/review.json` exists;
- no canonical `metadata/assets.json` exists;
- no canonical `metadata/publish.json` exists;
- no canonical `metadata/status.json` exists.

Do not manufacture approval or publish evidence for this incomplete fallback job. Do not upload it.

## Exact next implementation-plan steps

Continue Task 1W-I in this order:

1. Update `video-orchestrator-implementation-plan.md` from 42/42 to 44/44 and record the exact confirmation and persisted dry-run safety gates.
2. Identify a valid production moving-video job, locally or through the existing S3-backed job discovery path.
3. Verify that job has:
   - approved review state;
   - canonical real moving-video export;
   - canonical thumbnail export;
   - canonical publish metadata;
   - no existing YouTube `videoId` and no uploaded/published status.
4. Run `runControlledYouTubePublish(jobId, { dryRun: true })` through the existing approved route or existing bounded workflow.
5. Confirm that the dry-run persists `dryRunPassed: true` and succeeds without changing YouTube.
6. Before any external upload, obtain explicit operator approval for that exact job and use the exact confirmation text `PUBLISH TO YOUTUBE`.
7. Perform one private YouTube upload through the existing shell-backed OAuth2 adapter.
8. Verify the returned/persisted YouTube `videoId`, URL, status, idempotency state, and complete audit history.
9. Ask the operator to confirm the uploaded result.
10. Only after operator confirmation:
    - mark Task 1W-I complete in the implementation plan;
    - mark Phase/Sprint 1W complete in the roadmap;
    - proceed to the next task explicitly authorized by the implementation plan.

## Safety and repository hygiene

Do not edit or commit unrelated dirty files, including:

- `.graphifyignore`
- `operations/system-configs/claude/**`
- `operations/system-configs/codex/**`
- `projects/brain-console/tsconfig.tsbuildinfo`
- runtime files under `projects/video-orchestrator/cloud/jobs/**`
- `operations/specs/infinite-brain-runtime-roadmap.md`

Do not commit or push unless the operator explicitly requests it. Never force-push.

## Resume prompt

Use this prompt in the new conversation:

```text
Use repository source `brain`.

Read first:
- projects/brain-core/docs/video-orchestrator-phase-1w-handoff.md
- projects/brain-core/docs/video-orchestrator-roadmap.md
- projects/brain-core/docs/video-orchestrator-implementation-plan.md

Resume only Task 1W-I. Follow the exact next steps in the handoff. Do not drift, commit, push, add platforms, redesign OAuth, or manufacture runtime evidence. Keep the implementation plan and roadmap synchronized after each verified milestone.
```
