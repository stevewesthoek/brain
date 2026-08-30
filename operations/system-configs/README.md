# System Configs

## What this folder is

This folder holds canonical non-secret workstation configuration for Claude Code, Codex, Kiro, Cursor, Gemini, shell, git, SSH, Ghostty, Starship, and related tools.

Configuration ownership is standardized by `operations/specs/workstation-config-ownership.json` and `operations/runbooks/workstation-config-ownership.md`. Every live path must use exactly one mode: `SYMLINK`, `GENERATED-COPY`, `INCLUDE`, or `LOCAL-ONLY`.

Mutable application runtime roots such as `~/.claude`, `~/.cursor`, `~/.gemini`, `~/.kiro`, and `~/.codex` are real local directories. Brain may own selected narrow configuration entries inside them, but sessions, auth, histories, caches, databases, locks, and other runtime state remain local.

## Runtime path map

| Subdir | Purpose / home path |
|--------|---------------------|
| `claude/` | Narrow managed entries inside physical `~/.claude`; Claude runtime/session root remains local |
| `codex/` | Narrow managed entries inside physical `~/.codex`; `config.toml` is a physical generated copy from Brain |
| `kiro/` | Narrow managed entries inside physical `~/.kiro`; Kiro runtime root remains local |
| `cursor/` | Narrow managed entries inside physical `~/.cursor`; Cursor runtime root remains local |
| `gemini/` | Narrow managed entries inside physical `~/.gemini`; Gemini/Antigravity auth/history/runtime state remains local |
| `shell/` | Stable shell config sources such as `.zshrc` / `.zprofile`, eligible for narrow symlinks |
| `git/` | Brain Git config imported from a physical `~/.gitconfig` INCLUDE root; optional local overlay remains local |
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
- Intentionally synced state — normalized artifacts that have an explicit documented reason to be versioned
- Machine state — present in the working tree but gitignored (logs, session data, auth tokens, caches)

When reading this folder, prefer explicit portable config files. Do not mistake runtime artifacts for canonical reference material.
Credentials and client secrets never belong in tracked config. Use an ignored local overlay or template when a tool needs machine-only secrets.

## Skill Exports

**Hardened invariant: only activated skills are exported.**

All AI/IDE consumers see the same active skill set from `ai/skills/active/` via symlinks managed by `tools/scripts/sync-ai-skills.mjs`:

| Tool | Export Location | Mode | Symlink Target |
|------|-----------------|------|---|
| Claude Code | `claude/skills` | root symlink | `ai/skills/active` |
| Codex | `codex/skills/user` (repo projection) and `~/.codex/skills/user` (live) | skills-directory symlink | `ai/skills/active` |
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

## Codex managed runtime root

`~/.codex` must be a real, short directory because Codex creates macOS Unix sockets below it. This is also required for the MacBook Codex app → Office Mac Remote SSH path: the historical whole-root symlink resolved the control socket to 114 bytes, beyond macOS's 103-byte Unix-socket limit.

Managed Codex entries use mixed ownership: `AGENTS.md`, `RTK.md`, `rules/default.rules`, and `skills/user` are narrow symlinks; `config.toml` is a physical mode-0600 `GENERATED-COPY` whose canonical source remains in Brain. Sessions, authentication, databases, plugins, caches, Computer Use, system skills, and app-server state stay local.

Use `operations/scripts/codex-home-managed-root.sh` to check, repair, migrate, or roll back the layout. See `operations/runbooks/codex-managed-runtime-root.md` for the guarded procedure and `operations/runbooks/office-macbook-connectivity.md` for the Remote SSH/network contract.

## CLI Wrapper Pattern

The `bin/` directory contains stable wrapper scripts for CLIs that need to be accessible across multiple AI/IDE consumers:

| Wrapper | Binary | Purpose | Availability |
|---------|--------|---------|----------------|
| `aws-cli` | `/usr/local/bin/aws` | AWS CLI with unified entry point | Claude Code, Codex, Gemini CLI, etc. |
| `azure-cli` | `/opt/homebrew/bin/az` | Azure CLI wrapper | all consumers |
| `cloudflare-api` | Cloudflare REST API | provider-agnostic read-only Cloudflare API access | all consumers |
| `cloudflare-cli` | Cloudflare REST API/account wrappers | multi-account Cloudflare management | all consumers |
| `stable-audio-cli` | `uv run --directory ~/ai-models/stable-audio-3 stable-audio` | Stable Audio 3 local generation CLI | all consumers |
| `stable-audio-warmup` | `~/ai-models/stable-audio-3` + `stable-audio` CLI | warms `small-music`, `small-sfx`, and `medium` model caches | all consumers |
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
See `operations/runbooks/stable-audio-3.md` for Stable Audio 3 install, usage, and model warm-up commands.
See `operations/runbooks/omp-optional-agent.md` for the Oh My Pi (`omp`) optional standalone agent surface. `omp` is registered as a CLI/IDE-style surface only and is not a Brain architecture component.
See `operations/runbooks/open-design-optional-design-surface.md` for the Open Design bridge pattern. Open Design is installed outside Brain and exposed through the `open-design` wrapper. Prefer the `open-design` wrapper name because macOS already has `/usr/bin/od`.
