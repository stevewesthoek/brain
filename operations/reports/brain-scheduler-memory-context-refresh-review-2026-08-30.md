# Brain Scheduler `memory-context-refresh` review

Date: 2026-08-30
Repository: Brain
Review scope: `memory-context-refresh` only; no scheduler category change

## Executive conclusion

**Final disposition: C. MANUAL / ON-DEMAND ONLY**

The legacy snapshot is not obsolete because the current Codex and Gemini global
instructions still explicitly tell those clients to read
`~/.brain/memory-context.md`. Claude's active hook path does not consume the
snapshot; it queries the underlying `~/.brain/memory/` store directly. The
snapshot therefore still has compatibility value, but it is not authoritative
context and its nightly producer is not safe or well-described enough to be an
active scheduler job.

Keep the scheduler job disabled. A future separately approved migration may
replace the Codex/Gemini snapshot instructions with bounded provider or
targeted-read behavior, then retire the materialized file after client
conformance is proved. This review does not perform that migration.

## Source identity and scope

- Review worktree: `/Users/Office/Repos/stevewesthoek/brain-memory-context-review`.
- Review branch: `codex/memory-context-review-20260830`.
- Starting accepted SHA: `c2288703c2235427d4d761e0f02c110d0db7c79c`.
- Current `origin/main`: `c2288703c2235427d4d761e0f02c110d0db7c79c`.
- Source drift from the accepted SHA: none.
- Shared Brain checkout, Mind checkout, and other dirty worktrees were left
  untouched.

The reviewed registry remains unchanged. In
`operations/specs/typed-scheduler-jobs.json:18`, the job is still
`lifecycle=disabled`, `mode=disabled`, `scheduleType=disabled`,
`reviewCategory=NEEDS REVIEW`, with the human action `Keep disabled; invoke
only after a separate derived-context review.`

## Historical purpose and implementation

`tools/scripts/memory-context-refresh.sh` was introduced in commit `b2fb0571`
on 2026-05-22. Its declared purpose is to create a compact passive session
bootstrap for clients without a prompt hook:

- Inputs: `BRAIN_MEMORY_DIR`, defaulting to `~/.brain/memory/`;
  `MEMORY.md` and `facts.jsonl` are read.
- Output: `MEMORY_CONTEXT_OUTPUT`, defaulting to
  `~/.brain/memory-context.md`.
- Ownership: the script is Brain infrastructure code; the input/output are
  machine-local files outside the Brain repository.
- Operation: count index entries, copy matching index lines, extract active
  fact fields, and overwrite the output with a markdown summary.
- Intended consumers: Codex and Gemini session startup instructions; spawned
  agents whose prompt explicitly includes the file.

The implementation has no source hash, authority marker, freshness contract,
atomic replacement, lock, or explicit owner-only output mode. It uses shell
text extraction rather than JSON parsing for `facts.jsonl`. The registry also
declares `outputArtifacts=[]` even though the script writes a real file outside
the repository. That mismatch is a direct reason not to activate it without a
new review.

## Legacy store and live metadata

The review inspected metadata only. No memory entry, fact, or snapshot content
was displayed.

| Path | Exists | Mode | Size | Modification time | Structural metadata |
|---|---:|---:|---:|---|---|
| `~/.brain/memory/MEMORY.md` | yes | `0644` | 218 bytes | 2026-05-25 16:45:18 Lisbon | 1 line |
| `~/.brain/memory/facts.jsonl` | yes | `0644` | 1,970 bytes | 2026-05-25 16:43:31 Lisbon | 12 lines |
| `~/.brain/memory-context.md` | yes | `0644` | 1,769 bytes | 2026-07-14 03:00:24 Lisbon | 47 lines |

The memory directory contained 7 markdown files and 9 regular files at the
time of the metadata check. The newest file in that directory had an mtime of
2026-05-25 16:45:18 Lisbon, so the snapshot is newer than the currently
observed input mtimes. That does not prove semantic correctness: the snapshot
is approximately 47 days old as of this review, has no source hash, and its
content was intentionally not read. The `0644` snapshot mode also makes a
future broad fact copy more exposed than an owner-only runtime artifact should
be.

The underlying shell tools are still installed through symlinks:

- `~/.local/bin/mem-search` → Brain `tools/scripts/mem-search.sh`
- `~/.local/bin/mem-facts` → Brain `tools/scripts/mem-facts.sh`
- `~/.local/bin/mem-write` → Brain `tools/scripts/mem-write.sh`

Those tools default to `~/.brain/memory/`. The memory skill itself contains an
outdated conflicting note naming a Claude project-memory directory as its
storage source, while the executable tools, hooks, and observed local files
use `~/.brain/memory/`. This is documentation drift, not evidence that the
legacy snapshot is authoritative.

## Reference and consumer audit

The exact snapshot reference occurs in four tracked Brain files:

| Reference | Classification | Finding |
|---|---|---|
| `tools/scripts/memory-context-refresh.sh` | active producer, currently quiesced | Writes the snapshot and embeds the legacy store's index/facts model. |
| `operations/system-configs/codex/AGENTS.md` | active client instruction | Explicitly requires the snapshot at Codex session start. |
| `operations/system-configs/gemini/GEMINI.md` | active client instruction | Explicitly requires the snapshot at Gemini session start. |
| `operations/runbooks/shared-memory-system.md` | legacy operational documentation | Describes the snapshot as live/nightly and the store as canonical; this conflicts with the newer authority model. |

The exact refresh reference occurs in four tracked files:

- `operations/specs/typed-scheduler-jobs.json`: registry inventory and
  disabled/NEEDS REVIEW state.
- `operations/runbooks/brain-scheduler.md`: disabled job table.
- `operations/runbooks/shared-memory-system.md`: historical wiring claim.
- `tools/scripts/memory-context-refresh.sh`: producer implementation.

The exact `~/.brain/memory/` reference occurs in the legacy memory/config docs,
the three executable memory tools, the Claude/Codex/Gemini system docs, and
the Infinite Brain architecture/roadmap/implementation-plan docs. Their
classification is:

- **Active store consumers:** `tools/scripts/mem-search.sh`,
  `tools/scripts/mem-facts.sh`, `tools/scripts/mem-write.sh`, Claude's
  `memory-recall-hook.sh`, and Claude's `inject-handoff.sh`.
- **Active but contradictory client instructions:**
  `operations/system-configs/claude/CLAUDE.md`,
  `operations/system-configs/codex/AGENTS.md`, and
  `operations/system-configs/gemini/GEMINI.md` still describe the shared store
  as canonical cross-AI memory; Codex and Gemini additionally require the
  snapshot.
- **Legacy documentation:** `operations/runbooks/shared-memory-system.md`,
  `operations/runbooks/memory-orchestrator.md`, and the shared-memory portions
  of `operations/AI-CONFIG-INDEX.md` describe the old shared-store model.
- **Current architecture/migration guidance:**
  `operations/specs/infinite-brain-context-learning-runtime-architecture.md`,
  `operations/specs/infinite-brain-context-learning-runtime-roadmap.md`, and
  `operations/specs/infinite-brain-context-learning-runtime-implementation-plan.md`
  treat the store as transitional derived hot recall, not independent Mind
  truth, and preserve history during a future classification/migration.
- **Boundary or pointer-only references:** `CLAUDE.md`,
  `docs/system/brain-agentic-os-strategy.md`,
  `operations/runbooks/context-compression.md`,
  `operations/runbooks/omp-optional-agent.md`, and
  `operations/runbooks/open-design-optional-design-surface.md`. These do not
  consume the snapshot.
- **No active consumer found:** no tracked Brain Core, Brain Console,
  Workbench, Cursor, or Kiro implementation reads the snapshot. The
  Antigravity pointer inherits the Gemini global instructions, so it inherits
  the legacy instruction if that global file is used.

No reference was classified as dead code solely because it is old: the
snapshot has real current client instructions and a present local artifact.
The scheduler invocation is quiesced, and the old monolith's refresh branch is
explicitly skipped, but the producer remains reachable as a direct manual
shell script.

## Current context source by client and subsystem

| Surface | Current context source | Uses legacy snapshot? |
|---|---|---|
| Codex | Active `~/.codex/AGENTS.md` plus Brain entrypoints; manual targeted Mind reads when needed. The active `~/.codex/config.toml` has no `mind-context` registration, although it has Workbench registration. | **YES**, by explicit startup instruction; no hard runtime dependency was found. |
| Claude | Active `UserPromptSubmit` hooks. `memory-recall-hook.sh` and `inject-handoff.sh` call the installed `mem-search`/`mem-facts` tools against `~/.brain/memory/`. A project-scoped `mind-context` registration exists for the Mind project in `~/.claude.json`. | **NO** for the active hook path. |
| Gemini | Active `~/.gemini/GEMINI.md` contains the snapshot instruction. Active Gemini config files contain Stitch configuration, not a Mind-context provider registration. | **YES**, by explicit startup instruction. |
| Antigravity | Brain's tracked setup says Antigravity uses the Gemini global instruction file; therefore it inherits Gemini's snapshot instruction when that integration is active. | **OPTIONAL / inherited**. |
| Cursor and Kiro | Lightweight Brain/Mind entrypoint pointers through the IDE context contract; no snapshot consumer found in tracked pointers. | **NO**. |
| Brain Core and Brain Console | Read-only scheduler/API/UI surfaces. Core `/infra/scheduler` reads the canonical registry; Console `/scheduler` renders it. Neither reads the memory snapshot. | **NO**. |
| Workbench | Separate active-local provider/consumer boundary; not the Mind Context Gateway and not a passive snapshot reader. No snapshot consumer found. | **NO**. |
| Other/future agents | No current tracked snapshot consumer identified; the documented fallback is Brain/Mind entrypoints and bounded targeted reads. | **UNKNOWN until client conformance is checked**. |

The underlying `~/.brain/memory/` store is therefore **PARTIAL / LEGACY** as
an authority classification: it remains the effective backing store for the
current `mem-*` tools and Claude hook compatibility, but it is not the current
canonical human-memory authority. Mind owns human meaning, identity,
preferences, strategy, and approved personal/business knowledge; Brain owns
AI capability and execution knowledge.

`~/.brain/memory-context.md` is **not authoritative**. For current Mind
context, the replacement model is Brain/Mind entrypoints plus a healthy/current
bounded `mind-context` provider, with manual targeted reads as the documented
fallback. The legacy snapshot has not yet been removed from all client
instructions, so replacement is incomplete operationally.

## Mind/provider relationship

The Mind agent-context authority documents specify:

1. Check `mind_context_health` when the client exposes the provider.
2. Use the provider only when it is healthy, current, read-only, and bounded.
3. Prefer cited `mind_context_resolve` results.
4. Fall back to the canonical Mind entrypoints and manual targeted reads when
   the provider is absent, unhealthy, stale, or unavailable.
5. Prefer current canonical pages over captures, generated reports, graphs, or
   model summaries.

The admitted `mind-context` provider is structurally safer than the legacy
snapshot: it fixes the Mind root and scopes, exposes three read-only tools,
rejects caller scope/root overrides and mutation-like requests, applies source
and response bounds, reports provenance/freshness, uses read-through without a
persistent index, excludes sensitive/generated/history classes, and exposes an
explicit manual targeted-read fallback. All ten admitted artifact hashes
matched the admission record.

Current runtime identity is not healthy enough to claim a live replacement:

- Admission expects Mind HEAD
  `c3dcefdd808501a7ead7ffc4671eb5ef3822c268`.
- The current Mind checkout is at
  `c2f7f65f98497521553e23bc58730e96552c7e56`.
- The current admitted-scope change count was zero, but the HEAD still does
  not match the configured expected identity.
- A metadata-only provider health startup check failed closed with
  `activation_approval_invalid`; no Mind content was retrieved.
- Admission records provider version `1.1.0`, while the reviewed package and
  runtime declare `1.0.0`. This is additional provider/admission drift to
  reconcile separately.

This provider state supports bounded targeted retrieval as the architectural
direction, but it does not authorize treating the provider as a currently
verified replacement for every client or every legacy memory function.

## Staleness, duplication, and privacy analysis

The snapshot can become stale or contradictory. It has only a generation
timestamp, no source commit/hash, no per-entry authority, no freshness class,
and no supersession metadata. A fact can remain in the materialized file after
its canonical Mind or Brain source has changed. The active startup docs also
create contradictory precedence: they call the legacy store canonical while
newer Mind architecture calls the store a transitional derived layer.

Risk ratings:

- Duplicate/staleness risk: **HIGH**. The file copies a full index and all
  active fact fields into a second location and does not expose source hashes
  or authority.
- Privacy/data-sprawl risk: **HIGH**. The script intentionally copies active
  facts into a broad, client-readable file; observed permissions are `0644` and
  the script does not tighten them.
- Token/context risk: **MEDIUM**. The intended 1–2k-token bootstrap is bounded
  in size by convention, not by a hard output budget; it loads context even
  when a task does not need it.
- Failure-integrity risk: **MEDIUM/HIGH**. Direct overwrite without a lock or
  atomic rename can leave a partial snapshot; brittle grep extraction can
  silently misrepresent escaped JSON values.

## `memory-context-refresh` versus `mind-compile-loop`

These jobs are not substitutes despite both historically being nightly:

| Job | Reads | Produces | Writes to Mind? | Role |
|---|---|---|---:|---|
| `memory-context-refresh` | Brain-local shared memory index and facts | Materialized `~/.brain/memory-context.md` | No Mind write, but does perform a local derived-file write | Session bootstrap snapshot for legacy Codex/Gemini consumers |
| `mind-compile-loop` | Mind `inbox/new/` frontmatter and content | Report-only classification proposals captured by the scheduler | No | Mind intake classification/reporting; it never moves or writes captures |

`mind-compile-loop` therefore does not replace session context retrieval and
does not replace the legacy snapshot. Conversely, the snapshot does not
classify Mind inbox items and does not provide canonical Mind retrieval.

## Scheduler and execution-path audit

`EXISTS`, `AUTOMATIC`, `ENABLED`, `REACHABLE`, and `CURRENTLY BLOCKED` below
describe the refresh job/path, not unrelated scheduler jobs.

| Path | Exists | Automatic | Enabled | Reachable | Currently blocked | Evidence |
|---|---:|---:|---:|---:|---:|---|
| A. Canonical Brain Scheduler | yes | no for this job | no | yes as registry/API inventory | yes | Current registry disables the job; the canonical runner short-circuits disabled lifecycles before spawning an entrypoint. |
| B. Old monolith | yes in the launched shared checkout | parent scheduler yes, refresh branch no | no | yes as legacy source; refresh is skipped in the main path | yes | `run_memory_context_refresh` remains in the shared checkout, but its main path logs `bs0-11-unsafe-quiesced`. It is not the current `origin/main` canonical runner. |
| C. Standalone memory LaunchAgent | no | no | no | no | yes, no admitted path | Only the generic `com.office.nightly-scheduler` LaunchAgent exists; no dedicated memory LaunchAgent was found. |
| D. Cron or shell startup | no | no | no | no | yes, no admitted path | No memory refresh reference was found in shell startup files or the user crontab. |
| E. Hooks | Claude hooks exist, but for direct store reads only | yes for Claude recall, no for refresh | yes for hook reads | yes for store reads, no for snapshot refresh | yes for this refresh job | Active hooks invoke `mem-search`/`mem-facts`; neither hook invokes `memory-context-refresh.sh` or reads the snapshot. |
| F. Manual/on-demand | yes: direct script exists | no | no | yes, if an operator explicitly invokes it | yes under this review and registry gate | The registry requires a separate derived-context review; this review did not invoke the script. |

Independent automation: no memory-specific cron or LaunchAgent was found. The
generic LaunchAgent is configured for 03:00 Europe/Lisbon with RunAtLoad, but
`launchctl` currently reports `com.office.nightly-scheduler` as not running.
The installed launchd command points at the shared dirty Brain checkout's old
monolith. That checkout is on `codex/cloudflare-tooling-normalization` at
`e7f807642ec76f7536e4a057b02713464dc7f9` and contains a fail-closed skip for
this memory job. No LaunchAgent or checkout was changed.

## Architecture options

| Option | Freshness | Authority clarity | Privacy | Token efficiency | Compatibility/complexity | Assessment |
|---|---|---|---|---|---|---|
| A. Keep nightly snapshot | Medium at best; stale between runs | Low | Poor | Fixed overhead | Broad compatibility, low implementation complexity | Reject for automatic activation. |
| B. Event-driven snapshot | Better if every source change emits an event | Still low unless it carries authority/provenance | Poor unless redaction/mode are redesigned | Better than nightly | More moving parts and missed-event failure modes | Not justified before client/source contract work. |
| C. On-demand derived context | High at request time | Medium; still requires explicit derived labeling | Better because access is task-driven | Good | Manual compatibility path with bounded operational cost | **Recommended interim disposition.** |
| D. Provider/targeted-read only | Highest when provider is healthy/current | High | Best | Best | Depends on client conformance and provider health | Preferred eventual session-retrieval direction, not yet a universal live replacement. |
| E. Safe Brain runtime report | Reports health/freshness without copying facts | High | Best | Tiny | Separate observability artifact | Useful future observability, but not a session context replacement. |

## Decision card

**Job:** `memory-context-refresh`

**Current category:** `NEEDS REVIEW`

**Mode:** `DISABLED`

**Runnable:** `NO`

**Original purpose:** Materialize a compact shared-memory index/facts snapshot
for passive Codex/Gemini startup context.

**Inputs:** `~/.brain/memory/MEMORY.md` and `~/.brain/memory/facts.jsonl`
(metadata only in this review).

**Output:** `~/.brain/memory-context.md`, a direct-overwrite markdown file.

**Last local output metadata:** exists; 1,769 bytes; 47 lines; mode `0644`;
mtime 2026-07-14 03:00:24 Lisbon; contents not displayed.

**Active consumers:** Codex and Gemini instructions explicitly name the file;
Claude hooks consume the underlying store instead; no Brain Core/Console or
Workbench snapshot consumer found.

**Current authoritative memory source:** Mind canonical pages for personal,
business, ministry, strategy, identity, and human decisions; Brain canonical
files for AI capability/operational knowledge. The legacy shared store is
partial/transitional derived recall, not independent Mind truth.

**Current retrieval mechanism:** healthy/current bounded `mind-context`
provider when available; otherwise Mind entrypoints and manual targeted reads.
The current provider identity/approval check is blocked, and active Codex does
not register it in its current config.

**Duplicate/staleness risk:** HIGH.

**Privacy/data-sprawl risk:** HIGH.

**Would anything break if never run again:** PARTIAL. Claude's hook path,
Mind provider/manual targeted reads, Brain Core, Console, and Workbench do not
depend on it. Codex/Gemini would lose their documented passive refresh path;
their underlying CLI access remains separately reachable, but the client docs
and provider conformance would need a later reconciliation.

**Old monolith:** The deployed LaunchAgent still points at the shared checkout
old monolith. That source retains a refresh function as historical inventory
but explicitly skips it with `bs0-11-unsafe-quiesced`. The canonical
`origin/main` scheduler source is now a registry-backed runner and does not
execute disabled jobs.

**Independent automation:** No memory-specific LaunchAgent, cron entry, shell
startup reference, or active process was found. Only the generic scheduler
LaunchAgent exists, and it is currently not running.

**Recommended disposition:** **C. MANUAL / ON-DEMAND ONLY**

**Why:** There are real legacy consumers, so `OBSOLETE` would be premature;
nightly automatic generation is unjustified because the snapshot is broad,
stale-prone, privacy-exposing, under-described in the registry, and not
authority-aware. Manual/on-demand retention preserves compatibility while a
separate client/provider migration can be evaluated.

**Future cleanup/migration scope:** Reconcile Codex/Gemini startup instructions
and actual registrations; decide the target split between Brain operational
knowledge, canonical Mind content, and derived hot recall; inventory and
classify existing legacy entries without deleting history; if a snapshot is
still needed, design bounded, provenance-bearing, owner-only, atomic output;
otherwise remove the file only after all consumers are migrated and verified.

**Operator decision required:** Should a later separately approved task
reconcile Codex/Gemini client conformance and migrate/retire the legacy
snapshot, while this job remains disabled in the meantime?

## Live Core and Console visibility

Read-only live checks on 2026-08-30:

- Brain Core `GET /infra/scheduler` returned HTTP 200, scheduler health
  `failed`, and 17 jobs. The `memory-context-refresh` row was present with
  `lifecycle=disabled`, `mode=disabled`, `reviewCategory=NEEDS REVIEW`,
  `scheduleType=disabled`, and `schedule=not scheduled`.
- Brain Console `http://127.0.0.1:4881/scheduler` rendered the same 17-job
  inventory and the memory row as `Disabled / NEEDS REVIEW / disabled`.
- The memory row had one button, its job-name detail selector. No Run, Enable,
  Activate, or other scheduler action control was present.
- No persistent Console supervisor, action button, or scheduler mutation was
  created.

## Safety and non-mutating proof

- `tools/scripts/memory-context-refresh.sh` was **not executed**, including no
  dry-run.
- `~/.brain/memory-context.md` was not regenerated or written.
- `~/.brain/memory/MEMORY.md` and `facts.jsonl` were inspected only with
  metadata/aggregate counts; no content or personal fact was displayed.
- No `mem-search`, `mem-facts`, or `mem-write` command was used against the
  live store.
- Mind was not modified; a metadata-only provider startup/health attempt failed
  closed at the approval gate, and no provider resolve/explain retrieval was
  performed.
- No registry, script, provider configuration, startup config, LaunchAgent,
  runtime state, or other checkout was modified.

## Git closeout

Expected change: this review report only.

The report is on the dedicated branch
`codex/memory-context-review-20260830`; the final delivery records its commit,
push, and clean-worktree state. No unrelated path is part of this review.

Memory context refresh review is complete; no memory data, context files, or
scheduler state were modified.
