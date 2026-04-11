# ⚠️ DEPRECATED: NotebookLM MCP Server

**This folder contains legacy NotebookLM MCP server configuration.**

## Migration Complete

As of **2026-04-11**, the NotebookLM integration has been migrated from:
- **Old:** MCP server (Claude MCP + Codex MCP) → NotebookLM MCP server binary
- **New:** CLI v0.3.4 (via `pipx`) → Direct `notebooklm` command-line tool

## What Changed

| Aspect | Old (MCP) | New (CLI) |
|--------|-----------|----------|
| **Installation** | npm/pip package | `pipx install notebooklm-py[browser]` |
| **Command** | MCP server proxy | Direct `notebooklm` CLI |
| **Claude integration** | MCP server in config | `/notebooklm` skill only |
| **Codex integration** | MCP server in config | `/notebooklm` skill only |
| **Data storage** | Google NotebookLM | Google NotebookLM (same) |
| **Authentication** | Via MCP | Direct Google sign-in |

## What's in This Folder (Archive Only)

- `README.md` — Old MCP setup instructions (obsolete)
- `probot-mcporter.md` — Old MCP bridge documentation (obsolete)
- `claude-config.template.json` — Old Claude MCP config (obsolete)
- `notebooklm-config.legacy-python-package.json` — Old Python package config (obsolete)

## Do NOT Use These Files

These configuration files are **kept for reference only** and should not be used.

## Current Setup

- **CLI runbook:** `operations/runbooks/notebooklm.md`
- **Skill file:** `ai/skills/custom/notebooklm.md`
- **Claude config:** `operations/system-configs/claude/CLAUDE.md` (lists `/notebooklm` skill)
- **Codex config:** `operations/system-configs/codex/config.toml` (no MCP entry)

## Verification

✅ Codex config: NotebookLM MCP server entry removed (2026-04-11)
✅ Claude config: No MCP entry for NotebookLM
✅ CLI: `notebooklm --version` returns active version
✅ Runbook: Updated to CLI instructions only
✅ Skill: Updated documentation

## If You Need to Revert

This should not be necessary. The CLI is superior in every way:
- Better token efficiency (no MCP overhead)
- Direct Google authentication
- Full feature parity
- Easier to debug and maintain

If issues arise, check:
1. `notebooklm --version` (must be >= 0.3.4)
2. `notebooklm auth check --test` (verify authentication)
3. `operations/runbooks/notebooklm.md` (current runbook)
