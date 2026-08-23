# MRU0-P3.21 Operational Daily Intelligence Loop — Acceptance

Status: accepted

## Operational result

Brain now has a bounded operator command that summarizes current review workflow state, accepted items, deferred items, promotion candidates, unresolved conflicts, and stale items. It provides deterministic human attention guidance with source, reason, evidence, confidence, freshness, uncertainty, impact, and available action.

## Activation

Run `node tools/scripts/mind-steward-daily-intelligence-loop.mjs` from the Brain repository root. The command reads only existing runtime-local P3.18–P3.20 artifacts and writes a daily-loop JSON/Markdown view under `runtime/local/mind-steward/daily-loop/`. It is not scheduled or automatic.

## Safety invariants

- `writes_to_mind=false`
- `writes_to_brain_canonical=false`
- `automatic_scheduling=false`
- `automatic_promotion=false`
- `provider_calls=false`
- `new_storage_authority=false`

## Validation evidence

Focused tests cover real-artifact loading, empty-state behavior without synthetic intelligence, deterministic summaries, provenance preservation, review/promotion state correctness, and runtime-local containment. The P3.17–P3.21 regression suite passes 40/40; documentation consistency and `git diff --check` pass.

## Limitations and next roadmap decision

The daily loop does not ingest new sources, resolve meaning or authority conflicts, execute decisions, schedule itself, or promote memory. The next roadmap decision should determine whether operator ergonomics or bounded transaction application is separately authorized.
