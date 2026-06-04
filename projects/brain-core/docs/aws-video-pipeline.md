# AWS Video Pipeline

**Status:** active Brain Core control-plane note

Brain Core is the API runtime for AWS Video operations. Brain Console Center is the active UI. Brain Console Web is legacy.

## Current Working State

The current pipeline is a fixture assembly proof:

- Brain Core starts the AWS Step Functions workflow.
- The workflow assembles fixture video and fixture narration through MediaConvert.
- Brain Core resolves generated S3 artifacts and repairs `publish.json` when needed.
- YouTube dry-run works.
- Private YouTube upload works.

Fixture inputs:

```text
jobs/test-001/audio/narration.mp3
jobs/test-001/exports/sample-transcoded.mp4
```

Brain Core marks this mode as:

```json
{
  "mediaSource": "fixture",
  "generationMode": "fixture_assembly",
  "aiGenerated": false
}
```

## Not AI Generation Yet

The current generate button does not create a prompt-specific AI video. It copies fixture media into the selected job and starts the assembly workflow.

Not yet implemented:

- prompt-to-video AI generation
- script-to-narration AI generation
- prompt-based scene planning
- real image/video provider integration

## Provider Boundary

Brain Core defines generation provider interfaces for the next layer:

- `VideoGenerationProvider`
- `NarrationGenerationProvider`

`AWS_VIDEO_GENERATION_MODE=fixture|ai` controls which path may run. The default is `fixture`. If `AWS_VIDEO_GENERATION_MODE=ai` is set before a real provider is configured, Brain Core returns:

```text
AI video generation provider is not configured
```

Fixture output must never be labeled as AI-generated video.
