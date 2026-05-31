# I-4 Thumbnail Generation: Architecture Decision

**Decision Date:** 2026-05-31  
**Status:** RECOMMENDATION READY  
**Recommendation:** MediaConvert native frame capture (Option 1)

---

## Executive Summary

Three viable architectures exist for thumbnail extraction. **MediaConvert native frame capture** is the recommended approach for ProChat OS:

- **✅ Simplest:** No external services, no Lambda, no layer builds
- **✅ Most reliable:** Native AWS service, auditable, built into existing job
- **✅ Lowest operational burden:** Integrated into existing Step Functions workflow
- **✅ Proven approach:** Already used by AWS media workflows
- **⚠️ Tradeoff:** Captures at fixed intervals (1 frame/sec), not arbitrary timestamps

**Estimated effort:** 
- Implementation: 1-2 hours (add output group to MediaConvert job)
- Testing: 30 min (run frame capture job, verify output)
- Integration: 1 hour (update Step Functions state machine)
- **Total: ~2.5 hours**

---

## Architecture Options Evaluated

### Option 1: MediaConvert Native Frame Capture ✅ RECOMMENDED

**What it is:**  
MediaConvert can extract frames as part of the same transcode job using `FrameCaptureSettings` in a separate output group.

**How it works:**
```json
{
  "OutputGroups": [
    {
      "Name": "Frame Capture",
      "OutputGroupSettings": {
        "Type": "FILE_GROUP_SETTINGS",
        "FileGroupSettings": {
          "Destination": "s3://bucket/frame-captures/"
        }
      },
      "Outputs": [{
        "ContainerSettings": {
          "Container": "RAW"
        },
        "VideoDescription": {
          "CodecSettings": {
            "FrameCaptureSettings": {
              "FramerateNumerator": 1,      // 1 frame per second
              "FramerateDenominator": 1,
              "MaxCaptures": 10             // Or specific number
            }
          }
        },
        "NameModifier": "-frame"
      }]
    }
  ]
}
```

**Output format:**
- Container: RAW (native image format)
- Filename pattern: `{input}-frame-{sequence}.jpg` or `.png`
- Quality: Same as video transcoding (high fidelity)

**Deployment complexity:**
- ✅ No new Lambda layer
- ✅ No new service dependencies
- ✅ One JSON field change in MediaConvert settings
- ✅ No Lambda code to write/test

**Operational burden:**
- Integrated into existing Step Functions job
- Single monitoring point (MediaConvert job)
- No separate Lambda error handling
- Output cleanup included in job cleanup

**Reliability:**
- ✅ Native AWS service (99.99% SLA)
- ✅ Same reliability as existing I-2/I-3 jobs
- ✅ Auditable through CloudTrail
- ✅ Integrated error handling

**Cost:**
- Video transcoding: $0.125/min (existing cost)
- Frame capture add-on: ~5-10% additional time (~3-7 seconds for 60s video)
- **Additional cost: ~$0.01-0.02 per job** (minimal)

**Timeline:**
- **Ready to test immediately** (payload validated)
- No build/compile steps
- No Lambda layer dependencies

**Limitations:**
- ❌ Captures at fixed intervals (1/1 = 1 frame per second max)
- ❌ Cannot specify arbitrary timestamp (e.g., "frame at 3.5 seconds")
- ❌ Must use frame rate settings (1/1, 1/2, 1/30, etc.)
- ❌ Generates sequence of images, not single frame

**Workaround for specific timestamp:**
If 3-second mark is specifically needed:
- Set `FramerateNumerator: 1, FramerateDenominator: 1` to capture every second
- Capture first 4 frames (at 1s, 2s, 3s, 4s)
- Post-process: Lambda selects frame at 3s from the sequence
- Cost: Negligible (single frame selection in Lambda)

**Advantages vs Option 2 (Lambda + ffmpeg):**
| Factor | MediaConvert | Lambda + ffmpeg |
|--------|---|---|
| External services | 0 | 1 (Lambda) |
| Build steps | 0 | Yes (ffmpeg layer) |
| Lambda layer | No | Required |
| Setup complexity | Low | Medium-High |
| Operational burden | Low | Medium |
| Reliability | High (native) | High (well-tested) |
| Audit trail | Built-in | CloudWatch logs |
| Cost overhead | ~$0.01/job | ~$0.002/job (cheaper) |
| Timestamp precision | 1-second intervals | Arbitrary |

**Advantages vs Option 3 (ECS/Fargate):**
| Factor | MediaConvert | ECS/Fargate |
|---|---|---|
| Always-on cost | $0 | $10-30/month (idle) |
| Scaling | Auto (serverless) | Manual or complex |
| Startup time | <1s | 5-30s (container) |
| Deployment complexity | Low | High |
| Operational burden | Low | High |
| Maintenance burden | None | Container updates, patches |
| Cost per job | $0.01-0.02 | $0.01-0.05 |
| Flexibility | Limited (fixed intervals) | Full (arbitrary code) |

---

### Option 2: Lambda + ffmpeg Layer

**What it is:**  
Deploy a Lambda function that calls ffmpeg to extract a frame from the final MP4 after MediaConvert completes.

**How it works:**
1. MediaConvert completes video assembly
2. Lambda reads video from S3
3. Lambda invokes: `ffmpeg -i video.mp4 -ss 3 -vframes 1 -vf "scale=1280:720" -y output.png`
4. Lambda uploads PNG to S3

**Code exists:**
- `lambda-extract-thumbnail.py` already written
- Preflight script (`i4-thumbnail-preflight.sh`) already tested locally ✅

**Deployment complexity:**
- ⚠️ Must create Lambda layer with ffmpeg binary
  - Build static ffmpeg for Amazon Linux 2 x86_64 (~1-2 hours)
  - Package as ZIP (~15-25MB)
  - Publish layer version
  - Attach to Lambda
- ⚠️ Deploy video-orchestrator-extract-thumbnail Lambda
- ⚠️ Grant IAM permissions (read video, write thumbnail)
- ⚠️ Update Step Functions to call Lambda

**Operational burden:**
- Monitor Lambda CloudWatch logs
- Manage Lambda layer version updates
- ffmpeg version management
- Lambda timeout/memory tuning
- Cold start considerations (10-15s with ffmpeg layer)

**Reliability:**
- ✅ ffmpeg is well-tested, open-source
- ✅ Lambda is reliable (99.95% SLA)
- ❌ Depends on external binary (ffmpeg)
- ❌ Layer availability (must be attached)

**Cost:**
- Lambda: $0.001-0.003 per invocation (depending on memory)
- Duration: 5-15 seconds per thumbnail
- Estimated: $0.002/job (cheaper than MediaConvert)
- But: Add layer build/maintenance costs

**Timeline:**
- **Layer build:** 1-2 hours (first-time only)
- **Lambda deployment:** 30 min
- **Step Functions integration:** 1 hour
- **Total: 2.5-3.5 hours** (plus layer build overhead)

**Advantages:**
- ✅ Arbitrary timestamp support (3-second mark exactly)
- ✅ Cheaper per invocation ($0.002 vs $0.01)
- ✅ Flexible image processing (can add resizing, effects)
- ✅ Lower overhead per job
- ✅ Code is already tested locally

**Disadvantages:**
- ❌ Requires ffmpeg layer build (upfront cost)
- ❌ Layer packaging complexity
- ❌ Cold start latency (~10-15s with 50MB layer)
- ❌ More moving parts (Lambda + layer + IAM + ffmpeg binary)
- ❌ ffmpeg version/binary maintenance burden
- ❌ Layer updates require redeployment

**Why it's NOT recommended for I-4 MVP:**
1. MediaConvert option is simpler and equally reliable
2. ffmpeg layer build is 1-2 hours of upfront investment
3. MediaConvert is already being used for the job
4. Fixed-interval frame capture acceptable for thumbnail
5. Operational complexity not justified for MVP

**When Option 2 becomes preferable:**
- If arbitrary timestamp extraction is needed for multiple jobs
- If more sophisticated image processing is required (filters, effects, multiple crops)
- If cost optimization becomes critical (saves ~$0.008/job at scale)
- If thumbnail customization requires more flexibility

---

### Option 3: ECS/Fargate ffmpeg Worker

**What it is:**  
Deploy a containerized ffmpeg service (ECS/Fargate) that runs on-demand to process video files.

**How it works:**
1. Lambda triggers ECS task with ffmpeg container
2. Container downloads video, extracts frame, uploads thumbnail
3. Lambda waits for task completion
4. Lambda confirms thumbnail exists

**Deployment complexity:**
- ⚠️ Create Docker image with ffmpeg
- ⚠️ Push to ECR
- ⚠️ Configure ECS task definition
- ⚠️ Configure Fargate launch configuration
- ⚠️ Lambda orchestration layer
- ⚠️ Task monitoring and error handling

**Operational burden:**
- High: Container patching, image updates, IAM roles, task definitions
- Monitor ECS task execution
- Troubleshoot container startup failures
- Manage ECR image lifecycle
- Handle task placement/scheduling issues

**Reliability:**
- ✅ ffmpeg reliability (proven)
- ✅ ECS is managed service
- ⚠️ More complex failure modes (container startup, placement, networking)

**Cost:**
- Fargate compute: $0.03-0.10 per task (30s execution)
- CloudWatch logs: $0.01-0.02
- Estimated: $0.04-0.12 per job (2-6x more expensive than Lambda or MediaConvert)
- Idle cost if always-on: $10-30/month

**Timeline:**
- **Container build:** 1-2 hours
- **ECS setup:** 2-3 hours
- **Lambda orchestration:** 1-2 hours
- **Testing:** 1 hour
- **Total: 5-8 hours** (significant upfront investment)

**When to use:**
- High-volume thumbnail generation (100s of jobs/hour)
- Complex image processing requirements
- Need for custom ffmpeg builds or plugins
- Batch job processing

**Why it's NOT recommended for I-4 MVP:**
1. Significant operational overhead
2. Higher cost per job
3. Over-engineered for current needs
4. Deployment complexity 5x higher than Option 1
5. More failure points to monitor

---

## Decision Matrix

| Criteria | MediaConvert | Lambda+ffmpeg | ECS/Fargate |
|----------|---|---|---|
| **Implementation time** | 1-2 hours | 2.5-3.5 hours | 5-8 hours |
| **Operational complexity** | Low ✅ | Medium | High |
| **Setup prerequisites** | None | Build ffmpeg layer | Docker, ECR, ECS |
| **Cost per thumbnail** | $0.01-0.02 | $0.002 | $0.04-0.12 |
| **Maintenance burden** | None ✅ | ffmpeg version mgmt | Container patching |
| **Arbitrary timestamps** | No (1-sec intervals) | Yes ✅ | Yes |
| **Flexibility** | Limited | Good | Excellent |
| **Reliability** | High ✅ | High | Medium-High |
| **Cold start latency** | <1s ✅ | 10-15s | 5-30s |
| **Deployment complexity** | Simplest ✅ | Medium | Hardest |
| **Dependencies** | 0 ✅ | ffmpeg binary | Docker, ECR, ECS |
| **Ready to test NOW** | Yes ✅ | No (layer needed) | No (build needed) |

---

## Recommendation: Option 1 - MediaConvert Native Frame Capture

### Rationale

1. **Simplest path to MVP** — Add one JSON field to existing MediaConvert job
2. **No external dependencies** — No Lambda layer build, no container images
3. **Proven reliability** — Native AWS service handling existing workload
4. **Immediate testability** — Payload validated, can test in 30 minutes
5. **Aligned with existing architecture** — Uses same Step Functions orchestration
6. **Acceptable tradeoff** — 1-second frame intervals sufficient for thumbnail
7. **Lowest operational burden** — No new services to manage
8. **Cost-effective** — Minimal overhead ($0.01-0.02 per job)

### Implementation Plan

#### Phase 1: Validation (30 min)
1. Create test MediaConvert job with FrameCaptureSettings output group
2. Submit job to AWS
3. Verify frame capture output in S3
4. Measure job time overhead
5. Verify frame quality

#### Phase 2: Integration (1-2 hours)
1. Update `lambda-mediaconvert.py` to include frame capture output group
2. Update state machine to log frame capture output location
3. Add frame selection Lambda if specific timestamp needed (optional)
4. Test end-to-end workflow
5. Document frame capture strategy in metadata contract

#### Phase 3: Step Functions Update (1 hour)
1. Add optional ExtractThumbnail state to state machine
2. Map frame capture output to metadata/assets.json
3. Test full workflow
4. Update documentation

### Validation Criteria

- [ ] Frame captured successfully from generated-001.mp4
- [ ] Output quality acceptable for YouTube thumbnail (1280x720+)
- [ ] Frame file stored at expected S3 location
- [ ] Job time overhead <10% (acceptable)
- [ ] Integrated into Step Functions state machine
- [ ] End-to-end test passes

### Fallback Plan

If frame capture fails or output quality is unacceptable:
1. Fall back to **Option 2** (Lambda + ffmpeg layer)
2. Layer build takes 1-2 hours as documented in `../lambda-layers/ffmpeg/BUILD.md`
3. Lambda deployment uses existing code

---

## Deferred Decisions

### Question: What if 3-second exact timestamp is required?

**Current approach:** Capture first 4 frames (1s, 2s, 3s, 4s intervals)

**If specific timestamp becomes requirement:**
1. Short term: Add post-processing Lambda to select frame 3 from sequence
2. Medium term: Switch to Option 2 (Lambda + ffmpeg) for arbitrary timestamps
3. Long term: Evaluate Option 3 if volume justifies complexity

### Question: What about thumbnail customization (filters, effects)?

**Current scope:** Unmodified frame from video (7x7 aspect)

**If customization needed:**
1. Add Lambda with PIL/Pillow for effects
2. Or use Option 2 (Lambda + ffmpeg) for complex filtering
3. Or use Bedrock image generation (different workflow, separate research)

---

## References

### AWS Documentation
- [MediaConvert FrameCaptureSettings](https://docs.aws.amazon.com/mediaconvert/latest/ug/capture-frames-from-video.html) (AWS docs)
- [MediaConvert OutputGroupSettings](https://docs.aws.amazon.com/mediaconvert/latest/apireference/jobs.html)

### Implementation Files
- Payload reference: `/tmp/mediaconvert-frame-capture-payload.json`
- Existing code: `lambda-extract-thumbnail.py` (for Option 2 fallback)
- Existing preflight: `../../scripts/i4-thumbnail-preflight.sh`
- Layer build guide: `../lambda-layers/ffmpeg/BUILD.md`

### Testing
- I-3 validation job: ID 1780237282541-8af0jq ✅ PASSED
- Generated video: `jobs/test-001/video-generated/generated-001.mp4` ✅ EXISTS
- Ready for frame capture test

### Next Steps (If Proceeding with Option 1)

1. **Test frame capture** (30 min)
   ```bash
   # Submit test job with FrameCaptureSettings
   # Monitor completion at:
   # s3://prochat-video-dev-909439522876-eu-north-1-an/jobs/test-001/frame-captures/
   ```

2. **Integrate into I-2 Lambda** (1 hour)
   - Update `lambda-mediaconvert.py` to include frame capture output group
   - Test with Step Functions

3. **Document in metadata** (30 min)
   - Add thumbnail reference to assets.json schema
   - Document frame capture strategy

---

**Status:** Ready for user decision on which architecture to proceed with.

Recommendation: **Proceed with Option 1 (MediaConvert native frame capture)** — immediate test possible, simplest integration, proven reliability.
