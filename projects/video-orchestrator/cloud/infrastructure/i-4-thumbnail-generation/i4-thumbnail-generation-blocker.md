# I-4 Thumbnail Generation Blockers

## Status Summary
- I-4.1: Frame extraction approach ✅ APPROVED (preflight passed)
- I-4.2: Lambda deployment ⏸️ BLOCKED (ffmpeg unavailable in Lambda)
- Nova Canvas blocker: RESOLVED (frame extraction alternative chosen)

## Investigation

### Available models:
- **eu-north-1:** No image generation models
- **us-east-1:** 
  - amazon.nova-canvas-v1:0 ✅ Available
  - amazon.titan-image-generator-v2:0 ✅ Available
  - stability.stable-*-v1:0 ✅ Multiple Stable Diffusion variants

### Attempted approach:
Cross-region generation (us-east-1) + canonical storage (eu-north-1), similar to I-3 video generation.

### Blocker:
Nova Canvas API validation fails with:
```
ValidationException: Malformed input request, please reformat your input and try again.
```

Tested payloads:
1. TEXT_TO_IMAGE with standard payload → FAIL (validation error)
2. Standard JSON with taskType and textToImageParams → FAIL

The exact API contract for Nova Canvas invoke-model is not clear from error messages.

## Known working approaches:
- Stable Image Upscale (takes existing image, requires input upload)
- Titan Image Generator v2 (likely different API format)
- Local thumbnail extraction from generated video via MediaConvert snapshot (alternative approach)

## Alternative approaches to pursue:
1. Extract frame from generated-001.mp4 at 3-second mark using ffmpeg
   - Files already exist in S3
   - ffmpeg can extract, resize, upload
   - Does not require new Bedrock model access
   
2. Use Titan Image Generator v2 in us-east-1
   - Different API contract, might have better docs
   - Same cross-region approach as Nova Canvas
   
3. Use MediaConvert snapshot feature
   - MediaConvert can extract frames during transcode
   - Deferred but viable for future

## Recommendation:
For MVP, use **video frame extraction** instead of text-to-image generation:
- Extract frame at 3-second mark from generated-001.mp4
- Resize to 1280x720 for YouTube
- No additional service access needed
- Faster development
- Proves thumbnail storage/metadata contract

## Current Blocker: I-4.2 Lambda ffmpeg Availability

**Issue:** AWS Lambda base image (Python 3.11) does not include ffmpeg.

**Impact:** 
- `lambda-extract-thumbnail.py` calls `subprocess.run(['ffmpeg', ...])` 
- Lambda will fail at runtime with: `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'`
- Cannot deploy or test I-4.2 until resolved

**Resolution Options:**

1. **Create Lambda Layer with ffmpeg** (RECOMMENDED)
   - Build static ffmpeg binary compiled for Amazon Linux 2 x86_64
   - Package in Lambda layer: `python/lib/ffmpeg` and `python/bin/ffmpeg`
   - Layer available for reuse by other video-processing Lambdas
   - Path in code: `/opt/python/lib/ffmpeg` or add to $PATH
   - Status: Not yet created; requires build infrastructure

2. **Package ffmpeg binary in deployment ZIP**
   - Download pre-compiled ffmpeg (14-20MB)
   - Extract to `bin/` directory in deployment ZIP
   - Update `lambda-extract-thumbnail.py` to call `./bin/ffmpeg`
   - Blocker: Increases ZIP size significantly (~15MB+), slower cold start
   - Viable but not recommended for repeated use

3. **Deploy as container image instead of ZIP**
   - Use ECR image based on Amazon Linux 2
   - Install ffmpeg via yum
   - Higher operational overhead but cleaner approach
   - Recommended for production; overkill for MVP

### Recommendation:
**Create Lambda layer** (option 1) — unblocks current task and enables future video Lambda functions without duplication.

Layer structure needed:
```
lambda-layers/ffmpeg/
  ├── BUILD.md (build instructions)
  ├── ffmpeg-layer.zip (output)
  └── python/
      ├── bin/
      │   └── ffmpeg (static binary)
      └── lib/
          └── (any required shared libraries)
```

## Previous Blocker: Nova Canvas API

RESOLVED — Chose frame extraction approach instead:
- Extract frame from generated-001.mp4 at 3-second mark
- Resize to 1280x720 using ffmpeg scale filter
- No new service dependencies (uses existing video file)
- Faster MVP development
- Proof: `../../scripts/i4-thumbnail-preflight.sh` ✅ PASSED (352KB PNG generated)
