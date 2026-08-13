# AI Model Selector — Architecture

**Document type:** Active architecture design
**Status:** Current
**Last updated:** 2026-08-13

## Purpose

The AI Model Selector is Brain's provider-selection service. It chooses among admitted execution surfaces according to capability, privacy, task metadata, availability, and policy.

It does not imply that every provider is always-on, and it must not resurrect retired local text runtimes through fallback logic.

## Current Managed Text Surfaces

### Primary — Claude via Amazon Bedrock

Provider ID:

```text
claude-bedrock
```

Bedrock-backed Claude is the default Brain-managed text surface. Brain's managed shell environment also configures Claude Code for Bedrock through `CLAUDE_CODE_USE_BEDROCK=1`.

Use Bedrock for general Brain text routing unless a task explicitly prefers another admitted surface.

### Secondary — Codex CLI

Provider ID:

```text
codex-cli
```

Codex CLI is the secondary managed text surface under the ChatGPT subscription. It is used when Bedrock is unavailable, when Codex is explicitly preferred, or where the task/runtime contract specifically targets Codex.

There is no direct OpenAI API dependency in this selector policy.

## Retired Local Text Surfaces

The following Brain-managed text routes are retired and must not be reintroduced without a new explicit owner decision:

```text
ollama-m4pro
ollama-m1
mtplx-m4pro
```

Consequences:

- no Brain-managed always-on Ollama text server;
- no MTPLX LaunchAgent/runtime as an admitted text surface;
- no Qwen/Aider coding launcher;
- no selector metadata that prefers Qwen/Gemma/Llama local text models;
- no Graphify default local text model.

Local model caches/apps may still physically exist until separately approved host cleanup occurs. Physical presence does not make them admitted Brain providers.

## Retained Local Media Surface

Whisper may remain available as an explicit media-transcription surface where an active workflow owns that requirement.

Retaining Whisper does not authorize a general-purpose local text LLM.

## Private Mind Policy

Private Mind classification tasks are allowed to use Bedrock, but they are **not** generic provider-fallback tasks.

Current contract:

```text
privacy_policy = private-bedrock-only
required_provider = claude-bedrock
preferred_model = us.anthropic.claude-sonnet-4-6
fallback_policy = none
```

Callers must mark requests private/sensitive and constrain both provider and model. If the selector returns Codex, another Bedrock model, or another provider, the caller fails closed before execution.

Private Mind data must not silently fall through to Codex merely because Bedrock is unavailable.

## Brain Core Routing

Brain Core exposes only these managed text route surfaces:

```text
claude-bedrock
codex-cli
```

Default ordering is Bedrock first, Codex second. Compatibility counters such as `localRouteCount` may remain in public summaries, but with no admitted local text route they must remain zero.

Fallback capability manifests must never manufacture Ollama/MTPLX providers when the selector itself is unavailable.

## Graphify Relationship

Graphify no longer depends on the AI Model Selector for a default semantic model.

Accepted B8.5 split:

```text
Codebase Memory MCP = structural navigation
exact current source = authority
Graphify = optional bounded semantic projection
```

Structural Graphify is frozen. Semantic Graphify is event-driven, Brain-only, non-authoritative, and has no default runner. A runner is supplied explicitly only when semantic regeneration is intentionally approved.

## Office / MacBook Topology

Network identity is independent from text-model routing.

Canonical fixed addresses:

```text
Office Mac mini
  Thunderbolt 192.168.2.1
  Tailscale   100.86.124.66

MacBook M1
  Thunderbolt 192.168.2.2
  Tailscale   100.70.12.18
```

DHCP Wi-Fi/LAN addresses are not canonical. Thunderbolt is preferred when directly connected; Tailscale is the stable fallback on Wi-Fi, mobile/5G, or another network underlay.

The MacBook is no longer treated as an always-on Ollama inference worker in selector architecture.

## Configuration Authority

Canonical provider/task configuration:

```text
operations/system-configs/model-selector/config/ai-providers.json
operations/system-configs/model-selector/config/ai-task-types.json
operations/system-configs/model-selector/config/ai-bedrock-models.json
```

Regression/policy validation:

```text
tools/validate-local-text-inference-policy.mjs
tools/validate-local-text-inference-policy.test.mjs
```

## Historical Architecture

Older Git history, dated runbooks, and decision-log entries describe Gemini-first, Ollama-first, MTPLX/Qwen, and dual-local-node experiments. Those are historical records, not current operating instructions.
