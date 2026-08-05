# Mind Context Provider — Brain Main Integration Report 2026-08-04

**Status:** pass — canonical Brain main, Mind pin advanced, Claude Code discovery registered
**Integration commit:** (see git log)
**Canonical Brain branch:** `main`
**Provider source lock:** `51e9091c7374e0642f4fe076b895c184152dd516`
**Previous Mind pin:** `08b2d1a7a4f7bc4b447350ee32be7b6da5e26b8e`
**Current Mind pin:** `2b59119dd119ecd965b66ce601db14cb32ca3852`
**Approval ID:** `M2.4-activation-2026-08-04-2b59119d-51e9091c`

## Starting state

- `integration/brain-stabilization-v1` was already an ancestor of `origin/main`
- All expected artifacts were present on `main`:
  - `projects/mind-context/src/core/gateway-commands.mjs`
  - `projects/mind-context/src/provider/runtime.mjs`
  - `projects/mind-context/src/provider/server.mjs`
  - `operations/reports/m2-4-context-gateway-activation-2026-08-04.md`
  - `operations/reports/m7-1-mind-contained-graphify-2026-08-04.md`
  - `operations/runbooks/mind-context-provider-activation.md`
  - `operations/specs/mcp-provider-admissions.json`
  - All other activation artifacts
- Claude Code had no MCP registration for `mind-context`
- Mind HEAD had advanced to `2b59119dd119ecd965b66ce601db14cb32ca3852`
- Admission still pinned old Mind HEAD `08b2d1a7a4f7bc4b447350ee32be7b6da5e26b8e`

## Phase 2 — Branch ancestry

`integration/brain-stabilization-v1` IS ancestor of `origin/main`. No merge needed. All activation evidence already present on canonical `main`.

The `origin/codex/mind-m7-m2-unblock` remote branch was pruned (absent from remote). Its content was already merged through `integration/brain-stabilization-v1 → main` path.

## Phase 4 — Mind pin advancement

Verified four Mind commits between `08b2d1a7...` and `2b59119dd1...`:

| Commit | Subject | Files changed | Verdict |
|---|---|---|---|
| `9c3937a` | docs(mind): finalize M2.4 and M7.1 evidence | 2 system docs | docs only |
| `eac53c4` | fix(mind): harden completed roadmap contracts | 2 system docs (path portability fix) | docs only |
| `2a2cb9c` | docs(mind): define post-closeout operational assurance | 1 new report | docs only |
| `2b59119` | eval(mind): record Context Gateway observation 001 | 1 new observation record | docs only |

None of the four commits: widen provider scope, grant mutation authority, change privacy boundaries, change provider code, change Graphify authority, introduce credentials, or alter Brain runtime configuration. Pin advancement to `2b59119dd119ecd965b66ce601db14cb32ca3852` is safe.

Updated files:
- `operations/specs/mcp-provider-admissions.json`: `MIND_CONTEXT_EXPECTED_HEAD` → `2b59119dd119ecd965b66ce601db14cb32ca3852`; evidence updated
- `operations/system-configs/mcp/mind-context/codex-config.template.toml`: same pin update
- `.codex/config.toml`: same pin update
- `/Users/Office/.brain/approvals/mind-context-read-only.json`: new approval ID, new `mindCommit`

## Phase 5 — Claude Code discovery

Created `.mcp.json` at Brain repo root registering `mind-context` as a project-scoped stdio server with the three admitted read-only tools and the new Mind pin.

Created `operations/system-configs/mcp/mind-context/claude-code-config.template.json` as the tracked template.

No secret values in any tracked file. No write tool registered.

## Phase 6 — Validation

- `npm --prefix projects/mind-context test`: **71 pass, 0 fail**
- Artifact SHA-256 verification: **all 8 source artifacts verified OK**
- `validate-graphify-operational-profiles`: **catalog=pass, profiles=2, result=pass**
- `git diff --check`: **no whitespace errors**

## Phase 7 — Live provider checks

Provider started with `MIND_CONTEXT_EXPECTED_HEAD=2b59119dd1...`.

| Check | Observed |
|---|---|
| Startup | success (MCP protocol 2025-06-18) |
| `fixtureOnly` | `false` |
| `healthy` | `true` |
| `activationState` | `active-local-approved` |
| Provider revision | `51e9091c7374e0642f4fe076b895c184152dd516` |
| Source HEAD | `2b59119dd119ecd965b66ce601db14cb32ca3852` |
| Expected HEAD | `2b59119dd119ecd965b66ce601db14cb32ca3852` |
| `headMatchesExpected` | `true` |
| Working changes in scope | `0` |
| Source count | 555 |
| Corpus SHA-256 | `b4547af0a7aaf8336a49a82b12c0936be7bb71cc613a8590b8352414c30788f0` |
| Indexing mode | `read-through-no-persistent-index` |
| `callerCanOverrideRoot` | `false` |
| `callerCanOverrideScopes` | `false` |
| `mutationPathExposed` | `false` |
| Tools | `mind_context_health`, `mind_context_resolve`, `mind_context_explain` (3 only) |
| `write_file` call | `tool_not_admitted` |
| Scopes argument | `forbidden_tool_argument:scopes` |
| Fallback | `manual-targeted-read`, `automaticFallback=false` |

Live resolve returned 5 sources with real SHA-256 values and provenance binding `providerRevision`, `sourceHead`, `corpusSha256`, `indexingMode`, and `indexedAt`.

## Phase 8 — Failure and recovery

| Check | Result |
|---|---|
| Core unavailable (`MIND_CONTEXT_CORE_DISABLED=1`) health | `healthy: false`, `coreAvailable: false`, fallback `manual-targeted-read` |
| Core unavailable resolve | `code: core_unavailable` |
| Automatic fallback | none — manual only |
| Approval-withheld startup | exit code 1, `ENOENT` (startup rejected before MCP) |
| Approval restored | `healthy: true`, `activationState: active-local-approved` |
| No lingering provider process | confirmed |
| No lingering Graphify process | confirmed |
| No preparation approval | confirmed |
| Approval file mode | `0600` |

## Graphify authority state

- `execution_authority: none`
- `recurring: false`
- Graphify profiles: 2 valid, no escalation

## Claude Code discovery state

`.mcp.json` created at Brain repo root. Claude Code will discover `mind-context` in the next session started from this project directory. Tools `mind_context_health`, `mind_context_resolve`, and `mind_context_explain` will be available. No write tool is registered.

## Observation 002 readiness

Mind may now perform operational observation 002 using the live provider. The provider is healthy, the pin is current, and Claude Code discovery is registered. The fallback remains manual targeted reads when the provider is unavailable.

---

## Re-validation run — 2026-08-04 (post-context-restore)

**Worktree:** `/Users/Office/Repos/stevewesthoek/brain-main-mind-integration-2026-08-04`
**Branch:** `integration/brain-main-mind-activation-2026-08-04`
**Brain main HEAD at validation:** `12560f403059f618cdaa6f2fa9151064675e9cfd`
**origin/main HEAD:** `12560f403059f618cdaa6f2fa9151064675e9cfd` (identical — already pushed)

This re-validation run was performed to confirm the integration evidence from the previous context window remains accurate after a session break. No new commits were required; the worktree was already clean and HEAD equaled origin/main.

| Check | Result |
|---|---|
| Worktree clean | yes — `nothing to commit` |
| HEAD = origin/main | yes — `12560f40` |
| Provider revision | `51e9091c7374e0642f4fe076b895c184152dd516` confirmed |
| Mind pin | `2b59119dd119ecd965b66ce601db14cb32ca3852` confirmed |
| Claude Code `.mcp.json` present | yes — 3 read-only tools registered |
| Integration report complete | yes — phases 1–8 documented |
| Observation 002 readiness | **confirmed** |

No additional push required. Integration was fast-forward. No force used. Evidence branches preserved.

---

## Addendum — 2026-08-04 (fix/mind-claude-local-discovery-20260804)

**Correction to "Observation 002 readiness" and "Claude Code discovery state" above.**

The integration report's Phase 5 created `.mcp.json` at the Brain repo root. That file registers
`mind-context` as a project-scoped server — but Claude Code only discovers it when a session is
started from a **Brain** cwd. A Mind-started Claude Code session does not load Brain's `.mcp.json`
and therefore could not discover the provider. The "Observation 002 readiness — confirmed" claim
was premature.

### Root cause

Claude Code project-scoped `.mcp.json` discovery is keyed to the cwd at session start. Brain's
`.mcp.json` only applies to Brain-started sessions. Mind `CLAUDE.md` forbids placing a `.mcp.json`
in the Mind repo. The `local` scope in `~/.claude.json` (keyed to the Mind project path) is the
correct mechanism — it was not configured at integration time.

### Fix applied (2026-08-04, Brain main commit)

Registered `mind-context` as a `local`-scope entry in `~/.claude.json` under
`.projects./Users/Office/Repos/stevewesthoek/mind.mcpServers` using `claude mcp add --scope local`
run from the Mind cwd. No file was created or modified in Mind.

Live verification from Mind (`echo "..." | claude --print --allowedTools mcp__mind-context__mind_context_health`):

| Check | Observed |
|---|---|
| Discovery | mind-context found in Mind-local Claude Code session |
| `healthy` | `true` |
| `readOnly` | `true` |
| `fixtureOnly` | `false` |
| `providerRevision` | `51e9091c7374e0642f4fe076b895c184152dd516` |
| `sourceHead` | `2b59119dd119ecd965b66ce601db14cb32ca3852` |
| `headMatchesExpected` | `true` |
| `workingChangesInScope` | `0` |
| Tools | `mind_context_health`, `mind_context_resolve`, `mind_context_explain` (3 only) |
| Mind files changed | none |
| `.mcp.json` in Mind | none |
| Lingering provider process | none |

**Observation 002 is now correctly unblocked.** The provider is discoverable from Mind-started
sessions, healthy, revision-matched, and HEAD-matched.

See `operations/runbooks/mind-context-provider-activation.md` §"Claude Code discovery — Brain-project
versus Mind-local" for the exact add/remove/restore/post-disable procedure.

---

## Addendum — 2026-08-05: Provider Repin to 076b9f97

The provider revisions above (`51e9091c`) are historical records of the initial
activation on 2026-08-04. On 2026-08-05 Steve Westhoek authorized a provider
repin advancing the active revision:

| Field | Value |
|-------|-------|
| Active provider revision | `076b9f97030e1c90bc66ffbb61d29456b41ed69f` |
| Mind pin | `a21f9ed5d7270ae7dd939b93c5df525c933091f8` |
| Activation commit | `723d58c4295e66e1bfaaace8a6303f03a0f5474a` |
| Approval ID | `M2.4-repin-2026-08-05-076b9f97` |
| Approval mode | `0600` |

**Retrieval controls added in 076b9f97:**

- `scopeSubset`: strict array validation (1–9, unique, no traversal)
- `authorityFilter`: `any` | `current` (canonical sources only)
- `freshnessFilter`: `any` | `fresh` (current lifecycle only)
- Generic metadata parsing: fenced YAML, bold-MD, H1-prologue skip
- Key normalization and lifecycle phrase expansion
- Authority derivation from lifecycle status

**Live health (2026-08-05):**

| Check | Result |
|-------|--------|
| `healthy` | `true` |
| `readOnly` | `true` |
| `fixtureOnly` | `false` |
| `headMatchesExpected` | `true` |
| `mutationPathExposed` | `false` |
| `providerRevision` | `076b9f97030e1c90bc66ffbb61d29456b41ed69f` |
| `sourceHead` | `a21f9ed5d7270ae7dd939b93c5df525c933091f8` |
| Tools | 3 read-only |
| `automaticFallback` | `false` |
| Corpus SHA-256 | `b605eaad9ec1e995788d0a731cda74a1a4d462825af33262f9d82b34c092764b` |

**Observation 003 handoff:** A representative system-scope resolve verified
structural correctness (both canonical sources, no forbidden June reports, no
non-system sources, real SHA-256 hashes, bounded budget). Mind may retry
Observation 003 using the exact CTX-CON-006 payload against the activated
provider. This addendum does not claim Observation 003 completion.

**Boundary field note:** The health response `boundary` field
(`project-scoped-read-only-activation-candidate`) is a static implementation
label describing the provider's fixed security boundary. It does not change with
activation state. The dynamic lifecycle state is `activationState`
(`active-local-approved`). No provider code change is required for this naming.
