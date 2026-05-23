# Karpathy LLM Wiki Alignment Review — 2026-05-17

## Purpose

Assess the Brain + Mind + Obsidian + mind-steward roadmap against Andrej Karpathy's LLM Wiki pattern and record only the lean improvements that add value to this workflow.

## Conclusion

The current architecture is directionally solid and should not be redesigned. It already implements the most important Karpathy pattern:

```text
raw captures/sources -> compiled wiki/live surfaces -> Obsidian dashboard -> maintenance loops
```

The repo split is also correct:

```text
mind  = human cockpit, durable markdown memory, sources, compiled wiki
brain = execution boundary, mind-steward implementation, scheduler, API, tools
```

This is better for this workflow than putting all automation inside the Obsidian vault, because Brain can own runtime state, approvals, reports, tests, and execution safety while Mind remains a clean human-readable memory.

## Karpathy principles already present

- Persistent compiled wiki instead of query-time-only RAG.
- Raw capture/source layer separate from compiled wiki/live layer.
- Obsidian as the human cockpit / IDE for markdown memory.
- Model-router as the AI maintainer, not the user manually filing everything.
- Router schema/instructions through `router/`, `AGENTS.md`, and roadmap docs.
- Ingest, compile, memory, hygiene, and drift/error loops.
- Git-backed markdown history.
- Human remains in charge of source curation and high-risk decisions.

## Gaps found

### 1. Raw source immutability must be explicit

Karpathy treats raw sources as immutable source-of-truth material. The roadmap already has `sources/`, but the rule should be explicit:

- raw sources and original captures are never silently rewritten;
- compiled pages may be rewritten by approved mind-steward flows;
- every compiled claim should be traceable to source or capture context when useful.

### 2. Add an append-only wiki/activity log

The roadmap has `wiki/index.md` and `sources/index.md`, but not an explicit chronological log. Add a lean append-only log concept:

```text
wiki/log.md
```

Purpose:

- record ingests, compilations, lint passes, important queries, and accepted changes;
- make the system's evolution parseable and auditable;
- give future agents a compact timeline without reading git history or runtime logs.

This is not a runtime log. It is a human-readable knowledge-maintenance ledger in Mind.

### 3. Make lint/health gates first-class before mutation

The current hygiene/drift loops are directionally correct. Strengthen them before enabling Mind writes:

- contradiction checks;
- stale-claim checks;
- orphan-page checks;
- missing-link checks;
- missing-source-citation checks;
- oversized-file checks;
- unprocessed-capture checks;
- failed-capture retry checks.

### 4. Keep the dashboard black-box and sparse

Do not expose every internal mind-steward primitive to the user. The Obsidian dashboard should show only:

- what needs attention;
- what changed;
- what failed;
- what requires approval;
- where to continue.

The detailed preview artifacts, runtime JSON, approvals, and audit state stay in Brain and are surfaced only as summaries.

## Non-goals

Do not add heavy features just because they appear in public LLM Wiki examples:

- no mandatory vector database yet;
- no graph database yet;
- no complex ontology unless real use demands it;
- no Obsidian plugin sprawl;
- no automatic broad wiki rewriting;
- no deletion/archive automation without explicit plan.

## Roadmap adjustments recommended

Add these lean tasks before any broad Mind mutation:

1. Document source immutability and compiled-wiki ownership in Brain and Mind docs.
2. Add `wiki/log.md` to the target structure and maintenance contract.
3. Extend mind-steward dry-run reports with wiki health/lint findings before write/apply.
4. Add source-trace expectations for compiled wiki updates.
5. Keep the first apply action small: `router/current.md` only, then one compiled page type, then broader loops after validation.

## Verdict

The foundation is solid. The main correction is not a redesign; it is tightening the knowledge-management contract around immutable sources, append-only maintenance history, and lint-before-write discipline.
