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
| `starship/` | `~/.config/starship.toml`; optional Codex-safe companion config `~/.config/starship-codex.toml` documented in `operations/runbooks/codex-starship-compatible-prompt.md` |
| `mcp/` | standalone MCP server definitions |
| `docker/` | Docker daemon config |
| `ssh/` | SSH config templates |
| `antigravity/` | Antigravity centralized config, including MCP config templates and the user `mcp.json` path |
| `ide-context.md` | IDE-facing context contract that tells Cursor, Kiro, Antigravity, and future AI IDEs how to use `brain` and `mind` as on-demand context sources |

## Content classes

Each subdir may contain a mix of:

- Portable config — canonical, human-maintained, safe to edit
- Intentionally synced state — runtime artifacts that are versioned by practical necessity (for example Codex skill imports, history files, SQLite state)
- Machine state — present in the working tree but gitignored (logs, session data, auth tokens, caches)

When reading this folder, prefer explicit portable config files. Do not mistake runtime artifacts for canonical reference material.
Credentials and client secrets never belong in tracked config. Use an ignored local overlay or template when a tool needs machine-only secrets.

## Skill Exports

**Hardened invariant: only activated skills are exported.**

All AI/IDE consumers see the same active skill set from `ai/skills/active/` via symlinks managed by `tools/scripts/sync-ai-skills.mjs`:

| Tool | Export Location | Mode | Symlink Target |
|------|-----------------|------|---|
| Claude Code | `claude/skills` | root symlink | `ai/skills/active` |
| Codex | `codex/skills/user` | root symlink | `ai/skills/active` |
| Gemini CLI | `gemini/skills` | root symlink | `ai/skills/active` |
| Cursor | `cursor/skills` | root symlink | `ai/skills/active` |
| Kiro | `kiro/skills` | per-skill entries | each active skill |
| Antigravity | `gemini/antigravity/skills` | root symlink | `ai/skills/active` |

**Vendor and custom skill source folders are not exposed directly** unless they are activated through `ai/skills/active/`. After any skill install:

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check  # Must exit 0
```

The `--check` command verifies that every active skill is visible at the top-level path for each consumer (e.g., `operations/system-configs/claude/skills/<skill>/SKILL.md`). Only commit skill installations after `--check` passes.

## What to edit vs. what to leave alone

- Safe to edit: `CLAUDE.md`, `AGENTS.md`, `config.toml`, `rules/default.rules`, `.zshrc`, `ghostty/config`, `starship/starship.toml`, `git/gitconfig`, `git/gitconfig-demo`, `git/ignore`, and any file described as portable config in the subdir
- Local-only secrets: keep them in ignored overlay files such as `shell/.zshrc.local`, not in tracked config
- Do not edit casually: SQLite files, `history.jsonl`, `auth.json`, `.tmp` folders, `log/` directories, session archives
- Do not delete: anything that is a symlink target; see `brain/CLAUDE.md` under "Do not break"

## CLI Wrapper Pattern

The `bin/` directory contains stable wrapper scripts for CLIs that need to be accessible across multiple AI/IDE consumers:

| Wrapper | Binary | Purpose | Availability |
|---------|--------|---------|----------------|
| `aws-cli` | `/usr/local/bin/aws` | AWS CLI with unified entry point | Claude Code, Codex, Gemini CLI, etc. |
| `azure-cli` | `/opt/homebrew/bin/az` | Azure CLI wrapper | all consumers |
| `cloudflare-cli` | Cloudflare CLI binary | multi-account Cloudflare management | all consumers |
| `spark-cli` | `/usr/local/bin/spark` | Spark email client CLI | all consumers + skills |
| Other cloud wrappers | various | GCP, Hetzner, Tailscale, etc. | all consumers |

**Entry point symlinks:**
- Wrappers live in `bin/` (tracked in git)
- Symlinks exist in `~/.local/bin/` pointing to wrappers
- All consumers can call the wrapper by name (e.g., `spark-cli`)

**Why this pattern?**
- Single source of truth for all AI/IDE consumers
- Environment variable overrides for debugging (e.g., `SPARK_CLI_BIN=/path/to/spark`)
- Portable across machines (wrappers don't hardcode paths)
- Consistent with other CLI patterns in the system

See `operations/runbooks/spark-cli.md` for the Spark CLI universal installation walkthrough.
