# AWS Video — Private YouTube Publish Runbook

Dev workflow for testing the YouTube publish gate with the fixture job.

---

## First successful private upload (evidence)

| Field       | Value |
|-------------|-------|
| jobId       | `prochat-prompt-1780856968989-make-a-video-of-a-box-` |
| videoId     | `hqLy1YKP2bA` |
| privacy     | `private` |
| phase       | `published` (control-plane) |
| date        | 2026-06-09 |

---

## Required package assets

`finalizeAwsVideoPublishPackage` checks all of these before permitting real upload:

```
jobs/<jobId>/metadata/scene-plan.json
jobs/<jobId>/audio/narration-script.txt
jobs/<jobId>/audio/narration.mp3
jobs/<jobId>/metadata/overlay-plan.json          (hybrid_image_slideshow_video mode)
jobs/<jobId>/video-generated/generated-001.mp4
jobs/<jobId>/exports/generated-001-final.mp4
jobs/<jobId>/exports/thumbnail-001.jpg
jobs/<jobId>/metadata/youtube-package.json       (written by finalize; not manually copied)
jobs/<jobId>/metadata/publish.json               (written by finalize; not manually copied)
jobs/<jobId>/metadata/review.json                (written by finalize; approval state preserved)
```

The dry-run fast path checks only `exports/generated-001-final.mp4` and `exports/thumbnail-001.jpg`.
The real publish path calls `finalizeAwsVideoPublishPackage` which checks all keys above.

---

## Step-by-step

### 1. Reset dev environment

```bash
bash tools/scripts/brain-console-dev-reset.sh
```

Starts Brain Core (port 4877) and Brain Console (port 4881), then runs materialization.

### 2. Materialize dev publish assets

Copies missing assets to S3 and downloads them locally for the fast-path check:

```bash
bash tools/scripts/materialize-dev-publish-assets.sh
```

Optional: pass a custom fixture job as arg 1:
```bash
bash tools/scripts/materialize-dev-publish-assets.sh <jobId>
```

The script:
- Copies `exports/` assets from `prochat-real-001` S3 donor if missing.
- Copies generation package assets (`metadata/scene-plan.json`, `audio/narration.mp3`, `audio/narration-script.txt`, `metadata/overlay-plan.json`, `video-generated/generated-001.mp4`) from the fixture job's own S3 path (already present after real upload).
- Downloads all assets to `projects/video-orchestrator/cloud/jobs/<jobId>/`.
- Prints a verification table at the end.

### 3. Approve review

Required before real publish (not required for dry-run):

```bash
curl -sS -X POST \
  http://127.0.0.1:4877/api/video-orchestrator/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/review/approve \
  | jq '.'
```

### 4. Dry-run

Validates OAuth token, S3 asset existence, publish.json sanity, and duplicate-upload guard.
Does NOT upload to YouTube.

```bash
curl -sS -X POST \
  'http://127.0.0.1:4877/api/video-orchestrator/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/publish/youtube/dry-run' \
  -H 'content-type: application/json' \
  -d '{}' | jq '.'
```

Expected: `{ "ok": true, "dryRun": true, "videoId": null }`

### 5. Real private upload

```bash
curl -sS -X POST \
  'http://127.0.0.1:4877/api/video-orchestrator/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/publish/youtube' \
  -H 'content-type: application/json' \
  -d '{"confirmation": "CONFIRM_UPLOAD_prochat-prompt-1780856968989-make-a-video-of-a-box-"}' | jq '.'
```

Expected: `{ "ok": true, "videoId": "<id>", "url": "https://www.youtube.com/watch?v=<id>" }`

---

## Duplicate-upload guard

The provider checks `platforms.youtube.videoId` in `publish.json` before every upload attempt.
If a `videoId` is already present, the response is:

```json
{ "ok": false, "code": "already_uploaded", "videoId": "hqLy1YKP2bA" }
```

This is enforced at both dry-run and real-upload paths — no flag bypasses it without explicit
`--force-new-upload` in the raw shell script.

---

## Expected dirty runtime files

These files are written during real upload and must NOT be committed unless you are intentionally
capturing fixture state:

```
operations/system-configs/claude/.last-update-result.json
operations/system-configs/claude/model-tracking.json
operations/system-configs/claude/settings.json
projects/brain-console/tsconfig.tsbuildinfo
projects/video-orchestrator/cloud/jobs/.../metadata/publish.json
projects/video-orchestrator/cloud/jobs/.../metadata/review.json
projects/video-orchestrator/cloud/jobs/.../publishing/publish.json
```

Generated media (MP4, JPG, MP3) in `exports/`, `video-generated/`, `audio/` are gitignored and
must not be committed.

---

## Reset fixture state (re-run testing)

To re-test the full publish flow from a clean state, reset publish metadata in S3:

```bash
# Read current publish.json
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/prochat-prompt-1780856968989-make-a-video-of-a-box-/metadata/publish.json" - --region eu-north-1 | jq .

# Reset platforms.youtube.videoId to null (clears duplicate-upload guard)
# Only do this on the dev fixture — never on production jobs.
```
