# AI Context Compression Standard

Brain context compression is explicit, reversible, and outside the model-routing path.

## Current Standard

1. Use `rtk` for noisy shell commands.
2. Use `brain-compress` for large JSON, logs, and text that may need exact retrieval.
3. Store reversible originals under `~/.brain/cache/compression/`.
4. Use `brain-learn-failures` to find recurring failure patterns; promote only high-signal patterns through `/learner` or repo docs.
5. Keep provider/model routing inside the AI Model Selector and routing policy.

## Live-Zone Rule

Any future compression layer that touches model request payloads must be live-zone only.

Allowed compression targets:

- latest tool output
- latest command/log output
- latest retrieved JSON or search result
- explicitly selected file content

Protected content:

- system prompts
- agent instructions
- old conversation turns
- tool definitions and schemas
- signed, encrypted, or redacted reasoning blocks
- provider cache-control regions
- API keys, cookies, tokens, credentials, and auth files

## Acceptance Gate

A compression change is acceptable only when it:

- reduces estimated tokens on the target content
- preserves or makes retrievable the exact original
- passes a needle check for important strings
- has no provider-routing side effects
- has no hidden telemetry or external service dependency
- is documented in the relevant runbook or tool help

## Default Posture

When in doubt, do not compress. Use raw output for small, security-sensitive, or correctness-critical content.
