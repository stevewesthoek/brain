# Save-to-Mind Video Ingestion Envelope Acceptance — 2026-08-29

## Disposition

The bounded canonical visual path is accepted on branch
`feat/video-ingestion-envelope` at `e3ad0a8a`:

- one short public YouTube source was processed;
- one actual Bedrock vision request analyzed three selected frames;
- captions, timestamped visual observations, and a structured summary were
  returned in the canonical v1 result; and
- the Console, CLI callers, and Apply-one writer were exercised against the
  completed cached result.

The complete queue-driven Save-to-Mind E2E is **not accepted**. The disposable
queue fixture selected the capture but remained pending with selector status
`blocked` after resolving an existing no-focus partial cache entry. The queue
dispatcher does not carry the smoke-test focus or paid-frame budget, and an
uncached queue retry would default to eight paid frames. No such retry was
performed, so the three-frame authorization was preserved.

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

## 4. Save-to-Mind E2E

| Stage | Result | Evidence |
|---|---|---|
| Disposable capture | Pass | `/tmp/brain-video-save-to-mind-e2e/inbox/new/elephant-video-acceptance.md` |
| Async queue selection | Partial | Queue item selected; state remained `pending`, `selectorStatus=blocked` |
| Canonical queue dispatch | Not accepted | Existing no-focus partial job `video-analysis-9d83eba4f38c54eeb4b3` had 19 extracted frames, 0 paid frames, and `vision_disabled_by_runtime`; no paid retry was safe |
| Save-to-Mind caller on completed result | Pass | Cached successful job returned `asynchronous=true`, captions, three observations, and `persist_to_mind=true` preview state |
| Enriched artifact | Pass for disposable direct writer path; not queue-complete | `inbox/processed/video-analysis/video-analysis-d336a575f02416f6a221.md` under `/tmp/brain-video-save-to-mind-reused-e2e/` |
| Original source traceability | Pass for direct writer path | Artifact preserves `inbox/new/elephant-video-acceptance.md` |
| Duplicate/recursion check | Pass for direct writer path | Cache reuse and Apply-one replay were idempotent; no failed artifact was created |
| Real Mind/production mutation | Not performed | Real Mind, production webhook, and shared services were untouched |

The direct cached Save-to-Mind caller plus writer proves the downstream
canonical result-to-artifact boundary without spending another paid frame.
It does not turn the blocked queue fixture into a completed queue E2E.

## 5. Writer safety

**Apply-one controls verified: yes, in the disposable Mind root.** The first
apply created exactly the canonical target and produced:

- exact target `inbox/processed/video-analysis/video-analysis-d336a575f02416f6a221.md`;
- source commit binding `e3ad0a8a`;
- matching preview/approval hashes and explicit operator approval with second
  confirmation;
- durable accepted-approval audit;
- post-write hash match;
- one-file/no-unapproved-path receipt;
- identity-bound rollback artifact; and
- preserved original capture reference and `review_required: true`.

The receipt is at
`/tmp/brain-video-save-to-mind-reused-receipts/video-preview-f271a07c26a8e04160f1.receipt.json`.
The subsequent identical Apply-one call returned `already_applied`.

## 6. Validation

Passed focused validation:

```text
./projects/brain-core/node_modules/.bin/tsx --test \
  projects/brain-core/src/tests/video-analysis-pipeline.test.ts \
  projects/brain-core/src/tests/mind-steward-inbox-queue.test.ts \
  projects/brain-core/src/tests/continuous-processing-service.test.ts \
  projects/brain-core/src/tests/continuous-processing-router.test.ts
  -> 46/46 passed

python3 -m unittest projects/brain-core/services/video-analyzer/test_analyze.py
  -> 10/10 passed

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
```

The canonical direct API route, Console history/result surface, both CLI
caller modes, schema validation, queue/dispatcher tests, writer tests, and
Bedrock vision admission were covered. The live n8n classifier/webhook was
not mutated or re-run in this video acceptance; its live evidence remains in
the two historical Save-to-Mind Bedrock audit reports.

## 7. Git and remaining blockers

- Branch: `feat/video-ingestion-envelope`
- Starting/current implementation checkpoint: `e3ad0a8a`
- Shared dirty `main` was not touched.
- Temporary selector, Core, Console, proxy processes, and dependency
  symlinks were removed from the isolated worktree.
- No production deployment or real Mind write occurred.

Remaining blocker: the async Save-to-Mind video dispatcher needs an explicit,
bounded way to carry the operator focus and paid-frame budget, or to reuse an
already-completed result by its full cache key. Until that is implemented and
separately accepted, the queue-driven video-to-Mind path remains partial.
