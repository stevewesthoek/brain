# Operations

Operational docs, helper scripts, deployment notes, and selected synced system configs.

## Structure

- `automations/` — workflow exports and higher-level automations
- `deploy/` — real deployment configs only
- `infrastructure/` — infrastructure and architecture docs
- `runbooks/` — repeatable procedures
  - **`human-writing-guardrails-adoption.md`** — why human-writing polish is a shared final-stage standard, not a separate always-on humanizer skill; lists which orchestrators use it and why.
  - **`gemini-preprocessing-hook.md`** — Gemini Flash auto-preprocessing for large inputs in Claude Code. Reduces context 70-80% on fetches/reads >20k tokens. See file for tuning and debugging.
  - **`rtk.md`** — RTK shell-output token optimization for Claude, Codex, and Gemini sessions, including verification and rollback.
- `standards/` — durable standards used by multiple workflows
  - **`human-writing-guardrails.md`** — shared final-stage writing-quality standard for research, Bible stories, marketing copy, websites, video scripts, captions, and other human-facing text.
- `scripts/` — executable helpers
- `snippets/` — reusable command or content fragments
- `system-configs/` — curated synced tool and machine config
  - **`claude/hooks/gemini-preprocess-hook.sh`** — PostToolUse hook (Read, WebFetch). Installed in `~/.claude/hooks/` via symlink. Active by default.
  - **`claude/hooks/rtk-safe-bash-hook.sh`** — PreToolUse hook (Bash). Preserves risky-command guardrails before RTK rewrite.

## Rule

Keep durable operational knowledge here.
Keep volatile machine state out of Git.
