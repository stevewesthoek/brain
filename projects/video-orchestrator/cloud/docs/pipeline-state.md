# AWS Video Pipeline State

**Status:** current operational truth

## Working Today

The AWS Video control plane works end to end in pipeline proof mode:

- Brain Console Center can trigger the pipeline.
- Brain Core can start AWS Step Functions.
- MediaConvert final assembly succeeds.
- Brain Core can repair the publish contract.
- YouTube dry-run succeeds.
- Private YouTube upload succeeds.

## Pipeline Proof Mode

Pipeline proof mode means the media assembly pipeline uses known fixture media. The title and metadata may come from a prompt/job, but the video and narration content are not generated from that prompt.

Fixture inputs:

```text
jobs/test-001/audio/narration.mp3
jobs/test-001/exports/sample-transcoded.mp4
```

Jobs created through this mode must be marked:

```json
{
  "mediaSource": "fixture",
  "generationMode": "fixture_assembly",
  "videoSourceKey": "jobs/test-001/exports/sample-transcoded.mp4",
  "audioSourceKey": "jobs/test-001/audio/narration.mp3",
  "aiGenerated": false
}
```

Fixture uploads should use a `[PIPELINE PROOF]` title prefix unless an explicit local config disables it.

## Not Implemented Yet

The current Brain Core generate flow does not implement:

- prompt-to-video AI generation
- script-to-narration AI generation
- prompt-based scene planning
- real image/video model integration

Historical proof artifacts exist for Bedrock Nova Reel/Polly-style outputs, but they are not wired as the active runtime generation provider.

## Real Generation Boundary

The next architecture is provider-based:

- `VideoGenerationProvider` accepts job, prompt/script, channel/profile input, and an output S3 key.
- `NarrationGenerationProvider` accepts script/channel input and an output narration S3 key.
- Provider output must include provider name, S3 output key, and generation metadata.
- `AWS_VIDEO_GENERATION_MODE=fixture|ai` controls the mode.
- Default is `fixture`.
- If mode is `ai` and no provider is configured, Brain Core must fail loudly with `AI video generation provider is not configured`.

Do not label fixture output as AI-generated video.
