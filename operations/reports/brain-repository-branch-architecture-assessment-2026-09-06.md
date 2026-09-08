# Brain Repository Branch, Worktree, Architecture, and Cleanup Assessment

**Date:** 2026-09-06  
**Housekeeping timestamp:** 2026-09-06 09:10:38 WEST  
**Scope:** inventory, source/test assessment, and the explicitly authorized
five-item local housekeeping tranche  
**Canonical comparison:** existing local `origin/main` at `b15e3beb` (2026-09-05)  
**Safety:** `origin` was refreshed. Only the five named, clean,
ancestry-merged, patch-equivalent worktrees and their corresponding local
branch refs were removed. No remote ref was deleted, and no reset, clean,
merge, commit, push, credential access, detached-worktree, backup-ref, active
worktree, or external mutation was performed.

## Executive assessment

The repository is functional and has strong safety/ownership principles, but
its Git/worktree lifecycle is carrying a large amount of historical state and
its status evidence is not fully synchronized with its validators. The highest
value next step is controlled consolidation, not another feature branch.

The current worktree is not a safe cleanup base: it contains the active Codex
MCP/Hooks-related work plus many unrelated in-progress changes. That worktree
and the dirty `feature/video-orchestrator` worktree were protected. The owner-
authorized cleanup was limited to five clean, already-integrated worktrees;
all five passed the final origin-main and process-idle checks and were retired.
No broader cleanup is implied.

## Inventory snapshots

The first scan for this report observed 44 worktrees. A later live
revalidation observed only 12 worktrees. The difference means cleanup or
worktree retirement occurred between observations; this assessment turn did
not perform that removal, and the exact actor/time is not established from
the repository metadata alone. The first table is retained as historical
evidence; the second table is the current baseline.

| Measure | Result |
| --- | ---: |
| Local branches | 56 |
| `origin` remote refs | 25 including the remote HEAD ref |
| Attached worktrees | 44 total |
| Branch-attached worktrees | 42 |
| Detached worktrees | 2 |
| Dirty worktrees | 2 |
| Total worktree disk usage | approximately 20.8 GiB |
| Current worktree usage | approximately 1.8 GiB |
| Git object store | approximately 1.0 GiB |
| Local `main` versus `origin/main` | 86 commits behind, no local commits ahead |

The remote-tracking view was refreshed with `git fetch origin` before the
authorized housekeeping. `origin/main` remained at
`b15e3beb6d63f67bb7ac9771fe21f93783efe227`; no remote deletion decision was
made or executed.

### Current live revalidation

| Measure | Current result |
| --- | ---: |
| Worktrees before authorized cleanup | 12 |
| Branch-attached worktrees before authorized cleanup | 10 |
| Detached worktrees | 2 |
| Dirty worktrees | 2 |
| Current total worktree disk usage before authorized cleanup | approximately 8.32 GiB (8,718,936 KiB) |
| Current branch-attached retirement candidates before cleanup | 5 clean merged worktrees |
| Current unique clean review candidates | 2 |
| Local branch refs before cleanup | 56 (46 were not attached to a worktree) |
| Local branches ancestor-merged into `origin/main` | 41 |
| Non-ancestor patch-equivalent local branches | 10 |
| Non-equivalent unique local branches | 5 (4 attached, 1 unattached backup) |

Before cleanup, the five attached, clean, ancestry-merged branches were
`codex/brain-scheduler-live-review`, `fix/save-to-mind-bedrock-haiku`,
`integrate/brain-scheduler-consolidation`, `integrate/n8n-backup-closeout`,
and `feat/brain-scheduler-consolidation`. The detached worktrees remain
separate provenance checks. The earlier 29-worktree retirement set is no
longer a live worktree set, although many of its local branch refs still
exist and remain subject to explicit branch-retirement review.

An exact-path `lsof` check reported no open files under any of the five
candidate worktrees immediately before removal. This was treated as idle-state
evidence, not a permanent ownership guarantee.

The repository’s durable source, documentation, and report files contain no
references to any of the eight reviewed candidate branch names outside this
assessment itself. This reduces the likelihood of a local operational
dependency, but it does not prove that an external pull request, CI job, or
human recovery procedure no longer uses a branch.

The five non-equivalent unique local branches are
`codex/cloudflare-tooling-normalization` (active dirty),
`feature/video-orchestrator` (active dirty),
`codex/supabase-recovery-copy-automation` (clean review),
`codex/brain-console-launcher` (clean review), and
`backup/brain-runtime-pre-live-deploy-2026-09-04` (unattached backup). The
remaining non-ancestor branches are patch-equivalent or already ancestry-
merged; they are not merge candidates, but branch deletion still requires
confirmation that no external review, recovery, or audit reference depends on
the ref.

Remote-tracking refs are present for `codex/brain-scheduler-live-review`,
`fix/save-to-mind-bedrock-haiku`, `feat/brain-scheduler-consolidation`,
`codex/brain-console-launcher`, and
`codex/supabase-recovery-copy-automation`; they are absent for the two
`integrate/*` cleanup candidates and the local-only backup branch. Remote
deletion is a separate operation and was not inferred from local cleanup.
Before the local ref deletion, `git fsck --full` reported no integrity
diagnostics.

### Authorized housekeeping result

The five explicitly authorized candidates were revalidated after the remote
refresh. Each was clean with all untracked files included, an ancestor of the
fresh `origin/main`, and patch-equivalent to `origin/main` (`git cherry`
reported zero `+` commits). Their exact worktree paths had no open files at the
point of removal. Each worktree was removed without `--force`; the
corresponding local ref was then deleted with an exact old-object-ID guard
because normal `git branch -d` correctly refused while local `main` remained
86 commits behind `origin/main`.

Removed worktrees and local refs:

| Local ref | Removed worktree |
| --- | --- |
| `codex/brain-scheduler-live-review` | `/Users/Office/.buildflow/worktrees/git_3499ef8374e280ac/codex_brain-scheduler-live-review` |
| `fix/save-to-mind-bedrock-haiku` | `/Users/Office/.buildflow/worktrees/git_3499ef8374e280ac/fix_save-to-mind-bedrock-haiku` |
| `integrate/brain-scheduler-consolidation` | `/Users/Office/.buildflow/worktrees/git_3499ef8374e280ac/integrate_brain-scheduler-consolidation` |
| `integrate/n8n-backup-closeout` | `/Users/Office/.buildflow/worktrees/git_3499ef8374e280ac/integrate_n8n-backup-closeout` |
| `feat/brain-scheduler-consolidation` | `/Users/Office/.config/workbench/brain-scheduler-consolidation` |

Post-cleanup state is 7 worktrees and 51 local branches. Worktree disk usage
fell from 8,718,936 KiB to 6,386,124 KiB, reclaiming 2,332,812 KiB
(approximately 2.22 GiB). The five target refs are absent, while all 25
remote-tracking refs remain. After ref deletion, `git fsck --full
--no-progress` exits successfully and reports 35 dangling blobs and 190
dangling trees, with no missing, broken, invalid, corrupt, or error diagnostics
and no dangling commits. These unreachable objects are expected Git garbage
after retiring historical checkout metadata; no pruning was performed.
The active Brain status fingerprint remained
`1ecc59267f26a55d97fa86c894fc1ef89ca3130b3a734a5c2888b19cb2cd18e3`; the
Video Orchestrator fingerprint remained
`1721e53272315d72e2a822799622767effc69689eed3e31c2339f24f7c0ddbab`; and the
protected backup ref remained at
`1883c66ec6b3e9863dd1ce6c327691e57ff832f5`. No detached worktree was changed.

Remaining worktree inventory:

| Path | State / branch | Role or recommendation |
| --- | --- | --- |
| `/Users/Office/Repos/stevewesthoek/brain` | dirty, `codex/cloudflare-tooling-normalization` | active MCP/Hooks/Identity & Access integration; protected |
| `/Users/Office/Repos/stevewesthoek/brain-video-orchestrator` | dirty, `feature/video-orchestrator` | active unique provider work; protected |
| `/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01` | clean, `main` | 86 commits behind `origin/main`; do not fast-forward during this Goal |
| `/Users/Office/Repos/stevewesthoek/brain-console-launcher` | clean, `codex/brain-console-launcher` | unique review branch; refresh/rebase required |
| `/Users/Office/.config/workbench/phase3x-supabase-recovery-copy-automation` | clean, `codex/supabase-recovery-copy-automation` | unique recovery automation; reconstruct cleanly on current `main` |
| `/Users/Office/.codex/worktrees/416e/brain` | clean, detached at `d55599da` | historical/ephemeral candidate; provenance review before any future removal |
| `/Users/Office/Repos/stevewesthoek/brain-runtime` | clean, detached at `9a5719e7` | runtime-owned/referenced path; preserve until ownership reconciliation |

## Protected work

These must not be removed or rewritten during cleanup:

- `/Users/Office/Repos/stevewesthoek/brain` — branch
  `codex/cloudflare-tooling-normalization`, 202 changed paths, six unique
  commits, and the active Codex MCP/Hooks/configuration work.
- `/Users/Office/Repos/stevewesthoek/brain-video-orchestrator` — branch
  `feature/video-orchestrator`, 70 changed paths and one unique committed
  change. It is dirty and has substantial unique provider work.

No branch is explicitly named `mcp` or `hooks`; the active MCP/Hooks work is
uncommitted in the current worktree, so branch names alone cannot identify it.

The current dirty worktree contains 202 changed paths. The largest domains
are identity/access (23), specifications (20), system configuration (15),
reports (14), runbooks (14), infrastructure catalog (11), Brain Core (9), and
runtime-profile tooling (9). This confirms that it is a multi-purpose active
integration tranche, not a safe base for broad cleanup or mechanical
refactoring.

## Branch and worktree classification

### Retirement candidates after confirmation

The five-item owner-authorized retirement tranche is complete. The remaining
historical refs and any patch-equivalent refs below were not deleted and need
separate retention decisions.

The initial scan found 29 clean worktrees whose branch tips were already
ancestors of `origin/main`. They contained no committed work that needed
merging. Their branches and attached checkout directories were candidates for
a two-step retirement: preserve an inventory/backup reference, remove the
worktree, then delete the local branch only after owner confirmation. The
current live revalidation shows that most of those worktrees have already been
removed; their local branch refs are still listed separately below.

The group is predominantly historical scheduler, orchestrator, Google Ads,
New Relic, n8n, video-ingestion, skill-pruning, and rollout evidence work. The
important distinction is that “merged” proves Git ancestry, not that the
worktree is unused; attached worktrees remain protected until their operational
purpose is confirmed.

The exact ancestry-merged branch set before the authorized cleanup was:

```text
codex/brain-scheduler-live-review
fix/save-to-mind-bedrock-haiku
integrate/brain-scheduler-consolidation
integrate/n8n-backup-closeout
feat/brain-scheduler-consolidation
codex/google-ads-closeout-20260830
main
codex/canonical-new-relic-observability
codex/infinite-brain-orchestrator-audit-2026-09-01
codex/infinite-brain-orchestrator-v2-phase1
codex/infinite-brain-orchestrator-v2-phase3
codex/infinite-brain-orchestrator-v2-phase4
codex/infinite-brain-orchestrator-v2-phase5
codex/infinite-brain-orchestrator-v2-phase5-audit
codex/infinite-brain-orchestrator-v2-phase5-cursor
codex/infinite-brain-orchestrator-v2-phase6a
codex/infinite-brain-orchestrator-v2-phase6b
codex/infinite-brain-orchestrator-v2-phase6c
codex/integrate-phase8a
codex/infinite-brain-orchestrator-v2-phase8b-research-readiness
codex/infinite-brain-orchestrator-v2-phase8b-integration
codex/infinite-brain-orchestrator-v2-phase8c-bible-authority
codex/infinite-brain-operational-rollout-wave1
codex/brain-scheduler-closeout
codex/brain-scheduler-docs
codex/brain-scheduler-preflight-repair
codex/shared-visual-runtime-claude-parity
maintenance/symlink-cleanup-sync-20260830
codex/wave3-remaining-consumers
```

The detached worktree at `/Users/Office/.codex/worktrees/416e/brain` is also
at an ancestry-merged commit, but it is intentionally excluded from this
branch list because it has no branch owner. It needs separate Codex-task
provenance checks before removal.

### Patch-equivalent clean branches

Nine clean branches are not ancestry-merged but `git cherry origin/main
<branch>` reports zero unique commits, meaning their changes are represented in
`origin/main` through equivalent patches. These are also retirement candidates
after verifying that their branch names do not represent a still-used review
checkpoint:

- `codex/brain-console-2-command-center-vertical-slice`
- `codex/brain-console-2-phase0a-operational-foundation`
- `codex/google-ads-review-20260830`
- `codex/memory-context-review-20260830`
- `codex/n8n-backup-review-20260830`
- `codex/infinite-brain-orchestrator-v2-phase6d-client-agnostic`
- `codex/infinite-brain-orchestrator-v2-phase7a-codex-code-default`
- `codex/infinite-brain-orchestrator-v2-phase7b-claude-code-code-canary`
- `codex/infinite-brain-orchestrator-v2-phase8a-research-canary`

Their checkout directories consume approximately 4.18 GiB in aggregate.

### Unique clean branches requiring review

Only two clean attached branches contain unique committed patches relative to
`origin/main` and remain under review:

- `codex/brain-console-launcher` — current tip
  `1b4667baacf3a76ab2b20769e05086a2a8fe52b3`, one unique commit, 11 changed
  files, and approximately 876 MiB checkout. Its focused canonical-telemetry
  tests passed (3/3), and the related catalog, health, consumer, and runtime
  tests passed in the prior bounded review. The current branch is 164 commits
  behind `origin/main`; five changed files overlap current `origin/main` and
  two evidence files are branch-only. The catalog validator still reports 22
  stale-provenance warnings. Recommendation: **refresh/rebase required**;
  selectively reapply the telemetry/evidence intent on current `main` rather
  than merging the stale branch unchanged. It is architecture-compatible in
  scope, but not merge-ready.
- `codex/supabase-recovery-copy-automation` — 12 unique commits, 14 changed
  files, including a 748-line recovery script and scheduler changes,
  approximately 786 MiB checkout. Its focused shell tests passed (9/9) and
  shell syntax passed. Its current tip is
  `cd70566db447ad2d83eab4606650a3f9b5ef0221`; all 12 commits remain unique
  relative to current `origin/main`. The typed scheduler manifest marks the
  job `mode: disabled`, while its new LaunchAgent declares `Disabled=false`.
  The plist executes from the preserved feature worktree rather than a
  canonical installed release path, and the repository scheduler inventory
  describes it as an independently enabled LaunchAgent. The negative
  `set -u` regression test intentionally emits the old failure to stderr but
  the suite passes 9/9; this is test evidence, not activation evidence.
  Recommendation: **reconstruct cleanly on current main** after choosing one
  scheduler authority, hardening the installation/release path, preserving
  rollback, and obtaining an explicit activation gate. Do not activate it.

### Unique dirty or special branches

- `codex/cloudflare-tooling-normalization` — active and dirty; preserve.
- `feature/video-orchestrator` — active/dirty and unique; preserve.
- `backup/brain-runtime-pre-live-deploy-2026-09-04` — one unique commit and
  no upstream; retain as a backup until the related runtime deployment is
  explicitly closed, then archive rather than merge.
- `codex/brain-scheduler-obsolete-review-20260830` — clean and not ancestry-
  merged, but patch-equivalent according to cherry comparison; retire only
  after confirming the evidence report is retained elsewhere.

### Detached worktrees

Two detached clean worktrees require provenance checks:

- `/Users/Office/.codex/worktrees/416e/brain` — approximately 340 MiB;
  detached at `d55599da1729089bcce000b3e4eac451efe28f50`, an ancestor of the
  current `origin/main`, with no unique commits. Its tip is
  `feat(video): migrate storage visibility to runtime report`; it appears to
  be an ephemeral historical Codex worktree and is reconstructable from
  current source, but provenance is not sufficient for deletion in this Goal.
- `/Users/Office/Repos/stevewesthoek/brain-runtime` — approximately 1.1 GiB;
  detached at `9a5719e731f16c4e88bb34720c1679f1e3276be9`, an ancestor of the current
  `origin/main`, with no unique commits. Its tip is
  `docs(brain-console): align final release identity`. The scheduler current-
  state runbook references this exact path as the deployed runtime, so it is a
  recoverable/runtime-owned checkout and must remain untouched until runtime
  ownership and installed symlinks are reconciled.

`git worktree prune --dry-run` reported no automatically prunable worktrees.
Detached does not mean obsolete.

### Exact duplicate branch tips

The following local branch pairs point at the same commit and can be reviewed
for consolidation after their worktree purposes are confirmed:

- `codex/infinite-brain-orchestrator-v2-phase8b-integration` and
  `codex/infinite-brain-orchestrator-v2-phase8b-research-readiness`
- `feat/video-to-mind-ingestion` and `fix/save-to-mind-bedrock-transport`
- `codex/brain-scheduler-video-storage-migration-20260830` and
  `maintenance/symlink-cleanup-sync-20260830`

## Disk-space findings

The largest reclaimable category remains duplicate checked-out worktrees, not
the Git object store. In the initial scan, clean ancestor-merged worktrees
consumed approximately 10.83 GiB and patch-equivalent clean worktrees
approximately 4.18 GiB. The current live set is approximately 8.32 GiB total:
the five clean merged retirement candidates consume approximately 2.22 GiB,
the two unique clean review candidates approximately 1.62 GiB, and the two
detached worktrees approximately 1.43 GiB. The two dirty protected worktrees
consume approximately 2.78 GiB.

The five authorized retirement candidates have now been removed. The remaining
seven worktrees consume 6,386,124 KiB (approximately 6.09 GiB): the two unique
clean review candidates, the two detached worktrees, the clean local `main`
worktree, and the two protected dirty worktrees.

The current worktree also contains sizable ignored/generated material:

- `projects/brain-console/node_modules`: approximately 419 MiB;
- `projects/brain-core/node_modules`: approximately 38 MiB;
- `projects/brain-console/.next` and `projects/brain-core/dist`: generated
  build output;
- `projects/video-orchestrator/cloud/jobs`: approximately 170 MiB of generated
  media/job artifacts;
- `operations/system-configs/codex/computer-use`: bundled application binaries;
- `tools/firecrawl`: approximately 49 MiB, apparently an intentional vendored
  tool subtree, not an automatic deletion candidate.

Ignored generated files include `.next`, runtime output, logs, `.DS_Store`, and
large job artifacts. They should be cleaned by project-specific commands or a
reviewed allowlist, never by broad `git clean` against this worktree.

The scan also found content that is tracked despite being generated or
runtime-oriented: 1,100 files under `projects/video-orchestrator/cloud/jobs`
(approximately 174 MB), compiled `projects/mind-steward/dist` output, and the
tracked `projects/brain-console/tsconfig.tsbuildinfo`. The video job tree may
contain useful evidence for the active Video Orchestrator work, so it must be
inventoried and moved to an owned artifact/archive location before any Git
removal. The 55.6 MB Computer Use bundle and 48 MB Firecrawl subtree appear
intentional vendored/runtime assets and are not automatic deletion candidates.

One dormant legacy helper, `operations/infrastructure/scripts/brain-bridge-stack.sh`,
still contains a port-based `kill -9` path and shell-style token export. It is
documented as unsupported and has no current callers, but it should either be
removed after proving no historical recovery dependency or hardened before
being permitted back into the supported operational surface.

## Documentation and contract alignment

### Strengths

The Infinite Brain philosophy and strategy are directionally strong and now
explicitly cover deterministic-first work, provenance, uncertainty, bounded
autonomy, one authoritative owner per mutable resource, discovery versus
admission, separate state custody, and account-agnostic adapters. The Brain-
side runtime ownership contract and Identity & Access model are directionally
consistent with those principles. The WebGPT boundary is not yet fully
separate in the installed vendor implementation and is therefore a material
architecture risk that must remain visible in this assessment.

### Codex ChatGPT Web boundary: confirmed coupling

The separate repository at `/Users/Office/Repos/vendors/codex-chatgpt-web` is
clean on its `main` branch, but its production integration is not completely
independent from native Codex. The source currently resolves the native
configuration through `CODEX_HOME` (defaulting to `~/.codex`), writes
`config.toml`, removes `models_cache.json`, and installs a managed
`[[hooks.Interrupt]]` hook plus corresponding `hooks.state` trust metadata.
It records a separate WebGPT journal, but that journal is an ownership record
for mutations to the native Codex config; it is not an isolation boundary.

This explains why “separate project” and “separate application state” are not
equivalent today. A WebGPT setup, reconnect, uninstall, or route change can
interact with native Codex configuration and hook-trust behavior. The vendor
source does provide a separate `CODEX_CHATGPT_WEB_HOME` for WebGPT-owned state
and an isolated DEV harness, and Brain already classifies the direct shared
route as legacy. However, the production fallback remains a shared-root
integration, and the WebGPT preflight shown in the inspected source does not
itself establish that the native Codex process is quiescent before writing its
config. This is a high-priority boundary finding, not a reason to modify the
vendor repository during this assessment.

The safe target architecture is one-way integration through an external
provider/route contract or a dedicated Codex home/profile owned by the WebGPT
application. Native Codex profile management must never rewrite the WebGPT
route, and WebGPT setup must never rewrite the native shared/default root
without an explicit cross-application maintenance contract and quiescence
handshake.

### Failure anatomy and hook/MCP relationship

The attached incident evidence identifies a stale thread-writer lock, an
app-server control socket, an IPC socket, a coordination lock, and temporary
state files after an unclean shutdown. The observed process check was not
enough to guarantee quiescence because the desktop application could respawn
Codex descendants after they were killed. Running a kill/repair sequence from
inside the active Codex session also necessarily risks disconnecting the very
process executing the work. This is a lifecycle/coordination failure, not an
OAuth failure.

The MCP symptoms have separate meanings: `codex_apps` returned an explicit
HTTP 401 `token_revoked`, while `stitch` timed out. The 401 requires a fresh
provider-owned login or token recovery; a config repair cannot revive a
revoked OAuth token. The timeout needs independent transport/startup
diagnosis. Hook re-trust prompts are plausibly related to configuration or
hook identity changes (especially the WebGPT-managed `hooks.Interrupt` entry),
but they are not evidence that OAuth was revoked. The two hook surfaces must
be mapped to their actual runtimes before either is consolidated or deleted.

The durable fix is a lifecycle protocol: stop the owning application through
its supported control surface, wait for descendants and sockets to disappear,
verify lock ownership/PID liveness, then perform profile-scoped repair from an
independent terminal. A repair tool must never kill its own parent session,
must distinguish a live lock from an orphaned sentinel, and must fail closed
when another application owns the resource.

### Multi-account and vault conclusion

The repository’s account-agnostic model is a sound direction, but “all OAuth
sessions always working” cannot be guaranteed by a vault. Providers may revoke
tokens, expire refresh tokens, require interactive reauthentication, or
invalidate sessions server-side. A safe vault can store references, metadata,
expiry/refresh deadlines, scopes, owner, and last validation result; it should
not continuously print or broadly probe secret values.

The target should be an account registry with one immutable account identity
per provider account, one isolated runtime root per account and application
surface, explicit profile selection, provider-supported refresh only, and a
health state of `healthy`, `expiring`, `reauth_required`, `revoked`, or
`unknown`. Automated refresh is allowed only where the provider’s supported
protocol makes it safe. Revoked or interactive credentials must produce a
notification and an operator-assisted recovery flow, never an attempted
credential copy or global logout/login.

OnePassword can be a human-facing secret vault, but it should not become the
runtime owner of Codex, WebGPT, MCP, or browser session state. Keychain or the
provider application should own refreshable application credentials; Brain
should own only non-secret account/profile metadata, health evidence, and
bounded recovery orchestration. This preserves separate upgradeability and
prevents a “central vault” from becoming a new global failure point.

### Confirmed gaps

1. `operations/runbooks/infinite-brain-roadmap-status.md` still reports
   `Last verified: 2026-08-22`, while the repository contains later August and
   September work. The live status page is therefore stale by its own contract.
2. `infinite-brain-philosophy.md` and `infinite-brain-strategy.md` still say
   `Last reviewed: 2026-07-10`; that is acceptable as a historical review date
   only if a current alignment review is recorded separately.
3. `node --test tools/validate-brain-document-consistency.test.mjs` fails 2 of
   39 tests even on an archive of `origin/main`. The tests expect candidate-
   installation wording that the status document does not contain. This is a
   validator/fixture contract defect, not proof that the current dirty MCP/Hooks
   changes caused it.
4. The current `npm run infinite-brain:conformance` still fails on a Workbench
   MCP revision and artifact-digest mismatch (`HEAD=006bd248...`, admitted
   revision `6eae80fc...`), plus runtime-provenance-version mismatch. This is
   an external Workbench admission/runtime drift and
   must be repaired or re-admitted with the Workbench owner; it should not be
   hidden by editing Brain status text.
5. The root `package.json` exposes 68 scripts but no single aggregate test or
   full repository health command. Coverage is broad but fragmented, which
   makes “green” status easy to overstate.
6. `.github/workflows/` contains only `warp-monthly-health-audit.yml`. Its
   quoted heredocs preserve literal shell substitutions in generated payloads
   and logs, and the workflow does not itself run the claimed health audit or
   send the described email. It is a trigger/logging stub, not a verified CI
   health gate.

## Code-quality and architecture assessment

The main architecture is expandable where contracts and adapters are used:
Brain/Mind separation, provider-neutral infrastructure contracts, runtime
profile adapters, bounded observers, and fail-closed action plans are good
foundations.

The main maintainability risks are:

- too many parallel historical branches/worktrees for a sequential roadmap;
- a large mixed dirty worktree that combines documentation, configuration,
  infrastructure, and runtime changes;
- duplicated generated/vendor/runtime content in the repository checkout;
- split validation entry points with no aggregate health gate;
- status/evidence documents updated independently of the validator contracts;
- very large domain files such as `projects/brain-core/src/types/api.ts`,
  `projects/brain-core/src/api/routes.ts`, and the video provider, which should
  be reviewed for stable domain boundaries rather than mechanically refactored;
- two distinct hook surfaces (`~/.codex/hooks.json` and config hook/trust
  state) whose ownership is not yet fully proven, so cleanup must remain a
  separate evidence-based task;
- the production WebGPT adapter still has a legacy path that mutates native
  Codex configuration and hook trust state; this is the clearest confirmed
  violation of the desired “separately upgradeable” boundary.

These are architectural review findings, not authorization to perform a broad
refactor in the active MCP/Hooks worktree.

### Prioritized risk register

| Priority | Finding | Evidence | Required direction |
| --- | --- | --- | --- |
| P0 | Native Codex and WebGPT production can share a mutable config surface | WebGPT source resolves `CODEX_HOME`, writes `config.toml`, removes the model cache, and adds hook trust state | Move to an external route contract or dedicated WebGPT Codex home; make shared-root integration exceptional and handshaken |
| P1 | Repair can race with a respawning desktop process | Incident evidence shows Codex descendants and sockets returning after the first process check | Use owner-controlled shutdown, exact-root leases, PID/liveness checks, stable observation, and an independent terminal |
| P1 | Global health can be overstated | Document-consistency tests fail on the canonical baseline; conformance fails on Workbench admission drift | Repair validator contracts and make one aggregate health command a required gate |
| P1 | Scheduler activation metadata contradicts itself | Supabase recovery manifest says disabled while its new LaunchAgent says `Disabled=false` and points to a feature worktree | Keep disabled until accepted; canonicalize install path and activation authority |
| P2 | Branch/worktree lifecycle is still expensive | 56 local refs and 12 current worktrees, including detached and historical state | Retire only confirmed-unused clean worktrees/refs, with an inventory and recovery window |
| P2 | Oversized domain modules increase change blast radius | `api.ts` is 11,572 lines and `routes.ts` is 5,904 lines | Split by stable domain boundaries only after dependency mapping and tests |
| P2 | Generated/runtime artifacts are committed into the repository | 1,100 tracked video-job files (~174 MB), compiled Mind Steward output, and a tracked TypeScript build-info file | Preserve evidence first, then move generated outputs to an explicit artifact/archive policy and untrack them |
| P2 | Dormant legacy helper has unsafe process/token handling | `brain-bridge-stack.sh` uses port-wide `kill -9` and unquoted environment export | Keep outside supported paths; remove or harden before reuse |

## Recommended cleanup sequence

1. Freeze the current MCP/Hooks worktree and record its exact purpose and
   changed-path manifest. Do not stage or rebase it during cleanup.
2. Refresh remote refs in a separately approved, idle maintenance session.
   Completed for this tranche; `origin/main` was verified at
   `b15e3beb6d63f67bb7ac9771fe21f93783efe227`.
3. Review the two unique clean merge candidates independently. Run their
   focused tests and compare their file-level patches with current `main`.
4. Fast-forward the clean local `main` worktree to the refreshed canonical
   `origin/main` only after confirming the remote baseline.
5. For each clean ancestor-merged or patch-equivalent worktree, confirm no
   active process/session owns it, preserve its branch/ref inventory, remove
   the worktree, verify disk recovery, then delete the local branch. Completed
   only for the five explicitly authorized candidates; the remaining refs still
   require separate owner confirmation.
6. Handle detached worktrees separately; remove only after provenance and
   active-task checks are clear.
7. Reclaim ignored build/runtime artifacts using a project-specific allowlist;
   retain source media and vendored binaries unless their ownership is resolved.
8. Repair the document-consistency test contract and Workbench MCP admission
   drift before claiming global conformance.
9. Add one aggregate local health command and a real pull-request CI gate that
   runs the contract, focused tests, syntax, security, and documentation checks.

## Decision boundary

The authorized five-item housekeeping tranche is complete and integrity checks
passed. No further branch or worktree deletion is authorized by this report.
The two unique clean branches should be reviewed for merge or reconstruction;
the detached worktrees, backup ref, remaining patch-equivalent refs, and other
historical refs require separate owner decisions. The active dirty worktrees
remain outside the cleanup set.

### Recommended next Goal

Create a read-only runtime-ownership and authentication-boundary Goal for
native Codex, Codex ChatGPT Web, MCP, Hooks, and account profiles. First map
each application’s state root, Keychain/OAuth owner, hook surface, and
quiescence contract; then define the dedicated-root/profile contract and
aggregate health gate. Do not begin with another live config repair or
credential migration until that ownership map is accepted.

## Requirement completion matrix

| Requested outcome | Current evidence | Assessment state |
| --- | --- | --- |
| Scan all branches and worktrees | 56 local refs before cleanup, 25 remote-tracking refs, 12 live worktrees before cleanup; ancestry, patch-equivalence, uniqueness, dirtiness, size, and process-open checks performed | Proven; post-cleanup state is 51 local refs and 7 worktrees |
| Identify active work | Current dirty MCP/Hooks worktree and dirty Video Orchestrator worktree protected; detached worktrees and backup ref isolated | Proven locally; external task/PR ownership remains outside Git evidence |
| Decide what can merge to `main` | Launcher has one unique commit but is 164 commits behind and overlaps current files; Supabase has 12 unique commits and scheduler/path contradictions | Launcher: refresh/rebase required. Supabase: reconstruct cleanly on current `main`. No merge performed |
| Decide what can be deleted | Five clean merged worktrees passed the authorized checks and were removed; remaining historical, detached, backup, and patch-equivalent refs require retention confirmation | Five-item tranche complete; no broader deletion approved |
| Reclaim disk safely | Worktrees fell from 8,718,936 KiB to 6,386,124 KiB; 2,332,812 KiB reclaimed; tracked generated video jobs are about 174 MB; generated/vendor content classified | Worktree savings verified; artifact retention/archive policy still required |
| Validate documentation | Cross-repo contract passes; document consistency is 37/39; roadmap/status and review dates are stale | Incomplete; validator/status contract needs repair |
| Align with Infinite Brain philosophy/strategy | Brain/Mind separation, provenance, ownership, bounded autonomy, and fail-closed patterns are present | Directionally aligned, with confirmed WebGPT/shared-root and lifecycle exceptions |
| Assess scalability and code quality | Oversized API modules, fragmented scripts/health gates, legacy unsafe helper, and tracked runtime outputs identified | Review findings recorded; broad refactor intentionally deferred until active work is isolated |
| Preserve active MCP/Hooks work | Current dirty worktree was not reset, staged, rebased, cleaned, merged, or deleted | Proven for this assessment turn |
| Preserve detached/runtime state | Both detached worktrees remain at their recorded HEADs; `brain-runtime` is referenced by scheduler runtime documentation | Proven; future provenance/ownership review required |
