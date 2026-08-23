# Brain Core Runtime Identity Report

**Date:** 2026-08-23

## Runtime decision

`localhost:4877` is now assigned to the canonical `brain` repository on `main`, not the isolated `feature/video-orchestrator` runtime.

This is the correct local authority because Brain Console is configured for port 4877 and the current Brain Core projection layer exists on `main`. The Video Orchestrator worktree remains isolated and was not merged, copied, or edited.

## Runtime inventory

| Runtime | Repository/worktree | Branch | Revision | Port | Role |
|---|---|---|---|---:|---|
| Canonical local Brain Core | `/Users/Office/Repos/stevewesthoek/brain` | `main` | `bffcc63c77c9fb3d8f194f9c50c2b9b1fad80a07` | 4877 | authoritative local Brain API |
| Video Orchestrator Brain Core | `/Users/Office/Repos/stevewesthoek/brain-video-orchestrator` | `feature/video-orchestrator` | `ed884b9e4b0c824f0251599091eea956c9ddb839` | formerly 4877 | isolated feature runtime; not local authority |
| Brain Console | `/Users/Office/Repos/stevewesthoek/brain` | `main` | `bffcc63c` | 4881 | optional browser operations surface |

## Alignment performed

The supervised `com.office.brain-core` listener from the Video Orchestrator worktree was stopped through its user launch-service boundary. The existing main-worktree development runtime was then started with:

```bash
cd projects/brain-core
npm run dev
```

No branch, feature file, API source, or configuration was modified. The feature worktree was inspected only and remains separate.

## Validation

Brain Core from `main` returned HTTP 200 for:

- `/status`
- `/health`
- `/infinite-brain/status`
- `/projections/health`
- `/projections/ingestion`
- `/projections/transactions`
- `/projections/receipts`

Brain Console returned HTTP 200 at `http://127.0.0.1:4881/`.

The following current-main projection routes timed out during this check:

- `/projections/evolution`
- `/projections/promotion`

This is a bounded implementation/runtime defect in those projection handlers, not an identity or ownership ambiguity. It is outside this alignment packet and remains the next technical repair target before Console projection integration.

## Rollback

To restore the previous feature runtime, an owner may reload its existing `com.office.brain-core` launch service from the feature worktree. That action is intentionally not performed here. Main and feature branches remain independently recoverable.

## Remaining limitations

- The feature worktree contains extensive pre-existing dirty/user-owned work; it was not cleaned or changed.
- Brain Console currently points to the correct port, but projection integration remains deferred.
- The main development runtime is local and foreground-managed, not a newly installed service.
