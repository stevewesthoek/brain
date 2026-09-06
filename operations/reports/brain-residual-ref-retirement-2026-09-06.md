# Brain Residual Ref Retirement — 2026-09-06

**Scope:** local and remote review branches whose content is already
represented on canonical `main`.

**Evidence base:** canonical `main` and `origin/main` at
`aa9dd0791f254c03c5984f8823c7976245432f67`; fresh ref/worktree inspection;
`git cherry main <branch>`; and GitHub metadata checks for pull requests and
workflow runs.

## Retirement decision

The following refs had no unique patch relative to `main` (`git cherry` showed
only patch-equivalent commits), no attached worktree, no pull request, and no
workflow run. Their dated reports remain in the repository as historical
evidence; the refs themselves are not required source or runtime dependencies.

| Ref | Unique patches | Patch-equivalent commits | Worktree | PR/workflow evidence | Decision |
|---|---:|---:|---|---|---|
| `codex/brain-console-2-command-center-vertical-slice` | 0 | 9 | none | none | retire |
| `codex/brain-console-2-phase0a-operational-foundation` | 0 | 7 | none | none | retire |
| `codex/brain-scheduler-obsolete-review-20260830` | 0 | 5 | none | none | retire |
| `codex/google-ads-review-20260830` | 0 | 1 | none | none | retire |
| `codex/infinite-brain-orchestrator-v2-phase6d-client-agnostic` | 0 | 8 | none | none | retire |
| `codex/infinite-brain-orchestrator-v2-phase7a-codex-code-default` | 0 | 3 | none | none | retire |
| `codex/infinite-brain-orchestrator-v2-phase7b-claude-code-code-canary` | 0 | 4 | none | none | retire |
| `codex/infinite-brain-orchestrator-v2-phase8a-research-canary` | 0 | 1 | none | none | retire |
| `codex/memory-context-review-20260830` | 0 | 1 | none | none | retire |
| `codex/n8n-backup-review-20260830` | 0 | 2 | none | none | retire |

Retirement is limited to these exact refs. No force-push is used, and no
unique commit, worktree, runtime checkout, backup branch, or dirty user-owned
work is removed by this decision.

## Retained refs

The following remain protected and are not part of this retirement:

- `codex/cloudflare-tooling-normalization` — dirty active worktree and unique
  residual commits;
- `codex/supabase-recovery-copy-automation` — unique recovery implementation
  and scheduler/path-coupling review required;
- `feature/video-orchestrator` — unique commit plus dirty worktree;
- `codex/brain-console-launcher` — unique launcher/infrastructure commit;
- `backup/brain-runtime-pre-live-deploy-2026-09-04` — unique recovery snapshot;
- detached `.codex` and `brain-runtime` worktrees — ownership/runtime checks
  remain open.

## Post-retirement verification

Retirement completed without force-push:

- six remote refs were deleted from `origin`;
- four local-only refs were deleted locally;
- all ten exact names are absent from both local and `origin` ref namespaces;
- no worktree was attached to any retired ref;
- local `main` and `origin/main` remain identical at
  `f69abba5d1c868ffc0c67c7af9c8d6fe2ee7474f`;
- the canonical integration worktree remains clean.

The retained refs and worktrees listed above remain the complete residual set
for the next reconciliation pass.
