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

### 2.5. Hybrid TTS (`AWS_VIDEO_GENERATION_MODE=hybrid_tts`)

Prompt-derived metadata with TTS narration and fixture video. Brain Core generates a deterministic scene plan and narration script from the user's input, synthesizes narration audio using AWS Polly TTS, then uses fixture video for assembly.

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_tts_fixture_video",
  "aiGenerated": false,
  "ttsGenerated": true,
  "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
  "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
  "audioKey": "jobs/<jobId>/audio/narration.mp3",
  "audioProvider": "aws-polly",
  "voiceId": "Joanna",
  "providers": {
    "scenePlan": "deterministic-local",
    "narrationScript": "deterministic-local",
    "narrationAudio": "aws-polly",
    "video": "fixture"
  },
  "warnings": ["Video media still uses fixture assets; narration audio is generated from the prompt-derived script."]
}
```

**Behavior:**
- Generates scene plan and narration script (same as hybrid mode)
- Extracts clean narration text from narration-script.txt
- Synthesizes MP3 audio using AWS Polly (voice: Joanna)
- Writes generated audio to `jobs/<jobId>/audio/narration.mp3` (replaces fixture)
- Writes audio to both local and S3
- Still uses fixture video for assembly
- Title gets `[PIPELINE PROOF]` prefix (final video is still fixture)
- Brain Console Center shows TTS provider and voice info
- Shows scene plan, narration script, and generated audio artifacts

**What it does:**
- Generates prompt-derived scene plan
- Generates prompt-derived narration script from scene descriptions
- **NEW:** Synthesizes narration MP3 from script using AWS Polly
- Assembles with fixture video
- Requires AWS Polly access (via AWS CLI)

**What it does NOT do:**
- Does not generate video (source.mp4 is fixture)
- Does not call external AI/ML models for content generation
- Does not require additional provider accounts

### 2.6. Hybrid Storyboard (`AWS_VIDEO_GENERATION_MODE=hybrid_storyboard`)

Prompt-derived metadata with TTS narration, generated storyboard images, and fixture video. Brain Core generates a deterministic scene plan and narration script from the user's input, synthesizes narration audio using AWS Polly TTS, generates storyboard card images for each scene, then uses fixture video for assembly.

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
  "audioProvider": "aws-polly",
  "voiceId": "Joanna",
  "storyboardKey": "jobs/<jobId>/metadata/storyboard.json",
  "sceneImageKeys": [
    "jobs/<jobId>/images/scene-001.svg",
    "jobs/<jobId>/images/scene-002.svg"
  ],
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

**Behavior:**
- Generates scene plan and narration script (same as hybrid_tts)
- Synthesizes narration audio using AWS Polly (voice: Joanna)
- Generates deterministic storyboard card images (SVG) for each scene
- Visual prompt and narration text embedded in each card
- Writes storyboard manifest to `jobs/<jobId>/metadata/storyboard.json`
- Writes scene images to `jobs/<jobId>/images/scene-NNN.svg`
- Still uses fixture video for final assembly
- Title gets `[PIPELINE PROOF]` prefix
- Brain Console Center shows storyboard provider, image count, and scene cards

**What it does:**
- Generates prompt-derived scene plan
- Generates prompt-derived narration script from scene descriptions
- Synthesizes narration MP3 using AWS Polly
- **NEW:** Generates deterministic storyboard cards as SVG images
- Each card contains visual prompt and narration text
- Writes all artifacts locally and to S3
- Assembles with fixture video

**What it does NOT do:**
- Does not generate video (source.mp4 is fixture)
- Does not call external AI/ML models for image generation
- Does not generate full motion video or animations
- Scene images are deterministic visual reference cards, not AI-generated imagery

### 2.7. Hybrid Slideshow (`AWS_VIDEO_GENERATION_MODE=hybrid_slideshow`)

Prompt-derived metadata with TTS narration, generated storyboard images, and a locally assembled slideshow MP4. Brain Core generates a deterministic scene plan and narration script from the user's input, synthesizes narration audio using AWS Polly TTS, generates deterministic storyboard SVG cards plus PNG slideshow frames for each scene, then assembles the PNG frames into the final MP4 using local FFmpeg.

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
  "sceneImageKeys": [
    "jobs/<jobId>/images/scene-001.svg",
    "jobs/<jobId>/images/scene-002.svg"
  ],
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
- Generates deterministic storyboard cards as SVG images
- Emits deterministic PNG companion frames for slideshow assembly
- Assembles `generated-001.mp4` locally with FFmpeg from those scene images and narration audio
- Uploads the assembled MP4 back to S3

**What it does NOT do:**
- Does not generate full AI motion video
- Does not call external AI/image/video providers
- Does not break the YouTube dry-run/private publish flow

### 2.8. Hybrid Image Slideshow (`AWS_VIDEO_GENERATION_MODE=hybrid_image_slideshow`)

Prompt-derived metadata with TTS narration, model-generated scene images, and a locally assembled slideshow MP4. Brain Core keeps the working FFmpeg slideshow assembly path, but swaps deterministic scene images for the configured image provider. Canonical thumbnail generation is automatic.

```json
{
  "mediaSource": "hybrid",
  "generationMode": "hybrid_image_slideshow_video",
  "aiGenerated": false,
  "partialAiGenerated": true,
  "ttsGenerated": true,
  "storyboardGenerated": true,
  "imageGenerated": true,
  "slideshowGenerated": true,
  "thumbnailGenerated": true,
  "imageProvider": "aws-bedrock-nova-canvas",
  "imageModelId": "amazon.nova-canvas-v1:0",
  "audioProvider": "aws-polly",
  "videoProvider": "local-ffmpeg-slideshow",
  "sceneImageKeys": [
    "jobs/<jobId>/images/scene-001.png"
  ],
  "videoKey": "jobs/<jobId>/video-generated/generated-001.mp4",
  "videoSourceKey": "jobs/<jobId>/video-generated/generated-001.mp4",
  "thumbnailKey": "jobs/<jobId>/exports/thumbnail-001.jpg",
  "warnings": ["Scene images are generated by an image model; final video is slideshow assembly, not motion-video generation."]
}
```

**Canonical thumbnail generation:**

During the review phase, Brain Core automatically generates a canonical YouTube thumbnail from the first scene PNG:
- Source: `jobs/<jobId>/images/scene-001.png` (Nova Canvas generated)
- Output: `jobs/<jobId>/exports/thumbnail-001.jpg` (1280x720 JPEG)
- Metadata: `jobs/<jobId>/metadata/thumbnail.json` (thumbnailStatus, provider, dimensions)
- Integration: YouTube package gets `thumbnailKey` pre-populated with canonical path
- UI: Brain Console Center shows thumbnail preview in Review tab with copy-to-preview command

**Image provider configuration:**

```bash
AWS_VIDEO_IMAGE_PROVIDER=deterministic-placeholder|aws-bedrock-nova-canvas|aws-bedrock-titan-image
AWS_VIDEO_IMAGE_MODEL_ID=amazon.nova-canvas-v1:0
AWS_VIDEO_IMAGE_REGION=us-east-1
AWS_VIDEO_IMAGE_WIDTH=1280
AWS_VIDEO_IMAGE_HEIGHT=720
AWS_VIDEO_IMAGE_CFG_SCALE=6.5
AWS_VIDEO_IMAGE_SEED=42
AWS_VIDEO_IMAGE_QUALITY=standard
```

Verified provider:

- Provider: `aws-bedrock-nova-canvas`
- Model ID: `amazon.nova-canvas-v1:0`
- Region: `us-east-1`
- Request contract: `aws bedrock-runtime invoke-model` with `taskType=TEXT_IMAGE`, `textToImageParams.text`, and `imageGenerationConfig`
- Local proof script: `projects/video-orchestrator/cloud/scripts/bedrock-image-proof.sh nova "A peaceful tree in a sunny meadow" /tmp/tree.png`
- Effective defaults: `1280x720`, `cfgScale=6.5`, `seed=42`, `quality=standard`

`hybrid_image_slideshow` does not silently fall back to placeholders. If `AWS_VIDEO_IMAGE_PROVIDER` is missing, generation fails with `currentStep=image_provider_not_configured`. `deterministic-placeholder` is accepted only as explicit development proof mode. Titan Image remains fail-loud even though it can be listed/invoked in `us-east-1`, because it is already marked legacy and showed legacy-access blocking outside `us-east-1`.

**What it does:**
- Generates prompt-derived scene plan and narration script
- Synthesizes narration MP3 using AWS Polly
- Requires an explicit image provider for scene images
- Assembles `generated-001.mp4` locally with FFmpeg from generated scene images and narration audio
- Uploads the assembled MP4 back to S3

**What it does NOT do:**
- Does not generate full AI motion video
- Does not animate scenes or create motion footage
- Does not silently use fixture video or placeholder images for real image mode

### 2.9. Review Gate for Generated Media

Generated-media modes require an explicit review before YouTube dry-run or private publish:

- `hybrid_storyboard`
- `hybrid_slideshow`
- `hybrid_image_slideshow`

Brain Core writes `jobs/<jobId>/metadata/review.json` when publish metadata exists or when generated publish assets are detected.

```json
{
  "jobId": "<jobId>",
  "reviewStatus": "pending",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "reviewedAt": null,
  "reviewedBy": null,
  "notes": null,
  "media": {
    "scenePlanKey": "jobs/<jobId>/metadata/scene-plan.json",
    "narrationScriptKey": "jobs/<jobId>/audio/narration-script.txt",
    "audioKey": "jobs/<jobId>/audio/narration.mp3",
    "sceneImageKeys": ["jobs/<jobId>/images/scene-001.png"],
    "videoKey": "jobs/<jobId>/exports/generated-001-final.mp4",
    "thumbnailKey": "jobs/<jobId>/exports/thumbnail-001.jpg",
    "publishKey": "jobs/<jobId>/metadata/publish.json"
  }
}
```

Brain Console Center exposes:

- `GET /api/video-orchestrator/jobs/:jobId/review`
- `POST /api/video-orchestrator/jobs/:jobId/review/approve`
- `POST /api/video-orchestrator/jobs/:jobId/review/request-changes`

If review is missing or pending, YouTube publish returns:

```json
{
  "ok": false,
  "code": "publish_review_required",
  "error": "Generated media must be reviewed before YouTube publish.",
  "reviewStatus": "pending"
}
```

The verifier script supports `--require-review-approved` for a strict publish-readiness check.

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

**Current:** Use `hybrid_slideshow` for deterministic end-to-end video proof, or `hybrid_image_slideshow` only when an image provider is explicitly configured.

Hybrid TTS mode lets you:
- Verify the end-to-end pipeline with real prompts
- Show prompt-derived metadata (scene plans, narration scripts)
- Demonstrate real TTS narration synthesis (AWS Polly)
- Keep final video predictable (fixture)
- Build toward real video generation without breaking the flow

**Progression:**
1. `fixture` — pure proof, no generation (default)
2. `hybrid` — prompt-derived metadata + fixture media
3. `hybrid_tts` — prompt-derived metadata + TTS audio + fixture video
4. `hybrid_storyboard` — prompt-derived metadata + TTS audio + storyboard images + fixture video
5. `hybrid_slideshow` — prompt-derived metadata + TTS audio + deterministic storyboard images + local FFmpeg slideshow video
6. `hybrid_image_slideshow` — prompt-derived metadata + TTS audio + model-generated scene images + local FFmpeg slideshow video
7. (future) `ai` — full AI motion-video generation

## Dev Environment Reset

To restart Brain Core and Brain Console Center with a specific generation mode:

```bash
# Default: hybrid_tts mode
bash tools/scripts/brain-console-center-dev-reset.sh

# Or specify a different mode
bash tools/scripts/brain-console-center-dev-reset.sh hybrid_storyboard
bash tools/scripts/brain-console-center-dev-reset.sh hybrid_slideshow
bash tools/scripts/brain-console-center-dev-reset.sh hybrid_image_slideshow
```

This script:
1. Kills stale processes on ports 4877 (Brain Core) and 4881 (Brain Console Center)
2. Ensures ports are free
3. Starts Brain Core with specified `AWS_VIDEO_GENERATION_MODE` (default: hybrid_tts)
4. Starts Brain Console Center
5. Health-checks both endpoints
6. Prints log file paths and test commands

**Logs:**
- Brain Core: `/tmp/brain-core-hybrid.log`
- Brain Console Center: `/tmp/brain-console-center.log`

**Test generation mode output:**
```bash
export JOB_ID=<new-job-from-console>
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/metadata/scene-plan.json" - --region eu-north-1 | jq
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/audio/narration-script.txt" - --region eu-north-1

# For hybrid_storyboard/hybrid_slideshow/hybrid_image_slideshow:
aws s3 cp "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/metadata/storyboard.json" - --region eu-north-1 | jq
aws s3 ls "s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/$JOB_ID/images/" --region eu-north-1
```

## Generation Mode Verification

Use the read-only verifier to check a completed job's S3 artifact contract without performing a YouTube upload:

```bash
tools/scripts/verify-aws-video-generation-mode.sh hybrid_slideshow <jobId>
tools/scripts/verify-aws-video-generation-mode.sh hybrid_image_slideshow <jobId>
```

Supported modes:

| Mode | Expected generationMode | Key artifacts |
|---|---|---|
| `fixture` | `fixture_assembly` | `audio/narration.mp3`, `video-generated/generated-001.mp4` |
| `hybrid` | `hybrid_scene_plan_fixture_media` | `metadata/scene-plan.json`, `audio/narration-script.txt`, fixture audio/video provider metadata |
| `hybrid_tts` | `hybrid_tts_fixture_video` | Scene plan, narration script, Polly MP3, fixture video |
| `hybrid_storyboard` | `hybrid_storyboard_fixture_video` | Scene plan, narration script, Polly MP3, `metadata/storyboard.json`, `images/scene-001.svg`, fixture video source documented |
| `hybrid_slideshow` | `hybrid_slideshow_video` | Scene plan, narration script, Polly MP3, storyboard JSON, SVG/PNG scene images, `video-generated/generated-001.mp4` from `local-ffmpeg-slideshow` |
| `hybrid_image_slideshow` | `hybrid_image_slideshow_video` | Scene plan, narration script, Polly MP3, storyboard JSON, PNG/JPEG scene images, `video-generated/generated-001.mp4` from `local-ffmpeg-slideshow`, non-placeholder image provider unless development override is explicit |

The verifier also checks `metadata/status.json`, `metadata/assets.json`, optional `metadata/publish.json` object-key shape, and optional `metadata/publish-check.json` dry-run status. It exits nonzero on failed required checks and does not modify S3 or local job metadata.

## Artifact Paths (Canonical)

| Asset | Path | Notes |
|-------|------|-------|
| Script markdown | `jobs/<jobId>/scripts/script.md` | User input |
| Scene plan | `jobs/<jobId>/metadata/scene-plan.json` | Deterministic generation (hybrid/hybrid_tts/hybrid_storyboard/hybrid_slideshow/hybrid_image_slideshow) |
| Narration script text | `jobs/<jobId>/audio/narration-script.txt` | Deterministic generation (hybrid/hybrid_tts/hybrid_storyboard/hybrid_slideshow/hybrid_image_slideshow) |
| Narration audio | `jobs/<jobId>/audio/narration.mp3` | Fixture (fixture/hybrid) or TTS-generated (hybrid_tts/hybrid_storyboard/hybrid_slideshow/hybrid_image_slideshow) |
| Storyboard manifest | `jobs/<jobId>/metadata/storyboard.json` | Deterministic storyboard metadata (hybrid_storyboard/hybrid_slideshow/hybrid_image_slideshow) |
| Image generation summary | `jobs/<jobId>/metadata/image-generation.json` | Nova Canvas provider/model/region, prompt hashes, settings, warnings |
| Scene images | `jobs/<jobId>/images/scene-NNN.svg` and/or `scene-NNN.png`/`.jpg` | Deterministic SVG/PNG in storyboard/slideshow; model-generated PNG/JPEG in image slideshow |
| Raw generated video | `jobs/<jobId>/video-generated/generated-001.mp4` | Fixture copy except slideshow modes, which use local FFmpeg slideshow output |
| Final assembled video | `jobs/<jobId>/exports/generated-001-final.mp4` | Step Functions output (all modes) |
| Thumbnail | `jobs/<jobId>/exports/thumbnail-001.jpg` | Step Functions output (all modes) |

**Generation mode determines which assets are real:**
- `fixture`: All assets are fixture copies
- `hybrid`: Scene plan + narration script are real; audio/video are fixture
- `hybrid_tts`: Scene plan + narration script + narration audio are real; video is fixture
- `hybrid_storyboard`: Scene plan + narration script + narration audio + storyboard images are real; video is fixture
- `hybrid_slideshow`: Scene plan + narration script + narration audio + storyboard images + raw generated MP4 are real; final motion is still deterministic slideshow, not AI video
- `hybrid_image_slideshow`: Scene plan + narration script + narration audio + model-generated still images + raw generated MP4 are real; final video is still slideshow assembly, not AI motion video
- `ai` (future): All assets real (requires AI providers)

## Provider Boundary

Brain Core defines provider interfaces for real generation (next layer):

- `VideoGenerationProvider`
- `NarrationGenerationProvider`
- `SceneImageProvider`

`AWS_VIDEO_GENERATION_MODE` controls which path runs:
- `fixture` → copy fixture media
- `hybrid` → generate prompt-derived metadata + fixture media
- `hybrid_slideshow` → generate deterministic still images + assemble slideshow MP4
- `hybrid_image_slideshow` → require configured image provider + assemble slideshow MP4
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
