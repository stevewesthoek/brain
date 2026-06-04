# AWS Video Pipeline State

**Status:** current operational truth

## Working Today

The AWS Video control plane works end to end:

- Brain Console Center can trigger the pipeline.
- Brain Core can start AWS Step Functions.
- MediaConvert final assembly succeeds.
- Brain Core can repair the publish contract.
- YouTube dry-run succeeds.
- Private YouTube upload succeeds.

Two modes are fully operational:

1. **Fixture mode** (default): fixture assembly proof
2. **Hybrid mode**: prompt-derived scene plan + narration script + fixture media

## Fixture Mode

Fixture mode uses known fixture S3 media. The title comes from a prompt/job, but the video and narration are not generated from that prompt.

Fixture inputs:

```text
jobs/test-001/audio/narration.mp3
jobs/test-001/exports/sample-transcoded.mp4
```

Metadata:

```json
{
  "mediaSource": "fixture",
  "generationMode": "fixture_assembly",
  "videoSourceKey": "jobs/test-001/exports/sample-transcoded.mp4",
  "audioSourceKey": "jobs/test-001/audio/narration.mp3",
  "aiGenerated": false
}
```

Fixture uploads use `[PIPELINE PROOF]` title prefix unless explicitly disabled.

## Hybrid Mode

Hybrid mode generates prompt-derived metadata (scene plan + narration script) while still using fixture audio/video.

Metadata:

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_scene_plan_fixture_media",
  "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
  "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
  "videoSourceKey": "jobs/test-001/exports/sample-transcoded.mp4",
  "audioSourceKey": "jobs/test-001/audio/narration.mp3",
  "aiGenerated": false,
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
- Reads script title and script.md content
- Generates 2–5 scenes (deterministic, no external calls)
- Each scene has duration, visual prompt, narration text
- Writes `metadata/scene-plan.json` and `audio/narration-script.txt`
- Still copies fixture audio/video for assembly
- Title gets `[PIPELINE PROOF]` prefix (since final media is fixture)

**What hybrid does NOT do:**
- Does not synthesize audio (narration is fixture)
- Does not generate video (source video is fixture)
- Does not call external AI models

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

## Step Functions State Machine Role (Critical)

The state machine **must** be deployed with the correct IAM role to invoke Lambda functions.

**Correct role:** `arn:aws:iam::909439522876:role/ProChatVideoStepFunctionsRole`

**Deployment:**
```bash
cd infrastructure/i-2-mediaconvert-orchestration
./deploy-state-machine.sh          # Deploy with correct role and verification
./verify-state-machine-role.sh     # Verify role is correct
```

**Why this matters:**
- The step functions role must have a trust policy for `states.amazonaws.com` to invoke Lambda functions
- `StepFunctionsDefaultRole` does not have this permission
- If deployed with wrong role, jobs fail at `CheckApprovalState` with: `ApprovalCheckError: The principal states.amazonaws.com is not authorized`

**Verification (CI/CD):**
```bash
./verify-state-machine-role.sh
# Exits 0 if correct, nonzero if wrong
```

## Generation Mode Status

| Mode | Status | Scene Plan | Narration Script | Narration Audio | Video |
|------|--------|-----------|------------------|-----------------|-------|
| `fixture` | ✅ Working | — | — | Fixture | Fixture |
| `hybrid` | ✅ Working | Generated | Generated | Fixture | Fixture |
| `hybrid_tts` | ✅ Working | Generated | Generated | **TTS (Polly)** | Fixture |
| `ai` | ❌ Not configured | — | — | — | — |

## Not Yet Implemented

The current flow does not implement:

- prompt-to-video AI generation (Bedrock Nova Reel, etc.)
- real image/video provider integration
- provider selection based on channel config
- full AI mode with all components generated

Historical proof artifacts exist for these, but are not wired as active runtime.

## Architecture: Provider Boundary

The framework is provider-based:

- `VideoGenerationProvider` accepts job, prompt/script, channel/profile input, and outputs to S3 key.
- `NarrationGenerationProvider` accepts script/channel input and outputs to S3 narration key.
- Provider output includes provider name, S3 output key, and generation metadata.
- `AWS_VIDEO_GENERATION_MODE` controls the flow:
  - `fixture` → fixture assembly
  - `hybrid` → deterministic scene plan + narration script + fixture media
  - `ai` → delegate to provider (fails loudly if not configured)
- Default is `fixture`.

**Do not label fixture output as AI-generated video.** The `aiGenerated` flag must be `false` for fixture and hybrid modes.
