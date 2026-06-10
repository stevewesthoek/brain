# AWS Video Dashboard Stabilization Handoff

Date: 2026-06-09 (updated)
Repo: `/Users/Office/Repos/stevewesthoek/brain`
Branch: `main`
Primary area: Brain Console AWS Video view + Brain Core video orchestrator API

## North Star

Stabilize the AWS Video dashboard so it behaves like a dependable operator console:

- No UI flicker to blank or `{}` states during polling/refetch. ✓
- No false red timeout failures for long-running backend actions. ✓
- No duplicate actions caused by users clicking again after a timeout. ✓
- Script approval, generation, review approval, dry-run, publish, and download should each have a clear, monotonic state. ✓
- The dashboard should be modular and maintainable, not a single growing spaghetti file. (ongoing)
- The AWS Video view must not destabilize the rest of Brain Console. ✓

## Completed Milestones

### 1. Dry-run publish workflow
- **Status:** Proven stable
- **Evidence:** Dry-run validates OAuth token, S3 asset existence, and duplicate-upload guard without uploading to YouTube

### 2. Private YouTube upload (first real)
- **Status:** Completed successfully
- **Date:** 2026-06-09
- **Job ID:** `prochat-prompt-1780856968989-make-a-video-of-a-box-`
- **YouTube Video ID:** `hqLy1YKP2bA`
- **Privacy:** `private`
- **Control-plane phase:** `published`

### 3. Duplicate-upload guard
- **Status:** Blocking second attempts correctly
- **Response:** `{ "ok": false, "code": "already_uploaded", "videoId": "hqLy1YKP2bA" }`

### 4. Published-state UI improvements
- **Status:** Complete
- **Changes:** UI now displays videoId and YouTube URL from control-plane data
- **File:** `projects/brain-console/components/aws-video-dashboard.tsx`

### 5. Full dev publish package materialization
- **Status:** Complete
- **Evidence:** Commit 53ebb64d materializes all required assets for real upload
- **Script:** `tools/scripts/materialize-dev-publish-assets.sh`

### 6. Regression tests
- **Status:** Added and passing
- **File:** `projects/brain-core/src/tests/video-orchestrator-control-plane.test.ts`
- **Latest commit:** 8a8db858 test: cover aws video published control-plane state

### 7. Animated-video expansion scaffold
- **Status:** Local placeholder path wired; real image-to-video model provider still future work
- **Mode:** `hybrid_animated_video`
- **Provider:** `local-ffmpeg-animated-placeholder`
- **Contract:** scene image → `jobs/<jobId>/animated/scene-NNN.mp4` → stitched final MP4 → private publish flow
- **Important distinction:** this proves the animated clip pipeline shape with deterministic ffmpeg zoompan clips; it is not yet true model-generated animation.
- **Recent commits:** `4d103f62`, `2821f42c`, `aa12cfbb`, `eef5e3d4`, `a51479f9`

## Previous situation (resolved)

The flow had previously become unstable during attempts to add timeout-safe behavior and a control-plane endpoint. These symptoms were resolved:

1. ~~`/jobs/recent` sometimes timed out or returned no jobs~~ → Stabilized by control-plane refinement
2. ~~The selected job card and review tab flickered~~ → Fixed by snapshot hook and canonical state source
3. ~~Review showed false missing-fields~~ → Resolved by control-plane contract fix (phase exists, selectedJob.status exists)
4. ~~Script approval timed out and did not advance~~ → Fast-path backend patch applied in `approveScript()`
5. ~~The Approve button became disabled after timeout~~ → Resolved by pending action clearing from control-plane
6. ~~Debug/diagnostic test jobs polluted the UI~~ → Known constraint; use normal draft jobs for manual testing

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

## Current operating state

The dashboard is now stable with:

1. **Control-plane as canonical state source:** All primary AWS Video UI state derives from the control-plane endpoint, not legacy queries.
2. **Script approval fast-path:** `approveScript()` writes immediately without blocking on optional context reads.
3. **Published-state UI:** Selected job card displays videoId and YouTube URL from control-plane after publish.
4. **Duplicate-upload guard:** Both dry-run and real-upload paths check for existing videoId in `publish.json`.
5. **Regression tests in place:** `video-orchestrator-control-plane.test.ts` covers published state and control-plane contract.

For reference, a test job control-plane response shape:

```bash
export JOB_ID="prochat-prompt-1780856968989-make-a-video-of-a-box-"

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" \
  | jq '.ok, .data.phase, .data.selectedJob.status, .data.allowedActions'
```

After successful publish, expect:
- `.data.phase`: `"published"`
- `.data.selectedJob.status`: `"published"`
- Control-plane reflects the videoId and YouTube URL

## Recent patches applied

### 1. Backend script approval fast-path
- **File:** `projects/brain-core/src/providers/video-orchestrator-provider.ts`
- **Change:** `approveScript()` now validates and writes `script.status = "approved"` immediately without blocking on optional context reads (topic, profile, publish hydration).
- **Typecheck:** Verified clean

### 2. Control-plane contract refinement (prior commits)
- Ensured `data.phase` always exists
- Ensured `data.selectedJob.status` always exists
- Ensured `data.allowedActions` is a well-formed record
- Ensured `data.review.media.youtubePackageKey` is present when review is complete

### 3. Frontend selection and state persistence (prior commits)
- Added `use-aws-video-selection.ts` for stable job selection across polling
- Added `use-aws-video-selection.test.ts` for hydration-safe restoration
- Selection now persists correctly across page refresh

## Code locations and ownership

### Brain Console dashboard

Main file (modularization deferred until next stabilization phase):

- `projects/brain-console/components/aws-video-dashboard.tsx` — Primary AWS Video UI
- `projects/brain-console/components/aws-video/use-aws-video-selection.ts` — Stable job selection across polling
- `projects/brain-console/components/aws-video/use-aws-video-selection.test.ts` — Selection tests
- `projects/brain-console/lib/braincore-schemas.ts` — Frontend type contracts
- `projects/brain-console/AWS_VIDEO_DASHBOARD_STABILIZATION_PLAN.md` — Prior stabilization work (archived reference)

### Brain Core backend

Routes:

- `projects/brain-core/src/api/routes.ts` — API route definitions

Main provider:

- `projects/brain-core/src/providers/video-orchestrator-provider.ts` — Script/review/publish operations

Control-plane adapter:

- `projects/brain-core/src/adapters/video-orchestrator-control-plane.ts` — Canonical state derivation

Tests:

- `projects/brain-core/src/tests/video-orchestrator-control-plane.test.ts` — Regression suite (published state + control-plane contract)

### Dev tooling

- `tools/scripts/brain-console-dev-reset.sh` — Reset dev environment
- `tools/scripts/materialize-dev-publish-assets.sh` — Prepare fixture job for publish testing
- `tools/scripts/verify-aws-video-generation-mode.sh` — Generation mode verification

## Next work: modularization and minor UI polish

After the publish milestone, the remaining technical debt is:

1. **Modularize aws-video-dashboard.tsx** — Split into smaller focused modules (job list, selected card, review tab, pipeline flow)
2. **Remove legacy queries from primary rendering** — Keep only control-plane as state source
3. **Fix pipeline flow label formatting** — Stops concatenating status text into titles (e.g. `Approve scriptactive` → `Approve script`)
4. **Add UI snapshot hook** — Keep last known good control-plane data during refetch to prevent flicker

**Do not start new features.** All work should preserve the current stable state of the dashboard and control-plane contract.
