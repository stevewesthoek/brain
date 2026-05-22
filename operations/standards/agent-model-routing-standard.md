# Agent Model Routing Standard

**Status:** Active  
**Scope:** AI Model Selector consumers and Brain Core route planning

## Purpose

Define the default routing policy for Brain:

1. Local AI first
2. Codex CLI second
3. Claude via Amazon Bedrock third

## Routing rules

- Prefer the cheapest capable local route.
- Prefer the M4 Pro before the M1 when both can do the task.
- Prefer the M1 for batch-friendly work when it is a good fit.
- Use Codex CLI when local AI is not good enough or the task benefits from the subscription-backed surface.
- Use Bedrock only when local AI and Codex CLI are unavailable, insufficient, or blocked.

## Explainability rules

- Every routing decision must include a rationale.
- Every escalation must include a reason.
- The consumer must log the provider, model, and estimated cost that were selected.

## Budget rules

- Budget state must be checked before expensive routing.
- The system may warn, throttle, or block expensive tiers.
- Blocking must be explicit and visible in Brain Console.

## Validation

- `brain-core` should expose a read-only routing summary surface.
- The selector should continue to own live provider selection.
- Brain Core may recommend routes, but it should not replace the selector.
