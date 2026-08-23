# Codex Infinite Brain Activation Readiness Policy

**Status:** MRU0-P3.1 bounded Codex pilot readiness
**Runtime status:** read-only readiness only; Codex configuration, session authority, and automatic resume remain unchanged

## Boundary

Codex consumes the provider-neutral Universal Brain Entry Point as an adapter. Brain provides bounded navigation, authority boundaries, freshness, and session continuity references. Codex retains its own session lifecycle and runtime controls. Neither side becomes the other's memory authority.

## Readiness flow

`Codex session identity → Universal Entry → bounded consumption → Codex conformance → activation gates → continuation context`

The continuation context contains pointers, revision, freshness, authority boundaries, and an explicit next action. It does not contain full transcripts, copied Brain/Mind knowledge, model/provider settings, credentials, or execution permissions.

## Required Codex checks

- entry contract and Brain revision are available;
- bounded bootstrap and progressive retrieval are preserved;
- freshness and conflicts are visible;
- session identity binds repository, worktree, branch, and Brain revision;
- Codex remains a consumer only;
- confirmation remains required before mutation, execution, provider calls, or external effects;
- stale, conflicting, unavailable, or mismatched state fails closed.

## Activation state

`READY_NOT_ACTIVATED` means the read-only path is ready for a separate owner-authorized activation decision. It is not live Codex activation. No automatic resume or session takeover is permitted.

## Rollback

Disable Codex consumption and restore the prior Codex session path. The readiness module changes no Codex configuration, so rollback requires no configuration reversal. A stale or conflicting continuation is discarded for use and requires refresh/review.
