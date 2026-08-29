# Save-to-Mind Video Ingestion Envelope Acceptance — 2026-08-29

## Disposition

The bounded canonical visual path and the queue-driven Save-to-Mind path are
accepted on branch `feat/video-ingestion-envelope`. The original visual
acceptance is recorded at `014dfc28`; the queue/cache fix is recorded at
`3a85bb2a`:

- one short public YouTube source was processed;
- one actual Bedrock vision request analyzed three selected frames;
- captions, timestamped visual observations, and a structured summary were
  returned in the canonical v1 result; and
- the Console, CLI callers, and Apply-one writer were exercised against the
  completed cached result; and
- one real disposable queue run selected the capture, reused the compatible
  completed result, and completed through the explicit Apply-one approval
  boundary.

The queue worker remains report/preview-only until an operator approves the
single canonical Mind write. The acceptance therefore records the transient
queue `blocked` approval state followed by the explicit writer apply and final
queue `done` state. No additional Bedrock request was made.

This report supplements the historical live Save-to-Mind Bedrock migration
audits. It does not claim production deployment, live webhook acceptance, or a
write to the real Mind repository.

## 1. Visual acceptance

| Field | Evidence |
|---|---|
| Attempted | Yes; one bounded smoke |
| Success | Yes |
| Source | `https://www.youtube.com/watch?v=jNQXAC9IVRw` |
| Source type | `youtube-url` |
| Duration | 19 seconds |
| Frames extracted locally | 19 |
| Frames selected/sent to paid vision | 3 |
| Timestamps | `00:00`, `00:09`, `00:18` |
| Vision provider/model | `claude-bedrock` / `us.anthropic.claude-sonnet-4-6` |
| Actual Bedrock request count | 1 |
| Approximate vision cost | `$0.009` |
| Transcript | captions; 6 segments, 217 characters |
| Summary | Present; text summary used the zero-cost `codex-cli` / `gpt-5.4-mini` route in the temporary selector harness |
| Job | `video-analysis-d336a575f02416f6a221` |

The result was `succeeded`, with three timestamped visual observations, no
warnings, and processing evidence recording `frames_extracted=19` and
`frames_sent_to_paid_vision=3`. The selected frame files and report remain in
the isolated worktree runtime under
`runtime/local/brain-core/video-analysis/jobs/video-analysis-d336a575f02416f6a221/`.

The selector audit contained one preflight selection and one actual visual
selection. Only the latter caused the Bedrock request; no later queue, Console,
CLI, or writer step invoked paid visual inference.

## 2. Brain Console

**Working: yes, in the isolated feature-branch Console.** URL submission,
processing state, transcript, summary, timestamped findings, provider/frame
evidence, and recent history were all displayed. The page exposed one Video
Analyzer surface; no duplicate engine was observed.

The UI reused the exact completed Phase 3 result. The direct canonical Core
route was also smoke-tested with that cached job. Because unrelated telemetry
requests could starve the temporary Core process, the final browser exercise
used a controlled local cache proxy returning the exact canonical JSON; this
was a test harness, not production or the shared Console service.

## 3. CLI

Both caller modes are usable through the same canonical agent entry point and
reused the completed cache without another Bedrock request:

```text
node projects/brain-core/dist/bin/brain-agent.js video analyze \
  "https://www.youtube.com/watch?v=jNQXAC9IVRw" \
  --focus "identify the clearest visible subjects and scene changes" \
  --caller codex

node projects/brain-core/dist/bin/brain-agent.js video analyze \
  "https://www.youtube.com/watch?v=jNQXAC9IVRw" \
  --focus "identify the clearest visible subjects and scene changes" \
  --caller claude-code
```

Both returned job `video-analysis-d336a575f02416f6a221`, three visual
observations, captions, the Sonnet vision evidence, and a structured summary.
The shared natural-language discovery query was run, but its top matches did
not independently establish exact discovery-index coverage for this CLI
subcommand; invocation is verified, discoverability remains a documentation
follow-up.

## 4. Queue/cache identity fix

The original mismatch was exact and bounded:

- the Python analyzer's semantic job identity was
  `sha256(source_hash | normalized_focus)`, truncated to 20 hex characters in
  the job ID; and
- the direct caller supplied focus `identify the clearest visible subjects
  and scene changes`, producing completed job
  `video-analysis-d336a575f02416f6a221`, while queue dispatch omitted focus and
  fell back to an empty focus, producing the existing partial job
  `video-analysis-9d83eba4f38c54eeb4b3`.

Caller, persistence, correlation, idempotency, and capture-reference fields do
not participate in analysis identity. Frame budgets and transcript mode are
coverage requirements: a cached result is reusable only when it is succeeded,
valid, and has at least the requested extracted/paid/observation coverage and
the requested transcript provider. Partial or insufficient results fall
through to canonical processing; they are never returned as reusable cache
hits.

Queue dispatch now uses the shared TypeScript request normalizer and accepts
the bounded analysis dimensions explicitly. The acceptance used
`frame_budget=19`, `paid_vision_frame_budget=3`, and `transcript_provider=captions`,
matching the previously approved completed result. The full semantic cache
key was:

```text
source_sha256 = 4b0f48e4f4ae6e02a1b61dcca3425e6db6f6db1a945c66857cccfdd4c5a95c8c
cache_key = d336a575f02416f6a221b52c5b9a512af7abd05f64a5dfa95cfcfe0985d9aafa
job_id = video-analysis-d336a575f02416f6a221
```

## 5. Save-to-Mind E2E

| Stage | Result | Evidence |
|---|---|---|
| Disposable capture | Pass | `/var/folders/g4/txyv4_ls347fb97r13twxh3c0000gp/T/brain-video-queue-final-Bfwu6Y/mind/inbox/new/elephant-video-queue-acceptance.md` |
| Async queue selection | Pass | Actual continuous queue selected the stable capture; `serviceRunCount=1` |
| Canonical queue dispatch | Pass/reused | Queue request reused completed job `video-analysis-d336a575f02416f6a221`; prior partial `video-analysis-9d83eba4f38c54eeb4b3` did not block it; cache mtime was unchanged |
| Queue approval boundary | Pass | Queue recorded transient `blocked` with `video_analysis_result_requires_mind_apply_one_approval`; explicit Apply-one approval then recorded final `done` |
| Enriched artifact | Pass | `/private/var/folders/g4/txyv4_ls347fb97r13twxh3c0000gp/T/brain-video-queue-final-Bfwu6Y/mind/inbox/processed/video-analysis/video-analysis-d336a575f02416f6a221.md` |
| Original source traceability | Pass | Artifact preserves `inbox/new/elephant-video-queue-acceptance.md`; original capture remained in place |
| Duplicate/recursion check | Pass | One queue run, no failed artifact, no new paid inference, and Apply-one replay returned `already_applied` |
| Real Mind/production mutation | Not performed | Real Mind, production webhook, and shared services were untouched |

The queue acceptance used the existing completed result with
`frames_extracted=19`, `frames_sent_to_paid_vision=3`, provider
`claude-bedrock`, and model `us.anthropic.claude-sonnet-4-6`. The queue itself
did not invoke Bedrock; the one actual Bedrock request remains the previously
accepted visual smoke.

## 6. Writer safety

**Apply-one controls verified: yes, in the disposable Mind root.** The first
apply created exactly the canonical target and produced:

- exact target `inbox/processed/video-analysis/video-analysis-d336a575f02416f6a221.md`;
- source commit binding `3a85bb2a`;
- matching preview/approval hashes and explicit operator approval with second
  confirmation;
- durable accepted-approval audit;
- post-write hash match;
- one-file/no-unapproved-path receipt;
- identity-bound rollback artifact; and
- preserved original capture reference and `review_required: true`.

The queue receipt is at
`/var/folders/g4/txyv4_ls347fb97r13twxh3c0000gp/T/brain-video-queue-final-Bfwu6Y/receipts/video-preview-85c927736d45e09f7d74.receipt.json`.
The subsequent identical Apply-one call returned `already_applied`.

## 7. Validation

Passed focused validation:

```text
./projects/brain-core/node_modules/.bin/tsx --test \
  projects/brain-core/src/tests/video-analysis-pipeline.test.ts \
  projects/brain-core/src/tests/mind-steward-inbox-queue.test.ts \
  projects/brain-core/src/tests/continuous-processing-service.test.ts \
  projects/brain-core/src/tests/continuous-processing-router.test.ts
  -> 47/47 passed

python3 -m unittest projects/brain-core/services/video-analyzer/test_analyze.py
  -> 14/14 passed

python3 -m py_compile projects/brain-core/services/video-analyzer/analyze.py
  -> passed

./projects/brain-core/node_modules/.bin/tsx --test \
  projects/brain-console/lib/video-analysis-schema.test.ts
  -> 1/1 passed

node --test tools/validate-ai-model-registry.test.mjs
  -> 4/4 passed

npm run typecheck  # projects/brain-core
npm run typecheck  # projects/brain-console
  -> both passed

npm run build  # projects/brain-core
  -> passed
```

The canonical direct API route, Console history/result surface, both CLI
caller modes, schema validation, queue/dispatcher/cache regressions, writer
tests, and Bedrock vision admission were covered. The live n8n
classifier/webhook was not mutated or re-run in this video acceptance; its
live evidence remains in the two historical Save-to-Mind Bedrock audit
reports.

## 8. Git and remaining blockers

- Branch: `feat/video-ingestion-envelope`
- Queue/cache fix commit: `3a85bb2a`
- Shared dirty `main` was not touched.
- Temporary selector, Core, Console, proxy processes, and dependency
  symlinks were removed from the isolated worktree after validation.
- No production deployment or real Mind write occurred.

No queue/cache integration blocker remains for this bounded tested source and
request shape. This report does not claim broader source coverage, production
deployment, live webhook acceptance, or a write to the real Mind repository.
