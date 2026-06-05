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

Four modes are fully operational:

1. **Fixture mode** (default): fixture assembly proof
2. **Hybrid mode**: prompt-derived scene plan + narration script + fixture media
3. **Hybrid Storyboard mode**: prompt-derived scene plan + narration script + TTS audio + deterministic storyboard images + fixture video
4. **Hybrid Slideshow mode**: prompt-derived scene plan + narration script + TTS audio + deterministic storyboard images + local FFmpeg slideshow MP4

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

## Hybrid Storyboard Mode

Hybrid storyboard generates prompt-derived metadata, TTS narration, and deterministic storyboard images, but still uses the fixture MP4 for final video assembly.

Metadata:

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_storyboard_fixture_video",
  "aiGenerated": false,
  "ttsGenerated": true,
  "storyboardGenerated": true,
  "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
  "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
  "audioKey": "jobs/<jobId>/audio/narration.mp3",
  "storyboardKey": "jobs/<jobId>/metadata/storyboard.json",
  "sceneImageKeys": ["jobs/<jobId>/images/scene-001.svg"],
  "imageProvider": "deterministic-placeholder",
  "providers": {
    "scenePlan": "deterministic-local",
    "narrationScript": "deterministic-local",
    "narrationAudio": "aws-polly",
    "sceneImages": "deterministic-placeholder",
    "video": "fixture"
  },
  "warnings": ["Scene images are generated, but final video still uses fixture video."]
}
```

**What it does:**
- Generates prompt-derived scene plan
- Generates prompt-derived narration script from scene descriptions
- Synthesizes narration MP3 using AWS Polly
- Generates deterministic storyboard cards as SVG images
- Writes storyboard manifest and uploads all artifacts
- Still assembles with fixture video

## Hybrid Slideshow Mode

Hybrid slideshow generates the same prompt-derived scene plan, narration script, TTS audio, and deterministic storyboard images, but assembles a real slideshow MP4 from those images and narration audio using local FFmpeg.

Metadata:

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_slideshow_video",
  "aiGenerated": false,
  "ttsGenerated": true,
  "storyboardGenerated": true,
  "slideshowGenerated": true,
  "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
  "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
  "audioKey": "jobs/<jobId>/audio/narration.mp3",
  "storyboardKey": "jobs/<jobId>/metadata/storyboard.json",
  "sceneImageKeys": ["jobs/<jobId>/images/scene-001.svg"],
  "imageProvider": "deterministic-placeholder",
  "audioProvider": "aws-polly",
  "videoProvider": "local-ffmpeg-slideshow",
  "voiceId": "Joanna",
  "videoKey": "jobs/<jobId>/video-generated/generated-001.mp4",
  "videoSourceKey": "jobs/<jobId>/video-generated/generated-001.mp4",
  "providers": {
    "scenePlan": "deterministic-local",
    "narrationScript": "deterministic-local",
    "narrationAudio": "aws-polly",
    "sceneImages": "deterministic-placeholder",
    "video": "local-ffmpeg-slideshow"
  },
  "warnings": ["Slideshow mode: final video is assembled from deterministic storyboard images and generated narration audio, not AI motion video."]
}
```

**What it does:**
- Generates prompt-derived scene plan
- Generates prompt-derived narration script from scene descriptions
- Synthesizes narration MP3 using AWS Polly
- Generates deterministic storyboard cards as SVG and PNG images
- Assembles `generated-001.mp4` locally with FFmpeg from those images and narration audio
- Uploads the assembled MP4 back to S3

**What it does NOT do:**
- Does not generate full AI motion video
- Does not call external AI image or video providers
- Does not replace the controlled publish flow

## Dev Environment Reset

To restart Brain Core and Brain Console Center with hybrid mode enabled:

```bash
bash tools/scripts/brain-console-center-dev-reset.sh
bash tools/scripts/brain-console-center-dev-reset.sh hybrid_slideshow
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

## Generation Mode Verification

Verify a completed job's artifact contract without YouTube private publishing:

```bash
tools/scripts/verify-aws-video-generation-mode.sh hybrid_slideshow <jobId>
```

Accepted modes:

| Mode | Expected generationMode | Required checks |
|---|---|---|
| `fixture` | `fixture_assembly` | `metadata/status.json`, `metadata/assets.json`, narration MP3, raw generated MP4 |
| `hybrid` | `hybrid_scene_plan_fixture_media` | Scene plan, narration script, narration MP3, raw generated MP4, fixture providers |
| `hybrid_tts` | `hybrid_tts_fixture_video` | Scene plan, narration script, MP3 download validation, `ttsGenerated=true`, `audioProvider=aws-polly` |
| `hybrid_storyboard` | `hybrid_storyboard_fixture_video` | Scene plan, narration script, narration MP3, storyboard JSON, `scene-001.svg`, storyboard metadata, documented video source |
| `hybrid_slideshow` | `hybrid_slideshow_video` | Scene plan, narration script, narration MP3, storyboard JSON, `scene-001.svg`, `scene-001.png`, valid downloaded MP4, `videoProvider=local-ffmpeg-slideshow` |

The verifier prints optional publish contract details when `metadata/publish.json` exists and optional dry-run status when `metadata/publish-check.json` exists. It is read-only and exits nonzero on failed required checks.

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

| Mode | Status | Scene Plan | Narration Script | Scene Images | Narration Audio | Video |
|------|--------|-----------|------------------|--------------|-----------------|-------|
| `fixture` | ✅ Working | — | — | — | Fixture | Fixture |
| `hybrid` | ✅ Working | Generated | Generated | — | Fixture | Fixture |
| `hybrid_tts` | ✅ Working | Generated | Generated | — | **TTS (Polly)** | Fixture |
| `hybrid_storyboard` | ✅ Working | Generated | Generated | **Deterministic** | **TTS (Polly)** | Fixture |
| `hybrid_slideshow` | ✅ Working | Generated | Generated | **Deterministic** | **TTS (Polly)** | **Local FFmpeg slideshow** |
| `ai` | ❌ Not configured | — | — | — | — | — |

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
- `hybrid_storyboard` → deterministic scene plan + narration script + TTS + storyboard images + fixture media
- `hybrid_slideshow` → deterministic scene plan + narration script + TTS + storyboard images + local FFmpeg slideshow MP4
- `ai` → delegate to provider (fails loudly if not configured)
- Default is `fixture`.

**Do not label fixture output as AI-generated video.** The `aiGenerated` flag must be `false` for fixture and hybrid modes.
