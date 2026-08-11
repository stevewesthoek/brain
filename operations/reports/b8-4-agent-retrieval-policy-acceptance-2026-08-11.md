# B8.4 Agent retrieval and exact-source policy acceptance — 2026-08-11

## Decision

B8.4 is accepted. Brain now has one explicit retrieval hierarchy for agents and tools:

1. fresh Codebase Memory MCP for structural architecture/symbol/route/caller-callee/blast-radius navigation;
2. exact current source for authority;
3. bounded exact-source search/read when structural memory is stale, unavailable, or freshness is unknown.

Known-file and known-symbol work may go directly to exact source. Generated projections, including Graphify artifacts, remain navigation hints only.

Canonical contract: `operations/specs/b8-4-agent-retrieval-policy.json`.

## Authority gates

Exact source is required before:

- repository edits;
- security or policy decisions;
- provider/runtime claims;
- final factual claims.

CBM structural output cannot authorize writes or override roadmap/status/decision-log authority. Generated projections cannot replace source verification. Graphify is explicitly no longer Brain's structural default and remains frozen until B8.5 accepts a bounded semantic role.

## Freshness fallback

The retrieval planner treats only B8.3 state `fresh` as eligible for CBM-first structural navigation.

- fresh → CBM structural navigation, then exact-source read;
- stale → bounded exact-source search/read;
- unavailable → bounded exact-source search/read;
- unknown → fail safe as stale and use bounded exact source.

This fallback does not widen into a blind full-repository scan.

## Mandatory agent instructions

`AGENTS.md` now requires every Brain agent to follow this contract before broad structural exploration and cites the canonical B8.4 policy.

`docs/system/graphify-context-standard.md` now reports Graphify truthfully as a frozen non-authoritative projection pending B8.5. It no longer contains the obsolete instruction `For broad repo context, use Graphify first.`

## Instruction fixtures

`tools/lib/b8-4-retrieval-policy.test.mjs` verifies:

- policy invariants;
- fresh architecture query → CBM then exact source;
- stale caller/callee → bounded exact-source fallback;
- unavailable/unknown structural provider → bounded exact source;
- known source/canonical authority → direct exact source;
- generated projection → navigation then exact source;
- CBM/Graphify cannot authorize edits without exact source;
- mandatory `AGENTS.md` wording;
- Graphify standard no longer claims structural-default authority.

Result: `9/9 PASS`.

## Boundary

B8.4 does not enable Graphify generation, alter Graphify scheduler/runtime state, broaden CBM repository inventory, modify Mind/Workbench, or authorize any push. B8.5 may now replace the frozen Graphify legacy workflow with bounded event-driven semantic synthesis under this exact-source authority contract.
