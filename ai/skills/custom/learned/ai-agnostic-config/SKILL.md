---
name: ai-agnostic-config
description: Use when changing shared AI behavior, runtime adapters, hooks, settings, session lifecycle, memory rules, routing, or workflow conventions. Keep the shared Brain policy canonical and update only the affected Claude, Codex, Gemini, or IDE adapter references. Use the shared capability discovery route before creating new configuration.
---

# AI-Agnostic Config

## The insight

Claude and Codex are two engines in one unified system. Runtime adapters point
to shared Brain policies and source docs; they do not own duplicate policy
copies. When you teach the shared AI system something new, put the rule in the
canonical Brain policy or documentation and ensure each supported runtime
points to that source.

If an adapter is missing the shared reference, that runtime may not discover
the same capability. Validate the adapters and shared inventory together.

## When this applies

Any time you touch:
- `brain/CLAUDE.md` or `~/.claude/CLAUDE.md` — session lifecycle, workspace rules, memory policy
- `brain/operations/system-configs/claude/hooks/` — automation that changes session behavior
- `brain/ai/policy/routing.md` or `guardrails.md` — routing or safety rules
- Any skill that defines "how to work" rather than "how to use a tool"

Ask: *does this change how an AI should behave in a session?* If yes, both need it.

## The approach

Before closing a PR or committing a config change, check:

1. **What is the canonical shared source?** Prefer `ai/policy/`, a runbook, or a shared skill.
2. **Which runtime adapters are affected?** Check the relevant Claude/Codex/Gemini/IDE config.
3. **Do all adapters point to the same source and discovery query?** If not, patch the narrow missing reference.
4. **Does the onboarding validator pass?** Run `node tools/validate-agent-capability-onboarding.mjs`.

## The fix

Claude config lives at:
- `brain/operations/system-configs/claude/` (symlinked from `~/.claude`)
- `brain/CLAUDE.md` (repo-level instructions)
- `brain/ai/policy/routing.md` + `guardrails.md` (canonical shared policy)

Codex config lives at:
- `brain/operations/system-configs/codex/AGENTS.md` (symlinked as `~/.codex/AGENTS.md` inside the real local Codex runtime root)

The policy files (`routing.md`, `guardrails.md`, and `capability-discovery.md`)
are shared. That is the preferred pattern. Duplicate text only when a runtime
requires a small adapter-specific instruction, and keep it limited to routing
or invocation details.

## Skills should be AI-agnostic by default

When writing a new skill that defines a workflow or convention (not a tool wrapper):
- Write it so it works for both AIs
- If it's stored in `brain/ai/skills/`, it is available through the shared active/exported skill surface; agents use query-time discovery for dormant sources
- Tool-specific skills (Claude hooks, Codex review wrapper) are exceptions — they're inherently engine-specific

## Gotchas

- Claude has a Stop hook for auto-save; Codex does not. This asymmetry is acceptable — document it explicitly rather than trying to fake parity.
- AGENTS.md changes don't hot-reload; Codex picks them up on the next session start.
- The `.ai/current.md` format must stay identical between both AIs — it's the shared handoff file. Never add Claude-only or Codex-only fields to it.

## Context
Repo: brain  
Discovered: 2026-04-05  
Area: operations/system-configs/claude/ + operations/system-configs/codex/AGENTS.md
