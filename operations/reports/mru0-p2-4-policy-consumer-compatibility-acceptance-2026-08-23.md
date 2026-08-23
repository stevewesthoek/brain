# MRU0-P2.4 Policy and Consumer Compatibility Migration Acceptance

**Packet:** MRU0-P2.4 — Policy and Consumer Compatibility Migration

**Date:** 2026-08-23

**Status:** Accepted with legacy selector authority preserved

## Classification

| Surface | Classification | Treatment |
|---|---|---|
| `ai-task-types.json` private Mind Sonnet references | A — required safety constraint | Preserved exactly |
| Mind Steward classifier approved Bedrock model | A — required safety constraint | Preserved exactly |
| `mind-maintenance-routing.ts` private model constraints | A — required safety constraint | Preserved exactly |
| Registry bindings and compatibility aliases | B — compatibility mapping | Used by the request resolver |
| Selector response model fields and adapter CLI flags | B — provider/adapter compatibility | Preserved at the adapter boundary |
| Generic routing policy model portfolio choices | C — stale policy ownership | Replaced with registry-backed profiles |
| Agent executor plan portfolio sentinel | C — stale consumer ownership | Removed; plan records provider intent only |
| Local-model and selector test fixtures | B — compatibility/test evidence | Preserved as fixtures, not routing policy |

## Compatibility behavior

The Brain Core selector request adapter now accepts legacy `provider_id`,
`model_id`, `preferred_model`, and model-list references. It resolves them by
registry model ID, provider binding, or compatibility alias before sending the
request to the selector.

- Exact existing concrete references resolve to the same provider binding.
- Retired, evaluated, deprecated, discovered, and unknown references reject.
- Ambiguous aliases reject unless provider constraints identify one entry.
- Explicit registry replacement metadata is followed only when the replacement
  itself is admitted.
- Requests without model-specific references remain unchanged.
- The selector remains the runtime candidate/selection authority.

Generic policy and executor-plan consumers now express capability/profile or
provider intent. They no longer choose a concrete model portfolio.

## Private Mind boundary

Unchanged and verified:

- `claude-bedrock` only;
- approved `us.anthropic.claude-sonnet-4-6` registry binding;
- `fallback_policy=none`;
- no local text routing;
- no provider expansion;
- no execution or remediation authority.

## Evidence

| Check | Result |
|---|---|
| Brain Core typecheck | PASS |
| Selector and consumer focused tests | PASS — 18/18 |
| Mind maintenance routing tests | PASS — 4/4 |
| Selector regression suite | PASS — 52/52 |
| Registry validator | PASS — 4 providers, 16 models |
| Registry validator tests | PASS — 3/3 |
| Local text safety policy | PASS |
| `git diff --check` | PASS |

No external provider calls were made.

## Remaining boundary

MRU0-P2.4 does not make the registry the sole runtime candidate authority. It
does not change admitted models, lifecycle rules, Claude settings, Codex
configuration, Workbench behavior, or Mind safety boundaries. A future packet
must separately authorize runtime candidate projection and removal of legacy
configuration reads.
