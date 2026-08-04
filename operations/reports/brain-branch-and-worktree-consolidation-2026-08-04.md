# Brain Branch and Worktree Consolidation — 2026-08-04

## Starting state

- **Main SHA:** `55461a3fe7a9491d9602060d2a3b80986d0f88c9`
- **Branch:** `integration/brain-final-consolidation-2026-08-04`
- **P0–P7:** complete
- **P8:** 0/6 accepted
- **M7.1 and M2.4:** closed and landed
- **Mind:** may proceed

## Branch audit

### feature/b8-1-benchmark-plan

| Field | Value |
|-------|-------|
| Ahead/behind | 4 ahead / 18 behind |
| Unique commits | 4 |
| Changed paths | 8 files (specs, tools, reports, tests) |
| Conflicts with main | None |
| Test coverage | 164 tests, 0 failures |
| **Classification** | **Port now** |

Commits ported:
- `ac75a72c` docs(b8.1): reconcile landed Brain pin and record blockers
- `ad316a88` docs(b8.1): record concurrent source drift
- `c5101a8f` docs(b8.1): record repeated clean-source blocker
- `2fd039a8` feat(b8.1): complete canonical benchmark plan

All B8.1 planning, manifest, validator, test, reconciliation-report, and dry-run-plan work is now on the consolidation branch. B8.1 remains incomplete — benchmark not executed, dry-run is not authorization, Graphify excluded/blocked, B8.2 unauthorized.

### codex/codex-home-managed-root

| Field | Value |
|-------|-------|
| Ahead/behind | 1 ahead / 81 behind |
| Unique commits | 1 (`40cf8935`) |
| Changed paths | 27 files |
| Conflicts with main | Heavy — base evolved significantly |
| **Classification** | **Superseded** |

The branch's single commit introduced an early version of `codex-home-managed-root.sh`, its test, and runbook. Main already contains a significantly evolved version (646 lines added vs branch version). All core functionality (script, test, runbook, decision-log entry) already landed on main via other routes. No porting needed.

### release/brain-stabilization-v1

| Field | Value |
|-------|-------|
| Ahead/behind | 1 ahead / 33 behind |
| Unique commits | 1 (`a97f4e80` — Mind Steward README refresh) |
| Changed paths | 1 file |
| Conflicts with main | None |
| **Classification** | **Port now** (README refresh) |

The Mind Steward README refresh accurately reflects current path registry, canonical boundaries, and dry-run-only defaults. Ported via cherry-pick.

### integration/brain-main-consolidation-2026-08-03

| Field | Value |
|-------|-------|
| Ahead/behind | 3 ahead / 27 behind |
| Unique commits | 1 (`a97f4e80` — same README refresh as above) |
| Changed paths | 1 file (same commit as stabilization branch) |
| Conflicts with main | None |
| **Classification** | **Superseded** (same content as release/brain-stabilization-v1, now ported) |

### feature/video-orchestrator

| Field | Value |
|-------|-------|
| Ahead/behind | 1 ahead / 145 behind |
| Unique commits | 1 (`ed884b9e`) |
| Changed paths | 3 files (provider + docs) |
| Conflicts with main | Likely heavy — 145 commits behind |
| Test coverage | Extensive VO test suite exists on main |
| **Classification** | **Retain as separate feature** |

The unique commit fixes approved-source-video mode in `finalizeAwsVideoPublishPackage`. This is a valid, specific bug fix (enables Sprint 1W live YouTube publication). However:
- Branch is 145 commits behind main
- Provider file has extensive parallel development on main
- Requires rebase, not merge
- Worktree has 70 dirty files (active development)

**Next task:** Rebase onto current main when video-orchestrator work resumes.

### codex/infinite-brain-roadmap-docs

| Field | Value |
|-------|-------|
| Ahead/behind | 1 ahead / 126 behind |
| Unique commits | 1 (`072e4a59`) |
| Changed paths | 16 files (rewrites major canonical documents) |
| Conflicts with main | Heavy — rewrites docs that evolved on main |
| **Classification** | **Superseded** |

All target files already exist on main in their current evolved form. The branch's single commit would downsize/rewrite documents that have since been updated through 126 commits of development. No salvageable content that isn't already on main.

### codex/codex-managed-config-ownership

| Field | Value |
|-------|-------|
| Ahead/behind | 0 ahead / 80 behind |
| Unique commits | 0 |
| **Classification** | **Superseded** (no unique work) |

### codex/local-inference-safety

| Field | Value |
|-------|-------|
| Ahead/behind | 0 ahead / 80 behind |
| Unique commits | 0 |
| **Classification** | **Superseded** (no unique work) |

### codex/mind-m7-m2-unblock

| Field | Value |
|-------|-------|
| Ahead/behind | 0 ahead / 0 behind |
| Unique commits | 0 |
| **Classification** | **Superseded** (identical to main) |

## Worktree status

| Worktree | Branch | Dirty | Classification |
|----------|--------|-------|----------------|
| `brain` (original) | release/brain-stabilization-v1 | 133 files | Dirty — do not remove |
| `brain-b8-1-plan` | feature/b8-1-benchmark-plan | Clean | Safe to remove after merge |
| `brain-codex-home-managed-root` | codex/codex-home-managed-root | Clean | Safe to remove (superseded) |
| `brain-codex-managed-config-ownership` | codex/codex-managed-config-ownership | 29 files | Dirty — do not remove |
| `brain-local-inference-safety` | codex/local-inference-safety | 45 files | Dirty — do not remove |
| `brain-main-consolidation-2026-08-03` | integration/brain-main-consolidation-2026-08-03 | Clean | Safe to remove (superseded) |
| `brain-main-integration-20260802` | integration/brain-stabilization-v1 | 1 file | Dirty — do not remove |
| `brain-mind-m7-m2-unblock` | codex/mind-m7-m2-unblock | Clean | Safe to remove (identical to main) |
| `brain-video-orchestrator` | feature/video-orchestrator | 70 files | Dirty — active feature, do not remove |
| `/private/tmp/codex-brain-infinite-brain-docs-*` | codex/infinite-brain-roadmap-docs | Not found (prunable) | Metadata-only, safe to prune |
| `.claude/worktrees/agent-*` (7 total) | worktree-agent-* branches | 1 locked, 6 dirty | Do not remove |

## Work ported to consolidation branch

1. **B8.1 planning work** — 4 commits cherry-picked (manifest, validators, tests, reconciliation report, dry-run plan)
2. **Mind Steward README refresh** — 1 commit cherry-picked (accurate path registry documentation)

## Validation results

| Test suite | Pass | Fail |
|---|---|---|
| validate-b8-1-benchmark-manifest.test.mjs | 38 | 0 |
| prepare-b8-1-context-memory-benchmark.test.mjs | 51 | 0 |
| validate-b8-1-benchmark-evidence.test.mjs | 36 | 0 |
| validate-brain-document-consistency.test.mjs | 39 | 0 |
| validate-brain-document-consistency.mjs (CLI) | pass | — |
| validate-mcp-provider-admissions.test.mjs | pass | 0 |
| validate-mcp-runtime-truth.test.mjs | pass | 0 |
| validate-graphify-operational-profiles.test.mjs | pass | 0 |
| validate-deletion-readiness.test.mjs | pass | 0 |
| mind-context (npm test) | 71 | 0 |
| git diff --check | clean | — |
| JSON parse (B8.1 files) | 4/4 | 0 |

## Safe cleanup candidates

### Worktrees safe to remove (clean + merged/superseded)
- `/Users/Office/Repos/stevewesthoek/brain-b8-1-plan`
- `/Users/Office/Repos/stevewesthoek/brain-codex-home-managed-root`
- `/Users/Office/Repos/stevewesthoek/brain-main-consolidation-2026-08-03`
- `/Users/Office/Repos/stevewesthoek/brain-mind-m7-m2-unblock`

### Worktree metadata safe to prune
- `/private/tmp/codex-brain-infinite-brain-docs-20260710` (directory not found)

### Local branches safe to delete after main merge
- `codex/codex-home-managed-root` (superseded)
- `codex/codex-managed-config-ownership` (no unique commits — but dirty worktree blocks)
- `codex/local-inference-safety` (no unique commits — but dirty worktree blocks)
- `codex/mind-m7-m2-unblock` (identical to main)
- `integration/brain-main-consolidation-2026-08-03` (superseded, clean worktree)

### Remote branches safe to delete after main merge
- `origin/codex/codex-home-managed-root`
- `origin/codex/mind-m7-m2-unblock`
- `origin/integration/brain-main-consolidation-2026-08-03`

### NOT safe to remove (blockers)
- `brain` worktree: 133 dirty files (original repo checkout with runtime state)
- `brain-codex-managed-config-ownership`: 29 dirty files
- `brain-local-inference-safety`: 45 dirty files
- `brain-main-integration-20260802`: 1 dirty file
- `brain-video-orchestrator`: 70 dirty files (active feature development)
- `.claude/worktrees/agent-*`: dirty or locked

## Branches retained

| Branch | Reason |
|--------|--------|
| `feature/video-orchestrator` | Active feature — valid fix, needs rebase |
| `release/brain-stabilization-v1` | Worktree dirty (original brain checkout) |

## Canonical roadmap state

- **P0–P7:** Complete
- **P8:** 0/6 accepted
- **B8.1:** Planning complete, benchmark NOT executed, dry-run is not authorization
- **B8.2:** Unauthorized
- **Graphify:** Excluded/blocked from B8.1
- **M7.1 and M2.4:** Closed and landed
- **Mind:** May proceed

## Next task

B8.1 authorization/execution preparation — the planning artifacts (manifest, dry-run plan, validators, evidence schema) are all in place. Execution requires explicit authorization and a clean-source guarantee.
