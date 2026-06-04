# AWS Video Pipeline

**Status:** active Brain Core control-plane note

Brain Core is the API runtime for AWS Video operations. Brain Console Center is the active UI. Brain Console Web is legacy.

## Generation Modes

### 1. Fixture (`AWS_VIDEO_GENERATION_MODE=fixture`)

The default mode. Brain Core copies fixture S3 media and runs MediaConvert assembly.

```json
{
  "mediaSource": "fixture",
  "generationMode": "fixture_assembly",
  "aiGenerated": false
}
```

**Fixture inputs:**
```text
jobs/test-001/audio/narration.mp3
jobs/test-001/exports/sample-transcoded.mp4
```

**Behavior:**
- No prompt processing
- Title gets `[PIPELINE PROOF]` prefix
- YouTube dry-run works
- Private upload works

### 2. Hybrid (`AWS_VIDEO_GENERATION_MODE=hybrid`)

Prompt-derived metadata with fixture media. Brain Core generates a deterministic scene plan and narration script from the user's input, then uses fixture audio/video for assembly.

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_scene_plan_fixture_media",
  "aiGenerated": false,
  "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
  "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
  "providers": {
    "scenePlan": "deterministic-local",
    "narrationScript": "deterministic-local",
    "narrationAudio": "fixture",
    "video": "fixture"
  },
  "warnings": ["Final video/audio media still uses fixture assets; scene plan and narration script are prompt-derived."]
}
```

**Behavior:**
- Reads `scripts/script.md` and prompt/title
- Generates 2–5 scenes (deterministic, no randomness, no external calls)
- Scene duration split evenly across `targetDurationSeconds`
- Visual prompts derived from title + scene index
- Narration text extracted from script content
- Writes `metadata/scene-plan.json` locally + S3
- Writes `audio/narration-script.txt` locally + S3
- Still copies fixture audio/video
- Title gets `[PIPELINE PROOF]` prefix
- Brain Console Center shows hybrid-specific banner and scene plan card

**What it does NOT do:**
- Does not synthesize audio (narration.mp3 is fixture)
- Does not generate video (source.mp4 is fixture)
- Does not call external AI/ML models
- Does not require additional configuration

### 3. AI (`AWS_VIDEO_GENERATION_MODE=ai`)

Not yet implemented. If set without a real provider configured, Brain Core returns:

```json
{
  "ok": false,
  "code": "ai_generation_provider_not_configured",
  "message": "AI video generation provider is not configured. Use AWS_VIDEO_GENERATION_MODE=hybrid for prompt-derived scene planning with fixture media, or configure a real provider."
}
```

## Recommended Build-Out Mode

**For now: use hybrid mode.**

Hybrid mode lets you:
- Verify the end-to-end pipeline with real prompts
- Show prompt-derived metadata (scene plans, narration scripts)
- Keep final media predictable (fixture)
- Build toward real media generation without breaking the flow

Next chunk will add TTS narration and visual media generation.

## Dev Environment Reset

To restart Brain Core and Brain Console Center with hybrid mode enabled:

```bash
bash tools/scripts/brain-console-center-dev-reset.sh
```

This script:
1. Kills stale processes on ports 4877 (Brain Core) and 4881 (Brain Console Center)
2. Ensures ports are free
3. Starts Brain Core with `AWS_VIDEO_GENERATION_MODE=hybrid`
4. Starts Brain Console Center
5. Health-checks both endpoints
6. Prints log file paths and test commands

**Logs:**
- Brain Core: `/tmp/brain-core-hybrid.log`
- Brain Console Center: `/tmp/brain-console-center.log`

**Test hybrid output:**
```bash
export JOB_ID=<new-job-from-console>
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/metadata/scene-plan.json" - --region eu-north-1 | jq
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/audio/narration-script.txt" - --region eu-north-1
```

## Artifact Paths (Canonical)

| Asset | Path |
|-------|------|
| Script markdown | `jobs/<jobId>/scripts/script.md` |
| Scene plan | `jobs/<jobId>/metadata/scene-plan.json` |
| Narration script text | `jobs/<jobId>/audio/narration-script.txt` |
| Narration audio (fixture) | `jobs/<jobId>/audio/narration.mp3` |
| Raw generated video | `jobs/<jobId>/video-generated/generated-001.mp4` |
| Final assembled video | `jobs/<jobId>/exports/generated-001-final.mp4` |
| Thumbnail | `jobs/<jobId>/exports/thumbnail-001.jpg` |

## Provider Boundary

Brain Core defines provider interfaces for real generation (next layer):

- `VideoGenerationProvider`
- `NarrationGenerationProvider`

`AWS_VIDEO_GENERATION_MODE` controls which path runs:
- `fixture` → copy fixture media
- `hybrid` → generate prompt-derived metadata + fixture media
- `ai` → delegate to real provider (not yet configured)

Default is `fixture`. Fixture output must never be labeled as AI-generated video.

## Step Functions State Machine Role (Critical)

The AWS Step Functions state machine orchestrates the media assembly pipeline. It **must** be deployed with the correct IAM role.

**Correct role:** `arn:aws:iam::909439522876:role/ProChatVideoStepFunctionsRole`

**Why this matters:**
- The state machine invokes Lambda functions via `states.amazonaws.com` service principal
- This requires an explicit trust policy in the IAM role
- `StepFunctionsDefaultRole` does not have this trust policy
- If deployed with the wrong role, jobs fail at `CheckApprovalState` with:
  ```
  ApprovalCheckError: The principal states.amazonaws.com is not authorized to assume the provided role
  ```

**Deployment (from video-orchestrator/cloud/infrastructure/i-2-mediaconvert-orchestration/):**
```bash
./deploy-state-machine.sh          # Deploy with correct role and verification
./verify-state-machine-role.sh     # Verify role is correct (CI/CD compatible)
```

**Manual role check:**
```bash
aws stepfunctions describe-state-machine \
  --state-machine-arn "arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev" \
  --region eu-north-1 \
  --query 'roleArn' \
  --output text
# Must return: arn:aws:iam::909439522876:role/ProChatVideoStepFunctionsRole
```
