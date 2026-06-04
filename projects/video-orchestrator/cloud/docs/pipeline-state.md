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

## Not Yet Implemented

The current flow does not implement:

- prompt-to-video AI generation (Bedrock Nova Reel, etc.)
- script-to-narration AI generation (AWS Polly, etc.)
- real image/video provider integration
- provider selection based on channel config

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
