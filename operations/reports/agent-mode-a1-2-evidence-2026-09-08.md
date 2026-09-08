# Agent Mode A1.2 evidence — 2026-09-08

## Result

**A1.2 selection/evidence separation: PASS for the selector boundary.**
Bedrock model selection now reads only cached access evidence. It no longer
invokes `_bedrock_access_status()` or any AWS subprocess as an incidental part
of `select()`. Explicit health-matrix probing remains the separate operation
that may refresh access evidence, and live/billable use remains outside this
offline gate.

## Changes

- `_pick_bedrock_model()` consults the cache only and documents the purity
  boundary in code.
- Test fixtures now seed cached evidence explicitly rather than monkeypatching
  a live probe into selection.
- A regression fixture makes the live probe raise if selection calls it.
- The exact MiniMax M2.5 → GLM-5 → Claude Opus 4.6 portfolio is represented in
  `config/agent-mode-model-portfolio.json` as `fixture-only`, non-selectable,
  and `live_enabled=false`.

## Validation

- Model-selector Python suite — 55 pass.
- Brain Core typecheck and focused Agent Mode/selector tests — pass.
- Agent Mode portfolio fixture test — pass.
- Registry and local-text policy validators — pass.

## Remaining gate

Before live Agent Mode, access evidence must be scoped to account/credential
identity, region, exact model/profile binding, and freshness, with explicit
authorization for any billable probe. K0 must provide the durable transactional
StateStore for effect journals, leases, budgets, outbox entries, and receipts.
