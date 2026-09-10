# Agent Mode K1.2 Evidence — 2026-09-09

## Decision

K1.2 is complete for the offline deterministic policy gate. K1 is complete;
K2 remains planned and was not started. No AWS model call was made during K1.2.

## Policy

`projects/brain-core/src/agent-mode/model-tier-policy.ts` is the Brain-owned
Agent Mode authority. It uses no network selector and no live health probe.
The fixed ladder is MiniMax M2.5 (worker, 196K/8K) → GLM-5 (senior,
200K/128K) → Claude Opus 4.6 (principal, 1M/128K; preferred US profile
`us.anthropic.claude-opus-4-6-v1`).

The policy chooses the cheapest capable admitted tier, requires fresh verified
K1.1 evidence, denies unavailable/unknown/stale routes, and emits an auditable
budget reservation envelope. Provider failures do not escalate. Quality and
validation failures advance only worker → senior → principal, with no cycles.
All attempts, escalations, and children reuse the root `budgetScopeId`; the
existing K0 StateStore remains the atomic reserve/settle authority.

Codex is a separate resource with `available | constrained | exhausted |
unknown` states. Automatic admission requires fresh evidence, constrained
capacity preserves the manual reserve, exhausted/unknown denies, and a bounded
human override is explicit. Bedrock errors never fall back to Codex.

## Pricing

The single canonical policy table records current AWS US rates for MiniMax M2.5
($0.30 input / $1.20 output per 1M tokens) and GLM-5 ($1.00 / $3.20). The AWS
Opus 4.6 model card directs pricing to the Bedrock pricing page, but that page
currently exposes no usable Opus 4.6 token-rate row. Opus automatic dollar
admission therefore fails closed instead of using historical or invented rates.

Sources: [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) and
[AWS Claude Opus 4.6 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-6.html).

## Validation

- 26 K1.2 policy tests passed.
- 12 K1.1 gateway/portfolio/managed-provider tests passed.
- Brain Core TypeScript typecheck passed.
- No live AWS calls were made for K1.2.

## Residual warnings

- Verify and add a current Opus 4.6 token-rate record before enabling automatic
  principal dollar admission.
- The generic selector and legacy provider catalog remain compatibility-only;
  Agent Mode must enter through the fixed policy module.
- Live Jarvis/worker execution and Codex coding remain K2/K3 work.

## Next task

K2: one Jarvis plus one worker live vertical slice. Do not begin it here.
