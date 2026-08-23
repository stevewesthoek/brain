# Infinite Brain Universal Activation Gate Policy

**Status:** MRU0-P2.9 read-only activation readiness design
**Runtime status:** no client activation, configuration change, provider call, or execution is authorized

## Gate sequence

Activation readiness is evaluated in five bounded groups:

1. **Entry gate** — the Universal Brain Entry contract, compatible revision, and authority reference are available.
2. **Context gate** — bootstrap is bounded, freshness and conflicts are visible, progressive retrieval is explicit, and secrets remain untouched.
3. **Session gate** — session identity is bound to repository/worktree/branch, Brain revisions match, conflicts are absent, and confirmation is required.
4. **Client gate** — Claude, Codex, Workbench, and future agents remain consumer adapters with local runtime separation and reversible behavior.
5. **Rollback gate** — disable, unavailable-entry, and stale-context behavior are defined before any future activation decision.

All gates must pass for a result of `ready_for_separate_authorization`. That result is not authorization: this packet always emits `activation_authorized=false`.

## Fail-closed rules

Missing entry or authority, incompatible contract, stale/superseded/contradicted/unknown freshness, visible session conflicts, revision mismatch, or missing confirmation produces `blocked`. A blocked result must not resume, mutate, execute, or silently use stale context.

## Rollback model

Disable means stop consuming the entry and restore the prior client path. If the entry is unavailable, the client does not bootstrap from it and reports the unavailable state. If context becomes stale or conflicting, the client stops resume/mutation behavior and requires refresh or human review.

## Authority boundary

Mind remains authoritative for meaning, priorities, strategy, and personal/business context. Brain remains authoritative for AI-system knowledge, operational policy, validation, and bounded execution rules. Clients never become memory or decision authorities. Workbench execution authority remains separate from context consumption.

## Validation-only boundary

This policy and its evaluator are read-only design artifacts. They do not modify Claude, Codex, Workbench, or future-agent configuration; create hooks, stores, or databases; call providers; or activate automatic bootstrap.
