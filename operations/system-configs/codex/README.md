# Codex Config

This folder is symlinked from `~/.codex`.

It is the canonical home for Codex global config and shared local Codex assets.

## What's canonical here

- `AGENTS.md` — global Codex instructions
- `config.toml` — Codex runtime config, model selection, trusted projects, MCP/plugin setup
- `rules/default.rules` — curated reusable approval rules that should survive machine rebuilds
- `skills/` — installed Codex skills that are intentionally shared through this repo

## What's machine state (not canonical)

- `history.jsonl`, `session_index.jsonl`, `sessions/`, `archived_sessions/`, `worktrees/` — session and workspace state
- `auth.json`, `models_cache.json`, `version.json`, `.codex-global-state.json`, `.personality_migration` — local auth or machine state
- `log/`, `logs_*.sqlite`, `state_*.sqlite`, `sqlite/`, `cache/`, `tmp/`, `.tmp/` — runtime logs, caches, and temporary databases
- `vendor_imports/` and plugin cache internals — synced only if explicitly normalized and documented

## Rule

Keep only durable Codex config in Git.

- `rules/default.rules` should contain reusable approvals, not one-off commands from ad hoc sessions
- Do not commit auth files, histories, logs, caches, or transient plugin/runtime state
- If a file is mostly machine-generated, ignore it unless there is a documented reason to version it
