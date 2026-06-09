# Claude Code Prompt: Stabilize AWS Video Dashboard After Script Approval

You are working in this repo:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
```

Use the /goal and the /code orchestrator skills, but keep the scope tight: fix the AWS video dashboard state after script approval so the UI reflects the real backend state and enables the correct next action.

## User-visible symptom

In Brain Console, a normal AWS video job titled **“Make a video of a box.”** can be script-approved successfully. The overlay appears, approval is persisted, and the job card changes to approved. But the dashboard still behaves incorrectly:

- The Approve button returns disabled/greyed out.
- The Generate button does not activate.
- The pipeline flow still shows **Approve script = waiting**.
- The Review page says generated media must be reviewed, but shows loading/pending-ish state and 0 images.
- Execution panel says loading, or the execution endpoint returns job not found.

Important: do **not** spend time re-fixing approval persistence. Approval is confirmed working.

## Confirmed evidence from manual diagnostics

The real job id is:

```text
prochat-prompt-1780856968989-make-a-video-of-a-box-
```

Control plane:

```bash
curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" | jq
```

Observed distilled output:

```json
{
  "ok": true,
  "error": null,
  "phase": "ready_to_publish",
  "selectedJobStatus": "ready_to_publish",
  "approvalStatus": "approved",
  "allowedApproveScript": {
    "enabled": false,
    "reason": "Script already approved"
  },
  "allowedGenerate": {
    "enabled": false
  },
  "pipeline": null
}
```

Script metadata is approved and lives at `metadata/script.json`, not `scripts/script.json`:

```bash
cat "projects/video-orchestrator/cloud/jobs/$JOB_ID/metadata/script.json" | jq
```

Observed distilled output:

```json
{
  "status": "approved",
  "approval": {
    "required": true,
    "status": "approved",
    "theologicalReviewRequired": false,
    "notes": null,
    "approvedBy": "brain-console",
    "approvedAt": "2026-06-07T19:59:56.683Z"
  },
  "approvedAt": null,
  "updatedAt": "2026-06-07T19:59:56.683Z"
}
```

Job files present:

```text
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/assets.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/publish.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/review.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/script.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/topic.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/youtube-package.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/publishing/publish.json
projects/video-orchestrator/cloud/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/scripts/script.md
```

Artifacts endpoint currently returns useful artifact keys, but its nested `publishableAssets` can contradict `metadata/assets.json` after dev restart/cache/stale resolution:

```bash
curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/artifacts" | jq
```

Observed earlier endpoint shape included:

```json
{
  "ok": true,
  "data": {
    "generationMode": "hybrid_image_slideshow_video",
    "mediaSource": "hybrid",
    "audioKey": "jobs/.../audio/narration.mp3",
    "videoSourceKey": "jobs/.../video-generated/generated-001.mp4",
    "videoKey": "jobs/.../exports/generated-001-final.mp4",
    "finalVideo": "jobs/.../exports/generated-001-final.mp4",
    "thumbnailKey": "jobs/.../exports/thumbnail-001.jpg",
    "publishableAssets": {
      "videoKey": null,
      "thumbnailKey": null,
      "narrationKey": null,
      "missing": ["videoKey", "thumbnailKey"]
    }
  }
}
```

But the actual local metadata file `metadata/assets.json` contains complete publishable assets:

```json
{
  "publishableAssets": {
    "videoKey": "jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/exports/generated-001-final.mp4",
    "thumbnailKey": "jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/exports/thumbnail-001.jpg",
    "narrationKey": "jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/audio/narration.mp3",
    "missing": [],
    "checked": {
      "publishJson": true,
      "assetsJson": true,
      "statusJson": true,
      "inferredS3": true
    },
    "source": {
      "publishJson": true,
      "assetsJson": true,
      "statusJson": true,
      "inferredS3": true
    },
    "selectedSource": {
      "videoKey": "inferredS3",
      "thumbnailKey": "inferredS3",
      "narrationKey": "inferredS3"
    }
  }
}
```

Review metadata also contains media:

```json
{
  "reviewStatus": "pending",
  "media": {
    "audioKey": "jobs/.../audio/narration.mp3",
    "videoKey": "jobs/.../exports/generated-001-final.mp4",
    "thumbnailKey": "jobs/.../exports/thumbnail-001.jpg",
    "publishKey": "jobs/.../metadata/publish.json",
    "youtubePackageKey": "jobs/.../metadata/youtube-package.json"
  }
}
```

The execution endpoint is broken for this job:

```bash
curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/execution" | jq
```

Observed:

```json
{
  "ok": false,
  "error": "Job not found: prochat-prompt-1780856968989-make-a-video-of-a-box-"
}
```

## Relevant files found by grep

Start with these files:

```text
projects/brain-core/src/providers/video-orchestrator-provider.ts
projects/brain-core/src/adapters/video-orchestrator-control-plane.ts
projects/brain-core/src/api/routes.ts
projects/brain-core/src/tests/video-orchestrator-control-plane.test.ts
projects/brain-core/src/tests/video-orchestrator-finalization.test.ts
projects/brain-console/src/** related AWS video dashboard hooks/components
```

Important grep hits:

```text
projects/brain-core/src/providers/video-orchestrator-provider.ts:765  // Monotonic: if publishable assets exist, mark as ready_to_publish even if statusJson is stale
projects/brain-core/src/providers/video-orchestrator-provider.ts:766  if (hasPublishableAssets && statusVal !== 'failed') return 'ready_to_publish';
projects/brain-core/src/providers/video-orchestrator-provider.ts:1177 // ready_to_publish
projects/brain-core/src/providers/video-orchestrator-provider.ts:1219 publishableAssets: resolved
projects/brain-core/src/providers/video-orchestrator-provider.ts:1255 publishableAssets: resolved
projects/brain-core/src/providers/video-orchestrator-provider.ts:1308 publishableAssets: resolved
projects/brain-core/src/providers/video-orchestrator-provider.ts:2362 publishableAssets: assetPublishable
projects/brain-core/src/providers/video-orchestrator-provider.ts:3008 // For generated-media jobs at ready_to_publish: always finalize to ensure review media is complete
projects/brain-core/src/adapters/video-orchestrator-control-plane.ts:115 if (status === 'ready_to_publish' || status === 'publish_ready') return 'ready_to_publish';
projects/brain-core/src/adapters/video-orchestrator-control-plane.ts:178 enabled: reviewStatus === 'approved' && ['ready_to_publish'].includes(jobStatus)
projects/brain-core/src/adapters/video-orchestrator-control-plane.ts:187 enabled: reviewStatus === 'approved' && jobStatus === 'ready_to_publish'
projects/brain-core/src/api/routes.ts:2358 const jobArtifactsMatch = /^\/api\/video-orchestrator\/jobs\/([^/]+)\/artifacts$/.exec(url.pathname);
projects/brain-core/src/api/routes.ts:2513 const jobExecutionMatch = /^\/api\/video-orchestrator\/jobs\/([^/]+)\/execution$/.exec(url.pathname);
projects/brain-core/src/api/routes.ts:2532 const jobControlPlaneMatch = /^\/api\/video-orchestrator\/jobs\/([^/]+)\/control-plane$/.exec(url.pathname);
```

## North Star behavior

For a generated-media job where:

- `metadata/script.json` says script is approved,
- `metadata/assets.json`, `metadata/publish.json`, and `metadata/review.json` contain media keys,
- status/control-plane phase is `ready_to_publish`,
- review status is `pending`,

then the dashboard should **not** send the user back to Generate. It should show:

- Script approval complete.
- Generate media complete or no longer actionable.
- Review media as the active next step.
- Review panel populated from `metadata/review.json.media` and/or control-plane artifacts.
- Approve review button enabled when review media exists and review status is pending.
- Publish/private upload disabled until review is approved.

Generate should only be enabled when the job is actually in the post-script-approved pre-media state. If the job is `ready_to_publish`, Generate being disabled is fine, but the UI must not imply generation is still needed.

## Likely root causes to investigate

1. **Execution endpoint job lookup mismatch**
   - `/api/video-orchestrator/jobs/:jobId/execution` returns `Job not found`, even though control-plane and artifacts endpoints find the same job.
   - Compare lookup logic in the execution route against control-plane/artifacts routes.
   - Make execution route use the same job root / provider method / local cloud job directory resolution as the working routes.

2. **Artifact publishable resolution mismatch**
   - `metadata/assets.json` has `publishableAssets.videoKey` and `thumbnailKey`, but endpoint-level `publishableAssets` may return nulls.
   - Ensure `getVideoArtifacts` / route serialization preserves `assets.json.publishableAssets` and/or derives from top-level `videoKey`, `thumbnailKey`, `audioKey`, `publish.json`, and `review.json` consistently.
   - Do not require local binary files if metadata/S3-style keys are authoritative for cloud jobs.

3. **Control-plane pipeline missing**
   - Control-plane response has `pipeline: null`; UI pipeline cards then appear stale/wrong.
   - Either backend should include canonical pipeline state, or frontend should derive pipeline from `phase`, `approvalStatus`, `review`, `artifacts`, and `allowedActions`.
   - Prefer backend canonical control-plane if existing tests point that way.

4. **Frontend gating stale/misleading**
   - The dashboard button labels/states should not depend on legacy execution endpoint when control-plane says `ready_to_publish` and review media exists.
   - Locate the dashboard hook/component that fetches `control-plane`, `artifacts`, and `execution`.
   - Ensure execution endpoint failure does not block review media display or cause stale pipeline state.

## Required implementation steps

1. Reproduce with the exact job id above.
2. Fix backend first unless evidence proves frontend-only.
3. Add or update tests that encode the failing state:
   - job approved,
   - status ready_to_publish,
   - assets/review media exists,
   - execution route resolves the job,
   - artifacts/publishableAssets returns video and thumbnail keys,
   - control-plane/review state enables review approval, not generate.
4. Then adjust frontend if necessary so the UI displays the canonical state.
5. Keep changes small and focused.

## Validation commands

Run these after changes:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm run typecheck
```

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-console
npm run typecheck
```

Also run targeted tests if available, for example:

```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core
npm test -- video-orchestrator-control-plane
npm test -- video-orchestrator-finalization
```

If the test script syntax differs, inspect `projects/brain-core/package.json` and run the nearest targeted test command.

## Manual verification commands

After restarting dev services:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
tools/scripts/brain-console-dev-reset.sh hybrid_image_slideshow
```

Then:

```bash
cd /Users/Office/Repos/stevewesthoek/brain
export JOB_ID="prochat-prompt-1780856968989-make-a-video-of-a-box-"

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/control-plane" \
  | jq '{ ok, error, phase: .data.phase, selectedJobStatus: .data.selectedJob.status, approvalStatus: .data.selectedJob.approvalStatus, review: .data.review, artifacts: .data.artifacts, allowedActions: .data.allowedActions, pipeline: .data.pipeline }'

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/artifacts" \
  | jq '{ ok, error, data }'

curl -sS "http://127.0.0.1:4877/api/video-orchestrator/jobs/$JOB_ID/execution" \
  | jq '{ ok, error, data }'
```

Expected after fix:

- Control-plane still reports `phase` / selected job status as `ready_to_publish`.
- Approval remains `approved`.
- Artifacts include non-null `videoKey` and `thumbnailKey` or equivalent media keys.
- Execution endpoint no longer returns `Job not found` for this job, or the frontend no longer depends on it for this state.
- UI shows Review as the next actionable step.
- Review media is populated from metadata/control-plane.
- Approve review is enabled when review status is pending and media exists.

## Constraints

- Do not make broad rewrites.
- Do not fake local media files.
- Do not regress script approval persistence.
- Do not make Generate active for `ready_to_publish`; that is the wrong next action.
- Prefer canonical backend state over frontend guessing.
- If frontend must tolerate endpoint failures, degrade gracefully and keep control-plane as source of truth.
