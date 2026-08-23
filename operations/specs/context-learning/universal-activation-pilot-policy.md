# Infinite Brain Controlled Activation Pilot Policy

**Status:** MRU0-P3.0 bounded pilot
**Pilot environment:** synthetic `future-agent` consumer profile
**Runtime boundary:** no Claude, Codex, or Workbench activation; no client configuration or external runtime mutation

## Pilot boundary

The pilot exercises one local provider-neutral path:

`Universal Entry → bounded consumption → client conformance → activation gates → audit metrics`

It does not invoke a client, provider, MCP server, model, network, write path, execution path, automatic session takeover, proposal workflow, or knowledge update.

## What is measured

The pilot records bounded bootstrap byte size, immediate and on-demand retrieval field counts, secret exclusion, freshness visibility, authority visibility, gate status, entry revision, conformance, and fail-closed state.

## Safety

Mind remains the authority for meaning, priorities, strategy, and personal/business context. Brain remains the authority for AI-system knowledge, operational policy, validation, and bounded execution rules. The pilot grants no authority to the synthetic consumer and never changes either authority domain.

## Disable and rollback

Disable by running the pilot with `enabled=false`. This performs no consumption. Because the pilot changes no external client state, rollback is immediate: stop invoking the pilot and restore the prior non-consuming path. Unavailable or stale entry state remains fail-closed.

## Acceptance boundary

Pilot completion does not authorize Claude, Codex, Workbench, or future-agent activation. Any real client activation requires a separate owner-authorized packet with independent runtime evidence and rollback approval.
