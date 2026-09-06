# Brain Repository Mainline Reconciliation

**Date:** 2026-09-06
**Status:** in progress; evidence and attribution phase
**Canonical target:** one validated, clean `main` checkout and explicit
disposition for every branch, worktree, and changed path
**Safety boundary:** no live OAuth, Keychain, Codex, WebGPT, MCP, Hooks,
browser, scheduler, or runtime state was changed by this reconciliation.

## Starting state

This report records the start of the mainline-convergence Goal after the
completed branch/worktree housekeeping tranche. `origin` was freshly fetched
from the active Brain checkout at `2026-09-06 10:02:06 WEST`.

| Item | Starting evidence |
| --- | --- |
| Fresh `origin/main` | `b15e3beb6d63f67bb7ac9771fe21f93783efe227` |
| Local `main` before fast-forward | `5a386cfd4704302680d693c3e7685169f50c8ba4` |
| Local `main` after fast-forward | `b15e3beb6d63f67bb7ac9771fe21f93783efe227` |
| Active checkout | `/Users/Office/Repos/stevewesthoek/brain`, `codex/cloudflare-tooling-normalization`, `c21375f0765d9eafff0b28cfb7924fc43e0771fe` |
| Active Brain relation | 192 commits behind and 6 commits ahead of `origin/main` |
| Active Brain status | 93 tracked paths modified, 109 untracked paths, 0 staged; status fingerprint `1ecc59267f26a55d97fa86c894fc1ef89ca3130b3a734a5c2888b19cb2cd18e3` |
| Video checkout | `/Users/Office/Repos/stevewesthoek/brain-video-orchestrator`, `feature/video-orchestrator`, `ed884b9e4b0c824f0251599091eea956c9ddb839` |
| Video relation | 602 commits behind and 1 commit ahead of `origin/main` |
| Video status | 30 tracked paths modified, 40 untracked paths, 0 staged; status fingerprint `1721e53272315d72e2a822799622767effc69689eed3e31c2339f24f7c0ddbab` |
| Worktrees | 7 total: 5 attached, 2 detached |
| Local branches | 51 |
| Remote-tracking refs | 25 |

The clean `main` worktree at
`/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01` was
fast-forwarded with `git merge --ff-only` and remains clean. No dirty worktree
was reset, stashed, cleaned, rebased, switched, or staged wholesale.

## Recovery manifest and attribution

The active Brain and Video worktrees were fingerprinted before any
reconciliation mutation. Every path is assigned a provisional domain below;
the final commit map will refine ownership where a path crosses a contract
boundary. `unknown` is a holding label, not an acceptable final disposition.

### Active Brain checkout

| Domain | Paths / evidence | Initial disposition |
| --- | --- | --- |
| Identity & Access / Keychain | `operations/accounts/credentials-index.md`; `operations/fixtures/infrastructure-identity-access-*`; `operations/infrastructure/catalog/identity-access.v1.json`; `operations/specs/infinite-brain-credential-vault-strategy.md`; `operations/specs/infrastructure-codex-account-profile-capability.md`; `operations/specs/infrastructure-credential-health-runtime-v1.schema.json`; `operations/specs/infrastructure-identity-access-v1.schema.json`; `tools/infrastructure-identity-access/**`; `tools/validate-infrastructure-credential-health.mjs`; `tools/validate-infrastructure-identity-access.mjs` | Review for canonical source, tests, and secret boundary; commit only accepted non-secret implementation |
| Runtime profiles / Codex architecture | `operations/specs/infrastructure-codex-runtime-ownership-v1.md`; `tools/check-codex-auth-profile-isolation.*`; `tools/infrastructure-catalog/account-*`; `tools/infrastructure-catalog/codex-runtime-adapter.*`; `tools/infrastructure-catalog/local-runtime-observer.*`; `tools/runtime-profile-manager*`; `tools/observe-infrastructure.mjs` | Review and test; live state remains application-owned |
| Configuration ownership | `operations/architecture/**`; `operations/specs/workstation-config-ownership.json`; `tools/lib/configuration-ownership.*` | Review ownership model and atomic-write tests; no live root mutation |
| MCP | `operations/system-configs/mcp/**` changed/new paths | Review templates/docs only; do not mutate live MCP |
| Hooks / system config | `operations/system-configs/claude/**`; `operations/system-configs/codex/**`; `operations/system-configs/gemini/**`; `operations/system-configs/launchagents/com.office.brain-cli-access-health.plist` | Review ownership/provenance; preserve application-owned live state |
| Contracts / specifications | `operations/specs/**` | Validate JSON/schema and reconcile documentation state |
| Documentation / reports / runbooks | `00-*.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `ai/README.md`, `docs/**`, `operations/**.md`, `operations/reports/**`, `operations/runbooks/**`, `tools/README.md` | Separate canonical docs from historical reports; update only where current state is proven |
| Skills / capability discovery | `ai/skills/**`, `docs/skills/**`, `tools/discover-capabilities.*`, related onboarding docs | Review profile sync and capability registry consistency |
| Brain Core | `projects/brain-core/src/**` changed paths | Review tests/contracts; no unrelated video or generated output |
| Validators / scheduler / CLI tools | `tools/validate-*.mjs`, `tools/scripts/**`, `package.json` | Review bounded changes and test each logical tranche |
| Generated/runtime artifact | `projects/brain-console/tsconfig.tsbuildinfo`; `tools/firecrawl/logs/firecrawl.log` | Preserve current user state; decide policy separately; do not stage automatically |

The detailed path-level evidence was captured with
`git status --porcelain=v1 --untracked-files=all`; it showed no staged paths.
No secret values were read or copied. Before each commit, the relevant path
set will be rechecked for secret-bearing files and generated/runtime state.

### Video Orchestrator checkout

The Video checkout has 30 tracked modifications and 40 untracked paths, with
one unique committed provider change. Its provisional domains are:

- Brain Console video UI and tests;
- Brain Core video providers, control plane, publish-readiness, and tests;
- Video Orchestrator docs/contracts and provider scripts;
- local app/runtime inventory and LaunchAgent metadata;
- generated evidence reports and build output.

It remains protected until the path-level review distinguishes accepted source,
contracts, tests, documentation, runtime evidence, and generated artifacts.

## Integration guardrails

- No `git add -A` or `git add .`.
- No active-worktree reset, rebase, stash-as-primary-storage, clean, or branch
  switch.
- No live credential, OAuth, Keychain, browser, Codex, WebGPT, MCP, Hooks,
  scheduler, or runtime-state mutation.
- No merge of unique branches without a file-level disposition and focused
  validation.
- No generated artifact removal or untracking until its retention policy is
  explicit.
- No remote branch deletion or push until accepted commits are on `main`, the
  full validation matrix passes, and secret-sensitive review is clean.

## Progress log

The clean `main` worktree was fast-forwarded to
`b15e3beb6d63f67bb7ac9771fe21f93783efe227` and now contains these accepted
logical commits from the active integration branch:

1. `1076930a9b968f9139fa417e5b1f1bec89a1adaf` — operational evidence roadmap
   reconciliation;
2. `37002176b4e03dde4b7cb1e8e6e52145ae38880a` — managed-root preservation of
   app-owned runtime configuration, with its regression suite passing;
3. `6561e88de221e78b0b11a255b83be35305eff3f4` — durable runtime environment settings, with its regression
   suite passing;
4. `f554393627bc8ffe91d315c5c4bf92101dd6ea8e` — Mind-context revision reconciliation, with admission and
   closure tests passing;
5. `9983e59fe11f4ad655e5b274d33bd14b523af56a` — provider-agnostic Cloudflare API access, with its shell
   contract passing;
6. `c2ba2de4` (active) / `98181cf7a16ffa6d1b7a6b996e63444945e16083` (main) —
   account-agnostic Identity & Access foundation, with 33 focused tests and
   identity/credential/governance validators passing;
7. `147271a692a5677d1a85c4d6f13fd96295b51338` (active) /
   `6d94daeb4b0544e90a830f68e3cfd89753684124` (main) — catalog schema and
   consumer compatibility;
8. `0195fb1a4d336a304aabff6974853cbf89e3d315` (active) /
   `d260ec7b76679b9c979cb7732e461165c45e452e` (main) — governed runtime status exposure, with infrastructure
   consumer and plane tests passing.
9. `b853c96d...` (active) / `a981e681ac825d8a7e525d6acfb2ec3f7012f910` (main) — shared capability discovery and
   onboarding, with discovery/onboarding checks passing.
10. `727d138d...` (active) / `16823bf993e5f627db7d9d294fc03c9cf1892931` (main) — client/core capability route
    alignment, preserving the canonical service routes and MCP boundaries.
11. `9cedf61b...` (active) / `ef1542e2a918ffc54628d3b76737e5eb581e1c82` (main) — governance and quiescence gates,
    with action/observation and capability tests passing.
12. The active scheduler commit `5a34f870...` was not integrated wholesale. Its legacy scheduler inventory and
    runner conflicted with the current typed scheduler authority and would have created a second scheduler path.
    Only its contract-registry additions were admitted as `70737a05ed15f499d697c4c4715fdb2ebc6c5d66`; credential
    health remains dormant, read-only, and unactivated.
13. `04751847...` (active) / `8c7f2f0235da1ab7b41a9106182157f920cabf19` (main) — skill profile source resolution,
    with active sync dry-run/check passing.
14. `a22ec6a6...` (active) / `1e779b24b6913bad8b89626fd19e3eec2da0df31` (main) — account-agnostic profile pilot,
    with 28 focused tests passing and no-auth-copy/WebGPT-isolation checks retained.
15. `36c77710...` (active) / `8dd8c37e552a4f037076408bc84759bc2de05450` (main) — runtime ownership and MCP
    boundaries, with managed-root safety tests passing.
16. The Video branch commit `ed884b9e4b0c824f0251599091eea956c9ddb839` was not cherry-picked: it is a large,
    stale branch-relative change that bundles unrelated later work. Its approved-source-video intent was
    reconstructed on current main as `de5ac46a24b7ab70b38dcb5370ea97d0ee806887`, covering resolver, dry-run, and
    finalization paths with a focused regression test. Generated-media paths remain unchanged.

The active branch’s Workbench admission commit
`6f12bc8c...` was not integrated: its `6eae80fc...` provider pin conflicts
with the current Workbench repository at `d5cb218...` and its artifact hashes
are stale. It is superseded pending a fresh provider-admission review; no
Workbench runtime or external repository was modified.

## Planned disposition ledger

This ledger will be completed as reconciliation proceeds:

| Resource | Required disposition | Status |
| --- | --- | --- |
| Active Brain branch | Partition, validate, and commit accepted logical tranches; preserve or supersede the rest explicitly | Evidence captured; attribution in progress |
| Video Orchestrator branch | Integrate accepted source/contracts/docs/tests; exclude or govern generated output | Approved-source intent reconstructed on main; branch remains protected for dirty work |
| Brain Console launcher | Refresh/rebase or reconstruct on current `main`; do not preserve stale side line | Protected: current-main telemetry/evidence refresh required; stale Aug 30 “current health” claims not admitted |
| Supabase recovery automation | Reconstruct on current `main` only after disabled/canonical-path/rollback gates are repaired | Protected: 12 unique cutover commits not integrated; scheduling remains disabled |
| Backup branch | Preserve recovery provenance; do not merge snapshot noise | Protected pending unique-history review |
| Detached `.codex` worktree | Provenance review; remove only if no dependency remains | Preserved |
| Detached `brain-runtime` | Govern runtime deployment/reconcile ownership before removal | Preserved; runtime dependency suspected |
| Historical local branches | Classify and retire only after dependency checks | Pending |
| Remote feature branches | Classify after main integration and push; delete only proven obsolete refs | Pending |
| Generated artifacts | Define class-specific retention/ignore/release policy | Pending explicit policy |

## Completion record

To be filled only after final validation:

- commits created: main reconciliation tranches through `de5ac46a24b7ab70b38dcb5370ea97d0ee806887`; report commit pending;
- branches integrated/superseded/deleted: pending;
- worktrees removed/retained: pending;
- final local `main` SHA and `origin/main` SHA: pending;
- final cleanliness and secret scan: pending;
- residual exceptions and removal conditions: pending.
