# Claude configs

This folder is symlinked from ~/.claude.

It is the canonical home for Claude Code global config. Files here are loaded by Claude Code on every session.

### What's canonical here
- `CLAUDE.md` — global instructions and workflow rules for Claude Code (the main doc to read)
- `skills/` → symlink to `brain/ai/skills/active/` — exposes shared skills to Claude
- `claude.json.template` — safe MCP registration template (the live `claude.json` is NOT symlinked — it contains secrets and lives only on this machine)
- `settings.json` — Claude Code settings (hooks, permissions, etc.)
- Any other `.md` files that document Claude behavior or memory

### What's machine state (not canonical)
Most of this folder is machine-generated runtime state. The main categories:
- `projects/` — per-repo session state; auto-memory lives nested here at `projects/<hash>/memory/`
- `sessions/`, `session-env/`, `cache/`, `paste-cache/` — session and cache artifacts
- `logs/` — session logs (gitignored)
- `tasks/` — in-progress task state (gitignored)
- `backups/`, `history.jsonl`, `plans/`, `debug/`, `downloads/` — other generated or runtime files
- `plugins/`, `custom/` — tool-managed extensions or local overrides; check before deleting
- `agents/` — user-authored Claude agent presets and supporting docs; treat as portable config/documentation unless a file is clearly generated

If a file is not listed under "What's canonical here", assume it is machine state unless you can identify it clearly.

### Rule
Do not commit auth tokens, session logs, or machine-specific state from this folder.
If a file is mostly machine-generated, it should be gitignored.
The `.claudeignore` file in the brain repo root controls what Claude sees when reading the repo.
