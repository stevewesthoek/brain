# Operations

Operational docs, helper scripts, deployment notes, and selected synced system configs.

## Structure

- `automations/` — workflow exports and higher-level automations
- `deploy/` — real deployment configs only
- `infrastructure/` — infrastructure and architecture docs
- `runbooks/` — repeatable procedures
  - **`gemini-preprocessing-hook.md`** — Gemini Flash auto-preprocessing for large inputs in Claude Code. Reduces context 70-80% on fetches/reads >20k tokens. See file for tuning and debugging.
- `scripts/` — executable helpers
- `snippets/` — reusable command or content fragments
- `system-configs/` — curated synced tool and machine config
  - **`claude/hooks/gemini-preprocess-hook.sh`** — PostToolUse hook (Read, WebFetch). Installed in `~/.claude/hooks/` via symlink. Active by default.

## Rule

Keep durable operational knowledge here.
Keep volatile machine state out of Git.
