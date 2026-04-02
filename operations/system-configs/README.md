# System Configs

## What this folder is

This folder holds synced tool configuration for Claude Code, Codex, Kiro, Cursor, shell, git, Ghostty, and Starship.

Most subdirs here are the source behind home directory symlinks or other runtime config paths on this machine.

## Symlink map

| Subdir | Purpose / home path |
|--------|---------------------|
| `claude/` | `~/.claude` — Claude Code config, `CLAUDE.md`, skills symlink, MCP templates |
| `codex/` | `~/.codex` — Codex config, skills, vendor imports |
| `kiro/` | `~/.kiro` — Kiro config |
| `cursor/` | Cursor IDE settings and skill overrides |
| `shell/` | shell config (`.zshrc` source) |
| `git/` | `~/.config/git/ignore` |
| `ghostty/` | `~/.config/ghostty/config` |
| `starship/` | `~/.config/starship.toml` |
| `mcp/` | standalone MCP server definitions |
| `docker/` | Docker daemon config |
| `ssh/` | SSH config templates |
| `antigravity/` | Antigravity centralized config, including MCP config templates and the user `mcp.json` path |

## Content classes

Each subdir may contain a mix of:

- Portable config — canonical, human-maintained, safe to edit
- Intentionally synced state — runtime artifacts that are versioned by practical necessity (for example Codex skill imports, history files, SQLite state)
- Machine state — present in the working tree but gitignored (logs, session data, auth tokens, caches)

When reading this folder, prefer explicit portable config files. Do not mistake runtime artifacts for canonical reference material.
Credentials and client secrets never belong in tracked config. Use an ignored local overlay or template when a tool needs machine-only secrets.

## What to edit vs. what to leave alone

- Safe to edit: `CLAUDE.md`, `config.toml`, `.zshrc`, `ghostty/config`, `starship/starship.toml`, `git/ignore`, and any file described as portable config in the subdir
- Local-only secrets: keep them in ignored overlay files such as `shell/.zshrc.local`, not in tracked config
- Do not edit casually: SQLite files, `history.jsonl`, `auth.json`, `.tmp` folders, `log/` directories, session archives
- Do not delete: anything that is a symlink target; see `brain/CLAUDE.md` under "Do not break"
