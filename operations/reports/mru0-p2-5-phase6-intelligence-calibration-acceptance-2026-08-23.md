# MRU0-P2.5 Phase 6 — Intelligence Calibration and Learning Signals Foundation

Status: COMPLETE / ACCEPTED

## Scope

This packet adds a deterministic, report-only calibration analysis over existing proposal, Decision Core outcome, prepared transaction, validation, and outcome evidence. It measures usefulness, explicit false positives, decision outcomes, validation outcomes, and confidence buckets without becoming an optimizer or learning authority.

The flow remains:

`Evidence → Measurement → Insight → Recommendation`

No measurement is promoted automatically into policy, routing, knowledge, or model training.

## Architecture compliance

- Existing proposal, Decision Core, transaction, validation, receipt, authority, and provenance references are reused.
- No learning database, second intelligence store, scoring authority, optimizer, or autonomous maintenance agent was created.
- Mind and Brain authority boundaries remain unchanged.
- Missing improvement evidence remains `unknown`; rejection is not automatically treated as a false positive.
- Explicit false-positive evidence is measured separately.
- Output is deterministic, rebuildable, and non-canonical.

## Implemented files

- `tools/context-learning/intelligence-calibration.mjs`
- `tools/context-learning/intelligence-calibration.test.mjs`

## Signals measured

Each signal preserves:

- proposal, decision, transaction, and validation linkage;
- evidence and rollback references;
- decision outcome;
- validation result;
- expected improvement outcome;
- explicit false-positive status;
- confidence and confidence bucket;
- usefulness classification;
- Mind-impact classification.

The report emits aggregate counts and calibration accuracy only where measured evidence exists. It reports `null` accuracy when the denominator is zero.

## Safety boundary

Every report includes:

- `learning_promotions=0`
- `canonical_updates=0`
- `writes_performed=0`
- `providers_called=0`

## Validation evidence

- `node --test tools/context-learning/intelligence-calibration.test.mjs` — 3/3 PASS
- Phase 0–5 focused context-learning suite — PASS
- Context-learning contract validation — PASS
- Context-learning regressions — PASS
- Context Broker validation and tests — PASS
- Documentation consistency — PASS
- Syntax validation — PASS
- `git diff --check` — PASS

Focused tests cover proposal/decision/transaction/validation linkage, accepted and rejected outcomes, deferred decisions, failed and unrun validation, explicit false positives, unknown improvement evidence, confidence tracking, deterministic output, input preservation, and fail-closed broken references.

## Explicit non-goals

No automatic learning promotion, model training, score-based authority, policy mutation, canonical update, provider call, execution, remediation, or autonomous maintenance is included.

## Remaining boundary

Future work may define a separately authorized human review process for recurring learning signals. This packet does not authorize changing thresholds, policies, models, or canonical Mind/Brain knowledge.
