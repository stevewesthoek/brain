# Agent Model Routing Standard

**Status:** Active  
**Scope:** AI Model Selector consumers and Brain Core route planning

## Purpose

Define the default routing policy for Brain:

1. Local AI first
2. Amazon Bedrock value portfolio second
3. Codex CLI third
4. Premium Claude via Bedrock only as a model-level fallback

## Routing rules

- Prefer the cheapest capable local route.
- Prefer the M4 Pro before the M1 when both can do the task.
- Prefer the M1 for batch-friendly work when it is a good fit.
- Keep manual terminal choices at the runtime level: Auto, Claude, Codex, Gemini.
- Manual `Auto` chooses a runtime, not a raw Bedrock model.
- Use the Bedrock value portfolio when local AI is not good enough and the task needs more reasoning than a cheap local/subscription route reliably provides.
- Prefer cheap capable Bedrock models before Sonnet or Opus.
- Use Codex CLI when the task benefits from the subscription-backed surface or the Bedrock value portfolio is unavailable, rate-limited, or failing.
- Use premium Claude through Bedrock only when cheaper Bedrock models are unavailable, insufficient, or blocked.
- Do not route to a Bedrock model until catalog visibility and account/region access have been validated or cached.

## Explainability rules

- Every routing decision must include a rationale.
- Every escalation must include a reason.
- The consumer must log the provider, model, region, estimated cost, and fallback reason that were selected.
- Model-level failures should be reported with the selected model ID so the selector can learn over time.

## Budget rules

- Budget state must be checked before expensive routing.
- The system may warn, throttle, or block expensive tiers.
- Blocking must be explicit and visible in Brain Console.

## Validation

- The selector exposes `POST /select` for routing and `GET /health/matrix` for provider/model health.
- Brain Core exposes `GET /ai-model-selector/health-matrix` as the read-only dashboard surface.
- Brain Console Center reads selector health through Brain Core.
- Consumers must not implement provider probes, model ranking, or fallback order outside the selector.
- Brain Core may display selector state, but it must not replace selector routing.
