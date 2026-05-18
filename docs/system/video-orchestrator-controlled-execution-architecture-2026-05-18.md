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
- 5L candidate/story lock design.
- 5M preflight evidence hash design.
- 5N operator decision snapshot design.
- 5O runtime sandbox boundary design.
- 5P approval review/audit design.
- 5Q immutable audit trail schema design.
- 5R audit compliance evidence packet design.
- 6A implementation readiness checkpoint.
- 6B feature flag rollout plan.
- 6C approval store implementation plan.

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

## Phase 5L candidate/story lock design

- Added as a read-only lock design endpoint.
- Defines future candidate/story lock fields (candidateStoryId, sourceEpisodeId, contentHash, planningHash, preflightEvidenceHash, lockedByOperatorId, lockedAt, expiresAt, invalidatedAt, invalidationReason).
- Defines lock rules (lock enforces immutability during approval window, cannot authorize execution/publishing/STB/Mind writes).
- Defines invalidation triggers (story changed, planning changed, preflight changed, operator/role policy changed, lock expired).
- No lock is created.
- No lock persistence is enabled.
- No lock enforcement is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: preflight evidence hash design, still read-only and no execution.

## Phase 5M preflight evidence hash design

- Added as a read-only hash design endpoint.
- Defines how future preflight evidence would be hashed: deterministic canonical JSON of schema versions only (approvalPayloadSchemaVersion, preflightValidatorSchemaVersion, planStubVersion, candidateStoryLockVersion, operatorDecisionSnapshotVersion, riskRegisterVersion).
- Defines hash rules (canonical JSON only, no real artifact reads, no file paths, no secrets, no execution output).
- Specifies hash invalidation triggers (any schema version change, any policy change).
- No hash is computed.
- No hash computation is enabled.
- No evidence persistence is enabled.
- No generated artifacts are read.
- No validator execution.
- No lock enforcement.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: operator decision snapshot design, still read-only and no execution.

## Phase 5N operator decision snapshot design

- Added as a read-only snapshot design endpoint.
- Defines how future operator decisions would be captured as immutable snapshots (decisionId, decisionType, candidateStoryId, operatorId, selectedValue, rationale, createdAt, expiresAt, invalidatedAt).
- Defines snapshot rules (read-only decision capture only, no queue mutation, no persistence, no approval creation, no execution).
- Specifies snapshot invalidation triggers (candidate/story/hash/risk/policy changes).
- No decision snapshot is persisted.
- No queue mutation is enabled.
- No snapshot persistence is enabled.
- No approval is created from snapshot.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: runtime sandbox boundary design, still read-only and no execution.

## Phase 5O runtime sandbox boundary design

- Added as a read-only sandbox boundary design endpoint.
- Defines how future execution runtime sandbox would be isolated: no real provisioning, no filesystem writes, no network calls, no STB/Video execution.
- Specifies required policies before sandbox execution (second approval policy, role policy, identity verification, candidate lock, evidence hash, rollback cleanup).
- Defines sandbox boundary rules (no filesystem access, no network access, no execution, no publishing, no Mind writes).
- No real sandbox provisioned or executed.
- No sandbox provisioning is enabled.
- No sandbox execution is enabled.
- No filesystem access is enabled.
- No network access is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: approval review/audit design, still read-only and no execution.

## Phase 5P approval review/audit design

- Added as a read-only review design endpoint.
- Defines how future approval reviews would capture operator decisions (reviewId, candidateStoryId, reviewerOperatorId, decision, rationale, timestamps).
- Defines review rules (read-only capture only, no approval creation, no execution authorization).
- Specifies review invalidation triggers (candidate/story/hash/risk/policy changes).
- No approval review is captured or persisted.
- No audit event is persisted.
- No approval creation is enabled from review.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: immutable audit trail schema design, still read-only and no execution.

## Phase 5Q immutable audit trail schema design

- Added as a read-only audit trail schema endpoint.
- Defines how future approval audit events would be captured as immutable, append-only records (eventId, eventType, candidateStoryId, operatorId, policyVersion, evidenceHash, previousRecordHash, recordHash).
- Defines event types (candidate_lock_reviewed, preflight_evidence_reviewed, first_approval_reviewed, second_approval_policy_reviewed, sandbox_boundary_reviewed, execution_denied, approval_expired, approval_invalidated).
- Specifies immutability rules (append-only design, no writes enabled, no persistence enabled, no hash computation over real files).
- No immutable audit trail is created or persisted.
- No append-only write is enabled.
- No immutable store is created.
- No audit trail persistence is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: audit compliance evidence packet design, still read-only and no execution.

## Phase 5R audit compliance evidence packet design

- Added as a read-only compliance packet design endpoint.
- Defines how future audit compliance evidence packets would be assembled: references to candidate lock, evidence hash, operator decisions, approval reviews, immutable audit trail, sandbox boundary, rollback checklist, risk register, policy boundary.
- Defines compliance rules (design-only packet, no packet generation, no evidence collection from files, no audit trail persistence).
- Specifies packet sections and compliance requirements (all schema-based, no real artifact reads).
- No compliance evidence packet is generated.
- No packet generation is enabled.
- No evidence collection is enabled.
- No audit trail persistence is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No validator execution.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Next safe phase: implementation readiness checkpoint, still read-only and no execution.

## Phase 6A implementation readiness checkpoint

- Added as a read-only implementation readiness checkpoint endpoint.
- Reports that all 18 design phases (5A–5R) are complete and verified.
- Identifies 12 required implementation plans (feature flags, approval store, approval creation, validators, locks, audit, sandbox, rollback, execution runner, operator UX, security review).
- Identifies 8 blocking requirements (no user approval, no approved frameworks/policies/implementations).
- Specifies that implementation planning is enabled but implementation execution remains disabled.
- No implementation is executed.
- No feature flags are enabled.
- No persistence is enabled.
- No approval creation is enabled.
- No validator execution is enabled.
- No sandbox provisioning is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Status: not-ready (blocked until implementation plans are approved).
- Next safe phase: Phase 6B feature flag rollout plan design, still read-only.

## Phase 6B feature flag rollout plan

- Added as a read-only feature flag rollout plan design endpoint.
- Defines 10 proposed feature flags (controlledExecution.enabled, approvalCreation.enabled, firstApproval.enabled, secondApproval.enabled, validatorExecution.enabled, candidateLockPersistence.enabled, auditPersistence.enabled, sandboxProvisioning.enabled, runner.enabled, consoleControls.enabled).
- Defines 10 rollout phases (design freeze, flag schema review, console visibility, dry-run phases for each subsystem, execution still blocked).
- Defines gating rules (all flags default false, no single flag enables execution, runner requires all plus explicit approval, publishing/decommission blocked separately).
- Identifies 6 blocking requirements (no approved frameworks/policies for flags/persistence/validator/sandbox/rollback/execution).
- No feature flag framework is enabled or implemented.
- No flag evaluation is enabled.
- No rollout execution is enabled.
- No persistence is enabled.
- No approval creation is enabled.
- No validator execution is enabled.
- No sandbox provisioning is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Status: not-ready (blocked until approval store plan is approved).
- Next safe phase: Phase 6C approval store implementation plan, still read-only.

## Phase 6C approval store implementation plan

- Added as a read-only approval store implementation plan design endpoint.
- Defines 15 proposed schema fields (approvalId, approvalType, candidateStoryId, sourceEpisodeId, operatorIdPlaceholder, operatorRolePlaceholder, approvalScopeHash, preflightEvidenceHash, policyVersion, status, createdAt, expiresAt, revokedAt, invalidatedAt, auditTrailRef).
- Defines 10 lifecycle states (draft_design_only, requested_not_persisted, first_approval_pending, first_approval_blocked, second_approval_pending, second_approval_blocked, expired, revoked, invalidated, execution_still_disabled).
- Defines 7 storage requirements (local-only policy, safe path policy, append-only audit link, expiry enforcement, revocation policy, corruption recovery, backup/restore).
- Identifies 7 blocking requirements (no approved persistence policy, safe path, expiry enforcement, revocation, audit link, recovery policies, no explicit approval).
- No approval store is implemented or enabled.
- No persistence is enabled.
- No approval creation is enabled.
- No expiry enforcement is enabled.
- No revocation is enabled.
- No audit linking is enabled.
- No approval is created.
- No first approval is created.
- No second approval is created.
- No action registration.
- No execution-plan execution.
- No STB or Video execution.
- No file writes, rendering, export, publishing, Mind writes, or decommissioning.
- Status: not-ready (blocked until first-approval creation plan is approved).
- Next safe phase: Phase 6D first-approval creation implementation plan, still read-only.