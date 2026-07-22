---
name: ai-agnostic-config
description: When updating Claude Code config (CLAUDE.md, hooks, settings.json, session lifecycle, memory rules, routing, or workflow conventions), also update the Codex equivalent (AGENTS.md) to keep both AIs in sync. Trigger whenever touching brain/operations/system-configs/claude/, brain/CLAUDE.md, ~/.claude/CLAUDE.md, or ai/policy/. The two systems must stay unified — one way of working, two engines.
---

# AI-Agnostic Config

## The insight

Claude and Codex are two engines in one unified system. Claude reads `CLAUDE.md` and hooks; Codex reads `AGENTS.md`. When you teach Claude something new about how to work — a session lifecycle, a memory rule, a routing convention, a workflow — Codex doesn't automatically learn it. You must update both explicitly.

If you only update one, the system splits. The AI you're not currently using will behave differently, and sessions started in one won't resume cleanly in the other.

## When this applies

Any time you touch:
- `brain/CLAUDE.md` or `~/.claude/CLAUDE.md` — session lifecycle, workspace rules, memory policy
- `brain/operations/system-configs/claude/hooks/` — automation that changes session behavior
- `brain/ai/policy/routing.md` or `guardrails.md` — routing or safety rules
- Any skill that defines "how to work" rather than "how to use a tool"

Ask: *does this change how an AI should behave in a session?* If yes, both need it.

## The approach

Before closing a PR or committing a config change, check:

1. **What did I change in Claude's config?** (CLAUDE.md, hooks, routing, lifecycle)
2. **Does Codex have the equivalent?** Open `brain/operations/system-configs/codex/AGENTS.md`
3. **Is the same concept present?** If not, add it. If present but diverged, sync it.
4. **Is the format compatible?** Both AIs read the same `.ai/current.md` — keep the schema identical.

## The fix

Claude config lives at:
- `brain/operations/system-configs/claude/` (symlinked from `~/.claude`)
- `brain/CLAUDE.md` (repo-level instructions)
- `brain/ai/policy/routing.md` + `guardrails.md` (canonical shared policy)

Codex config lives at:
- `brain/operations/system-configs/codex/AGENTS.md` (symlinked as `~/.codex/AGENTS.md` inside the real local Codex runtime root)

The policy files (`routing.md`, `guardrails.md`) are already shared — both configs reference them. That's the right pattern. For anything that can't be shared as a file reference, it must be duplicated manually and kept in sync.

## Skills should be AI-agnostic by default

When writing a new skill that defines a workflow or convention (not a tool wrapper):
- Write it so it works for both AIs
- If it's stored in `brain/ai/skills/`, it's available to Claude via symlink — but Codex needs a path reference in AGENTS.md to use it
- Tool-specific skills (Claude hooks, Codex review wrapper) are exceptions — they're inherently engine-specific

## Gotchas

- Claude has a Stop hook for auto-save; Codex does not. This asymmetry is acceptable — document it explicitly rather than trying to fake parity.
- AGENTS.md changes don't hot-reload; Codex picks them up on the next session start.
- The `.ai/current.md` format must stay identical between both AIs — it's the shared handoff file. Never add Claude-only or Codex-only fields to it.

## Context
Repo: brain  
Discovered: 2026-04-05  
Area: operations/system-configs/claude/ + operations/system-configs/codex/AGENTS.md
