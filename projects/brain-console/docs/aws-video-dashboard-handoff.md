# AWS Video Dashboard Stabilization Handoff

Date: 2026-06-07
Repo: `/Users/Office/Repos/stevewesthoek/brain`
Branch: `main`
Primary area: Brain Console AWS Video view + Brain Core video orchestrator API

## North Star

Stabilize the AWS Video dashboard so it behaves like a dependable operator console:

- No UI flicker to blank or `{}` states during polling/refetch.
- No false red timeout failures for long-running backend actions.
- No duplicate actions caused by users clicking again after a timeout.
- Script approval, generation, review approval, dry-run, publish, and download should each have a clear, monotonic state.
- The dashboard should be modular and maintainable, not a single growing spaghetti file.
- The AWS Video view must not destabilize the rest of Brain Console.

## Current situation

The flow had previously worked end-to-end, but the UI became unstable during attempts to add timeout-safe behavior and a control-plane endpoint. The recurring symptoms were:

1. `/jobs/recent` sometimes timed out or returned no jobs, causing the selected job to disappear.
2. The selected job card and review tab flickered between real data, loading states, and empty/unavailable states.
3. Review sometimes showed false missing-fields even when the backend control-plane returned complete media.
4. Script approval timed out and did not visibly advance to Generate.
5. The Approve button became disabled after timeout while the job still appeared `awaiting_approval`.
6. Debug/diagnostic test jobs such as `Test clientActionId dedup` and `Test concurrent in-flight dedup` appear in the jobs list and should not be used for normal manual UI testing.

## Recent important commits already made

Relevant recent commits include, but may not be exhaustive:

- `95e9b492 feat: implement timeout-safe action model for AWS Video UI`
- `13a4501a fix: keep AWS video motion finalization aligned with review approval`
- `5ce07c80 fix: complete AWS video control-plane regression coverage`
- `cefd003d` reportedly fixed backend control-plane contract shape so:
  - `data.phase` exists.
  - `data.selectedJob.status` exists.
  - `data.allowedActions` is a record, e.g. `allowedActions.approve_review.enabled`.
  - `data.review.media.youtubePackageKey` can be present even if `data.artifacts.youtubePackageKey` is null.
- Later stabilization work reportedly added:
  - `components/aws-video/use-aws-video-selection.ts`
  - `components/aws-video/use-aws-video-selection.test.ts`
  - `AWS_VIDEO_DASHBOARD_STABILIZATION_PLAN.md`
  - selection persistence and hydration-safe selected job restoration.

Verify exact commit history before assuming all of this is committed.

## Latest live evidence before handoff

For a known generated job:

```bash
export JOB_ID="prochat-prompt-1780844790820-make-a-video-of-a-butterfly-"

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" \
  | jq '.ok, .data.phase, .data.selectedJob.status, .data.finalization.status, .data.review.reviewStatus, .data.review.media.youtubePackageKey, .data.missingRequirements, .data.allowedActions.approve_review'
```

Expected/observed good shape after backend contract fix:

```json
true
"ready_to_publish"
"ready_to_publish"
"complete"
"pending"
"jobs/prochat-prompt-1780844790820-make-a-video-of-a-butterfly-/metadata/youtube-package.json"
[]
{
  "enabled": true
}
```

This confirms the backend control-plane can return complete review media and enable review approval for at least that known job.

## Latest patch applied in this conversation

A backend patch was applied to make script approval fast-path and avoid slow optional context reads before writing approval.

File changed:

- `projects/brain-core/src/providers/video-orchestrator-provider.ts`

Intent:

- `approveScript()` should validate and write `script.status = "approved"` immediately.
- Optional context reads like topic/profile/publish hydration should not block the write.
- This should prevent the UI from waiting forever for script approval confirmation.

A TypeScript typo was introduced and then patched:

- Wrong: `theologicalReviewRequired,`
- Correct: `theologicalReviewRequired: theologyReviewRequired,`

The user reported the typecheck error before the typo fix. After the typo fix, typecheck has **not yet been rerun in the conversation**.

## Immediate next step

First validate the latest patch. Do **not** continue feature work before this passes.

Run:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run typecheck

cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console
npm run typecheck
```

If both pass, restart dev services:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
tools/scripts/brain-console-dev-reset.sh hybrid_image_slideshow
```

Then test script approval only, using a normal draft job, **not** a diagnostic test job. Diagnostic jobs have titles like:

- `Test clientActionId dedup`
- `Test concurrent in-flight dedup`

## Required script approval test

Create or select a normal draft job, then click Approve. If it hangs or does not advance, capture the backend state with the real job id:

```bash
export JOB_ID="<real-selected-job-id>"

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" \
  | jq '.ok, .data.phase, .data.selectedJob.status, .data.selectedJob.approvalStatus, .data.allowedActions.approve_script, .data.allowedActions.generate'
```

Also inspect the local script metadata:

```bash
cat "projects/video-orchestrator/cloud/jobs/$JOB_ID/scripts/script.json" | jq '.status, .approval'
```

Possible outcomes:

1. `script.json` shows `status: approved`, but UI still says Awaiting Approval.
   - Frontend/control-plane derivation is stale or not mapped correctly.
   - Fix frontend/control-plane, not approval write.

2. `script.json` does not show approved.
   - Backend approval write still failed or wrong script path was used.
   - Fix `approveScript()` and route wiring.

3. API approval returns timeout, but `script.json` is approved.
   - Timeout is acceptable only if polling clears the overlay and UI advances.
   - Ensure pending action clearing watches the correct control-plane fields.

## Important code locations

### Brain Console dashboard

Main file, currently too large and should be modularized over time:

- `projects/brain-console/components/aws-video-dashboard.tsx`

New selection hook:

- `projects/brain-console/components/aws-video/use-aws-video-selection.ts`
- `projects/brain-console/components/aws-video/use-aws-video-selection.test.ts`

Frontend schemas:

- `projects/brain-console/lib/braincore-schemas.ts`

Stabilization plan:

- `projects/brain-console/AWS_VIDEO_DASHBOARD_STABILIZATION_PLAN.md`

### Brain Core backend

Routes:

- `projects/brain-core/src/api/routes.ts`

Main provider:

- `projects/brain-core/src/providers/video-orchestrator-provider.ts`

Control-plane adapter:

- `projects/brain-core/src/adapters/video-orchestrator-control-plane.ts`

Control-plane tests:

- `projects/brain-core/src/tests/video-orchestrator-control-plane.test.ts`

### Dev/reset tooling

- `tools/scripts/brain-console-dev-reset.sh`
- `tools/scripts/verify-aws-video-generation-mode.sh`

## Known design direction

The dashboard must be stabilized surgically. Do not add new video features until this is stable.

Priority order:

1. Make script approval reliable and fast.
2. Make selected job stable across polling and page refresh.
3. Make control-plane the only source for primary AWS Video UI state.
4. Remove legacy queries from primary rendering. They may remain as collapsed debug panels only.
5. Add an effective snapshot hook so the UI keeps last known good control-plane data during refetch.
6. Split `aws-video-dashboard.tsx` into smaller modules once behavior is correct.

## Current likely root causes still to inspect

1. Script approval may now be fixed by the fast-path backend patch, but validation is pending.
2. The frontend may still clear pending overlays based on `selectedJob?.status` from recent jobs rather than control-plane `selectedJob.status` / `phase`.
3. `allowedActions.generate` may not activate because script approval status is not derived from the same canonical source as the selected card.
4. Existing diagnostic test jobs pollute the recent jobs list and confuse manual testing.
5. The pipeline flow labels concatenate status text into titles, for example `Approve scriptactive`, `Generate mediawaiting`; this is a UI formatting bug and should be fixed after functional stabilization.

## User expectations and constraints

The user is frustrated because repeated patches have caused regressions. Be factual, surgical, and evidence-driven.

Do not say it is fixed unless verified by:

- Typecheck passes.
- Targeted curl response shows the expected backend state.
- UI behavior is tested or the user confirms it.

Do not expand scope. Do not add new features. Do not rewrite large areas unless a specific factual root cause requires it.

## Recommended next assistant behavior

Start by saying what is known and what is not known. Then run only the validation and minimal inspection needed.

Suggested next actions:

1. Run `npm run typecheck` in brain-core and brain-console.
2. If typecheck passes, inspect `approveScript()` around the patched lines to confirm the fast path is exactly as intended.
3. Ask the user to retest a normal draft approval, or run the direct API approval test if possible.
4. If approval still hangs, use the curl and `script.json` checks above to determine whether the bug is backend persistence or frontend state derivation.

## Do not forget

The North Star is not “make the timeout disappear.” The North Star is a robust operator dashboard with one canonical source of truth, stable selection, monotonic state, clear busy states, and modular code.
