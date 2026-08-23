# MRU0-P3.18 Unified Intelligence Review Briefing — Acceptance

Status: implementation-complete / acceptance-pending validation

## Scope

This packet adds a deterministic briefing projection over the accepted MRU0-P3.17 unified review inbox. It groups existing evidence by explicit freshness, impact, uncertainty, and review-state signals so a human can see what requires attention.

## Operational result

The briefing exposes five bounded views: urgent review, important review, informational, deferred, and historical. Every item retains source provenance, confidence, uncertainty, freshness, Brain impact, Mind impact, `requires_human_decision`, supporting evidence, and the allowed human actions.

No human importance is inferred. The briefing is not a score, decision system, memory store, authority layer, scheduler, or execution path.

## Safety and compatibility

- `writes_to_mind=false`
- `writes_to_brain_canonical=false`
- `automatic_prioritization_of_human_meaning=false`
- `automatic_decisions=false`
- `automatic_promotion=false`
- `provider_calls=false`
- no new ingestion source
- no Mind mutation, Brain canonical mutation, scheduling, or execution

## Human use

Operators provide the existing unified inbox projection to `buildUnifiedIntelligenceBriefing`. They inspect the generated local JSON/Markdown briefing, follow its evidence references, and perform decisions only through the existing review/decision boundary. No action is applied by this projection.

## Limitations

The briefing cannot establish human importance, resolve conflicting authority, or replace Mind review. It does not discover new evidence, run providers, schedule itself, or persist canonical decisions.

## Acceptance evidence

Focused briefing tests cover deterministic grouping, provenance preservation, human-action visibility, no inferred importance, invariants, and runtime-local containment. Existing unified-review, ingestion-envelope, conversation-evidence, decision-boundary, review-projection, and validation regressions remain required gates.

## Next roadmap item

Continue with the next explicitly authorized review/maintenance milestone. Do not add autonomous prioritization or execution without a separate authority and acceptance gate.
