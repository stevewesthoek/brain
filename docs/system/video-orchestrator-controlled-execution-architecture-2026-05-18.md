# Video Orchestrator Controlled Execution Architecture

Date: 2026-05-18

This document defines the future controlled execution model as a design-only boundary. It does not enable execution.

## Scope

- First candidate story only.
- No batch execution.
- No platform publishing.
- No STB mutation.
- No decommission.
- No automatic retries.
- No background daemon.

## Execution boundary

- Future execution must be single-purpose.
- No broad shell runner.
- No arbitrary command input.
- No dynamic script paths.
- No user-provided shell text.
- Only explicit allowlisted future command wrappers.

## Approval model

- Approval request.
- Approval review.
- Approval execution.
- Audit record.
- Expiry.
- Rollback requirement.
- Operator identity if available.
- Evidence payload.

## Sandbox model

- Runtime-local only.
- No Mind writes.
- No repo source writes.
- No STB writes.
- No platform API writes.
- No credential access.
- No generated artifact writes until a separate artifact policy exists.

## Dry-run model

- Reads existing fixture and planning data.
- May produce in-memory report only.
- No file output.
- No rendering.
- No ffmpeg.
- No TTS.
- No image generation.
- No upload.

## Evidence model

- Input refs.
- Output summary.
- Validation summary.
- Blockers.
- Safety flags.
- No raw secret or log dumps.

## Failure model

- Blocked.
- Rejected.
- Expired.
- Failed preflight.
- Failed validation.
- Interrupted.
- No retry by default.

## Future implementation phases

- 5A architecture spec.
- 5B approval payload schema.
- 5C preflight validator.
- 5D execution-plan stub, still disabled.
- 5E approval-request-only endpoint.
- 5F execution remains disabled until explicit second approval.

## Non-negotiable safety

- No POST routes yet.
- No action registry entry yet.
- No allowlist entry yet.
- No execution plan yet.
- No file writes.
- No publishing.
- No STB decommission.

## Phase 5B approval payload schema

- Added as a read-only schema endpoint.
- No approval is created.
- No action registration is enabled.
- No execution is enabled.
- Next safe phase: Phase 5C preflight validator schema/design.
