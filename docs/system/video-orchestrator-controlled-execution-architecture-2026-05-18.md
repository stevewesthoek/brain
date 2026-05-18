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
- 5G second-approval policy design.
- 5H operator identity verification protocol design.
- 5I role policy definition design.
- 5J first-approval authority policy design.
- 5K first-approval audit/expiry model design.

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

## Phase 5C preflight validator schema

- Added as a read-only schema endpoint.
- Validator cannot run.
- No approval is created.
- No action registration is enabled.
- No execution is enabled.
- Next safe phase: Phase 5D execution-plan stub, still disabled.

## Phase 5D execution-plan stub

- Added as a read-only disabled plan stub endpoint.
- No plan can run.
- No approval is created.
- No validator runs.
- No action registration.
- No file writes.
- No STB or Video execution.
- Next safe phase: Phase 5E approval-request-only endpoint design, still no execution.

## Phase 5E approval-request-only endpoint design

- Added as a read-only approval-request-only design endpoint.
- No approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes.
- Next safe phase: Phase 5F execution remains disabled until explicit second approval.

## Phase 5F execution-disabled gate

- Added as a read-only disabled gate endpoint.
- Execution remains disabled.
- Explicit second approval is required.
- No second approval policy exists yet.
- No approval creation.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: second-approval policy design, still read-only and no execution.

## Phase 5G second-approval policy design

- Added as a read-only policy design endpoint.
- Defines 10 required policy sections for future second approval mechanism.
- Sections: operator identity verification, approval scope narrowing, candidate lock, preflight evidence, runtime sandbox, rollback acceptance, dual-run comparison, artifact policy, STB protection, expiration/audit.
- No policy is created.
- No approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: Phase 5H operator identity verification protocol design, still read-only and no execution.

## Phase 5H operator identity verification protocol design

- Added as a read-only protocol design endpoint.
- Defines how operator identity would be verified before second approval is permitted.
- Requirements: operator identifier, role policy, local-only context, explicit confirmation, second approval authority, audit attribution, expiry window.
- Protocol cannot authenticate.
- No session is created.
- No operator is authenticated.
- No approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: Phase 5I role policy definition design, still read-only and no execution.

## Phase 5I role policy definition design

- Added as a read-only policy design endpoint.
- Defines future operator roles (viewer, developer, maintainer, admin) and privilege matrix.
- Privilege matrix defines capabilities: canView, canRequestApproval, canIssueFirstApproval, canIssueSecondApproval, canExecute, canPublish, canDecommission (all currently false).
- Policy cannot be enforced.
- No roles are assigned.
- No operator is authenticated or role-verified.
- No approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: role policy implementation (still read-only), or first-approval authority policy definition.


## Phase 5J first-approval authority policy design

- Added as a read-only authority policy design endpoint.
- Defines future first-approval authority requirements and eligible-role reasoning.
- First approval authority is not enabled.
- First approval creation is not enabled.
- First approval never permits execution, publishing, STB mutation, Mind writes, or decommissioning.
- Explicit second approval remains required before any future execution can be considered.
- No policy is created or accepted.
- No operator is authenticated or role-verified.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: first-approval audit/expiry model design, still read-only and no execution.

## Phase 5K first-approval audit/expiry model design

- Added as a read-only audit/expiry model endpoint.
- Defines future first-approval audit fields, expiry rules, and invalidation rules.
- No audit persistence is enabled.
- No expiry enforcement is enabled.
- No first approval is created.
- No approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: candidate/story lock design, still read-only and no execution.