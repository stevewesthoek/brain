# B8.4R — Cross-Repo Communication Artifacts

> **RECONCILIATION NOTICE (2026-08-01)**
>
> This artifact uses the historical label "B8.4R" from a preliminary,
> out-of-sequence P8 numbering scheme. That label has no equivalent in the
> current canonical plan's `B8.1–B8.6` task sequence. This document is
> historical evidence and cross-repo advisory material only.
>
> - **Historical label:** B8.4R (Governance and Cross-Repo Communication)
> - **Canonical equivalent:** no direct mapping; governance material is
>   preserved in `operations/specs/graphify-transition-governance.json`
> - **Status:** Advisory and evidence artifact; no current execution authority
> - **Canonical P8 accepted complete:** 0/6
> - **Further P8 execution:** intentionally deferred; requires separate authorization
> - **Authoritative task definitions:** `operations/specs/infinite-brain-runtime-implementation-plan.md`

**Date:** 2026-07-29
**Task:** B8.4R Task 5
**Authority:** Brain operations only
**Status:** Advisory artifacts prepared. No external repo changes executed.

---

## Communication Decision Per Repo

| Repo | Communication needed now? | Action |
|------|--------------------------|--------|
| Workbench Private | YES — advisory only | Ready-to-run notification prompt below (do not execute until B8.5A is approved) |
| ProChat | YES — advisory only | Ready-to-run notification prompt below (do not execute until B8.5A is approved) |
| Mind | YES — advisory only | Mind uses Graphify-derived cross-repository understanding. Ready-to-run informational advisory below (do not execute). |
| Connected repos (36) | NO — no immediate action | These repos have stale graphify-out but no CBM caches. Advisory can wait until global rollout is planned. |

---

## Advisory: All Repos

> **Graphify structural code indexes are stale and non-authoritative as of 2026-07-14.**
>
> - `graphify-out/` artifacts in your repo were last built on 2026-07-14 from a commit that is no longer HEAD.
> - These artifacts must NOT be treated as current architecture truth.
> - Exact-source (ripgrep, file reads) is the authoritative source for current code structure.
> - Codebase Memory MCP v0.9.0 is a Brain *candidate* only — it has not been globally activated and must not be assumed present or functional in any external repo context.
> - No local config, index, scheduler, or process changes are authorized in your repo until a separate approved task is issued.
> - Repository migration to any new structural-context provider requires its own approved Brain operations task.

---

## Workbench Private — Ready-to-Run Notification Prompt

**Target:** Next Workbench Private implementation session (B8.5)
**Delivery:** Include as session-start context when beginning B8.5 work

```text
--- Brain Advisory: B8.4R Communication (2026-07-29) ---

CONTEXT FOR THIS SESSION:

1. graphify-out/ in this repo is STALE (built 2026-07-14 from 80c5429c; HEAD is 3ba34097).
   Do not treat graphify-out/ as current architecture truth.

2. Codebase Memory MCP v0.9.0 is a Brain CANDIDATE (admission status: candidate).
   It completed a 23-fixture canary (91.3% adjusted correctness, all security gates clear).
   It is NOT globally active. It is NOT installed in this repo context.

3. graph-context.ts (handleGraphContext) remains the production structural-context adapter.
   CBM is proposed as a parallel implementation (cbm-graph-context.ts) behind a feature flag.
   The existing Graphify adapter must NOT be modified until the CBM adapter is verified.

4. No local changes to graphify-out/, CBM caches, schedulers, or indexes are authorized
   without an explicit Brain operations task.

5. The next implementation task is B8.5A (design spec, Brain-only) followed by B8.5
   (adapter implementation, Workbench Private). Neither is started yet.

ACTION REQUIRED: None. This is informational context for future implementation work.

--- End Advisory ---
```

---

## ProChat — Ready-to-Run Notification Prompt

**Target:** Next ProChat session that touches structural context
**Delivery:** Include as session-start context if structural-context work is planned

```text
--- Brain Advisory: B8.4R Communication (2026-07-29) ---

CONTEXT FOR THIS SESSION:

1. graphify-out/ in this repo is STALE (built 2026-07-14; HEAD is f37dc9c7).
   Do not treat graphify-out/ as current architecture truth.

2. Codebase Memory MCP v0.9.0 completed a canary against this repo (3150 nodes, 5640 edges).
   It is a Brain CANDIDATE only — not activated, not installed in this repo context.

3. No structural-context adapter exists in ProChat (unlike Workbench Private).
   ProChat uses graphify-out/ only if read directly by an agent session.
   No migration task is planned for ProChat at this time.

4. No local changes to graphify-out/, CBM caches, schedulers, or indexes are authorized
   without an explicit Brain operations task.

ACTION REQUIRED: None. This is informational context only.

--- End Advisory ---
```

---

## Mind — Ready-to-Run Notification Prompt

**Target:** Next Mind session where Graphify-derived context, cross-repository understanding, or structural policy is referenced
**Delivery:** Include as session-start context if Graphify or structural-context topics arise

**Rationale for advisory:** Mind uses Graphify-derived cross-repository understanding and policy context (via the `graphify-mind-knowledge` profile in `graphify-operational-profiles.json` and the `brain/mind` symlink). Although Mind is not a structural-code repository, agents operating in Mind may reference Graphify outputs for knowledge-graph context, and must know those outputs are frozen and non-authoritative.

```text
--- Brain Advisory: B8.4R Mind Communication (2026-07-29) ---

CONTEXT FOR THIS SESSION:

1. Graphify structural indexes are FROZEN and NON-AUTHORITATIVE as of 2026-07-14.
   The nightly scheduler has been quiesced at BS0.15 containment.
   No new graphify-out artifacts have been produced since that date.
   Existing graphify-out/ in any repo must NOT be treated as current truth.

2. Graphify semantic synthesis (LLM community labeling, semantic summaries) is
   RETAINED but INACTIVE. It is a distinct capability from structural code indexing.
   It is NOT replaced by Codebase Memory MCP. It may be separately reactivated
   under its own approved Brain operations task if the value justifies it.

3. Codebase Memory MCP v0.9.0 is a Brain CANDIDATE for structural code navigation
   only. It does NOT provide semantic synthesis, knowledge-graph context, or
   cross-repository understanding. It is NOT installed in or relevant to Mind.

4. Exact-source evidence (file reads, git log, ripgrep) remains the authoritative
   source for current state in all repos including Mind.

5. Mind must NOT independently:
   - Rebuild or reactivate Graphify (structural or semantic)
   - Delete graphify-out/ artifacts
   - Migrate to Codebase Memory or any new structural-context provider
   - Modify schedulers, indexes, caches, or Graphify configurations
   Any of these actions requires a separate approved Brain operations task.

ACTION REQUIRED: None. This is informational context only. No Mind files are changed.

--- End Advisory ---
```

---

## Connected Repos (36) — Decision

No immediate communication needed. These repos have stale `graphify-out/` but:
- None have CBM caches
- None have structural-context adapters
- None are scheduled for CBM migration in B8.5
- Advisory can be batch-delivered when global rollout is planned (post-B8.5 verification period)

---

## Delivery Rules

1. Do NOT execute these notification prompts in the current session.
2. Deliver Workbench Private advisory at the start of the B8.5 implementation session.
3. Deliver ProChat advisory only if structural-context work is planned for ProChat.
4. No repo changes, commits, or pushes are authorized by these advisories.
5. These are informational context — they do not grant implementation authority.
